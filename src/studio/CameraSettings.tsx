import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Zap } from "lucide-react";
/** Marks on the timer dial; a turned dial settles on the nearest one. */
export const timerStops = [0,3,5,10] as const;
export type TimerSeconds = typeof timerStops[number];
export const filmPresets = ["Classic","B&W","Film Grain","Faded"] as const;
export type FilmPreset = typeof filmPresets[number];
/** ISO stops, evenly spaced along the bar so 800 sits in the centre. */
export const isoStops = [100,400,800,1600,3200] as const;
export type CameraISO = typeof isoStops[number];
export type CameraPreferences = { seconds:TimerSeconds; preset:FilmPreset; flash:boolean; iso?:CameraISO; loadStartedAt?:number };

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const lastISO=isoStops.length-1,lastStop=timerStops.length-1;
/** Bar position 0–1 to the nearest ISO stop. */
export const isoAt=(position:number)=>isoStops[Math.round(clamp(position,0,1)*lastISO)];
// Each timer mark is a quarter turn; Off sits under the pointer at 45°.
const DIAL_OFF=45,DIAL_END=DIAL_OFF-lastStop*90;
export const timerAngle=(seconds:TimerSeconds)=>DIAL_OFF-timerStops.indexOf(seconds)*90;
/** Dial angle to the nearest timer mark. */
export const timerSecondsAt=(angle:number)=>timerStops[Math.round(clamp((DIAL_OFF-angle)/90,0,lastStop))];

/** Eases the dial at a steady speed, so a long turn takes longer than a short one. */
function useDialRotation(target:number) {
  const [rotation,setRotation]=useState({target,duration:600});
  if(rotation.target!==target) {
    const next={target,duration:600*Math.abs(target-rotation.target)/90};
    setRotation(next);
    return next;
  }
  return rotation;
}

export function CameraReadout({seconds}:Pick<CameraPreferences,"seconds">) {
  return <div className="viewfinder-readout" aria-label="Camera settings">
    <span>Timer <b>{seconds?`${seconds}s`:"Off"}</b></span>
  </div>;
}

export default function CameraSettings({seconds,onSeconds,preset,onPreset,flash,onFlash,iso,onISO,disabled}: {
  seconds:TimerSeconds;onSeconds:(value:TimerSeconds)=>void;preset:FilmPreset;onPreset:(value:FilmPreset)=>void;
  flash:boolean;onFlash:(value:boolean)=>void;iso:CameraISO;onISO:(value:CameraISO)=>void;disabled:boolean;
}) {
  // While dragging, the needle and dial follow the finger; letting go eases them onto the nearest mark.
  const [slide,setSlide]=useState<number|null>(null);
  const [turn,setTurn]=useState<{pointer:number;angle:number}|null>(null);
  const press=useRef<{x:number;y:number;id:number}|null>(null),turned=useRef(false);
  const dialAngle=turn?.angle??timerAngle(seconds);
  const timerRotation=useDialRotation(dialAngle);
  /** Pointer x to a 0–1 position along the needle's travel; the value is the nearest stop. */
  const pick=(track:HTMLElement,x:number)=>{
    const box=track.getBoundingClientRect(),style=getComputedStyle(track);
    const start=box.left+parseFloat(style.paddingLeft||"0"),span=box.width-parseFloat(style.paddingLeft||"0")-parseFloat(style.paddingRight||"0");
    if(span<=0)return null;
    const position=clamp((x-start)/span,0,1),next=isoAt(position);
    if(next!==iso)onISO(next);
    return position;
  };
  const pointerAngle=(dial:HTMLElement,event:PointerEvent)=>{
    const box=dial.getBoundingClientRect();
    return Math.atan2(event.clientY-box.top-box.height/2,event.clientX-box.left-box.width/2)*180/Math.PI;
  };
  const endTurn=()=>{press.current=null;setTurn(null);};
  return <div className="camera-settings">
    <div className="camera-dials">
    <fieldset className="timer-control" disabled={disabled}>
      <div className={`timer-dial ${turn?"turning":""}`} style={{"--dial-duration":`${timerRotation.duration}ms`} as CSSProperties}
        onPointerDown={event=>{if(disabled||event.button!==0)return;turned.current=false;press.current={x:event.clientX,y:event.clientY,id:event.pointerId};}}
        onPointerMove={event=>{
          const start=press.current;
          if(disabled||!start||start.id!==event.pointerId)return;
          const dial=event.currentTarget,pointer=pointerAngle(dial,event);
          if(!turn){
            // A small wobble is still a tap on a printed mark.
            if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)return;
            dial.setPointerCapture?.(event.pointerId);turned.current=true;
            setTurn({pointer,angle:dialAngle});return;
          }
          let delta=pointer-turn.pointer;
          if(delta>180)delta-=360;
          if(delta< -180)delta+=360;
          // The dial turns between hard stops at Off and 10s, like a clockwork timer; the value is the nearest mark.
          const angle=clamp(turn.angle+delta,DIAL_END,DIAL_OFF);
          setTurn({pointer,angle});
          const next=timerSecondsAt(angle);
          if(next!==seconds)onSeconds(next);
        }}
        onPointerUp={endTurn} onPointerCancel={endTurn}>
        <i className="timer-pointer" aria-hidden="true"/><div className="timer-rotor" style={{transform:`rotate(${timerRotation.target}deg)`}}><i className="dial-hub" aria-hidden="true"/>
        {timerStops.map((value,index)=><button key={value} type="button" className={`timer-stop stop-${index}`} aria-pressed={seconds===value} onClick={()=>{if(turned.current){turned.current=false;return;}onSeconds(value);}}><span style={{transform:`rotate(${-timerRotation.target}deg)`}}>{value?`${value}s`:"OFF"}</span></button>)}
      </div>
      </div>
    </fieldset>
    <fieldset className="iso-control" disabled={disabled}>
      {/* Lighten/darken bar: the black arrow lowers ISO for bright light, the white arrow raises it for dim light. */}
      <div className={`iso-slider ${slide===null?"":"sliding"}`} style={{"--iso-position":slide??isoStops.indexOf(iso)/lastISO} as CSSProperties}>
        <div className="iso-track" role="slider" tabIndex={disabled?-1:0} aria-disabled={disabled||undefined} aria-valuemin={isoStops[0]} aria-valuemax={isoStops[lastISO]} aria-valuenow={iso}
          onPointerDown={event=>{if(disabled||event.button!==0)return;event.currentTarget.setPointerCapture?.(event.pointerId);pick(event.currentTarget,event.clientX);}}
          onPointerMove={event=>{if(!disabled&&event.currentTarget.hasPointerCapture?.(event.pointerId))setSlide(pick(event.currentTarget,event.clientX));}}
          onPointerUp={()=>setSlide(null)} onPointerCancel={()=>setSlide(null)}
          onKeyDown={event=>{
            if(disabled)return;
            const step=event.key==='ArrowUp'||event.key==='ArrowRight'?1:event.key==='ArrowDown'||event.key==='ArrowLeft'?-1:0;
            if(step||event.key==='Home'||event.key==='End'){
              event.preventDefault();onISO(isoStops[event.key==='Home'?0:event.key==='End'?lastISO:clamp(isoStops.indexOf(iso)+step,0,lastISO)]);
            }
          }}>
          <i className="iso-arrow iso-lighten" aria-hidden="true"/><i className="iso-arrow iso-darken" aria-hidden="true"/>
          <i className="iso-pointer" aria-hidden="true"/>
        </div>
      </div>
    </fieldset>
    </div>
    <fieldset className="film-presets" disabled={disabled}>{filmPresets.map((value,index)=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>onPreset(value)}><i className={`film-cartridge cartridge-${index}`} aria-hidden="true"/><span>{value}</span></button>)}</fieldset>
    <div className="flash-control">
      {/* A toggle on a metal plate: the bat points up for On and down for Off. */}
      <button type="button" className="flash-switch" role="switch" aria-label="Flash effect" aria-checked={flash} disabled={disabled} onClick={()=>onFlash(!flash)}>
        <span className="flash-position" aria-hidden="true">On</span>
        <span className="flash-toggle" aria-hidden="true"><Zap size={13} fill="currentColor"/><i className="flash-nut"><i className="flash-bat"/></i><i className="flash-led"/></span>
        <span className="flash-position" aria-hidden="true">Off</span>
      </button>
    </div>
  </div>;
}
