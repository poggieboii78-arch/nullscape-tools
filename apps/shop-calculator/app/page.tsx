"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { RunDock, ToolRunFields, useSharedRun, type SharedRun } from "./run-dock";

type Upgrade={name:string;cost:number;max:number;minLevel:number;description:string;costCasual?:number;costExtreme?:number;costSolo?:number;minLevelCasual?:number;stackCosts?:number[];stackCostsCasual?:number[];stackCostsExtreme?:number[];stackCostsSolo?:number[];requires?:[string,number];enemy?:string;soloDiscount?:number};

const upgrades:Upgrade[]=[
 {name:"Adrenaline",cost:50,max:1,minLevel:3,description:"+20% movement speed. Solo and Duo only."},
 {name:"Business License",cost:75,stackCosts:[75,187.5],max:2,minLevel:3,description:"+25% Golden Gift yield."},
 {name:"Paycheck",cost:55,max:5,minLevel:3,description:"Earn Golden Gifts each round when at least half the players survive."},
 {name:"Swiftness Ring",cost:80,max:3,minLevel:3,description:"+10% movement speed per stack."},
 {name:"Better Jump Pads",cost:50,max:1,minLevel:5,description:"More Jump Pads with less-random positions."},
 {name:"Defuse Kit",cost:30,max:3,minLevel:5,description:"+20% chance for Tripmines not to explode."},
 {name:"Double Jump",cost:150,max:1,minLevel:5,description:"Allows you to double jump."},
 {name:"Grapple Points",cost:100,max:1,minLevel:5,description:"Adds powerful Grapple Points."},
 {name:"Last Robloxian Standing",cost:300,max:1,minLevel:5,description:"A survival buff when you are the last player alive."},
 {name:"Medal",cost:100,max:1,minLevel:5,description:"Spawns the Medal for Golden Gifts and difficult Curse choices."},
 {name:"Radar",cost:175,max:1,minLevel:5,description:"The arrow stays visible and highlights nearby Gifts."},
 {name:"Tria Orbs",cost:100,max:1,minLevel:5,description:"Adds boost Orbs around the map."},
 {name:"Advanced Gravity Coil",cost:600,max:1,minLevel:8,description:"Higher, controllable jumps."},
 {name:"Fanny Pack",cost:300,max:1,minLevel:8,description:"Complete yellow tiles during collapse for bonus Gifts."},
 {name:"Grace Wings",cost:300,costSolo:200,max:1,minLevel:8,description:"Greatly improves air control."},
 {name:"Helmet",cost:400,max:1,minLevel:8,description:"Bonking sends you upward with full control."},
 {name:"Ice Skates",cost:400,costSolo:300,max:1,minLevel:8,description:"Less slipping and a directional speed boost."},
 {name:"Pocket Bell",cost:300,max:1,minLevel:8,requires:["Double Jump",1],enemy:"Bell",description:"Grants another extra jump."},
 {name:"Radar Module: Altars",cost:300,max:1,minLevel:8,requires:["Radar",1],description:"Periodically marks unused Altars."},
 {name:"Radar Module: Enemies",cost:200,max:1,minLevel:8,requires:["Radar",1],description:"Tracks enemies through walls."},
 {name:"Radar Module: Players",cost:150,max:1,minLevel:8,requires:["Radar",1],description:"Periodically highlights other players."},
 {name:"Radar Module: Tripmines",cost:400,max:1,minLevel:8,requires:["Radar",1],description:"Highlights nearby Tripmines."},
 {name:"More Altars",cost:600,max:1,minLevel:10,description:"Spawns an additional Altar."},
 {name:"Larger Grapple Points",cost:500,max:1,minLevel:13,description:"Grapple Points are 25% larger."},
 {name:"Ninja Belt",cost:700,costCasual:500,costSolo:500,max:1,minLevel:13,description:"Provides a class-specific buff."},
 {name:"Subspacial Barrier",cost:1000,stackCosts:[1000,3000],stackCostsSolo:[500,1500],max:2,minLevel:13,minLevelCasual:15,requires:["Defuse Kit",3],description:"Adds protection from Tripmines and Void Implosions."},
 {name:"Gift Magnet",cost:1500,stackCosts:[1500,2100,2700],stackCostsCasual:[750,1050,1350],stackCostsExtreme:[1800,2520,3240],max:3,minLevel:15,description:"Increases Gift pickup range."},
 {name:"Matrix Tetrahedron",cost:2500,costCasual:1500,costExtreme:3000,max:1,minLevel:15,description:"Instant acceleration and no slippery movement."},
 {name:"Radar Module: Instruments",cost:1000,max:1,minLevel:15,requires:["Radar",1],enemy:"Cadence",description:"Tracks Cadence's instruments."},
 {name:"Shark Tail",cost:1200,costCasual:800,costExtreme:1500,max:1,minLevel:15,requires:["Ninja Belt",1],description:"Provides a stronger class-specific buff."},
 {name:"Shield",cost:4000,costCasual:2000,costExtreme:5000,costSolo:1000,max:1,minLevel:15,description:"Lets you take an extra hit."},
 {name:"Sport Shoes",cost:1350,costCasual:1000,costExtreme:1600,max:1,minLevel:15,description:"+40% movement speed."},
 {name:"Panic Necklace",cost:3000,costCasual:1500,max:1,minLevel:18,requires:["Shield",1],description:"A strong temporary buff when your last Shield breaks."},
 {name:"Drowned Aegis",cost:6000,costCasual:4000,max:1,minLevel:20,requires:["More Altars",1],description:"Protection Altars also grant a one-use Void shield."},
 {name:"Gift Idol",cost:4000,stackCosts:[4000,8000,12000,16000,20000],stackCostsCasual:[3000,6000,9000,12000,15000],stackCostsExtreme:[5000,10000,15000,20000,25000],max:5,minLevel:20,description:"Gifts can collect nearby Gifts."},
 {name:"Miniature Hourglass",cost:3000,costCasual:1500,max:1,minLevel:20,description:"Provides a class-specific buff."},
];

const iconFile:Record<string,string>={"Drowned Aegis":"DrownedÆgis.png"};
const icon=(name:string)=>`https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(iconFile[name]??name.replace(/[\s:'’]/g,"")+".png")}`;
const goldenGiftIcon="https://nullscape.wiki/wiki/Special:Redirect/file/GoldGiftIcon.png";
function GoldenGiftIcon(){return <img className="golden-gift-icon" src={goldenGiftIcon} alt="Golden Gifts"/>;}
const owned=(run:SharedRun,name:string)=>run.upgrades[name]??0;
function visible(upgrade:Upgrade,run:SharedRun){
 if(upgrade.name==="Adrenaline"&&!['solo','duo'].includes(run.party))return false;
 if(upgrade.name==="Defuse Kit"&&run.difficulty==="casual")return false;
 if(upgrade.name==="Last Robloxian Standing"&&run.players<=2)return false;
 if(upgrade.name==="Radar Module: Tripmines"&&run.difficulty==="casual")return false;
 if(upgrade.name==="Radar Module: Players"&&run.players<=1)return false;
 if(upgrade.name==="Grace Wings"&&run.difficulty==="casual")return false;
 return true;
}
function requirement(upgrade:Upgrade,run:SharedRun){
 if(upgrade.requires&&owned(run,upgrade.requires[0])<upgrade.requires[1])return `${upgrade.requires[0]} ×${upgrade.requires[1]}`;
 if(upgrade.enemy&&(run.enemies[upgrade.enemy]??0)<1)return `${upgrade.enemy} enemy`;
 return null;
}
function price(upgrade:Upgrade,run:SharedRun){
 const count=owned(run,upgrade.name);const solo=run.party==="solo";let stacks=upgrade.stackCosts;
 if(solo&&upgrade.stackCostsSolo)stacks=upgrade.stackCostsSolo;else if(run.difficulty==="casual"&&upgrade.stackCostsCasual)stacks=upgrade.stackCostsCasual;else if(run.difficulty==="extreme"&&upgrade.stackCostsExtreme)stacks=upgrade.stackCostsExtreme;
 let base=stacks?.[Math.min(count,stacks.length-1)]??(solo&&upgrade.costSolo!=null?upgrade.costSolo:run.difficulty==="casual"?(upgrade.costCasual??upgrade.cost):run.difficulty==="extreme"?(upgrade.costExtreme??upgrade.cost):upgrade.cost);
 if(solo&&upgrade.costSolo==null&&!upgrade.stackCostsSolo)base*=1-(upgrade.soloDiscount??0)/100;
 base*=Math.sqrt(run.players);if((run.party==="party-plus"||run.players>8)&&run.players>1)base/=1.125;if((run.curses["Nothing?"]??0)>0)base*=.85;return Math.ceil(base);
}
function nextShopLevel(level:number){let next=Math.max(3,level+1);while(![0,3,5,8].includes(next%10))next+=1;return next;}

export default function Home(){
 const {run,update,reset,applyLinkedRun}=useSharedRun("nullscape-shop-state-v1");
 const [selected,setSelected]=useState<string[]>([]);const [search,setSearch]=useState("");const [autoNextShop,setAutoNextShop]=useState(false);const locked=run.inputMode==="quick";
 const quickLinkState=useMemo(()=>({selected,autoNextShop}),[selected,autoNextShop]);
 const applyQuickLinkState=useCallback((state:Record<string,unknown>)=>{if(Array.isArray(state.selected))setSelected(state.selected.filter((name):name is string=>typeof name==="string"&&upgrades.some(item=>item.name===name)));if(typeof state.autoNextShop==="boolean")setAutoNextShop(state.autoNextShop);},[]);
 useEffect(()=>{try{setAutoNextShop(localStorage.getItem("nullscape-shop-auto-next")==="1");}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem("nullscape-shop-auto-next",autoNextShop?"1":"0");}catch{}},[autoNextShop]);
 const shop=useMemo(()=>upgrades.filter(item=>visible(item,run)&&owned(run,item.name)<item.max&&run.level>=(run.difficulty==="casual"?(item.minLevelCasual??item.minLevel):item.minLevel)&&!requirement(item,run)).filter(item=>item.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.minLevel-b.minLevel||price(a,run)-price(b,run)),[run,search]);
 const selectedCost=selected.reduce((sum,name)=>sum+price(upgrades.find(item=>item.name===name)!,run),0);const remaining=run.gifts-selectedCost;
 const cycleOwned=(item:Upgrade)=>{if(locked)return;update(current=>{const next={...current.upgrades};const count=((next[item.name]??0)+1)%(item.max+1);if(count)next[item.name]=count;else delete next[item.name];return{upgrades:next};});setSelected(current=>current.filter(name=>name!==item.name));};
 const buy=()=>{if(remaining<0||!selected.length)return;update(current=>{const next={...current.upgrades};for(const name of selected){const item=upgrades.find(value=>value.name===name)!;next[name]=Math.min(item.max,(next[name]??0)+1);}return{gifts:remaining,upgrades:next,...(autoNextShop?{level:nextShopLevel(current.level)}:{})};});setSelected([]);};
 const resetTool=()=>{setSelected([]);reset();};
 return <main className="shop-page">
  <header className="topbar"><a href="/nullscape-tools/" className="tools-back">← Tools</a><a className="brand" href="/nullscape-tools/" aria-label="Back to Nullscape Tools"><span className="brand-mark"><img src={icon("Business License")} alt=""/></span><span>SHOP CALCULATOR</span></a><span className="header-run-summary">LVL {run.level} · {run.players}P · {run.difficulty.toUpperCase()}</span></header>
  <ToolRunFields run={run} update={update}/>
  <section className="shop-shell">
   <div className="shop-summary" data-tour="shop-summary"><div><small>GOLDEN GIFTS</small><strong>{run.gifts.toLocaleString()}</strong></div><span>−</span><div><small>PLANNED</small><strong>{selectedCost.toLocaleString()}</strong></div><span>=</span><div className={remaining<0?"negative":""}><small>LEFT</small><strong>{remaining.toLocaleString()}</strong></div><label className="auto-next-toggle"><input type="checkbox" checked={autoNextShop} onChange={event=>setAutoNextShop(event.target.checked)}/><span><b>Auto-next shop</b><small>After Purchase → Level {nextShopLevel(run.level)}</small></span></label><button disabled={!selected.length||remaining<0} onClick={buy}>Purchase {selected.length||""}</button></div>
   <section className="owned-panel compact-owned" data-tour="owned-upgrades"><div className="section-heading"><div><small>RUN INVENTORY</small><h1>Owned upgrades</h1><p>{locked?"Edit from the Quick Menu, or switch to Both / Tool Page.":"Icon-only inventory — hover for names, click to cycle stacks."}</p></div><span>{Object.values(run.upgrades).reduce((a,b)=>a+b,0)} owned</span></div><div className={`owned-grid ${locked?"locked":""}`}>{upgrades.filter(item=>visible(item,run)).map(item=>{const count=owned(run,item.name);return <button key={item.name} title={`${item.name} · ${count}/${item.max}`} aria-label={`${item.name}, ${count} of ${item.max} stacks`} className={count?"owned":""} disabled={locked} onClick={()=>cycleOwned(item)}><img src={icon(item.name)} alt=""/><small className="stack-badge">{count}/{item.max}</small></button>})}</div></section>
   <section className="shop-panel compact-shop" data-tour="shop-grid"><div className="section-heading"><div><small>CURRENT POOL</small><h2>Shop</h2><p>Icon-first view. Hover an item for its name and effect.</p></div><label><span>Search</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find an upgrade…"/></label></div>{shop.length?<div className="shop-grid">{shop.map(item=>{const cost=price(item,run);const active=selected.includes(item.name);const unaffordable=cost>remaining&&!active;return <button key={item.name} title={`${item.name}: ${item.description}`} aria-label={`${item.name}, ${cost} Golden Gifts`} className={`${active?"selected":""} ${unaffordable?"unaffordable":""}`} onClick={()=>setSelected(current=>active?current.filter(name=>name!==item.name):[...current,item.name])}><img src={icon(item.name)} alt=""/><span className="item-name">{item.name}</span><strong>{cost.toLocaleString()} <GoldenGiftIcon/></strong></button>})}</div>:<div className="empty-shop"><b>No eligible upgrades</b><span>Raise the level, satisfy prerequisites, or clear the search.</span></div>}</section>
   <details className="rules"><summary>Pricing rules <span>＋</span></summary><p>Uses each upgrade's difficulty and stack costs, then scales by √players. Party+ divides prices by 1.125. Nothing? applies its 15% shop discount. Final prices round up.</p></details>
  </section>
  <footer><p>Data checked against the Nullscape Wiki and the original calculator by Sticks. <span className="llm-disclaimer">Made with help from an LLM.</span></p><a href="https://stickstetris.github.io/NullscapeShopCalculator/" target="_blank" rel="noreferrer">Original calculator ↗</a></footer>
  <RunDock run={run} update={update} reset={resetTool} applyLinkedRun={applyLinkedRun} toolId="shop" quickLinkState={quickLinkState} applyQuickLinkState={applyQuickLinkState} toolSteps={[{selector:"[data-tour='shop-summary']",title:"See what you can afford",text:"This shows your Gifts, the cost of your selected upgrades, and what you will have left. Auto-next can move to the next scheduled shop after you buy."},{selector:"[data-tour='owned-upgrades']",title:"Enter the upgrades you already own",text:"Click an upgrade icon until its stack count matches your run. This lets the calculator show the correct next price and hide upgrades you cannot get."},{selector:"[data-tour='shop-grid']",title:"Plan what to buy",text:"Choose the upgrades you want from the available list. When the plan looks right, press Purchase to add them to your run."}]}/>
 </main>;
}
