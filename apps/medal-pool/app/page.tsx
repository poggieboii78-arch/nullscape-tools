"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildRunQuery, RunDock, ToolRunFields, useSharedRun, type Difficulty } from "./run-dock";

type Enemy = {
  id: string;
  name: string;
  image: string;
  minLevel: number;
};

type Curse = {
  id: string;
  name: string;
  image: string;
  minLevel: number;
  value: number;
  requires?: string[];
  maxStack?: number;
  note: string;
};

type RunSnapshot = {
  level: number;
  difficulty: Difficulty;
  owned: Record<string, number>;
};

const storageKey = "nullscape-medal-state-v2";
const homeUrl = "/nullscape-tools/";

function hasGreaterCurseShop(level:number,difficulty:Difficulty){
  if(difficulty==="casual")return level===15||(level>=25&&level%5===0);
  if(difficulty==="standard")return level===10||(level>=20&&level%5===0);
  return level>=10&&level%5===0;
}
function isMedalCurseChoiceLevel(level:number,difficulty:Difficulty){return level>=6&&level%2===0&&!hasGreaterCurseShop(level,difficulty);}
function nextMedalCurseChoice(from:number,difficulty:Difficulty,inclusive=false){let candidate=Math.max(6,inclusive?from:from+1);while(!isMedalCurseChoiceLevel(candidate,difficulty))candidate+=1;return candidate;}
function nextMedalSpawnLevel(from:number,difficulty:Difficulty){
  const candidate=Math.max(5,from);
  if(difficulty==="casual")return candidate;
  return candidate%2===1?candidate:candidate+1;
}

const wikiImage = (name: string) =>
  `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;

const enemies: Enemy[] = [
  { id: "Bell", name: "Bell", image: "Bell.png", minLevel: 1 },
  { id: "Baby", name: "Baby", image: "Baby.png", minLevel: 1 },
  { id: "Husk", name: "Husk", image: "Husk.png", minLevel: 1 },
  { id: "ICBM", name: "ICBM", image: "ICBM.png", minLevel: 1 },
  { id: "Mart", name: "Mart", image: "Mart.png", minLevel: 1 },
  { id: "Springer", name: "Springer", image: "Springer.png", minLevel: 1 },
  { id: "Flesh", name: "Flesh", image: "Flesh.png", minLevel: 5 },
  { id: "Guardian", name: "Guardian", image: "Guardian.png", minLevel: 8 },
  { id: "Telefragger", name: "Telefragger", image: "Telefragger.png", minLevel: 8 },
  { id: "Kolona", name: "Kolóna", image: "Kolóna.png", minLevel: 10 },
  { id: "Cadence", name: "Cadence", image: "Cadence.png", minLevel: 15 },
  { id: "Voidbreaker", name: "Voidbreaker", image: "Voidbreaker.png", minLevel: 15 },
];

const medalCurses: Curse[] = [
  { id: "BiggerTripmines", name: "Bigger Tripmines", image: "BiggerTripmines.png", minLevel: 5, value: 200, note: "Tripmines become larger." },
  { id: "MoreTripmines", name: "More Tripmines", image: "MoreTripmines.png", minLevel: 5, value: 150, maxStack: 2, note: "Doubles Tripmines; can stack twice." },
  { id: "LAP2", name: "LAP 2", image: "LAP2.png", minLevel: 8, value: 400, note: "+25% Gold Gift yield and slower collapse; beacon needs 40%." },
  { id: "Nothing", name: "Nothing?", image: "Nothing?.png", minLevel: 8, value: 325, note: "Shops are 15% cheaper; adds temporary enemies over time." },
  { id: "Barotrauma", name: "Barotrauma", image: "Barotrauma.png", minLevel: 15, value: 125, note: "Larger Seamines with stronger knockback." },
  { id: "BeaconMirage", name: "Beacon Mirage", image: "BeaconMirage.png", minLevel: 25, value: 300, note: "The beacon moves and fake beacons appear." },
  { id: "MightyGong", name: "Mighty Gong", image: "MightyGong.png", minLevel: 1, value: 150, requires: ["Bell"], note: "Bell grows and creates shockwaves when teleporting." },
  { id: "Concussion", name: "Concussion", image: "Concussion.png", minLevel: 1, value: 200, requires: ["Bell"], note: "Ringing Bell disables jumping for 7 seconds." },
  { id: "MartSlide", name: "Mart Slide", image: "MartSlide.png", minLevel: 8, value: 330, requires: ["Mart"], note: "Mart builds huge momentum and knocks players away." },
  { id: "Pacifier", name: "Pacifier", image: "Pacifier.png", minLevel: 1, value: 230, requires: ["Baby"], note: "Baby cues become quieter and harder to see." },
  { id: "ProblemChild", name: "Problem Child", image: "ProblemChild.png", minLevel: 5, value: 150, requires: ["Baby"], note: "Baby can feint and reroute its dash." },
  { id: "ScorchedEarth", name: "Scorched Earth", image: "ScorchedEarth.png", minLevel: 1, value: 150, requires: ["ICBM"], note: "ICBM explosions leave pools of fire." },
  { id: "BiggerBlast", name: "Bigger Blast", image: "BiggerBlast.png", minLevel: 5, value: 200, maxStack: 2, requires: ["ICBM"], note: "Increases ICBM blast radius; can stack twice." },
  { id: "HuskExpress", name: "Husk Express", image: "HuskExpress.png", minLevel: 5, value: 200, requires: ["Husk"], note: "You can no longer pass between Husks." },
  { id: "CongaLine", name: "Conga Line", image: "CongaLine.png", minLevel: 8, value: 200, requires: ["Husk"], note: "Triples the number of Husks." },
  { id: "Springloaded", name: "Springloaded", image: "Springloaded.png", minLevel: 5, value: 200, requires: ["Springer"], note: "Springer makes extra and larger shockwaves." },
  { id: "BloodierMeat", name: "Bloodier Meat", image: "BloodierMeat.png", minLevel: 5, value: 300, requires: ["Flesh"], note: "Flesh infects tiles from much farther away." },
  { id: "Shotgun", name: "Shotgun", image: "Shotgun.png", minLevel: 5, value: 200, requires: ["Guardian"], note: "Guardian fires spreads of bullets." },
  { id: "AccurateTelefragger", name: "Accurate Telefragger", image: "AccurateTelefragger.png", minLevel: 1, value: 150, requires: ["Telefragger"], note: "Telefragger can predict vertical movement." },
  { id: "BurningBouquet", name: "Burning Bouquet", image: "BurningBouquet.png", minLevel: 1, value: 250, requires: ["Kolona", "Razorbloom"], note: "Kolóna attracts Razorbloom when it appears." },
  { id: "BladeCarousel", name: "Blade Carousel", image: "BladeCarousel.png", minLevel: 5, value: 290, requires: ["Voidbreaker"], note: "Voidbreaker's swords spin around players before firing." },
  { id: "DeadlyMelody", name: "Deadly Melody", image: "DeadlyMelody.png", minLevel: 1, value: 280, requires: ["Cadence"], note: "Cadence spawns an instrument when a player dies." },
];

function requirementName(id: string) {
  if (id === "Kolona") return "Kolóna";
  return enemies.find((enemy) => enemy.id === id)?.name ?? id;
}

function GoldenGiftIcon({ className = "gift-icon", size = 17 }: { className?: string; size?: number }) {
  return <img src={wikiImage("GoldGiftIcon.png")} alt="Golden Gifts" className={className} style={{ width: size, height: size, maxWidth: size }} />;
}

function CurseCard({ curse, lockedReason, onPick, estimatedPrize }: { curse: Curse; lockedReason?: string; onPick?: () => void; estimatedPrize?: number }) {
  const contents = (
    <>
      <div className="curse-icon-wrap">
        <img src={wikiImage(curse.image)} alt="" className="curse-icon" />
      </div>
      <div className="curse-copy">
        <div className="curse-title-row">
          <h3>{curse.name}</h3>
          {estimatedPrize !== undefined && (
            <span className="value-pill" title={`Rough projected Medal payout after this pick; exact equation is unpublished`} aria-label={`Rough projected prize: ${estimatedPrize.toLocaleString()} Golden Gifts`}>
              <GoldenGiftIcon className="value-gift-icon" />
              <span>≈ {estimatedPrize.toLocaleString()}</span>
            </span>
          )}
        </div>
        <p>{curse.note}</p>
        {curse.requires && (
          <div className="requirements">
            {curse.requires.map((req) => (
              <span key={req}>{requirementName(req)}</span>
            ))}
          </div>
        )}
        {lockedReason && <div className="locked-reason">{lockedReason}</div>}
      </div>
      {onPick && <span className="pick-arrow">Pick →</span>}
    </>
  );

  if (onPick) {
    return <button className="curse-card pickable" onClick={onPick} aria-label={`Pick ${curse.name}`}>{contents}</button>;
  }
  return <article className={`curse-card ${lockedReason ? "locked" : ""}`}>{contents}</article>;
}

export default function Home() {
  const {run,update:updateRun,reset:resetShared,applyLinkedRun}=useSharedRun(storageKey);
  const {level,difficulty,players,medalCurses:owned}=run;
  const selectedEnemies=useMemo(()=>new Set(Object.keys(run.enemies).filter(name=>run.enemies[name]>0).map(name=>name==="Kolóna"?"Kolona":name)),[run.enemies]);
  const razorbloom=(run.greaterCurses.Razorbloom??0)>0;
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [autoNextPick, setAutoNextPick] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [history, setHistory] = useState<RunSnapshot[]>([]);
  const [ready, setReady] = useState(false);
  const quickLinkState=useMemo(()=>({showUpcoming,autoNextPick,lastAction,history}),[showUpcoming,autoNextPick,lastAction,history]);
  const applyQuickLinkState=useCallback((state:Record<string,unknown>)=>{if(typeof state.showUpcoming==="boolean")setShowUpcoming(state.showUpcoming);if(typeof state.autoNextPick==="boolean")setAutoNextPick(state.autoNextPick);if(typeof state.lastAction==="string"||state.lastAction===null)setLastAction(state.lastAction as string|null);if(Array.isArray(state.history)){const valid=state.history.filter((item):item is RunSnapshot=>{if(!item||typeof item!=="object")return false;const value=item as Partial<RunSnapshot>;return typeof value.level==="number"&&(value.difficulty==="casual"||value.difficulty==="standard"||value.difficulty==="extreme")&&!!value.owned&&typeof value.owned==="object";});setHistory(valid.slice(-100));}},[]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        if (typeof saved.showUpcoming === "boolean") setShowUpcoming(saved.showUpcoming);
        if (typeof saved.lastAction === "string" || saved.lastAction === null) setLastAction(saved.lastAction);
        if (Array.isArray(saved.history)) setHistory(saved.history);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(()=>{try{const saved=localStorage.getItem("nullscape-medal-auto-next");if(saved!==null)setAutoNextPick(saved!=="0");}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem("nullscape-medal-auto-next",autoNextPick?"1":"0");}catch{}},[autoNextPick]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify({
      showUpcoming, lastAction, history,
    }));
  }, [ready,showUpcoming,lastAction,history]);

  const homeHref = useMemo(() => {
    return homeUrl+"?"+buildRunQuery(run);
  }, [run]);

  const isMedalPickLevel = isMedalCurseChoiceLevel(level,difficulty);
  const poolLevel = isMedalPickLevel?level:nextMedalCurseChoice(level,difficulty,true);
  const nextMedalLevel = (from:number)=>nextMedalCurseChoice(from,difficulty);
  const nextPoolLevel=nextMedalLevel(poolLevel);
  const medalOpportunityLevel=nextMedalSpawnLevel(level,difficulty);
  const blockedReason=level<6
    ?"Medal Curse choices start at the Level 6 Curse shop."
    :hasGreaterCurseShop(level,difficulty)
      ?`Level ${level} has a Greater Curse shop, which replaces the regular Curse shop. A Medal still pays Gifts here, but it cannot offer a Medal Curse.`
      :`Level ${level} has no regular Curse shop. A Medal still pays Gifts, but its curse choice only appears during a regular Curse-shop intermission.`;

  // The game does not publish its exact Medal equation. Curse value is the documented
  // input, while √players is the same public economy scaling used by the community shop calculator.
  const estimatedPrize = (value: number) => Math.round(value * Math.sqrt(players));
  const activeCurseValue = medalCurses.reduce((sum,curse)=>sum+curse.value*(owned[curse.name]??0),0);

  const hasRequirement = useCallback((req: string) => {
    if (req === "Razorbloom") return razorbloom;
    return selectedEnemies.has(req);
  }, [razorbloom, selectedEnemies]);

  const { available, upcoming, missingEnemy } = useMemo(() => {
    const available: Curse[] = [];
    const upcoming: Curse[] = [];
    const missingEnemy: Curse[] = [];

    for (const curse of medalCurses) {
      const atMax = (owned[curse.name] ?? 0) >= (curse.maxStack ?? 1);
      if (atMax) continue;
      const requirementsMet = (curse.requires ?? []).every(hasRequirement)&&(curse.name!=="Husk Express"||(run.enemies.Husk??0)>=2);
      if (!requirementsMet) missingEnemy.push(curse);
      else if (poolLevel < curse.minLevel) upcoming.push(curse);
      else available.push(curse);
    }

    return { available, upcoming, missingEnemy };
  }, [poolLevel, owned, hasRequirement,run.enemies]);

  const advanceRun = (picked?: Curse) => {
    const nextLevel = picked&&!autoNextPick?level:nextMedalLevel(poolLevel);
    setHistory((current) => [...current, { level, difficulty, owned: { ...owned } }]);
    if (picked) {
      updateRun(current=>({level:nextLevel,medalCurses:{...current.medalCurses,[picked.name]:Math.min(picked.maxStack??1,(current.medalCurses[picked.name]??0)+1)}}));
      setLastAction(autoNextPick?`${picked.name} added · advanced to Level ${nextLevel}`:`${picked.name} added · staying on Level ${level}`);
    } else {
      updateRun({level:nextLevel});
      setLastAction(`Curse pick skipped · advanced to Level ${nextLevel}`);
    }
    requestAnimationFrame(() => document.getElementById("results-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const goPrevious = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    updateRun({level:previous.level,difficulty:previous.difficulty,medalCurses:previous.owned});
    setLastAction(`Last pick undone · returned to Level ${previous.level}`);
  };

  const reset = () => {
    resetShared();
    setLastAction(null);
    setHistory([]);
  };

  return (
    <main>
      <header className="topbar">
        <a href={homeHref} className="tools-back">← Tools</a>
        <a className="brand" href={homeHref} aria-label="Back to Nullscape Tools">
          <span className="brand-mark"><img src={wikiImage("Medal.png")} alt="" /></span>
          <span>MEDAL POOL CHECKER</span>
        </a>
        <span className="header-run-summary">LVL {level} · {players}P · {difficulty.toUpperCase()}</span>
      </header>

      <ToolRunFields run={run} update={updateRun}/>

      <div className="page-shell" id="top">
        <section className="results" aria-labelledby="results-heading">
          <div className="section-heading results-heading">
            <div><h2 id="results-heading">Level {poolLevel} Medal Pool</h2></div>
            <span className="result-total">{available.length} in pool</span>
          </div>

          <div className="run-progress" data-tour="medal-progress">
            <div className="level-track" data-tour="medal-level-bubbles">
              <div className="level-orb"><small>{isMedalPickLevel?"NOW":"PICK"}</small><strong>{poolLevel}</strong></div>
              <div className="progress-line"><span /></div>
              <div className="level-orb medal-opportunity"><small>MEDAL</small><strong>{medalOpportunityLevel}</strong></div>
              <div className="progress-line"><span /></div>
              <div className="level-orb next"><small>NEXT PICK</small><strong>{nextPoolLevel}</strong></div>
            </div>
            <div className="progress-copy">
              <strong>Regular Curse shops only</strong>
              <span>Even levels; Greater Curse shops can replace them</span>
            </div>
            <button className="previous-medal" onClick={goPrevious} disabled={history.length === 0} aria-label="Undo the previous Medal pick">
              <span>{history.length === 0 ? "Nothing to undo" : "Misclicked?"}</span><strong>← Previous</strong>
            </button>
            <button className="missed-medal" onClick={() => advanceRun()} aria-label="Missed Medal, advance without adding a curse">
              <span>Missed it?</span><strong>Skip →</strong>
            </button>
            <label className="auto-medal-toggle"><input type="checkbox" checked={autoNextPick} onChange={event=>setAutoNextPick(event.target.checked)}/><span><strong>Auto-next pick</strong><small>After choosing a Medal Curse</small></span></label>
          </div>
          {!isMedalPickLevel&&<div className="schedule-warning"><strong>No Medal Curse choice at Level {level}</strong><span>{blockedReason} Showing the next possible pool at Level {poolLevel}.</span></div>}
          <p className="estimate-note">Card estimates project all active Medal Curse value plus that pick, scaled by √players. The wiki confirms that player count and Medal Curses affect payout but does not publish the equation, so this is an unverified scale—not a guaranteed total.</p>
          <details className="medal-quirks"><summary><strong>Medal quirks</strong><span>＋</span></summary><p>Picking a Medal Curse disables rerolls. Carrying the Medal disables abilities; Wanted gets two jumps while Prisoner gets none. If the carrier dies, that Medal cannot be recovered again.</p></details>

          {lastAction && <div className="action-toast"><span>✓</span>{lastAction}</div>}

          <div className={`pool-status ${available.length < 3 ? "warning" : "ready"}`} data-tour="medal-pool">
            <span className="status-dot" />
            <div>
              <strong>{available.length < 3 ? "Fallback curses can appear" : "Full difficult-curse selection available"}</strong>
              <p>{available.length < 3 ? `Only ${available.length} difficult Medal Curse${available.length === 1 ? " is" : "s are"} eligible. The game can fill open choice slots from your normal curse pool; those fallback choices keep their normal Curse payout and Purification value.` : "The Medal has at least three eligible difficult curses, so its choices can be drawn from the pool below."}</p>
            </div>
          </div>

          {available.length > 0 ? (
            <div className="curse-grid" data-tour="eligible-cards">
              {available.map((curse) => <CurseCard key={curse.id} curse={curse} estimatedPrize={estimatedPrize(activeCurseValue+curse.value)} onPick={() => advanceRun(curse)} />)}
            </div>
          ) : (
            <div className="empty-state" data-tour="eligible-cards">
              <span>∅</span>
              <h3>No difficult Medal Curses are eligible</h3>
              <p>Add permanent enemies, raise the level, or remove a curse from “already active.”</p>
            </div>
          )}

          <button className="upcoming-toggle" onClick={() => setShowUpcoming((value) => !value)} aria-expanded={showUpcoming}>
            <span><strong>Locked by level</strong><small>{upcoming.length} curse{upcoming.length === 1 ? "" : "s"} match your enemies but unlock later</small></span>
            <span>{showUpcoming ? "−" : "+"}</span>
          </button>
          {showUpcoming && upcoming.length > 0 && (
            <div className="curse-grid upcoming-grid">
              {upcoming.map((curse) => <CurseCard key={curse.id} curse={curse} estimatedPrize={estimatedPrize(activeCurseValue+curse.value)} lockedReason={`Unlocks at level ${curse.minLevel}`} />)}
            </div>
          )}

          <details className="missing-panel">
            <summary>
              <span><strong>Unavailable with these enemies</strong><small>{missingEnemy.length} other Medal Curses</small></span>
              <span className="chevron">⌄</span>
            </summary>
            <div className="curse-grid missing-grid">
              {missingEnemy.map((curse) => {
                const missingParts=(curse.requires ?? []).filter((req) => !hasRequirement(req)).map(requirementName);if(curse.name==="Husk Express"&&(run.enemies.Husk??0)<2)missingParts.push("2 × Husk");const missing=missingParts.join(" + ");
                return <CurseCard key={curse.id} curse={curse} estimatedPrize={estimatedPrize(activeCurseValue+curse.value)} lockedReason={`Needs ${missing}`} />;
              })}
            </div>
          </details>
        </section>

        <footer>
          <p>Settings save on this device • Data checked against the Official Nullscape Wiki <span className="llm-disclaimer">Made with help from an LLM.</span></p>
          <a href="https://nullscape.wiki/wiki/Medal" target="_blank" rel="noreferrer">Medal mechanics ↗</a>
        </footer>
      </div>
      <RunDock run={run} update={updateRun} reset={reset} applyLinkedRun={applyLinkedRun} toolId="medal" quickLinkState={quickLinkState} applyQuickLinkState={applyQuickLinkState} toolSteps={[
        {selector:"[data-tour='medal-progress']",title:"A Medal is not the same as a Medal Curse",text:"Collecting a Medal always gives Gifts. You only get an extra Medal Curse choice if the later intermission has a normal Curse shop. A Greater Curse shop can replace it."},
        {selector:"[data-tour='medal-level-bubbles']",title:"Follow the three bubbles",text:"Left: the Medal pool being checked. Middle: the level where you can collect the Medal. Right: the later intermission where its Medal Curse choice can appear."},
        {selector:"[data-tour='medal-pool']",title:"Some choices can be regular Curses",text:"The game tries to offer three choices. If fewer than three difficult Medal Curses are possible, regular Curses may fill the empty spaces. Those still work and pay like normal Curses."},
        {selector:"[data-tour='eligible-cards']",title:"See which Medal Curses are possible",text:"These cards use the run information in your Quick Menu. Click the Curse you picked to record it and move to the next possible Medal pick."}
      ]}/>
    </main>
  );
}
