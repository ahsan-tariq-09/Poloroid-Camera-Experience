# roid beta

A camera-first browser studio with warm paper, a physical-camera interface, upright Polaroids and a scrapbook for collages and photo strips. Built with React, React Router, TypeScript, Vite, WebGPU and a Canvas fallback. The production build supports installation and offline use.

Public site: [poloroid-photobooth.vercel.app](https://poloroid-photobooth.vercel.app/).

## Run with Docker

```sh
docker compose up --build
```

Open http://localhost:8080. The multi-stage build installs dependencies inside a Node container and serves the built site using unprivileged Nginx. No host Node installation is required. Bindings default to loopback. For deployment beyond localhost, put the container behind HTTPS so camera capture and WebGPU are available.

## Run with Node

Requires Node 22.12+ and pnpm 11.25.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

## Deploy with Vercel

`vercel.json` configures the Vite build, static `dist` output and explicit `/camera`, `/edit`, `/finish` and `/scrapbook` rewrites. The app redirects the first three to the camera at `/`, so old links keep working. Static assets and STL downloads keep their original paths. Use Node 24 and set the build environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pinned pnpm version in `package.json`. No application secrets or backend are required.

Import your fork into Vercel and use the included `vercel.json` configuration. Keep deployment credentials, local `.vercel/` settings, and environment files out of Git.

## Use the studio

Every screen size opens the same camera at `/`: open camera → load film and take a photo → shake to reveal → save photo or roll again. The page requests camera permission on load, and film starts loaded. The leather-and-metal camera keeps its viewfinder, film presets, ISO, timer, flash, load-film lever and shutter on its body. A film pack holds 8 shots: a window beside the lever counts camera photos down, and every film load, Roll again included, fits a fresh pack of 8 (uploads do not use film; the count resets when the page reloads). Portrait phones fill the screen, and portrait tablets center the camera at phone proportions. Landscape phones and desktop windows use a wide body: the square viewfinder takes the full height on the left with the controls beside it, and desktops fill most of the window. ISO is an unnumbered beige bar with a black lighten arrow and a white darken arrow; the white needle follows a drag and snaps to the nearest of 100, 400, 800 (centre), 1600 and 3200 when released; a tap or the arrow keys pick a stop directly. The timer dial, ISO bar and film presets carry no caption, visible or hidden. The timer dial turns under a finger between hard stops at Off and 10s and settles on the nearest mark (Off, 3s, 5s, 10s) when released, or a tap on a mark sets it. Rotation keeps the current camera and settings; leaving stops the stream. On desktops and laptops (a hovering mouse or trackpad), the camera is slightly smaller and a QR button in its header opens a card on every visit: scan it to open the camera on a phone. Esc, the close button or a click elsewhere dismisses it; phones and tablets never show it.

1. **Capture**: ISO 100–3200 digitally simulates exposure gain and grain around a neutral ISO 800; it does not control the camera sensor. The viewfinder shows the selected timer, with a live film preview that matches the captured treatment. A 0.48-second shutter click precedes the print sound, and the single Polaroid ejects from the bottom slot over 2.49 seconds, ending with the ejection sound. Reduced motion settles the ejection immediately.
2. **Upload** (desktops and laptops only): the camera header's Upload photos button (a Polaroid with a plus), or dropping a file on the page, prints one JPG/JPEG, PNG, HEIC/HEIF or self-contained SVG photo through the same slot. Upload stays available while camera permission is pending or denied, and Retry camera follows a failure. A camera that answers after an upload printed is switched off until Roll again. The uploaded print leaves the slot with the film-ejection sound, without the shutter click. Phones and tablets have no upload button, drop target or sound button; a denied camera offers Retry camera.
3. **Drag & shake**: shake the phone, drag the print side to side (it trails the finger on a spring and glides back to centre), or press Reveal the Snap. The photo stays blank for 2 seconds, then develops evenly until 11 seconds. Reduced motion reveals it immediately.
4. **Save** (a brushed-metal plate engraved with an arrow dropping into a tray, no text, named Save Photo for assistive tech) appears only after the photo has developed. It saves the complete framed Polaroid with its handwritten date caption, left-aligned under the photo, as JPEG (1560 × 1897 pixels), never the camera controls or animation. On iPhone, iPad and Mac browsers that support sharing the file, Save Photo opens the native share sheet; on iPhone/iPad choose **Save Image** to add it to Photos. Other devices download `my-polaroid-YYYY-MM-DD-HHMMSS.jpg`; the time in the name keeps browsers from asking to download an earlier save again. Canceling or a failure leaves the photo on the camera, ready to retry. A finished save clears the print and returns to the live camera with the next shot loaded; the film counter keeps counting down. Keyboard focus moves to Save Photo when the reveal replaces the spent Reveal the Snap button.
5. **Roll again**: the roll control clears the print and its temporary files, reloads film and restarts the camera, keeping the selected settings. Saving first is optional.
6. **Scrapbook (`/scrapbook`)**: open `/scrapbook` directly; the camera no longer links to it. Arrange up to 12 photos as overlapping Polaroids with tilt and optional tape, or as a continuous vertical photo strip. Set the page title and paper color and reorder photos. **Save on device** persists the current page in IndexedDB; **Download page** exports the collage or strip as PNG. Earlier saved pages, including their editable photo sources, still open.

Old `/camera`, `/edit` and `/finish` links return to the camera. The former Start, Edit and Finish editor is archived in `src/archive/studio/`; see [the archived editor guide](docs/ARCHIVED-EDITOR.md) for its documentation and restoration steps.

## Interface interactions

With Flash on, supported rear cameras briefly enable their camera light before capture and switch it off afterward. If the default rear lens has no light control, camera selection checks the other rear lenses and prefers one with LED support. Light commands are sent separately from camera-selection constraints for Chrome compatibility. If the rear light is unavailable, the camera asks you to turn Flash off to continue. Front cameras show a warm-white (#fff6df) screen pulse after capture, starting at 35% opacity and fading out over 300 ms. Reduced motion uses a steady 300 ms screen light before capture instead of the fading pulse. Leaving or hiding the camera cancels capture and releases an active light.

Motion for React animates tool selection, panel changes, dialogs, camera countdown, print ejection and download confirmation. After shaking, the captured Polaroid stays blank for 2 seconds, then fades in evenly over 9 seconds, reaching full visibility at 11 seconds. Reduced motion reveals it immediately. The Polaroid enters the workspace and reveals its photo; dragged pieces lift and settle, inserted collage elements land on the paper, and cuts briefly show their seam. Shake and sound are optional presentation effects, separate from composition state and undo history. Downloads and printing use the final framed composition. Warm film, Original and Black & white offer distinct photo treatments alongside Copy shop.

Reduced-motion settings are respected, and animations settle when the page is hidden. The stage reuses processed photo textures during animation and layer movement rather than running photo effects each frame. Preset thumbnails now render the current uploaded photo.

## Image handling and exports

All image decoding, editing and exports happen on the user's device. No photo-upload endpoint, account, analytics, or Python service is used. Unsaved editor images remain in memory. Explicitly saving the scrapbook persists its images and editable compositions locally in IndexedDB; download a page to keep an independent flattened copy.

HEIC conversion lazily imports `heic-to/csp`. It decodes the still image and uses libheif's image transforms. Live Photo playback, HDR-preserving output, and multi-image HEIF container editing are outside this prototype. Conversion failures leave the previous composition intact.

SVG uploads are sanitized with DOMPurify and loaded as isolated images. Scripts, event handlers, foreign objects, and animations are removed. External images, styles and fonts must be embedded or outlined before upload. Valid `viewBox` dimensions or explicit pixel dimensions are required. SVGs are edited as a whole artwork layer; individual vector-path editing is not provided.

Polaroid raster exports render at 3× logical resolution (1560 × 1897 pixels), clipped to the outer frame. The vector frame's true aspect ratio is 88:107; the raster includes subpixel rounding at its outer edge. SVG exports share the same polygon masks, source mapping, transforms, layer bands and outer-frame clipping as Canvas. Untouched SVG sources remain embedded vectors; raster/effect layers, text pieces and caption lettering are embedded PNGs. Exports wait for selected fonts and remain self-contained. SVG physical dimensions use the same millimeter scale as printing. Scrapbook PNGs render at 2× page resolution: collages are 2000 × 1560 pixels; photo strips are 720 pixels wide with height determined by the shot count (800 pixels for one shot).

HEIC encoding lazily loads `elheif` in a dedicated worker. It encodes the completed, flattened image into actual HEIC bytes, validates the file brand, and terminates the worker after completion, failure, or a 90-second timeout. Encoding errors offer PNG/JPEG rather than silently relabeling another format. Source images and exports never leave the browser. The HEIC encoder and decoder are separate lazy bundles.

WebGPU runs the actual effect shader in `src/effects.wgsl`. The Canvas implementation uses the same seeded grain and displacement formulas when GPU initialization fails or the device is lost. The HEIC decoder is a separate lazy bundle; its size does not affect the initial editor download.

## Offline use and installation

The production build registers a service worker and supplies a standalone web-app manifest. Once the interface reports **Ready to use offline on this device**, the app shell, built JavaScript/CSS, HEIC codecs, demo image, icons and self-hosted fonts are cached. Navigation falls back to the cached app when the network is unavailable. Development mode does not install this cache; verify with `pnpm build` and `pnpm preview`.

Install roid uses the browser's install prompt when available and otherwise shows Safari/iOS and Android instructions. The UI headings use self-hosted DM Serif Display, with system sans-serif controls. DM Serif Display, Caveat, Permanent Marker and Lindbergh Baby are precached. The 26 on-demand Google Fonts families still require network access on first use; external fonts and STL downloads are not part of the app's precache. Offline readiness does not save unsaved artwork: use Save on device separately.

## Project structure

- `src/model.ts`, `history.ts`: immutable layer geometry and gesture history.
- `src/imports.ts`: supported file detection, HEIC conversion, SVG validation.
- `src/render.ts`, `effects.ts`, `effects.wgsl`: shared composition geometry, Canvas/SVG exports, GPU/CPU effects.
- `src/App.tsx`: camera and scrapbook routes, upload and drop handling, redirects for old links.
- `src/Camera.tsx`: camera lifecycle, capture, upload printing, Save Photo and Roll again.
- `src/studio/InstantCamera.tsx`, `InstantPrint.tsx`, `MobileCameraScreen.tsx`, `mobile-camera.css`: shared camera housing, print reveal and the responsive camera screen used at every size.
- `src/studio/SavePhotoButton.tsx`: native sharing on Apple platforms with download fallback.
- `src/archive/studio/`: the archived Start, Edit and Finish editor, outside the production import graph. See `docs/ARCHIVED-EDITOR.md`.
- `src/styles.css`, `src/studio/canvas.css`, `src/studio/nostalgia.css`: responsive layout, canvas interactions, dialogs, physical print styles and the warm paper/camera design.
- `src/scrapbook.ts`, `src/studio/useScrapbook.ts`, `src/studio/ScrapbookScreen.tsx`: local page storage, editable memories and collage/strip rendering.
- `src/service-worker.js`, `vite.config.ts`, `public/manifest.webmanifest`: production offline cache generation and installation metadata.
- `public/frames`: the three unchanged STL files supplied for this project.

## Validation

Run `pnpm test`, `pnpm typecheck`, and `pnpm build` to check a change. The unit suite also runs the archived editor's tests, so the archive keeps compiling and working. Flash tests cover rear-lens selection and fallback, rear-light support, rejected or ignored requests, capture failure, cancellation, cleanup, front-camera post-capture effects and reduced motion.

To run the browser camera test locally, start `pnpm preview --port 5174 --strictPort` and run `pnpm test:browser cdp` (installed Google Chrome) or `pnpm test:browser webkit` (after `pnpm exec playwright install webkit`). Screenshots go to `camera-browser-results`, or to the directory passed as a second argument. It is not part of CI for now.

For the focused Save Photo checks on the camera, start `pnpm dev --port 5176 --strictPort`, then run `node tests/save-photo.browser.cjs cdp` and `node tests/save-photo.browser.cjs webkit`. Set `CAMERA_TEST_URL` for another preview URL and `WEBKIT_EXECUTABLE_PATH` if using a separately installed WebKit. Artifacts go to `test-results/save-photo`. These checks render and download real files, verify desktop/mobile layout and keyboard use, and simulate Apple platform detection and the share API for success, cancellation and failure. A physical iPhone is still needed to confirm the native share sheet and saving into Photos.

Browser checks used Chromium over CDP and Windows WebKit at 1280×900, 390×844, 393×690, 360×640, 320×568, 844×390, and 568×320. Coverage includes responsive layout, keyboard controls, bottom-slot print alignment, rotation without restarting the stream, capture, reveal, Save Photo download, Roll again and a second capture, reduced motion, hidden-page settling, old Edit/Finish links returning to the camera, camera permission recovery, and upload, reveal and save without a camera.

The live film preview processes 256px frames using video-frame callbacks, with a 30 fps animation-frame fallback; saved captures retain the source resolution.

Browser matrix tests use sample imagery through a simulated media boundary. A physical Samsung A15 (SM-A155M) was also tested through CDP against the local server: its default rear camera 2 lacked torch control, while camera 0 exposed it. The revised app selected camera 0, reported the LED on while sampling the photo about 202 ms later, and reported it off afterward. Front capture verified the post-capture 35% warm-white pulse and 320 ms animation. Infinix, iOS, physical motion-sensor, and installation behavior remain unverified.

## References and credits

The bundled demonstration photos are AI-generated. The interface uses original HTML, CSS, SVG, and Canvas work to create its camera and paper treatments.

Supplied models:

- [Magnetic Photo Frame (Polaroid/Instax style)](https://www.printables.com/model/149884-magnetic-photo-frame-polaroidinstax-style/files): `frame-polaroid-part1.stl`, `frame-polaroid-part2.stl`.
- [Polaroid frame](https://www.printables.com/model/155872-polaroid-frame/files): `polaroid frame.stl`.

Supplied third-party references and STL models retain their original rights; consult their source listings. Dependency license notices accompany their packages. See [HEIC encoder sources and notices](ENCODER-NOTICES.md) for encoder attribution.
