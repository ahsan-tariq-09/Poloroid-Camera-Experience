import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { download, prepareExport } from "../render";
import type { ExportFormat } from "../render";
import type { Assets, Composition } from "../model";

export type SaveStudio = {
  assets: Assets;
  composition: Composition;
  format: ExportFormat;
  busy: boolean;
  exporting: boolean;
  exportFile: () => Promise<void>;
};
type Prepared = Pick<SaveStudio, "assets" | "composition" | "format"> & {
  file: File | null;
  shareable: boolean;
};

export default function SavePhotoButton({ studio: s }: { studio: SaveStudio }) {
  const [appleSharing] = useState(
    () =>
      window.isSecureContext &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function",
  );
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [sharing, setSharing] = useState(false);
  const [downloadInstead, setDownloadInstead] = useState(false);
  const [message, setMessage] = useState("");
  const { assets, composition, format, busy } = s;

  useEffect(() => {
    if (!appleSharing || busy) return;
    let current = true;
    setDownloadInstead(false);
    setMessage("");
    // Prepare before the tap so rendering cannot consume Safari's user-activation window.
    void prepareExport(assets, composition, format)
      .then((file) => {
        if (!current) return;
        setPrepared({
          assets,
          composition,
          format,
          file,
          shareable: navigator.canShare({ files: [file] }),
        });
      })
      .catch(() => {
        if (!current) return;
        setPrepared({
          assets,
          composition,
          format,
          file: null,
          shareable: false,
        });
        setMessage(
          "Could not prepare sharing. Tap Save Photo to try a file download.",
        );
      });
    return () => {
      current = false;
    };
  }, [appleSharing, assets, composition, format, busy]);

  const ready =
    prepared?.assets === assets &&
    prepared.composition === composition &&
    prepared.format === format;
  const preparing = appleSharing && !ready;
  const shareable = ready && prepared.shareable && !downloadInstead;

  const save = async () => {
    if (preparing || sharing || s.exporting || busy) return;
    setMessage("");
    if (!shareable || !prepared?.file) {
      if (ready && prepared.file) {
        download(prepared.file, prepared.file.name);
        setMessage("Photo download started.");
      } else {
        await s.exportFile();
      }
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ files: [prepared.file] });
      setMessage("Share sheet closed. You can save or share your photo again.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Sharing canceled. Your photo is still here.");
      } else {
        setDownloadInstead(true);
        setMessage(
          "Sharing is unavailable. Tap Save Photo to download the file instead.",
        );
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <button
        className="primary-button download-main"
        disabled={s.exporting || busy || preparing || sharing}
        aria-describedby={
          message || sharing || preparing || shareable
            ? "photo-save-guidance"
            : undefined
        }
        onClick={() => void save()}
      >
        <Download size={17} aria-hidden="true" />{" "}
        {preparing || s.exporting ? "Preparing…" : "Save Photo"}
      </button>
      <p
        id="photo-save-guidance"
        className="field-hint"
        role="status"
        hidden={!message && !sharing && !preparing && !shareable}
      >
        {message ||
          (sharing
            ? "Choose where to save or share your photo."
            : preparing
              ? "Preparing your photo for saving…"
              : shareable
                ? "Opens your share menu. On iPhone or iPad, choose Save Image to add it to Photos."
                : "")}
      </p>
    </>
  );
}
