"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { SharedRun, StackMap } from "./run-dock";

type LinkRole="editor"|"spectator";
type Credentials={room:string;password:string;role:LinkRole};
type LinkStatus="off"|"joining"|"waiting"|"connected"|"offline"|"error";
type SessionCache={version:1;credentials:Credentials;snapshot?:SharedRun};
type DiscoveryMessage={type:"request";sender:string}|{type:"session";sender:string;target?:string;credentials:Credentials}|{type:"disconnect";sender:string;credentials:Credentials};
type YModule=typeof import("yjs");
type ApplyRun=(run:SharedRun)=>void;

const cacheKey="nullscape-calculator-link-v1";
const participantKey="nullscape-calculator-link-participant-v1";
const hashKey="quicklink";
const legacyHashKey="calculator-link";
const discoveryChannelName="nullscape-calculator-link-discovery-v1";
const signalingServers=["wss://y-webrtc-eu.fly.dev","wss://signaling.yjs.dev"];
const turnCredentialsUrl="https://nullscape-quicklink-turn.poggieboii78.workers.dev/turn-credentials";
const reconnectDelays=[4000,9000,18000,30000];
const scalarKeys=["level","players","difficulty","party","gifts"] as const;
const stackKeys=["enemies","curses","medalCurses","greaterCurses","upgrades"] as const;

function randomToken(bytes:number){
  const value=new Uint8Array(bytes);crypto.getRandomValues(value);let binary="";for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function participantId(){
  try{const stored=localStorage.getItem(participantKey);if(stored&&/^[A-Za-z0-9_-]{16}$/.test(stored))return stored;const created=randomToken(12);localStorage.setItem(participantKey,created);return created;}catch{return randomToken(12);}
}

export function encodeCalculatorLink(credentials:Credentials){return`${credentials.room}.${credentials.password}${credentials.role==="spectator"?".spectator":""}`;}

export function parseCalculatorLink(value:string):Credentials|null{
  let candidate=value.trim();
  try{
    if(candidate.includes("#")){const url=new URL(candidate,"https://nullscape.invalid/");const params=new URLSearchParams(url.hash.slice(1));candidate=params.get(hashKey)??params.get(legacyHashKey)??"";}
    else if(candidate.startsWith("#")){const params=new URLSearchParams(candidate.slice(1));candidate=params.get(hashKey)??params.get(legacyHashKey)??"";}
    else if(candidate.startsWith(`${hashKey}=`))candidate=candidate.slice(hashKey.length+1);
    else if(candidate.startsWith(`${legacyHashKey}=`))candidate=candidate.slice(legacyHashKey.length+1);
    candidate=decodeURIComponent(candidate);
  }catch{return null;}
  const [room,password,mode,...rest]=candidate.split(".");
  if(rest.length||(mode&&mode!=="spectator")||!room||!password||!/^[A-Za-z0-9_-]{16}$/.test(room)||!/^[A-Za-z0-9_-]{43}$/.test(password))return null;
  return{room,password,role:mode==="spectator"?"spectator":"editor"};
}

function credentialsFromLocation(){return parseCalculatorLink(location.hash);}
function asSpectator(credentials:Credentials):Credentials{return{...credentials,role:"spectator"};}
function inviteUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();return url.toString();}
function putCredentialsInUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();history.replaceState({},"",url);}
function removeCredentialsFromUrl(){const url=new URL(location.href);const params=new URLSearchParams(url.hash.slice(1));if(!params.has(hashKey)&&!params.has(legacyHashKey))return;url.hash="";history.replaceState({},"",url);}

function readCache():SessionCache|null{
  try{const value=JSON.parse(sessionStorage.getItem(cacheKey)??"null") as Partial<SessionCache>|null;if(value?.version===1&&value.credentials){const credentials=parseCalculatorLink(encodeCalculatorLink(value.credentials));if(credentials)return{version:1,credentials,snapshot:value.snapshot};}}catch{}
  return null;
}
function writeCache(credentials:Credentials,snapshot?:SharedRun){try{sessionStorage.setItem(cacheKey,JSON.stringify({version:1,credentials,snapshot} satisfies SessionCache));}catch{}}
function clearCache(){try{sessionStorage.removeItem(cacheKey);}catch{}}

function sameCredentials(left:Credentials,right:Credentials){return left.room===right.room&&left.password===right.password&&left.role===right.role;}
function sharedShape(run:SharedRun){return{level:run.level,players:run.players,difficulty:run.difficulty,party:run.party,gifts:run.gifts,enemies:run.enemies,curses:run.curses,medalCurses:run.medalCurses,greaterCurses:run.greaterCurses,upgrades:run.upgrades};}
function sameSharedRun(left:SharedRun,right:SharedRun){return JSON.stringify(sharedShape(left))===JSON.stringify(sharedShape(right));}

function stack(root:Y.Map<unknown>,key:typeof stackKeys[number],Yjs:YModule){
  const current=root.get(key);if(current instanceof Yjs.Map)return current as Y.Map<number>;
  const created=new Yjs.Map<number>();root.set(key,created);return created;
}
function writeSharedRun(root:Y.Map<unknown>,run:SharedRun,Yjs:YModule){
  root.doc?.transact(()=>{
    for(const key of scalarKeys)if(root.get(key)!==run[key])root.set(key,run[key]);
    for(const key of stackKeys){const target=stack(root,key,Yjs);for(const name of [...target.keys()])if(!(name in run[key]))target.delete(name);for(const[name,count]of Object.entries(run[key]))if(target.get(name)!==count)target.set(name,count);}
    root.set("initialized",true);
  },"nullscape-local");
}
function readSharedRun(root:Y.Map<unknown>,fallback:SharedRun,Yjs:YModule):SharedRun{
  const readStack=(key:typeof stackKeys[number])=>{const value=root.get(key);if(!(value instanceof Yjs.Map))return{};const result:StackMap={};value.forEach((count,name)=>{const parsed=Math.max(0,Math.floor(Number(count)||0));if(parsed)result[String(name)]=parsed;});return result;};
  return{...fallback,level:Number(root.get("level"))||1,players:Number(root.get("players"))||1,difficulty:(root.get("difficulty")??"standard") as SharedRun["difficulty"],party:(root.get("party")??"solo") as SharedRun["party"],gifts:Number(root.get("gifts"))||0,enemies:readStack("enemies"),curses:readStack("curses"),medalCurses:readStack("medalCurses"),greaterCurses:readStack("greaterCurses"),upgrades:readStack("upgrades")};
}

async function copyText(value:string){
  try{await navigator.clipboard.writeText(value);return true;}catch{}
  try{const input=document.createElement("textarea");input.value=value;input.style.position="fixed";input.style.opacity="0";document.body.append(input);input.select();const copied=document.execCommand("copy");input.remove();return copied;}catch{return false;}
}

async function fetchIceServers():Promise<RTCIceServer[]>{
  const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch(turnCredentialsUrl,{method:"POST",cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error(`TURN credentials returned ${response.status}`);const payload=await response.json() as {iceServers?:unknown};if(!Array.isArray(payload.iceServers)||!payload.iceServers.length)throw new Error("TURN credentials were empty");return payload.iceServers as RTCIceServer[];}finally{window.clearTimeout(timeout);}
}

export function CalculatorLink({run,applyRun,onActiveChange}:{run:SharedRun;applyRun:ApplyRun;onActiveChange?:(active:boolean)=>void}){
  const [open,setOpen]=useState(false);const [status,setStatus]=useState<LinkStatus>("off");const [peers,setPeers]=useState(0);const [hasSnapshot,setHasSnapshot]=useState(false);const [joinValue,setJoinValue]=useState("");const [message,setMessage]=useState("");const [credentials,setCredentials]=useState<Credentials|null>(null);
  const runRef=useRef(run);const credentialsRef=useRef<Credentials|null>(null);const rootRef=useRef<Y.Map<unknown>|null>(null);const yRef=useRef<YModule|null>(null);const providerRef=useRef<WebrtcProvider|null>(null);const docRef=useRef<Y.Doc|null>(null);const applyingRemote=useRef(false);const lastRemoteRef=useRef<SharedRun|null>(null);const generation=useRef(0);const initializedRef=useRef(false);const peersRef=useRef(0);const remotePresenceRef=useRef(0);const discoveryRef=useRef<BroadcastChannel|null>(null);const tabIdRef=useRef("");const autoJoinBlockedRef=useRef(false);const reconnectTimerRef=useRef<number|null>(null);const reconnectAttemptRef=useRef(0);

  const stopProvider=useCallback(()=>{generation.current++;if(reconnectTimerRef.current!==null)window.clearTimeout(reconnectTimerRef.current);reconnectTimerRef.current=null;reconnectAttemptRef.current=0;providerRef.current?.destroy();docRef.current?.destroy();providerRef.current=null;docRef.current=null;rootRef.current=null;yRef.current=null;lastRemoteRef.current=null;initializedRef.current=false;peersRef.current=0;remotePresenceRef.current=0;setPeers(0);setHasSnapshot(false);},[]);
  const disconnect=useCallback((notifyOtherTabs=true)=>{const current=credentialsRef.current;if(notifyOtherTabs&&current&&discoveryRef.current&&tabIdRef.current)discoveryRef.current.postMessage({type:"disconnect",sender:tabIdRef.current,credentials:current} satisfies DiscoveryMessage);autoJoinBlockedRef.current=true;stopProvider();credentialsRef.current=null;setCredentials(null);setStatus("off");setMessage("");setHasSnapshot(false);clearCache();removeCredentialsFromUrl();onActiveChange?.(false);},[onActiveChange,stopProvider]);

  const start=useCallback(async(nextCredentials:Credentials,seed?:SharedRun)=>{
    autoJoinBlockedRef.current=false;stopProvider();const attempt=generation.current;credentialsRef.current=nextCredentials;setCredentials(nextCredentials);setStatus(navigator.onLine?"joining":"offline");setMessage("");putCredentialsInUrl(nextCredentials);onActiveChange?.(true);if(discoveryRef.current&&tabIdRef.current)discoveryRef.current.postMessage({type:"session",sender:tabIdRef.current,credentials:nextCredentials} satisfies DiscoveryMessage);
    try{
      const [Yjs,{WebrtcProvider}]=await Promise.all([import("yjs"),import("y-webrtc")]);if(attempt!==generation.current)return;
      const doc=new Yjs.Doc();const root=doc.getMap<unknown>("run");docRef.current=doc;rootRef.current=root;yRef.current=Yjs;
      const pull=()=>{if(root.get("initialized")!==true)return;initializedRef.current=true;setHasSnapshot(true);const incoming=readSharedRun(root,runRef.current,Yjs);lastRemoteRef.current=incoming;writeCache(nextCredentials,incoming);if(!sameSharedRun(incoming,runRef.current)){applyingRemote.current=true;applyRun(incoming);}setStatus(navigator.onLine?(peersRef.current?"connected":"waiting"):"offline");};
      root.observeDeep(pull);
      if(seed){lastRemoteRef.current=seed;initializedRef.current=true;setHasSnapshot(true);writeCache(nextCredentials,seed);if(nextCredentials.role==="editor")writeSharedRun(root,seed,Yjs);else if(!sameSharedRun(seed,runRef.current)){applyingRemote.current=true;applyRun(seed);}}
      const localPreview=["terminal.local","localhost","127.0.0.1"].includes(location.hostname);if(!globalThis.crypto?.subtle&&!localPreview)throw new Error("QuickLink requires HTTPS");
      let iceServers:RTCIceServer[]|undefined;try{iceServers=await fetchIceServers();}catch(error){console.warn("QuickLink TURN relay unavailable; trying direct connection",error);}if(attempt!==generation.current)return;
      const provider=new WebrtcProvider(`nullscape-calculator-${nextCredentials.room}`,doc,{password:globalThis.crypto?.subtle?nextCredentials.password:undefined,maxConns:24,signaling:signalingServers,peerOpts:iceServers?{config:{iceServers}}:undefined});providerRef.current=provider;
      const ownParticipant=participantId();
      const scheduleReconnect=()=>{if(reconnectTimerRef.current!==null||attempt!==generation.current||remotePresenceRef.current>0||!navigator.onLine)return;const delay=reconnectDelays[Math.min(reconnectAttemptRef.current,reconnectDelays.length-1)];reconnectTimerRef.current=window.setTimeout(()=>{reconnectTimerRef.current=null;if(attempt!==generation.current||remotePresenceRef.current>0||!navigator.onLine)return;reconnectAttemptRef.current++;provider.disconnect();provider.connect();provider.awareness.setLocalStateField("nullscape",{participantId:ownParticipant,role:nextCredentials.role,joinedAt:Date.now()});scheduleReconnect();},delay);};
      const updatePresence=()=>{const participants=new Set<string>();let remoteCount=0;provider.awareness.getStates().forEach((state,clientId)=>{const presence=state.nullscape as {participantId?:unknown;role?:unknown}|undefined;if(!presence)return;if(clientId!==provider.awareness.clientID)remoteCount++;if(presence.role==="spectator")return;participants.add(typeof presence.participantId==="string"&&/^[A-Za-z0-9_-]{16}$/.test(presence.participantId)?presence.participantId:`legacy-${clientId}`);});const count=participants.size;peersRef.current=count;remotePresenceRef.current=remoteCount;setPeers(count);setStatus(navigator.onLine?(initializedRef.current?(count?"connected":"waiting"):"joining"):"offline");if(remoteCount){reconnectAttemptRef.current=0;if(reconnectTimerRef.current!==null)window.clearTimeout(reconnectTimerRef.current);reconnectTimerRef.current=null;}else scheduleReconnect();};
      provider.awareness.on("change",updatePresence);provider.awareness.setLocalStateField("nullscape",{participantId:ownParticipant,role:nextCredentials.role,joinedAt:Date.now()});updatePresence();
      const online=()=>{setStatus(initializedRef.current?(peersRef.current?"connected":"waiting"):"joining");scheduleReconnect();};const offline=()=>setStatus("offline");const listenerController=new AbortController();window.addEventListener("online",online,{signal:listenerController.signal});window.addEventListener("offline",offline,{signal:listenerController.signal});doc.on("destroy",()=>{provider.awareness.off("change",updatePresence);listenerController.abort();});
      pull();window.setTimeout(()=>{if(attempt===generation.current&&!initializedRef.current)setStatus(navigator.onLine?"waiting":"offline");},5000);
    }catch(error){if(attempt!==generation.current)return;console.error("QuickLink failed to start",error);setStatus("error");setMessage("Couldn’t start the live link. Check your connection and try again.");}
  },[applyRun,onActiveChange,stopProvider]);

  useEffect(()=>{runRef.current=run;const root=rootRef.current,Yjs=yRef.current,currentCredentials=credentialsRef.current;if(!root||!Yjs||!currentCredentials||root.get("initialized")!==true)return;if(applyingRemote.current){applyingRemote.current=false;writeCache(currentCredentials,run);return;}if(currentCredentials.role==="spectator"){const shared=lastRemoteRef.current;if(shared&&!sameSharedRun(shared,run)){applyingRemote.current=true;applyRun(shared);}return;}writeSharedRun(root,run,Yjs);writeCache(currentCredentials,run);},[applyRun,run]);
  useEffect(()=>{
    if(typeof BroadcastChannel==="undefined")return;
    if(!tabIdRef.current)tabIdRef.current=randomToken(12);
    const channel=new BroadcastChannel(discoveryChannelName);discoveryRef.current=channel;
    channel.onmessage=event=>{const data=event.data as Partial<DiscoveryMessage>|null;if(!data||typeof data.sender!=="string"||!/^[A-Za-z0-9_-]{16}$/.test(data.sender)||data.sender===tabIdRef.current)return;
      if(data.type==="request"){const current=credentialsRef.current;if(current)channel.postMessage({type:"session",sender:tabIdRef.current,target:data.sender,credentials:current} satisfies DiscoveryMessage);return;}
      if(data.type==="disconnect"){const current=credentialsRef.current,candidate=data.credentials;if(!current||!candidate||typeof candidate.room!=="string"||typeof candidate.password!=="string"||!parseCalculatorLink(encodeCalculatorLink(candidate))||!sameCredentials(current,candidate))return;disconnect(false);return;}
      if(data.type!=="session"||(data.target&&data.target!==tabIdRef.current)||autoJoinBlockedRef.current||credentialsRef.current)return;
      const candidate=data.credentials;if(!candidate||typeof candidate.room!=="string"||typeof candidate.password!=="string"||!parseCalculatorLink(encodeCalculatorLink(candidate)))return;
      void start(candidate);
    };
    channel.postMessage({type:"request",sender:tabIdRef.current} satisfies DiscoveryMessage);
    return()=>{if(discoveryRef.current===channel)discoveryRef.current=null;channel.close();};
  },[disconnect,start]);
  useEffect(()=>{const fromUrl=credentialsFromLocation();const cached=readCache();const chosen=fromUrl??cached?.credentials;const timer=chosen?window.setTimeout(()=>{const seed=cached&&sameCredentials(cached.credentials,chosen)?cached.snapshot:undefined;void start(chosen,seed);},0):null;return()=>{if(timer!==null)clearTimeout(timer);stopProvider();};},[start,stopProvider]);
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[open]);

  const create=async()=>{const next:Credentials={room:randomToken(12),password:randomToken(32),role:"editor"};await start(next,runRef.current);const copied=await copyText(inviteUrl(next));setMessage(copied?"Editor invite copied — send it to your lobby.":"QuickLink created. Use Copy editor invite to share it.");};
  const join=()=>{const parsed=parseCalculatorLink(joinValue);if(!parsed){setMessage("That doesn’t look like a QuickLink.");return;}const cached=readCache();void start(parsed,cached&&sameCredentials(cached.credentials,parsed)?cached.snapshot:undefined);setJoinValue("");setMessage("");};
  const copyInvite=async(spectator=false)=>{if(!credentials)return;const target=spectator?asSpectator(credentials):credentials;const copied=await copyText(inviteUrl(target));setMessage(copied?(spectator?"Spectator link copied — viewers cannot edit or count as lobby participants.":"Editor invite copied."):"Copy failed — select the link below manually.");};
  const isSpectator=credentials?.role==="spectator";
  const statusText=status==="connected"?(isSpectator?`Watching ${peers} lobby participant${peers===1?"":"s"}`:`${peers} lobby participant${peers===1?"":"s"} connected`):status==="offline"?"Offline — reconnects automatically":status==="error"?"QuickLink unavailable":status==="joining"?"Finding the session…":"Waiting for friends…";

  return <>
    <button className={`calculator-link-button ${status!=="off"?"active":""}`} data-tour="calculator-link" onClick={()=>setOpen(true)}><i aria-hidden="true"/>{status==="off"?"QuickLink":isSpectator?"Spectating":peers?`${peers} linked`:"Link active"}</button>
    {open&&<div className="calculator-link-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="calculator-link-dialog" role="dialog" aria-modal="true" aria-labelledby="calculator-link-title">
      <button className="calculator-link-close" onClick={()=>setOpen(false)} aria-label="Close QuickLink">×</button>
      <small>LIVE RUN SHARING</small><h2 id="calculator-link-title">QuickLink</h2>
      {status==="off"?<><p>Create one shared run, then send an editor invite to your lobby or a view-only spectator link to everyone else.</p><button className="link-primary" onClick={create}>Create &amp; copy editor invite</button><div className="link-divider"><span>OR JOIN ONE</span></div><div className="link-join"><input value={joinValue} onChange={event=>setJoinValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")join();}} placeholder="Paste QuickLink or session code" aria-label="QuickLink invite"/><button onClick={join}>Join</button></div></>:<><div className={`link-status ${status}`}><i/><span><b>{statusText}</b><small>{status==="waiting"&&!hasSnapshot?"Someone with the run needs to open the link.":isSpectator?"View only — your local clicks cannot change the shared run.":"Changes sync automatically while this tab is open."}</small></span></div><label className="link-invite"><span>{isSpectator?"SPECTATOR LINK":"EDITOR INVITE"}</span><input readOnly value={credentials?inviteUrl(credentials):""} onFocus={event=>event.currentTarget.select()}/></label>{!isSpectator&&<label className="link-invite"><span>SPECTATOR LINK · VIEW ONLY</span><input readOnly value={credentials?inviteUrl(asSpectator(credentials)):""} onFocus={event=>event.currentTarget.select()}/></label>}<div className="link-session-actions"><button className="link-primary" onClick={()=>copyInvite(isSpectator)}>{isSpectator?"Copy spectator link":"Copy editor invite"}</button>{!isSpectator&&<button className="link-primary" onClick={()=>copyInvite(true)}>Copy spectator link</button>}<button className="link-disconnect" onClick={()=>disconnect()}>Disconnect</button></div></>}
      {message&&<p className="link-message" role="status">{message}</p>}
      <footer><b>Built-in failsafes</b><span>Different fields merge · reconnects automatically · invite data is encrypted · device history and sorting stay private.</span><em>Editor invites can change the run. Spectator links are view-only and do not count as lobby participants.</em></footer>
    </section></div>}
  </>;
}
