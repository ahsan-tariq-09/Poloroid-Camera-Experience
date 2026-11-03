export function supportsTorch(track?:MediaStreamTrack) {
  const torch=(track?.getCapabilities?.() as MediaTrackCapabilities & {torch?:boolean|boolean[]})?.torch;
  return torch===true || Array.isArray(torch)&&torch.includes(true);
}

export async function openCamera(facing:"user"|"environment",cancelled:()=>boolean):Promise<MediaStream|null> {
  const media=navigator.mediaDevices;
  const keep=(stream:MediaStream)=>{
    if(!cancelled())return stream;
    stream.getTracks().forEach(track=>track.stop());return null;
  };
  const initial=keep(await media.getUserMedia({video:{facingMode:{ideal:facing}},audio:false}));
  if(!initial)return null;
  const track=initial.getVideoTracks?.()[0],deviceId=track?.getSettings?.().deviceId;
  if(facing!=="environment"||supportsTorch(track)||!deviceId||!media.enumerateDevices)return initial;
  let devices:MediaDeviceInfo[];
  try{devices=await media.enumerateDevices();}catch{return keep(initial);}
  if(cancelled())return keep(initial);
  const candidates=devices.filter(device=>device.kind==="videoinput"&&device.deviceId&&device.deviceId!==deviceId);
  if(!candidates.length)return initial;
  // Some phones default to an ultrawide rear lens without access to the LED.
  initial.getTracks().forEach(track=>track.stop());
  for(const device of candidates){
    if(cancelled())return null;
    let candidate:MediaStream|null;
    try{candidate=keep(await media.getUserMedia({video:{deviceId:{exact:device.deviceId},facingMode:{exact:"environment"}},audio:false}));}
    catch{continue;}
    if(!candidate)return null;
    const rear=candidate.getVideoTracks()[0];
    if(rear?.getSettings().facingMode==="environment"&&supportsTorch(rear))return candidate;
    candidate.getTracks().forEach(track=>track.stop());
  }
  if(cancelled())return null;
  return keep(await media.getUserMedia({video:{deviceId:{exact:deviceId},facingMode:{ideal:facing}},audio:false}));
}
