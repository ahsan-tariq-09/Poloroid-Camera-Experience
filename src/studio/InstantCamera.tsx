import type { ReactNode } from "react";

/** Shared housing for the demo and the live camera. */
export default function InstantCamera({ children, onShutter, disabled, label = "Take a photo", status = "OPEN VIEWFINDER", controls, onRoll, rollDisabled, loaded = false, loading = false, ready = true, print, printed = false, settings, navigation, filmLeft }: {
  children: ReactNode; onShutter?: () => void; disabled?: boolean;
  label?: string; status?: string; controls?: ReactNode;
  onRoll: () => void; rollDisabled?: boolean; loaded?: boolean; loading?: boolean;
  /** False while no camera feeds the finder, so the roll never claims to be set. */
  ready?: boolean;
  print?: ReactNode; printed?: boolean;
  settings?: ReactNode;
  navigation?: ReactNode;
  /** Shots left in the film pack, shown in a window beside the lever. */
  filmLeft?: number;
}) {
  return <div className={`camera-assembly ${printed?"has-print":""}`}><div className="instant-camera">
    <div className="camera-nameplate"><span>roid <small>beta</small></span>{navigation || <span className="camera-indicator">INSTANT<br/>COLOR</span>}</div>
    <div className="viewfinder-bezel"><i className="camera-screw screw-tl" aria-hidden="true"/><i className="camera-screw screw-tr" aria-hidden="true"/><i className="camera-screw screw-bl" aria-hidden="true"/><i className="camera-screw screw-br" aria-hidden="true"/><div className="camera-display">{children}<div className="viewfinder-corners" aria-hidden="true"/><span className="viewfinder-status">{status}</span></div></div>
    {!printed&&settings}
    <div className="camera-hardware">
      <div className="hardware-control film-control">
        <span>{loading?"LOADING FILM":filmLeft===0?"NEW PACK":printed?"ROLL AGAIN":!ready?"NO CAMERA":loaded?"FILM LOADED":"LOAD FILM"}</span>
        <div className="film-control-row">
          {/* A pivoting load lever: the handle swings while the film advances. */}
          <button type="button" className={`film-roll ${loading?"film-loading":""} ${!loaded&&!printed&&ready?"roll-needed":""}`} aria-label="Load film" aria-busy={loading} aria-pressed={loaded} disabled={rollDisabled} onClick={onRoll}><i className="film-lever-handle" aria-hidden="true"/></button>
          {filmLeft!==undefined&&<span className="film-counter"><b>{filmLeft}</b><small>FILM<br/>LEFT</small></span>}
        </div>
      </div>
      <div className="camera-hardware-copy"><div className="camera-center-control">{controls}</div></div>
      <div className="hardware-control shutter-control"><button type="button" className={`shutter ${loaded&&!printed&&!disabled?"shutter-ready":""}`} aria-label={label} disabled={disabled} onClick={onShutter}/></div>
    </div>
    {/* The print leaves through the slot at the bottom of this ribbed chin. */}
    <div className="camera-chin" aria-hidden="true"><span className="chin-mark">AUTOFOCUS <b>roid</b></span><div className="ejection-slot"/></div>
  </div>{print}</div>;
}
