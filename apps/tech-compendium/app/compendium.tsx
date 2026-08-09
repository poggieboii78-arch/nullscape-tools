"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompendiumBlock, CompendiumData, CompendiumTechItem } from "./types";
import { isCompendiumTech, starterCompendium } from "./types";

function safeMediaUrl(value: string) {
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  if (value.startsWith("/api/media?key=")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

function Icon({ value, fallback, className = "" }: { value: string; fallback: string; className?: string }) {
  const src = safeMediaUrl(value);
  return src ? <img className={className} src={src} alt="" /> : <>{value || fallback}</>;
}

const inlineIconFile: Record<string, string> = { "Drowned Aegis": "DrownedÆgis.png" };
const inlineIconUrl = (name: string) => `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(inlineIconFile[name] ?? name.replace(/[\s:'’]/g, "") + ".png")}`;
function RichText({ children }: { children: string }) {
  const parts = children.split(/(\[\[icon:[^\]]+\]\])/g);
  return <>{parts.map((part, index) => {
    const match = part.match(/^\[\[icon:(.+)\]\]$/);
    return match ? <img className="inline-emoji" src={inlineIconUrl(match[1])} alt={match[1]} title={match[1]} key={`${part}-${index}`} /> : <span key={index}>{part}</span>;
  })}</>;
}

function videoSource(value: string) {
  const safe = safeMediaUrl(value);
  if (!safe) return { kind: "none", src: "" };
  const url = new URL(safe);
  if (url.hostname.includes("youtube.com")) {
    const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
    return { kind: "embed", src: id ? `https://www.youtube-nocookie.com/embed/${id}` : "" };
  }
  if (url.hostname === "youtu.be") return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}` };
  return { kind: "video", src: safe };
}

function VideoMedia({ url, title }: { url: string; title: string }) {
  const source = videoSource(url);
  if (!source.src) return null;
  return source.kind === "embed"
    ? <iframe src={source.src} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    : <video src={source.src} controls preload="metadata" />;
}

function Keycap({ label, active }: { label: string; active: boolean }) {
  const mouse = /^(m1|lmb|mouse1)$/i.test(label) ? "◖" : /^(m2|rmb|mouse2)$/i.test(label) ? "◗" : "";
  const text = mouse ? label.toUpperCase().replace("MOUSE", "M") : label;
  return <kbd className={`null-key ${active ? "active" : ""} ${mouse ? "mouse-key" : ""}`}>{mouse && <span>{mouse}</span>}{text}</kbd>;
}

type TimedInput = { keys: string[]; at: number };

const millisecondDelayPattern = /\(?\s*\d+(?:\.\d+)?\s*ms(?:\s+delay)?\s*\)?/i;
const hasMillisecondDelay = (value: string) => millisecondDelayPattern.test(value);

function parseTimedStep(value: string): TimedInput[] {
  const cleaned = value.replace(/\s*>\s*/g, " ").trim();
  const delayPattern = /\(?\s*(\d+(?:\.\d+)?)\s*ms(?:\s+delay)?\s*\)?/gi;
  const actions: TimedInput[] = [];
  let at = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const addKeys = (text: string) => {
    const keys = text.trim().replace(/^[→>\-\s]+|[→>\-\s]+$/g, "").split("+").map((key) => key.trim()).filter(Boolean);
    if (keys.length && !/^wait$/i.test(keys[0])) actions.push({ keys, at });
  };
  while ((match = delayPattern.exec(cleaned))) {
    addKeys(cleaned.slice(cursor, match.index));
    at += Math.max(0, Math.min(10000, Number(match[1])));
    cursor = match.index + match[0].length;
  }
  addKeys(cleaned.slice(cursor));
  return actions;
}

function InputMetronome({ block }: { block: CompendiumBlock }) {
  const steps = useMemo(() => block.content.split("\n").map((line) => line.trim()).filter(Boolean), [block.content]);
  const bpm = Math.max(20, Math.min(300, block.bpm ?? 90));
  const countIn = block.countIn ?? 4;
  const preciseTiming = steps.some(hasMillisecondDelay);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-countIn);
  const [currentKeys, setCurrentKeys] = useState<string[]>([]);
  const audio = useRef<AudioContext | null>(null);

  function click(accent = false) {
    const context = audio.current ?? new AudioContext(); audio.current = context;
    const osc = context.createOscillator(); const gain = context.createGain();
    osc.frequency.value = accent ? 1040 : 760; gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + .006); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .065);
    osc.connect(gain); gain.connect(context.destination); osc.start(); osc.stop(context.currentTime + .07);
  }

  useEffect(() => {
    if (!running || !steps.length) return;
    const beatLength = 60000 / bpm;
    const actions = beat >= 0 ? parseTimedStep(steps[beat] ?? "") : [];
    const finalActionAt = actions.at(-1)?.at ?? 0;
    const delay = beat < 0
      ? (preciseTiming ? 600 : beatLength)
      : preciseTiming
        ? Math.max(650, finalActionAt + 500)
        : beatLength;
    const timer = window.setTimeout(() => setBeat((current) => {
      const next = current + 1;
      if (next >= steps.length) {
        if (!(block.loop ?? true)) { setRunning(false); return steps.length - 1; }
        click(true); return 0;
      }
      click(next === 0); return next;
    }), delay);
    return () => window.clearTimeout(timer);
  }, [running, beat, bpm, preciseTiming, steps, block.loop]);

  useEffect(() => {
    const actions = beat >= 0 && steps[beat] ? parseTimedStep(steps[beat]) : [];
    const visibleActions = actions.length ? actions : [{ keys: [], at: 0 }];
    const timers = visibleActions.map((action, index) => window.setTimeout(() => {
      setCurrentKeys(action.keys);
      if (running && index > 0) click(false);
    }, action.at));
    return () => timers.forEach(window.clearTimeout);
  }, [beat, running, steps]);

  function toggle() {
    if (running) { setRunning(false); return; }
    setBeat(-countIn); click(true); setRunning(true);
  }

  const current = beat < 0 ? [`Count in ${Math.abs(beat)}`] : currentKeys.length ? currentKeys : ["Wait"];
  return <section className="metronome-card">
    <div className="metro-head"><div><small>INPUT TRAINER</small><h3>{block.caption || "Practice this sequence"}</h3></div><div className={`tempo ${preciseTiming ? "precise" : ""}`}><b>{preciseTiming ? "EXACT" : bpm}</b><span>{preciseTiming ? "MS TIMING" : "BPM"}</span></div></div>
    <div className="metro-stage">
      <div className={`pulse-ring ${running ? "running" : ""}`} key={`${beat}-${running}`}><span>{beat < 0 ? Math.abs(beat) : beat + 1}</span></div>
      <div className="current-input"><small>{beat < 0 ? "GET READY" : "CURRENT INPUT"}</small><div>{current.map((key, index) => <Keycap key={`${key}-${index}`} label={key} active={running} />)}</div></div>
    </div>
    <div className="sequence-strip">{steps.map((step, index) => <button type="button" key={`${block.id}-${index}`} className={beat === index ? "active" : ""} onClick={() => { setBeat(index); setRunning(false); }}><span>{index + 1}</span><div className="timed-preview">{parseTimedStep(step).length ? parseTimedStep(step).map((action, actionIndex) => <span className="timed-action" key={actionIndex}>{actionIndex > 0 && <em>{action.at - parseTimedStep(step)[actionIndex - 1].at}ms</em>}{action.keys.map((key, keyIndex) => <Keycap key={`${key}-${keyIndex}`} label={key} active={beat === index && action.keys.includes(currentKeys[0])} />)}</span>) : <Keycap label="Wait" active={beat === index} />}</div></button>)}</div>
    <div className="metro-controls"><button className={running ? "stop" : "play"} onClick={toggle}>{running ? "Stop" : "▶ Start practice"}</button><button onClick={() => { setRunning(false); setBeat(-countIn); }}>Reset</button><span>{preciseTiming ? "Explicit ms timing · " : ""}{countIn ? `${countIn}-beat countdown` : "No countdown"}{block.loop ?? true ? " · loops" : " · one pass"}</span></div>
  </section>;
}

function Block({ block }: { block: CompendiumBlock }) {
  if (block.type === "heading") return <h2 className="article-heading"><RichText>{block.content}</RichText></h2>;
  if (block.type === "paragraph") return <p className="article-copy"><RichText>{block.content}</RichText></p>;
  if (block.type === "callout") return <aside className="callout"><span>✦</span><p><RichText>{block.content}</RichText></p></aside>;
  if (block.type === "steps") {
    const steps = block.content.split("\n").map((step) => step.trim()).filter(Boolean);
    return <ol className="steps">{steps.map((step, index) => <li key={`${block.id}-${index}`}><b>{index + 1}</b><span><RichText>{step}</RichText></span></li>)}</ol>;
  }
  if (block.type === "image") {
    const src = safeMediaUrl(block.url);
    return src ? <figure className="media-card"><img src={src} alt={block.caption || "Tech example"} /><figcaption>{block.caption}</figcaption></figure> : null;
  }
  if (block.type === "video") {
    const source = videoSource(block.url);
    if (!source.src) return null;
    return <figure className="media-card video-card">{source.kind === "embed" ? <iframe src={source.src} title={block.caption || "Tech video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video src={source.src} controls preload="metadata" />}<figcaption>{block.caption}</figcaption></figure>;
  }
  if (block.type === "video-comparison") {
    const left = videoSource(block.url);
    const right = videoSource(block.secondaryUrl ?? "");
    if (!left.src && !right.src) return null;
    return <section className="video-comparison-card">
      {block.content && <h3>{block.content}</h3>}
      <div className="video-comparison-grid">
        {left.src && <figure><span>{block.caption || "Left"}</span><VideoMedia url={block.url} title={block.caption || "Left comparison video"} /></figure>}
        {right.src && <figure><span>{block.secondaryCaption || "Right"}</span><VideoMedia url={block.secondaryUrl ?? ""} title={block.secondaryCaption || "Right comparison video"} /></figure>}
      </div>
    </section>;
  }
  if (block.type === "metronome") return <InputMetronome block={block} />;
  return null;
}

function publishedTechItems(items: CompendiumTechItem[]) {
  const result: CompendiumTechItem[] = [];
  let pendingSeparator: CompendiumTechItem | undefined;
  for (const item of items) {
    if (!isCompendiumTech(item)) {
      pendingSeparator = item.title.trim() ? item : undefined;
      continue;
    }
    if (!item.published) continue;
    if (pendingSeparator) result.push(pendingSeparator);
    pendingSeparator = undefined;
    result.push(item);
  }
  return result;
}

function publicCompendium(source: CompendiumData): CompendiumData {
  return {
    ...source,
    classes: source.classes
      .filter((item) => item.published)
      .map((item) => ({ ...item, techs: publishedTechItems(item.techs) })),
  };
}

const firstTech = (items: CompendiumTechItem[] | undefined) => items?.find(isCompendiumTech);

export default function Compendium() {
  const publicData = useMemo<CompendiumData>(() => publicCompendium(starterCompendium), []);
  const staticCompendium = process.env.NEXT_PUBLIC_STATIC_COMPENDIUM === "true";
  const [data, setData] = useState<CompendiumData>(publicData);
  const [classId, setClassId] = useState(publicData.classes[0]?.id ?? "");
  const [techId, setTechId] = useState(firstTech(publicData.classes[0]?.techs)?.id ?? "");
  const [loading, setLoading] = useState(!staticCompendium);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (staticCompendium) return;
    fetch("/api/compendium", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((next: CompendiumData) => {
        const published = publicCompendium(next);
        setData(published);
        const firstClass = published.classes[0];
        setClassId(firstClass?.id ?? "");
        setTechId(firstTech(firstClass?.techs)?.id ?? "");
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [staticCompendium]);

  const activeClass = useMemo(() => data.classes.find((item) => item.id === classId) ?? data.classes[0], [data, classId]);
  const selectedItem = activeClass?.techs.find((item) => item.id === techId);
  const activeTech = selectedItem && isCompendiumTech(selectedItem) ? selectedItem : firstTech(activeClass?.techs);

  function chooseClass(nextId: string) {
    const next = data.classes.find((item) => item.id === nextId);
    setClassId(nextId);
    setTechId(firstTech(next?.techs)?.id ?? "");
    setMenuOpen(false);
  }

  return (
    <main className="site-shell" style={{ "--active-accent": activeClass?.accent ?? "#7770ff" } as React.CSSProperties}>
      <header className="topbar">
        <a className="brand" href="/nullscape-tools/" aria-label="Nullscape Tools home"><span className="brand-mark">N</span><span><b>Tech Compendium</b><small>Nullscape class knowledge</small></span></a>
        <nav className="class-tabs" aria-label="Classes">
          {data.classes.map((item) => <button key={item.id} className={item.id === activeClass?.id ? "active" : ""} onClick={() => chooseClass(item.id)}><span><Icon value={item.icon} fallback="✦" /></span>{item.name}</button>)}
        </nav>
        <button className="mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>Techs <span>⌄</span></button>
      </header>

      <div className="workspace">
        <aside className={`tech-rail ${menuOpen ? "open" : ""}`}>
          <div className="rail-heading"><span className="class-orb"><Icon value={activeClass?.icon ?? ""} fallback="✦" /></span><div><p>{activeClass?.name ?? "No class"}</p><small>{activeClass?.description || "Choose a class above"}</small></div></div>
          <div className="tech-list">
            {activeClass?.techs.map((item, index, items) => !isCompendiumTech(item)
              ? <div className="tech-separator" key={item.id}><span>{item.title}</span></div>
              : <button key={item.id} className={item.id === activeTech?.id ? "active" : ""} onClick={() => { setTechId(item.id); setMenuOpen(false); }}><span className="tech-number"><Icon value={item.icon} fallback={String(items.slice(0, index + 1).filter(isCompendiumTech).length).padStart(2, "0")} /></span><span><b>{item.title}</b><small>{item.summary}</small></span><i>›</i></button>)}
            {!activeClass?.techs.some(isCompendiumTech) && <p className="rail-empty">No techs published for this class yet.</p>}
          </div>
        </aside>

        <article className="article-panel">
          {loading && <div className="loading-pill">Syncing compendium…</div>}
          <div className="article-card">
            {activeTech ? <>
              <header className="article-hero">
                <div className="article-kicker"><span><Icon value={activeTech.icon || activeClass?.icon || ""} fallback="✦" /></span>{activeClass?.name} tech</div>
                <h1>{activeTech.title}</h1>
                <p className="article-summary"><RichText>{activeTech.summary}</RichText></p>
                <div className="article-rule" />
              </header>
              <div className="article-content">{activeTech.blocks.map((block) => <Block block={block} key={block.id} />)}</div>
            </> : <div className="empty-article"><span>✦</span><h1>Nothing here yet</h1><p>Add a tech in the private editor and it will appear here.</p></div>}
          </div>
        </article>
      </div>
    </main>
  );
}
