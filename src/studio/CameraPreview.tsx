import { useEffect, useRef, useState, type RefObject } from "react";
import type { CameraISO, FilmPreset } from "./CameraSettings";
import { applyCameraFilm } from "./cameraFilm";

/** The saved photo uses this same film processing at the source resolution. */
export default function CameraPreview({video,preset,iso,flash,mirrored}: {
  video:RefObject<HTMLVideoElement|null>;preset:FilmPreset;iso:CameraISO;flash:boolean;mirrored:boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const target=canvas.current,ctx=target?.getContext("2d",{willReadFrequently:true});
    setError(false);
    if(!target||!ctx){setError(true);return;}
    const source=video.current;
    if(!source)return;
    const videoFrames=typeof source.requestVideoFrameCallback === "function";
    let frame=0,last=-Infinity;
    const schedule=()=>{frame=videoFrames?source.requestVideoFrameCallback(draw):requestAnimationFrame(draw);};
    const draw=(now:number)=>{
      if(!document.hidden&&source.videoWidth&&source.videoHeight&&(videoFrames||now-last>=1000/30)){
        last=now;
        try{
          const size=Math.min(source.videoWidth,source.videoHeight);
          // Keep live processing light; capture still uses the full source resolution.
          const edge=Math.min(256,size);
          if(target.width!==edge||target.height!==edge)target.width=target.height=edge;
          ctx.drawImage(source,(source.videoWidth-size)/2,(source.videoHeight-size)/2,size,size,0,0,edge,edge);
          ctx.putImageData(applyCameraFilm(ctx.getImageData(0,0,edge,edge),preset,flash,iso),0,0);
          target.style.visibility="visible";
        }catch{target.style.visibility="hidden";setError(true);return;}
      }
      schedule();
    };
    schedule();
    return()=>{if(videoFrames)source.cancelVideoFrameCallback(frame);else cancelAnimationFrame(frame);};
  },[video,preset,iso,flash]);
  return <><canvas ref={canvas} className="live-film-preview" aria-hidden="true" style={{visibility:"hidden",transform:mirrored?"scaleX(-1)":undefined}}/>{error&&<span className="preview-effect-error" role="status">Film preview unavailable. Effects will still apply to your photo.</span>}</>;
}
