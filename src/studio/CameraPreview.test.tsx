// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CameraPreview from "./CameraPreview";
import { applyCameraFilm } from "./cameraFilm";

it.each([false,true])("previews film pixels, pauses hidden frames, and cancels (video frames: %s)",async videoFrames=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const video=createRef<HTMLVideoElement>(); video.current=document.createElement('video');
  Object.defineProperties(video.current,{videoWidth:{value:640},videoHeight:{value:480}});
  let frame:FrameRequestCallback=()=>{};
  vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{frame=cb;return 12;}));
  const cancel=vi.fn();vi.stubGlobal('cancelAnimationFrame',cancel);
  if(videoFrames){video.current.requestVideoFrameCallback=vi.fn(cb=>{frame=cb as FrameRequestCallback;return 12;});video.current.cancelVideoFrameCallback=cancel;}
  const pixels=()=>({data:new Uint8ClampedArray([80,100,120,255]),width:1,height:1} as ImageData);
  const draw=vi.fn(),write=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:draw,getImageData:pixels,putImageData:write} as never);
  const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const host=document.createElement('div'),root=createRoot(host);
  try{
    await act(async()=>root.render(<CameraPreview video={video} iso={1600} preset="B&W" flash={true} mirrored={true}/>));
    await act(async()=>frame(100));
    expect(draw).toHaveBeenCalledWith(video.current,80,0,480,480,0,0,256,256);
    expect(write.mock.calls[0][0].data).toEqual(applyCameraFilm(pixels(),'B&W',true,1600).data);
    expect(host.querySelector('canvas')!.style.transform).toBe('scaleX(-1)');
    await act(async()=>frame(134));expect(draw).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(true);await act(async()=>frame(200));expect(draw).toHaveBeenCalledTimes(2);
  }finally{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
  expect(cancel).toHaveBeenCalledWith(12);
});
