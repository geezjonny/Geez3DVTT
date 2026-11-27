// What a guard can see and hear, and how they walk (from GeezVTT's stealth page). Pure rules: map pixels, 40 to a square.
export const SIGHT = 6 * 40, TOUCH = 0.9 * 40;   // how far a guard looks; this close they notice you whatever way they face
export const DARK = 0.55;                        // in the dark a guard sees this fraction as far
export const FOV = 70;                           // width of the view cone, degrees
export const FACE = 90;                          // a new guard looks "down" the map (0 = right, 90 = down)
export const NOISE = { normal: 4 * 40, sneak: 0.7 * 40 };   // how far a guard hears footsteps (halved through walls)
export const WALK = 1.6 * 40, SNEAK_PACE = 0.35; // a guard's pace, px a second; a sneaking character's share of full speed

function rayHit(x, y, dx, dy, [x1, y1, x2, y2]) {   // distance along the ray to the segment, or Infinity
  const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const px = x1 - x, py = y1 - y, t = (px * ey - py * ex) / den, u = (px * dy - py * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}
const reach = (from, angle, segs, far) => segs.reduce((t, s) => Math.min(t, rayHit(from.x, from.y, Math.cos(angle), Math.sin(angle), s)), far);
const clear = (a, b, segs) => { const d = Math.hypot(b.x - a.x, b.y - a.y); return reach(a, Math.atan2(b.y - a.y, b.x - a.x), segs, d) >= d - 0.01; };
const level = (a, b) => (a.lv ?? 0) === (b.lv ?? 0);
const degrees = (from, to) => Math.round(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI);

export function canSee(guard, target, segs, range = SIGHT) {
  if (!level(guard, target)) return false;
  const dx = target.x - guard.x, dy = target.y - guard.y, d = Math.hypot(dx, dy);
  if (d > Math.max(range, TOUCH)) return false;
  const off = Math.atan2(dy, dx) - (guard.face ?? FACE) * Math.PI / 180;
  if (d > TOUCH && Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > FOV * Math.PI / 360) return false;
  return clear(guard, target, segs);
}

// The outline of the cone on the floor, cut off by walls: the guard first, then the far edge.
export function cone(guard, segs, rays = 32) {
  const face = (guard.face ?? FACE) * Math.PI / 180, half = FOV * Math.PI / 360;
  return [[guard.x, guard.y], ...Array.from({ length: rays + 1 }, (_, i) => {
    const a = face - half + 2 * half * i / rays, t = reach(guard, a, segs, SIGHT);
    return [guard.x + Math.cos(a) * t, guard.y + Math.sin(a) * t];
  })];
}

// Is a point within a light's radius, with nothing in between? lights: [{ x, y, lv, radius }]
export const litAt = (p, lights, segs) => lights.some((l) => level(l, p) && Math.hypot(p.x - l.x, p.y - l.y) <= l.radius && clear(l, p, segs));
export const canHear = (listener, source, range, segs) => level(listener, source) &&
  Math.hypot(source.x - listener.x, source.y - listener.y) <= range * (clear(listener, source, segs) ? 1 : 0.5);
// How far a character hears a walking guard: (Perception score - 8) squares, 2 more for one hurrying to investigate.
export const hearingRange = (score, rushing) => Math.max(0, score - 8 + (rushing ? 2 : 0)) * 40;

// Shortest walk between two points through cell centres: [[x, y], ...] ending at `to`, or null when there is no way.
// area is the map in cells: { x, y, cols, rows }.
export function findPath(from, to, segs, { x: left, y: top, cols, rows }) {
  const cell = (p) => { const c = Math.floor(p.x / 40) - left, r = Math.floor(p.y / 40) - top; return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : -1; };
  const start = cell(from), goal = cell(to);
  if (start < 0 || goal < 0) return null;
  const near = new Map();   // segments by the cells they pass, so each step only checks its neighbourhood
  for (const s of segs) for (let c = Math.floor((Math.min(s[0], s[2]) - 1) / 40); c <= Math.floor((Math.max(s[0], s[2]) + 1) / 40); c++)
    for (let r = Math.floor((Math.min(s[1], s[3]) - 1) / 40); r <= Math.floor((Math.max(s[1], s[3]) + 1) / 40); r++) { const k = `${c},${r}`; if (!near.has(k)) near.set(k, []); near.get(k).push(s); }
  const centre = (i) => ({ x: (i % cols + left) * 40 + 20, y: (Math.floor(i / cols) + top) * 40 + 20 });
  const open = (a, b) => { const p = centre(a), q = centre(b); return [a, b].every((i) => clear(p, q, near.get(`${i % cols + left},${Math.floor(i / cols) + top}`) || [])); };
  const prev = new Map([[start, start]]), queue = [start];
  for (let n = 0; n < queue.length && !prev.has(goal); n++) {
    const i = queue[n], c = i % cols, r = Math.floor(i / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (c + dc < 0 || r + dr < 0 || c + dc >= cols || r + dr >= rows) continue;
      const j = i + dc + dr * cols;
      if (prev.has(j) || !open(i, j)) continue;
      if (dc && dr && ![i + dc, i + dr * cols].every((k) => open(i, k) && open(k, j))) continue;   // no cutting corners
      prev.set(j, i); queue.push(j);
    }
  }
  if (!prev.has(goal)) return null;
  const path = [];
  for (let i = goal; i !== start; i = prev.get(i)) { const p = centre(i); path.unshift([p.x, p.y]); }
  if (path.length) path[path.length - 1] = [to.x, to.y]; else path.push([to.x, to.y]);
  return path;
}

// One guard for `dt` seconds. brain is its memory: { mode: "home"|"invest"|"look", ... }.
// world: { walls: what stops them, doors: shut doors they can open [{ id, seg }], area }.
// Returns { x, y, face, open } where open is a door id to open now.
export function advance(guard, brain, dt, world) {
  const g = { x: guard.x, y: guard.y, face: guard.face ?? FACE };
  brain.mode ||= "home"; brain.post ||= { x: g.x, y: g.y, face: g.face };
  const set = (mode, extra = {}) => Object.assign(brain, { mode, path: null, door: 0, time: 0, wait: 0 }, extra);
  const follow = (to, pace) => {   // "moving", "there" or "stuck"
    if (brain.wait > 0) { brain.wait -= dt; return "moving"; }
    if (!brain.path) brain.path = findPath(g, to, world.walls, world.area);
    if (!brain.path) { brain.wait = 1.5; return "stuck"; }   // no way there: do not search again every tick
    let left = pace * dt;
    while (brain.path.length && left > 0) {
      const [x, y] = brain.path[0], d = Math.hypot(x - g.x, y - g.y);
      if (d < 0.5) { brain.path.shift(); continue; }
      g.face = degrees(g, { x, y });
      const door = world.doors.find((o) => !clear(g, { x, y }, [o.seg]));
      if (door) { brain.door = (brain.door || 0) + dt; if (brain.door > 1.2) { brain.door = 0; g.open = door.id; } return "moving"; }
      const step = Math.min(left, d); g.x += (x - g.x) / d * step; g.y += (y - g.y) / d * step; left -= step;
    }
    if (brain.path.length > 1 || (brain.path.length && Math.hypot(brain.path[0][0] - g.x, brain.path[0][1] - g.y) >= 0.5)) return "moving";
    brain.path = null; return "there";
  };
  if (brain.mode === "look") {   // turn on the spot, then go back to the routine
    g.face = (g.face + 130 * dt) % 360; brain.time += dt;
    if (brain.time > 3) set("home");
  } else if (brain.mode === "invest") {
    if (follow(brain.target, WALK * 1.6) !== "moving") set("look");
  } else {
    const route = Object.values(guard.patrol || {});
    if (route.length > 1) {
      const i = (brain.point || 0) % route.length, result = follow({ x: route[i][0], y: route[i][1] }, WALK);
      if (result !== "moving") { brain.point = i + 1; brain.path = null; }
    } else {
      const post = route.length ? { x: route[0][0], y: route[0][1], face: brain.post.face } : brain.post;
      if (Math.hypot(post.x - g.x, post.y - g.y) > 4) { if (follow(post, WALK) === "stuck") brain.post = { x: g.x, y: g.y, face: g.face }; }
      else if (guard.sweep) { brain.swing = (brain.swing || 0) + dt; g.face = Math.round(post.face + Math.sin(brain.swing * 0.7) * 55); }
      else g.face = post.face;
    }
  }
  return g;
}
