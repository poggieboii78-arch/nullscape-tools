"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { SharedRun, StackMap } from "./run-dock";

type Credentials={room:string;password:string};
type LinkStatus="off"|"joining"|"waiting"|"connected"|"offline"|"error";
type SessionCache={version:1;credentials:Credentials;snapshot?:SharedRun};
type DiscoveryMessage={type:"request";sender:string}|{type:"session";sender:string;target?:string;credentials:Credentials};
type YModule=typeof import("yjs");
type ApplyRun=(run:SharedRun)=>void;

const cacheKey="nullscape-calculator-link-v1";
const participantKey="nullscape-calculator-link-participant-v1";
const hashKey="calculator-link";
const discoveryChannelName="nullscape-calculator-link-discovery-v1";
const scalarKeys=["level","players","difficulty","party","gifts"] as const;
const stackKeys=["enemies","curses","medalCurses","greaterCurses","upgrades"] as const;

function randomToken(bytes:number){
  const value=new Uint8Array(bytes);crypto.getRandomValues(value);let binary="";for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function participantId(){
  try{const stored=localStorage.getItem(participantKey);if(stored&&/^[A-Za-z0-9_-]{16}$/.test(stored))return stored;const created=randomToken(12);localStorage.setItem(participantKey,created);return created;}catch{return randomToken(12);}
}

export function encodeCalculatorLink(credentials:Credentials){return`${credentials.room}.${credentials.password}`;}

export function parseCalculatorLink(value:string):Credentials|null{
  let candidate=value.trim();
  try{
    if(candidate.includes("#")){const url=new URL(candidate,"https://nullscape.invalid/");candidate=new URLSearchParams(url.hash.slice(1)).get(hashKey)??"";}
    else if(candidate.startsWith("#"))candidate=new URLSearchParams(candidate.slice(1)).get(hashKey)??"";
    else if(candidate.startsWith(`${hashKey}=`))candidate=candidate.slice(hashKey.length+1);
    candidate=decodeURIComponent(candidate);
  }catch{return null;}
  const [room,password,...rest]=candidate.split(".");
  if(rest.length||!room||!password||!/^[A-Za-z0-9_-]{16}$/.test(room)||!/^[A-Za-z0-9_-]{43}$/.test(password))return null;
  return{room,password};
}

function credentialsFromLocation(){return parseCalculatorLink(location.hash);}
function inviteUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();return url.toString();}
function putCredentialsInUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();history.replaceState({},"",url);}
function removeCredentialsFromUrl(){const url=new URL(location.href);if(!new URLSearchParams(url.hash.slice(1)).has(hashKey))return;url.hash="";history.replaceState({},"",url);}

function readCache():SessionCache|null{
  try{const value=JSON.parse(sessionStorage.getItem(cacheKey)??"null") as Partial<SessionCache>|null;if(value?.version===1&&value.credentials&&parseCalculatorLink(encodeCalculatorLink(value.credentials)))return value as SessionCache;}catch{}
  return null;
}
function writeCache(credentials:Credentials,snapshot?:SharedRun){try{sessionStorage.setItem(cacheKey,JSON.stringify({version:1,credentials,snapshot} satisfies SessionCache));}catch{}}
function clearCache(){try{sessionStorage.removeItem(cacheKey);}catch{}}

function sameCredentials(left:Credentials,right:Credentials){return left.room===right.room&&left.password===right.password;}
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

export function CalculatorLink({run,applyRun,onActiveChange}:{run:SharedRun;applyRun:ApplyRun;onActiveChange?:(active:boolean)=>void}){
  const [open,setOpen]=useState(false);const [status,setStatus]=useState<LinkStatus>("off");const [peers,setPeers]=useState(0);const [hasSnapshot,setHasSnapshot]=useState(false);const [joinValue,setJoinValue]=useState("");const [message,setMessage]=useState("");const [credentials,setCredentials]=useState<Credentials|null>(null);
  const runRef=useRef(run);const credentialsRef=useRef<Credentials|null>(null);const rootRef=useRef<Y.Map<unknown>|null>(null);const yRef=useRef<YModule|null>(null);const providerRef=useRef<WebrtcProvider|null>(null);const docRef=useRef<Y.Doc|null>(null);const applyingRemote=useRef(false);const generation=useRef(0);const initializedRef=useRef(false);const peersRef=useRef(0);const discoveryRef=useRef<BroadcastChannel|null>(null);const tabIdRef=useRef("");const autoJoinBlockedRef=useRef(false);

  const stopProvider=useCallback(()=>{generation.current++;providerRef.current?.destroy();docRef.current?.destroy();providerRef.current=null;docRef.current=null;rootRef.current=null;yRef.current=null;initializedRef.current=false;peersRef.current=0;setPeers(0);setHasSnapshot(false);},[]);
  const disconnect=useCallback(()=>{autoJoinBlockedRef.current=true;stopProvider();credentialsRef.current=null;setCredentials(null);setStatus("off");setMessage("");setHasSnapshot(false);clearCache();removeCredentialsFromUrl();onActiveChange?.(false);},[onActiveChange,stopProvider]);

  const start=useCallback(async(nextCredentials:Credentials,seed?:SharedRun)=>{
    autoJoinBlockedRef.current=false;stopProvider();const attempt=generation.current;credentialsRef.current=nextCredentials;setCredentials(nextCredentials);setStatus(navigator.onLine?"joining":"offline");setMessage("");putCredentialsInUrl(nextCredentials);onActiveChange?.(true);if(discoveryRef.current&&tabIdRef.current)discoveryRef.current.postMessage({type:"session",sender:tabIdRef.current,credentials:nextCredentials} satisfies DiscoveryMessage);
    try{
      const [Yjs,{WebrtcProvider}]=await Promise.all([import("yjs"),import("y-webrtc")]);if(attempt!==generation.current)return;
      const doc=new Yjs.Doc();const root=doc.getMap<unknown>("run");docRef.current=doc;rootRef.current=root;yRef.current=Yjs;
      const pull=()=>{if(root.get("initialized")!==true)return;initializedRef.current=true;setHasSnapshot(true);const incoming=readSharedRun(root,runRef.current,Yjs);writeCache(nextCredentials,incoming);if(!sameSharedRun(incoming,runRef.current)){applyingRemote.current=true;applyRun(incoming);}setStatus(navigator.onLine?(peersRef.current?"connected":"waiting"):"offline");};
      root.observeDeep(pull);
      if(seed){writeSharedRun(root,seed,Yjs);initializedRef.current=true;setHasSnapshot(true);writeCache(nextCredentials,seed);}
      const localPreview=["terminal.local","localhost","127.0.0.1"].includes(location.hostname);if(!globalThis.crypto?.subtle&&!localPreview)throw new Error("Calculator Link requires HTTPS");
      const provider=new WebrtcProvider(`nullscape-calculator-${nextCredentials.room}`,doc,{password:globalThis.crypto?.subtle?nextCredentials.password:undefined,maxConns:24});providerRef.current=provider;
      const ownParticipant=participantId();
      const updatePresence=()=>{const participants=new Set<string>();provider.awareness.getStates().forEach((state,clientId)=>{const presence=state.nullscape as {participantId?:unknown}|undefined;if(!presence)return;participants.add(typeof presence.participantId==="string"&&/^[A-Za-z0-9_-]{16}$/.test(presence.participantId)?presence.participantId:`legacy-${clientId}`);});const count=participants.size;peersRef.current=count;setPeers(count);setStatus(navigator.onLine?(initializedRef.current?(count?"connected":"waiting"):"joining"):"offline");};
      provider.awareness.on("change",updatePresence);provider.awareness.setLocalStateField("nullscape",{participantId:ownParticipant,joinedAt:Date.now()});updatePresence();
      const online=()=>setStatus(initializedRef.current?(peersRef.current?"connected":"waiting"):"joining");const offline=()=>setStatus("offline");const listenerController=new AbortController();window.addEventListener("online",online,{signal:listenerController.signal});window.addEventListener("offline",offline,{signal:listenerController.signal});doc.on("destroy",()=>{provider.awareness.off("change",updatePresence);listenerController.abort();});
      pull();window.setTimeout(()=>{if(attempt===generation.current&&!initializedRef.current)setStatus(navigator.onLine?"waiting":"offline");},5000);
    }catch(error){if(attempt!==generation.current)return;console.error("Calculator Link failed to start",error);setStatus("error");setMessage("Couldn’t start the live link. Check your connection and try again.");}
  },[applyRun,onActiveChange,stopProvider]);

  useEffect(()=>{runRef.current=run;const root=rootRef.current,Yjs=yRef.current,currentCredentials=credentialsRef.current;if(!root||!Yjs||!currentCredentials||root.get("initialized")!==true)return;if(applyingRemote.current){applyingRemote.current=false;writeCache(currentCredentials,run);return;}writeSharedRun(root,run,Yjs);writeCache(currentCredentials,run);},[run]);
  useEffect(()=>{
    if(typeof BroadcastChannel==="undefined")return;
    if(!tabIdRef.current)tabIdRef.current=randomToken(12);
    const channel=new BroadcastChannel(discoveryChannelName);discoveryRef.current=channel;
    channel.onmessage=event=>{const data=event.data as Partial<DiscoveryMessage>|null;if(!data||typeof data.sender!=="string"||!/^[A-Za-z0-9_-]{16}$/.test(data.sender)||data.sender===tabIdRef.current)return;
      if(data.type==="request"){const current=credentialsRef.current;if(current)channel.postMessage({type:"session",sender:tabIdRef.current,target:data.sender,credentials:current} satisfies DiscoveryMessage);return;}
      if(data.type!=="session"||(data.target&&data.target!==tabIdRef.current)||autoJoinBlockedRef.current||credentialsRef.current)return;
      const candidate=data.credentials;if(!candidate||typeof candidate.room!=="string"||typeof candidate.password!=="string"||!parseCalculatorLink(encodeCalculatorLink(candidate)))return;
      void start(candidate);
    };
    channel.postMessage({type:"request",sender:tabIdRef.current} satisfies DiscoveryMessage);
    return()=>{if(discoveryRef.current===channel)discoveryRef.current=null;channel.close();};
  },[start]);
  useEffect(()=>{const fromUrl=credentialsFromLocation();const cached=readCache();const chosen=fromUrl??cached?.credentials;const timer=chosen?window.setTimeout(()=>{const seed=cached&&sameCredentials(cached.credentials,chosen)?cached.snapshot:undefined;void start(chosen,seed);},0):null;return()=>{if(timer!==null)clearTimeout(timer);stopProvider();};},[start,stopProvider]);
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[open]);

  const create=async()=>{const next={room:randomToken(12),password:randomToken(32)};await start(next,runRef.current);const copied=await copyText(inviteUrl(next));setMessage(copied?"Invite copied — send it to your friends.":"Session created. Use Copy invite to share it.");};
  const join=()=>{const parsed=parseCalculatorLink(joinValue);if(!parsed){setMessage("That doesn’t look like a Calculator Link.");return;}const cached=readCache();void start(parsed,cached&&sameCredentials(cached.credentials,parsed)?cached.snapshot:undefined);setJoinValue("");setMessage("");};
  const copyInvite=async()=>{if(!credentials)return;const copied=await copyText(inviteUrl(credentials));setMessage(copied?"Invite copied.":"Copy failed — select the invite below manually.");};
  const statusText=status==="connected"?`${peers} participant${peers===1?"":"s"} connected`:status==="offline"?"Offline — reconnects automatically":status==="error"?"Link unavailable":status==="joining"?"Finding the session…":"Waiting for friends…";

  return <>
    <button className={`calculator-link-button ${status!=="off"?"active":""}`} data-tour="calculator-link" onClick={()=>setOpen(true)}><i aria-hidden="true"/>{status==="off"?"Calculator Link":peers?`${peers} linked`:"Link active"}</button>
    {open&&<div className="calculator-link-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="calculator-link-dialog" role="dialog" aria-modal="true" aria-labelledby="calculator-link-title">
      <button className="calculator-link-close" onClick={()=>setOpen(false)} aria-label="Close Calculator Link">×</button>
      <small>LIVE RUN SHARING</small><h2 id="calculator-link-title">Calculator Link</h2>
      {status==="off"?<><p>Create one shared run, then send the invite to your friends. Golden Gifts, level, lobby data, enemies, Curses, and upgrades update for everyone.</p><button className="link-primary" onClick={create}>Create &amp; copy invite</button><div className="link-divider"><span>OR JOIN ONE</span></div><div className="link-join"><input value={joinValue} onChange={event=>setJoinValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")join();}} placeholder="Paste invite link or session code" aria-label="Calculator Link invite"/><button onClick={join}>Join</button></div></>:<><div className={`link-status ${status}`}><i/><span><b>{statusText}</b><small>{status==="waiting"&&!hasSnapshot?"Someone with the run needs to open the link.":"Changes sync automatically while this tab is open."}</small></span></div><label className="link-invite"><span>INVITE</span><input readOnly value={credentials?inviteUrl(credentials):""} onFocus={event=>event.currentTarget.select()}/></label><div className="link-session-actions"><button className="link-primary" onClick={copyInvite}>Copy invite</button><button className="link-disconnect" onClick={disconnect}>Disconnect</button></div></>}
      {message&&<p className="link-message" role="status">{message}</p>}
      <footer><b>Built-in failsafes</b><span>Different fields merge · reconnects after brief dropouts · invite data is encrypted · device history and sorting stay private.</span><em>Everyone with the invite can edit. If two people change the same value together, the session resolves it consistently.</em></footer>
    </section></div>}
  </>;
}
