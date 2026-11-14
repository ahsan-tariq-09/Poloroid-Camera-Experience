import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { createPhoneShakeDetector } from "./phoneShake";
import { SHUTTER_SOUND_MS } from "../sounds";

type MotionAccess = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
export const PHOTO_DEVELOPMENT_MS = 11000;
const PHOTO_DEVELOPMENT_DELAY_MS = 2000;
/** The slide lasts exactly as long as the ejection recording, so the print never moves in silence. */
export const PRINT_EJECTION_MS = SHUTTER_SOUND_MS;

/** Owns the blank-to-developed print, gestures, and optional phone sensor access. */
export default function InstantPrint({ photos, caption, enabled, onReveal, onRetake, actions }: {
  photos: {src:string;alt:string}[]; caption:string; enabled:boolean; onReveal?:()=>void; onRetake?:()=>void;
  /** Replaces Reveal the Snap once the photo has fully developed. */
  actions?: ReactNode;
}) {
  const [phase,setPhase]=useState<"ejecting"|"blank"|"developing"|"revealed">(enabled?"ejecting":"blank");
  const motionApi=window.isSecureContext?window.DeviceMotionEvent as MotionAccess|undefined:undefined;
  const [sensorActive,setSensorActive]=useState(false);
  const [buttonShake,setButtonShake]=useState(false);
  const revealStarted=useRef(false), revealCallback=useRef(onReveal), actionRow=useRef<HTMLDivElement>(null);
  // The finger sets the target; a soft spring trails it and eases the print back to centre on release.
  const offset=useMotionValue(0), x=useSpring(offset,{stiffness:170,damping:15,mass:.7});
  // The paper leans a little into each swing, like a print held by one edge.
  const tilt=useTransform(x,[-16,0,16],[-2.4,0,2.4]);
  // origin is where the finger pressed (the print follows it); anchor moves with each counted swing.
  const gesture=useRef<{id:number;origin:number;anchor:number;direction:number;turns:number;distance:number}|null>(null);
  revealCallback.current=onReveal;

  const reveal=useCallback(()=>{
    if(revealStarted.current||phase!=="blank")return;
    revealStarted.current=true; gesture.current=null; offset.set(0); setPhase("developing");
  },[offset,phase]);
  useEffect(()=>{
    if(phase!=="ejecting")return;
    if(!enabled){setPhase("blank");return;}
    const timer=setTimeout(()=>setPhase("blank"),PRINT_EJECTION_MS);
    return()=>clearTimeout(timer);
  },[phase,enabled]);
  useEffect(()=>{
    if(phase!=="developing")return;
    const finish=()=>{setPhase("revealed");revealCallback.current?.();};
    if(!enabled){finish();return;}
    // Leave a paint interval after the development fade before enabling next actions.
    const timer=setTimeout(finish,PHOTO_DEVELOPMENT_MS+100);
    return()=>clearTimeout(timer);
  },[phase,enabled]);
  useEffect(()=>{
    if(!motionApi||phase!=="blank")return;
    const detector=createPhoneShakeDetector();let fired=false;
    const listener=(event:DeviceMotionEvent)=>{
      if(document.hidden||fired)return;
      const readings=[event.acceleration,event.accelerationIncludingGravity];
      if(readings.some(a=>a&&[a.x,a.y,a.z].every(v=>typeof v==="number"&&Number.isFinite(v))))setSensorActive(true);
      if(detector.sample(event.acceleration,event.accelerationIncludingGravity,event.timeStamp)){fired=true;reveal();}
    };
    window.addEventListener("devicemotion",listener);
    document.addEventListener("visibilitychange",detector.reset);
    return()=>{window.removeEventListener("devicemotion",listener);document.removeEventListener("visibilitychange",detector.reset);};
  },[motionApi,phase,reveal]);
  useEffect(()=>{
    // The spent reveal button drops keyboard focus to the page or, in WebKit, to the camera body.
    // Hand it to the first new action unless the user already moved to another control.
    const active=document.activeElement;
    if(phase==="revealed"&&(!active||active.contains(actionRow.current)))actionRow.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  },[phase]);
  const revealByButton=()=>{
    // Permission prompts require a user gesture. Revealing this print never depends on access.
    if(motionApi?.requestPermission&&!sensorActive){
      try{void motionApi.requestPermission().catch(()=>{});}catch{/* The tap fallback still works. */}
    }
    if(phase==="blank"&&!revealStarted.current)setButtonShake(enabled);
    reveal();
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const g=gesture.current;
    if(!g||g.id!==event.pointerId)return;
    if(enabled)offset.set(Math.max(-16,Math.min(16,(event.clientX-g.origin)/2.5)));
    const delta=event.clientX-g.anchor;
    if(Math.abs(delta)<20)return;
    const direction=Math.sign(delta);
    if(g.direction&&direction!==g.direction)g.turns++;
    g.distance+=Math.abs(delta);g.direction=direction;g.anchor=event.clientX;
    if(g.turns>=2&&g.distance>=100)reveal();
  };
  const end=()=>{gesture.current=null;offset.set(0);};
  return <div className="print-reveal">
    <div className="print-outlet"><motion.div className="instant-print" initial={enabled?{y:"-100%"}:false} animate={{y:0}} transition={{duration:enabled?PRINT_EJECTION_MS/1000:0,ease:"linear"}}>
      <motion.div className="print-drag" style={{x}} animate={{rotate:enabled&&buttonShake&&phase==="developing"?[0,-4,3.4,-2.6,1.8,-1,.4,0]:0}} transition={{duration:enabled&&buttonShake ? 1.1 : 0,ease:"easeInOut"}} onPointerDown={event=>{
        if(phase!=="blank"||event.button!==0)return;
        gesture.current={id:event.pointerId,origin:event.clientX,anchor:event.clientX,direction:0,turns:0,distance:0};
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <motion.div className="instant-paper" style={{rotate:tilt}}>
          {photos.map((photo,index)=><div className="instant-photo-window" key={photo.src}>
            {phase==="developing"||phase==="revealed" ? <motion.img src={photo.src} alt={photo.alt} initial={enabled?{opacity:0}:false} animate={{opacity:1}} transition={{delay:enabled?PHOTO_DEVELOPMENT_DELAY_MS/1000:0,duration:enabled?(PHOTO_DEVELOPMENT_MS-PHOTO_DEVELOPMENT_DELAY_MS)/1000:0,ease:"linear"}} draggable={false}/> : <div className="undeveloped-photo" aria-label={`Unrevealed photo ${index+1}`}>{index===0&&<span>Drag &amp; shake</span>}</div>}
          </div>)}
          <span className="instant-caption">{caption}</span>
        </motion.div>
      </motion.div>
    </motion.div></div>
    <div className="print-reveal-actions">
      <div className="print-action-row" ref={actionRow}>
        {phase==="revealed"&&actions ? actions : <button className={`${phase==="blank"?"primary-button":"secondary-button"} shake-reveal`} disabled={phase!=="blank"} onClick={revealByButton}>{phase==="ejecting"?"Printing…":phase==="blank"?"Reveal the Snap":phase==="revealed"?"Photo revealed":"Developing…"}</button>}
        {onRetake&&<button className="secondary-button retake-photo" onClick={onRetake}>Retake photo</button>}
      </div>
      <span className="sr-only" role="status">{phase==="ejecting"?"Printing…":phase==="blank"?"Drag and shake the print, or press Reveal the Snap":phase==="revealed"?"Photo revealed":"Developing…"}</span>
    </div>
  </div>;
}
