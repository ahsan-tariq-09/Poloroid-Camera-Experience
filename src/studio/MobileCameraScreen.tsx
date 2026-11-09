import type { ReactNode, RefObject } from "react";
import { RefreshCw } from "lucide-react";
import InstantCamera from "./InstantCamera";
import OpenOnPhone from "./OpenOnPhone";

/** Add photo: a Polaroid with a plus in its window, a second print tilted behind it (lucide 24px grid). */
function AddPolaroidIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.5 7 8.4 3.6l12.9 3.5-3.6 13.1-1.7-.5"/><rect x="2.5" y="7" width="13" height="15" rx="1.5"/><path d="M2.5 18h13"/><path d="M9 9.8v5.4M6.3 12.5h5.4"/>
  </svg>;
}

/** The camera screen used at every size: one housing, viewfinder, controls, and paper outlet. */
export default function MobileCameraScreen({ containerRef, navigation, viewfinder, settings, print, decisions, flash,
  captured, disabled, ready, taking, loading, loaded, filmLeft, status, notice, retry, onRoll, onShutter, onFlip, onUpload }: {
  containerRef: RefObject<HTMLDivElement | null>;
  navigation?: ReactNode; viewfinder: ReactNode; settings: ReactNode; print: ReactNode;
  decisions?: ReactNode; flash: ReactNode; retry: ReactNode;
  captured: boolean; disabled: boolean; ready: boolean; taking: boolean; loading: boolean; loaded: boolean; filmLeft?: number; status: string; notice: string;
  onRoll: () => void; onShutter: () => void; onFlip: () => void; onUpload: () => void;
}) {
  return <main className={`mobile-camera ${captured ? "has-print" : ""}`}>
    <h1 className="sr-only">roid instant camera</h1>
    <div className="mobile-camera-body" ref={containerRef} tabIndex={-1}>
      <InstantCamera printed={captured} print={print} settings={settings}
        navigation={<nav aria-label="Camera navigation">{navigation}<button onClick={onUpload} disabled={taking} aria-label="Upload photos"><AddPolaroidIcon/></button><OpenOnPhone/></nav>}
        onRoll={onRoll} rollDisabled={taking || loading} loaded={loaded} loading={loading} ready={ready} filmLeft={filmLeft}
        onShutter={onShutter} disabled={disabled} label="Capture" status={status}
        controls={<button className="camera-flip" onClick={onFlip} disabled={taking || loading || captured} aria-label="Flip camera"><RefreshCw size={20}/></button>}>
        {viewfinder}
        {notice && <div className="mobile-camera-recovery"><p role="status">{notice}</p>{retry}</div>}
      </InstantCamera>
      {decisions}
      {flash}
    </div>
  </main>;
}
