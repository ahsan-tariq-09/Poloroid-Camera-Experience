import type { Composition } from "./model";

export const STUDIO_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
// Caption faces: Caveat for uploads, Oswald for dated camera prints. Both are bundled, so captions render offline.
export const fonts = [
  { id: "studio", name: "Studio sans", family: STUDIO_FONT },
  { id: "caveat", name: "Caveat", family: `"Caveat", ${STUDIO_FONT}`, source: "/fonts/caveat/Caveat.ttf" },
  { id: "oswald", name: "Oswald", family: `"Oswald", ${STUDIO_FONT}`, source: "/fonts/oswald/Oswald-SemiBold.ttf" },
] as const;

export function fontById(id = "studio") {
  return fonts.find(f => f.id === id) || fonts[0];
}
export function fontFamily(id?: string) { return fontById(id).family; }
export function fontCss(id: string | undefined, size: number) {
  return `${size}px ${fontFamily(id)}`;
}
const faces = new Set<string>();
export async function loadFont(id = "studio", text = "Polaroid") {
  const font = fontById(id);
  if (!("source" in font) || typeof document === "undefined" || !document.fonts?.load) return;
  if (!faces.has(font.id)) {
    const style = document.createElement("style");
    style.textContent = `@font-face {font-family:${font.family.split(",")[0]};src:url("${font.source}") format("truetype");font-display:swap;}`;
    document.head.append(style); faces.add(font.id);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.load(fontCss(id, 32), text || "Polaroid").then(loaded => {
        if (!loaded.length) throw new Error("Font unavailable");
      }),
      new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error("Font timed out")), 12000);}),
    ]);
  } catch {
    throw new Error(`${font.name} could not load. Try again.`);
  } finally { clearTimeout(timer); }
}
export async function loadCompositionFonts(c: Composition) {
  if (c.caption) await loadFont(c.captionFont, c.caption);
}
