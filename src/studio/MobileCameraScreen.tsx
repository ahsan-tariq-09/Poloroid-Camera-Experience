import type { ReactNode, RefObject } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import InstantCamera from "./InstantCamera";

/** The camera screen used at every size: one housing, viewfinder, controls, and paper outlet. */
export default function MobileCameraScreen({ containerRef, navigation, viewfinder, settings, print, decisions, flash,
  captured, disabled, ready, taking, loading, loaded, status, notice, retry, onRoll, onShutter, onFlip, onUpload }: {
  containerRef: RefObject<HTMLDivElement | null>;
  navigation?: ReactNode; viewfinder: ReactNode; settings: ReactNode; print: ReactNode;
  decisions?: ReactNode; flash: ReactNode; retry: ReactNode;
  captured: boolean; disabled: boolean; ready: boolean; taking: boolean; loading: boolean; loaded: boolean; status: string; notice: string;
  onRoll: () => void; onShutter: () => void; onFlip: () => void; onUpload: () => void;
}) {
  return <main className={`mobile-camera ${captured ? "has-print" : ""}`}>
    <h1 className="sr-only">roid instant camera</h1>
    <div className="mobile-camera-body" ref={containerRef} tabIndex={-1}>
      <InstantCamera printed={captured} print={print} settings={settings}
        navigation={<nav aria-label="Camera navigation">{navigation}<button onClick={onUpload} disabled={taking} aria-label="Upload photos"><ImagePlus size={20}/></button></nav>}
        onRoll={onRoll} rollDisabled={taking || loading} loaded={loaded} loading={loading} ready={ready}
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
