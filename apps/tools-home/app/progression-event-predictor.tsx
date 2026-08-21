"use client";

import { useEffect, useMemo, useState } from "react";
import type { SharedRun } from "./run-dock";

type EventRecord = {
  id: string;
  name: string;
  level: number;
  difficulty: SharedRun["difficulty"];
  enemies: string[];
  at: number;
};

const STORAGE_KEY = "nullscape-progression-events-v1";
const observedEvents = [
  "Ice Tiles",
  "Mart Growth",
  "Mart Infection",
  "Enemy Duplication",
  "More Enemies",
];

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function loadRecords(): EventRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is EventRecord =>
      item && typeof item.name === "string" && typeof item.level === "number"
    ).slice(-300);
  } catch {
    return [];
  }
}

export function ProgressionEventPredictor({ run }: { run: SharedRun }) {
  const [records, setRecords] = useState<EventRecord[]>([]);
  const [eventName, setEventName] = useState("");
  const [recordLevel, setRecordLevel] = useState(run.level);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRecords(loadRecords());
    setReady(true);
  }, []);

  useEffect(() => setRecordLevel(run.level), [run.level]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-300))); } catch {}
  }, [ready, records]);

  const candidates = useMemo(() => {
    const names = [...new Set([...observedEvents, ...records.map(item => item.name)])];
    const compatible = records.filter(item =>
      item.difficulty === run.difficulty && item.level <= run.level + 5
    );
    const last = records[records.length - 1];
    const transitions = new Map<string, number>();
    if (last) {
      for (let index = 1; index < records.length; index += 1) {
        if (records[index - 1].name === last.name) {
          transitions.set(records[index].name, (transitions.get(records[index].name) || 0) + 1);
        }
      }
    }

    const activeEnemies = new Set(Object.keys(run.enemies).filter(name => run.enemies[name] > 0));
    const scores = names.map(name => {
      const sightings = compatible.filter(item => item.name === name);
      const allSightings = records.filter(item => item.name === name);
      const transitionHits = transitions.get(name) || 0;
      const lastSeen = [...allSightings].reverse()[0];
      const gap = lastSeen ? Math.max(0, run.level - lastSeen.level) : run.level;
      const enemyMatches = sightings.reduce((sum, item) =>
        sum + item.enemies.filter(enemy => activeEnemies.has(enemy)).length, 0
      );
      const repeatPenalty = last?.name === name ? 0.42 : 1;
      const score = repeatPenalty * (
        1 +
        sightings.length * 2.2 +
        transitionHits * 3 +
        enemyMatches * 0.6 +
        Math.min(gap, 12) * 0.08
      );
      return { name, score, sightings: allSightings.length, lastSeen };
    }).sort((a, b) => b.score - a.score);

    const total = scores.reduce((sum, item) => sum + item.score, 0) || 1;
    return scores.slice(0, 5).map(item => ({
      ...item,
      chance: Math.round((item.score / total) * 100),
    }));
  }, [records, run.difficulty, run.enemies, run.level]);

  const confidence = records.length < 6 ? "LOW" : records.length < 20 ? "LEARNING" : "TRAINED";

  function addRecord() {
    const name = normalizeName(eventName);
    if (!name) return;
    setRecords(current => [...current, {
      id: crypto.randomUUID(),
      name,
      level: Math.max(1, Math.floor(recordLevel || run.level)),
      difficulty: run.difficulty,
      enemies: Object.keys(run.enemies).filter(enemy => run.enemies[enemy] > 0),
      at: Date.now(),
    }].slice(-300));
    setEventName("");
  }

  function undo() {
    setRecords(current => current.slice(0, -1));
  }

  function clear() {
    if (window.confirm("Clear all recorded progression events?")) setRecords([]);
  }

  return <section className="progression-predictor" id="progression-predictor" aria-labelledby="progression-heading">
    <header className="predictor-heading">
      <div>
        <p className="eyebrow">RUN LEARNING TOOL</p>
        <h2 id="progression-heading">Progression Event Predictor</h2>
        <p>Record what appears. The predictor learns this device&apos;s runs and ranks what is most likely next.</p>
      </div>
      <span className={`confidence confidence-${confidence.toLowerCase()}`}>{confidence} · {records.length} EVENTS</span>
    </header>

    <div className="predictor-layout">
      <div className="prediction-panel">
        <div className="prediction-context">
          <span>FORECAST FOR</span>
          <strong>Level {run.level + 1}</strong>
          <small>{run.difficulty} · {Object.keys(run.enemies).filter(name => run.enemies[name] > 0).length} enemy types</small>
        </div>
        <div className="prediction-list">
          {candidates.map((item, index) => <article key={item.name} className={index === 0 ? "top-prediction" : ""}>
            <b>{index + 1}</b>
            <span><strong>{item.name}</strong><small>{item.sightings ? `${item.sightings} recorded sighting${item.sightings === 1 ? "" : "s"}` : "No personal sightings yet"}</small></span>
            <em>{item.chance}%</em>
          </article>)}
        </div>
        <p className="prediction-disclaimer">These are learned estimates, not official odds. Early predictions are intentionally marked low confidence.</p>
      </div>

      <div className="event-recorder">
        <span className="recorder-kicker">WHAT JUST APPEARED?</span>
        <label>
          <span>PROGRESSION EVENT</span>
          <input list="progression-event-names" value={eventName} onChange={event => setEventName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addRecord(); }} placeholder="Choose or type an event"/>
          <datalist id="progression-event-names">{[...new Set([...observedEvents, ...records.map(item => item.name)])].map(name => <option value={name} key={name}/>)}</datalist>
        </label>
        <label>
          <span>LEVEL SEEN</span>
          <input type="number" min={1} value={recordLevel} onChange={event => setRecordLevel(Math.max(1, Number(event.target.value) || 1))}/>
        </label>
        <button className="record-event" onClick={addRecord} disabled={!normalizeName(eventName)}>Record event <b>＋</b></button>
        <div className="recorder-actions">
          <button onClick={undo} disabled={!records.length}>Undo last</button>
          <button onClick={clear} disabled={!records.length}>Clear data</button>
        </div>
        {records.length > 0 && <div className="recent-events">
          <small>RECENT</small>
          {[...records].reverse().slice(0, 4).map(item => <span key={item.id}><b>LVL {item.level}</b>{item.name}</span>)}
        </div>}
      </div>
    </div>
  </section>;
}
