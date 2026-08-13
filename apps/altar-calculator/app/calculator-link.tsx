"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import type { SharedRun, StackMap } from "./run-dock";

type LinkRole="editor"|"spectator";
type SpectatorCredentials={version:2;room:string;password:string;role:"spectator"};
type EditorCredentials={version:2;room:string;password:string;spectatorRoom:string;spectatorPassword:string;role:"editor"};
type Credentials=EditorCredentials|SpectatorCredentials;
type LinkStatus="off"|"joining"|"waiting"|"connected"|"offline"|"error";
type SessionCache={version:1;credentials:Credentials;snapshot?:SharedRun};
type DiscoveryMessage={type:"request";sender:string}|{type:"session";sender:string;target?:string;credentials:Credentials}|{type:"disconnect";sender:string;credentials:Credentials};
type YModule=typeof import("yjs");
type ApplyRun=(run:SharedRun)=>void;
export type QuickLinkToolState=Record<string,unknown>;
type ApplyToolState=(state:QuickLinkToolState)=>void;
type RelayPresence={participantId:string;sessionId:string;role:LinkRole;lastSeen:number};
type RelayConnection={destroy:()=>void};

const cacheKey="nullscape-calculator-link-v1";
const participantKey="nullscape-calculator-link-participant-v1";
const hashKey="quicklink";
const legacyHashKey="calculator-link";
const discoveryChannelName="nullscape-calculator-link-discovery-v1";
const signalingServers=["wss://y-webrtc-eu.fly.dev","wss://signaling.yjs.dev"];
const turnCredentialsUrl="https://nullscape-quicklink-turn.poggieboii78.workers.dev/turn-credentials";
const relayUrl="wss://nullscape-quicklink-turn.poggieboii78.workers.dev/quicklink";
const reconnectDelays=[1000,2500,5000,10000,20000];
const scalarKeys=["level","players","difficulty","party","gifts"] as const;
const stackKeys=["enemies","curses","medalCurses","greaterCurses","upgrades"] as const;

function randomToken(bytes:number){
  const value=new Uint8Array(bytes);crypto.getRandomValues(value);let binary="";for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function participantId(){
  try{const stored=localStorage.getItem(participantKey);if(stored&&/^[A-Za-z0-9_-]{16}$/.test(stored))return stored;const created=randomToken(12);localStorage.setItem(participantKey,created);return created;}catch{return randomToken(12);}
}

export function encodeCalculatorLink(credentials:Credentials){return credentials.role==="spectator"?`s.${credentials.room}.${credentials.password}`:`e.${credentials.room}.${credentials.password}.${credentials.spectatorRoom}.${credentials.spectatorPassword}`;}

export function parseCalculatorLink(value:string):Credentials|null{
  let candidate=value.trim();
  try{
    if(candidate.includes("#")){const url=new URL(candidate,"https://nullscape.invalid/");const params=new URLSearchParams(url.hash.slice(1));candidate=params.get(hashKey)??params.get(legacyHashKey)??"";}
    else if(candidate.startsWith("#")){const params=new URLSearchParams(candidate.slice(1));candidate=params.get(hashKey)??params.get(legacyHashKey)??"";}
    else if(candidate.startsWith(`${hashKey}=`))candidate=candidate.slice(hashKey.length+1);
    else if(candidate.startsWith(`${legacyHashKey}=`))candidate=candidate.slice(legacyHashKey.length+1);
    candidate=decodeURIComponent(candidate);
  }catch{return null;}
  const parts=candidate.split(".");const token=(value:string|undefined,length:number)=>!!value&&new RegExp(`^[A-Za-z0-9_-]{${length}}$`).test(value);
  if(parts[0]==="s"&&parts.length===3&&token(parts[1],16)&&token(parts[2],43))return{version:2,role:"spectator",room:parts[1],password:parts[2]};
  if(parts[0]==="e"&&parts.length===5&&token(parts[1],16)&&token(parts[2],43)&&token(parts[3],16)&&token(parts[4],43))return{version:2,role:"editor",room:parts[1],password:parts[2],spectatorRoom:parts[3],spectatorPassword:parts[4]};
  return null;
}

function credentialsFromLocation(){return parseCalculatorLink(location.hash);}
function asSpectator(credentials:Credentials):SpectatorCredentials{return credentials.role==="spectator"?credentials:{version:2,role:"spectator",room:credentials.spectatorRoom,password:credentials.spectatorPassword};}
function inviteUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();return url.toString();}
function putCredentialsInUrl(credentials:Credentials){const url=new URL(location.href);url.searchParams.delete("run");url.hash=new URLSearchParams({[hashKey]:encodeCalculatorLink(credentials)}).toString();history.replaceState({},"",url);}
function removeCredentialsFromUrl(){const url=new URL(location.href);const params=new URLSearchParams(url.hash.slice(1));if(!params.has(hashKey)&&!params.has(legacyHashKey))return;url.hash="";history.replaceState({},"",url);}

function readCache():SessionCache|null{
  try{const value=JSON.parse(sessionStorage.getItem(cacheKey)??"null") as Partial<SessionCache>|null;if(value?.version===1&&value.credentials){const credentials=parseCalculatorLink(encodeCalculatorLink(value.credentials));if(credentials)return{version:1,credentials,snapshot:value.snapshot};}}catch{}
  return null;
}
function writeCache(credentials:Credentials,snapshot?:SharedRun){try{sessionStorage.setItem(cacheKey,JSON.stringify({version:1,credentials,snapshot} satisfies SessionCache));}catch{}}
function clearCache(){try{sessionStorage.removeItem(cacheKey);}catch{}}

function sameCredentials(left:Credentials,right:Credentials){return encodeCalculatorLink(left)===encodeCalculatorLink(right);}
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

function bytesToBase64(bytes:Uint8Array){let binary="";for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function base64ToBytes(value:string){const padded=value.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((value.length+3)%4);const binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0));}
async function relayKey(password:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`nullscape-quicklink-v3:${password}`));return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"]);}
async function encryptRelay(key:CryptoKey,value:unknown){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value))));const packed=new Uint8Array(iv.length+encrypted.length);packed.set(iv);packed.set(encrypted,iv.length);return bytesToBase64(packed);}
async function decryptRelay(key:CryptoKey,value:string){const packed=base64ToBytes(value);if(packed.length<29)throw new Error("Invalid relay message");const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:packed.subarray(0,12)},key,packed.subarray(12));return JSON.parse(new TextDecoder().decode(decrypted)) as {type?:unknown;update?:unknown;presence?:unknown};}
async function fetchIceServers():Promise<RTCIceServer[]>{const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),8000);try{const response=await fetch(turnCredentialsUrl,{method:"POST",cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error(`TURN credentials returned ${response.status}`);const payload=await response.json() as {iceServers?:unknown};if(!Array.isArray(payload.iceServers)||!payload.iceServers.length)throw new Error("TURN credentials were empty");return payload.iceServers as RTCIceServer[];}finally{window.clearTimeout(timeout);}}

async function connectRelay({room,password,doc,Yjs,presence,onPresence,onConnection}:{room:string;password:string;doc:Y.Doc;Yjs:YModule;presence:RelayPresence;onPresence:(presences:Map<string,RelayPresence>)=>void;onConnection:(connected:boolean)=>void}):Promise<RelayConnection>{
  const key=await relayKey(password);const presences=new Map<string,RelayPresence>([[presence.participantId,presence]]);let socket:WebSocket|null=null;let stopped=false;let reconnectTimer:number|null=null;let reconnectAttempt=0;const relayOrigin={quickLinkRelay:true};
  const publishPresence=()=>{const current={...presence,lastSeen:Date.now()};presences.set(current.participantId,current);onPresence(new Map(presences));return current;};
  const send=async(payload:unknown)=>{const current=socket;if(!current||current.readyState!==WebSocket.OPEN)return;try{current.send(await encryptRelay(key,payload));}catch(error){console.warn("QuickLink could not encrypt a relay update",error);}};
  const sendSnapshot=()=>void send({type:"sync",update:bytesToBase64(Yjs.encodeStateAsUpdate(doc)),presence:publishPresence()});
  const scheduleReconnect=()=>{if(stopped||reconnectTimer!==null||!navigator.onLine)return;const delay=reconnectDelays[Math.min(reconnectAttempt,reconnectDelays.length-1)];reconnectTimer=window.setTimeout(()=>{reconnectTimer=null;reconnectAttempt++;open();},delay);};
  const open=()=>{if(stopped)return;const url=new URL(relayUrl);url.searchParams.set("room",room);const next=new WebSocket(url);socket=next;next.addEventListener("open",()=>{if(stopped||socket!==next){next.close();return;}reconnectAttempt=0;onConnection(true);sendSnapshot();});next.addEventListener("message",event=>{if(stopped||socket!==next||typeof event.data!=="string")return;if(event.data.startsWith("{")){try{const control=JSON.parse(event.data) as {type?:unknown};if(control.type==="peer-joined")sendSnapshot();}catch{}return;}void (async()=>{try{const payload=await decryptRelay(key,event.data);const candidate=payload.presence as Partial<RelayPresence>|undefined;if(candidate&&typeof candidate.participantId==="string"&&/^[A-Za-z0-9_-]{16}$/.test(candidate.participantId)&&typeof candidate.sessionId==="string"&&typeof candidate.lastSeen==="number"&&(candidate.role==="editor"||candidate.role==="spectator"))presences.set(candidate.participantId,candidate as RelayPresence);if((payload.type==="sync"||payload.type==="update")&&typeof payload.update==="string")Yjs.applyUpdate(doc,base64ToBytes(payload.update),relayOrigin);onPresence(new Map(presences));}catch(error){console.warn("QuickLink ignored an unreadable relay message",error);}})();});next.addEventListener("close",()=>{if(socket!==next)return;socket=null;onConnection(false);scheduleReconnect();});next.addEventListener("error",()=>next.close());};
  const updateHandler=(update:Uint8Array,origin:unknown)=>{if(origin===relayOrigin)return;void send({type:"update",update:bytesToBase64(update),presence:publishPresence()});};doc.on("update",updateHandler);const heartbeat=window.setInterval(()=>{const cutoff=Date.now()-35000;for(const[id,item]of presences)if(id!==presence.participantId&&item.lastSeen<cutoff)presences.delete(id);void send({type:"presence",presence:publishPresence()});},10000);const online=()=>{if(!socket)scheduleReconnect();};window.addEventListener("online",online);publishPresence();open();
  return{destroy:()=>{stopped=true;if(reconnectTimer!==null)window.clearTimeout(reconnectTimer);window.clearInterval(heartbeat);window.removeEventListener("online",online);doc.off("update",updateHandler);socket?.close(1000,"QuickLink closed");socket=null;onConnection(false);}};
}

export function CalculatorLink({run,applyRun,toolId,toolState,applyToolState,onActiveChange}:{run:SharedRun;applyRun:ApplyRun;toolId?:string;toolState?:QuickLinkToolState;applyToolState?:ApplyToolState;onActiveChange?:(active:boolean)=>void}){
  const [open,setOpen]=useState(false);const [status,setStatus]=useState<LinkStatus>("off");const [peers,setPeers]=useState(0);const [spectators,setSpectators]=useState(0);const [hasSnapshot,setHasSnapshot]=useState(false);const [joinValue,setJoinValue]=useState("");const [message,setMessage]=useState("");const [credentials,setCredentials]=useState<Credentials|null>(null);const isSpectator=credentials?.role==="spectator";
  const runRef=useRef(run);const toolStateRef=useRef(toolState);const applyToolStateRef=useRef(applyToolState);const applyingRemoteTool=useRef(false);const lastRemoteToolRef=useRef("");const credentialsRef=useRef<Credentials|null>(null);const rootRef=useRef<Y.Map<unknown>|null>(null);const mirrorRootRef=useRef<Y.Map<unknown>|null>(null);const yRef=useRef<YModule|null>(null);const relayRef=useRef<RelayConnection|null>(null);const mirrorRelayRef=useRef<RelayConnection|null>(null);const providerRef=useRef<WebrtcProvider|null>(null);const mirrorProviderRef=useRef<WebrtcProvider|null>(null);const docRef=useRef<Y.Doc|null>(null);const mirrorDocRef=useRef<Y.Doc|null>(null);const applyingRemote=useRef(false);const lastRemoteRef=useRef<SharedRun|null>(null);const generation=useRef(0);const initializedRef=useRef(false);const peersRef=useRef(0);const relayConnectedRef=useRef(new Set<"run"|"spectators">());const runPresenceRef=useRef(new Map<string,RelayPresence>());const spectatorPresenceRef=useRef(new Map<string,RelayPresence>());const discoveryRef=useRef<BroadcastChannel|null>(null);const tabIdRef=useRef("");const autoJoinBlockedRef=useRef(false);

  const stopProvider=useCallback(()=>{generation.current++;relayRef.current?.destroy();mirrorRelayRef.current?.destroy();providerRef.current?.destroy();mirrorProviderRef.current?.destroy();docRef.current?.destroy();mirrorDocRef.current?.destroy();relayRef.current=null;mirrorRelayRef.current=null;providerRef.current=null;mirrorProviderRef.current=null;docRef.current=null;mirrorDocRef.current=null;rootRef.current=null;mirrorRootRef.current=null;yRef.current=null;lastRemoteRef.current=null;initializedRef.current=false;peersRef.current=0;relayConnectedRef.current.clear();runPresenceRef.current.clear();spectatorPresenceRef.current.clear();setPeers(0);setSpectators(0);setHasSnapshot(false);},[]);
  const disconnect=useCallback((notifyOtherTabs=true)=>{const current=credentialsRef.current;if(notifyOtherTabs&&current&&discoveryRef.current&&tabIdRef.current)discoveryRef.current.postMessage({type:"disconnect",sender:tabIdRef.current,credentials:current} satisfies DiscoveryMessage);autoJoinBlockedRef.current=true;stopProvider();credentialsRef.current=null;setCredentials(null);setStatus("off");setMessage("");setHasSnapshot(false);clearCache();removeCredentialsFromUrl();onActiveChange?.(false);},[onActiveChange,stopProvider]);

  const start=useCallback(async(nextCredentials:Credentials,seed?:SharedRun)=>{
    autoJoinBlockedRef.current=false;stopProvider();const attempt=generation.current;credentialsRef.current=nextCredentials;setCredentials(nextCredentials);setStatus(navigator.onLine?"joining":"offline");setMessage("");putCredentialsInUrl(nextCredentials);onActiveChange?.(true);if(discoveryRef.current&&tabIdRef.current)discoveryRef.current.postMessage({type:"session",sender:tabIdRef.current,credentials:nextCredentials} satisfies DiscoveryMessage);
    try{
      const Yjs=await import("yjs");if(attempt!==generation.current)return;
      const doc=new Yjs.Doc();const root=doc.getMap<unknown>("run");docRef.current=doc;rootRef.current=root;yRef.current=Yjs;
      const pull=()=>{if(root.get("initialized")!==true)return;initializedRef.current=true;setHasSnapshot(true);const incoming=readSharedRun(root,runRef.current,Yjs);lastRemoteRef.current=incoming;writeCache(nextCredentials,incoming);if(!sameSharedRun(incoming,runRef.current)){applyingRemote.current=true;applyRun(incoming);}if(toolId){const raw=root.get(`tool:${toolId}`);if(typeof raw==="string"&&raw!==lastRemoteToolRef.current&&applyToolStateRef.current){try{const parsed=JSON.parse(raw) as unknown;if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)){lastRemoteToolRef.current=raw;applyingRemoteTool.current=true;applyToolStateRef.current(parsed as QuickLinkToolState);}}catch{}}else if(raw===undefined&&nextCredentials.role==="editor"&&toolStateRef.current){const local=JSON.stringify(toolStateRef.current);lastRemoteToolRef.current=local;root.set(`tool:${toolId}`,local);}}const mirror=mirrorRootRef.current;if(nextCredentials.role==="editor"&&mirror)root.forEach((value,key)=>{if(key.startsWith("tool:")&&mirror.get(key)!==value)mirror.set(key,value);});setStatus(navigator.onLine?(peersRef.current>Number(nextCredentials.role==="editor")?"connected":"waiting"):"offline");};
      root.observeDeep(pull);
      if(seed){lastRemoteRef.current=seed;initializedRef.current=true;setHasSnapshot(true);writeCache(nextCredentials,seed);if(nextCredentials.role==="editor")writeSharedRun(root,seed,Yjs);else if(!sameSharedRun(seed,runRef.current)){applyingRemote.current=true;applyRun(seed);}}
      const localPreview=["terminal.local","localhost","127.0.0.1"].includes(location.hostname);if(!globalThis.crypto?.subtle&&!localPreview)throw new Error("QuickLink requires HTTPS");
      const ownParticipant=participantId();const ownSession=randomToken(12);const ownPresence:RelayPresence={participantId:ownParticipant,sessionId:ownSession,role:nextCredentials.role,lastSeen:Date.now()};
      const updatePresence=()=>{const combined=new Map<string,RelayPresence>();for(const source of [runPresenceRef.current,spectatorPresenceRef.current])for(const[id,presence]of source){const current=combined.get(id);if(!current||presence.role==="editor")combined.set(id,presence);}let count=0,viewerCount=0;combined.forEach(presence=>{if(presence.role==="spectator")viewerCount++;else count++;});peersRef.current=count;setPeers(count);setSpectators(viewerCount);const remoteUsers=Math.max(0,combined.size-1);setStatus(navigator.onLine?(initializedRef.current?(remoteUsers>0?"connected":"waiting"):"joining"):"offline");};
      const connection=(name:"run"|"spectators")=>(connected:boolean)=>{if(connected)relayConnectedRef.current.add(name);else relayConnectedRef.current.delete(name);if(!relayConnectedRef.current.size&&!navigator.onLine)setStatus("offline");};
      const relayConnection=await connectRelay({room:nextCredentials.room,password:nextCredentials.password,doc,Yjs,presence:ownPresence,onPresence:value=>{runPresenceRef.current=value;updatePresence();},onConnection:connection("run")});if(attempt!==generation.current){relayConnection.destroy();return;}relayRef.current=relayConnection;
      if(nextCredentials.role==="editor"){
        const mirrorDoc=new Yjs.Doc();const mirrorRoot=mirrorDoc.getMap<unknown>("run");mirrorDocRef.current=mirrorDoc;mirrorRootRef.current=mirrorRoot;writeSharedRun(mirrorRoot,seed??runRef.current,Yjs);root.forEach((value,key)=>{if(key.startsWith("tool:"))mirrorRoot.set(key,value);});
        const mirrorRelayConnection=await connectRelay({room:nextCredentials.spectatorRoom,password:nextCredentials.spectatorPassword,doc:mirrorDoc,Yjs,presence:ownPresence,onPresence:value=>{spectatorPresenceRef.current=value;updatePresence();},onConnection:connection("spectators")});if(attempt!==generation.current){mirrorRelayConnection.destroy();return;}mirrorRelayRef.current=mirrorRelayConnection;
      }
      let iceServers:RTCIceServer[]|undefined;try{iceServers=await fetchIceServers();}catch(error){console.warn("QuickLink peer-to-peer fallback is unavailable",error);}if(attempt!==generation.current)return;const {WebrtcProvider}=await import("y-webrtc");if(attempt!==generation.current)return;const providerOptions=(password:string)=>({password:password,maxConns:24,signaling:signalingServers,peerOpts:iceServers?{config:{iceServers}}:undefined});providerRef.current=new WebrtcProvider(`nullscape-calculator-v2-${nextCredentials.room}`,doc,providerOptions(nextCredentials.password));if(nextCredentials.role==="editor"&&mirrorDocRef.current)mirrorProviderRef.current=new WebrtcProvider(`nullscape-calculator-v2-${nextCredentials.spectatorRoom}`,mirrorDocRef.current,providerOptions(nextCredentials.spectatorPassword));
      updatePresence();
      pull();window.setTimeout(()=>{if(attempt===generation.current&&!initializedRef.current)setStatus(navigator.onLine?"waiting":"offline");},5000);
    }catch(error){if(attempt!==generation.current)return;console.error("QuickLink failed to start",error);setStatus("error");setMessage("Couldn’t start the live link. Check your connection and try again.");}
  },[applyRun,onActiveChange,stopProvider,toolId]);

  useEffect(()=>{runRef.current=run;const root=rootRef.current,mirrorRoot=mirrorRootRef.current,Yjs=yRef.current,currentCredentials=credentialsRef.current;if(!root||!Yjs||!currentCredentials||root.get("initialized")!==true)return;if(applyingRemote.current){applyingRemote.current=false;if(currentCredentials.role==="editor"&&mirrorRoot)writeSharedRun(mirrorRoot,run,Yjs);writeCache(currentCredentials,run);return;}if(currentCredentials.role==="spectator"){const shared=lastRemoteRef.current;if(shared&&!sameSharedRun(shared,run)){applyingRemote.current=true;applyRun(shared);}return;}writeSharedRun(root,run,Yjs);if(mirrorRoot)writeSharedRun(mirrorRoot,run,Yjs);writeCache(currentCredentials,run);},[applyRun,run]);
  useEffect(()=>{toolStateRef.current=toolState;applyToolStateRef.current=applyToolState;},[applyToolState,toolState]);
  useEffect(()=>{if(!toolId||!toolState)return;const root=rootRef.current,mirrorRoot=mirrorRootRef.current,currentCredentials=credentialsRef.current;if(!root||!currentCredentials||root.get("initialized")!==true)return;const raw=JSON.stringify(toolState);if(applyingRemoteTool.current){applyingRemoteTool.current=false;lastRemoteToolRef.current=raw;if(currentCredentials.role==="editor"&&mirrorRoot)mirrorRoot.set(`tool:${toolId}`,raw);return;}if(currentCredentials.role==="spectator"){if(lastRemoteToolRef.current&&raw!==lastRemoteToolRef.current){try{applyToolStateRef.current?.(JSON.parse(lastRemoteToolRef.current) as QuickLinkToolState);}catch{}}return;}lastRemoteToolRef.current=raw;root.set(`tool:${toolId}`,raw);if(mirrorRoot)mirrorRoot.set(`tool:${toolId}`,raw);},[toolId,toolState]);
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
  useEffect(()=>{if(!isSpectator)return;document.body.classList.add("quicklink-spectator-mode");const block=(event:Event)=>{const target=event.target;if(target instanceof Element&&target.closest(".calculator-link-button,.calculator-link-layer"))return;event.preventDefault();event.stopImmediatePropagation();};const events=["click","dblclick","pointerdown","beforeinput","input","change","submit"] as const;for(const type of events)document.addEventListener(type,block,true);const keyboard=(event:KeyboardEvent)=>{if(event.ctrlKey||event.metaKey||event.altKey||event.key==="Tab"||event.key==="Escape"||event.key.startsWith("Arrow")||event.key.startsWith("F")||event.key==="PageUp"||event.key==="PageDown"||event.key==="Home"||event.key==="End")return;block(event);};document.addEventListener("keydown",keyboard,true);return()=>{document.body.classList.remove("quicklink-spectator-mode");for(const type of events)document.removeEventListener(type,block,true);document.removeEventListener("keydown",keyboard,true);};},[isSpectator]);

  const create=async()=>{const next:EditorCredentials={version:2,room:randomToken(12),password:randomToken(32),spectatorRoom:randomToken(12),spectatorPassword:randomToken(32),role:"editor"};await start(next,runRef.current);const copied=await copyText(inviteUrl(next));setMessage(copied?"Editor invite copied — send it to your lobby.":"QuickLink created. Use Copy editor invite to share it.");};
  const join=()=>{const parsed=parseCalculatorLink(joinValue);if(!parsed){setMessage("That doesn’t look like a QuickLink.");return;}const cached=readCache();void start(parsed,cached&&sameCredentials(cached.credentials,parsed)?cached.snapshot:undefined);setJoinValue("");setMessage("");};
  const copyInvite=async(spectator=false)=>{if(!credentials)return;const target=spectator?asSpectator(credentials):credentials;const copied=await copyText(inviteUrl(target));setMessage(copied?(spectator?"Spectator link copied — viewers cannot edit or count as lobby participants.":"Editor invite copied."):"Copy failed — select the link below manually.");};
  const linkedUsers=peers+spectators;const presenceText=`${peers} lobby participant${peers===1?"":"s"}${spectators?` · ${spectators} spectator${spectators===1?"":"s"}`:""}`;
  const statusText=status==="connected"?(isSpectator?`Watching ${presenceText}`:`${presenceText} connected`):status==="offline"?"Offline — reconnects automatically":status==="error"?"QuickLink unavailable":status==="joining"?"Finding the session…":"Waiting for friends…";

  return <>
    <button className={`calculator-link-button ${status!=="off"?"active":""}`} data-tour="calculator-link" onClick={()=>setOpen(true)}><i aria-hidden="true"/>{status==="off"?"QuickLink":isSpectator?`${linkedUsers} watching`:linkedUsers?`${linkedUsers} linked`:"Link active"}</button>
    {open&&<div className="calculator-link-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}><section className="calculator-link-dialog" role="dialog" aria-modal="true" aria-labelledby="calculator-link-title">
      <button className="calculator-link-close" onClick={()=>setOpen(false)} aria-label="Close QuickLink">×</button>
      <small>LIVE RUN SHARING</small><h2 id="calculator-link-title">QuickLink</h2>
      {status==="off"?<><p>Create one shared run, then send an editor invite to your lobby or a view-only spectator link to everyone else.</p><button className="link-primary" onClick={create}>Create &amp; copy editor invite</button><div className="link-divider"><span>OR JOIN ONE</span></div><div className="link-join"><input value={joinValue} onChange={event=>setJoinValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")join();}} placeholder="Paste QuickLink or session code" aria-label="QuickLink invite"/><button onClick={join}>Join</button></div></>:<><div className={`link-status ${status}`}><i/><span><b>{statusText}</b><small>{status==="waiting"&&!hasSnapshot?"Someone with the run needs to open the link.":isSpectator?"View only — your local clicks cannot change the shared run.":"Changes sync automatically while this tab is open."}</small></span></div><label className="link-invite"><span>{isSpectator?"SPECTATOR LINK":"EDITOR INVITE"}</span><input readOnly value={credentials?inviteUrl(credentials):""} onFocus={event=>event.currentTarget.select()}/></label>{!isSpectator&&<label className="link-invite"><span>SPECTATOR LINK · VIEW ONLY</span><input readOnly value={credentials?inviteUrl(asSpectator(credentials)):""} onFocus={event=>event.currentTarget.select()}/></label>}<div className="link-session-actions"><button className="link-primary" onClick={()=>copyInvite(isSpectator)}>{isSpectator?"Copy spectator link":"Copy editor invite"}</button>{!isSpectator&&<button className="link-primary" onClick={()=>copyInvite(true)}>Copy spectator link</button>}<button className="link-disconnect" onClick={()=>disconnect()}>Disconnect</button></div></>}
      {message&&<p className="link-message" role="status">{message}</p>}
      <footer><b>Built-in failsafes</b><span>Different fields merge · reconnects automatically · invite data is encrypted · device history and sorting stay private.</span><em>Editor and spectator invites use separate access keys. Editing a spectator URL cannot unlock the lobby.</em></footer>
    </section></div>}
  </>;
}
