"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalculatorLink } from "./calculator-link";

export type Difficulty = "casual" | "standard" | "extreme";
export type Party = "solo" | "duo" | "party" | "party-plus";
export type InputMode = "quick" | "both" | "tool";
export type StackMap = Record<string,number>;
export type SharedRun = {
  level:number; players:number; difficulty:Difficulty; party:Party; gifts:number;
  enemies:StackMap; curses:StackMap; medalCurses:StackMap;
  greaterCurses:StackMap; upgrades:StackMap; inputMode:InputMode; updatedAt:number;
};

type TrackedCategory="enemies"|"curses"|"medalCurses"|"greaterCurses"|"upgrades";
type PickEvent={level:number;category:TrackedCategory;name:string;amount:number;at:number;learned:boolean};
type ActivityState={events:PickEvent[];stats:Record<string,[number,number]>;learning:boolean;updatedAt:number};
type ArchivedRun={id:string;endedAt:number;finalLevel:number;players:number;difficulty:Difficulty;party:Party;learning:boolean;events:PickEvent[]};

const storageKey="nullscape-shared-run-v3";
const cookieName="nullscape_shared_run_v3";
const activityKey="nullscape-pick-activity-v1";
const activityEventsCookie="nullscape_pick_events_v1";
const activityStatsCookie="nullscape_pick_stats_v1";
const archiveKey="nullscape-run-archive-v1";
const archiveCookiePrefix="nullscape_run_archive_v1_";
export const defaultSharedRun:SharedRun={level:1,players:1,difficulty:"standard",party:"solo",gifts:0,enemies:{},curses:{},medalCurses:{},greaterCurses:{},upgrades:{Paycheck:1},inputMode:"quick",updatedAt:0};
const emptyActivity:ActivityState={events:[],stats:{},learning:true,updatedAt:0};

export const enemyOptions=["Bell","Baby","Husk","ICBM","Mart","Springer","Flesh","Operator","Guardian","Telefragger","Kolóna","Voidbound Baby","Cadence","Sigil","Voidbreaker","Voidbound Guardian","Scrapmaw","???"];
export const curseOptions=["Lower Gravity","Random Spawn","Scattered Gifts","Weaker Jump Pads","Savory Ring","Bigger Tripmines","More Tripmines","High Roller","Tweaked Odds","Fake Count","LAP 2","Fragile Gifts","Nothing?","Jackpot","Barotrauma","Minefield","Beacon Mirage","More Ringing","Mighty Gong","Concussion","Bigger Marts","Mart Infection","Mart Slide","Pacifier","Problem Child","Scorched Earth","Bigger Blast","Closer Husk","Further Husk","Taller Husk","Husk Express","Conga Line","Random Husk","Resonating Shockwaves","Springloaded","Bloodier Meat","Blighted Jump Pads","Camouflage","Shotgun","Ambush","Accurate Telefragger","Lost Embers","Burning Bouquet","Blade Carousel","Deadly Melody","Mighty Cavalry","Missile Silo","Bloody Bell","Delusion"];
export const curseStackLimits:Record<string,number>=Object.fromEntries(curseOptions.map(name=>[name,["More Tripmines","Minefield","Bigger Blast"].includes(name)?2:1]));
export const medalOptions:[string,number][]=[["Bigger Tripmines",1],["More Tripmines",2],["LAP 2",1],["Nothing?",1],["Barotrauma",1],["Beacon Mirage",1],["Mighty Gong",1],["Concussion",1],["Mart Slide",1],["Pacifier",1],["Problem Child",1],["Scorched Earth",1],["Bigger Blast",2],["Husk Express",1],["Conga Line",1],["Springloaded",1],["Bloodier Meat",1],["Shotgun",1],["Accurate Telefragger",1],["Burning Bouquet",1],["Blade Carousel",1],["Deadly Melody",1]];
export const greaterOptions=["One Less Choice","Inverse Destruction","Void Implosions","Oblivion","Razorbloom","Trap Card","Run","Tantrum","Hollow Tiles","Mass Infection","Malfunction","Ballet of Blades","Blade Bombardment"];
export const upgradeOptions=["Better Jump Pads","Paycheck","Business License","Swiftness Ring","Grapple Points","Medal","Tria Orbs","Double Jump","Radar","Radar Module: Enemies","Fanny Pack","Grace Wings","Pocket Bell","Radar Module: Altars","Ice Skates","Helmet","Larger Grapple Points","Advanced Gravity Coil","More Altars","Subspacial Barrier","Ninja Belt","Radar Module: Instruments","Shark Tail","Sport Shoes","Gift Magnet","Matrix Tetrahedron","Miniature Hourglass","Panic Necklace","Gift Idol","Shield","Drowned Aegis","Blossom","Orb","Defuse Kit","Adrenaline","Radar Module: Players","Last Robloxian Standing","Radar Module: Tripmines"];
export const greaterStackLimits:Record<string,number>=Object.fromEntries(greaterOptions.map(name=>[name,1]));
export const upgradeStackLimits:Record<string,number>={"Business License":2,"Defuse Kit":3,"Paycheck":5,"Swiftness Ring":3,"Subspacial Barrier":2,"Gift Magnet":3,"Gift Idol":5};
const medalNames=new Set(medalOptions.map(([name])=>name));
type EnemyRequirement={anyOf:string[];label:string};
type CurseRule={
  min?:number; enemies?:EnemyRequirement[]; greater?:string; anyCurse?:string[]; excludes?:string[];
  blockedDifficulties?:Difficulty[]; blockedParties?:Party[]; chaosOnly?:boolean;
};
const enemy=(label:string,...anyOf:string[]):EnemyRequirement=>({label,anyOf});
const curseRules:Record<string,CurseRule>={
  "Savory Ring":{min:5},
  "Bigger Tripmines":{min:5,blockedDifficulties:["casual"]},"More Tripmines":{min:5,blockedDifficulties:["casual"]},
  "High Roller":{min:5,excludes:["Tweaked Odds"]},"Tweaked Odds":{min:5,excludes:["High Roller"]},
  "Fake Count":{min:8},"LAP 2":{min:8,excludes:["Fragile Gifts"]},"Fragile Gifts":{min:8,excludes:["LAP 2"]},
  "Nothing?":{min:8},"Jackpot":{min:10,anyCurse:["High Roller","Tweaked Odds"]},
  "Barotrauma":{min:15,blockedDifficulties:["casual"]},"Minefield":{min:15,blockedDifficulties:["casual"]},"Beacon Mirage":{min:25},
  "More Ringing":{enemies:[enemy("Bell","Bell")]},"Mighty Gong":{enemies:[enemy("Bell","Bell")]},"Concussion":{enemies:[enemy("Bell","Bell")]},
  "Pacifier":{enemies:[enemy("Baby","Baby","Voidbound Baby")]},"Problem Child":{min:5,enemies:[enemy("Baby","Baby","Voidbound Baby")]},
  "Scorched Earth":{enemies:[enemy("ICBM","ICBM")]},"Bigger Blast":{min:5,enemies:[enemy("ICBM","ICBM")]},
  "Bigger Marts":{enemies:[enemy("Mart","Mart")]},"Mart Infection":{min:8,enemies:[enemy("Mart","Mart")],excludes:["Mart Slide"],blockedParties:["solo"]},
  "Mart Slide":{min:8,enemies:[enemy("Mart","Mart")],excludes:["Mart Infection"]},
  "Closer Husk":{enemies:[enemy("Husk","Husk")],excludes:["Further Husk"]},"Further Husk":{enemies:[enemy("Husk","Husk")],excludes:["Closer Husk"]},
  "Taller Husk":{enemies:[enemy("Husk","Husk")]},"Husk Express":{min:5,enemies:[enemy("Husk","Husk")]},
  "Conga Line":{min:8,enemies:[enemy("Husk","Husk")]},"Random Husk":{min:15,enemies:[enemy("Husk","Husk")]},
  "Resonating Shockwaves":{min:5,enemies:[enemy("Springer","Springer"),enemy("Bell","Bell")]},"Springloaded":{min:5,enemies:[enemy("Springer","Springer")]},
  "Bloodier Meat":{min:5,enemies:[enemy("Flesh","Flesh")]},"Blighted Jump Pads":{min:5,enemies:[enemy("Flesh","Flesh")]},
  "Camouflage":{min:8,enemies:[enemy("Guardian","Guardian","Voidbound Guardian")]},"Shotgun":{min:5,enemies:[enemy("Guardian","Guardian","Voidbound Guardian")]},
  "Ambush":{enemies:[enemy("Telefragger","Telefragger")]},"Accurate Telefragger":{enemies:[enemy("Telefragger","Telefragger")]},
  "Lost Embers":{enemies:[enemy("Kolóna","Kolóna")]},"Burning Bouquet":{enemies:[enemy("Kolóna","Kolóna")],greater:"Razorbloom"},
  "Blade Carousel":{min:5,enemies:[enemy("Voidbreaker","Voidbreaker")]},"Deadly Melody":{enemies:[enemy("Cadence","Cadence")],blockedParties:["solo"]},
  "Mighty Cavalry":{chaosOnly:true},"Missile Silo":{chaosOnly:true},"Bloody Bell":{chaosOnly:true},"Delusion":{chaosOnly:true},
};

const iconOverrides:Record<string,string>={
  "???":"Random.png",
  "Missile Silo":"Missile-Silo.png",
  "Drowned Aegis":"DrownedÆgis.png",
};
function wikiIcon(name:string){const file=iconOverrides[name]??`${name.replace(/[\s:'’]/g,"")}.png`;return `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(file)}`;}
function ItemIcon({name}:{name:string}){return <span className="dock-item-icon" aria-hidden="true"><i>{name.replace(/[^A-Za-z0-9]/g,"").slice(0,1)||"?"}</i><img src={wikiIcon(name)} alt="" onError={event=>{event.currentTarget.style.display="none";}}/></span>;}

function stackMap(value:unknown):StackMap{
  if(Array.isArray(value))return Object.fromEntries(value.map(name=>[String(name),1]));
  if(!value||typeof value!=="object")return {};
  const result:StackMap={};for(const[name,count]of Object.entries(value)){const parsed=Math.max(0,Math.floor(Number(count)||0));if(parsed>0)result[name]=parsed;}return result;
}
function normalize(value:Partial<SharedRun>):SharedRun{
  const rawMedals=value.medalCurses&&typeof value.medalCurses==="object"?value.medalCurses:{};const normalizedMedals:Record<string,number>={};for(const[name]of medalOptions){const oldId=name.replace(/[^A-Za-z0-9]/g,"");const count=rawMedals[name]??rawMedals[oldId];if(count)normalizedMedals[name]=Number(count);}
  const normalizedCurses=stackMap(value.curses);for(const[name,max]of medalOptions){const count=Math.min(max,Math.max(normalizedMedals[name]??0,normalizedCurses[name]??0));if(count){normalizedMedals[name]=count;normalizedCurses[name]=count;}}
  const party=["solo","duo","party","party-plus"].includes(value.party??"")?value.party as Party:"solo";const upgrades=stackMap(value.upgrades);if(party==="solo"||party==="duo")upgrades.Paycheck=Math.max(1,upgrades.Paycheck??0);
  return {
    ...defaultSharedRun,...value,
    level:Math.max(1,Number(value.level)||defaultSharedRun.level),players:Math.max(1,Math.min(100,Number(value.players)||1)),gifts:Number(value.gifts)||0,
    difficulty:["casual","standard","extreme"].includes(value.difficulty??"")?value.difficulty as Difficulty:"standard",
    party,
    enemies:stackMap(value.enemies),curses:normalizedCurses,medalCurses:normalizedMedals,
    greaterCurses:stackMap(value.greaterCurses),upgrades,inputMode:["quick","both","tool"].includes(value.inputMode??"")?value.inputMode as InputMode:"quick",updatedAt:Number(value.updatedAt)||0,
  };
}

function pack(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function unpack(value:string){try{const bytes=Uint8Array.from(atob(value),char=>char.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));}catch{try{return JSON.parse(value);}catch{return null;}}}
function readCookie(){
  try{const part=document.cookie.split("; ").find(item=>item.startsWith(cookieName+"="));return part?normalize(unpack(decodeURIComponent(part.slice(cookieName.length+1)))??{}):null;}catch{return null;}
}
function persist(run:SharedRun){
  try{localStorage.setItem(storageKey,JSON.stringify(run));}catch{}
  try{const domain=location.hostname.endsWith(".poggieboii78.chatgpt.site")?"; Domain=.poggieboii78.chatgpt.site":"";document.cookie=`${cookieName}=${encodeURIComponent(pack(run))}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`;}catch{}
}
function normalizeActivity(value:Partial<ActivityState>|null|undefined):ActivityState{
  const events=Array.isArray(value?.events)?value.events.slice(-60).filter(item=>item&&typeof item.name==="string"&&typeof item.level==="number").map(item=>({...item,learned:item.learned!==false})):[];
  const stats=value?.stats&&typeof value.stats==="object"?Object.fromEntries(Object.entries(value.stats).filter(([,entry])=>Array.isArray(entry)&&entry.length===2).map(([key,entry])=>[key,[Math.max(1,Number(entry[0])||1),Math.max(1,Number(entry[1])||1)] as [number,number]])):{};
  return{events,stats,learning:value?.learning!==false,updatedAt:Number(value?.updatedAt)||0};
}
const categoryCode:Record<TrackedCategory,string>={enemies:"e",curses:"c",medalCurses:"m",greaterCurses:"g",upgrades:"u"};
const codeCategory:Record<string,TrackedCategory>={e:"enemies",c:"curses",m:"medalCurses",g:"greaterCurses",u:"upgrades"};
function readActivity(){
  const candidates:ActivityState[]=[];try{const raw=localStorage.getItem(activityKey);if(raw)candidates.push(normalizeActivity(JSON.parse(raw)));}catch{}
  try{const cookies=Object.fromEntries(document.cookie.split("; ").map(part=>{const index=part.indexOf("=");return index<0?[part,""]:[part.slice(0,index),part.slice(index+1)];}));const eventData=unpack(decodeURIComponent(cookies[activityEventsCookie]??""));const statData=unpack(decodeURIComponent(cookies[activityStatsCookie]??""));if(eventData||statData){const events=(eventData?.events??[]).map((item:unknown[])=>({level:Number(item[0]),category:codeCategory[String(item[1])],name:String(item[2]),amount:Number(item[3]),at:Number(item[4]),learned:item[5]!==0}));const stats=Object.fromEntries(Object.entries(statData?.stats??{}).map(([key,value])=>{const split=key.indexOf("|");return[`${codeCategory[key.slice(0,split)]}:${key.slice(split+1)}`,value];})) as Record<string,[number,number]>;candidates.push(normalizeActivity({events,stats,learning:statData?.learning!==false,updatedAt:Math.max(Number(eventData?.updatedAt)||0,Number(statData?.updatedAt)||0)}));}}catch{}
  return candidates.sort((a,b)=>b.updatedAt-a.updatedAt)[0]??emptyActivity;
}
function persistActivity(activity:ActivityState){
  try{localStorage.setItem(activityKey,JSON.stringify(activity));}catch{}
  try{const domain=location.hostname.endsWith(".poggieboii78.chatgpt.site")?"; Domain=.poggieboii78.chatgpt.site":"";const compactEvents=activity.events.slice(-36).map(item=>[item.level,categoryCode[item.category],item.name,item.amount,item.at,item.learned?1:0]);const compactStats=Object.fromEntries(Object.entries(activity.stats).map(([key,value])=>{const split=key.indexOf(":");return[`${categoryCode[key.slice(0,split) as TrackedCategory]}|${key.slice(split+1)}`,value];}));document.cookie=`${activityEventsCookie}=${encodeURIComponent(pack({events:compactEvents,updatedAt:activity.updatedAt}))}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`;document.cookie=`${activityStatsCookie}=${encodeURIComponent(pack({stats:compactStats,learning:activity.learning,updatedAt:activity.updatedAt}))}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`;}catch{}
  window.dispatchEvent(new Event("nullscape-activity"));
}
function normalizeArchives(value:unknown):ArchivedRun[]{
  if(!Array.isArray(value))return[];
  return value.filter(item=>item&&typeof item==="object").map(item=>{
    const raw=item as Partial<ArchivedRun>;const events=Array.isArray(raw.events)?normalizeActivity({events:raw.events}).events:[];
    return{id:String(raw.id??raw.endedAt??Date.now()),endedAt:Number(raw.endedAt)||Date.now(),finalLevel:Math.max(1,Number(raw.finalLevel)||1),players:Math.max(1,Number(raw.players)||1),difficulty:["casual","standard","extreme"].includes(raw.difficulty??"")?raw.difficulty as Difficulty:"standard",party:["solo","duo","party","party-plus"].includes(raw.party??"")?raw.party as Party:"solo",learning:raw.learning!==false,events};
  }).sort((a,b)=>a.endedAt-b.endedAt).slice(-50);
}
function compactArchives(archives:ArchivedRun[]){return archives.map(run=>[run.id,run.endedAt,run.finalLevel,run.players,run.difficulty[0],run.party==="party-plus"?"p+":run.party[0],run.learning?1:0,run.events.slice(-60).map(item=>[item.level,categoryCode[item.category],item.name,item.amount,item.learned?1:0])]);}
function expandArchives(value:unknown):ArchivedRun[]{
  if(!Array.isArray(value))return[];
  const difficultyMap:Record<string,Difficulty>={c:"casual",s:"standard",e:"extreme"};const partyMap:Record<string,Party>={s:"solo",d:"duo",p:"party","p+":"party-plus"};
  return normalizeArchives(value.map(item=>{const row=Array.isArray(item)?item:[];const endedAt=Number(row[1])||Date.now();return{id:String(row[0]??endedAt),endedAt,finalLevel:Number(row[2])||1,players:Number(row[3])||1,difficulty:difficultyMap[String(row[4])]??"standard",party:partyMap[String(row[5])]??"solo",learning:row[6]!==0,events:Array.isArray(row[7])?row[7].map((event:unknown)=>{const pick=Array.isArray(event)?event:[];return{level:Number(pick[0])||1,category:codeCategory[String(pick[1])]??"upgrades",name:String(pick[2]??"Unknown"),amount:Number(pick[3])||1,at:endedAt,learned:pick[4]!==0};}):[]};}));
}
function readArchiveCookie(){
  try{const cookies=Object.fromEntries(document.cookie.split("; ").map(part=>{const index=part.indexOf("=");return index<0?[part,""]:[part.slice(0,index),part.slice(index+1)];}));let encoded="";for(let index=0;index<4;index++){const chunk=cookies[`${archiveCookiePrefix}${index}`];if(!chunk)break;encoded+=decodeURIComponent(chunk);}return expandArchives(unpack(encoded)?.runs);}catch{return[];}
}
function readArchives(){
  const merged=new Map<string,ArchivedRun>();try{for(const run of normalizeArchives(JSON.parse(localStorage.getItem(archiveKey)||"[]")))merged.set(run.id,run);}catch{}
  for(const run of readArchiveCookie())merged.set(run.id,run);return[...merged.values()].sort((a,b)=>a.endedAt-b.endedAt).slice(-50);
}
function persistArchives(value:ArchivedRun[]){
  const archives=normalizeArchives(value);try{localStorage.setItem(archiveKey,JSON.stringify(archives));}catch{}
  try{const domain=location.hostname.endsWith(".poggieboii78.chatgpt.site")?"; Domain=.poggieboii78.chatgpt.site":"";let shared=archives.slice(-12);let encoded=pack({runs:compactArchives(shared)});while(encoded.length>11000&&shared.length>1){shared=shared.slice(1);encoded=pack({runs:compactArchives(shared)});}const chunks=encoded.match(/.{1,2800}/g)??[];for(let index=0;index<4;index++){const name=`${archiveCookiePrefix}${index}`;document.cookie=chunks[index]?`${name}=${encodeURIComponent(chunks[index])}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`:`${name}=; Path=/; Max-Age=0; SameSite=Lax${domain}`;}}catch{}
  window.dispatchEvent(new Event("nullscape-archives"));
}
function archiveCurrentRun(run:SharedRun){
  const activity=readActivity();const nonDefaultUpgrades=Object.entries(run.upgrades).some(([name,count])=>name!=="Paycheck"||count>1);const meaningful=activity.events.length>0||run.level>1||run.gifts!==0||Object.keys(run.enemies).length>0||Object.keys(run.curses).length>0||Object.keys(run.medalCurses).length>0||Object.keys(run.greaterCurses).length>0||nonDefaultUpgrades;if(!meaningful)return;
  const endedAt=Date.now();const archived:ArchivedRun={id:String(run.updatedAt||endedAt),endedAt,finalLevel:run.level,players:run.players,difficulty:run.difficulty,party:run.party,learning:activity.learning,events:activity.events};persistArchives([...readArchives().filter(item=>item.id!==archived.id),archived]);
}
function clearArchives(){persistArchives([]);}
function recordActivity(before:SharedRun,after:SharedRun){
  const current=readActivity();const additions:PickEvent[]=[];for(const category of (["enemies","curses","medalCurses","greaterCurses","upgrades"] as TrackedCategory[])){for(const[name,count]of Object.entries(after[category])){const amount=count-(before[category][name]??0);const mirroredMedal=category==="curses"&&(after.medalCurses[name]??0)>(before.medalCurses[name]??0);const automaticPaycheck=category==="upgrades"&&name==="Paycheck"&&(after.party==="solo"||after.party==="duo")&&(before.upgrades.Paycheck??0)===0;if(amount>0&&!mirroredMedal&&!automaticPaycheck)additions.push({level:before.level,category,name,amount,at:Date.now(),learned:current.learning});}}
  if(!additions.length)return;const stats={...current.stats};for(const item of additions){if(!item.learned)continue;const key=`${item.category}:${item.name}`;const [seen,total]=stats[key]??[0,0];stats[key]=[seen+item.amount,total+item.level*item.amount];}persistActivity({...current,events:[...current.events,...additions].slice(-60),stats,updatedAt:Date.now()});
}
function setActivityLearning(learning:boolean){const current=readActivity();if(current.learning===learning)return;const stats={...current.stats};const events=current.events.map(item=>{if(item.learned===learning)return item;const key=`${item.category}:${item.name}`;const [seen,total]=stats[key]??[0,0];const direction=learning?1:-1;const nextSeen=seen+direction*item.amount;const nextTotal=total+direction*item.level*item.amount;if(nextSeen>0)stats[key]=[nextSeen,nextTotal];else delete stats[key];return{...item,learned:learning};});persistActivity({...current,events,stats,learning,updatedAt:Date.now()});}
function clearCurrentActivity(){const current=readActivity();persistActivity({...current,events:[],learning:true,updatedAt:Date.now()});}
function clearAllActivity(){persistActivity({...emptyActivity,updatedAt:Date.now()});}
function legacyRun(key:string){
  try{const raw=JSON.parse(localStorage.getItem(key)||"null");if(!raw)return null;return normalize({level:raw.level,players:raw.players,difficulty:raw.difficulty,party:raw.party??raw.lobby,gifts:raw.gifts,enemies:raw.selectedEnemies,curses:raw.selected,medalCurses:raw.owned,greaterCurses:raw.razorbloom?{Razorbloom:1}:{},inputMode:raw.inputMode,updatedAt:0});}catch{return null;}
}

export function buildRunQuery(run:SharedRun){const params=new URLSearchParams();params.set("run",JSON.stringify(run));return params.toString();}

export function useSharedRun(legacyKey:string){
  const [run,setRun]=useState<SharedRun>(defaultSharedRun);const [ready,setReady]=useState(false);const latest=useRef(0);
  const accept=useCallback((candidate:SharedRun|null)=>{if(!candidate||candidate.updatedAt<=latest.current)return;latest.current=candidate.updatedAt;setRun(candidate);},[]);
  useEffect(()=>{
    const candidates:SharedRun[]=[];try{const raw=localStorage.getItem(storageKey);if(raw)candidates.push(normalize(JSON.parse(raw)));}catch{}
    const cookie=readCookie();if(cookie)candidates.push(cookie);const legacy=legacyRun(legacyKey);if(legacy)candidates.push(legacy);
    try{const packed=new URLSearchParams(location.search).get("run");if(packed)candidates.push(normalize(JSON.parse(packed)));}catch{}
    const newest=candidates.sort((a,b)=>b.updatedAt-a.updatedAt)[0]??defaultSharedRun;latest.current=newest.updatedAt;setRun(newest);persist(newest);setReady(true);
    if(new URLSearchParams(location.search).has("run"))history.replaceState({},"",`${location.pathname}${location.hash}`);
    const onStorage=(event:StorageEvent)=>{if(event.key===storageKey&&event.newValue)try{accept(normalize(JSON.parse(event.newValue)));}catch{}};
    const check=()=>accept(readCookie());window.addEventListener("storage",onStorage);window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);const timer=window.setInterval(check,900);
    return()=>{window.removeEventListener("storage",onStorage);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);clearInterval(timer);};
  },[accept,legacyKey]);
  const update=useCallback((change:Partial<SharedRun>|((current:SharedRun)=>Partial<SharedRun>))=>setRun(current=>{let patch=typeof change==="function"?change(current):change;const nextParty=patch.party??current.party;if((current.party==="solo"||current.party==="duo")&&(nextParty==="party"||nextParty==="party-plus")){const upgrades={...current.upgrades,...(patch.upgrades??{})};const paycheck=upgrades.Paycheck??0;if(paycheck>1)upgrades.Paycheck=paycheck-1;else delete upgrades.Paycheck;patch={...patch,upgrades};}const next=normalize({...current,...patch,updatedAt:Math.max(Date.now(),current.updatedAt+1)});recordActivity(current,next);latest.current=next.updatedAt;persist(next);return next;}),[]);
  const applyLinkedRun=useCallback((candidate:SharedRun)=>setRun(current=>{const next=normalize({...candidate,inputMode:current.inputMode,updatedAt:Math.max(Date.now(),current.updatedAt+1)});latest.current=next.updatedAt;persist(next);return next;}),[]);
  const reset=useCallback(()=>{update(current=>{archiveCurrentRun(current);clearCurrentActivity();return{...defaultSharedRun,players:current.players,difficulty:current.difficulty,party:current.party,inputMode:current.inputMode,upgrades:(current.party==="solo"||current.party==="duo"?{Paycheck:1}:{}) as StackMap};});},[update]);
  return {run,update,reset,applyLinkedRun,ready};
}

function useActivityState(){
  const [activity,setActivity]=useState<ActivityState>(emptyActivity);
  useEffect(()=>{const sync=()=>setActivity(readActivity());sync();window.addEventListener("nullscape-activity",sync);window.addEventListener("storage",sync);const timer=window.setInterval(sync,1200);return()=>{window.removeEventListener("nullscape-activity",sync);window.removeEventListener("storage",sync);clearInterval(timer);};},[]);
  return activity;
}
function useArchiveState(){
  const [archives,setArchives]=useState<ArchivedRun[]>([]);
  useEffect(()=>{const sync=()=>setArchives(readArchives());sync();window.addEventListener("nullscape-archives",sync);window.addEventListener("storage",sync);const timer=window.setInterval(sync,1500);return()=>{window.removeEventListener("nullscape-archives",sync);window.removeEventListener("storage",sync);clearInterval(timer);};},[]);
  return archives;
}

function NumberInput({value,onCommit,disabled,min,max,label}:{value:number;onCommit:(value:number)=>void;disabled?:boolean;min?:number;max?:number;label:string}){
  const [draft,setDraft]=useState(String(value));const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setDraft(String(value));},[value]);
  const commit=(raw:string)=>{if(raw.trim()===""||raw==="-"||raw==="+")return;const parsed=Number(raw);if(!Number.isFinite(parsed))return;onCommit(Math.max(min??-Infinity,Math.min(max??Infinity,parsed)));};
  return <input ref={ref} disabled={disabled} type="number" min={min} max={max} value={draft} aria-label={label} onFocus={event=>event.currentTarget.select()} onChange={event=>{setDraft(event.target.value);commit(event.target.value);}} onBlur={()=>{if(draft.trim()===""||draft==="-"||draft==="+")setDraft(String(value));else commit(draft);}}/>;
}

export function ToolRunFields({run,update}:{run:SharedRun;update:(change:Partial<SharedRun>)=>void}){
  const locked=run.inputMode==="quick";
  return <details className={`tool-run-fields ${locked?"is-locked":""}`}>
    <summary><span><strong>Run data</strong><small>{run.level} · {run.players}P · {run.difficulty} · {run.party.replace("-"," ")} · {run.gifts.toLocaleString()} Gifts</small></span><b>{locked?"Quick Menu controls this":"Edit"} <i>⌄</i></b></summary>
    <section aria-label="Tool page run inputs">
      <label><span>Level</span><NumberInput disabled={locked} min={1} value={run.level} label="Level" onCommit={level=>update({level})}/></label>
      <label><span>Players</span><NumberInput disabled={locked} min={1} max={100} value={run.players} label="Players" onCommit={players=>update({players})}/></label>
      <label><span>Difficulty</span><select disabled={locked} value={run.difficulty} onChange={e=>update({difficulty:e.target.value as Difficulty})}><option value="casual">Casual</option><option value="standard">Standard</option><option value="extreme">Extreme</option></select></label>
      <label><span>Lobby</span><select disabled={locked} value={run.party} onChange={e=>update({party:e.target.value as Party})}><option value="solo">Solo</option><option value="duo">Duo</option><option value="party">Party</option><option value="party-plus">Party+</option></select></label>
      <label><span>Gifts</span><NumberInput disabled={locked} value={run.gifts} label="Golden Gifts" onCommit={gifts=>update({gifts})}/></label>
    </section>
  </details>;
}

type TourStep={selector:string;title:string;text:string};
type DockTab="run"|"enemies"|"curses"|"medal"|"greater"|"upgrades";
const tabLabels:Record<DockTab,string>={run:"Run Data",enemies:"Enemies",curses:"Curses",medal:"Medal Curses",greater:"Greater",upgrades:"Upgrades"};

export function RunDock({run,update,reset,applyLinkedRun,toolId,toolSteps=[]}:{run:SharedRun;update:(change:Partial<SharedRun>|((current:SharedRun)=>Partial<SharedRun>))=>void;reset:()=>void;applyLinkedRun:(run:SharedRun)=>void;toolId:string;toolSteps?:TourStep[]}){
  const [open,setOpen]=useState(false);const [tab,setTab]=useState<DockTab>("run");const [search,setSearch]=useState("");const [checkPossible,setCheckPossible]=useState(true);const [tour,setTour]=useState(-1);const [historyOpen,setHistoryOpen]=useState(false);const [linkActive,setLinkActive]=useState(false);const [focusRect,setFocusRect]=useState<{left:number;top:number;width:number;height:number}|null>(null);const seenKey=`nullscape-tour-seen-${toolId}-${toolId==="home"?"v11":"v10"}`;const activity=useActivityState();const archives=useArchiveState();
  const steps=useMemo<TourStep[]>(()=>[
    ...(toolId==="home"?[
      {selector:"[data-tour='dock-handle']",title:"Open your Quick Menu",text:"Click this arrow at the bottom of any calculator. The Quick Menu keeps the same run information when you move between tools or tabs."},
      {selector:"[data-tour='dock-body'] .input-mode",title:"Choose where you want to edit",text:"“Edit from” controls which buttons you can use. Pick Quick Menu, Tool page, or Both. If a control is gray or locked, check this setting."},
      {selector:"[data-tour='calculator-link']",title:"Share the run with friends",text:"Create a Calculator Link, then send the invite to your friends. Everyone in the link sees run changes live, including Gifts, level, enemies, Curses, and upgrades."},
      {selector:"[data-tour='dock-body'] .dock-tabs",title:"Record what happens in your run",text:"Use these tabs to enter your run details, enemies, Curses, Medal Curses, Greater Curses, and upgrades. Every calculator uses this information automatically."},
    ]:[]),...toolSteps,
  ],[toolId,toolSteps]);
  useEffect(()=>{if(localStorage.getItem(seenKey)!=="1")setTour(0);},[seenKey]);
  useEffect(()=>{if(tour<0)return;const selector=steps[tour]?.selector??"";setOpen(selector.includes("dock-body")||selector.includes("calculator-link"));},[tour,steps]);
  useEffect(()=>{if(tour<0){setFocusRect(null);return;}let frame=0;let scrolled=false;let previous="";const measure=()=>{const selector=steps[tour]?.selector??"";const el=document.querySelector(selector);if(!el){if(previous){previous="";setFocusRect(null);}frame=requestAnimationFrame(measure);return;}if(!scrolled&&!selector.includes("dock-")){el.scrollIntoView({behavior:"auto",block:"center"});scrolled=true;}const rect=el.getBoundingClientRect();const zoom=Number(getComputedStyle(document.body).zoom)||1;const pad=7;const next={left:Math.max(7,rect.left/zoom-pad),top:Math.max(7,rect.top/zoom-pad),width:Math.min(innerWidth/zoom-14,rect.width/zoom+pad*2),height:Math.min(innerHeight/zoom-14,rect.height/zoom+pad*2)};const signature=`${next.left.toFixed(1)}:${next.top.toFixed(1)}:${next.width.toFixed(1)}:${next.height.toFixed(1)}`;if(signature!==previous){previous=signature;setFocusRect(next);}frame=requestAnimationFrame(measure);};frame=requestAnimationFrame(measure);return()=>cancelAnimationFrame(frame);},[tour,steps,open]);
  useEffect(()=>{if(tour<0)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){localStorage.setItem(seenKey,"1");setTour(-1);}};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[tour,seenKey]);
  useEffect(()=>{if(!historyOpen)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setHistoryOpen(false);};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);},[historyOpen]);
  const finish=()=>{localStorage.setItem(seenKey,"1");setTour(-1);};
  const quickLocked=run.inputMode==="tool";
  const categoryFor=(item:DockTab):TrackedCategory=>item==="medal"?"medalCurses":item==="greater"?"greaterCurses":item as TrackedCategory;
  const activityLabel=(category:TrackedCategory)=>({enemies:"ENEMY",curses:"CURSE",medalCurses:"MEDAL CURSE",greaterCurses:"GREATER CURSE",upgrades:"UPGRADE"}[category]);
  const ordered=(items:string[],key:TrackedCategory)=>items.filter(name=>name.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>{const active=(run[key][b]??0)-(run[key][a]??0);if(active)return active;const aStat=activity.stats[`${key}:${a}`],bStat=activity.stats[`${key}:${b}`];const aDistance=aStat?Math.abs(aStat[1]/aStat[0]-run.level):9999;const bDistance=bStat?Math.abs(bStat[1]/bStat[0]-run.level):9999;return aDistance-bDistance||a.localeCompare(b);});
  const impossibleReason=(name:string)=>{if((run.curses[name]??0)>0)return"";const rule=curseRules[name];if(!rule)return"";if(rule.chaosOnly)return"Chaos only";if(rule.min&&run.level<rule.min)return`Level ${rule.min}`;if(rule.blockedDifficulties?.includes(run.difficulty))return`Not on ${run.difficulty[0].toUpperCase()+run.difficulty.slice(1)}`;if(rule.blockedParties?.includes(run.party))return`Not in ${run.party==="party-plus"?"Party+":run.party[0].toUpperCase()+run.party.slice(1)}`;const conflict=rule.excludes?.find(curse=>(run.curses[curse]??0)>0);if(conflict)return`Blocked by ${conflict}`;for(const requirement of rule.enemies??[]){if(!requirement.anyOf.some(candidate=>(run.enemies[candidate]??0)>0))return`Needs ${requirement.label}`;}if(rule.greater&&(run.greaterCurses[rule.greater]??0)<1)return`Needs ${rule.greater}`;if(rule.anyCurse&&!rule.anyCurse.some(curse=>(run.curses[curse]??0)>0))return`Needs ${rule.anyCurse.join(" or ")}`;return"";};
  const changeStack=(key:"enemies"|"curses",name:string,delta:number)=>{if(quickLocked)return;update(current=>{const next={...current[key]};const count=Math.max(0,(next[name]??0)+delta);if(count)next[name]=count;else delete next[name];return{[key]:next};});};
  const cycleStack=(key:"curses"|"medalCurses"|"greaterCurses"|"upgrades",name:string,max:number)=>{if(quickLocked)return;update(current=>{const next={...current[key]};const count=((next[name]??0)+1)%(max+1);if(count)next[name]=count;else delete next[name];if(key!=="medalCurses"&&!(key==="curses"&&medalNames.has(name)))return{[key]:next};const regular={...current.curses};const medals={...current.medalCurses};if(count){regular[name]=count;medals[name]=count;}else{delete regular[name];delete medals[name];}return{medalCurses:medals,curses:regular};});};
  const total=(map:StackMap)=>Object.values(map).reduce((sum,count)=>sum+count,0);
  const list=(items:string[],key:"enemies"|"curses")=><div className="dock-stack-list">{ordered(items,key).map(name=>{const count=run[key][name]??0;return <article key={name} className={count?"selected":""}><ItemIcon name={name}/><button className="stack-name" disabled={quickLocked} onClick={()=>changeStack(key,name,count?-count:1)}><span>{name}</span><small>{count?`${count} active`:"Not active"}</small></button><div className="stack-stepper"><button onClick={()=>changeStack(key,name,-1)} disabled={quickLocked||!count} aria-label={`Remove one ${name}`}>−</button><b>{count}</b><button onClick={()=>changeStack(key,name,1)} disabled={quickLocked} aria-label={`Add one ${name}`}>+</button></div></article>})}</div>;
  const cycleCards=(items:string[],key:"curses"|"greaterCurses"|"upgrades",limits:Record<string,number>)=><div className="dock-chip-grid medal-chips">{ordered(items,key).map(name=>{const max=limits[name]??1;const count=run[key][name]??0;const reason=key==="curses"&&checkPossible?impossibleReason(name):"";return <button key={name} disabled={quickLocked||!!reason} title={reason||name} className={`${count?"selected":""} ${reason?"impossible":""}`} onClick={()=>cycleStack(key,name,max)}><ItemIcon name={name}/><b>{name}{reason&&<small>{reason}</small>}</b><span>{count}/{max}</span></button>})}</div>;
  const historyGroups=Object.entries(activity.events.reduce<Record<string,PickEvent[]>>((groups,item)=>{(groups[item.level]??=[]).push(item);return groups;},{})).sort((a,b)=>Number(b[0])-Number(a[0]));
  const currentEvents=activity.events.filter(item=>item.level===run.level);const currentEnemyCount=currentEvents.filter(item=>item.category==="enemies").reduce((sum,item)=>sum+item.amount,0);const currentCurseCount=currentEvents.filter(item=>item.category==="curses"||item.category==="medalCurses"||item.category==="greaterCurses").reduce((sum,item)=>sum+item.amount,0);const expectedEnemies=(run.difficulty==="extreme"||run.level===1||run.level%2===0)?(run.party==="party-plus"?2:1):0;
  return <>
    <aside className={`run-dock ${open?"open":""}`}>
      <button className="run-dock-handle" data-tour="dock-handle" onClick={()=>setOpen(value=>!value)} aria-label={open?"Close Quick Menu":"Open Quick Menu"}><span aria-hidden="true">{open?"⌄":"⌃"}</span></button>
      <div className="run-dock-body" data-tour="dock-body">
        <div className="dock-top"><div><strong>Quick Menu</strong><span>Newest edits sync across tabs and linked friends</span></div><div className="dock-actions"><CalculatorLink run={run} applyRun={applyLinkedRun} onActiveChange={setLinkActive}/><button onClick={()=>setTour(0)}>Walkthrough</button><button className="reset-run" onClick={()=>{if(!linkActive||confirm("Reset the shared run for everyone in this Calculator Link?"))reset();}}>Reset run</button></div></div>
        <div className="input-mode"><span>EDIT FROM</span>{([['quick','Quick menu'],['both','Both'],['tool','Tool page']] as [InputMode,string][]).map(([mode,label])=><button key={mode} className={run.inputMode===mode?"active":""} onClick={()=>update({inputMode:mode})}>{label}</button>)}</div>
        <div className="dock-tab-row"><nav className="dock-tabs" aria-label="Quick Menu sections">{(Object.keys(tabLabels) as DockTab[]).map(item=><button key={item} className={tab===item?"active":""} onClick={()=>{setTab(item);setSearch("");}}>{tabLabels[item]}<small>{item==="enemies"?total(run.enemies):item==="curses"?total(run.curses):item==="medal"?total(run.medalCurses):item==="greater"?total(run.greaterCurses):item==="upgrades"?total(run.upgrades):""}</small></button>)}</nav><button className={`dock-next-level ${(expectedEnemies===0||currentEnemyCount>=expectedEnemies)&&currentCurseCount>0?"ready":""}`} disabled={run.inputMode==="tool"} onClick={()=>update({level:run.level+1})} title={`Advance from Level ${run.level} to Level ${run.level+1}. Recorded here: ${currentEnemyCount} enemies and ${currentCurseCount} Curse picks.`} aria-label={`Next intermission, Level ${run.level+1}`}><span>NEXT</span><b>→ L{run.level+1}</b></button></div>
        <div className={`dock-content ${quickLocked?"quick-locked":""}`}>
          {tab!=="run"&&<div className="dock-filter-row"><label className="dock-search"><span>⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={`Search ${tabLabels[tab].toLowerCase()}…`} aria-label={`Search ${categoryFor(tab)}`}/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search">×</button>}</label>{tab==="curses"&&<label className="possible-toggle"><input type="checkbox" checked={checkPossible} onChange={event=>setCheckPossible(event.target.checked)}/><span>Possible now</span><small>Gray out Curses blocked by level, mode, lobby, enemies, prerequisites, or conflicts.</small></label>}</div>}
          {tab==="run"&&<>
            <div className={`dock-run-grid ${run.inputMode==="tool"?"is-locked":""}`}>
              <label><span>Level</span><NumberInput disabled={run.inputMode==="tool"} min={1} value={run.level} label="Level" onCommit={level=>update({level})}/></label>
              <label><span>Players</span><NumberInput disabled={run.inputMode==="tool"} min={1} max={100} value={run.players} label="Players" onCommit={players=>update({players})}/></label>
              <label><span>Difficulty</span><select disabled={run.inputMode==="tool"} value={run.difficulty} onChange={e=>update({difficulty:e.target.value as Difficulty})}><option value="casual">Casual</option><option value="standard">Standard</option><option value="extreme">Extreme</option></select></label>
              <label><span>Lobby</span><select disabled={run.inputMode==="tool"} value={run.party} onChange={e=>update({party:e.target.value as Party})}><option value="solo">Solo</option><option value="duo">Duo</option><option value="party">Party</option><option value="party-plus">Party+</option></select></label>
              <label><span>Golden Gifts</span><NumberInput disabled={run.inputMode==="tool"} value={run.gifts} label="Golden Gifts" onCommit={gifts=>update({gifts})}/></label>
            </div>
            {run.inputMode==="tool"&&<p className="dock-lock-note">Quick editing is off. These values follow the tool page controls.</p>}
            <section className="dock-history">
              <header><div><div className="history-title-row"><b>Run history</b><details className="history-help"><summary aria-label="Why Run History is saved">?</summary><div><strong>Why is this saved?</strong><p>Pickup levels stay in this browser. They are not uploaded or shared. The Quick Menu only uses them to sort items near when you usually pick them in future runs.</p><small>Reset Run archives this timeline and keeps the sorting bias. “Forget sorting bias” deletes only the learned sorting data.</small></div></details></div><span>{activity.events.length?`${activity.events.length} picks this run · ${activity.learning?"learning for future runs":"not training sorting"}`:Object.keys(activity.stats).length?"Sorting bias saved for future runs":"Your picks will appear here by level"}</span></div><div className="history-actions"><button className="all-runs-button" onClick={()=>setHistoryOpen(true)}>All runs <b>{archives.length}</b></button><button type="button" className={`not-my-run-button ${activity.learning?"":"active"}`} aria-pressed={!activity.learning} onClick={()=>setActivityLearning(!activity.learning)}>Not my run / I’m not host</button>{Object.keys(activity.stats).length>0&&<button onClick={clearAllActivity}>Forget sorting bias</button>}</div></header>
              {historyGroups.length?<div className="history-levels">{historyGroups.map(([level,events])=><article key={level} className={Number(level)===run.level?"current":""}><strong>LEVEL {level}</strong><div>{events.map((item,index)=><span className={item.learned?"":"not-learned"} key={`${item.category}-${item.name}-${index}`}><small>{activityLabel(item.category)}</small>{item.name}{item.amount>1?` ×${item.amount}`:""}{!item.learned&&<em>NOT TRAINED</em>}</span>)}</div></article>)}</div>:<p className="history-empty">Add enemies, Curses, Greater Curses, Medal Curses, or upgrades and the Quick Menu will remember when you usually get them.</p>}
            </section>
          </>}
          {tab==="enemies"&&list(enemyOptions,"enemies")}{tab==="curses"&&cycleCards(curseOptions,"curses",curseStackLimits)}
          {tab==="medal"&&<div className="dock-chip-grid medal-chips">{ordered(medalOptions.map(([name])=>name),"medalCurses").map(name=>{const max=medalOptions.find(([item])=>item===name)?.[1]??1;const count=run.medalCurses[name]??0;return <button key={name} disabled={quickLocked} className={count?"selected":""} onClick={()=>cycleStack("medalCurses",name,max)}><ItemIcon name={name}/><b>{name}</b><span>{count}/{max}</span></button>})}</div>}
          {tab==="greater"&&cycleCards(greaterOptions,"greaterCurses",greaterStackLimits)}{tab==="upgrades"&&cycleCards(upgradeOptions,"upgrades",upgradeStackLimits)}
          {quickLocked&&tab!=="run"&&<p className="dock-lock-note">Tool Page mode is on. Quick Menu items are view-only; choose Both or Quick Menu to edit them here.</p>}
        </div>
      </div>
    </aside>
    {historyOpen&&<div className="run-archive-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setHistoryOpen(false);}}><section className="run-archive-page" role="dialog" aria-modal="true" aria-label="All runs history"><header><div><small>DEVICE-LOCAL HISTORY</small><h2>All runs</h2><p>Reset Run archives a run here. These records stay in your browser and are never uploaded.</p></div><div><button className="clear-run-history" disabled={!archives.length} onClick={clearArchives}>Clear history</button><button className="close-run-history" onClick={()=>setHistoryOpen(false)} aria-label="Close all runs history">×</button></div></header>{archives.length?<div className="archived-runs">{[...archives].reverse().map((archived,index)=>{const groups=Object.entries(archived.events.reduce<Record<string,PickEvent[]>>((result,item)=>{(result[item.level]??=[]).push(item);return result;},{})).sort((a,b)=>Number(a[0])-Number(b[0]));return <details key={archived.id} open={index===0}><summary><span><b>{new Date(archived.endedAt).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}</b><small>{new Date(archived.endedAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</small></span><span><b>Level {archived.finalLevel}</b><small>{archived.players}P · {archived.difficulty} · {archived.party.replace("-"," ")}</small></span><span><b>{archived.events.length} picks</b><small>{archived.learning?"trained sorting":"not trained"}</small></span><i>⌄</i></summary>{groups.length?<div className="archived-levels">{groups.map(([level,events])=><article key={level}><strong>LEVEL {level}</strong><div>{events.map((item,eventIndex)=><span className={item.learned?"":"not-learned"} key={`${item.category}-${item.name}-${eventIndex}`}><small>{activityLabel(item.category)}</small>{item.name}{item.amount>1?` ×${item.amount}`:""}</span>)}</div></article>)}</div>:<p className="archive-empty-run">No item picks were recorded in this run.</p>}</details>})}</div>:<div className="archive-empty"><b>No archived runs yet</b><span>Finish a run and press Reset Run. Your current timeline will be saved here first.</span></div>}</section></div>}
    {tour>=0&&<div className="tour-layer">{focusRect&&<div className="tour-spotlight" style={focusRect}/>}<section className="tour-card" role="dialog" aria-modal="false" aria-label="Website walkthrough"><button className="tour-close" onClick={finish} aria-label="Close walkthrough">×</button><small>{tour+1} / {steps.length}</small><h2>{steps[tour].title}</h2><p>{steps[tour].text}</p><div><button onClick={finish}>Skip</button><span>{steps.map((_,i)=><i key={i} className={i===tour?"active":""}/>)}</span><button className="tour-next" onClick={()=>tour===steps.length-1?finish():setTour(tour+1)}>{tour===steps.length-1?"Done":"Next →"}</button></div></section></div>}
  </>;
}
