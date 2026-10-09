// A crowd of SVG characters is the most expensive thing on a busy floor: each one is about a
// hundred SVG nodes with gradients and clip paths, and moving it repaints all of them. In crowd mode
// other people are drawn as a picture of themselves instead: the SVG is rendered once per look,
// facing and pose, turned into an image, and from then on the browser only moves a bitmap.
import { createContext, useContext } from "react";
import { flushSync } from "react-dom";
import { type Root, createRoot } from "react-dom/client";
import { type Look, Person } from "./Person";

/** True while the scene is in crowd mode. */
export const CrowdMode = createContext(false);

/** Room around the 44×62 sprite for hats, hair and arms that reach past it. */
const PAD = { x: 12, top: 16, bottom: 12 };
/** Rules from rpg.css the picture needs, since a page's CSS does not reach inside an image. */
const VIEW_CSS: Record<string, string> = {
  down: ".pg-v-back,.pg-v-side{display:none}",
  up: ".pg-v-front,.pg-v-side{display:none}",
  side: ".pg-v-front,.pg-v-back{display:none}",
};
const SEATED_CSS = ".pg-leg-a,.pg-leg-b{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(.45)}";

const urls = new Map<string, string>();
const queue = new Map<string, { look: Look; dir: string; seated: boolean }>();
let root: Root | null = null;
let host: HTMLDivElement | null = null;
let scheduled = false;

/** The picture of a look, or undefined until it has been made (it is queued on the first ask). */
function flatUrl(look: Look, dir: string, seated: boolean) {
  const key = `${dir}|${seated ? 1 : 0}|${JSON.stringify(look)}`;
  const url = urls.get(key);
  if (url || typeof document === "undefined") return url;
  queue.set(key, { look, dir, seated });
  if (!scheduled) {
    scheduled = true;
    setTimeout(drain, 0);
  }
  return undefined;
}

/** Make a few pictures at a time, outside React's render, so a new crowd never stalls a frame. */
function drain() {
  scheduled = false;
  host ??= document.createElement("div");
  root ??= createRoot(host);
  let n = 0;
  for (const [key, { look, dir, seated }] of queue) {
    if (n++ >= 12) break;
    queue.delete(key);
    flushSync(() => root!.render(<Person look={look} />));
    const svg = host.querySelector("svg")?.cloneNode(true) as SVGSVGElement | undefined;
    if (!svg) continue;
    svg.setAttribute("viewBox", `${-PAD.x} ${-PAD.top} ${44 + 2 * PAD.x} ${62 + PAD.top + PAD.bottom}`);
    svg.setAttribute("width", String(44 + 2 * PAD.x));
    svg.setAttribute("height", String(62 + PAD.top + PAD.bottom));
    svg.removeAttribute("class");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = VIEW_CSS[dir]! + (seated ? SEATED_CSS : "");
    svg.prepend(style);
    const text = new XMLSerializer().serializeToString(svg);
    urls.set(key, URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })));
  }
  if (queue.size && !scheduled) {
    scheduled = true;
    setTimeout(drain, 0);
  }
}

/** A character: the full SVG normally, a cached picture of it for other people in crowd mode. */
export function Figure({ look, dir, seated = false, flat }: { look: Look; dir: string; seated?: boolean; flat: boolean }) {
  const crowd = useContext(CrowdMode);
  const src = crowd && flat ? flatUrl(look, dir, seated) : undefined;
  if (!src) return <Person look={look} />;
  return (
    <img
      className="pg-body pg-flat"
      src={src}
      alt=""
      draggable={false}
      width={44 + 2 * PAD.x}
      height={62 + PAD.top + PAD.bottom}
      style={{ margin: `${-PAD.top}px ${-PAD.x}px ${-PAD.bottom}px` }}
    />
  );
}
