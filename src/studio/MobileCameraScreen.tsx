import type { ReactNode, RefObject } from "react";
import { RefreshCw } from "lucide-react";
import InstantCamera from "./InstantCamera";
import OpenOnPhone from "./OpenOnPhone";

/** Add photo: a plus at the top left, outside a Polaroid with a second print tilted behind it (lucide 24px grid). */
function AddPolaroidIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 2v6M2 5h6"/><path d="M12.5 9 13.3 6l8.7 2.3-2 7.4"/><rect x="8" y="9" width="12" height="13" rx="1.5"/><path d="M8 18.5h12"/>
  </svg>;
}

/** The camera screen used at every size: one housing, viewfinder, controls, and paper outlet. */
export default function MobileCameraScreen({ containerRef, navigation, viewfinder, settings, print, decisions, flash,
  captured, disabled, ready, taking, loading, loaded, filmLeft, status, notice, retry, onRoll, onShutter, onFlip, onUpload }: {
  containerRef: RefObject<HTMLDivElement | null>;
  navigation?: ReactNode; viewfinder: ReactNode; settings: ReactNode; print: ReactNode;
  decisions?: ReactNode; flash: ReactNode; retry: ReactNode;
  captured: boolean; disabled: boolean; ready: boolean; taking: boolean; loading: boolean; loaded: boolean; filmLeft?: number; status: string; notice: string;
  onRoll: () => void; onShutter: () => void; onFlip: () => void;
  /** Desktop only: with no upload the header shows the camera's INSTANT COLOR plate instead of buttons. */
  onUpload?: () => void;
}) {
  return <main className={`mobile-camera ${captured ? "has-print" : ""}`}>
    <h1 className="sr-only">roid instant camera</h1>
    <div className="mobile-camera-body" ref={containerRef} tabIndex={-1}>
      <InstantCamera printed={captured} print={print} settings={settings}
        navigation={onUpload && <nav aria-label="Camera navigation">{navigation}<button onClick={onUpload} disabled={taking} aria-label="Upload photos"><AddPolaroidIcon/></button><OpenOnPhone/></nav>}
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
