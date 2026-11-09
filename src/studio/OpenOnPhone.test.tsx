// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import OpenOnPhone from "./OpenOnPhone";

vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }));
const media = (desktop: boolean) => Object.assign(globalThis, { matchMedia: vi.fn(() => ({ matches: desktop })) });
afterEach(() => { Reflect.deleteProperty(globalThis, "matchMedia"); document.body.replaceChildren(); });

it("opens the phone QR code on every desktop visit and closes it on Escape or an outside press", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  media(true);
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<OpenOnPhone/>));
  const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Open on your phone"]')!;
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.querySelector<HTMLImageElement>(".phone-qr img")!.alt).toBe(`QR code for ${location.origin}/`);
  document.querySelector<HTMLButtonElement>(".phone-qr-close")!.focus();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(document.querySelector(".phone-qr")).toBeNull();
  expect(document.activeElement).toBe(toggle);
  await act(async () => toggle.click());
  expect(document.querySelector(".phone-qr")).not.toBeNull();
  await act(async () => document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => root.unmount());
});

it("shows nothing on phones and tablets", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  media(false);
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<OpenOnPhone/>));
  expect(document.querySelector(".open-on-phone")).toBeNull();
  await act(async () => root.unmount());
});
