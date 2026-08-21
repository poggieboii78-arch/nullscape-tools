"use client";

import { useMemo, useState } from "react";
import type { SharedRun } from "./run-dock";

type ScheduleEvent = {
  id: string;
  name: string;
  levels: number[];
  detail: string;
  enemy?: string;
  modes?: SharedRun["difficulty"][];
};

function buildSchedule(difficulty: SharedRun["difficulty"]): ScheduleEvent[] {
  const casual = difficulty === "casual";
  const extreme = difficulty === "extreme";
  return [
    { id:"tripmines", name:"Tripmines begin", levels:[5], detail:"Tripmines enter map generation.", modes:["standard","extreme"] },
    { id:"ice", name:"Ice Tiles begin", levels:[extreme ? 5 : 8], detail:"Ice tiles can begin appearing in generated maps." },
    { id:"mart", name:"Mart Growth", levels:[6,12,18,24,30], detail:"Marts gain a larger default size and size cap.", enemy:"Mart" },
    { id:"seamines", name:"Seamines begin", levels:[casual ? 15 : 10], detail:"Seamines can begin appearing in generated maps." },
    { id:"husk", name:"More Husks", levels:[casual ? 15 : 10], detail:"Each active Husk stack gains another Husk.", enemy:"Husk" },
    { id:"highrise", name:"Highrise Towers", levels:[18], detail:"Highrise tower tiles enter map generation." },
    { id:"level50", name:"More Enemies", levels:[50], detail:"The hidden level-50 progression event adds more enemy pressure." },
  ].filter(event => !event.modes || event.modes.includes(difficulty));
}

export function ProgressionEventPredictor({ run }: { run: SharedRun }) {
  const [relevantOnly,setRelevantOnly]=useState(false);
  const activeEnemies=useMemo(()=>new Set(Object.keys(run.enemies).filter(name=>run.enemies[name]>0)),[run.enemies]);
  const entries=useMemo(()=>buildSchedule(run.difficulty)
    .flatMap(event=>event.levels.map(level=>({...event,level,active:!event.enemy||activeEnemies.has(event.enemy)})))
    .sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)),[run.difficulty,activeEnemies]);
  const visible=entries.filter(event=>!relevantOnly||event.active);
  const upcoming=entries.filter(event=>event.level>run.level&&event.active);
  const nextLevel=upcoming[0]?.level;
  const next=upcoming.filter(event=>event.level===nextLevel);
  const until=nextLevel===undefined?null:nextLevel-run.level;

  return <section className="progression-predictor" id="progression-predictor" aria-labelledby="progression-heading">
    <header className="predictor-heading">
      <div>
        <p className="eyebrow">FIXED EVENT SCHEDULE</p>
        <h2 id="progression-heading">Progression Event Predictor</h2>
        <p>Progression events use set level breakpoints. Difficulty changes some timings; your enemy roster controls which enemy events matter.</p>
      </div>
      <span className="schedule-badge">{run.difficulty.toUpperCase()} · LEVEL {run.level}</span>
    </header>

    <div className="next-event-card">
      <div className="next-countdown">
        <span>NEXT ACTIVE EVENT</span>
        {nextLevel!==undefined ? <><strong>LEVEL {nextLevel}</strong><small>{until===1?"next level":until+" levels away"}</small></> : <><strong>SCHEDULE CLEAR</strong><small>No documented event after this level</small></>}
      </div>
      <div className="next-event-list">
        {next.length ? next.map(event=><article key={event.id}><b>{event.name}</b><span>{event.detail}</span></article>) : <article><b>No upcoming breakpoint</b><span>You are past the documented timeline shown here.</span></article>}
      </div>
    </div>

    <div className="timeline-heading">
      <div><span>FULL TIMELINE</span><small>Past, next, and upcoming fixed breakpoints</small></div>
      <label><input type="checkbox" checked={relevantOnly} onChange={event=>setRelevantOnly(event.target.checked)}/> Only active for this run</label>
    </div>
    <div className="event-timeline">
      {visible.map(event=>{
        const state=event.level<=run.level?"passed":event.level===nextLevel&&event.active?"next":"upcoming";
        return <article className={["timeline-event",state,event.active?"":"inactive"].join(" ")} key={event.id+"-"+event.level}>
          <div className="timeline-level"><span>LVL</span><b>{event.level}</b></div>
          <div className="timeline-copy"><strong>{event.name}</strong><span>{event.detail}</span>{event.enemy&&<small>{event.active?"ACTIVE · "+event.enemy+" selected":"INACTIVE · requires "+event.enemy}</small>}</div>
          <em>{event.active?(state==="passed"?"PASSED":state==="next"?"NEXT":"UPCOMING"):"DORMANT"}</em>
        </article>;
      })}
    </div>
    <p className="schedule-note">Current documented schedule. Game updates can change breakpoints; enemy multiplier events without a verified current level are intentionally not guessed.</p>
  </section>;
}
