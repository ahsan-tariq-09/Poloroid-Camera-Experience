// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialComposition } from "../model";

const mocks = vi.hoisted(() => ({ prepareExport: vi.fn(), download: vi.fn() }));
vi.mock("../render", () => mocks);
import SavePhotoButton, { type SaveStudio } from "./SavePhotoButton";

let root: Root, host: HTMLDivElement;
let studio: SaveStudio;
const share = vi.fn(),
  canShare = vi.fn();
const jpeg = new File(["jpeg"], "my-polaroid.jpg", { type: "image/jpeg" });
const button = () => host.querySelector("button")!;
const render = async () => {
  await act(async () => root.render(<SavePhotoButton studio={studio} />));
};
const click = async () => {
  await act(async () => button().click());
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("isSecureContext", true);
  vi.spyOn(navigator, "platform", "get").mockReturnValue("iPhone");
  Object.defineProperties(navigator, {
    share: { configurable: true, value: share },
    canShare: { configurable: true, value: canShare },
  });
  mocks.prepareExport.mockResolvedValue(jpeg);
  share.mockResolvedValue(undefined);
  canShare.mockReturnValue(true);
  studio = {
    assets: {},
    composition: initialComposition(),
    format: "jpeg",
    busy: false,
    exporting: false,
    exportFile: vi.fn().mockResolvedValue(undefined),
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("Save Photo", () => {
  it.each(["iPhone", "iPad", "MacIntel"])(
    "shares a prepared file on %s without claiming it was saved",
    async (platform) => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      await render();
      expect(button().textContent).toContain("Save Photo");
      expect(mocks.prepareExport).toHaveBeenCalledWith(
        studio.assets,
        studio.composition,
        "jpeg",
      );
      expect(canShare).toHaveBeenCalledWith({ files: [jpeg] });
      await click();
      expect(share).toHaveBeenCalledWith({ files: [jpeg] });
      expect(host.textContent).toContain("Share sheet closed");
      expect(studio.exportFile).not.toHaveBeenCalled();
      expect(mocks.download).not.toHaveBeenCalled();
    },
  );

  it.each(["Win32", "Linux armv8l"])(
    "keeps normal downloads on %s even with sharing APIs",
    async (platform) => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      await render();
      await click();
      expect(studio.exportFile).toHaveBeenCalledOnce();
      expect(mocks.prepareExport).not.toHaveBeenCalled();
      expect(share).not.toHaveBeenCalled();
    },
  );

  it("downloads when Apple file sharing is unavailable", async () => {
    Reflect.deleteProperty(navigator, "canShare");
    await render();
    await click();
    expect(studio.exportFile).toHaveBeenCalledOnce();
    expect(mocks.prepareExport).not.toHaveBeenCalled();
  });

  it("downloads an unsupported format without changing its bytes or extension", async () => {
    const svg = new File(["<svg/>"], "my-polaroid.svg", {
      type: "image/svg+xml",
    });
    studio.format = "svg";
    mocks.prepareExport.mockResolvedValue(svg);
    canShare.mockReturnValue(false);
    await render();
    await click();
    expect(mocks.download).toHaveBeenCalledWith(svg, svg.name);
    expect(share).not.toHaveBeenCalled();
  });

  it("allows cancel and retry without downloading", async () => {
    share.mockRejectedValueOnce(new DOMException("Canceled", "AbortError"));
    await render();
    await click();
    expect(host.textContent).toContain("Sharing canceled");
    expect(mocks.download).not.toHaveBeenCalled();
    await click();
    expect(share).toHaveBeenCalledTimes(2);
  });

  it("offers an explicit download retry after sharing fails", async () => {
    share.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await render();
    await click();
    expect(host.textContent).toContain(
      "Tap Save Photo to download the file instead",
    );
    expect(mocks.download).not.toHaveBeenCalled();
    await click();
    expect(mocks.download).toHaveBeenCalledWith(jpeg, jpeg.name);
    expect(share).toHaveBeenCalledOnce();
  });

  it("rejects stale preparation when format or artwork changes", async () => {
    let finishOld!: (file: File) => void;
    mocks.prepareExport.mockImplementationOnce(
      () =>
        new Promise<File>((resolve) => {
          finishOld = resolve;
        }),
    );
    await render();
    expect(button().disabled).toBe(true);
    await click();
    expect(share).not.toHaveBeenCalled();
    const png = new File(["new artwork"], "my-polaroid.png", {
      type: "image/png",
    });
    mocks.prepareExport.mockResolvedValueOnce(png);
    studio = {
      ...studio,
      format: "png",
      composition: { ...studio.composition, caption: "Updated" },
    };
    await render();
    await act(async () => finishOld(jpeg));
    await click();
    expect(share).toHaveBeenCalledWith({ files: [png] });
  });

  it("can retry a preparation failure through the original download error handling", async () => {
    mocks.prepareExport.mockRejectedValueOnce(new Error("Encoder failed"));
    await render();
    expect(button().disabled).toBe(false);
    expect(host.textContent).toContain("Could not prepare sharing");
    await click();
    expect(studio.exportFile).toHaveBeenCalledOnce();
  });

  it("prevents another share while the sheet is open", async () => {
    let close!: () => void;
    share.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          close = resolve;
        }),
    );
    await render();
    await click();
    expect(button().disabled).toBe(true);
    await click();
    expect(share).toHaveBeenCalledOnce();
    await act(async () => close());
    expect(button().disabled).toBe(false);
  });
});
