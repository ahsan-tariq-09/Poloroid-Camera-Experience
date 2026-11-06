# Archived editor

roid is now camera-first: open camera → roll film and take a photo → shake to reveal → save photo or roll again. The earlier Start → Edit → Finish workflow is disabled but kept in the repository so it can be restored or reused. Git history is not the only copy.

## What was disabled

- **Start (`/`)**: the desktop landing page with the home camera, examples and the camera dialog.
- **Edit (`/edit`)**: the layer editor (arrange, crop, cut, repeat, decorate, text, fonts, looks, undo history, Piece menu).
- **Finish (`/finish`)**: the read-only review with format picker (PNG, JPEG, HEIC, SVG), print at 88 × 107 mm, Add to scrapbook and STL frame downloads.
- The camera's **Develop**, **Done** and **Retake photo** buttons, the desktop-only camera dialog, and the Start → Edit → Finish step navigation.
- Scrapbook's **Edit this Polaroid** button. It renders only when an `onEditPhoto` handler is passed, which the active app does not do.

Old `/edit`, `/finish` and `/camera` URLs redirect to `/` in `src/App.tsx`. `vercel.json` still rewrites them to `index.html`, and the service worker serves the cached app for any offline navigation, so the redirect also works offline.

## Where it lives

Everything is in `src/archive/studio/`. It is compiled by `tsc -b` and tested by `vitest`, but nothing in `src/main.tsx` or `src/App.tsx` imports it, so the production bundle does not include it.

| Archived file | Former location | Role |
| --- | --- | --- |
| `LegacyStudioApp.tsx` | `src/App.tsx` | Old router, session guards, upload replacement dialog and step navigation |
| `LegacyStudioApp.test.tsx` | `src/App.test.tsx` | Editor, navigation and session regression tests |
| `LegacyCamera.tsx` | `src/Camera.tsx` | Camera with dialog/page/screen presentations and Develop/Done decisions |
| `StartScreen.tsx`, `examples.ts`, `CompositionPreview.tsx` | `src/studio/` | Desktop home, editable examples, rendered previews |
| `EditorLoader.tsx`, `EditScreen.tsx`, `EditorControls.tsx`, `PieceMenu.tsx`, `PositionControls.tsx`, `NumericInput.tsx`, `FontPicker.tsx`, `TextFormatting.tsx`, `LayerThumbnail.tsx` | `src/studio/` | Editor screen and controls |
| `FinishScreen.tsx` | `src/studio/` | Finish screen |
| `useStudioSession.ts` | `src/studio/` | Editor session state, history, uploads and exports |
| `Stage.tsx`, `Stage.test.tsx` | `src/` | Pointer editing canvas |

Supporting styles stay where they were (`src/styles.css`, `src/studio/canvas.css`, `src/studio/nostalgia.css`, `src/studio/camera.css`) and still load, so restored screens keep their look.

## Active shared dependencies

The archive imports these active modules. Change them with the archive in mind; `pnpm typecheck` and `pnpm test` cover both.

- Rendering and export: `src/render.ts`, `src/effects.ts`, `src/effects.wgsl`, `src/presentation.ts`, `src/fonts.ts`, `src/limits.ts`, `src/heicExport.ts`
- Model and history: `src/model.ts`, `src/history.ts`, `src/handles.ts`
- Imports: `src/imports.ts`
- Camera parts: `src/cameraMedia.ts`, `src/sounds.ts`, `src/studio/InstantCamera.tsx`, `InstantPrint.tsx` (keeps its optional `onRetake` and `onReveal` props for `LegacyCamera`), `MobileCameraScreen.tsx` (optional `decisions`), `CameraSettings.tsx`, `CameraPreview.tsx`, `cameraFilm.ts`, `captureDate.ts`
- Saving and scrapbook: `src/studio/SavePhotoButton.tsx`, `src/scrapbook.ts`, `src/studio/useScrapbook.ts`, `src/studio/ScrapbookScreen.tsx`, `src/studio/shared.tsx`, `src/studio/InstallApp.tsx`, `src/useStudioMotion.ts`

The camera's tagline was removed from `InstantCamera.tsx`, so `LegacyCamera` no longer shows it either.

## Restore the editor

1. In `src/main.tsx`, import `App` from `./archive/studio/LegacyStudioApp` instead of `./App`. This restores Start, Edit, Finish, the camera dialog and Develop/Done in one step.
2. To move the files back instead, `git mv` each archived file to its former location above and update its relative imports (`../../x` becomes `./x` or `../x`; `./LegacyCamera` becomes `./Camera`).
3. To mix old and new, keep the camera-first `src/App.tsx` and add an `/edit` route rendering `EditorLoader` with a `useStudioSession()` session, as `LegacyStudioApp.tsx` does. Pass `onEditPhoto` to `ScrapbookScreen` to bring back Edit this Polaroid.
4. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm test:browser`. The archived browser expectations for Develop/Done/Finish are in Git history before this change (`tests/camera-reveal.browser.cjs`, `tests/save-photo.browser.cjs`).

Never move archived source into `public/`.

## Former editor documentation

The rest of this page is the README's description of the editor at the time it was archived.

On phones, `/` opens the full-screen `/camera` route and requests camera permission immediately. Film starts loaded. The original leather-and-metal camera fills the screen, with film presets, ISO, timer, flash, roll and shutter directly on its body. The viewfinder stays dominant on short screens, with a compact ISO dial beneath it that keeps all six values around the ring and a rotating metal center. Landscape keeps a large preview beside the controls. Captured prints slide in front of the bottom slot after a 0.48-second shutter-click lead, followed by the print sound. Upload remains available while permission is pending or denied, with Retry camera after a failure. Rotation keeps the current camera and settings; leaving stops the stream. The mobile header keeps sound, upload, and an optional link to the current Polaroid; scrapbook navigation remains available elsewhere in the studio. Desktop retains the Start page and camera dialog.

1. **Start (`/`)**: Roll film and shutter controls are the primary actions, with Upload photos below the camera and upload/drop support for JPG/JPEG, PNG, HEIC/HEIF or self-contained SVG. The home camera keeps its timer, ISO, film presets, flash and shutter interactive around a darker, grainy display photograph. Roll film opens the real camera with those settings already loaded. Both viewfinders show the selected ISO, film and timer, with a live film preview that matches the captured treatment. ISO 100–3200 digitally simulates exposure gain and grain around a neutral ISO 800; it does not control the camera sensor. The black-and-metal camera captures a single Polaroid, a 3-second print ejection before shake controls become available, a button-triggered shake (or manual shake) and a sound mute control. Reduced motion settles the ejection immediately. **Develop** opens Edit and **Done** opens Finish. Classic, Cut and taped, and 3×3 grid are editable examples whose thumbnails use the same deterministic compositions as Edit. Their vintage party demo image is disclosed as AI-generated.
2. **Edit (`/edit`)**: the fixed, upright Polaroid stays above the photo layers. Arrange contains Add photos, Move, Crop, Cut, Repeat and Zoom. Move photos directly, center them, or use directional nudges. Decorate adds movable text, tape and paper, with color, rotation and size controls. Look includes Original, Warm film, Black & white and Copy shop, plus frame and caption styling, including caption color. New photos start with Warm film at 65%. Photos and pieces expands layer selection; the Piece menu provides copying, pasting, deletion, ordering and page alignment.
3. **Finish (`/finish`)**: review the finished Polaroid, choose **Save Photo** for PNG, JPEG (default), genuine HEIC or self-contained SVG, print, or add it to the scrapbook. On iPhone, iPad and Mac browsers that support sharing the selected file, Save Photo opens the native share sheet; on iPhone/iPad choose **Save Image** to add a supported image to Photos. Other devices and unsupported formats use a file download. Sharing requires HTTPS, remains user-controlled, and does not confirm a Photos save. Canceling leaves the photo ready to retry; sharing failures offer a download on the next tap. Finish is read-only, including after choosing Done in the camera; **Back to editing** returns to the editing tools. Every artwork includes the complete outer frame and caption and clips everything outside that frame. Separate STL frame downloads remain available.
4. **Scrapbook (`/scrapbook`)**: arrange up to 12 photos as overlapping Polaroids with tilt and optional tape, or as a continuous vertical photo strip. Set the page title and paper color, reorder photos, reopen a Polaroid for editing and update its original scrapbook item. **Save on device** persists the current page; **Download page** exports the collage or strip as PNG.

The initial upload opens a new composition with an empty caption. Imported photos retain their source aspect ratio and full image instead of being automatically cover-cropped; crop and position are user decisions. Additional photos in Edit join the existing composition independently. Imports decode sequentially and successful files survive mixed-batch failures. Returning to Start offers Continue your Polaroid; starting a new upload or example asks before replacing the existing work. Failed replacement imports leave that work intact.

Navigation, category selection and temporary animations do not enter composition history. Back/Forward and Back to editing preserve assets, selection and Undo/Redo. Refresh clears the unsaved editor session; direct Edit/Finish visits without a session return to Start with an explanation. The scrapbook separately stores **one current page** in IndexedDB after an explicit Save on device, including its editable photo sources. It reopens on the same browser and origin. Saving replaces the prior saved version; unsaved changes are temporary, and clearing browser data removes the saved page. There is no account or cross-device sync.

**Text and fonts:** Choose Decorate → Add text for independent text pieces (up to 200 characters, including newlines). Move, resize, rotate, color, copy/paste and order them like other decorations. Look → Caption font changes the existing caption independently. Both selectors offer exactly 30 choices: Studio sans, 28 Google Fonts families and the existing **Lindbergh Baby** ransom-note font from [Font Library](https://fontlibrary.org/en/font/lindbergh-baby). No fonts were authored for this project. Caveat (the default handwritten caption) and Permanent Marker are bundled with their original licenses; the other 26 Google Fonts load on demand. Lindbergh Baby is also bundled with its license. Font loading has visible recovery controls. Photo content and user-entered text are never sent in font request URLs.

Numeric fields keep partial typing until blur or Enter; Escape restores the current value. Individual pieces are limited to 1600 logical pixels, positions to ±1600 pixels, and complete exports to 10,000 pixels per edge and 32 megapixels. Invalid geometry retains the last valid edit. An interrupted editor download now offers Retry without clearing the session, and a pending photo import respects subsequent navigation.

Crop trims through a drawn rectangle or corner handles without stretching the surviving pixels. Cut defaults to Scissors: draw a non-self-crossing edge-to-edge path, or return to the starting circle to cut out a closed shape. Each connected piece can move independently; the surrounding piece retains its hole. Straight line and Cut by angle remain available. Invalid strokes leave the composition unchanged. Repeat creates exactly nine full copies in a fitted 3×3 grid; its box adjusts the tiles together until the tool or category changes. Use Copy and Paste in the Piece menu to copy a piece within the current session. Copy does not add an Undo step; each paste does.

The Piece menu is available above the canvas, on right-click, and by long-press. Its Layer submenu has Bring forward, Bring to front, Send backward and Send to back, within the photo or decoration band. The frame always stays above photos and below tape/paper. Align to page uses the outer Polaroid frame and the selected piece's rotated outline: Left, Center, Right, Top, Middle and Bottom. Clipboard contents stay in memory and clear when starting a new session.

Photos moved outside the frame remain visible in the editing workspace so they can be recovered. The workspace has fixed margins and does not resize while moving pieces. Finished previews, all Polaroid downloads and print output clip photo and decoration overflow to the outer frame. The frame prints at 88 × 107 mm.

Accessible menus use [Radix Primitives](https://www.radix-ui.com/primitives/docs/components/context-menu). Cutting and holes use the existing [polyclip-ts](https://github.com/luizbarboza/polyclip-ts) engine, shared by hit testing, Canvas and SVG geometry. The editor and menu code load only when entering Edit.

Gestures commit on release. Undo/Redo reverses each completed action. Reset restores the initial composition (including an example's arrangement) plus the original arrangement of photos subsequently added. Individual layers can rotate; the outer frame stays upright. All controls retain native Tab, button and form keyboard behavior, and dialogs support Escape dismissal.

Print prepares one Polaroid with an outer frame of **88 × 107 mm**, centered on the sheet. Choose **Actual size / 100% scale**, disable headers/footers, and avoid Fit to page in the printer dialog. Output is clipped to the frame. Printer settings and physical calibration can override sizing. Check each supplied STL's opening separately before fitting a photo.
