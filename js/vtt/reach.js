// Movement limits for players: tokens can't cross walls or closed doors/windows.
// Cells are 40px, tokens sit on cell centres; a step is blocked if the line between two cell centres touches a wall.
import { S, mapSize } from "./state.js";

const ccw = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const onSeg = (ax, ay, bx, by, px, py) => Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(ay, by) <= py && py <= Math.max(ay, by);
function touches(a, b) {   // segments a=[x1,y1,x2,y2], b: do they intersect (touching counts)?
  const d1 = ccw(b[0], b[1], b[2], b[3], a[0], a[1]), d2 = ccw(b[0], b[1], b[2], b[3], a[2], a[3]);
  const d3 = ccw(a[0], a[1], a[2], a[3], b[0], b[1]), d4 = ccw(a[0], a[1], a[2], a[3], b[2], b[3]);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && onSeg(b[0], b[1], b[2], b[3], a[0], a[1])) || (d2 === 0 && onSeg(b[0], b[1], b[2], b[3], a[2], a[3]))
    || (d3 === 0 && onSeg(a[0], a[1], a[2], a[3], b[0], b[1])) || (d4 === 0 && onSeg(a[0], a[1], a[2], a[3], b[2], b[3]));
}

// The line a door fills: the exact one from a map import, otherwise one cell (two for double doors) around its centre.
export function doorSeg(o) {
  if (o.seg) return o.seg;
  const n = (o.doorKind || o.kindName) === "double" ? 40 : 20;
  return o.dir === "v" ? [o.x, o.y - n, o.x, o.y + n] : [o.x - n, o.y, o.x + n, o.y];
}

// Everything solid on a floor (every floor when none is given): walls, closed doors and windows.
export function solidSegments(level = null) {
  const here = (r) => level == null || (r.lv ?? 0) === level;
  const segs = Object.values(S.map.walls || {}).filter((w) => here(w) && [w.x1, w.y1, w.x2, w.y2].every(Number.isFinite)).map((w) => [w.x1, w.y1, w.x2, w.y2]);
  for (const o of Object.values(S.objects || {})) {
    if (o.kind !== "door" || !here(o) || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    const kind = o.doorKind || o.kindName, window = o.win || kind === "window";
    if (!window && (o.state === "open" || kind === "arch")) continue;
    segs.push(doorSeg(o));
  }
  return segs;
}

// Is a one-cell step between two cell-centre points blocked (wall, closed door, window, or off the map)?
export function stepBlocked(from, to) {
  const { cols, rows, x, y } = mapSize();
  if (to.x < x * 40 + 20 || to.y < y * 40 + 20 || to.x > (x + cols) * 40 - 20 || to.y > (y + rows) * 40 - 20) return true;
  const seg = [from.x, from.y, to.x, to.y];
  return solidSegments().some((s) => touches(seg, s));
}
