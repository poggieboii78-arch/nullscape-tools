"use client";

import { useMemo } from "react";
import LobbyStyler from "../lobby-styler";
import { buildRunQuery, RunDock, useSharedRun } from "../run-dock";

export default function LobbyStylerPage(){
  const {run,update,reset,applyLinkedRun}=useSharedRun("nullscape-lobby-styler-v1");
  const homeHref=useMemo(()=>"/nullscape-tools/?"+buildRunQuery(run),[run]);
  const toolSteps=useMemo(()=>[
    {selector:".lobby-styler-page",title:"Style your lobby name",text:"Enter a name, choose formatting, and watch the RichText preview update live."},
    {selector:".lobby-styler-output",title:"Copy the Roblox markup",text:"Copy the generated RichText string and use it where your VIP lobby name is displayed with RichText enabled."},
  ],[]);
  return <main className="lobby-styler-page">
    <header className="site-header"><a className="brand" href={homeHref} aria-label="Back to Nullscape Tools"><span className="brand-glyph" aria-hidden="true">N</span><span>LOBBY NAME STYLER</span></a><a className="progression-back" href={homeHref}>← ALL TOOLS</a></header>
    <div className="shell">
      <section className="intro"><p className="eyebrow">VIP / RICHTEXT TOOL</p><h1>Make your lobby<br/><span>look stupidly good.</span></h1><p className="lede">Build a Roblox RichText lobby name with colors, fonts, formatting, and strokes, then copy the exact markup.</p></section>
      <LobbyStyler/>
    </div>
    <footer><span>NULLSCAPE TOOLS</span><span>Roblox RichText helper · Unofficial fan project.</span></footer>
    <RunDock run={run} update={update} reset={reset} applyLinkedRun={applyLinkedRun} toolId="lobby-styler" toolSteps={toolSteps}/>
  </main>;
}
