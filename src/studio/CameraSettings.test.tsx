// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CameraSettings, { isoAt, isoPosition, timerAngle, timerSecondsAt } from "./CameraSettings";

it("maps the ruler to ISO with 800 in the centre and values between the marks", () => {
  expect([0, .25, .5, .75, 1].map(isoAt)).toEqual([100, 400, 800, 1600, 3200]);
  expect(isoAt(.625)).toBe(1131);
  for (const iso of [100, 250, 800, 1131, 3200]) expect(isoAt(isoPosition(iso))).toBe(iso);
});

it("maps the dial angle to whole seconds between its hard stops", () => {
  expect([0, 3, 5, 10].map(timerAngle)).toEqual([45, -45, -135, -225]);
  expect(timerSecondsAt(timerAngle(7))).toBe(7);
  expect(timerSecondsAt(100)).toBe(0);
  expect(timerSecondsAt(-400)).toBe(10);
});

const render = async (props: { disabled?: boolean; onISO?: (v: number) => void; onSeconds?: (v: number) => void; seconds?: number }, root = createRoot(document.body.appendChild(document.createElement("div")))) => {
  await act(async () => root.render(<CameraSettings seconds={props.seconds ?? 0} onSeconds={props.onSeconds ?? (() => {})} preset="Classic" onPreset={() => {}} flash={false} onFlash={() => {}} iso={800} onISO={props.onISO ?? (() => {})} disabled={props.disabled ?? false}/>));
  return root;
};
const pointer = (target: Element, type: string, clientX: number, clientY = 0) => act(async () => target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })));

it("follows a pointer along the ISO ruler and ignores it while disabled", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onISO = vi.fn(), root = await render({ onISO });
  const track = document.querySelector<HTMLElement>('[role="slider"]')!;
  // 16px padding each side leaves a 400px ruler: marks every 100px from x=16.
  track.style.paddingLeft = track.style.paddingRight = "16px";
  track.getBoundingClientRect = () => ({ left: 0, width: 432 }) as DOMRect;
  await pointer(track, "pointerdown", 10); expect(onISO).toHaveBeenLastCalledWith(100);
  await pointer(track, "pointerdown", 266); expect(onISO).toHaveBeenLastCalledWith(1131);
  await pointer(track, "pointerdown", 430); expect(onISO).toHaveBeenLastCalledWith(3200);
  onISO.mockClear(); await render({ onISO, disabled: true }, root); await pointer(track, "pointerdown", 10);
  expect(onISO).not.toHaveBeenCalled();
  expect(track.tabIndex).toBe(-1);
  await act(async () => root.unmount()); document.body.replaceChildren();
});

it("turns the timer dial with a drag, stays where released, and still takes a tap on a mark", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onSeconds = vi.fn(), root = await render({ onSeconds });
  const dial = document.querySelector<HTMLElement>(".timer-dial")!, rotor = document.querySelector<HTMLElement>(".timer-rotor")!;
  dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  // Grab the rim at 3 o'clock, then sweep 216° anticlockwise: Off to 7s (between the 5s and 10s marks).
  const at = (degrees: number) => [50 + 50 * Math.cos(degrees * Math.PI / 180), 50 + 50 * Math.sin(degrees * Math.PI / 180)] as const;
  await pointer(dial, "pointerdown", ...at(0));
  await pointer(dial, "pointermove", ...at(-12));
  expect(dial.classList.contains("turning")).toBe(true);
  await pointer(dial, "pointermove", ...at(-112));
  await pointer(dial, "pointermove", ...at(-228));
  expect(onSeconds).toHaveBeenLastCalledWith(7);
  const released = rotor.style.transform;
  await pointer(dial, "pointerup", 0, 0);
  await render({ onSeconds, seconds: 7 }, root);
  expect(rotor.style.transform).toBe(released);
  expect(dial.classList.contains("turning")).toBe(false);
  // A tap on a printed mark sets it.
  const off = document.querySelector<HTMLButtonElement>('[aria-label="Timer off"]')!;
  await pointer(off, "pointerdown", 20, 20);
  await act(async () => off.click());
  expect(onSeconds).toHaveBeenLastCalledWith(0);
  await act(async () => root.unmount()); document.body.replaceChildren();
});
