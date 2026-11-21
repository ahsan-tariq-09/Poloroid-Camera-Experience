// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import InstantPrint, { PHOTO_DEVELOPMENT_DELAY_MS, PHOTO_DEVELOPMENT_MS, PRINT_EJECTION_MS } from "./InstantPrint";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
async function setup(enabled:boolean,actions?:React.ReactNode){const host=document.createElement("div"),root=createRoot(host),reveal=vi.fn();document.body.append(host);
  const render=(next=actions)=>act(async()=>root.render(<InstantPrint photos={[{src:"photo.png",alt:"Captured moment"}]} caption="Today" enabled={enabled} onReveal={reveal} actions={next}/>));
  await render();return {host,reveal,render,close:async()=>{await act(async()=>root.unmount());host.remove();}};}

it("develops on its own: blank while printing, a 2.5s rest, then a 9s fade before the next action",async()=>{
  expect(PRINT_EJECTION_MS).toBe(2100);
  expect(PHOTO_DEVELOPMENT_DELAY_MS).toBe(2500);
  expect(PHOTO_DEVELOPMENT_MS).toBe(11500);
  vi.useFakeTimers();const s=await setup(true,<button>Save Photo</button>);
  try{
    // No reveal button, gesture hint or shake text: only the blank print.
    expect(s.host.querySelectorAll("button")).toHaveLength(0);
    expect(s.host.textContent).not.toMatch(/shake|Reveal/i);
    expect(s.host.querySelector("img")).toBeNull();expect(s.host.textContent).toContain("Printing…");
    await act(async()=>vi.advanceTimersByTime(PRINT_EJECTION_MS-1));
    expect(s.host.querySelector("img")).toBeNull();
    await act(async()=>vi.advanceTimersByTime(1));
    expect(s.host.querySelector("img")).not.toBeNull();expect(s.host.textContent).toContain("Developing…");
    await act(async()=>vi.advanceTimersByTime(PHOTO_DEVELOPMENT_MS+99));
    expect(s.reveal).not.toHaveBeenCalled();expect(s.host.querySelectorAll("button")).toHaveLength(0);
    await act(async()=>vi.advanceTimersByTime(1));
    expect(s.reveal).toHaveBeenCalledOnce();expect(s.host.textContent).toContain("Photo revealed");
    expect(document.activeElement?.textContent).toBe("Save Photo");
  }finally{await s.close();vi.useRealTimers();}
});

it("shows the photo at once with reduced motion and focuses Save once it finishes preparing",async()=>{
  const s=await setup(false,<button disabled>Preparing…</button>);
  try{
    expect(s.host.querySelector("img")).not.toBeNull();expect(s.reveal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(document.body);
    await s.render(<button>Save Photo</button>);
    expect(document.activeElement?.textContent).toBe("Save Photo");
    // Focus is handed over once; a later render never pulls it back.
    (document.activeElement as HTMLElement).blur();await s.render(<button>Save Photo</button>);
    expect(document.activeElement).toBe(document.body);
  }finally{await s.close();}
});
