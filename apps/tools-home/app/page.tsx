"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import { buildRunQuery, RunDock, useSharedRun } from "./run-dock";

const checkerUrl="/nullscape-tools/medal/";
const altarUrl="/nullscape-tools/altar/";
const shopUrl="/nullscape-tools/shop/";
const compendiumUrl="/nullscape-tools/compendium/";
const medalIcon="https://nullscape.wiki/wiki/Special:Redirect/file/Medal.png";
const altarIcon="https://nullscape.wiki/wiki/Special:Redirect/file/MoreAltars.png";
const shopIcon="https://nullscape.wiki/wiki/Special:Redirect/file/BusinessLicense.png";

export default function Home(){
  const {run,update,reset}=useSharedRun("nullscape-run-profile-v1");
  const query=useMemo(()=>buildRunQuery(run),[run]);
  const steps=useMemo(()=>[
    {selector:"[data-tour='tool-cards'] .tool-card:first-child",title:"Choose a calculator",text:"Your newest Quick Menu data is carried into whichever tool you open."},
    {selector:"[data-tour='tool-cards'] .tool-card:last-child",title:"Come back any time",text:"Every tool returns here without clearing the run. Use Walkthrough in the Quick Menu whenever you want this guide again."},
  ],[]);
  return <main>
    <header className="site-header"><a className="brand" href="#top" aria-label="Nullscape Tools home"><span className="brand-glyph" aria-hidden="true">N</span><span>NULLSCAPE TOOLS</span></a><span className="header-status">RUN DATA LIVES IN THE QUICK MENU ↓</span></header>
    <div className="shell" id="top">
      <section className="intro"><p className="eyebrow">RUN TOOLS</p><h1>Useful stuff.<br/><span>No clutter.</span></h1><p className="lede">Open the Quick Menu once, set the run, and every tool uses the newest version.</p></section>
      <section className="tools" aria-labelledby="tools-heading" data-tour="tool-cards">
        <div className="section-heading"><div><p className="eyebrow">AVAILABLE NOW</p><h2 id="tools-heading">Pick a tool</h2></div><span>4 TOOLS</span></div>
        <div className="tool-list">
          <a className="tool-card" href={`${checkerUrl}?${query}`}><span className="tool-icon"><img src={medalIcon} alt="Medal Curse icon"/></span><span className="tool-copy"><span className="tool-kicker">RUN PLANNER</span><strong>Medal Pool Checker</strong><span>See eligible Medal Curses from your level, enemies, and active curses.</span></span><span className="launch" aria-hidden="true">OPEN <b>↗</b></span></a>
          <a className="tool-card altar-card" href={`${altarUrl}?${query}`}><span className="tool-icon"><img src={altarIcon} alt="More Altars icon"/></span><span className="tool-copy"><span className="tool-kicker">PRICE + ODDS</span><strong>Altar Calculator</strong><span>Check Protection, Purification priority, and possible Chance outcomes.</span></span><span className="launch" aria-hidden="true">OPEN <b>↗</b></span></a>
          <a className="tool-card shop-card" href={`${shopUrl}?${query}`}><span className="tool-icon"><img src={shopIcon} alt="Business License icon"/></span><span className="tool-copy"><span className="tool-kicker">UPGRADE PLANNER</span><strong>Shop Calculator</strong><span>See eligible upgrades, exact stack prices, prerequisites, and plan purchases.</span></span><span className="launch" aria-hidden="true">OPEN <b>↗</b></span></a>
          <a className="tool-card" href={compendiumUrl}><span className="tool-icon" aria-hidden="true">✦</span><span className="tool-copy"><span className="tool-kicker">CLASS KNOWLEDGE</span><strong>Tech Compendium</strong><span>Browse Nullscape class tricks, setups, input sequences, and reminders.</span></span><span className="launch" aria-hidden="true">OPEN <b>↗</b></span></a>
        </div>
      </section>
    </div>
    <footer><span>NULLSCAPE TOOLS</span><span>Settings save on this device · Unofficial fan project · Made with help from an LLM.</span></footer>
    <RunDock run={run} update={update} reset={reset} toolId="home" toolSteps={steps}/>
  </main>;
}
