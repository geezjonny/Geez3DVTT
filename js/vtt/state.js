// Shared mutable UI state and tiny helpers used by vtt.js, draw.js and panel.js.
export const $ = (s) => document.querySelector(s);
export const emptyDraft = () => ({ when: [], then: [], pool: [] });
export const S = {
  isGM: document.documentElement.dataset.role === "gm",   // gm.html is the GM page, index.html the player page
  objects: {}, tokens: {}, groups: {}, map: { floors: {}, walls: {}, roofs: {}, props: {}, labels: {}, fog: {}, holes: {}, level: 0, levelNames: {} }, level: 0, tool: null,
  exploredCells: new Set(), currentVisible: new Set(), exploredRedraw: null,
  puzzleMode: false, paused: false, sceneName: "Current scene", round: 1, turnName: "—", initiative: null, selected: new Set(), draft: emptyDraft(),
  atmosphere: { time: 12, weather: "clear", color: "#4d86b8" }, placing: null, pick: null, lastSel: null, dragging: null,
};
export const mapSize = () => ({ cols: S.map.size?.cols || 20, rows: S.map.size?.rows || 14, x: S.map.size?.x || 0, y: S.map.size?.y || 0 });   // grid size and top-left cell; default 20x14 at 0,0
export const cellOf = (p) => { const { cols, rows, x, y } = mapSize(), at = (v, from, n) => Math.max(from * 40 + 20, Math.min((from + n) * 40 - 20, Math.floor(v / 40) * 40 + 20)); return { x: at(p.x, x, cols), y: at(p.y, y, rows) }; };
export const cellName = (p) => `${(p.x - 20) / 40},${(p.y - 20) / 40}`;
export const label = (id) => S.objects[id]?.label || S.tokens[id]?.label || id;
