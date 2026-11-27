// Universal VTT (.dd2vtt) import/export. The parser is deliberately independent
// of the browser, Firebase, and the rest of the VTT so it can be tested in Node.

import { doorSeg } from "./door-segment.js";
import { MAX_CELLS } from "./bounds.js";

const CELL = 40;
const MAX_WALLS = 3000;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const point = (p, origin) => finite(p?.x) && finite(p?.y) ? {
  x: Math.round((p.x - origin.x) * CELL), y: Math.round((p.y - origin.y) * CELL),
} : null;

function colorOf(value) {
  const s = typeof value === "string" ? value.replace(/^#/, "") : "";
  return /^[\da-f]{6}$|^[\da-f]{8}$/i.test(s) ? `#${s.slice(-6).toLowerCase()}` : "#ffffff";   // dd2vtt colours are AARRGGBB
}

function addSegment(out, a, b) {
  if (!a || !b || (a.x === b.x && a.y === b.y)) return;
  out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
}

function collinearTouch(a, b) {
  const cross = (b.x1 - a.x1) * (b.y2 - a.y1) - (b.y1 - a.y1) * (b.x2 - a.x1);
  const cross2 = (b.x1 - a.x1) * (a.y2 - a.y1) - (b.y1 - a.y1) * (a.x2 - a.x1);
  if (cross !== 0 || cross2 !== 0) return false;
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const a0 = Math.min(a[axis + "1"], a[axis + "2"]), a1 = Math.max(a[axis + "1"], a[axis + "2"]);
  const b0 = Math.min(b[axis + "1"], b[axis + "2"]), b1 = Math.max(b[axis + "1"], b[axis + "2"]);
  return b0 <= a1 && a0 <= b1;
}

function mergeWalls(walls) {
  const out = walls.slice();
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (!collinearTouch(a, b)) continue;
      const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
      const useX = Math.abs(dx) >= Math.abs(dy);
      const key = useX ? "x" : "y";
      const pts = [[a.x1, a.y1], [a.x2, a.y2], [b.x1, b.y1], [b.x2, b.y2]];
      pts.sort((p, q) => p[useX ? 0 : 1] - q[useX ? 0 : 1]);
      out[i] = { x1: pts[0][0], y1: pts[0][1], x2: pts[3][0], y2: pts[3][1] };
      out.splice(j, 1); changed = true; break outer;
    }
  }
  return out;
}

function portalDoor(portal, origin, cols, rows) {
  const pos = point(portal?.position, origin);
  const bounds = Array.isArray(portal?.bounds) ? portal.bounds.map((p) => point(p, origin)) : [];
  if (!pos || bounds.length !== 2 || !bounds[0] || !bounds[1]) return null;
  const dx = bounds[1].x - bounds[0].x, dy = bounds[1].y - bounds[0].y;
  if (dx === 0 && dy === 0) return null;
  if (pos.x < 0 || pos.y < 0 || pos.x > cols * CELL || pos.y > rows * CELL) return null;
  // The exact segment is kept, so doors line up with the gaps the map left in its walls.
  // Dungeondraft and Dungeon Alchemist export windows as open portals and doors as closed ones.
  return { x: pos.x, y: pos.y, dir: Math.abs(dx) >= Math.abs(dy) ? "h" : "v", state: "closed", seg: [bounds[0].x, bounds[0].y, bounds[1].x, bounds[1].y], ...(portal.closed === false ? { win: true } : {}) };
}

// dd2vtt files carry bare base64 with no mime; Dungeondraft/DungeonAlchemist often use WebP or JPEG.
const sniffMime = (b) => b.startsWith("UklGR") ? "image/webp" : b.startsWith("/9j/") ? "image/jpeg" : b.startsWith("R0lG") ? "image/gif" : "image/png";

export function parseDD2VTT(json) {
  if (!json || typeof json !== "object") throw new Error("Invalid DD2VTT JSON.");
  const resolution = json.resolution;
  if (!resolution?.map_size || !finite(resolution.map_size.x) || !finite(resolution.map_size.y)) {
    throw new Error("DD2VTT file is missing resolution.map_size.");
  }
  const origin = { x: finite(resolution.map_origin?.x) ? resolution.map_origin.x : 0, y: finite(resolution.map_origin?.y) ? resolution.map_origin.y : 0 };
  const cols = Math.max(1, Math.round(resolution.map_size.x));
  const rows = Math.max(1, Math.round(resolution.map_size.y));
  const rawWalls = [];
  for (const field of ["line_of_sight", "objects_line_of_sight"]) {
    for (const line of Array.isArray(json[field]) ? json[field] : []) {
      if (!Array.isArray(line)) continue;
      for (let i = 1; i < line.length; i++) addSegment(rawWalls, point(line[i - 1], origin), point(line[i], origin));
    }
  }
  const walls = mergeWalls(rawWalls).slice(0, MAX_WALLS);
  const doors = (Array.isArray(json.portals) ? json.portals : []).map((p) => portalDoor(p, origin, cols, rows)).filter(Boolean);
  const lights = [];
  for (const light of Array.isArray(json.lights) ? json.lights : []) {
    const p = point(light?.position, origin), range = Number(light?.range);
    if (!p || !Number.isFinite(range) || range < 1) continue;
    lights.push({ x: p.x, y: p.y, radius: range * CELL, color: colorOf(light.color), ...(Number.isFinite(Number(light.intensity)) ? { intensity: Number(light.intensity) } : {}) });
  }
  let imageDataUrl = null;
  if (typeof json.image === "string" && json.image) {
    imageDataUrl = json.image.startsWith("data:") ? json.image : `data:${json.geezvtt?.imageMime || sniffMime(json.image)};base64,${json.image}`;
  }
  const tag = (o) => Object.defineProperty(o, "lv", { value: 0, enumerable: false, writable: true });
  return { cols, rows, walls: walls.map(w => tag({ ...w })), doors: doors.map(d => tag({ ...d })), lights: lights.map(l => tag({ ...l })), floors: [], roofs: [], props: [], labels: [], imageDataUrl, ppg: finite(resolution.pixels_per_grid) ? resolution.pixels_per_grid : 70 };
}

const id = (prefix, n) => `${prefix}${Date.now().toString(36)}${n.toString(36)}`;
export const toast = (message) => {
  const el = document.querySelector("#toast"); if (!el) return;
  el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
};

export async function importDD2VTT(file, mode = "merge") { return applyDD2VTT(parseDD2VTT(JSON.parse(await file.text())), mode); }

// GeezSheets stores maps in Firebase /maps/<name>/geometry as { walls, doors, lights } in grid units (no picture).
// Convert that to the same shape a .dd2vtt file has, so it goes through the same parser.
export function geezGeometryToDD2VTT(g) {
  const pts = [...(g.walls || []), ...(g.doors || [])].flatMap((w) => [[w.x1, w.y1], [w.x2, w.y2]]).concat((g.lights || []).map((l) => [l.x, l.y])).filter(([x, y]) => finite(x) && finite(y));
  if (!pts.length) throw new Error("That map has no geometry.");
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - 1, y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - 1;
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0]))) + 1, y1 = Math.ceil(Math.max(...pts.map((p) => p[1]))) + 1;
  const hex = (c) => { const t = String(c || "").replace(/^#/, ""); return t.length === 8 ? t.slice(2) : t; };   // Geez colours are AARRGGBB
  return {
    resolution: { map_origin: { x: x0, y: y0 }, map_size: { x: x1 - x0, y: y1 - y0 }, pixels_per_grid: 70 },
    line_of_sight: (g.walls || []).map((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
    portals: (g.doors || []).map((d) => ({ position: { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 }, bounds: [{ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }], rotation: 0, closed: d.closed !== false })),
    lights: (g.lights || []).map((l) => ({ position: { x: l.x, y: l.y }, range: Math.max(2, Number(l.range) || 2), color: hex(l.color) })),
  };
}
export async function importGeezMap(name, mode = "merge") {
  const { readAt } = await import("../store.js");
  const m = await readAt(`maps/${name}`);   // read-only: nothing is written to the live GeezSheets data
  if (!m?.geometry) throw new Error(`No geometry at maps/${name}`);
  return applyDD2VTT(parseDD2VTT(geezGeometryToDD2VTT(m.geometry)), mode);
}
export async function listGeezMaps() { const { readAt } = await import("../store.js"); return Object.keys((await readAt("maps")) || {}); }

// mode: "merge" adds the walls, doors and lights to the current scene; "new" starts a fresh scene
// (the current one is saved first as "Before import ...", so nothing is lost). Only walls, doors and lights are imported.
export async function applyDD2VTT(data, mode = "merge") {
  const [{ S, mapSize }, { newObject }, store] = await Promise.all([
    import("./state.js"), import("../puzzle/objects.js"), import("../store.js"),
  ]);
  const cur = mapSize(), changes = {}, L = mode === "floor" ? (S.level ?? S.map.level ?? 0) : null, onFloor = L == null ? {} : { lv: L };   // "floor": everything lands on the floor you are viewing
  if (mode === "new") {
    const [map, objects, tokens, groups, mapimg] = await Promise.all(["map", "objects", "tokens", "groups", "mapimg"].map((p) => store.read(p)));
    if (Object.keys(map?.walls || {}).length || Object.keys(map?.floors || {}).length || Object.keys(objects || {}).length) {
      const stamp = new Date().toLocaleString(), key = `before-import-${Date.now().toString(36)}`;
      await store.put(`scenes/${key}`, { name: `Before import ${stamp}`, ts: Date.now(), data: { map: map || {}, objects: objects || {}, tokens: tokens || {}, groups: groups || {}, mapimg: mapimg || null } });
    }
    await Promise.all([store.put("map", null), store.put("objects", null), store.put("tokens", null), store.put("groups", null)]);
    changes["map/size"] = { cols: Math.max(10, Math.min(MAX_CELLS, data.cols)), rows: Math.max(10, Math.min(MAX_CELLS, data.rows)), x: data.x || 0, y: data.y || 0 };
  } else {
    const x = Math.min(cur.x, data.x || 0), y = Math.min(cur.y, data.y || 0);
    changes["map/size"] = { x, y, cols: Math.max(cur.x + cur.cols, (data.x || 0) + Math.min(MAX_CELLS, data.cols)) - x, rows: Math.max(cur.y + cur.rows, (data.y || 0) + Math.min(MAX_CELLS, data.rows)) - y };
  }
  let n = 0;
  for (const f of data.floors || []) changes[`map/floors/${id("f", n++)}`] = { lv: 0, ...f, ...onFloor };
  for (const w of data.walls) changes[`map/walls/${id("w", n++)}`] = { lv: 0, ...w, ...onFloor };
  for (const r of data.roofs || []) changes[`map/roofs/${id("r", n++)}`] = { lv: 0, ...r, ...onFloor };
  for (const p of data.props || []) changes[`map/props/${id("p", n++)}`] = { lv: 0, ...p, ...onFloor };
  for (const l of data.labels || []) changes[`map/labels/${id("l", n++)}`] = { lv: 0, ...l, ...onFloor };
  for (const d of data.doors) if (!data.objects?.[d.id]) changes[`objects/${d.id || id("d", n++)}`] = { ...newObject("door", d.x, d.y, n, { dir: d.dir, ...(d.len ? { len: d.len } : {}), state: d.state, mat: d.mat, doorKind: d.kind || (d.win ? "window" : "wood"), ...(d.win ? { win: true } : {}), ...(d.seg ? { seg: d.seg } : {}) }), lv: L ?? d.lv ?? 0 };
  for (const l of data.lights) if (!data.objects?.[l.id]) changes[`objects/${l.id || id("l", n++)}`] = { ...newObject("light", l.x, l.y, n, { radius: l.radius, color: l.color, fog: 0, state: "on", ...(l.intensity != null ? { intensity: l.intensity } : {}) }), lv: L ?? l.lv ?? 0 };
  for (const [oid, o] of Object.entries(data.objects || {})) changes[`objects/${oid}`] = o;
  for (const [gid, g] of Object.entries(data.groups || {})) changes[`groups/${gid}`] = g;
  for (const [fid, f] of Object.entries(data.fog || {})) changes[`map/fog/${id("g", n++)}`] = { open: false, ...f };
  if (data.floorNames) changes["map/levelNames"] = data.floorNames;
  if (data.floorKeys?.length) changes["map/level"] = Number(data.floorKeys[0]) || 0;
  if (data.light) { changes["map/light"] = data.light; if (data.light === "dark") for (let y = 0; y < data.rows; y++) changes[`map/fog/${id("g", n++)}`] = { x: (data.x || 0) * 40, y: ((data.y || 0) + y) * 40, w: data.cols * 40, h: 40, open: false, lv: L ?? 0 }; }
  changes.seeded = true;
  await store.patch(JSON.parse(JSON.stringify(changes))); // Firebase rejects undefined values (e.g. door mat)
  if (data.atmosphere?.time != null) await store.put("atmosphere", { time: data.atmosphere.time, weather: data.atmosphere.weather, color: "#4d86b8" });
  return data;
}

// Ask where an import should go. Resolves "merge", "new" or null (cancelled).
export async function askMode(label, hasImage = false, allowFloor = false) {
  const { floatWindow } = await import("./ui.js");
  return new Promise((resolve) => {
    const w = floatWindow({ id: "import-mode", title: "Import map", x: 300, y: 170 });
    const done = (v) => { resolve(v); w.hide(); w.el.remove(); };
    w.body.innerHTML = `<div class="import-mode"><b></b><span>Imports the map and all supported floors.</span><label><input type="checkbox" data-atmo checked> Also set time, weather and light</label>${hasImage ? `<label><input type="checkbox" data-ref checked> Show the picture as a reference (not saved)</label>` : ""}<button type="button" data-m="merge">Add to current scene</button>${allowFloor ? `<button type="button" data-m="floor">Add to current scene, this floor only</button>` : ""}<button type="button" data-m="new">New scene (current one is saved first)</button><button type="button" data-m="">Cancel</button></div>`;
    w.body.querySelector("b").textContent = label;
    const st = document.createElement("style"); st.textContent = ".import-mode{display:grid;gap:.4rem;max-width:18rem}.import-mode span{font-size:.8rem;opacity:.8}"; w.body.append(st);
    w.body.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { askMode.lastAtmo = !!w.body.querySelector("[data-atmo]")?.checked; askMode.showReference = !!w.body.querySelector("[data-ref]")?.checked; done(b.dataset.m || null); } });
    w.el.querySelector(".fwin-x")?.addEventListener("click", () => resolve(null));
  });
}
async function importWithChoice(label, load, src = null) {
  try {
    const data = await load(), mode = await askMode(label, false, true); if (!mode) return;
    const { saveMapImage } = await import("./mapimg.js"), store = await import("../store.js");
    await applyDD2VTT(data, mode);
    if (data.imageDataUrl) await saveMapImage(data, src, { replaceAll: mode === "new" }); else if (mode === "new") await store.put("mapimg", null);
    toast(`Imported ${label} (${mode === "new" ? "new scene" : mode === "floor" ? "this floor" : "added to scene"})`);
  } catch (e) { toast(e.message); }
}
async function importGeezChoice(file, button) {
  const { parseGeezMap, applyGeezMap } = await import("./geezmap.js");
  try {
    const data = parseGeezMap(JSON.parse(await file.text())), mode = await askMode(file.name, !!data.imageDataUrl); if (!mode) return; if (!askMode.lastAtmo) data.atmosphere = null; const { setRefImage, clearRefImage } = await import("./refimage.js"); await applyGeezMap(data, mode); if (mode === "new") clearRefImage(); if (data.imageDataUrl && askMode.showReference) setRefImage(data.imageDataUrl, data);
    const skipped = Object.entries(data.skipped).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ") || "none";
    toast(`Imported ${data.name}: ${data.counts?.objects ?? data.doors.length + data.lights.length} objects, ${data.counts?.rules || 0} rules, ${data.counts?.fog || 0} fog cells; skipped ${skipped}`);
  } catch (e) { toast(e.message); }
}
// GeezSheets places that have a battle map file (Gaia places with data.dd2vtt) -> [{ name, file }]
export async function listGeezPlaces() {
  const { readAt } = await import("../store.js");
  const all = (await readAt("v2/worlds/gaia/entities")) || {};
  return Object.values(all).filter((e) => e?.kind === "place" && e.data?.dd2vtt).map((e) => ({ name: e.name || e.id, file: e.data.dd2vtt })).sort((a, b) => a.name.localeCompare(b.name));
}
export const geezMapUrl = (file) => `https://geezjonny.github.io/GeezSheets/battlemap/${encodeURIComponent(file)}`;

export async function exportDD2VTT() {
  const [{ S }, { mapSize }] = await Promise.all([import("./state.js"), import("./state.js")]);
  const { cols, rows } = mapSize();
  const walls = Object.values(S.map.walls || {}).map((w) => [{ x: w.x1 / CELL, y: w.y1 / CELL }, { x: w.x2 / CELL, y: w.y2 / CELL }]);
  const doors = Object.values(S.objects || {}).filter((o) => o?.kind === "door").map((d) => {
    const [x1, y1, x2, y2] = doorSeg(d).map((v) => v / CELL);
    return { position: { x: d.x / CELL, y: d.y / CELL }, bounds: [{ x: x1, y: y1 }, { x: x2, y: y2 }], rotation: 0, closed: d.state !== "open" };
  });
  const lights = Object.values(S.objects || {}).filter((o) => o?.kind === "light").map((l) => ({ position: { x: l.x / CELL, y: l.y / CELL }, range: (l.radius || 0) / CELL, color: `${String(l.color || "#ffffff").replace(/^#/, "")}ff`, ...(l.intensity != null ? { intensity: l.intensity } : {}) }));
  return new Blob([JSON.stringify({ format: 0.3, resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: cols, y: rows }, pixels_per_grid: 70 }, line_of_sight: walls, objects_line_of_sight: [], portals: doors, lights, image: "" })], { type: "application/json" });
}

// The Scene Controls' map buttons (scenes.js).
const pickFile = (accept, use) => { const input = Object.assign(document.createElement("input"), { type: "file", accept }); input.addEventListener("change", () => { const f = input.files[0]; if (f) use(f); }); input.click(); };
export async function loadLibraryMap(button) {
  const { libraryMaps } = await import("./mapimg.js"), { dropMenu } = await import("./ui.js"), list = await libraryMaps();
  dropMenu(button, list.length ? list.map((m) => [`${m.name} (${(m.bytes / 1048576).toFixed(1)} MB)`, () => importWithChoice(m.name, async () => parseDD2VTT(await (await fetch(geezMapUrl(m.file))).json()), "battlemap/" + m.file)]) : [["No battlemap/index.json", null]]);
}
// Our own saves (.geezmap, .geezscene) load exactly, from either Import button; anything else goes to its importer.
const ours = (accept, otherwise) => pickFile(accept, async (f) => {
  try { const { restoreFile } = await import("./scenes.js"); if (!(await restoreFile(JSON.parse(await f.text())))) await otherwise(f); }
  catch (e) { toast(e.message); }
});
export const importMapFile = () => ours(".geezmap,.geezscene,.dd2vtt,.json,.uvtt", (f) => importWithChoice(f.name, async () => parseDD2VTT(JSON.parse(await f.text()))));
export const importSceneFile = (button) => ours(".geezscene,.geezmap,.json", (f) => importGeezChoice(f, button));
