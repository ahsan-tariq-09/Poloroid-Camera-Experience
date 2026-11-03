// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { openCamera } from "./cameraMedia";

const stream = (id:string, facingMode="environment", torch=false) => {
  const track={stop:vi.fn(),getSettings:()=>({deviceId:id,facingMode}),getCapabilities:()=>({torch})};
  return {track,value:{getTracks:()=>[track],getVideoTracks:()=>[track]} as unknown as MediaStream};
};

it.each(["preferred","unsupported","rejected","cancelled"])("selects a flash-capable rear lens safely: %s",async scenario=>{
  const initial=stream("wide"),front=stream("front","user",true),main=stream("main","environment",scenario!=="unsupported"),fallback=stream("wide");
  let cancelled=false;
  const getUserMedia=vi.fn().mockResolvedValueOnce(initial.value).mockResolvedValueOnce(front.value).mockImplementationOnce(async()=>{
    if(scenario==="cancelled")cancelled=true;
    if(scenario==="rejected")throw new DOMException("Camera busy","NotReadableError");
    return main.value;
  }).mockResolvedValueOnce(fallback.value);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia,enumerateDevices:async()=>["wide","front","main"].map(deviceId=>({kind:"videoinput",deviceId}))}});
  const result=await openCamera("environment",()=>cancelled);
  expect(initial.track.stop).toHaveBeenCalledOnce();
  expect(front.track.stop).toHaveBeenCalledOnce();
  expect(getUserMedia.mock.calls[1][0].video).toEqual({deviceId:{exact:"front"},facingMode:{exact:"environment"}});
  if(scenario==="preferred"){expect(result).toBe(main.value);expect(main.track.stop).not.toHaveBeenCalled();}
  else if(scenario==="cancelled"){expect(result).toBeNull();expect(main.track.stop).toHaveBeenCalledOnce();expect(getUserMedia).toHaveBeenCalledTimes(3);}
  else{expect(result).toBe(fallback.value);expect(getUserMedia.mock.calls[3][0].video.deviceId).toEqual({exact:"wide"});}
});

it.each(["user","environment"] as const)("keeps a suitable %s camera without probing other lenses",async facing=>{
  const initial=stream("selected",facing,true),enumerateDevices=vi.fn();
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(initial.value),enumerateDevices}});
  expect(await openCamera(facing,()=>false)).toBe(initial.value);
  expect(enumerateDevices).not.toHaveBeenCalled();expect(initial.track.stop).not.toHaveBeenCalled();
});
