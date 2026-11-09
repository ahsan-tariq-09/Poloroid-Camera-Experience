import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Zap } from "lucide-react";
/** Printed marks on the timer dial; the dial can also rest between them. */
export const timerStops = [0,3,5,10] as const;
/** Whole seconds from 0 (off) to 10. */
export type TimerSeconds = number;
export const filmPresets = ["Classic","B&W","Film Grain","Faded"] as const;
export type FilmPreset = typeof filmPresets[number];
/** Printed marks on the ISO ruler, evenly spaced so 800 sits in the centre. */
export const isoStops = [100,400,800,1600,3200] as const;
/** Any whole ISO from 100 to 3200; values between marks follow the pointer. */
export type CameraISO = number;
export type CameraPreferences = { seconds:TimerSeconds; preset:FilmPreset; flash:boolean; iso?:CameraISO; loadStartedAt?:number };

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const lastISO=isoStops.length-1;
/** Ruler position 0–1 to ISO, geometric between neighbouring marks like a real exposure scale. */
export function isoAt(position:number) {
  const f=clamp(position,0,1)*lastISO,i=Math.min(lastISO-1,Math.floor(f));
  return Math.round(isoStops[i]*(isoStops[i+1]/isoStops[i])**(f-i));
}
export function isoPosition(iso:number) {
  const value=clamp(iso,isoStops[0],isoStops[lastISO]);
  let i=0;while(i<lastISO-1&&value>isoStops[i+1])i++;
  return (i+Math.log(value/isoStops[i])/Math.log(isoStops[i+1]/isoStops[i]))/lastISO;
}
// Each printed timer mark is a quarter turn; Off sits under the pointer at 45°.
const DIAL_OFF=45,DIAL_END=DIAL_OFF-(timerStops.length-1)*90;
export function timerAngle(seconds:number) {
  const value=clamp(seconds,0,timerStops[timerStops.length-1]);
  let i=0;while(i<timerStops.length-2&&value>timerStops[i+1])i++;
  return DIAL_OFF-(i+(value-timerStops[i])/(timerStops[i+1]-timerStops[i]))*90;
}
export function timerSecondsAt(angle:number) {
  const f=clamp((DIAL_OFF-angle)/90,0,timerStops.length-1),i=Math.min(timerStops.length-2,Math.floor(f));
  return Math.round(timerStops[i]+(timerStops[i+1]-timerStops[i])*(f-i));
}

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

export function CameraReadout({seconds,preset,iso=800}:Pick<CameraPreferences,"seconds"|"preset"|"iso">) {
  return <div className="viewfinder-readout" aria-label="Camera settings">
    <span>ISO <b>{iso}</b></span><span>Film <b>{preset}</b></span><span>Timer <b>{seconds?`${seconds}s`:"Off"}</b></span>
  </div>;
}

export default function CameraSettings({seconds,onSeconds,preset,onPreset,flash,onFlash,iso,onISO,disabled}: {
  seconds:TimerSeconds;onSeconds:(value:TimerSeconds)=>void;preset:FilmPreset;onPreset:(value:FilmPreset)=>void;
  flash:boolean;onFlash:(value:boolean)=>void;iso:CameraISO;onISO:(value:CameraISO)=>void;disabled:boolean;
}) {
  const [sliding,setSliding]=useState(false);
  // Turning: pointer angle last seen and the dial angle. Rest: where a turn was let go.
  const [turn,setTurn]=useState<{pointer:number;angle:number}|null>(null);
  const [rest,setRest]=useState<{seconds:number;angle:number}|null>(null);
  const press=useRef<{x:number;y:number;id:number}|null>(null),turned=useRef(false);
  const dialAngle=turn?.angle??(rest?.seconds===seconds?rest.angle:timerAngle(seconds));
  const timerRotation=useDialRotation(dialAngle);
  // The ISO pointer follows the finger along the ruler; the value is read from where it sits.
  const pick=(track:HTMLElement,x:number)=>{
    const box=track.getBoundingClientRect(),style=getComputedStyle(track);
    const start=box.left+parseFloat(style.paddingLeft||"0"),span=box.width-parseFloat(style.paddingLeft||"0")-parseFloat(style.paddingRight||"0");
    if(span<=0)return;
    const next=isoAt((x-start)/span);
    if(next!==iso)onISO(next);
  };
  const pointerAngle=(dial:HTMLElement,event:PointerEvent)=>{
    const box=dial.getBoundingClientRect();
    return Math.atan2(event.clientY-box.top-box.height/2,event.clientX-box.left-box.width/2)*180/Math.PI;
  };
  const endTurn=()=>{
    press.current=null;
    if(turn)setRest({seconds:timerSecondsAt(turn.angle),angle:turn.angle});
    setTurn(null);
  };
  return <div className="camera-settings">
    <div className="camera-dials">
    <fieldset className="timer-control" disabled={disabled}><legend>Self timer</legend>
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
          // The dial turns between hard stops at Off and 10s, like a clockwork timer.
          const angle=clamp(turn.angle+delta,DIAL_END,DIAL_OFF);
          setTurn({pointer,angle});
          const next=timerSecondsAt(angle);
          if(next!==seconds)onSeconds(next);
        }}
        onPointerUp={endTurn} onPointerCancel={endTurn}>
        <i className="timer-pointer" aria-hidden="true"/><div className="timer-rotor" style={{transform:`rotate(${timerRotation.target}deg)`}}><i className="dial-hub" aria-hidden="true"/>
        {timerStops.map((value,index)=><button key={value} type="button" className={`timer-stop stop-${index}`} aria-label={value?`Timer ${value} seconds`:"Timer off"} aria-pressed={seconds===value} onClick={()=>{if(turned.current){turned.current=false;return;}setRest(null);onSeconds(value);}}><span style={{transform:`rotate(${-timerRotation.target}deg)`}}>{value?`${value}s`:"OFF"}</span></button>)}
      </div>
      </div>
    </fieldset>
    <fieldset className="iso-control" disabled={disabled}><legend>ISO effect</legend>
      {/* Lighten/darken bar: the black arrow lowers ISO for bright light, the white arrow raises it for dim light. */}
      <div className={`iso-slider ${sliding?"sliding":""}`} style={{"--iso-position":isoPosition(iso)} as CSSProperties}>
        <div className="iso-track" role="slider" tabIndex={disabled?-1:0} aria-disabled={disabled||undefined} aria-label="ISO effect" aria-valuemin={isoStops[0]} aria-valuemax={isoStops[lastISO]} aria-valuenow={iso} aria-valuetext={`ISO ${iso}`}
          onPointerDown={event=>{if(disabled||event.button!==0)return;event.currentTarget.setPointerCapture?.(event.pointerId);pick(event.currentTarget,event.clientX);}}
          onPointerMove={event=>{if(!disabled&&event.currentTarget.hasPointerCapture?.(event.pointerId)){setSliding(true);pick(event.currentTarget,event.clientX);}}}
          onPointerUp={()=>setSliding(false)} onPointerCancel={()=>setSliding(false)}
          onKeyDown={event=>{
            if(disabled)return;
            // Keys jump to the next ISO stop from wherever the needle rests.
            const next=event.key==='Home'?isoStops[0]:event.key==='End'?isoStops[lastISO]
              :event.key==='ArrowUp'||event.key==='ArrowRight'?isoStops.find(mark=>mark>iso)??isoStops[lastISO]
              :event.key==='ArrowDown'||event.key==='ArrowLeft'?[...isoStops].reverse().find(mark=>mark<iso)??isoStops[0]:undefined;
            if(next!==undefined){event.preventDefault();onISO(next);}
          }}>
          <i className="iso-arrow iso-lighten" aria-hidden="true"/><i className="iso-arrow iso-darken" aria-hidden="true"/>
          <i className="iso-pointer" aria-hidden="true"/>
        </div>
      </div>
    </fieldset>
    </div>
    <fieldset className="film-presets" disabled={disabled}><legend>Film presets</legend>{filmPresets.map((value,index)=><button key={value} type="button" aria-pressed={preset===value} onClick={()=>onPreset(value)}><i className={`film-cartridge cartridge-${index}`} aria-hidden="true"/><span>{value}</span></button>)}</fieldset>
    <div className="flash-control"><span>Flash</span>
      {/* A toggle on a metal plate: the bat points up for On and down for Off. */}
      <button type="button" className="flash-switch" role="switch" aria-label="Flash effect" aria-checked={flash} disabled={disabled} onClick={()=>onFlash(!flash)}>
        <span className="flash-position" aria-hidden="true">On</span>
        <span className="flash-toggle" aria-hidden="true"><Zap size={13} fill="currentColor"/><i className="flash-nut"><i className="flash-bat"/></i><i className="flash-led"/></span>
        <span className="flash-position" aria-hidden="true">Off</span>
      </button>
    </div>
  </div>;
}
