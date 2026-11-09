import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { MotionConfig } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";
import { ACCEPT } from "./imports";
import Camera from "./Camera";
import { useStudioMotion } from "./useStudioMotion";
import ScrapbookScreen from "./studio/ScrapbookScreen";
import { useScrapbook } from "./studio/useScrapbook";
import { soundEnabled, setSoundEnabled, unlockSound } from "./sounds";
import InstallApp from "./studio/InstallApp";

/**
 * Camera-first app: open camera, take a photo, shake to reveal, save or roll again.
 * The former Start, Edit, and Finish workflow lives in src/archive/studio (see docs/ARCHIVED-EDITOR.md).
 */
function StudioApp() {
  const book = useScrapbook();
  const [sound, setSound] = useState(soundEnabled);
  const enabled = useStudioMotion();
  const location = useLocation(),
    navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ file: File; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const path = location.pathname;
  const cameraPage = path === "/";
  useEffect(() => {
    // A remounted camera must not print an earlier upload again.
    if (!cameraPage) setUpload(null);
    document.title =
      path === "/scrapbook" ? "Scrapbook · roid beta" : "Instant camera · roid beta";
    document.querySelector<HTMLElement>("main h1")?.focus();
    window.scrollTo?.(0, 0);
  }, [path, cameraPage]);
  const print = (files: File[]) => {
    if (files[0]) setUpload((u) => ({ file: files[0], id: (u?.id ?? 0) + 1 }));
  };
  const toggleSound = () => {
    setSound(!sound);
    setSoundEnabled(!sound);
  };
  const soundButton = (size: number) => (
    <button
      className="sound-toggle"
      aria-label={sound ? "Mute sound effects" : "Enable sound effects"}
      aria-pressed={sound}
      onClick={toggleSound}
    >
      {sound ? <Volume2 size={size} /> : <VolumeX size={size} />}
    </button>
  );
  return (
    <MotionConfig reducedMotion={enabled ? "never" : "always"}>
      <div
        className={`app-shell${cameraPage ? " camera-page" : ""}`}
        data-motion={enabled ? "active" : "paused"}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (path === "/scrapbook") {
            if (!book.busy) void book.addFiles(files);
          } else {
            void unlockSound();
            print(files);
          }
        }}
      >
        <input
          ref={input}
          type="file"
          hidden
          accept={ACCEPT}
          aria-label="Upload a JPG, PNG, HEIC, HEIF, or SVG photo"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            print(files);
          }}
        />
        {!cameraPage && (
          <header className="site-header">
            <Link className="wordmark" to="/">
              roid <span className="brand-beta">beta</span>
            </Link>
            <div className="header-controls">{soundButton(18)}</div>
          </header>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <Camera
                enabled={enabled}
                upload={upload}
                onUpload={() => {
                  // Resume audio inside the click so the print's ejection sound can play.
                  void unlockSound();
                  input.current?.click();
                }}
                navigation={soundButton(20)}
              />
            }
          />
          <Route
            path="/scrapbook"
            element={
              <ScrapbookScreen studio={book} onCamera={() => navigate("/")} />
            }
          />
          {/* Old /camera, /edit, and /finish links return to the camera. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!cameraPage && (
          <footer className="project-about" aria-labelledby="about-title">
            <div>
              <h2 id="about-title">About roid</h2>
            </div>
            <div className="about-copy">
              <p>
                roid is an instant camera in your browser, inspired by the joy
                of instant photography. Roll the film, take a photo, shake it to
                reveal, and keep the moments you love.
              </p>
              <p>
                Your photos stay on your device. Save a Polaroid to keep it, or
                gather a few on a scrapbook page.
              </p>
              <InstallApp />
            </div>
          </footer>
        )}
        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            {path === "/scrapbook" ? "Drop photos to add them" : "Drop a photo to print it"}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StudioApp />
    </BrowserRouter>
  );
}
