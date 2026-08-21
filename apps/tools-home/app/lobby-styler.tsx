"use client";

import { useMemo, useState } from "react";
import styles from "./lobby-styler.module.css";

type Style={bold:boolean;italic:boolean;underline:boolean;strike:boolean;color:string;size:string;face:string;stroke:boolean;strokeColor:string;strokeThickness:string};
const presets:{name:string;emoji:string;style:Partial<Style>}[]=[
  {name:"VIP Gold",emoji:"👑",style:{bold:true,italic:false,color:"#FFD700",size:"24",face:"GothamBold",stroke:true,strokeColor:"#5A3A00",strokeThickness:"1"}},
  {name:"Void",emoji:"🟣",style:{bold:true,italic:true,color:"#B46CFF",size:"24",face:"GothamBold",stroke:true,strokeColor:"#160B22",strokeThickness:"2"}},
  {name:"Warning",emoji:"⚠️",style:{bold:true,italic:false,color:"#FF5C5C",size:"24",face:"GothamBold",stroke:true,strokeColor:"#2B0707",strokeThickness:"2"}},
  {name:"Clean",emoji:"✨",style:{bold:false,italic:false,underline:false,strike:false,color:"#FFFFFF",size:"24",face:"Gotham",stroke:false,strokeColor:"#000000",strokeThickness:"1"}},
];
const faces=["Legacy","Arial","ArialBold","SourceSans","SourceSansBold","SourceSansLight","SourceSansItalic","Bodoni","Garamond","Cartoon","Code","Highway","SciFi","Arcade","Fantasy","Antique","SourceSansSemibold","Gotham","GothamMedium","GothamBold","GothamBlack","AmaticSC","Bangers","Creepster","FredokaOne","JosefinSans","Michroma","Roboto","RobotoCondensed","RobotoMono","Ubuntu","BuilderSans","BuilderSansMedium","BuilderSansBold","BuilderSansExtraBold"];
function escapeRichText(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");}
function safeColor(value:string,fallback="#FFFFFF"){return /^#[0-9a-fA-F]{6}$/.test(value)?value.toUpperCase():fallback;}
function buildMarkup(text:string,style:Style){let result=escapeRichText(text||"Your Lobby Name");const color=safeColor(style.color),strokeColor=safeColor(style.strokeColor,"#000000");if(style.bold)result=`<b>${result}</b>`;if(style.italic)result=`<i>${result}</i>`;if(style.underline)result=`<u>${result}</u>`;if(style.strike)result=`<s>${result}</s>`;result=`<font color=\"${color}\"><font size=\"${style.size}\"><font face=\"${style.face}\">${result}</font></font></font>`;if(style.stroke)result=`<stroke color=\"${strokeColor}\" thickness=\"${style.strokeThickness}\">${result}</stroke>`;return result;}
function previewMarkup(markup:string){return markup.replace(/<font color=\"(#[0-9a-fA-F]{6})\">/g,"<span style=\"color:$1\">").replace(/<font size=\"(\d+)\">/g,"<span style=\"font-size:${Math.min(64,Number($1))}px\">").replace(/<font face=\"([^\"]+)\">/g,"<span style=\"font-family:$1,sans-serif\">").replace(/<stroke color=\"(#[0-9a-fA-F]{6})\" thickness=\"([0-9.]+)\">/g,"<span style=\"-webkit-text-stroke:${$2}px $1\">").replace(/<\/(font|stroke)>/g,"</span>").replace(/<b>/g,"<strong>").replace(/<\/b>/g,"</strong>").replace(/<i>/g,"<em>").replace(/<\/i>/g,"</em>").replace(/<u>/g,"<span style=\"text-decoration:underline\">").replace(/<\/u>/g,"</span>").replace(/<s>/g,"<del>").replace(/<\/s>/g,"</del>");}

export default function LobbyStyler(){
  const [text,setText]=useState("VIP Lobby");
  const [style,setStyle]=useState<Style>({bold:true,italic:false,underline:false,strike:false,color:"#B46CFF",size:"24",face:"GothamBold",stroke:true,strokeColor:"#160B22",strokeThickness:"2"});
  const [advanced,setAdvanced]=useState(false);
  const [copied,setCopied]=useState(false);
  const markup=useMemo(()=>buildMarkup(text,style),[text,style]);
  const preview=useMemo(()=>previewMarkup(markup),[markup]);
  function patch(next:Partial<Style>){setStyle(current=>({...current,...next}));setCopied(false);}
  async function copy(){try{await navigator.clipboard.writeText(markup);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{setCopied(false);}}
  return <section className={styles.editor}>
    <div className={styles.previewCard}><div className={styles.previewLabel}>PREVIEW</div><div className={styles.preview} dangerouslySetInnerHTML={{__html:preview}}/><div className={styles.previewHint}>This is roughly how Roblox RichText will look.</div></div>
    <div className={styles.controls}>
      <label className={styles.fieldWide}><span>1 · NAME</span><input value={text} maxLength={100} onChange={event=>setText(event.target.value)} placeholder="VIP Lobby" autoFocus/></label>
      <div className={styles.presetHeading}><span>2 · PICK A STYLE</span><small>Start with a preset — you can customize it below.</small></div>
      <div className={styles.presetGrid}>{presets.map(preset=><button key={preset.name} className={styles.presetCard} type="button" onClick={()=>{setStyle(current=>({...current,...preset.style}));setCopied(false);}}><strong>{preset.emoji} {preset.name}</strong><span>{preset.name==="VIP Gold"?"Premium & shiny":preset.name==="Void"?"Dark & purple":preset.name==="Warning"?"Loud & attention-grabbing":"Simple & clean"}</span></button>)}</div>
      <button className={styles.advancedToggle} type="button" onClick={()=>setAdvanced(value=>!value)}>{advanced?"▾ HIDE CUSTOMIZATION":"▸ MORE CUSTOMIZATION"}</button>
      {advanced&&<div className={styles.advancedPanel}>
        <div className={styles.buttonRow}>{([["B","bold"],["I","italic"],["U","underline"],["S","strike"]] as const).map(([label,key])=><button key={key} className={style[key]?styles.active:""} onClick={()=>patch({[key]:!style[key]})} aria-label={key} type="button">{label}</button>)}</div>
        <div className={styles.grid}>
          <label><span>COLOR</span><div className={styles.colorInput}><input type="color" value={safeColor(style.color)} onChange={event=>patch({color:event.target.value.toUpperCase()})}/><input value={style.color} onChange={event=>patch({color:event.target.value})} spellCheck={false}/></div></label>
          <label><span>SIZE</span><select value={style.size} onChange={event=>patch({size:event.target.value})}>{["16","20","24","28","32","40","48"].map(size=><option key={size}>{size}</option>)}</select></label>
          <label><span>FONT</span><select value={style.face} onChange={event=>patch({face:event.target.value})}>{faces.map(face=><option key={face}>{face}</option>)}</select></label>
          <label><span>STROKE</span><select value={style.stroke?"on":"off"} onChange={event=>patch({stroke:event.target.value==="on"})}><option value="on">ON</option><option value="off">OFF</option></select></label>
        </div>
        {style.stroke&&<div className={styles.grid}><label><span>STROKE COLOR</span><div className={styles.colorInput}><input type="color" value={safeColor(style.strokeColor,"#000000")} onChange={event=>patch({strokeColor:event.target.value.toUpperCase()})}/><input value={style.strokeColor} onChange={event=>patch({strokeColor:event.target.value})} spellCheck={false}/></div></label><label><span>STROKE WIDTH</span><select value={style.strokeThickness} onChange={event=>patch({strokeThickness:event.target.value})}>{["0.5","1","1.5","2","3","4"].map(size=><option key={size}>{size}</option>)}</select></label></div>}
      </div>}
    </div>
    <div className={`${styles.output} lobby-styler-output`}><div><span>3 · COPY THIS</span><small>Paste this into your VIP lobby name field with RichText enabled.</small></div><code>{markup}</code><button type="button" onClick={copy}>{copied?"COPIED ✓":"COPY RICHTEXT"}</button></div>
  </section>;
}
