// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CameraSettings, { isoAt, timerAngle, timerSecondsAt, type CameraISO, type TimerSeconds } from "./CameraSettings";

it("maps the bar to the nearest ISO stop with 800 in the centre", () => {
  expect([0, .25, .5, .75, 1].map(isoAt)).toEqual([100, 400, 800, 1600, 3200]);
  expect(isoAt(.6)).toBe(800);
  expect(isoAt(.63)).toBe(1600);
  expect(isoAt(-1)).toBe(100);
});

it("maps the dial angle to the nearest timer mark between its hard stops", () => {
  expect(([0, 3, 5, 10] as const).map(timerAngle)).toEqual([45, -45, -135, -225]);
  expect(timerSecondsAt(-171)).toBe(5);
  expect(timerSecondsAt(-185)).toBe(10);
  expect(timerSecondsAt(100)).toBe(0);
  expect(timerSecondsAt(-400)).toBe(10);
});

const render = async (props: { disabled?: boolean; onISO?: (v: CameraISO) => void; onSeconds?: (v: TimerSeconds) => void; seconds?: TimerSeconds; iso?: CameraISO }, root = createRoot(document.body.appendChild(document.createElement("div")))) => {
  await act(async () => root.render(<CameraSettings seconds={props.seconds ?? 0} onSeconds={props.onSeconds ?? (() => {})} preset="Classic" onPreset={() => {}} flash={false} onFlash={() => {}} iso={props.iso ?? 800} onISO={props.onISO ?? (() => {})} disabled={props.disabled ?? false}/>));
  return root;
};
const pointer = (target: Element, type: string, clientX: number, clientY = 0) => act(async () => target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })));

it("lets the ISO needle follow a drag, then snaps it to the nearest stop", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onISO = vi.fn(), root = await render({ onISO });
  const track = document.querySelector<HTMLElement>('[role="slider"]')!, slider = track.parentElement!;
  // 16px padding each side leaves a 400px travel: stops every 100px from x=16.
  track.style.paddingLeft = track.style.paddingRight = "16px";
  track.getBoundingClientRect = () => ({ left: 0, width: 432 }) as DOMRect;
  track.hasPointerCapture = () => true;
  await pointer(track, "pointerdown", 10); expect(onISO).toHaveBeenLastCalledWith(100);
  await pointer(track, "pointerdown", 150); expect(onISO).toHaveBeenLastCalledWith(400);
  await pointer(track, "pointerdown", 430); expect(onISO).toHaveBeenLastCalledWith(3200);
  // Mid-drag the needle sits under the finger (71% along); the value is already the nearest stop.
  await pointer(track, "pointermove", 300);
  expect(slider.classList.contains("sliding")).toBe(true);
  expect(slider.style.getPropertyValue("--iso-position")).toBe("0.71");
  expect(onISO).toHaveBeenLastCalledWith(1600);
  await pointer(track, "pointerup", 300);
  await render({ onISO, iso: 1600 }, root);
  expect(slider.classList.contains("sliding")).toBe(false);
  expect(slider.style.getPropertyValue("--iso-position")).toBe("0.75");
  onISO.mockClear(); await render({ onISO, disabled: true }, root); await pointer(track, "pointerdown", 10);
  expect(onISO).not.toHaveBeenCalled();
  expect(track.tabIndex).toBe(-1);
  await act(async () => root.unmount()); document.body.replaceChildren();
});

it("turns the timer dial with a drag, settles on the nearest mark, and still takes a tap", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onSeconds = vi.fn(), root = await render({ onSeconds });
  const dial = document.querySelector<HTMLElement>(".timer-dial")!, rotor = document.querySelector<HTMLElement>(".timer-rotor")!;
  dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  // Grab the rim at 3 o'clock; the turn starts 6px later at -12°, then sweeps 216° anticlockwise to -171°.
  const at = (degrees: number) => [50 + 50 * Math.cos(degrees * Math.PI / 180), 50 + 50 * Math.sin(degrees * Math.PI / 180)] as const;
  await pointer(dial, "pointerdown", ...at(0));
  await pointer(dial, "pointermove", ...at(-12));
  expect(dial.classList.contains("turning")).toBe(true);
  await pointer(dial, "pointermove", ...at(-112));
  await pointer(dial, "pointermove", ...at(-228));
  expect(parseFloat(rotor.style.transform.slice(7))).toBeCloseTo(-171);
  expect(onSeconds).toHaveBeenLastCalledWith(5);
  await pointer(dial, "pointerup", 0, 0);
  await render({ onSeconds, seconds: 5 }, root);
  expect(dial.classList.contains("turning")).toBe(false);
  expect(rotor.style.transform).toBe("rotate(-135deg)");
  // A tap on a printed mark sets it.
  const off = document.querySelector<HTMLButtonElement>('.timer-stop.stop-0')!;
  await pointer(off, "pointerdown", 20, 20);
  await act(async () => off.click());
  expect(onSeconds).toHaveBeenLastCalledWith(0);
  await act(async () => root.unmount()); document.body.replaceChildren();
});
