// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import Camera from "./Camera";
import * as sounds from "./sounds";
vi.mock("./studio/CameraPreview",()=>({default:()=>null}));
const saved=vi.hoisted(()=>({exportFile:vi.fn(),importPolaroid:vi.fn()}));
vi.mock("./render",async original=>({...await original<typeof import("./render")>(),exportFile:saved.exportFile}));
vi.mock("./scrapbook",()=>({importPolaroid:saved.importPolaroid}));
beforeEach(()=>{
  saved.exportFile.mockReset().mockResolvedValue(undefined);
  saved.importPolaroid.mockReset().mockImplementation(async(file:File)=>({assets:{photo:{name:file.name,url:`blob:asset-${file.name}`,width:480,height:480,image:{}}},composition:{caption:"framed"}}));
});

beforeEach(()=>{
  vi.spyOn(HTMLMediaElement.prototype,"play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype,"paused","get").mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype,"readyState","get").mockReturnValue(2);
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
});

it.each(["front","front-reduced","rear","unsupported","rejected","ignored","reduced","off","wrong-facing","draw-failure","off-failure","off-ignored","hidden","hidden-screen","unmount","late-enable"])("captures with safe flash illumination: %s",async scenario=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.useFakeTimers();
  let lit=false,actualFacing="user",finishEnable:(()=>void)|undefined;
  const events:string[]=[],stop=vi.fn(()=>{lit=false;events.push("stop");});
  const track={stop,readyState:"live",getConstraints:()=>({facingMode:{ideal:"environment"}}),getCapabilities:()=>({torch:scenario==="unsupported"?false:[false,true]}),getSettings:()=>({facingMode:scenario==="wrong-facing"?"user":actualFacing,torch:lit}),applyConstraints:vi.fn(async(constraints:MediaTrackConstraints)=>{
    // Chrome rejects mixed camera-selection and image-capture constraints.
    if(constraints.facingMode)throw new DOMException("Mixed camera and image constraints","OverconstrainedError");
    const value=(constraints.advanced![0] as MediaTrackConstraintSet & {torch:boolean}).torch;
    events.push(value?"on":"off");
    if(value&&scenario==="rejected"||!value&&scenario==="off-failure")throw new Error("unsupported");
    if(value&&scenario==="late-enable")await new Promise<void>(resolve=>{finishEnable=resolve;});
    if(!value&&scenario==="off-ignored")return;
    lit=value&&scenario!=="ignored";
  })};
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn(async(options)=>{actualFacing=options.video.facingMode.ideal;return {getTracks:()=>[track],getVideoTracks:()=>[track]};})}});
  const draw=vi.fn(()=>{expect(Boolean(document.querySelector(".capture-flash"))).toBe(scenario==="front-reduced");events.push("draw");if(scenario==="draw-failure")throw new Error("frame unavailable");});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:draw,translate:vi.fn(),scale:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:vi.fn()} as never);
  const blob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["frame"])));
  vi.spyOn(sounds,"playSound").mockResolvedValue();
  URL.createObjectURL=vi.fn(()=>"blob:flash");URL.revokeObjectURL=vi.fn();
  const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(false);
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  const click=async(label:string)=>act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  try{
    await act(async()=>root.render(<Camera enabled={!scenario.includes("reduced")} initialSettings={{seconds:0,preset:"Classic",flash:scenario!=="off",iso:800}} onUpload={()=>{}}/>));
    if(!["front","front-reduced","hidden-screen"].includes(scenario))await click("Flip camera");
    events.length=0;stop.mockClear();
    await click("Capture");
    const screen=["front","wrong-facing","hidden-screen"].includes(scenario);
    expect(Boolean(document.querySelector(".capture-flash"))).toBe(screen||scenario==="front-reduced");
    if(screen){expect(draw).toHaveBeenCalledOnce();expect(document.querySelector(".capture-flash")!.parentElement).toBe(document.body);expect((document.querySelector(".capture-flash") as HTMLElement).style.opacity).toBe("0.35");}
    if(scenario==="hidden"||scenario==="hidden-screen"||scenario==="late-enable"){
      hidden.mockReturnValue(true);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));
      if(scenario!=="hidden-screen")expect(stop).toHaveBeenCalled();expect(document.querySelector(".capture-flash")).toBeNull();
    }
    if(scenario==="unmount")await act(async()=>root.unmount());
    if(scenario==="late-enable")await act(async()=>finishEnable!());
    const unavailable=["unsupported","rejected","ignored"].includes(scenario);
    if(!screen&&!unavailable&&scenario!=="off"){
      expect(draw).not.toHaveBeenCalled();
      await act(async()=>vi.advanceTimersByTimeAsync(scenario==="front-reduced"?299:199));expect(draw).not.toHaveBeenCalled();
      await act(async()=>vi.advanceTimersByTimeAsync(1));
    }
    if(scenario==="front-reduced")expect(document.querySelector(".capture-flash")).toBeNull();
    expect(lit).toBe(false);
    if(unavailable){
      expect(draw).not.toHaveBeenCalled();expect(blob).not.toHaveBeenCalled();expect(host.textContent).toContain("Turn Flash off");
      await click("Flash effect");await click("Capture");expect(blob).toHaveBeenCalledOnce();
    }
    else if(["hidden","unmount","late-enable"].includes(scenario)){expect(draw).not.toHaveBeenCalled();expect(blob).not.toHaveBeenCalled();}
    else{
      expect(draw).toHaveBeenCalledOnce();
      if(["front","front-reduced","off","wrong-facing","hidden-screen"].includes(scenario))expect(track.applyConstraints).not.toHaveBeenCalled();
      else expect(events.indexOf("off")).toBeGreaterThan(events.indexOf("draw"));
      if(scenario==="draw-failure"){expect(blob).not.toHaveBeenCalled();expect(host.textContent).toContain("could not be captured");}
      else expect(blob).toHaveBeenCalledOnce();
      if(scenario==="off-failure"||scenario==="off-ignored")expect(stop).toHaveBeenCalled();
    }
  }finally{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();}
});

it("opens the camera screen ready to capture and keeps its stream while using visible controls",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener(){},removeEventListener(){}}));
  const stop=vi.fn(),getUserMedia=vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(host.querySelector("main.mobile-camera")).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(false);
    const video=host.querySelector("video");
    expect(host.querySelector('button[aria-label="Camera settings"]')).toBeNull();
    await act(async()=>host.querySelector('[aria-label="ISO effect"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
    expect(host.querySelector('[role="slider"]')!.getAttribute('aria-valuenow')).toBe('1600');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector("video")).toBe(video);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(host.querySelector('[aria-label="Close camera"]')).toBeNull();
    await act(async()=>root.unmount());expect(stop).toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it.each([true,false])("keeps sound through Strict Mode replay and stops it on unmount (camera API available: %s)",async available=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:available?{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}:undefined});
  const stopSounds=vi.spyOn(sounds,"stopSounds");
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<StrictMode><Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800,loadStartedAt:performance.now()}} enabled={false} onUpload={()=>{}}/></StrictMode>));
    if(available)expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(stopSounds).not.toHaveBeenCalled();
    await act(async()=>root.unmount());
    expect(stopSounds).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("offers a gesture retry when inline camera playback is blocked",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const stop=vi.fn(),media={getTracks:()=>[{stop}]},getUserMedia=vi.fn().mockResolvedValue(media);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  const play=vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("Blocked","NotAllowedError"));
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800}} enabled={false} onUpload={()=>{}}/>));
    expect(host.textContent).toContain("Tap Retry camera");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(true);
    const source=host.querySelector("video")!;
    expect(source.muted).toBe(true);expect(source.playsInline).toBe(true);
    await act(async()=>[...host.querySelectorAll("button")].find(button=>button.textContent==="Retry camera")!.click());
    expect(play).toHaveBeenCalledTimes(2);expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(false);
    await act(async()=>root.unmount());
    expect(stop).toHaveBeenCalled();expect(source.srcObject).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("does not arm the shutter until video is playing with a decoded frame",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const paused=vi.spyOn(HTMLMediaElement.prototype,"paused","get").mockReturnValue(true);
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800}} enabled={false} onUpload={()=>{}}/>));
    const source=host.querySelector("video")!,shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    await act(async()=>source.dispatchEvent(new Event("loadeddata")));
    expect(shutter.disabled).toBe(true);
    paused.mockReturnValue(false);Object.defineProperty(source,"videoWidth",{configurable:true,value:0});
    await act(async()=>source.dispatchEvent(new Event("playing")));expect(shutter.disabled).toBe(true);
    Object.defineProperty(source,"videoWidth",{configurable:true,value:640});
    await act(async()=>source.dispatchEvent(new Event("playing")));expect(shutter.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("replaces the connecting status when camera permission is denied",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new DOMException("Denied","NotAllowedError"))}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("CAMERA UNAVAILABLE");
    expect(host.querySelector('[role="status"]')!.textContent).toContain("permission was declined");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(true);
    expect([...host.querySelectorAll('button')].find(b=>b.getAttribute("aria-label")==="Upload photos")!.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("requests camera access again after a permission failure",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const getUserMedia=vi.fn().mockRejectedValueOnce(new DOMException("Denied","NotAllowedError")).mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    await act(async()=>[...host.querySelectorAll("button")].find(button=>button.textContent==="Retry camera")!.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("READY");
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("ignores an old playback failure after switching cameras and releases both streams",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const oldStop=vi.fn(),newStop=vi.fn(),oldStream={getTracks:()=>[{stop:oldStop}]},newStream={getTracks:()=>[{stop:newStop}]};
  const getUserMedia=vi.fn().mockResolvedValueOnce(oldStream).mockResolvedValueOnce(newStream);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia}});
  let rejectOld!:(error:Error)=>void;
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;}));
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Flip camera"]')!.click());
    expect(oldStop).toHaveBeenCalled();
    await act(async()=>rejectOld(new DOMException("Interrupted","AbortError")));
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("READY");
    const source=host.querySelector("video")!;expect(source.srcObject).toBe(newStream);
    await act(async()=>root.unmount());expect(newStop).toHaveBeenCalled();expect(source.srcObject).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("starts with the settings and loaded film chosen on the home camera",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:5,preset:"B&W",flash:true,iso:1600}} enabled={false} onUpload={()=>{}}/>));
    await act(async()=>host.querySelector('video')!.dispatchEvent(new Event('loadeddata',{bubbles:true})));
    expect(host.querySelector('[aria-label="Timer 5 seconds"]')!.getAttribute('aria-pressed')).toBe('true');
    expect([...host.querySelectorAll('button')].find(b=>b.textContent==='B&W')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[aria-label="Flash effect"]')!.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('[aria-label="ISO effect"]')!.getAttribute('aria-valuenow')).toBe('1600');
    expect(host.querySelector('.viewfinder-readout')!.textContent).toContain('1600');
    expect(host.querySelector('[aria-label="Load film"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.disabled).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it("keeps the shutter and film roll disabled for the full 2.8-second load",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  vi.useFakeTimers();
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!,roll=host.querySelector<HTMLButtonElement>('[aria-label="Load film"]')!;
    await act(async()=>roll.click());
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("LOADING FILM");
    expect(roll.disabled).toBe(true);expect(shutter.disabled).toBe(true);
    await act(async()=>vi.advanceTimersByTimeAsync(2799));
    expect(shutter.disabled).toBe(true);expect(roll.getAttribute('aria-pressed')).toBe('false');
    await act(async()=>vi.advanceTimersByTimeAsync(1));
    expect(shutter.disabled).toBe(false);expect(roll.disabled).toBe(false);expect(roll.getAttribute('aria-pressed')).toBe('true');
  }finally{await act(async()=>root.unmount());vi.useRealTimers();host.remove();vi.restoreAllMocks();}
});

it.each([[8000,800],[3000,0]])("finishes a home-camera load started at %s after only %s remaining milliseconds",async(loadStartedAt,remaining)=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  vi.useFakeTimers();vi.spyOn(performance,"now").mockReturnValue(10000);
  try{
    await act(async()=>root.render(<Camera initialSettings={{seconds:0,preset:"Classic",flash:false,iso:800,loadStartedAt}} enabled={false} onUpload={()=>{}}/>));
    const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    if(remaining){await act(async()=>vi.advanceTimersByTimeAsync(remaining-1));expect(shutter.disabled).toBe(true);}
    await act(async()=>vi.advanceTimersByTimeAsync(remaining?1:0));
    expect(shutter.disabled).toBe(false);
    expect(host.querySelector('.viewfinder-status')!.textContent).toBe("READY");
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.useRealTimers();host.remove();}
});

it.each([[640,480,80,0],[480,640,0,80]])("crops %s×%s video without stretching, saves the revealed Polaroid, and rolls again", async (width,height,sourceX,sourceY) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const stop=vi.fn(), host=document.createElement("div"), root=createRoot(host);
  document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:width});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:height});
  const draw=vi.fn(),translate=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:draw,translate,scale:vi.fn(),getImageData:vi.fn(()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1})),putImageData:vi.fn()} as never);
  const toBlob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["frame"],{type:"image/png"})));
  URL.createObjectURL=vi.fn(()=>`blob:${crypto.randomUUID()}`); URL.revokeObjectURL=vi.fn();
  const named=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>(b.getAttribute("aria-label")??b.textContent?.trim())===text);
  const capture=async()=>{
    await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!.click());
    await act(async()=>vi.advanceTimersByTimeAsync(12000+3*2490));
  };
  try {
    vi.useFakeTimers();
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    await capture();
    expect(toBlob).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalled();
    // Both orientations crop a square source, rather than distorting the full frame.
    expect(draw).toHaveBeenCalledWith(host.querySelector("video"),sourceX,sourceY,480,480,0,0,480,480);
    expect(translate).toHaveBeenCalledWith(480,0);
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(0);
    // Nothing can be saved, edited, or finished before the reveal.
    for(const label of ["Save Photo","Develop","Done","Retake photo"])expect(named(label)).toBeUndefined();
    expect(host.querySelector('.film-control > span')!.textContent).toBe("ROLL AGAIN");
    // The photo used one shot of the 8-shot pack.
    expect(host.querySelector('.film-counter')!.textContent).toBe("7FILMLEFT");
    // A keyboard user's focus moves from the spent reveal button to Save Photo.
    const shake=host.querySelector<HTMLButtonElement>('[aria-label="Shake to reveal"]')!;shake.focus();
    await act(async()=>shake.click());
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(1);
    expect(saved.importPolaroid).toHaveBeenCalledWith(expect.objectContaining({name:"camera-photo-1.png"}),true);
    expect(document.activeElement).toBe(named("Save Photo"));
    // A failed save stays retryable, and the revealed photo stays on the camera.
    saved.exportFile.mockRejectedValueOnce(new Error("Disk is full."));
    await act(async()=>named("Save Photo")!.click());
    expect(host.querySelector('[role="alert"]')!.textContent).toBe("Disk is full.");
    await act(async()=>named("Save Photo")!.click());
    expect(saved.exportFile).toHaveBeenCalledTimes(2);
    expect(saved.exportFile.mock.calls[1]).toEqual([{photo:expect.objectContaining({name:"camera-photo-1.png"})},{caption:"framed"},"jpeg"]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelectorAll('img[alt="Your captured photo"]')).toHaveLength(1);
    // Roll again clears the print, releases its files, and readies a second shot.
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Load film"]')!.click());
    expect(host.querySelector(".instant-print")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:asset-camera-photo-1.png");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    await act(async()=>vi.advanceTimersByTimeAsync(2800));
    await capture();
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll(".instant-print")).toHaveLength(1);
    expect(named("Save Photo")).toBeUndefined();
    // Six more shots empty the pack; loading film then fits a fresh pack of 8.
    const load=()=>act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Load film"]')!.click());
    for(let shot=3;shot<=8;shot++){await load();await act(async()=>vi.advanceTimersByTimeAsync(2800));await capture();}
    expect(host.querySelector('.film-counter')!.textContent).toBe("0FILMLEFT");
    expect(host.querySelector('.film-control > span')!.textContent).toBe("NEW PACK");
    await load();
    expect(host.querySelector('.film-counter')!.textContent).toBe("8FILMLEFT");
  } finally { vi.useRealTimers(); await act(async()=>root.unmount());host.remove();vi.restoreAllMocks(); }
});

it("prints an uploaded photo in place of a capture and keeps the camera settings",async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const stop=vi.fn(),host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  URL.revokeObjectURL=vi.fn();
  const file=new File(["x"],"beach.heic",{lastModified:Date.UTC(2024,6,4,12)});
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    await act(async()=>host.querySelector('[aria-label="ISO effect"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}} upload={{file,id:1}}/>));
    expect(saved.importPolaroid).toHaveBeenCalledWith(file,true);
    expect(host.querySelector<HTMLImageElement>(".instant-print img")).toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Shake to reveal"]')!.click());
    expect(host.querySelector<HTMLImageElement>('img[alt="Your captured photo"]')!.src).toBe("blob:asset-beach.heic");
    expect(stop).toHaveBeenCalled();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Load film"]')!.click());
    expect(host.querySelector('[role="slider"]')!.getAttribute('aria-valuenow')).toBe('1600');
    saved.importPolaroid.mockRejectedValueOnce(new Error("We could not decode this HEIC photo."));
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}} upload={{file,id:2}}/>));
    expect(host.textContent).toContain("beach.heic: We could not decode this HEIC photo.");
    expect(host.querySelector(".instant-print")).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it.each(["dimensions", "blob"])("allows a new attempt after a %s capture failure", async failure => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});
  Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:vi.fn(()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1})),putImageData:vi.fn()} as never);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(null));
  try {
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    vi.useFakeTimers();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Load film"]')!.click());
    await act(async()=>vi.advanceTimersByTimeAsync(2800));const shutter=host.querySelector<HTMLButtonElement>('[aria-label="Capture"]')!;
    if(failure==="dimensions")Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:0});
    await act(async()=>shutter.click());await act(async()=>vi.advanceTimersByTimeAsync(3000));
    expect(shutter.disabled).toBe(false);expect(host.textContent).toContain(failure==="dimensions"?"warming up":"could not be captured");
  } finally {vi.useRealTimers();await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it.each([0,3,5,10])("uses the %s-second dial setting and captures only one Polaroid",async seconds=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  const write=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:write} as never);
  const blob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>cb(new Blob(["frame"])));URL.createObjectURL=vi.fn(()=>`blob:${crypto.randomUUID()}`);URL.revokeObjectURL=vi.fn();
  const button=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.getAttribute("aria-label")===name||b.textContent===name)!;
  try{
    await act(async()=>root.render(<Camera enabled={seconds===3} onUpload={()=>{}}/>));await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    expect(button("Timer off").getAttribute("aria-pressed")).toBe("true");expect(button("Capture").disabled).toBe(false);
    vi.useFakeTimers();await act(async()=>{button(seconds?`Timer ${seconds} seconds`:"Timer off").click();button("B&W").click();button("Flash effect").click();button("Load film").click();});
    await act(async()=>vi.advanceTimersByTimeAsync(2800));await act(async()=>button("Capture").click());
    if(seconds===3)await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));
    if(seconds){await act(async()=>vi.advanceTimersByTimeAsync(seconds*1000-1));expect(blob).not.toHaveBeenCalled();expect(button("Timer off").closest("fieldset")!.disabled).toBe(true);await act(async()=>vi.advanceTimersByTimeAsync(1));}
    // Reduced motion holds the steady front light for 300 ms before sampling.
    expect(blob).not.toHaveBeenCalled();await act(async()=>vi.advanceTimersByTimeAsync(299));
    expect(blob).not.toHaveBeenCalled();await act(async()=>vi.advanceTimersByTimeAsync(1));
    expect(blob).toHaveBeenCalledTimes(1);
    await act(async()=>vi.advanceTimersByTimeAsync(2489));expect(blob).toHaveBeenCalledTimes(1);
    await act(async()=>vi.advanceTimersByTimeAsync(3*(seconds*1000+2490)-2489));expect(blob).toHaveBeenCalledTimes(1);expect(write).toHaveBeenCalledTimes(1);
    const pixels=write.mock.calls[0][0].data;expect(pixels[0]).toBe(pixels[1]);expect(pixels[1]).toBe(pixels[2]);expect(host.querySelector(".capture-flash")).toBeNull();expect(host.querySelector(".capture-decisions")).toBeNull();
    if(seconds===0||seconds===3){await act(async()=>root.render(<Camera enabled={true} onUpload={()=>{}}/>));expect(host.querySelector(".capture-flash")).toBeNull();}
  }finally{vi.useRealTimers();await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();}
});

it.each([false,true])("discards unfinished captures when hidden (during shutter lead: %s)",async hideDuringLead=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  const stop=vi.fn();Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{configurable:true,value:640});Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{configurable:true,value:480});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn(),translate:vi.fn(),scale:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1}),putImageData:vi.fn()} as never);
  const pending:BlobCallback[]=[];vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(cb=>{pending.push(cb);});URL.createObjectURL=vi.fn(()=>"blob:new");URL.revokeObjectURL=vi.fn();const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(false);
  const click=async(label:string)=>act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  try{
    await act(async()=>root.render(<Camera enabled={false} onUpload={()=>{}}/>));await act(async()=>host.querySelector("video")!.dispatchEvent(new Event("loadeddata",{bubbles:true})));
    vi.useFakeTimers();await click("Timer off");await click("Load film");await act(async()=>vi.advanceTimersByTimeAsync(2800));await click("Capture");expect(pending).toHaveLength(1);
    hidden.mockReturnValue(true);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));hidden.mockReturnValue(false);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));
    await click("Capture");expect(pending).toHaveLength(2);await act(async()=>pending[0](new Blob(["old"])));expect(host.querySelector(".instant-print")).toBeNull();expect(stop).not.toHaveBeenCalled();
    await act(async()=>pending[1](new Blob(["new"])));expect(host.querySelector(".instant-print")).toBeNull();
    if(hideDuringLead){hidden.mockReturnValue(true);await act(async()=>document.dispatchEvent(new Event("visibilitychange")));await act(async()=>vi.advanceTimersByTimeAsync(480));expect(host.querySelector(".instant-print")).toBeNull();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:new");return;}
    await act(async()=>vi.advanceTimersByTimeAsync(479));expect(host.querySelector(".instant-print")).toBeNull();
    await act(async()=>vi.advanceTimersByTimeAsync(1));expect(host.querySelector(".instant-print")).not.toBeNull();expect(stop).toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());vi.useRealTimers();host.remove();vi.restoreAllMocks();}
});
