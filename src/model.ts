export const FRAME = { x: 40, y: 35, width: 520, height: (520 * 107) / 88 };
export const PHOTO = { x: 70, y: 65, size: 460 };
export type Rect = { x: number; y: number; width: number; height: number };
export type Crop = { zoom: number; x: number; y: number; original?: boolean };
export const DEFAULT_CROP: Crop = { zoom: 1, x: 0, y: 0 };
export type Layer = Rect & {
  id: string;
  kind: "photo";
  name: string;
  rotation: number;
  opacity: number;
  assetId?: string;
  crop?: Crop;
  source?: Rect;
};
export type Composition = {
  layers: Layer[];
  effects: { film: number; copier: number; seed: number; grayscale?: number };
  caption: string;
  captionFont?: string;
  captionSize?: number;
  frameColor: string;
};
export type Asset = {
  image: HTMLImageElement;
  width: number;
  height: number;
  name: string;
  svg?: string;
  url: string;
};
export type Assets = Record<string, Asset>;
export const clone = <T>(value: T): T => structuredClone(value);
export function photoLayer(
  assetId: string,
  name = "Your photograph",
  index = 0,
  dimensions?: Pick<Asset, "width" | "height">,
): Layer {
  const size = index ? PHOTO.size * 0.7 : PHOTO.size,
    offset = index ? 22 + ((index - 1) % 4) * 24 : 0;
  const longest = dimensions ? Math.max(dimensions.width, dimensions.height) : 1;
  const ratioX = dimensions ? dimensions.width / longest : 1;
  const ratioY = dimensions ? dimensions.height / longest : 1;
  return {
    id: crypto.randomUUID(),
    kind: "photo",
    name,
    assetId,
    crop: { ...DEFAULT_CROP, ...(dimensions ? {original: true} : {}) },
    x: PHOTO.x + offset + (size - size * ratioX) / 2,
    y: PHOTO.y + offset + (size - size * ratioY) / 2,
    width: size * ratioX,
    height: size * ratioY,
    rotation: 0,
    opacity: 1,
    source: { x: PHOTO.size * (1-ratioX)/2, y: PHOTO.size * (1-ratioY)/2, width: PHOTO.size*ratioX, height: PHOTO.size*ratioY },
  };
}
export function initialComposition(assetId = "sample"): Composition {
  return {
    layers: [photoLayer(assetId)],
    effects: { film: 0, copier: 0, seed: 76 },
    caption: "",
    captionFont: "caveat",
    captionSize: 32,
    frameColor: "#fff9e9",
  };
}
export function bounds(composition: Composition): Rect {
  let left = FRAME.x,
    top = FRAME.y,
    right = FRAME.x + FRAME.width,
    bottom = FRAME.y + FRAME.height;
  for (const l of composition.layers) {
    const a = (l.rotation * Math.PI) / 180,
      hw =
        (Math.abs(l.width * Math.cos(a)) + Math.abs(l.height * Math.sin(a))) /
        2,
      hh =
        (Math.abs(l.width * Math.sin(a)) + Math.abs(l.height * Math.cos(a))) /
        2;
    left = Math.min(left, l.x + l.width / 2 - hw);
    right = Math.max(right, l.x + l.width / 2 + hw);
    top = Math.min(top, l.y + l.height / 2 - hh);
    bottom = Math.max(bottom, l.y + l.height / 2 + hh);
  }
  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width: Math.ceil(right) - Math.floor(left),
    height: Math.ceil(bottom) - Math.floor(top),
  };
}