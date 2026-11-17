import {
  FRAME,
  PHOTO,
  DEFAULT_CROP,
  type Asset,
  type Assets,
  type Composition,
  type Crop,
  type Layer,
  type Rect,
} from "./model";
import { applyEffects } from "./effects";
import { fontCss, loadCompositionFonts } from "./fonts";
import { assertComposition, assertRenderSize } from "./limits";
export function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  return c;
}
export type TextureSettings = { crop: Crop; effects: Composition["effects"] };
export function cropGeometry(
  asset: Pick<Asset, "width" | "height">,
  crop: Crop,
) {
  const size = (crop.original ? Math.max(asset.width, asset.height) : Math.min(asset.width, asset.height)) / crop.zoom;
  return {
    x: (asset.width - size) / 2 - (crop.x * size) / PHOTO.size,
    y: (asset.height - size) / 2 - (crop.y * size) / PHOTO.size,
    width: size,
    height: size,
  };
}
const cache = new WeakMap<Asset, Map<string, Promise<HTMLCanvasElement>>>();
export function texture(
  asset: Asset,
  settings: TextureSettings,
  scale: number,
) {
  const key = JSON.stringify([settings.crop, settings.effects, scale]);
  let entries = cache.get(asset);
  if (!entries) {
    entries = new Map();
    cache.set(asset, entries);
  }
  if (entries.has(key)) return entries.get(key)!;
  const result = (async () => {
    const c = canvas(PHOTO.size * scale, PHOTO.size * scale),
      ctx = c.getContext("2d")!,
      crop = cropGeometry(asset, settings.crop);
    ctx.drawImage(
      asset.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      c.width,
      c.height,
    );
    ctx.putImageData(
      await applyEffects(
        ctx.getImageData(0, 0, c.width, c.height),
        settings.effects,
      ),
      0,
      0,
    );
    return c;
  })();
  if (entries.size >= 6) entries.delete(entries.keys().next().value!);
  entries.set(key, result);
  void result.catch(() => entries!.delete(key));
  return result;
}
export type Textures = Record<string, HTMLCanvasElement>;
export async function prepareTextures(
  assets: Assets,
  c: Composition,
  scale: number,
): Promise<Textures> {
  const entries = await Promise.all(
    c.layers
      .map(async (l) => {
        const asset = assets[l.assetId!];
        if (!asset)
          throw new Error("A photo source is missing. Please upload it again.");
        return [
          l.id,
          await texture(
            asset,
            { crop: l.crop || DEFAULT_CROP, effects: c.effects },
            scale,
          ),
        ] as const;
      }),
  );
  return Object.fromEntries(entries);
}
export function drawCaption(ctx: CanvasRenderingContext2D, caption: string, fontId?: string, fontSize = 25) {
  ctx.fillStyle = "#493e30";
  ctx.font = fontCss(fontId, fontSize);
  // Left-aligned with the photo's left edge, just below it.
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, PHOTO.x, 556, PHOTO.size);
}
export async function renderComposition(
  target: HTMLCanvasElement,
  assets: Assets,
  c: Composition,
  region: Rect,
  scale = 1,
) {
  assertComposition(c);
  assertRenderSize(region, scale);
  await loadCompositionFonts(c);
  await document.fonts?.ready;
  return paintComposition(
    target,
    await prepareTextures(assets, c, scale),
    c,
    region,
    scale,
  );
}
export function paintComposition(
  target: HTMLCanvasElement,
  photos: Textures,
  c: Composition,
  region: Rect,
  scale = 1,
) {
  assertComposition(c);
  assertRenderSize(region, scale);
  const width = Math.ceil(region.width * scale),
    height = Math.ceil(region.height * scale);
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-region.x, -region.y);
  ctx.fillStyle = c.frameColor;
  ctx.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  const draw = (layer: Layer) => {
    const photo = photos[layer.id],
      s = layer.source;
    if (!photo || !s) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-layer.width / 2, -layer.height / 2);
    const factor = photo.width / PHOTO.size;
    ctx.drawImage(
      photo,
      s.x * factor,
      s.y * factor,
      s.width * factor,
      s.height * factor,
      0,
      0,
      layer.width,
      layer.height,
    );
    ctx.restore();
  };
  c.layers.forEach(draw);
  // The locked frame is painted above photos; its square aperture stays transparent.
  ctx.fillStyle = c.frameColor;
  ctx.beginPath();
  ctx.rect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  ctx.rect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size);
  ctx.fill("evenodd");
  drawCaption(ctx, c.caption, c.captionFont, c.captionSize);
  return target;
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function flatten(output: HTMLCanvasElement) {
  const ctx = output.getContext("2d")!;
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.restore();
  return output;
}
export function canvasBlob(output: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (b) =>
        b && b.type === type
          ? resolve(b)
          : reject(
              new Error(
                "This browser could not encode " +
                  type +
                  ". Try saving again.",
              ),
            ),
      type,
      0.95,
    ),
  );
}
/** A per-save name, so a browser never asks to replace or re-download an earlier my-polaroid file. */
export function exportName(extension: string, at = new Date()) {
  const two = (n: number) => String(n).padStart(2, "0");
  return `my-polaroid-${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}${two(at.getSeconds())}.${extension}`;
}
/** The framed print as a JPEG, the format Save Photo shares or downloads. */
export async function prepareExport(assets: Assets, c: Composition) {
  const out = flatten(await renderComposition(canvas(1, 1), assets, c, FRAME, 3));
  return new File([await canvasBlob(out, "image/jpeg")], exportName("jpg"), { type: "image/jpeg" });
}
export async function exportFile(assets: Assets, c: Composition) {
  const file = await prepareExport(assets, c);
  download(file, file.name);
}
