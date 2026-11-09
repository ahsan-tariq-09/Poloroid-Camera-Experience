import { useEffect, useId, useRef, useState } from "react";
import { QrCode, X } from "lucide-react";

/** Desktops and laptops: a mouse or trackpad that can hover. Phones and tablets never see the QR code. */
const isDesktop = () => typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;

/** A header button whose popover shows a QR code for this camera, so desktop visitors can shoot on their phone.
 * The popover opens on every visit; Esc, the close button or a click elsewhere dismisses it. */
export default function OpenOnPhone() {
  const [desktop] = useState(isDesktop);
  const [open, setOpen] = useState(true);
  const [code, setCode] = useState("");
  const id = useId(), root = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const url = `${location.origin}/`;
  useEffect(() => {
    if (!desktop) return;
    let live = true;
    // The encoder loads only on desktop, after the camera.
    void import("qrcode")
      .then(qr => qr.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#141713", light: "#fff9e9" } }))
      .then(data => { if (live) setCode(data); })
      .catch(() => { /* Without a code the popover still names the address. */ });
    return () => { live = false; };
  }, [desktop, url]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) toggle.current?.focus();
      setOpen(false);
    };
    const press = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", press); };
  }, [open]);
  if (!desktop) return null;
  return <div className="open-on-phone" ref={root}>
    <button ref={toggle} type="button" aria-label="Open on your phone" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><QrCode size={20}/></button>
    {open && <div className="phone-qr" id={id} role="dialog" aria-label="Open roid on your phone">
      <button type="button" className="phone-qr-close" aria-label="Close" onClick={() => setOpen(false)}><X size={16}/></button>
      {code ? <img src={code} width={240} height={240} alt={`QR code for ${url}`}/> : <span className="phone-qr-pending" aria-hidden="true"/>}
      <p><b>Scan to open roid on your phone</b>Shoot, shake and save with your phone's camera.</p>
      <span className="phone-qr-url">{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
    </div>}
  </div>;
}
