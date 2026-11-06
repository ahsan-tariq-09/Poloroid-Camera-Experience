---
name: Polaroid
description: A warm paper studio for instant photos and handmade keepsakes.
colors:
  paper: "#faf6ec"
  desk: "#eeeadd"
  home-linen: "#fefdfb"
  spectrum-red: "#ff1e27"
  ink: "#292c26"
  muted: "#666454"
  line: "#d5cebd"
  accent: "#ac3d29"
  accent-hover: "#a83520"
  button-label: "#fffaf0"
  sage: "#687054"
  selected-sage: "#434e3d"
  workspace: "#e6e4d6"
  book-workspace: "#dedecf"
  camera: "#242623"
  shutter: "#a83425"
  viewfinder: "#c6dc9d"
  book-paper: "#f9f4e7"
  tape: "#c8b184b3"
  field: "#fffdf7"
  field-line: "#cfc4b0"
typography:
  display:
    fontFamily: '"DM Serif Display", Georgia, serif'
    fontSize: "clamp(40px, 4.4vw, 66px)"
    fontWeight: 400
    lineHeight: 1.07
    letterSpacing: "-.025em"
  headline:
    fontFamily: '"DM Serif Display", Georgia, serif'
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-.02em"
  body:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  intro:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "18px"
    lineHeight: 1.6
  label:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "13px"
rounded:
  field: "5px"
  control: "6px"
  panel: "12px"
  camera-dialog: "16px"
spacing:
  control-gap: "8px"
  action-gap: "12px"
  phone-gap: "16px"
  panel: "24px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
  category-selected:
    backgroundColor: "{colors.selected-sage}"
    textColor: "{colors.paper}"
  scrapbook-controls:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: Polaroid

## Overview

**Creative North Star: the warm paper desk.**

Polaroid places a black-and-metal instant camera and handmade photo keepsakes on a quiet warm surface. Serif headlines provide nostalgia; familiar system controls keep arranging photos direct. Sage marks calm states and rust identifies the principal action. Physical depth belongs to the camera, paper, photographs and tape.

This is the implemented, code-led design, inspired by the user's [Canva camera reference](https://www.canva.com/design/DAHYz75uUaQ/vCQzdxfj0GIXwdZMn31AMQ/view). The implementation is not a reproduction of a supplied full website composition. Product behavior lives in [PRODUCT.md](../PRODUCT.md); the accepted surface direction remains in [the redesign brief](redesign/BRIEF.md).

**Key Characteristics:**

- Warm paper and muted green, with a dark camera and red shutter.
- Restrained serif headlines beside readable, compact controls.
- Actual editable artwork as examples, labeled as AI-generated demonstration content.
- Physical scrapbook pages, tilted Polaroids, translucent tape and a central seam.
- Artwork before controls on phones; touch, keyboard and reduced-motion support.

Tokens above describe the current cascade: `src/styles.css` supplies shared controls and `src/studio/nostalgia.css`, imported afterward, supplies the current palette and redesign. The extension sidecar is [`.impeccable/design.json`](../.impeccable/design.json). This existing documentation path is retained as the design authority.

## Colors

The palette combines cream paper, muted sage and rust with charcoal camera hardware. The frontmatter owns exact values; these descriptions specify their roles.

### Primary

**Rust (`accent`)** identifies primary actions and scrapbook selection. Its darker hover variant provides feedback. The shutter has its own red hardware finish.

### Secondary

**Sage (`sage`, `selected-sage`)** supplies the italic headline accent, quiet supporting icons and selected editing categories. The lighter viewfinder green belongs to camera markings.

### Neutral

**Paper and desk (`paper`, `desk`)** separate working surfaces from the surrounding page. **Ink and muted (`ink`, `muted`)** distinguish active content from supporting copy. **Line (`line`)** forms restrained dividers. The editor and scrapbook use related green-gray workspaces; the book itself has its own cream paper. Charcoal and metal are reserved for the camera and the optional black scrapbook paper.

**The Artwork Rule.** UI color supports the photograph. Do not bake camera hardware, controls or display shadows into a Polaroid export.

## Typography

**Display font:** self-hosted DM Serif Display, with Georgia and serif fallbacks. Regular and italic files and the OFL license are in `public/fonts/dm-serif-display/`. The introduction uses regular display type with a sage italic phrase. Page headings use the same face; their inherited CSS weight is 500, rendered from the supplied regular face with UI font synthesis disabled.

**Body and controls:** Helvetica Neue, Helvetica, Arial, sans-serif. The wordmark remains system sans. Introductory prose uses the larger `intro` role and a 34-character measure. Labels use the compact `label` role; form values remain 16px. Page headings reduce to 30px on phones, while the introductory title uses 44px below 650px and 38px below 370px.

**Artwork typography is independent.** Captions and movable text offer 30 families: Studio sans, 26 on-demand Google Fonts families, bundled Caveat and Permanent Marker and Font Library's existing OFL [Lindbergh Baby](https://fontlibrary.org/en/font/lindbergh-baby). The latter is included unchanged with its license. DM Serif Display is the UI face, not an additional artwork catalog entry. Text pieces and captions retain separate font size, color, Bold and Italic controls. Exports wait for selected fonts, embed rendered lettering in SVG, and never send entered text in font requests. The 26 remote families require network access on first use. New captions use bundled Caveat, while Permanent Marker offers a bolder handwritten option.

## Layout

The shell is centered with a maximum width of 1380px and 48px desktop gutters. The desktop start introduction centers the headline above a camera up to 980px wide on warm linen. Layered ambient shadows and a subtle rim highlight lift the leather body; spectrum red accents the shutter and small film stripes. The desktop capture dialog grows to 1028px, with internal scrolling on short windows; the full-screen mobile camera keeps its independent sizing. Examples are real framed artwork, followed by an invitation to the scrapbook; they become a two-column grid on small screens.

The archived editor (`docs/ARCHIVED-EDITOR.md`) kept artwork prominent beside grouped controls on desktop. On phones the compact artwork preview remains sticky above scrolling controls, with height following the visual viewport so keyboard opening leaves room to work. The Finish screen retains direct photo movement. Direct dragging, centering and directional nudges replace coordinate-entry as the normal positioning language.

The scrapbook uses a 270px control column beside the page, reducing to 240px at 1000px. Below 700px, artwork precedes controls and the header becomes a wordmark/action row above workflow navigation. Safe-area insets protect phone edges. The collage is a 1000 × 780 logical page; strips are 360 logical pixels wide with height growing by shot count. A long strip scrolls within a workspace capped at 680px, or 410px on phones.

Preserve 44px control and gesture targets, including resize and rotation handles. Canvas arrow keys move the selected editing piece by 1px, or 10px with Shift. Scrapbook arrows move a selected collage photo or reorder a strip shot. Layout was inspected at 320px, 390px and 1280px; these are inspection sizes, not additional CSS breakpoints.

## Elevation & Depth

Depth describes physical objects. The camera combines a broad grounded shadow, inset highlights and metallic bezel gradients. Paper and photographs use softer shadows; the scrapbook seam and translucent tape communicate the page material. Panels use quiet tonal boundaries rather than competing elevations.

The sidecar records exact camera, page and photo shadow values. The pre-existing full-page noise overlay is disabled in the current design. Do not add texture merely to fill empty space.

Ordinary control feedback takes 150ms, menus open at 250ms and close at 150ms on the shared smooth-out curve. Example artwork lifts over 180ms. Camera ejection, optional shake and stage motion are presentation only; reduced-motion settings settle them and hidden-page behavior stops temporary animations. Both dial hubs sit inside their rotating wheels so their metal highlights turn together with the markings. Mobile and desktop readouts use the same transparent, shadowed text overlay. Sound has an accessible mute toggle and does not change image data.

## Shapes

Buttons have gently rounded corners; fields are slightly tighter, and larger control panels are softer. The centered camera has a rectangular black leather body, silver nameplate, square screwed viewfinder, knurled Roll control and circular red Click shutter. Preserve that silhouette instead of spreading camera ornament across unrelated controls.

The outer Polaroid stays upright and keeps its 88:107 proportions. Photos and decorations may rotate inside it. All finished Polaroid output clips to the outer frame, while the editing workspace can reveal overflow for recovery. A scrapbook may rotate complete Polaroids and overlap them on its page. Its photo-strip layout is one continuous paper roll with square image windows rather than a stack of separate framed cards.

## Components

### Buttons and navigation

Primary buttons use rust with a light label and a darker hover state. Secondary buttons use paper with a line border. Text actions retain generous hit areas. Shared buttons are at least 44px tall; the introductory primary action is at least 50px. Keyboard focus remains visible. The selected editor category uses dark sage; workflow navigation and scrapbook access remain distinct. Phone navigation occupies its own row.

### Fields and selection

Fields use a pale surface, a quiet border and 16px values. Keep native grouped font selects, live font specimens and visible loading/failure recovery. Swatches have descriptive accessible labels and 44px targets. The selected scrapbook photo has a rust outline; keyboard focus uses a thicker outline. Native disabled states remain distinguishable. Captions and text pieces have separate color controls.

### Camera

The dark body, silver bezel, green viewfinder corners and red circular shutter derive from the user's reference. Take a photo is the clearest first action; upload remains available. Every size opens the camera at / and requests permission on mount; tablets and desktops center the same camera at phone proportions. The mobile camera fills the viewport with leather, a square viewfinder and a thumb-reachable shutter. All physical controls stay visible on the leather, with 44px ISO targets and no settings drawer. Short phones keep the viewfinder above the controls and use a compact ISO wheel with all six labeled stops around the rim and a 44px central tap target; landscape places the large finder beside the controls. The camera header holds scrapbook, sound and upload buttons; there is no tagline. The shared desktop housing and aligned bottom outlet retain the original print-ejection behavior. The shared capture lifecycle survives rotation and stops on navigation. The camera supports single-photo capture, countdown, ejection and a button-triggered shake; after the reveal, Save Photo replaces the shake button and the roll control reads Roll again. Keep the camera recognizable at small widths without allowing its hardware details to crowd the primary controls.

Opening the camera dims the surrounding page with a charcoal backdrop (`#10140fd6`) and uses a dark sage-charcoal dialog surface (`#3b4037`), with warm light text (`#f5f1e5`) and secondary text (`#d1d0c3`). The camera fades in over 250ms on the shared smooth-out curve and closes over 150ms. Reduced motion and hidden-page states settle immediately through the existing motion preference. These camera-only colors live in `src/studio/camera.css`; other dialogs retain their existing surfaces.

### Artwork and scrapbook

Example thumbnails come from the same renderer and deterministic composition as the editable example. Preserve the AI-demo disclosure. Scrapbook controls expose title, paper, photo size, tilt, tape and ordering; the page remains the visual focus. Save on device and Download page are separate actions with separate purposes. Keep unsaved/saved status and storage errors visible. Reopened Polaroids update their original scrapbook item.

### Reference provenance

The supplied inspiration images remain documentation in `docs/inspiration/`, not stock screenshots displayed in the app. This historical reference map records how the original prototype interpreted them; it does not override the current tokens or component rules:

| Reference     | Applied to the prototype                                            |
| ------------- | ------------------------------------------------------------------- |
| IMG_0984–0986 | Expressive vintage lettering, cream outlines, and warm red emphasis |
| IMG_1007      | Bold display-type hierarchy; paired with quiet readable controls    |
| IMG_0991      | Physical-camera atmosphere, paper layering and an analog tabletop   |
| IMG_0996–0999 | Framed panels, small labels, stamp-like badges and keepsake details |
| IMG_1003      | Primary cream, olive, orange-red and dark-brown palette             |
| IMG_1004–1006 | Supporting muted colors and teal tape accents                       |

Interface and decoration geometry are original HTML/CSS/SVG/Canvas work. The project retains the supplied STL models and their original Printables source links in the README. The existing GPL-3.0 repository license and third-party rights remain unchanged. Font licenses accompany the self-hosted fonts.

The current sample is served as `public/sample-flash.webp`; its image-generation provenance and user-directed grain/flash refinements are recorded in [CAMERA-REFINEMENT.md](redesign/CAMERA-REFINEMENT.md). The older `public/sample-coast.png` remains a source fixture for renderer tests. The following prompt documents that historical coastal sample. It is an AI-generated demo scene, not a user photograph. Original generation prompt:

> Use case: photorealistic-natural. Asset type: sample photograph inside a retro Polaroid collage website. Create a square analog 35mm film photograph of the California coastline at golden hour, a winding coastal road at left, sunlit ochre cliffs and wildflowers in foreground, a muted teal Pacific ocean and distant hazy mountains, one tiny vintage cream camper van parked by a lookout. Warm imperfect nostalgic 1970s vacation snapshot, visible fine film grain, subtle faded color, soft light and authentic natural composition. No people, no text, no border, no watermarks. Save as a project sample photo.

## Do's and Don'ts

- **Do** use the current palette overrides and self-hosted serif headings with system controls.
- **Do** keep the camera action clear and preserve direct manipulation, touch targets and keyboard alternatives.
- **Do** retain full source-photo proportions on import and let users choose their crop.
- **Do** show the actual framed result in finished previews and exports.
- **Do** use paper, seam, tilt and tape to make scrapbook pages feel handmade.
- **Do** disclose the AI-generated examples and distinguish explicit saving from downloading.
- **Don't** reintroduce automatic cover-cropping for imported artwork or export content outside the outer Polaroid frame.
- **Don't** make system-only headings, coordinate fields or a generic card grid the design direction.
- **Don't** let sound or animation modify artwork, and respect reduced motion.
- **Don't** imply cloud backup, automatic persistence, universal offline fonts or verified installation on untested physical devices.


