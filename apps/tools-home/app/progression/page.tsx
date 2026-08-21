"use client";

import { useMemo } from "react";
import { buildRunQuery, RunDock, ToolRunFields, useSharedRun } from "../run-dock";
import { ProgressionEventPredictor } from "../progression-event-predictor";

export default function ProgressionPage(){
  const {run,update,reset,applyLinkedRun}=useSharedRun("nullscape-progression-tool-v1");
  const homeHref=useMemo(()=>`/nullscape-tools/?${buildRunQuery(run)}`,[run]);
  return <main className="progression-tool-page">
    <header className="site-header">
      <a className="brand" href={homeHref} aria-label="Back to Nullscape Tools"><span className="brand-glyph" aria-hidden="true">N</span><span>PROGRESSION EVENTS</span></a>
      <a className="progression-back" href={homeHref}>← ALL TOOLS</a>
    </header>
    <ToolRunFields run={run} update={update}/>
    <div className="shell progression-shell">
      <section className="intro progression-intro">
        <p className="eyebrow">PROGRESSION TOOL</p>
        <h1>What comes<br/><span>next?</span></h1>
        <p className="lede">Use your current Quick Menu run, record the events you see, and build a better forecast as you play.</p>
      </section>
      <ProgressionEventPredictor run={run}/>
    </div>
    <footer><span>NULLSCAPE TOOLS</span><span>Predictions are learned estimates · Unofficial fan project.</span></footer>
    <RunDock run={run} update={update} reset={reset} applyLinkedRun={applyLinkedRun} toolId="progression"/>
  </main>;
}
