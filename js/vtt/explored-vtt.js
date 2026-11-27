// Player-side persistence and GM controls for explored memory. Rules are never run here.
import { put as save, watch } from "../store.js";
import { addBarButton, dropMenu } from "./ui.js";
import { S, mapSize } from "./state.js";
import { cellsForHoles, decodeCells, encodeCells, mergeCells } from "./explored.js";

let key = null, floors = {}, dirtyFloors = new Set(), timer = 0;   // floors: { <level>: Set of cells }
const deviceKey = () => {
  try {
    let id = localStorage.getItem("vtt-device-id");
    if (!id) { id = `device-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`; localStorage.setItem("vtt-device-id", id); }
    return id;
  } catch { return "device-session"; }
};
const playerKey = () => { let me = null; try { me = JSON.parse(localStorage.getItem("vtt-me")); } catch { /* ignore */ } return me?.id || deviceKey(); };
const redraw = () => S.exploredRedraw?.();
const levelNow = () => S.level ?? S.map.level ?? 0;
function current() { const lv = levelNow(); S.exploredByLevel = floors; return (S.exploredCells = floors[lv] ||= new Set()); }
const flush = () => { timer = 0; if (key && S.map.exploredEnabled !== false) for (const lv of dirtyFloors) save(`explored/${key}/f${lv}`, encodeCells(floors[lv])); dirtyFloors.clear(); };
const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 700); };

export function initExplored() {
  S.currentVisible = new Set(); current();
  if (S.isGM) {
    const button = addBarButton({ quick: true, id: "explored", icon: "◌", label: "Explore", title: "Toggle explored memory", gmOnly: true, toggle: true, onClick: (e, b) => save("map/exploredEnabled", b.classList.contains("on")) });
    const reset = addBarButton({ quick: true, id: "explored-reset", icon: "↺", label: "Reset explored", title: "Reset explored memory for everyone or one character", gmOnly: true, onClick: (e, b) => dropMenu(b, [["Reset everyone", () => save("explored", null)], ...Object.entries(S.tokens).filter(([, t]) => t.pc).map(([, t]) => ["Reset: " + (t.label || t.pc), () => save(`explored/${t.pc}`, null)])]) });
    button.classList.toggle("on", S.map.exploredEnabled !== false);
    watch("map/exploredEnabled", (v) => { S.map.exploredEnabled = v !== false; button.classList.toggle("on", S.map.exploredEnabled); redraw(); });
    return;
  }
  const start = () => {
    key = playerKey(); floors = {}; dirtyFloors.clear(); current();
    watch(`explored/${key}`, (v) => {
      floors = Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).map(([k, runs]) => [k.slice(1), decodeCells(runs)]));
      current(); redraw();
    });
  };
  start();
  addEventListener("vtt-me-changed", start);
  document.addEventListener("levelchange", () => { current(); redraw(); });
}

export function visibilityFromHoles(holes) {
  // Hook: replace this adapter with vision.js polygon coverage when live sight is wired to it.
  return cellsForHoles(holes, mapSize().cols, mapSize().rows);
}

export function recordVisible(holes) {
  const visible = visibilityFromHoles(holes); S.currentVisible = visible;
  const cells = current();
  if (S.isGM || S.map.exploredEnabled === false) return;
  const next = mergeCells(cells, visible);
  if (next.size === cells.size) return;
  floors[levelNow()] = next; current(); dirtyFloors.add(levelNow()); schedule(); redraw();
}

export const isCurrentlyVisible = (x, y) => S.isGM || S.map.exploredEnabled === false || S.currentVisible?.has(`${Math.floor(x / 40)},${Math.floor(y / 40)}`);
