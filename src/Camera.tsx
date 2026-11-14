import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useIsPresent } from "motion/react";
import InstantPrint from "./studio/InstantPrint";
import CameraSettings, { CameraReadout, type CameraISO, type TimerSeconds, type FilmPreset, type CameraPreferences } from "./studio/CameraSettings";
import SavePhotoButton from "./studio/SavePhotoButton";
import CameraPreview from "./studio/CameraPreview";
import MobileCameraScreen from "./studio/MobileCameraScreen";
import { applyCameraFilm } from "./studio/cameraFilm";
import { captureDate } from "./studio/captureDate";
import { openCamera, supportsTorch } from "./cameraMedia";
import { playSound, preloadSounds, unlockSound, stopSounds, FILM_LOAD_MS, SHUTTER_LEAD_MS } from "./sounds";
import { importPolaroid } from "./scrapbook";
import { exportFile as savePolaroid } from "./render";

type Polaroid = Awaited<ReturnType<typeof importPolaroid>>;
/** The one camera experience on every screen size: capture or upload, shake to reveal, then save or roll again. */
/** Shots in one film pack. */
const FILM_PACK=8;

export default function Camera({onUpload, enabled, initialSettings, navigation, upload}: {
  /** Desktop only; phones and tablets have no upload. */
  onUpload?: () => void; enabled: boolean;
  initialSettings?: CameraPreferences;
  navigation?: ReactNode;
  /** A chosen or dropped photo to print in place of a capture. A new id prints again. */
  upload?: {file: File; id: number} | null;
}) {
  const present = useIsPresent(), video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null);
  const container=useRef<HTMLDivElement>(null), alive=useRef(true), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const captureRunning=useRef(false), generation=useRef(0), urls=useRef<string[]>([]);
  const torch=useRef<MediaStreamTrack|null>(null);
  const [error,setError]=useState(""), [ready,setReady]=useState(false), [count,setCount]=useState<number|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">("user"), [shot,setShot]=useState(0);
  const [prints,setPrints]=useState<{file:File;url:string}[]>([]), [restart,setRestart]=useState(0);
  // The framed Polaroid that Save Photo exports, built from the same file as the print.
  const [polaroid,setPolaroid]=useState<Polaroid|null>(null), [saveError,setSaveError]=useState(""), [exporting,setExporting]=useState(false);
  const sheet=useRef(0);
  const [seconds,setSeconds]=useState<TimerSeconds>(initialSettings?.seconds ?? 0), [preset,setPreset]=useState<FilmPreset>(initialSettings?.preset ?? "Classic"), [flash,setFlash]=useState(initialSettings?.flash ?? false);
  const [screenFlash,setScreenFlash]=useState<false|"fade"|"steady">(false);
  const [iso,setISO]=useState<CameraISO>(initialSettings?.iso ?? 800);
  const motionEnabled=useRef(enabled);motionEnabled.current=enabled;
  const captured=prints.length>0, printShown=useRef(false);printShown.current=captured;
  useEffect(()=>{if(!enabled)setScreenFlash(false);},[enabled]);
  const [filmLoaded,setFilmLoaded]=useState(initialSettings?.loadStartedAt===undefined);
  const [loadingUntil,setLoadingUntil]=useState(initialSettings?.loadStartedAt===undefined?0:initialSettings.loadStartedAt+FILM_LOAD_MS);
  const loading=loadingUntil>0;
  // An 8-shot pack: each camera photo uses one, and loading film on an empty pack fits a fresh one.
  const [filmLeft,setFilmLeft]=useState(FILM_PACK);
  useEffect(()=>{
    if(!loadingUntil)return;
    const timeout=setTimeout(()=>{setLoadingUntil(0);setFilmLoaded(true);},Math.max(0,loadingUntil-performance.now()));
    return()=>clearTimeout(timeout);
  },[loadingUntil]);
  const clearPrint=()=>{sheet.current++;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];setPrints([]);setPolaroid(null);setSaveError("");};
  const roll=()=>{if(loading)return;if(filmLeft===0)setFilmLeft(FILM_PACK);setFilmLoaded(false);setLoadingUntil(performance.now()+FILM_LOAD_MS);void Promise.resolve(playSound("load")).then(()=>{if(alive.current)setLoadingUntil(performance.now()+FILM_LOAD_MS);});if(captured){container.current?.focus();clearPrint();setRestart(n=>n+1);}};
  /** After a saved photo, clear the print and reopen the live camera with the next shot loaded. */
  const finish=()=>{container.current?.focus();clearPrint();setFilmLoaded(filmLeft>0);setRestart(n=>n+1);};
  const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);};
  /** Shows a print and prepares its saved Polaroid. A later print or roll discards a late result. */
  const showPrint=(file:File,url:string,prepared?:Polaroid)=>{
    const id=++sheet.current;
    stop();setReady(false);setFilmLoaded(false);setPrints([{file,url}]);setPolaroid(prepared??null);setSaveError("");
    if(prepared)return;
    void importPolaroid(file,true).then(value=>{
      const owned=value.assets.photo.url;
      if(!alive.current||sheet.current!==id){if(owned.startsWith("blob:"))URL.revokeObjectURL(owned);return;}
      if(owned.startsWith("blob:"))urls.current.push(owned);
      setPolaroid(value);
    }).catch(()=>{if(alive.current&&sheet.current===id)setSaveError("This photo could not be prepared for saving. Roll again to take another.");});
  };
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
    if(!navigator.mediaDevices?.getUserMedia){setError("Camera capture needs HTTPS or localhost."); return()=>{alive.current=false;};}
    void openCamera(facing,()=>disposed || !alive.current).then(value=>{
      if(!value)return;
      // A stream that arrives after an upload printed stays off until Roll again.
      if(disposed || !alive.current || printShown.current){value.getTracks().forEach(t=>t.stop());return;}
      owned=value;stream.current=value;
      // An unplugged or reclaimed camera ends its track without rejecting anything.
      value.getTracks().forEach(track=>{track.onended=()=>{if(alive.current&&stream.current===value){setReady(false);setError("The camera stopped. Tap Retry camera to reconnect.");}};});
      if(video.current){video.current.srcObject=value;void playVideo();}
    }).catch(reason=>{if(!disposed)setError(reason?.name==="NotAllowedError"?"Camera permission was declined. Allow camera access in your browser settings, then retry.":reason?.name==="NotFoundError"?"No camera was found. Connect a camera and retry.":"Your camera is unavailable. Close other apps using it and retry.");});
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
    const hide=()=>{if(document.hidden&&captureRunning.current){generation.current++;setScreenFlash(false);if(torch.current){stop();setReady(false);}urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];if(timer.current)clearTimeout(timer.current);captureRunning.current=false;setCount(null);setShot(0);setError("Capture paused while this page was hidden. "+(torch.current?"Tap Retry camera to reconnect.":"Press the shutter to try again."));}};
    document.addEventListener("visibilitychange",hide);
    return ()=>document.removeEventListener("visibilitychange",hide);
  },[]);
  useEffect(()=>{
    if(!upload)return;
    let current=true;
    // An upload replaces any print or capture in progress.
    generation.current++;captureRunning.current=false;if(timer.current)clearTimeout(timer.current);setCount(null);setShot(0);setError("");clearPrint();
    const id=sheet.current;
    void importPolaroid(upload.file,true).then(value=>{
      const owned=value.assets.photo.url;
      if(!current||!alive.current||sheet.current!==id){if(owned.startsWith("blob:"))URL.revokeObjectURL(owned);return;}
      if(owned.startsWith("blob:"))urls.current.push(owned);
      showPrint(upload.file,owned,value);playSound("eject");
    }).catch(reason=>{if(current&&alive.current&&sheet.current===id)setError(upload.file.name+": "+(reason instanceof Error?reason.message:"Could not open this photo."));});
    return()=>{current=false;};
  },[upload]);
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
        if(lit||frontLight)await new Promise(resolve=>setTimeout(resolve,frontLight?300:200));
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
        const url=URL.createObjectURL(blob);urls.current.push(url);setFilmLeft(n=>Math.max(0,n-1));results.push({file:new File([blob],`camera-photo-${results.length+1}.png`,{type:"image/png",lastModified:capturedAt}),url});
        timer.current=setTimeout(()=>{
          if(!alive.current||!captureRunning.current||generation.current!==token)return;
          captureRunning.current=false;setShot(0);showPrint(results[0].file,results[0].url);
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
  const save=async()=>{
    if(!polaroid)return;
    setExporting(true);setSaveError("");
    try{await savePolaroid(polaroid.assets,polaroid.composition,"jpeg");if(alive.current)finish();}
    catch(reason){if(alive.current)setSaveError(reason instanceof Error?reason.message:"Your photo could not be saved. Try again.");}
    finally{if(alive.current)setExporting(false);}
  };
  const settings=<CameraSettings seconds={seconds} onSeconds={setSeconds} preset={preset} onPreset={setPreset} flash={flash} onFlash={setFlash} iso={iso} onISO={setISO} disabled={shot>0}/>;
  const saveControls=<div className="print-save">
    {polaroid?<SavePhotoButton studio={{assets:polaroid.assets,composition:polaroid.composition,format:"jpeg",busy:false,exporting,exportFile:save}} onSaved={finish}/>:!saveError&&<button className="primary-button download-main" disabled>Preparing…</button>}
    {saveError&&<p className="field-hint save-error" role="alert">{saveError}</p>}
  </div>;
  const print=captured?<InstantPrint photos={prints.map(p=>({src:p.url,alt:"Your captured photo"}))} caption={captureDate(prints[0].file.lastModified)} enabled={enabled} actions={saveControls}/>:undefined;
  const viewfinder=<>
    <video ref={video} autoPlay playsInline muted style={{transform:facing==="user"?"scaleX(-1)":undefined}} onLoadedData={markReady} onPlaying={markReady}/>
    {ready&&!captured&&<CameraPreview video={video} preset={preset} iso={iso} flash={flash} mirrored={facing==="user"}/>}
    <CameraReadout seconds={seconds} preset={preset} iso={iso}/>
    {count!==null&&<span className="countdown" aria-live="assertive">{count}</span>}
  </>;
  const captureFlash=screenFlash==="steady"?createPortal(<div className="capture-flash" aria-hidden="true"/>,document.body):enabled&&screenFlash&&createPortal(<motion.div className="capture-flash" aria-hidden="true" initial={{opacity:.35}} animate={{opacity:0}} transition={{duration:.3,ease:"easeOut"}} onAnimationComplete={()=>setScreenFlash(false)}/>,document.body);
  const retry=!captured&&error&&!ready&&<button className="secondary-button" onClick={()=>{if(stream.current&&!stream.current.getTracks().some(track=>track.readyState==="ended"))void playVideo();else setRestart(n=>n+1);}}>Retry camera</button>;
  return <MobileCameraScreen containerRef={container} navigation={navigation} viewfinder={viewfinder} settings={settings} print={print} flash={captureFlash} retry={retry}
    captured={captured} disabled={!ready||!filmLoaded||shot>0||captured} taking={shot>0} loading={loading} loaded={filmLoaded} ready={ready} filmLeft={filmLeft} onRoll={roll}
    notice={!captured ? error || (!ready ? "Waiting for the camera. Allow access if your browser asks." : "") : ""}
    status={error&&!ready&&!captured?"CAMERA UNAVAILABLE":loading?"LOADING FILM":shot?"HOLD STILL":captured?"PRINT READY":ready?"READY":error?"CAMERA UNAVAILABLE":"CONNECTING"}
    onShutter={take} onFlip={()=>setFacing(f=>f==="user"?"environment":"user")} onUpload={onUpload}/>;
}
