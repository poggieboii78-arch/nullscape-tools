"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlockType, CompendiumBlock, CompendiumClass, CompendiumData, CompendiumTech, CompendiumTechItem, CompendiumTechSeparator } from "./types";
import { isCompendiumTech, starterCompendium } from "./types";

const blockNames: Record<BlockType, string> = { heading: "Heading", paragraph: "Paragraph", steps: "Numbered steps", callout: "Callout", video: "Video", image: "Image", metronome: "Input metronome" };
const blockTypes = Object.keys(blockNames) as BlockType[];
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled";
const draftKey = "nullscape-compendium-editor-draft-v1";
const firstTechId = (items: CompendiumTechItem[] | undefined) => items?.find(isCompendiumTech)?.id ?? "";
const techCount = (items: CompendiumTechItem[]) => items.filter(isCompendiumTech).length;
const hasMillisecondDelay = (value: string) => /\(?\s*\d+(?:\.\d+)?\s*ms(?:\s+delay)?\s*\)?/i.test(value);

const classIcons = ["Charger", "Diver", "Spirit", "Grappler", "Glider", "Prisoner", "Wanted", "Bruiser", "phoon"];
const upgradeIcons = [
  "Adrenaline", "Business License", "Paycheck", "Swiftness Ring", "Better Jump Pads", "Defuse Kit", "Double Jump", "Grapple Points", "Last Robloxian Standing", "Medal", "Radar", "Tria Orbs", "Advanced Gravity Coil", "Fanny Pack", "Grace Wings", "Helmet", "Ice Skates", "Pocket Bell", "Radar Module: Altars", "Radar Module: Enemies", "Radar Module: Players", "Radar Module: Tripmines", "More Altars", "Larger Grapple Points", "Ninja Belt", "Subspacial Barrier", "Gift Magnet", "Matrix Tetrahedron", "Radar Module: Instruments", "Shark Tail", "Shield", "Sport Shoes", "Panic Necklace", "Drowned Aegis", "Gift Idol", "Miniature Hourglass",
];
const iconFile: Record<string, string> = { "Drowned Aegis": "DrownedÆgis.png" };
const wikiIcon = (name: string) => `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(iconFile[name] ?? name.replace(/[\s:'’]/g, "") + ".png")}`;
const iconToken = (name: string) => `[[icon:${name}]]`;

function IconEmojiPicker({ onCopied }: { onCopied: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const groups = [{ name: "Classes", items: classIcons }, { name: "Upgrades", items: upgradeIcons }];
  async function copy(name: string) {
    const token = iconToken(name);
    try { await navigator.clipboard.writeText(token); onCopied(`${name} icon copied — paste it into any text field`); }
    catch { onCopied(`Use this in a text field: ${token}`); }
  }
  return <details className="emoji-library" open>
    <summary><span>✦</span><div><b>Icon library — all classes & upgrades</b><small>Click an icon to copy it, then paste it into any heading, paragraph, callout, step, or summary.</small></div><i>＋</i></summary>
    <div className="emoji-library-body">
      <label className="emoji-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a class or upgrade…" /></label>
      {groups.map((group) => {
        const items = group.items.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
        return items.length ? <section key={group.name}><h3>{group.name} <small>{items.length}</small></h3><div className="emoji-grid">{items.map((name) => <button type="button" key={name} title={`Copy ${name} emoji`} onClick={() => copy(name)}><img src={wikiIcon(name)} alt="" /><span>{name}</span></button>)}</div></section> : null;
      })}
    </div>
  </details>;
}

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch {
    throw new Error(response.ok
      ? "The server returned an unreadable response. Please try again."
      : `The server could not finish that request (${response.status}). Please try again.`);
  }
}

async function makeIconDataUrl(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5 MB.");
  const bitmap = await createImageBitmap(file);
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare that image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.9);
}

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}

export default function Editor() {
  const [data, setData] = useState<CompendiumData>(starterCompendium);
  const [classId, setClassId] = useState(starterCompendium.classes[0]?.id ?? "");
  const [techId, setTechId] = useState(firstTechId(starterCompendium.classes[0]?.techs));
  const [status, setStatus] = useState<"loading" | "saved" | "dirty" | "saving" | "error">("loading");
  const [message, setMessage] = useState("Loading your compendium…");
  const [connected, setConnected] = useState(false);
  const [classPanel, setClassPanel] = useState(true);
  const [uploading, setUploading] = useState<"class" | "tech" | "">("");
  const [uploadingVideo, setUploadingVideo] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    fetch("/api/editor", { cache: "no-store" }).then(readJson).then((payload) => {
      let next = payload.data as CompendiumData;
      let recovered = false;
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) { next = JSON.parse(stored) as CompendiumData; recovered = true; }
      } catch { localStorage.removeItem(draftKey); }
      setData(next); setConnected(Boolean(payload.connected)); setVersion(payload.version ?? "");
      setClassId(next.classes[0]?.id ?? ""); setTechId(firstTechId(next.classes[0]?.techs));
      setStatus(recovered ? "dirty" : payload.connected ? "saved" : "error");
      setMessage(recovered ? "Recovered your autosaved draft" : payload.connected ? "Everything is saved" : "Publishing connection unavailable");
      setLoaded(true);
    }).catch(() => {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) {
          const next = JSON.parse(stored) as CompendiumData;
          setData(next); setClassId(next.classes[0]?.id ?? ""); setTechId(firstTechId(next.classes[0]?.techs));
          setStatus("dirty"); setMessage("Recovered your autosaved draft"); setLoaded(true); return;
        }
      } catch { localStorage.removeItem(draftKey); }
      setStatus("error"); setMessage("Couldn’t load the compendium"); setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || status === "saved" || status === "loading") return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(data)); }
      catch { setMessage("Draft changed, but this browser could not autosave it"); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [data, loaded, status]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "error") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const activeClass = useMemo(() => data.classes.find((item) => item.id === classId), [data, classId]);
  const activeItem = activeClass?.techs.find((item) => item.id === techId);
  const activeTech = activeItem && isCompendiumTech(activeItem) ? activeItem : undefined;
  const activeSeparator = activeItem?.kind === "separator" ? activeItem : undefined;
  const dirty = (next: CompendiumData) => { setData(next); setStatus("dirty"); setMessage("Unsaved changes"); };
  const replaceClass = (nextClass: CompendiumClass) => dirty({ ...data, classes: data.classes.map((item) => item.id === nextClass.id ? nextClass : item) });
  const replaceTech = (nextTech: CompendiumTech) => activeClass && replaceClass({ ...activeClass, techs: activeClass.techs.map((item) => item.id === nextTech.id ? nextTech : item) });
  const replaceSeparator = (nextSeparator: CompendiumTechSeparator) => activeClass && replaceClass({ ...activeClass, techs: activeClass.techs.map((item) => item.id === nextSeparator.id ? nextSeparator : item) });

  function chooseClass(id: string) {
    const next = data.classes.find((item) => item.id === id); setClassId(id); setTechId(firstTechId(next?.techs)); setClassPanel(true);
  }
  function addClass() {
    const item: CompendiumClass = { id: makeId("class"), slug: "new-class", name: "New class", icon: "✦", description: "", accent: "#7770ff", published: true, techs: [] };
    dirty({ ...data, classes: [...data.classes, item] }); setClassId(item.id); setTechId(""); setClassPanel(true);
  }
  function deleteClass() {
    if (!activeClass || !confirm(`Delete ${activeClass.name} and all of its techs?`)) return;
    const classes = data.classes.filter((item) => item.id !== activeClass.id); dirty({ ...data, classes }); setClassId(classes[0]?.id ?? ""); setTechId(firstTechId(classes[0]?.techs));
  }
  function addTech() {
    if (!activeClass) return;
    const tech: CompendiumTech = { id: makeId("tech"), slug: "new-tech", title: "New tech", icon: "", summary: "", published: true, updatedAt: new Date().toISOString(), blocks: [] };
    replaceClass({ ...activeClass, techs: [...activeClass.techs, tech] }); setTechId(tech.id); setClassPanel(false);
  }
  function addSeparator() {
    if (!activeClass) return;
    const separator: CompendiumTechSeparator = { id: makeId("section"), kind: "separator", title: "New section" };
    replaceClass({ ...activeClass, techs: [...activeClass.techs, separator] }); setTechId(separator.id); setClassPanel(false);
  }
  function deleteTech() {
    if (!activeClass || !activeTech || !confirm(`Delete ${activeTech.title}?`)) return;
    const techs = activeClass.techs.filter((item) => item.id !== activeTech.id); replaceClass({ ...activeClass, techs }); setTechId(firstTechId(techs));
  }
  function deleteSeparator() {
    if (!activeClass || !activeSeparator || !confirm(`Delete the “${activeSeparator.title}” section heading?`)) return;
    const techs = activeClass.techs.filter((item) => item.id !== activeSeparator.id); replaceClass({ ...activeClass, techs }); setTechId(firstTechId(techs));
  }
  function addBlock(type: BlockType) {
    if (!activeTech) return;
    const block: CompendiumBlock = { id: makeId("block"), type, content: type === "steps" ? "First step\nSecond step" : type === "metronome" ? "Shift + W\nM1\nSpace + M2\nWait" : "", url: "", caption: type === "metronome" ? "Practice the sequence in time" : "", bpm: 90, countIn: 4, loop: true };
    replaceTech({ ...activeTech, blocks: [...activeTech.blocks, block] });
  }
  function updateBlock(id: string, values: Partial<CompendiumBlock>) { if (activeTech) replaceTech({ ...activeTech, blocks: activeTech.blocks.map((item) => item.id === id ? { ...item, ...values } : item) }); }
  function moveBlock(index: number, direction: -1 | 1) { if (activeTech) replaceTech({ ...activeTech, blocks: move(activeTech.blocks, index, index + direction) }); }
  function deleteBlock(id: string) { if (activeTech) replaceTech({ ...activeTech, blocks: activeTech.blocks.filter((item) => item.id !== id) }); }

  async function uploadIcon(file: File, target: "class" | "tech") {
    if (!file.type.startsWith("image/")) { setStatus("error"); setMessage("Choose an image file."); return; }
    setUploading(target); setMessage("Preparing icon…");
    try {
      const url = await makeIconDataUrl(file);
      if (target === "class" && activeClass) replaceClass({ ...activeClass, icon: url });
      if (target === "tech" && activeTech) replaceTech({ ...activeTech, icon: url });
      setMessage("Icon ready — publish when ready");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Couldn’t prepare that image."); }
    finally { setUploading(""); }
  }

  async function uploadVideo(file: File, block: CompendiumBlock) {
    if (!["video/mp4", "video/webm", "video/ogg"].includes(file.type)) { setStatus("error"); setMessage("Choose an MP4, WebM, or Ogg video."); return; }
    if (file.size > 15 * 1024 * 1024) { setStatus("error"); setMessage("Videos must be 15 MB or smaller. Use YouTube for longer clips."); return; }
    setUploadingVideo(block.id); setMessage("Uploading video…");
    try {
      const form = new FormData();
      form.set("video", file);
      form.set("blockId", block.id);
      const response = await fetch("/api/media", { method: "POST", body: form });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || `Video upload failed (${response.status}).`);
      updateBlock(block.id, { url: payload.url });
      setMessage("Video uploaded — publish the tech when ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Couldn’t upload that video.");
    } finally { setUploadingVideo(""); }
  }

  const iconPreview = (value: string | undefined, fallback: string) => value?.startsWith("/") || value?.startsWith("https://") || value?.startsWith("data:image/") ? <img src={value} alt="" /> : <>{value || fallback}</>;

  async function save() {
    setStatus("saving"); setMessage("Publishing changes…");
    try {
      const response = await fetch("/api/editor", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, version }) });
      const payload = await readJson(response); if (!response.ok) throw new Error(payload.error || `Publishing failed (${response.status}). Please try again.`);
      setData(payload.data ?? data); setVersion(payload.version ?? version); localStorage.removeItem(draftKey); setStatus("saved"); setMessage("Published to the compendium"); setConnected(true);
    } catch (error) { try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch {} setStatus("error"); setMessage(`${error instanceof Error ? error.message : "Save failed."} Your draft is safe on this device.`); }
  }

  return <main className="editor-shell">
    <header className="editor-topbar">
      <div className="editor-brand"><span>N</span><div><b>Compendium Editor</b><small>Private workspace</small></div></div>
      <div className={`save-state ${status}`}><i />{message}</div>
      <button className="publish-button" onClick={save} disabled={status === "saving" || status === "loading"}>{status === "saving" ? "Publishing…" : "Publish changes"}</button>
    </header>

    <div className="editor-grid">
      <aside className="class-column">
        <div className="column-heading"><div><small>Structure</small><h2>Classes</h2></div><button onClick={addClass} aria-label="Add class">+</button></div>
        <div className="structure-list">{data.classes.map((item) => { const count = techCount(item.techs); return <button key={item.id} className={item.id === classId ? "active" : ""} onClick={() => chooseClass(item.id)}><span style={{ background: item.accent }}>{iconPreview(item.icon, "✦")}</span><div><b>{item.name}</b><small>{count} tech{count === 1 ? "" : "s"}</small></div><i>{item.published ? "" : "Draft"}</i></button>; })}</div>
        {activeClass && <div className="reorder-row"><button onClick={() => dirty({ ...data, classes: move(data.classes, data.classes.findIndex((i) => i.id === activeClass.id), data.classes.findIndex((i) => i.id === activeClass.id) - 1) })}>↑ Move</button><button onClick={() => dirty({ ...data, classes: move(data.classes, data.classes.findIndex((i) => i.id === activeClass.id), data.classes.findIndex((i) => i.id === activeClass.id) + 1) })}>↓ Move</button></div>}
      </aside>

      <aside className="tech-column">
        <div className="column-heading"><div><small>{activeClass?.name ?? "Choose a class"}</small><h2>Techs</h2></div><div className="tech-add-actions"><button onClick={addSeparator} disabled={!activeClass}>＋ Section</button><button onClick={addTech} disabled={!activeClass}>＋ Tech</button></div></div>
        <button className={`class-settings ${classPanel ? "active" : ""}`} onClick={() => setClassPanel(true)}><span>⚙</span><div><b>Class settings</b><small>Name, icon & colour</small></div></button>
        <div className="structure-list tech-structure">{activeClass?.techs.map((item, index, items) => item.kind === "separator" ? <button key={item.id} className={`editor-tech-separator ${!classPanel && item.id === techId ? "active" : ""}`} onClick={() => { setTechId(item.id); setClassPanel(false); }}><span>§</span><div><b>{item.title}</b><small>Section separator</small></div></button> : <button key={item.id} className={!classPanel && item.id === techId ? "active" : ""} onClick={() => { setTechId(item.id); setClassPanel(false); }}><span>{iconPreview(item.icon, String(items.slice(0, index + 1).filter(isCompendiumTech).length).padStart(2, "0"))}</span><div><b>{item.title}</b><small>{item.summary || "No summary yet"}</small></div><i>{item.published ? "" : "Draft"}</i></button>)}</div>
        {activeItem && !classPanel && <div className="reorder-row"><button onClick={() => replaceClass({ ...activeClass!, techs: move(activeClass!.techs, activeClass!.techs.findIndex((i) => i.id === techId), activeClass!.techs.findIndex((i) => i.id === techId) - 1) })}>↑ Move</button><button onClick={() => replaceClass({ ...activeClass!, techs: move(activeClass!.techs, activeClass!.techs.findIndex((i) => i.id === techId), activeClass!.techs.findIndex((i) => i.id === techId) + 1) })}>↓ Move</button></div>}
      </aside>

      <section className="edit-canvas">
        {!activeClass ? <div className="editor-empty"><span>✦</span><h1>Create your first class</h1><p>Classes become the tabs across the top of the compendium.</p><button onClick={addClass}>Add class</button></div> : classPanel ? <div className="form-page">
          <div className="page-heading"><div><small>Class tab</small><h1>{activeClass.name}</h1><p>Controls the top tab and the tech list shown underneath it.</p></div><button className="danger-link" onClick={deleteClass}>Delete class</button></div>
          <div className="form-card class-form-grid">
            <label><span>Class name</span><input value={activeClass.name} onChange={(e) => replaceClass({ ...activeClass, name: e.target.value, slug: slugify(e.target.value) })} /></label>
            <div className="icon-editor"><span className="field-title">Class icon</span><div className="icon-editor-row"><span className="icon-preview" style={{ background: activeClass.accent }}>{iconPreview(activeClass.icon, "✦")}</span><div><label className="upload-button"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && uploadIcon(e.target.files[0], "class")} />{uploading === "class" ? "Uploading…" : "Upload image"}</label><button type="button" className="clear-icon" onClick={() => replaceClass({ ...activeClass, icon: "✦" })}>Use default</button></div></div><input value={activeClass.icon} placeholder="Or paste an HTTPS image URL / emoji" onChange={(e) => replaceClass({ ...activeClass, icon: e.target.value })} /></div>
            <label><span>Accent colour</span><div className="color-field"><input type="color" value={activeClass.accent} onChange={(e) => replaceClass({ ...activeClass, accent: e.target.value })} /><input value={activeClass.accent} onChange={(e) => replaceClass({ ...activeClass, accent: e.target.value })} /></div></label>
            <label className="wide"><span>Short class description</span><textarea rows={3} value={activeClass.description} onChange={(e) => replaceClass({ ...activeClass, description: e.target.value })} /></label>
            <label className="toggle wide"><input type="checkbox" checked={activeClass.published} onChange={(e) => replaceClass({ ...activeClass, published: e.target.checked })} /><span><b>Published class</b><small>Draft classes stay hidden from the public compendium.</small></span></label>
          </div>
        </div> : activeSeparator ? <div className="form-page separator-form-page">
          <div className="page-heading"><div><small>Tech list section</small><h1>{activeSeparator.title}</h1><p>This heading separates groups of techs in the editor and public Compendium. Move it above the first tech in its group.</p></div><button className="danger-link" onClick={deleteSeparator}>Delete section</button></div>
          <div className="form-card"><label><span>Section name</span><input value={activeSeparator.title} placeholder="Simple techs" onChange={(event) => replaceSeparator({ ...activeSeparator, title: event.target.value })} /></label><p className="separator-help">Examples: Simple Techs, Advanced, Funny. Empty sections and sections containing only draft techs stay hidden from the public page.</p></div>
        </div> : activeTech ? <div className="form-page">
          <div className="page-heading"><div><small>{activeClass.name} tech</small><h1>{activeTech.title}</h1><p>Build the page from simple content blocks. Dragging isn’t required—use the arrow buttons to arrange them.</p></div><button className="danger-link" onClick={deleteTech}>Delete tech</button></div>
          <div className="form-card tech-basics">
            <label><span>Tech name</span><input value={activeTech.title} onChange={(e) => replaceTech({ ...activeTech, title: e.target.value, slug: slugify(e.target.value) })} /></label>
            <div className="icon-editor"><span className="field-title">Tech icon</span><div className="icon-editor-row"><span className="icon-preview">{iconPreview(activeTech.icon, "＋")}</span><div><label className="upload-button"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && uploadIcon(e.target.files[0], "tech")} />{uploading === "tech" ? "Uploading…" : "Upload image"}</label><button type="button" className="clear-icon" onClick={() => replaceTech({ ...activeTech, icon: "" })}>Remove</button></div></div><input value={activeTech.icon || ""} placeholder="Or paste an HTTPS image URL / emoji" onChange={(e) => replaceTech({ ...activeTech, icon: e.target.value })} /></div>
            <label><span>Quick summary</span><textarea rows={2} value={activeTech.summary} onChange={(e) => replaceTech({ ...activeTech, summary: e.target.value })} /></label>
            <label className="toggle"><input type="checkbox" checked={activeTech.published} onChange={(e) => replaceTech({ ...activeTech, published: e.target.checked })} /><span><b>Published tech</b><small>Turn this off while the page is unfinished.</small></span></label>
          </div>
          <IconEmojiPicker onCopied={(text) => { setStatus("dirty"); setMessage(text); }} />
          <div className="blocks-heading"><div><small>Page content</small><h2>Blocks</h2></div><div className="add-block-menu"><span>Add:</span>{blockTypes.map((type) => <button key={type} onClick={() => addBlock(type)}>{blockNames[type]}</button>)}</div></div>
          <div className="block-list">{activeTech.blocks.map((block, index) => <div className="block-card" key={block.id}>
            <div className="block-toolbar"><select value={block.type} onChange={(e) => updateBlock(block.id, { type: e.target.value as BlockType })}>{blockTypes.map((type) => <option key={type} value={type}>{blockNames[type]}</option>)}</select><div><button onClick={() => moveBlock(index, -1)} disabled={index === 0}>↑</button><button onClick={() => moveBlock(index, 1)} disabled={index === activeTech.blocks.length - 1}>↓</button><button className="remove" onClick={() => deleteBlock(block.id)}>Delete</button></div></div>
            {(block.type === "heading" || block.type === "paragraph" || block.type === "steps" || block.type === "callout") && <label><span>{block.type === "steps" ? "One step per line" : blockNames[block.type]}</span><textarea rows={block.type === "paragraph" || block.type === "steps" ? 5 : 3} value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} /></label>}
            {block.type === "image" && <><label><span>Image URL</span><input type="url" value={block.url} placeholder="https://…" onChange={(e) => updateBlock(block.id, { url: e.target.value })} /></label><label><span>Caption / description</span><input value={block.caption} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} /></label></>}
            {block.type === "video" && <><label><span>YouTube or direct video URL</span><input type="url" value={block.url} placeholder="https://…" onChange={(e) => updateBlock(block.id, { url: e.target.value })} /></label><div className="video-upload-row"><label className={`upload-button ${uploadingVideo === block.id ? "uploading" : ""}`}><input type="file" accept="video/mp4,video/webm,video/ogg" disabled={uploadingVideo === block.id} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadVideo(file, block); e.target.value = ""; }} />{uploadingVideo === block.id ? "Uploading…" : "Upload video file"}</label><small>MP4, WebM, or Ogg · up to 15 MB. YouTube is still best for longer videos.</small></div><label><span>Caption / description</span><input value={block.caption} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} /></label></>}
            {block.type === "metronome" && <div className="metronome-fields">
              <label className={hasMillisecondDelay(block.content) ? "timing-disabled" : ""}><span>BPM</span><input type="number" min="20" max="300" disabled={hasMillisecondDelay(block.content)} value={block.bpm ?? 90} onChange={(e) => updateBlock(block.id, { bpm: Math.max(20, Math.min(300, Number(e.target.value) || 90)) })} /><small>{hasMillisecondDelay(block.content) ? "Ignored — explicit ms timing is active." : "Used when no ms delay is present."}</small></label>
              <label><span>Start countdown</span><select value={block.countIn ?? 4} onChange={(e) => updateBlock(block.id, { countIn: Number(e.target.value) })}><option value="0">Disabled</option><option value="2">2 beats</option><option value="4">4 beats</option><option value="8">8 beats</option></select></label>
              <label className="toggle"><input type="checkbox" checked={block.loop ?? true} onChange={(e) => updateBlock(block.id, { loop: e.target.checked })} /><span><b>Loop sequence</b><small>Keep repeating until stopped.</small></span></label>
              <label className="wide"><span>One step per line — use + together, or put a millisecond delay between inputs</span><textarea rows={7} value={block.content} placeholder={'Shift + W\nM1 (10ms) Space\nQ > 35ms > M1\nWait'} onChange={(e) => updateBlock(block.id, { content: e.target.value })} /></label>
              <label className="wide"><span>Practice note</span><input value={block.caption} placeholder="Optional explanation" onChange={(e) => updateBlock(block.id, { caption: e.target.value })} /></label>
              <p className="key-help wide">Examples: <kbd>Q + M1</kbd> presses both together. <kbd>M1 (10ms) Space</kbd>, <kbd>M1 (10ms delay) Space</kbd>, and <kbd>M1 &gt; 10ms &gt; Space</kbd> press M1, wait exactly 10 ms, then show Space. Any ms delay automatically switches the whole trainer to exact timing and ignores BPM. Use “Wait” for an empty step.</p>
            </div>}
          </div>)}{!activeTech.blocks.length && <div className="no-blocks"><span>＋</span><h3>This tech page is empty</h3><p>Add a paragraph, steps, an image, or a video above.</p></div>}</div>
        </div> : <div className="editor-empty"><span>＋</span><h1>Add the first tech</h1><p>Add tech pages directly, or add section headings to group them.</p><button onClick={addTech}>Add tech</button></div>}
      </section>
    </div>
    {!connected && <div className="connection-note">Private editor preview is ready. Its publishing connection will activate with the deployed compendium.</div>}
  </main>;
}
