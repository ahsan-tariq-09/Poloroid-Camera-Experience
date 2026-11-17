import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  initialComposition,
  photoLayer,
  FRAME,
  type Asset,
} from "./model";
import {
  canvas,
  renderComposition,
  drawCaption,
  exportName,
} from "./render";

beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => createCanvas(1, 1) });
  vi.stubGlobal("ImageData", ImageData);
});
async function makeAsset(svg?: string): Promise<Asset> {
  let image;
  if (svg) image = await loadImage(Buffer.from(svg));
  else {
    const c = createCanvas(300, 200),
      ctx = c.getContext("2d");
    ctx.fillStyle = "#286c79";
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = "#e47932";
    ctx.fillRect(150, 0, 150, 200);
    image = await loadImage(c.toBuffer("image/png"));
  }
  return {
    image: image as unknown as HTMLImageElement,
    width: image.width,
    height: image.height,
    url: "test",
    name: "test",
    svg,
  };
}
const at = (output: HTMLCanvasElement, x: number, y: number) => [
  ...output.getContext("2d")!.getImageData(x, y, 1, 1).data,
];
describe("real Polaroid rendering and export", () => {
  it("preserves both edges and the proportions of a wide imported photo", async () => {
    const asset = await makeAsset(), c = initialComposition();
    c.layers = [photoLayer("sample", "Landscape", 0, asset)];
    expect(c.layers[0].width / c.layers[0].height).toBeCloseTo(1.5);
    const out = await renderComposition(canvas(1,1), {sample:asset}, c, FRAME, 1);
    expect(at(out,35,200)).toEqual([40,108,121,255]);
    expect(at(out,485,200)).toEqual([228,121,50,255]);
    expect(at(out,260,35)).toEqual([255,249,233,255]);
  });
  it("clips a download to the frame even when a rotated photograph is far outside it", async () => {
    const asset = await makeAsset(), c = initialComposition();
    Object.assign(c.layers[0], {x: -180, y: -100, width: 900, height: 900, rotation: 23});
    const out = await renderComposition(canvas(1, 1), {sample: asset}, c, FRAME, 3);
    expect(out.width).toBe(1560);
    expect(out.height).toBe(Math.ceil(FRAME.height * 3));
    expect(at(out, 5, 5)).toEqual([255, 249, 233, 255]);
  });
  it("renders only the supplied caption using the interface font stack", () => {
    const fillText = vi.fn();
    const ctx = { fillText } as unknown as CanvasRenderingContext2D;
    drawCaption(ctx, "Coast, October 2026");
    expect(fillText).toHaveBeenCalledExactlyOnceWith(
      "Coast, October 2026",
      70,
      556,
      460,
    );
    expect(ctx.font).toBe(
      '25px "Helvetica Neue", Helvetica, Arial, sans-serif',
    );
  });
  it("draws the requested caption face and size", () => {
    const ctx = {fillText: vi.fn()} as unknown as CanvasRenderingContext2D;
    drawCaption(ctx, "12 Nov 2026", "oswald", 36);
    expect(ctx.font).toBe('36px "Oswald", "Helvetica Neue", Helvetica, Arial, sans-serif');
  });
  it("renders the actual sample as a complete Polaroid", async () => {
    const image = await loadImage("public/sample-coast.png");
    const asset = {
      image: image as unknown as HTMLImageElement,
      width: image.width,
      height: image.height,
      url: "sample",
      name: "sample",
    };
    const composition = initialComposition();
    const output = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      composition,
      FRAME,
      3,
    );
    mkdirSync(".sites-runtime/qa", { recursive: true });
    writeFileSync(
      ".sites-runtime/qa/sample-poloroid.png",
      Buffer.from(output.toDataURL("image/png").split(",")[1], "base64"),
    );
    expect(at(output, 10, 10)).toEqual([255, 249, 233, 255]);
    expect(output.height / output.width).toBeCloseTo(
      Math.ceil(FRAME.height) / FRAME.width,
    );
  });
  it("exports the complete frame with a wider caption area", async () => {
    const asset = await makeAsset(),
      c = initialComposition(),
      region = FRAME;
    const output = await renderComposition(
      canvas(1, 1),
      { sample: asset },
      c,
      region,
      3,
    );
    expect(output.width).toBe(1560);
    expect(output.height).toBe(Math.ceil(FRAME.height * 3));
    expect(at(output, 4, 4)).toEqual([255, 249, 233, 255]);
    expect(at(output, 750, 1750)).toEqual([255, 249, 233, 255]);
    expect(at(output, 350, 300)[0]).toBe(40);
    expect(at(output, 1200, 300)[0]).toBe(228);
  });
});

it("names each export by its save time so browsers never ask to download it again", () => {
  expect(exportName("jpg", new Date(2026, 10, 1, 9, 5, 7))).toBe("my-polaroid-2026-11-01-090507.jpg");
});
