"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import {buildRunQuery,curseOptions,RunDock,ToolRunFields,useSharedRun,type Difficulty,type Party as PartySize} from "./run-dock";

type Mode = "protection" | "purification" | "chance";
type ChanceCurse = "none" | "high-roller" | "tweaked-odds" | "both-chaos";
type Curse = { name:string; value:number; chaos?:boolean };
type SavedState = { mode:Mode };

const homeUrl = "https://nullscape-tools.poggieboii78.chatgpt.site";
const storageKey = "nullscape-altar-state-v2";
const wikiImage = (name:string) => `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;

const values:Record<string,number>={"LAP 2":400,"Mart Slide":330,"Nothing?":325,"Bloodier Meat":300,"Beacon Mirage":300,"Blade Carousel":290,"Deadly Melody":280,"Burning Bouquet":250,"Mighty Cavalry":250,"Missile Silo":250,"Pacifier":230,"Concussion":200,"Bigger Tripmines":200,"Springloaded":200,"Conga Line":200,"Husk Express":200,"Shotgun":200,"Bigger Blast":200,"Bloody Bell":200,"Problem Child":150,"More Tripmines":150,"Accurate Telefragger":150,"Scorched Earth":150,"Mighty Gong":150,"Barotrauma":125,"Delusion":115};
const chaosCurses=new Set(["Mighty Cavalry","Missile Silo","Bloody Bell","Delusion"]);const curses:Curse[]=curseOptions.map(name=>({name,value:values[name]??0,chaos:chaosCurses.has(name)}));

const negativeOutcomes = [
  ["Payment","Loses 10% of server Gifts, capped at 5,000.","Loses 20% of server Gifts, capped at 5,000."],
  ["Martpocalypse","Spawns 6 temporary Marts.","Spawns 6 Marts at twice the size."],
  ["2 Random Enemies","Spawns 2 temporary enemies from the current pool.","Spawns 4 temporary enemies."],
  ["Mart and Springer","Marts become faster; Springers jump faster and more often.","No separate High Roller change is listed."],
  ["It’s Here","Creates one massive Springer.","Creates 3 massive Springers."],
  ["Less Jump Pads","Removes 40–60% of normal Jump Pads.","Removes 100% of normal Jump Pads."],
  ["More Seamines","Adds 40–60% more Seamines.","Adds 100–120% more Seamines."],
  ["Oops, all Flesh!","Infects tiles around the altar and spawns a Flesh.","Spawns 3 Flesh and greatly expands infection."],
] as const;

function Gift({size=18}:{size?:number}) { return <img className="gift-icon" src={wikiImage("GoldGiftIcon.png")} alt="Golden Gifts" style={{width:size,height:size}}/>; }
function protectionCost(level:number,gifts:number,players:number,party:PartySize){const small=party==="solo"||party==="duo";return Math.floor(gifts*(small ? .05 : .1)+(small?12.5:50)*Math.max(1,level-4)*(small?players:Math.sqrt(players)/1.75));}
function purificationMultiplier(level:number){return Math.min(12,Math.floor(level/5)*2);}
function purificationCost(value:number,level:number,players:number){return Math.round(value*purificationMultiplier(level)*Math.sqrt(players));}
function signed(value:number){return `${value>0?"+":""}${value.toLocaleString()}`;}

export default function Home(){
  const {run,update:updateRun,reset:resetShared}=useSharedRun(storageKey);const{level,players,party,difficulty,gifts}=run;
  const [mode,setMode]=useState<Mode>("protection");const [ready,setReady]=useState(false);
  const activeCurseCounts=useMemo(()=>{const merged={...run.curses};for(const[name,count]of Object.entries(run.medalCurses))merged[name]=Math.max(merged[name]??0,count);return merged;},[run.curses,run.medalCurses]);
  const selected=useMemo(()=>new Set(Object.keys(activeCurseCounts).filter(name=>activeCurseCounts[name]>0)),[activeCurseCounts]);
  const chanceCurse:ChanceCurse=selected.has("High Roller")&&selected.has("Tweaked Odds")?"both-chaos":selected.has("High Roller")?"high-roller":selected.has("Tweaked Odds")?"tweaked-odds":"none";

  useEffect(()=>{
    let saved:Partial<SavedState>={};try{const raw=localStorage.getItem(storageKey);if(raw)saved=JSON.parse(raw)}catch{}setMode(saved.mode??"protection");setReady(true);
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(storageKey,JSON.stringify({mode}))},[ready,mode]);

  const homeHref=useMemo(()=>`${homeUrl}?${buildRunQuery(run)}`,[run]);
  const levels=useMemo(()=>Array.from({length:5},(_,i)=>({level:Math.max(1,level)+i,cost:protectionCost(Math.max(1,level)+i,gifts,players,party)})),[level,gifts,players,party]);
  const selectedCurses=useMemo(()=>curses.filter(c=>selected.has(c.name)),[selected]);
  const targetValue=selectedCurses.length?Math.max(...selectedCurses.map(c=>c.value)):0;
  const targets=selectedCurses.filter(c=>c.value===targetValue);const laterTargets=selectedCurses.filter(c=>c.value<targetValue).sort((a,b)=>b.value-a.value);const targetStacks=targets.reduce((sum,c)=>sum+(activeCurseCounts[c.name]??0),0);const trackedStacks=selectedCurses.reduce((sum,c)=>sum+(activeCurseCounts[c.name]??0),0); const targetCost=purificationCost(targetValue,level,players);
  const positiveOutcomes=useMemo(()=>{
    const tweaked=chanceCurse==="tweaked-odds"; const high=chanceCurse==="high-roller"||chanceCurse==="both-chaos";
    return [
      {name:"No Tripmines",description:"Removes every Tripmine for this level.",high:"Removes every Tripmine for this level.",available:difficulty!=="casual"&&!tweaked,reason:difficulty==="casual"?"Casual can only roll Gift Yield as a positive.":"Removed from the Tweaked Odds pool."},
      {name:"Gold Gift Yield",description:tweaked?"Adds +0.25x or +0.5x yield.":high?"Adds +0.75x or +1.25x yield.":"Adds +0.5x or +0.75x yield.",high:"",available:true,reason:""},
      {name:"Revive Player",description:(high?"Revives 2 random dead players.":"Revives one random dead player.")+" It only has an effect if someone is dead.",high:"",available:difficulty!=="casual"&&!tweaked&&players>1,reason:difficulty==="casual"?"Casual can only roll Gift Yield as a positive.":tweaked?"Removed from the Tweaked Odds pool.":"Impossible in Solo: the run cannot continue with its only player dead."},
      {name:"Flesh BEGONE",description:high?"Cleanses Flesh tiles and kills 2 Flesh.":"Cleanses Flesh tiles and kills one Flesh.",high:"",available:difficulty!=="casual",reason:"Casual can only roll Gift Yield as a positive."},
      {name:"Extra Shield",description:high?"Gives shields to 2 random players.":"Gives a shield to one random player.",high:"",available:difficulty!=="casual",reason:"Casual can only roll Gift Yield as a positive."},
    ];
  },[chanceCurse,difficulty,players]);
  const availablePositive=positiveOutcomes.filter(o=>o.available); const categoryChance=chanceCurse==="tweaked-odds"?100:50; const positiveChance=categoryChance/availablePositive.length; const negativeChance=categoryChance/negativeOutcomes.length;
  const current=levels[0]; const icon=mode==="chance"?"Altar_of_Chance_Infobox.png":mode==="purification"?"Altar_of_Purification_Infobox.png":"Altar_of_Protection_Infobox.png";
  const reset=()=>{resetShared();setMode("protection")};

  return <main>
    <header className="topbar">
      <a className="back" href={homeHref}>← Tools</a>
      <div className="brand"><img src={wikiImage(icon)} alt=""/><span>ALTAR CHECKER</span></div>
      <span className="header-run-summary">LVL {level} · {players}P · {difficulty.toUpperCase()}</span>
    </header>
    <div className="mode-tabs" role="tablist" aria-label="Altar type">
      {(["protection","purification","chance"] as Mode[]).map(item=><button key={item} className={mode===item?"active":""} role="tab" aria-selected={mode===item} onClick={()=>{setMode(item);if(item==="purification"&&level<14)updateRun({level:14});if(item==="chance"&&level<3)updateRun({level:3});}}><img src={wikiImage(item==="chance"?"Altar_of_Chance_Infobox.png":item==="purification"?"Altar_of_Purification_Infobox.png":"Altar_of_Protection_Infobox.png")} alt=""/><span><small>{item==="chance"?"OUTCOMES":item==="purification"?"CURSE ORDER":"PRICE"}</small>{item[0].toUpperCase()+item.slice(1)}</span></button>)}
    </div>
    <div className="tool-context" data-tour="altar-context"><span>Quick Menu: Level {level} · {players} players · {party.replace("-"," ")} · {gifts.toLocaleString()} Gifts</span>{mode==="chance"&&<strong>{chanceCurse==="both-chaos"?"High Roller + Tweaked (Chaos)":chanceCurse==="high-roller"?"High Roller":chanceCurse==="tweaked-odds"?"Tweaked Odds":"No Chance curse"}</strong>}{mode==="purification"&&<strong>{targetStacks} possible next target{targetStacks===1?"":"s"}</strong>}<ToolRunFields run={run} update={updateRun}/></div>
    <div className="shell one-column-shell" data-tour="altar-result">

      {mode==="protection"&&<section className="result-panel"><div className="hero-result"><div className="altar-visual"><img src={wikiImage("Altar_of_Protection_Infobox.png")} alt="Altar of Protection"/></div><div className="result-copy"><p>LEVEL {current.level} · PROTECTION</p>{level<8?<><strong className="locked-price">Locked</strong><span>Protection starts at Level 8.</span></>:<><strong><Gift size={34}/>{current.cost.toLocaleString()}</strong><span>{gifts<current.cost?<>You need <b>{(current.cost-gifts).toLocaleString()}</b> more.</>:<>You’ll have <b>{(gifts-current.cost).toLocaleString()}</b> left.</>}</span></>}</div></div><div className="formula-strip"><span>PRICE RULE</span><code>{party==="solo"||party==="duo"?"⌊ 5% gifts + 12.5 × level scale × players ⌋":"⌊ 10% gifts + 50 × level scale × √players ÷ 1.75 ⌋"}</code></div><div className="mechanic-note"><b>40-second shield bubble</b><span>Each player touching it can claim one shield that round; shields stack. Echo is free but shields only its activator. Drowned Aegis guarantees this altar every level.</span></div><div className="forecast-heading"><div><p>NEXT FIVE LEVELS</p><h2>Price forecast</h2></div><small>Same starting balance</small></div><div className="forecast-grid">{levels.map((item,i)=><article className={`${i===0?"current":""} ${item.level<8?"unavailable":""}`} key={item.level}><span>{i===0?"NOW":"LEVEL"}</span><b>{item.level}</b><strong>{item.level<8?"—":<><Gift size={16}/>{item.cost.toLocaleString()}</>}</strong></article>)}</div></section>}

      {mode==="purification"&&<section className="result-panel purification-panel"><div className="hero-result purification-result"><div className="altar-visual"><img src={wikiImage("Altar_of_Purification_Infobox.png")} alt="Altar of Purification"/></div><div className="result-copy"><p>LEVEL {level} · NEXT TARGET</p>{level<14?<><strong className="locked-price">Locked</strong><span>Purification starts at Level 14.</span></>:!targets.length?<><strong className="choose-price">Pick curses</strong><span>Add active regular or Medal Curses from the Quick Menu.</span></>:<><strong className="purification-price"><small>≈</small><Gift size={30}/>{targetCost.toLocaleString()}</strong><span>{targets.length===1?<><b>{targets[0].name}</b> is first in the order · estimated balance after {(gifts-targetCost).toLocaleString()}.</>:<>One of <b>{targets.map(t=>t.name).join(" / ")}</b> is likely first (same value).</>}</span></>}</div></div><div className="formula-strip"><span>PRICE RULE</span><code>{targets.length?targetValue:"curse value"} × {purificationMultiplier(level)} level scale × √{players} · wiki gives no rounding rule</code></div><div className="purification-note"><b>Only next targets count above</b><span>Purification targets the highest curse value. Same-value grouping is suspected. Unlisted regular curses have value 0 and only become targets after higher-value curses are gone. Greater Curses are never counted. Medal Curse stacks are imported automatically without double-counting anything also marked in regular Curses.</span></div><div className="priority-heading"><span>POSSIBLE NEXT TARGETS</span><strong>{targetStacks} stack{targetStacks===1?"":"s"}</strong></div>{targets.length?<div className="priority-list">{targets.map(curse=><article key={curse.name} className="next"><span>NEXT</span><b>{curse.name}{(activeCurseCounts[curse.name]??0)>1?` ×${activeCurseCounts[curse.name]}`:""}</b><small>{curse.value} VALUE · ≈ {purificationCost(curse.value,level,players).toLocaleString()} GIFTS</small></article>)}</div>:<p className="empty-priority">Open the Quick Menu and add the curses currently active in your run.</p>}{laterTargets.length>0&&<details className="later-curses"><summary><span>Later in the removal order</span><strong>{trackedStacks-targetStacks} other stack{trackedStacks-targetStacks===1?"":"s"} · not counted above</strong></summary><div className="priority-list">{laterTargets.map((curse,index)=><article key={curse.name}><span>#{index+2}</span><b>{curse.name}{(activeCurseCounts[curse.name]??0)>1?` ×${activeCurseCounts[curse.name]}`:""}</b><small>{curse.value} VALUE · ≈ {purificationCost(curse.value,level,players).toLocaleString()} GIFTS</small></article>)}</div></details>}</section>}

      {mode==="chance"&&<section className="result-panel chance-panel"><div className="chance-summary"><img src={wikiImage("Altar_of_Chance_Infobox.png")} alt="Altar of Chance"/><div><p>LEVEL {level} · {difficulty.toUpperCase()}</p><h2>{level<3?"Locked until Level 3":chanceCurse==="tweaked-odds"?"One good + one bad":"50 / 50 roll"}</h2><span>{chanceCurse==="high-roller"?"High Roller intensities shown.":chanceCurse==="both-chaos"?"Chaos with both uses the High Roller variant only.":chanceCurse==="tweaked-odds"?"Tweaked Odds removes No Tripmines and Revive.":"Normal outcome intensities shown."}</span></div></div><div className="offering-heading good"><div><p>POSITIVE POOL</p><h2>{availablePositive.length} possible offering{availablePositive.length===1?"":"s"}</h2></div><small>{positiveChance.toFixed(1).replace(".0","")}% each*</small></div><div className="outcome-grid">{positiveOutcomes.map(outcome=><article key={outcome.name} className={`outcome good ${outcome.available?"":"excluded"}`}><div><span>{outcome.available ? `${positiveChance.toFixed(1).replace(".0","")}%*` : "OUT"}</span><strong>{outcome.name}</strong></div><p>{outcome.available?outcome.description:outcome.reason}</p></article>)}</div><div className="offering-heading bad"><div><p>NEGATIVE POOL</p><h2>8 possible offerings</h2></div><small>{negativeChance.toFixed(1).replace(".0","")}% each*</small></div><div className="outcome-grid">{negativeOutcomes.map(outcome=>{const high=chanceCurse==="high-roller"||chanceCurse==="both-chaos";const rate=high?.2:.1;const deduction=Math.max(-5000,Math.min(Math.floor(gifts*rate),5000));const change=-deduction;return <article key={outcome[0]} className="outcome bad"><div><span>{negativeChance.toFixed(1).replace(".0","")}%*</span><strong>{outcome[0]}</strong></div><p>{outcome[0]==="Payment"?`${high?outcome[2]:outcome[1]} Current balance change: ${signed(change)} Gifts${gifts<0?" (Payment gives Gifts back from a negative balance)":""}.`:high?outcome[2]:outcome[1]}</p></article>})}</div><div className="chance-notes"><b>Chance quirks</b><span>Flesh BEGONE can be undone by later infection. With Tweaked Odds, Oops, all Flesh! resolves after Flesh BEGONE. Echo announces and applies the rolled outcome normally. Rolling near the end of a level reduces the value of several negative effects.</span></div><p className="chance-caveat">*The wiki confirms the 50/50 category roll, but does not publish within-category weights. These per-offering percentages assume equal weighting. Patch 5 descriptions may still be slightly inaccurate.</p></section>}
    </div>
    <footer><span>Data checked against the Nullscape Wiki · 7 Aug 2026</span><span>Settings save on this device · Unofficial fan tool · Made with help from an LLM.</span></footer>
    <RunDock run={run} update={updateRun} reset={reset} toolId="altar" toolSteps={[{selector:".mode-tabs",title:"Pick an altar",text:"The tabs switch between Protection price, Purification order, and every documented Chance outcome."},{selector:"[data-tour='altar-result'] .result-copy",title:"Results update live",text:"Change the run in the Quick Menu and the active calculator recalculates immediately."}]}/>
  </main>;
}
