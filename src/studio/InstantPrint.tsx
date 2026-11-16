import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { SHUTTER_SOUND_MS } from "../sounds";

/** The slide lasts exactly as long as the ejection recording, so the print never moves in silence. */
export const PRINT_EJECTION_MS = SHUTTER_SOUND_MS;
/** The print rests blank this long after it stops moving, then the photo fades in. */
export const PHOTO_DEVELOPMENT_DELAY_MS = 2500;
/** From the print stopping to the photo fully showing: the blank rest plus a 9s fade. */
export const PHOTO_DEVELOPMENT_MS = PHOTO_DEVELOPMENT_DELAY_MS + 9000;

/** Owns the print: it slides out blank, rests, then develops on its own. */
export default function InstantPrint({ photos, caption, enabled, onReveal, onRetake, actions }: {
  photos: {src:string;alt:string}[]; caption:string; enabled:boolean; onReveal?:()=>void; onRetake?:()=>void;
  /** Shown once the photo has fully developed. */
  actions?: ReactNode;
}) {
  const [phase,setPhase]=useState<"ejecting"|"developing"|"revealed">(enabled?"ejecting":"revealed");
  const revealCallback=useRef(onReveal), actionRow=useRef<HTMLDivElement>(null), handedFocus=useRef(false);
  revealCallback.current=onReveal;

  useEffect(()=>{
    if(phase==="ejecting"){
      const timer=setTimeout(()=>setPhase("developing"),PRINT_EJECTION_MS);
      return()=>clearTimeout(timer);
    }
    if(phase==="developing"){
      // Leave a paint interval after the development fade before enabling next actions.
      const timer=setTimeout(()=>setPhase("revealed"),PHOTO_DEVELOPMENT_MS+100);
      return()=>clearTimeout(timer);
    }
    revealCallback.current?.();
  },[phase]);
  useEffect(()=>{
    // Once per print, hand keyboard focus to the first action as soon as it is usable (Save may still be preparing at the reveal),
    // unless the user already moved to another control.
    const button=phase==="revealed"&&!handedFocus.current?actionRow.current?.querySelector<HTMLElement>("button:not(:disabled)"):null;
    if(!button)return;
    handedFocus.current=true;
    const active=document.activeElement;
    if(!active||active.contains(actionRow.current))button.focus();
  });
  return <div className="print-reveal">
    <div className="print-outlet"><motion.div className="instant-print" initial={enabled?{y:"-100%"}:false} animate={{y:0}} transition={{duration:enabled?PRINT_EJECTION_MS/1000:0,ease:"linear"}}>
      <div className="instant-paper">
        {photos.map(photo=><div className="instant-photo-window" key={photo.src}>
          {phase!=="ejecting"&&<motion.img src={photo.src} alt={photo.alt} initial={enabled?{opacity:0}:false} animate={{opacity:1}} transition={{delay:enabled?PHOTO_DEVELOPMENT_DELAY_MS/1000:0,duration:enabled?(PHOTO_DEVELOPMENT_MS-PHOTO_DEVELOPMENT_DELAY_MS)/1000:0,ease:"linear"}} draggable={false}/>}
        </div>)}
        <span className="instant-caption">{caption}</span>
      </div>
    </motion.div></div>
    <div className="print-reveal-actions">
      <div className="print-action-row" ref={actionRow}>
        {phase==="revealed"&&actions}
        {onRetake&&<button className="secondary-button retake-photo" onClick={onRetake}>Retake photo</button>}
      </div>
      <span className="sr-only" role="status">{phase==="ejecting"?"Printing…":phase==="developing"?"Developing…":"Photo revealed"}</span>
    </div>
  </div>;
}
