"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; name: string; qty: number };
type Node = { id: string; title: string; gifts: number; note: string; x: number; y: number; items: Item[] };
type Edge = { id: string; from: string; to: string };

const upgrades = [
  "Adrenaline","Business License","Paycheck","Swiftness Ring","Better Jump Pads","Defuse Kit","Double Jump","Grapple Points","Last Robloxian Standing","Medal","Radar","Tria Orbs","Advanced Gravity Coil","Fanny Pack","Grace Wings","Helmet","Ice Skates","Pocket Bell","Radar Module: Altars","Radar Module: Enemies","Radar Module: Players","Radar Module: Tripmines","More Altars","Larger Grapple Points","Ninja Belt","Subspacial Barrier","Gift Magnet","Matrix Tetrahedron","Radar Module: Instruments","Shark Tail","Shield","Sport Shoes","Panic Necklace","Drowned Aegis","Gift Idol","Miniature Hourglass"
];
const iconOverrides: Record<string,string> = { "Drowned Aegis": "DrownedÆgis.png" };
const icon = (name: string) => `https://nullscape.wiki/wiki/Special:Redirect/file/${encodeURIComponent(iconOverrides[name] ?? name.replace(/[\\s:'’]/g, "") + ".png")}`;
const giftIcon = "https://nullscape.wiki/wiki/Special:Redirect/file/GoldGiftIcon.png";

const initialNodes: Node[] = [
  { id:"n1", title:"Shop 1", gifts:0, note:"", x:70, y:70, items:[] },
  { id:"n2", title:"Shop 2", gifts:0, note:"", x:430, y:70, items:[] },
  { id:"n3", title:"Shop 3", gifts:0, note:"", x:790, y:70, items:[] },
];

function uid(prefix: string) { return prefix + Math.random().toString(36).slice(2,9); }
function blankPlan() { return { nodes: initialNodes.map(n => ({...n, items:[]})), edges: [] as Edge[] }; }

export default function Home() {
  const [nodes,setNodes] = useState<Node[]>(initialNodes);
  const [edges,setEdges] = useState<Edge[]>([]);
  const [selected,setSelected] = useState<string | null>(null);
  const [connectMode,setConnectMode] = useState(false);
  const [connectFrom,setConnectFrom] = useState<string | null>(null);
  const [loaded,setLoaded] = useState(false);
  const drag = useRef<{id:string; dx:number; dy:number} | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nullscape-shop-planner-v1");
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p.nodes) && Array.isArray(p.edges)) { setNodes(p.nodes); setEdges(p.edges); } }
    } catch {}
    setLoaded(true);
  },[]);
  useEffect(() => { if (loaded) localStorage.setItem("nullscape-shop-planner-v1", JSON.stringify({nodes,edges})); },[nodes,edges,loaded]);

  const totals = useMemo(() => ({
    gifts: nodes.reduce((s,n)=>s + (Number(n.gifts)||0),0),
    items: nodes.reduce((s,n)=>s + n.items.reduce((a,i)=>a+(Number(i.qty)||0),0),0),
  }),[nodes]);

  const updateNode = (id:string, patch:Partial<Node>) => setNodes(ns=>ns.map(n=>n.id===id?{...n,...patch}:n));
  const addNode = () => {
    const i=nodes.length; const node:Node={id:uid("n"),title:`Shop ${i+1}`,gifts:0,note:"",x:70+(i%4)*330,y:70+Math.floor(i/4)*260,items:[]};
    setNodes(ns=>[...ns,node]); setSelected(node.id);
  };
  const deleteSelected = () => {
    if (!selected) return;
    setNodes(ns=>ns.filter(n=>n.id!==selected)); setEdges(es=>es.filter(e=>e.from!==selected&&e.to!==selected)); setSelected(null);
  };
  const clearPlan = () => { if (confirm("Clear this shop plan?")) { const p=blankPlan(); setNodes(p.nodes); setEdges([]); setSelected(null); } };
  const exportPlan = () => {
    const blob=new Blob([JSON.stringify({nodes,edges},null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="nullscape-shop-plan.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  const importPlan = (file:File) => { const r=new FileReader(); r.onload=()=>{try{const p=JSON.parse(String(r.result));if(Array.isArray(p.nodes)&&Array.isArray(p.edges)){setNodes(p.nodes);setEdges(p.edges);setSelected(null);}}catch{alert("That does not look like a Shop Planner file.")}};r.readAsText(file); };

  const pointerDown = (e:React.PointerEvent,id:string) => {
    if (connectMode) return;
    const n=nodes.find(v=>v.id===id); if(!n) return;
    const rect=(e.currentTarget.parentElement?.parentElement as HTMLElement)?.getBoundingClientRect();
    if(!rect)return;
    drag.current={id,dx:e.clientX-rect.left-n.x,dy:e.clientY-rect.top-n.y}; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const pointerMove = (e:React.PointerEvent) => { if(!drag.current)return; const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); const d=drag.current; setNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:Math.max(8,Math.min(1280,e.clientX-r.left-d.dx)),y:Math.max(8,Math.min(650,e.clientY-r.top-d.dy))}:n)); };
  const pointerUp = () => { drag.current=null; };

  const nodeClick = (id:string) => {
    if (!connectMode) { setSelected(id); return; }
    if (!connectFrom) { setConnectFrom(id); setSelected(id); return; }
    if (connectFrom===id) { setConnectFrom(null); return; }
    if (!edges.some(e=>e.from===connectFrom&&e.to===id)) setEdges(es=>[...es,{id:uid("e"),from:connectFrom,to:id}]);
    setConnectFrom(null); setSelected(id);
  };

  const addItem = (nodeId:string) => setNodes(ns=>ns.map(n=>n.id===nodeId?{...n,items:[...n.items,{id:uid("i"),name:upgrades[0],qty:1}]}:n));
  const removeItem = (nodeId:string,itemId:string) => setNodes(ns=>ns.map(n=>n.id===nodeId?{...n,items:n.items.filter(i=>i.id!==itemId)}:n));
  const updateItem = (nodeId:string,itemId:string,patch:Partial<Item>) => setNodes(ns=>ns.map(n=>n.id===nodeId?{...n,items:n.items.map(i=>i.id===itemId?{...i,...patch}:i)}:n));

  return <main>
    <header className="topbar">
      <a href="/nullscape-tools/" className="back">← Tools</a>
      <div className="brand"><span className="brand-icon"><img src={icon("Business License")} alt=""/></span><div><b>SHOP PLANNER</b><small>VISUAL UPGRADE DEPENDENCIES</small></div></div>
      <div className="stats"><span><b>{nodes.length}</b> shops</span><span><b>{edges.length}</b> links</span><span><b>{totals.gifts.toLocaleString()}</b> gifts</span></div>
      <button className={connectMode?"primary":""} onClick={()=>{setConnectMode(v=>!v);setConnectFrom(null)}}>{connectMode?"✓ Linking":"↗ Link boxes"}</button>
      <button onClick={addNode}>＋ Box</button>
      <button onClick={exportPlan}>Export</button>
      <label className="file-button">Import<input type="file" accept="application/json" onChange={e=>e.target.files?.[0]&&importPlan(e.target.files[0])}/></label>
      <button className="danger" onClick={clearPlan}>Clear</button>
    </header>

    <section className="helpbar">
      <span><b>Drag</b> boxes around</span><span><b>{connectMode?"Click a source, then a destination":"Link boxes"}</b> to create dependencies</span><span><b>Click</b> an item to edit its quantity</span>
      {connectMode && connectFrom && <em>Linking from “{nodes.find(n=>n.id===connectFrom)?.title}” — choose a destination</em>}
    </section>

    <div className="workspace" onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <svg className="edges" viewBox="0 0 1360 760" preserveAspectRatio="none">
        <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z"/></marker></defs>
        {edges.map(e=>{const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);if(!a||!b)return null;const x1=a.x+145,y1=a.y+82,x2=b.x+5,y2=b.y+82;const bend=(x2-x1)*.45;return <g key={e.id}><path d={`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`} className="edge" markerEnd="url(#arrow)"/><circle cx={x1} cy={y1} r="4"/></g>})}
      </svg>
      {nodes.map(n=><article key={n.id} className={`node ${selected===n.id?"selected":""} ${connectFrom===n.id?"connect-source":""}`} style={{left:n.x,top:n.y}} onClick={()=>nodeClick(n.id)}>
        <div className="node-head" onPointerDown={e=>pointerDown(e,n.id)}>
          <input value={n.title} onClick={e=>e.stopPropagation()} onChange={e=>updateNode(n.id,{title:e.target.value})}/>
          <button className="node-delete" title="Delete box" onClick={e=>{e.stopPropagation();setNodes(ns=>ns.filter(v=>v.id!==n.id));setEdges(es=>es.filter(x=>x.from!==n.id&&x.to!==n.id));if(selected===n.id)setSelected(null)}}>×</button>
        </div>
        <div className="node-body">
          <label className="gift-input"><img src={giftIcon} alt=""/><span>Estimated Golden Gifts</span><input type="number" min="0" value={n.gifts||""} placeholder="0" onClick={e=>e.stopPropagation()} onChange={e=>updateNode(n.id,{gifts:Math.max(0,Number(e.target.value)||0)})}/></label>
          <textarea value={n.note} placeholder="Notes / what you're buying…" onClick={e=>e.stopPropagation()} onChange={e=>updateNode(n.id,{note:e.target.value})}/>
          <div className="items-title"><span>UPGRADES / ITEMS</span><button onClick={e=>{e.stopPropagation();addItem(n.id)}}>＋ Add</button></div>
          {n.items.length===0&&<div className="empty-items">No items yet</div>}
          {n.items.map(item=><div className="item-row" key={item.id} onClick={e=>e.stopPropagation()}>
            <img src={icon(item.name)} alt="" onError={e=>(e.currentTarget.style.visibility="hidden")}/>
            <select value={item.name} onChange={e=>updateItem(n.id,item.id,{name:e.target.value})}>{upgrades.map(u=><option key={u}>{u}</option>)}</select>
            <input aria-label="quantity" type="number" min="1" value={item.qty} onChange={e=>updateItem(n.id,item.id,{qty:Math.max(1,Number(e.target.value)||1)})}/>
            <button onClick={()=>removeItem(n.id,item.id)}>×</button>
          </div>)}
        </div>
      </article>)}
      {nodes.length===0&&<div className="empty-canvas"><div><b>Your canvas is empty.</b><span>Add a box to start planning your shop route.</span><button onClick={addNode}>＋ Add first box</button></div></div>}
    </div>

    <aside className="legend"><b>TIP</b><span>One box can have as many incoming or outgoing links as you want — perfect for shared prerequisites.</span></aside>
    <footer><span>NULLSCAPE TOOLS · SHOP PLANNER</span><span>Plans save automatically on this device.</span></footer>
  </main>;
}
