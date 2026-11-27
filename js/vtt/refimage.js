import { $, S, mapSize } from "./state.js";

const NS = "http://www.w3.org/2000/svg";
let dataUrl = null, shown = false, cols = 0, rows = 0, ppg = null, opacity = .45;

const layer = () => $("#refimage");
function render() {
  S.refresh3d?.();
  const g = layer(); if (!g) return;
  g.replaceChildren(); g.hidden = !shown || !dataUrl;
  if (!dataUrl || !shown) return;
  const image = document.createElementNS(NS, "image");
  image.setAttribute("href", dataUrl); image.setAttribute("x", 0); image.setAttribute("y", 0);
  image.setAttribute("width", (cols || mapSize().cols) * 40); image.setAttribute("height", (rows || mapSize().rows) * 40);
  image.setAttribute("preserveAspectRatio", "none"); image.setAttribute("opacity", opacity); image.setAttribute("pointer-events", "none");
  g.append(image);
}
export function setRefImage(url, size = {}) { dataUrl = typeof url === "string" && url ? url : null; cols = Number(size.cols) || 0; rows = Number(size.rows) || 0; ppg = Number(size.ppg) || null; shown = !!dataUrl; render(); }
export function clearRefImage() { dataUrl = null; shown = false; cols = rows = 0; ppg = null; render(); }
export function setRefOpacity(v) { opacity = Math.max(0, Math.min(1, Number(v) || 0)); render(); }
export function initRefImage() {
  if (!document.querySelector("#map")) return;
  window.addEventListener("resize", render); document.addEventListener("vttvisibilitychange", render);
}

export const getRefImage = () => (shown && dataUrl ? { dataUrl, cols: cols || mapSize().cols, rows: rows || mapSize().rows, opacity } : null);
