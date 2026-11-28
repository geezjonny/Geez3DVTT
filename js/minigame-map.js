// Walls, doors and levers for minigame2.html. The map is a grid: cells["x_y"] = { t: "wall" | "door" | "lever", open, on, door }.
export const MAPPED = typeof document !== "undefined" && !!document.getElementById("tool");
export const CELL = 32;
const HALF = 11, REACH = 44;
const keyAt = (x, y) => `${Math.floor(x / CELL)}_${Math.floor(y / CELL)}`;
export const centerOf = (key) => { const [x, y] = key.split("_").map(Number); return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL }; };
const solid = (cell) => cell?.t === "wall" || (cell?.t === "door" && !cell.open);
export const cellAt = (cells, p) => cells[keyAt(p.x, p.y)];
export const solidAt = (cells, x, y) => solid(cells[keyAt(x, y)]);
const corners = (x, y) => [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]].map(([dx, dy]) => [x + dx, y + dy]);
export const blocked = (cells, x, y) => corners(x, y).some(([cx, cy]) => solidAt(cells, cx, cy));
const along = (a, b, hit) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6) || 1;
  for (let i = 0; i <= n; i++) if (hit(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
  return true;
};
export const sight = (cells, a, b) => along(a, b, (x, y) => solidAt(cells, x, y));
export const clearWalk = (cells, a, b) => along(a, b, (x, y) => blocked(cells, x, y));

// The next square on the shortest way from `from` to `to`, or null if walls or shut doors cut it off.
export function nextStep(map, from, to) {
  const goal = keyAt(from.x, from.y), start = keyAt(to.x, to.y);
  if (goal === start) return to;
  const seen = new Set([start]), queue = [start];
  for (const key of queue) {
    const [x, y] = key.split("_").map(Number);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const next = `${nx}_${ny}`;
      if (next === goal) return centerOf(key);
      if (seen.has(next) || nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows || solid(map.cells[next])) continue;
      seen.add(next); queue.push(next);
    }
  }
  return null;
}

// Heroes start on empty squares at the left edge, enemies at the right.
export function freeSpot(map, foe, i) {
  const { cols = 20, rows = 12, cells = {} } = map, free = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const key = `${foe ? cols - 1 - c : c}_${r}`; if (!cells[key]) free.push(key); }
  return centerOf(free[(i * 2 + 1) % free.length] || "0_0");
}

export const nearLever = (cells, p) => p && Object.keys(cells).find((k) => cells[k].t === "lever" && Math.hypot(centerOf(k).x - p.x, centerOf(k).y - p.y) <= REACH);
const standingIn = (key, list) => list.some((p) => p && corners(p.x, p.y).some(([x, y]) => keyAt(x, y) === key));

// The database changes for a hero at `at` flipping a lever. A door will not shut on someone.
export function flip(NS, cells, key, at, occupants) {
  const lever = cells[key], door = cells[lever?.door], spot = lever && centerOf(key);
  if (lever?.t !== "lever" || door?.t !== "door" || Math.hypot(spot.x - at.x, spot.y - at.y) > REACH + 16) return {};   // slack for lag
  if (door.open && standingIn(lever.door, occupants)) return {};
  return { [`${NS}/map/cells/${key}/on`]: lever.on ? null : true, [`${NS}/map/cells/${lever.door}/open`]: door.open ? null : true };
}

// the squares around the edge of the rectangle between two corners
export function outline([ax, ay], [bx, by]) {
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by), keys = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x === x0 || x === x1 || y === y0 || y === y1) keys.push(`${x}_${y}`);
  return keys;
}
let ghost = null;   // the room being dragged out, as two corner squares

export function drawMap(ctx, cells, gm, starts) {
  const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  if (gm) for (const key of Object.values(starts || {})) { const { x, y } = centerOf(key); box(x - 14, y - 14, 28, 28, "#4aa3ff44"); }
  if (gm && ghost) for (const key of outline(...ghost)) { const { x, y } = centerOf(key); box(x - 16, y - 16, 32, 32, "#ffffff55"); }
  for (const [key, cell] of Object.entries(cells)) {
    const { x: cx, y: cy } = centerOf(key), x = cx - 16, y = cy - 16;
    if (cell.t === "wall") { box(x, y, 32, 32, "#6d6a75"); for (const j of [0, 11, 22]) { box(x, y + j + 9, 32, 2, "#3d3a45"); box(x + (j % 22 ? 8 : 22), y + j, 2, 9, "#3d3a45"); } }
    if (cell.t === "door") {
      if (cell.open) { box(x, y, 5, 32, "#7a4a22"); box(x + 27, y, 5, 32, "#7a4a22"); }
      else { box(x, y, 32, 32, "#7a4a22"); for (const i of [8, 16, 24]) box(x + i, y, 2, 32, "#4a2a10"); box(x + 23, y + 15, 5, 5, "#f2c94c"); }
    }
    if (cell.t === "exit") { box(x, y, 32, 32, "#1f7a3a"); box(x + 3, y + 3, 26, 26, "#35b35a"); ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText("EXIT", cx, cy + 4); }
    if (cell.t === "lever") {
      box(x + 6, y + 20, 20, 8, "#55525e"); for (let i = 0; i < 6; i++) box(cx - 2 + (cell.on ? i : -i) * 2, cy + 4 - i * 3, 4, 4, "#c9ced6");
      box(cx + (cell.on ? 9 : -15), cy - 17, 7, 7, cell.on ? "#5be36a" : "#ff5050");
      if (gm && cells[cell.door]) { const d = centerOf(cell.door); ctx.strokeStyle = "#ffe27a88"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
}

// GM: drag out rooms, drag to paint exits or erase, click for doors (in a wall) and zombies. A lever or a guard takes a second click.
export function initEditor({ NS, canvas, map, patch, reset, occupants }) {
  const $ = (id) => document.getElementById(id), say = (text) => { $("hint").textContent = text; };
  let pending = null, painting = false, last = "";
  const path = (key) => `${NS}/map/cells/${key}`;
  const leversOf = (key) => Object.entries(map().cells || {}).filter(([, c]) => c.t === "lever" && c.door === key);
  const squareAt = (e) => {   // clamped, so a drag may end outside the map
    const r = canvas.getBoundingClientRect(), pick = (at, size, count) => Math.max(0, Math.min(count - 1, Math.floor(at / size * count)));
    return [pick(e.clientX - r.left - canvas.clientLeft, canvas.clientWidth, map().cols), pick(e.clientY - r.top - canvas.clientTop, canvas.clientHeight, map().rows)];
  };
  function room([a, b]) {
    if (Math.abs(a[0] - b[0]) < 1 || Math.abs(a[1] - b[1]) < 1) return say("Drag from one corner to the opposite corner.");
    const keys = outline(a, b), marked = [...Object.values(map().starts || {}), ...Object.values(map().spawns || {}).flatMap((sp) => [sp.a, sp.b])];
    if (keys.some((key) => marked.includes(key) || standingIn(key, occupants()))) return say("Someone is standing or starts on that edge.");
    patch(Object.fromEntries(keys.filter((key) => !map().cells[key]).map((key) => [path(key), { t: "wall" }]))); say("");   // doors, levers and exits stay
  }
  function use(e) {
    const tool = $("tool").value, x = Math.floor(e.offsetX / canvas.clientWidth * map().cols), y = Math.floor(e.offsetY / canvas.clientHeight * map().rows);
    if (!tool || x < 0 || y < 0 || x >= map().cols || y >= map().rows) return;
    const key = `${x}_${y}`, cell = map().cells[key], spawns = Object.entries(map().spawns || {});
    const spawn = (value) => patch({ [`${NS}/map/spawns/${value.kind}_${Date.now()}`]: value });
    const starts = Object.entries(map().starts || {}).filter(([, at]) => at === key);
    if (tool.startsWith("start:")) {
      const id = tool.slice(6), p = { ...centerOf(key), face: 1 };
      if (cell || standingIn(key, occupants.foes())) return say("Pick an empty square.");
      patch({ [`${NS}/map/starts/${id}`]: key, [`${NS}/pos/${id}`]: p, [`${NS}/heroes/${id}/out`]: false, [`${NS}/respawn`]: { n: Date.now(), at: { [id]: p } } });
      return say("Placed. They start here after every reset.");
    }
    if (pending?.kind === "lever") {
      if (cell?.t !== "door") return say("Now click the door this lever controls.");
      patch({ [path(pending.key)]: { t: "lever", door: key } }); pending = null; return say("Lever wired to that door.");
    }
    if (pending) {
      if (cell) return say("Click an empty square for the guard to walk to.");
      spawn({ kind: "guard", a: pending.key, b: key }); pending = null; return say("Guard placed. Click to place another.");
    }
    if (tool === "lever" || tool === "guard" || tool === "zombie") {
      if (cell) return say("Pick an empty square.");
      if (tool === "zombie") { spawn({ kind: "zombie", a: key }); return say("Zombie placed."); }
      pending = { kind: tool, key }; painting = false;
      if (tool === "lever") patch({ [path(key)]: { t: "lever" } });
      return say(tool === "lever" ? "Now click the door this lever controls." : "Now click where this guard walks to.");
    }
    // erase also removes a guard or zombie that starts, or is standing, on the square
    const here = spawns.filter(([id, sp]) => sp.a === key || standingIn(key, [occupants.foe(id)]));
    if (tool === "erase" && here.length) return patch(Object.fromEntries(here.map(([id]) => [`${NS}/map/spawns/${id}`, null])));
    if (tool === "door" && cell?.t !== "wall") return say("Click a wall square to put a door in it.");
    if (tool === "erase" && starts.length) patch(Object.fromEntries(starts.map(([id]) => [`${NS}/map/starts/${id}`, null])));
    if ((tool === "wall" || tool === "door") && (starts.length || here.length || standingIn(key, occupants()))) return say("Someone is standing there.");
    if (tool === cell?.t || (tool === "erase" && !cell)) return;
    const changes = { [path(key)]: tool === "erase" ? null : { t: tool } };
    if (cell?.t === "door") for (const [lever] of leversOf(key)) changes[path(lever)] = null;   // its levers go with it
    patch(changes); say("");
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    if ($("tool").value === "wall" && !pending) { ghost = [squareAt(e), squareAt(e)]; return; }
    painting = ["exit", "erase"].includes($("tool").value); last = ""; use(e);
  });
  addEventListener("pointermove", (e) => { if (ghost) ghost[1] = squareAt(e); });
  canvas.addEventListener("pointermove", (e) => { if (!painting || !(e.buttons & 1)) return; const at = `${e.offsetX >> 2}_${e.offsetY >> 2}`; if (at !== last) { last = at; use(e); } });
  addEventListener("pointerup", (e) => { painting = false; if (ghost) { ghost[1] = squareAt(e); room(ghost); ghost = null; } });
  addEventListener("pointercancel", () => { painting = false; ghost = null; });
  $("tool").addEventListener("change", () => {
    if (pending?.kind === "lever") patch({ [path(pending.key)]: null });
    pending = null; say({ wall: "Drag a rectangle to draw a room.", door: "Click a wall square.", lever: "Click an empty square to place a lever.", guard: "Click where the guard starts.", zombie: "Click an empty square to place a zombie." }[$("tool").value] || ""); $("tool").blur();
  });
  $("resize").addEventListener("click", () => {
    const size = (id, min, max) => { const v = Math.max(min, Math.min(max, Math.round(+$(id).value) || min)); $(id).value = v; return v; };
    patch({ [`${NS}/map/cols`]: size("cols", 10, 48), [`${NS}/map/rows`]: size("rows", 8, 32) }); reset();
    say("Map resized; the fight was reset.");
  });
  // show the saved size once the map has loaded
  const fill = setInterval(() => { if (map().cols) { $("cols").value = map().cols; $("rows").value = map().rows; clearInterval(fill); } }, 200);
}
