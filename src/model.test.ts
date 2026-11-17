import { describe, expect, it } from "vitest";
import { FRAME, bounds, initialComposition } from "./model";
import { cropGeometry } from "./render";
import { cpuEffects } from "./effects";

describe("frame geometry", () => {
  it("keeps the frame at the classic 88:107 ratio and includes photo overflow", () => {
    const c = initialComposition();
    const original = bounds(c);
    c.layers[0].x = -500;
    c.layers[0].rotation = 45;
    expect(bounds(c).x).toBeLessThan(original.x);
    expect(FRAME.width / FRAME.height).toBeCloseTo(88 / 107);
  });
  it("crops portrait and landscape sources to a centered square", () => {
    expect(
      cropGeometry({ width: 800, height: 1200 }, { zoom: 1, x: 0, y: 0 }),
    ).toEqual({ x: 0, y: 200, width: 800, height: 800 });
    expect(
      cropGeometry({ width: 1200, height: 800 }, { zoom: 2, x: 0, y: 0 }),
    ).toEqual({ x: 400, y: 200, width: 400, height: 400 });
  });
});
describe("fallback effects", () => {
  it("preserves alpha and is deterministic for a grain seed", () => {
    const pixels = new Uint8ClampedArray([150, 120, 90, 255, 0, 0, 0, 0]);
    const settings = { film: 0.7, copier: 0, seed: 76 };
    const a = cpuEffects(pixels, 2, 1, settings),
      b = cpuEffects(pixels, 2, 1, settings);
    expect(a).toEqual(b);
    expect(a[3]).toBe(255);
    expect(a[7]).toBe(0);
    expect(a[0]).not.toBe(pixels[0]);
  });
  it("leaves an original photo unchanged when effects are off", () => {
    const pixels = new Uint8ClampedArray([80, 100, 170, 255]);
    expect(cpuEffects(pixels, 1, 1, { film: 0, copier: 0, seed: 76 })).toEqual(
      pixels,
    );
  });
});
