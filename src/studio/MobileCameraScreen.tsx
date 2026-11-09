import type { ReactNode, RefObject } from "react";
import { RefreshCw } from "lucide-react";
import InstantCamera from "./InstantCamera";

/** A boxy 1970s instant camera with a print leaving its slot, drawn on the lucide 24px grid. */
function RetroInstantIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 5V3.5h5V5"/><rect x="2.5" y="5" width="19" height="12" rx="2"/>
    <circle cx="11" cy="11" r="3.25"/><path d="M16.5 8h2"/><path d="M7 17v4h10v-4"/>
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
        navigation={<nav aria-label="Camera navigation">{navigation}<button onClick={onUpload} disabled={taking} aria-label="Upload photos"><RetroInstantIcon/></button></nav>}
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
