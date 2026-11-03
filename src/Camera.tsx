import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, Upload, ArrowRight, Check } from "lucide-react";
import { motion, useIsPresent } from "motion/react";
import InstantCamera from "./studio/InstantCamera";
import InstantPrint from "./studio/InstantPrint";
import CameraSettings, { CameraReadout, type CameraISO, type TimerSeconds, type FilmPreset, type CameraPreferences } from "./studio/CameraSettings";
import CameraPreview from "./studio/CameraPreview";
import MobileCameraScreen from "./studio/MobileCameraScreen";
import { applyCameraFilm } from "./studio/cameraFilm";
import { captureDate } from "./studio/captureDate";
import { openCamera, supportsTorch } from "./cameraMedia";
import { playSound, preloadSounds, unlockSound, stopSounds, FILM_LOAD_MS, SHUTTER_LEAD_MS } from "./sounds";

export type CaptureDestination = "edit" | "finish";
export default function Camera({onClose, onCapture, onUpload, enabled, initialSettings, presentation="dialog", navigation, busy=false}: {
  onClose: () => void; onCapture: (files: File[], destination: CaptureDestination) => void;
  onUpload: () => void; enabled: boolean;
  initialSettings?: CameraPreferences;
  /** dialog: modal over a page; screen: full-screen mobile camera; page: the desktop home. */
  presentation?: "dialog" | "screen" | "page";
  navigation?: ReactNode;
  busy?: boolean;
}) {
  const present = useIsPresent(), video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null);
  const container=useRef<HTMLDivElement>(null), alive=useRef(true), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const captureRunning=useRef(false), generation=useRef(0), urls=useRef<string[]>([]);
  const torch=useRef<MediaStreamTrack|null>(null);
  const [error,setError]=useState(""), [ready,setReady]=useState(false), [count,setCount]=useState<number|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("user"), [shot,setShot]=useState(0);
  const [prints,setPrints]=useState<{file:File;url:string}[]>([]), [revealed,setRevealed]=useState(false), [restart,setRestart]=useState(0);
  const [seconds,setSeconds]=useState<TimerSeconds>(initialSettings?.seconds ?? 3), [preset,setPreset]=useState<FilmPreset>(initialSettings?.preset ?? "Classic"), [flash,setFlash]=useState(initialSettings?.flash ?? false);
  const [screenFlash,setScreenFlash]=useState<false|"fade"|"steady">(false);
  const [iso,setISO]=useState<CameraISO>(initialSettings?.iso ?? 800);
  const motionEnabled=useRef(enabled);motionEnabled.current=enabled;
  const captured=prints.length>0;
  useEffect(()=>{if(!enabled)setScreenFlash(false);},[enabled]);
  const [filmLoaded,setFilmLoaded]=useState(presentation==="screen" || Boolean(initialSettings)&&initialSettings?.loadStartedAt===undefined);
  const [loadingUntil,setLoadingUntil]=useState(initialSettings?.loadStartedAt===undefined?0:initialSettings.loadStartedAt+FILM_LOAD_MS);
  const loading=loadingUntil>0;
  useEffect(()=>{
    if(!loadingUntil)return;
    const timeout=setTimeout(()=>{setLoadingUntil(0);setFilmLoaded(true);},Math.max(0,loadingUntil-performance.now()));
    return()=>clearTimeout(timeout);
  },[loadingUntil]);
  const roll=()=>{if(loading)return;setFilmLoaded(false);setLoadingUntil(performance.now()+FILM_LOAD_MS);void Promise.resolve(playSound("load")).then(()=>{if(alive.current)setLoadingUntil(performance.now()+FILM_LOAD_MS);});if(captured){container.current?.focus();urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];setPrints([]);setRevealed(false);setRestart(n=>n+1);}};
  const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);};
  const releaseTorch=async(track:MediaStreamTrack)=>{
    try{
      await track.applyConstraints({advanced:[{torch:false} as MediaTrackConstraintSet]});
      if((track.getSettings() as MediaTrackSettings & {torch?:boolean}).torch)throw new Error("Camera light is still on");
    }
    catch{
      // Stop the track if the browser cannot extinguish its light.
      track.stop();
      if(alive.current&&stream.current?.getTracks().includes(track)){setReady(false);setError("Camera light could not be turned off. Tap Retry camera to reconnect.");}
    }finally{if(torch.current===track)torch.current=null;}
  };
  const markReady=()=>{
    const target=video.current;
    if(alive.current&&stream.current&&target?.srcObject===stream.current&&!target.paused&&target.readyState>=2&&target.videoWidth>0&&target.videoHeight>0){setReady(true);setError("");}
  };
  const playVideo=async()=>{
    const target=video.current,owned=stream.current;if(!target||!owned)return;
    target.muted=true;target.playsInline=true;setError("");
    try{await target.play();if(stream.current===owned)markReady();}
    catch{if(alive.current&&stream.current===owned){setReady(false);setError("Camera playback was paused or blocked. Tap Retry camera to start it.");}}
  };
  useEffect(()=>{
    alive.current=present; setReady(false); setError(""); if (!present) return; let disposed=false; let owned:MediaStream|null=null;
    if(!navigator.mediaDevices?.getUserMedia){setError("Camera capture needs HTTPS or localhost. Upload a photo to keep creating."); return()=>{alive.current=false;};}
    void openCamera(facing,()=>disposed || !alive.current).then(value=>{
      if(!value)return;
      if(disposed || !alive.current){value.getTracks().forEach(t=>t.stop());return;}
      owned=value;stream.current=value;
      // An unplugged or reclaimed camera ends its track without rejecting anything.
      value.getTracks().forEach(track=>{track.onended=()=>{if(alive.current&&stream.current===value){setReady(false);setError("The camera stopped. Tap Retry camera to reconnect.");}};});
      if(video.current){video.current.srcObject=value;void playVideo();}
    }).catch(reason=>{if(!disposed)setError(reason?.name==="NotAllowedError"?"Camera permission was declined. Allow camera access in your browser settings, then retry.":reason?.name==="NotFoundError"?"No camera was found. Connect a camera and retry, or upload a photo.":"Your camera is unavailable. Close other apps using it and retry, or upload a photo.");});
    const target=video.current;
    return ()=>{disposed=true;alive.current=false;generation.current++;captureRunning.current=false;owned?.getTracks().forEach(t=>t.stop());if(target?.srcObject===owned)target.srcObject=null;if(stream.current===owned)stream.current=null;if(timer.current)clearTimeout(timer.current);};
  },[facing,restart,present]);
  useEffect(()=>{
    void preloadSounds();
    const previous=document.activeElement as HTMLElement|null;container.current?.focus();
    return ()=>{queueMicrotask(()=>{if(!alive.current)stopSounds();});urls.current.forEach(url=>URL.revokeObjectURL(url));previous?.focus();};
  },[]);
  useEffect(()=>{if(!present){alive.current=false;stop();}},[present]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(presentation!=="dialog")return;
      if(e.key==="Escape"){e.preventDefault();onClose();}
      if(e.key!=="Tab")return;
      const controls=container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,[tabindex="0"]');
      if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===container.current)){e.preventDefault();first.focus();}
    };
    const hide=()=>{if(document.hidden&&captureRunning.current){generation.current++;setScreenFlash(false);if(torch.current){stop();setReady(false);}urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];if(timer.current)clearTimeout(timer.current);captureRunning.current=false;setCount(null);setShot(0);setError("Capture paused while this page was hidden. "+(torch.current?"Tap Retry camera to reconnect.":"Press the shutter to try again."));}};
    document.addEventListener("keydown",key);document.addEventListener("visibilitychange",hide);
    return ()=>{document.removeEventListener("keydown",key);document.removeEventListener("visibilitychange",hide);};
  },[onClose,presentation]);
  const take=()=>{
    if(captureRunning.current||!ready||!filmLoaded)return;
    unlockSound();setError("");captureRunning.current=true;setShot(1);const token=++generation.current;
    const results:{file:File;url:string}[]=[];
    const fail=(message:string)=>{captureRunning.current=false;setScreenFlash(false);setCount(null);setShot(0);setError(message);results.forEach(p=>{URL.revokeObjectURL(p.url);urls.current=urls.current.filter(url=>url!==p.url);});};
    const captureFrame=async()=>{
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      const v=video.current;
      if(!v?.videoWidth||!v.videoHeight){fail("The camera is still warming up. Try the shutter again.");return;}
      // Match the centered square preview without stretching the source.
      const canvas=document.createElement("canvas");canvas.width=canvas.height=Math.min(v.videoWidth,v.videoHeight);
      const ctx=canvas.getContext("2d");
      if(!ctx){fail("That photo could not be captured. Try again.");return;}
      const capturedAt=Date.now();
      const track=stream.current?.getVideoTracks?.()[0];
      const rearCamera=(track?.getSettings?.().facingMode??facing)==="environment";
      let lightTrack:MediaStreamTrack|null=null;
      // Reduced motion lights the subject with a steady screen instead of the fading flash.
      const frontLight=flash&&!rearCamera&&!motionEnabled.current;
      try{
        let lit=false;
        if(flash&&rearCamera){
          try{
            if(track&&track.getSettings().facingMode!=="user"&&supportsTorch(track)){
              lightTrack=track;torch.current=track;
              // Chrome rejects torch commands mixed with camera-selection constraints.
              await track.applyConstraints({advanced:[{torch:true} as MediaTrackConstraintSet]});
              lit=(track.getSettings() as MediaTrackSettings & {torch?:boolean}).torch===true;
            }
          }catch{/* Report unsupported or rejected light requests below. */}
        }
        if(!alive.current||!captureRunning.current||generation.current!==token)return;
        if(flash&&rearCamera&&!lit){fail("Rear-camera flash is unavailable. Turn Flash off to take a photo.");return;}
        // Let the light reach the next camera frame before sampling it.
        if(frontLight)setScreenFlash("steady");
        if(lit||frontLight)await new Promise(resolve=>setTimeout(resolve,200));
        if(!alive.current||!captureRunning.current||generation.current!==token)return;
        if(facing==="user"){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
        ctx.drawImage(v,(v.videoWidth-canvas.width)/2,(v.videoHeight-canvas.height)/2,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
        ctx.putImageData(applyCameraFilm(ctx.getImageData(0,0,canvas.width,canvas.height),preset,flash,iso),0,0);
      }catch{fail("That photo could not be captured. Try again.");return;}
      finally{if(frontLight)setScreenFlash(false);if(lightTrack)await releaseTorch(lightTrack);}
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      await playSound("shutter");
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      if(flash&&!rearCamera&&motionEnabled.current)setScreenFlash("fade");
      setCount(null);
      const printAt=performance.now()+SHUTTER_LEAD_MS;
      canvas.toBlob(blob=>{
        if(!alive.current||!captureRunning.current||generation.current!==token)return;
        if(!blob){fail("That photo could not be captured. Try again.");return;}
        const url=URL.createObjectURL(blob);urls.current.push(url);results.push({file:new File([blob],`camera-photo-${results.length+1}.png`,{type:"image/png",lastModified:capturedAt}),url});
        timer.current=setTimeout(()=>{
          if(!alive.current||!captureRunning.current||generation.current!==token)return;
          captureRunning.current=false;setPrints(results);setFilmLoaded(false);setShot(0);stop();setReady(false);
        },Math.max(0,printAt-performance.now()));
      },"image/png");
    };
    const countdown=(n:number)=>{
      if(!alive.current||!captureRunning.current||generation.current!==token)return;
      if(n===0){captureFrame();return;}
      setCount(n);playSound("tick");
      timer.current=setTimeout(()=>countdown(n-1),1000);
    };countdown(seconds);
  };
  const settings=<CameraSettings seconds={seconds} onSeconds={setSeconds} preset={preset} onPreset={setPreset} flash={flash} onFlash={setFlash} iso={iso} onISO={setISO} disabled={shot>0}/>;
  const print=captured?<InstantPrint photos={prints.map(p=>({src:p.url,alt:"Your captured photo"}))} caption={captureDate(prints[0].file.lastModified)} enabled={enabled} onReveal={()=>setRevealed(true)} onRetake={roll}/>:undefined;
  const viewfinder=<>
    <video ref={video} autoPlay playsInline muted style={{transform:facing==="user"?"scaleX(-1)":undefined}} onLoadedData={markReady} onPlaying={markReady}/>
    {ready&&!captured&&<CameraPreview video={video} preset={preset} iso={iso} flash={flash} mirrored={facing==="user"}/>}
    <CameraReadout seconds={seconds} preset={preset} iso={iso}/>
    {!captured&&presentation!=="screen"&&<span className={!ready||error?"camera-message":"sr-only"} role="status">{error||(!ready?"Waiting for the camera. Allow access if your browser asks.":loading?"Loading film…":filmLoaded?"Film loaded. Click the shutter.":"Camera ready. Roll the film, then click the shutter.")}</span>}
    {count!==null&&<span className="countdown" aria-live="assertive">{count}</span>}
  </>;
  const decisions=captured&&revealed&&<div className="capture-decisions"><button className="primary-button" disabled={busy} onClick={()=>onCapture(prints.map(p=>p.file),"edit")}>Develop <ArrowRight size={17}/></button><button className="secondary-button" disabled={busy} onClick={()=>onCapture(prints.map(p=>p.file),"finish")}><Check size={17}/> Done</button></div>;
  const captureFlash=screenFlash==="steady"?createPortal(<div className="capture-flash" aria-hidden="true"/>,document.body):enabled&&screenFlash&&createPortal(<motion.div className="capture-flash" aria-hidden="true" initial={{opacity:.35}} animate={{opacity:0}} transition={{duration:.32,ease:"easeOut"}} onAnimationComplete={()=>setScreenFlash(false)}/>,document.body);
  const retry=!captured&&error&&!ready&&<button className="secondary-button" onClick={()=>{if(stream.current&&!stream.current.getTracks().some(track=>track.readyState==="ended"))void playVideo();else setRestart(n=>n+1);}}>Retry camera</button>;
  if(presentation==="screen")return <MobileCameraScreen containerRef={container} navigation={navigation} viewfinder={viewfinder} settings={settings} print={print} decisions={decisions} flash={captureFlash} retry={retry}
    captured={captured} disabled={!ready||!filmLoaded||shot>0||captured||busy} taking={shot>0} loading={loading} loaded={filmLoaded} ready={ready} onRoll={roll}
    notice={!captured ? error || (!ready ? "Waiting for the camera. Allow access if your browser asks." : "") : ""}
    status={error&&!ready?"CAMERA UNAVAILABLE":loading?"LOADING FILM":shot?"HOLD STILL":ready?"READY":error?"CAMERA UNAVAILABLE":"CONNECTING"}
    onShutter={take} onFlip={()=>setFacing(f=>f==="user"?"environment":"user")} onUpload={onUpload}/>;
  const page=presentation==="page", Heading=page?"h1":"h2";
  const experience=<div ref={container} tabIndex={-1} className={`camera-modal camera-experience ${captured?"has-print":""}`} role={page?undefined:"dialog"} aria-modal={page?undefined:"true"} aria-labelledby="camera-title">
      <div className="capture-heading"><div><Heading id="camera-title" tabIndex={page?-1:undefined}>{captured?"A moment, on paper.":"Take a photo"}</Heading>{!captured&&<p>{filmLoaded?"Film loaded. Choose your settings, then press the shutter.":"Choose your settings, roll the film, then press the shutter."}</p>}</div>{!page&&<button className="icon-button" aria-label="Close camera" onClick={onClose}><X size={20}/></button>}</div>
      <InstantCamera printed={captured} print={print}
        settings={settings}
        onRoll={roll} rollDisabled={loading||shot>0||(!ready&&!captured)} loading={loading} loaded={filmLoaded} ready={ready} onShutter={take} disabled={!ready||!filmLoaded||shot>0||captured} label="Capture" status={error&&!ready&&!captured?"CAMERA UNAVAILABLE":loading?"LOADING FILM":captured?"PRINT READY":shot?"TAKING PHOTO":ready?(filmLoaded?"READY":"ROLL TO LOAD FILM"):error?"CAMERA UNAVAILABLE":"CONNECTING CAMERA"} controls={!captured?<button className="camera-flip" aria-label="Flip camera" disabled={shot>0} onClick={()=>setFacing(f=>f==="user"?"environment":"user")}><RefreshCw size={18}/></button>:undefined}>
        {viewfinder}
      </InstantCamera>
      {decisions}
      {captureFlash}
      {!captured&&<div className="camera-alternatives">{retry}<button className="text-button camera-upload" onClick={onUpload}><Upload size={15}/> Upload a photo instead</button></div>}
    </div>;
  if(page)return <div className="camera-home">{experience}</div>;
  return <motion.div className="modal-backdrop camera-backdrop" initial={enabled?{opacity:0}:false} animate={{opacity:1}} exit={enabled?{opacity:0,transition:{duration:.15}}:undefined} transition={{duration:enabled?.25:0,ease:[.22,1,.36,1]}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    {experience}
  </motion.div>;
}
