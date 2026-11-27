// Pure grid geometry for multi-cell door placement.
export function segmentDoors(start, end, grid = 40) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (!dx && !dy) return { x1: start.x, y1: start.y, x2: end.x, y2: end.y, dir: null, cells: [] };
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const x2 = horizontal ? end.x : start.x, y2 = horizontal ? start.y : end.y;
  const distance = horizontal ? Math.abs(x2 - start.x) : Math.abs(y2 - start.y);
  const count = Math.round(distance / grid);
  const sign = (horizontal ? x2 - start.x : y2 - start.y) < 0 ? -1 : 1;
  const cells = Array.from({ length: count }, (_, i) => horizontal
    ? { x: start.x + sign * (i + .5) * grid, y: start.y, dir: "h" }
    : { x: start.x, y: start.y + sign * (i + .5) * grid, dir: "v" });
  return { x1: start.x, y1: start.y, x2, y2, dir: horizontal ? "h" : "v", cells };
}

// Cut the part of wall w (or any segment) that lies under the segment a-b: null if they don't overlap, else the
// leftover pieces of w. Imported maps are not exactly on the grid, so "under" allows a quarter of a square.
export function cutWall(w, a, b, near = 10) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, L = Math.sqrt(L2); if (!L) return null;
  const T = (x, y) => ((x - a.x) * dx + (y - a.y) * dy) / L2, off = (x, y) => Math.abs((x - a.x) * dy - (y - a.y) * dx) / L;
  if (off(w.x1, w.y1) > near || off(w.x2, w.y2) > near) return null;
  const t1 = T(w.x1, w.y1), t2 = T(w.x2, w.y2), lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(1, Math.max(t1, t2)), e = 2 / L;
  if (hi - lo <= e) return null;
  const [s0, s1] = t1 < t2 ? [t1, t2] : [t2, t1], out = [];
  const q = (t) => { const k = (t - t1) / (t2 - t1); return { x: Math.round(w.x1 + k * (w.x2 - w.x1)), y: Math.round(w.y1 + k * (w.y2 - w.y1)) }; };   // stays on w's own line
  for (const [u, v] of [[s0, lo], [hi, s1]]) if (v - u > e) { const p = q(u), r = q(v); out.push({ ...w, x1: p.x, y1: p.y, x2: r.x, y2: r.y }); }
  return out;
}
