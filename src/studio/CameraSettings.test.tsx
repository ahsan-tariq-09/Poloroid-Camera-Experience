// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CameraSettings, { isoAt, timerAngle, timerSecondsAt, type CameraISO, type TimerSeconds } from "./CameraSettings";
import { playDetent, stopDetent } from "../sounds";

vi.mock("../sounds", () => ({ playDetent: vi.fn(), stopDetent: vi.fn() }));

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

it("clicks the ISO bar once per stop change and stays quiet on the same stop", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(playDetent).mockClear();
  const onISO = vi.fn(), root = await render({ onISO, iso: 100 });
  const track = document.querySelector<HTMLElement>('[role="slider"]')!;
  await act(async () => track.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(playDetent).not.toHaveBeenCalled();
  await act(async () => track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(onISO).toHaveBeenLastCalledWith(400);
  expect(playDetent).toHaveBeenCalledTimes(1); expect(playDetent).toHaveBeenCalledWith("iso");
  await act(async () => root.unmount()); document.body.replaceChildren();
});

it("turns the timer dial with a drag, settles on the nearest mark, and still takes a tap", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(playDetent).mockClear();
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
  // The ratchet recording plays once per turn, not at every mark the turn passes.
  expect(playDetent).toHaveBeenCalledTimes(1); expect(playDetent).toHaveBeenCalledWith("dial");
  await pointer(dial, "pointerup", 0, 0);
  await render({ onSeconds, seconds: 5 }, root);
  expect(dial.classList.contains("turning")).toBe(false);
  expect(rotor.style.transform).toBe("rotate(-135deg)");
  // A tap on a printed mark sets it.
  const off = document.querySelector<HTMLButtonElement>('.timer-stop.stop-0')!;
  await pointer(off, "pointerdown", 20, 20);
  await act(async () => off.click());
  expect(onSeconds).toHaveBeenLastCalledWith(0);
  expect(playDetent).toHaveBeenCalledTimes(2);
  // Tapping the mark already set is not a turn.
  await act(async () => document.querySelector<HTMLButtonElement>('.timer-stop.stop-2')!.click());
  expect(playDetent).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount()); document.body.replaceChildren();
});

it("cuts the dial recording when the rotor reaches the new mark", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  try {
    const onSeconds = vi.fn(), root = await render({ onSeconds, seconds: 3 });
    await act(async () => { vi.advanceTimersByTime(1500); });
    vi.mocked(stopDetent).mockClear(); vi.mocked(playDetent).mockClear();
    // 3s to 5s is a quarter turn, which eases over 1s.
    await act(async () => document.querySelector<HTMLButtonElement>(".timer-stop.stop-2")!.click());
    await render({ onSeconds, seconds: 5 }, root);
    expect(playDetent).toHaveBeenCalledWith("dial");
    const rotor = document.querySelector<HTMLElement>(".timer-dial")!;
    expect(rotor.style.getPropertyValue("--dial-duration")).toBe("1000ms");
    await act(async () => { vi.advanceTimersByTime(990); });
    expect(stopDetent).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(20); });
    expect(stopDetent).toHaveBeenCalledWith("dial");
    // 5s back to Off is two quarter turns, capped at the 1.35s recording.
    await render({ onSeconds, seconds: 0 }, root);
    expect(rotor.style.getPropertyValue("--dial-duration")).toBe("1350ms");
    await act(async () => root.unmount()); document.body.replaceChildren();
  } finally { vi.useRealTimers(); }
});

it("stays silent when the dial is pushed past its hard stop", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(playDetent).mockClear();
  const onSeconds = vi.fn(), root = await render({ onSeconds, seconds: 10 });
  const dial = document.querySelector<HTMLElement>(".timer-dial")!, rotor = document.querySelector<HTMLElement>(".timer-rotor")!;
  dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  const at = (degrees: number) => [50 + 50 * Math.cos(degrees * Math.PI / 180), 50 + 50 * Math.sin(degrees * Math.PI / 180)] as const;
  // 10s is the anticlockwise stop; turning further anticlockwise cannot move the rotor.
  await pointer(dial, "pointerdown", ...at(0));
  await pointer(dial, "pointermove", ...at(-12));
  await pointer(dial, "pointermove", ...at(-112));
  expect(rotor.style.transform).toBe("rotate(-225deg)");
  expect(playDetent).not.toHaveBeenCalled(); expect(onSeconds).not.toHaveBeenCalled();
  // Turning back off the stop moves it, and plays once.
  await pointer(dial, "pointermove", ...at(-60));
  await pointer(dial, "pointermove", ...at(-10));
  expect(playDetent).toHaveBeenCalledTimes(1); expect(playDetent).toHaveBeenCalledWith("dial");
  await pointer(dial, "pointerup", 0, 0);
  await act(async () => root.unmount()); document.body.replaceChildren();
});

it("plays the matching recording when the flash switch turns on or off", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(playDetent).mockClear();
  const onFlash = vi.fn(), root = createRoot(document.body.appendChild(document.createElement("div")));
  const show = (flash: boolean) => act(async () => root.render(<CameraSettings seconds={0} onSeconds={() => {}} preset="Classic" onPreset={() => {}} flash={flash} onFlash={onFlash} iso={800} onISO={() => {}} disabled={false}/>));
  await show(false);
  await act(async () => document.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(playDetent).toHaveBeenLastCalledWith("flashOn"); expect(onFlash).toHaveBeenLastCalledWith(true);
  await show(true);
  await act(async () => document.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(playDetent).toHaveBeenLastCalledWith("flashOff"); expect(onFlash).toHaveBeenLastCalledWith(false);
  await act(async () => root.unmount()); document.body.replaceChildren();
});
