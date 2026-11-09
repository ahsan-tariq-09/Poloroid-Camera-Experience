// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ importPolaroid: vi.fn() }));
vi.mock("./studio/CameraPreview", () => ({ default: () => null }));
vi.mock("./scrapbook", async (original) => ({
  ...(await original<typeof import("./scrapbook")>()),
  importPolaroid: mocks.importPolaroid,
  loadScrapbook: async () => null,
}));
import App from "./App";

let root: Root, host: HTMLDivElement;
const go = async (path: string) => {
  await act(async () => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
};

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
  mocks.importPolaroid.mockImplementation(async (file: File) => ({
    assets: { photo: { name: file.name, url: "blob:uploaded", width: 800, height: 600, image: {} } },
    composition: {},
  }));
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn();
  window.history.replaceState(null, "", "/");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("opens the camera at every size without the Start, Edit, and Finish workflow", () => {
  expect(host.querySelector("main.mobile-camera")).not.toBeNull();
  expect(host.querySelector('nav[aria-label="Studio steps"], .site-header')).toBeNull();
  expect(host.querySelector('a[href="/edit"], a[href="/finish"]')).toBeNull();
  expect(host.textContent).not.toContain("Made to keep.");
  expect(host.querySelector('a[href="/scrapbook"]')).toBeNull();
});

it.each(["/edit", "/finish", "/camera", "/unknown"])("returns %s to the camera", async (path) => {
  await go(path);
  expect(window.location.pathname).toBe("/");
  expect(host.querySelector("main.mobile-camera")).not.toBeNull();
});

it("prints one uploaded photo on the camera", async () => {
  const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
  expect(input.multiple).toBe(false);
  const file = new File(["x"], "beach.jpg");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(mocks.importPolaroid).toHaveBeenCalledWith(file, true);
  expect(host.querySelector(".instant-print")).not.toBeNull();
  expect(window.location.pathname).toBe("/");
});

it("keeps the scrapbook without links back into the editor", async () => {
  await go("/scrapbook");
  expect(host.querySelector(".scrapbook-screen")).not.toBeNull();
  expect(host.textContent).not.toContain("Edit this Polaroid");
  expect(host.querySelector('nav[aria-label="Studio steps"]')).toBeNull();
  await act(async () => host.querySelector<HTMLAnchorElement>(".wordmark")!.click());
  expect(window.location.pathname).toBe("/");
  // Returning to the camera must not print the earlier upload again.
  expect(host.querySelector(".instant-print")).toBeNull();
});
