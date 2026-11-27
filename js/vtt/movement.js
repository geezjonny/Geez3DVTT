// Pure movement rules (no DOM, no database): sliding along walls, and stairs, ladders and portals.
export function pushOut(o, r, segs) {   // the circle push-out from GeezVTT's stealth page
  for (let pass = 0; pass < 3; pass++) for (const [x1, y1, x2, y2] of segs) {
    if (Math.min(x1, x2) - r > o.x || Math.max(x1, x2) + r < o.x || Math.min(y1, y2) - r > o.y || Math.max(y1, y2) + r < o.y) continue;
    const ex = x2 - x1, ey = y2 - y1, u = Math.max(0, Math.min(1, ((o.x - x1) * ex + (o.y - y1) * ey) / (ex * ex + ey * ey || 1)));
    const dx = o.x - (x1 + ex * u), dy = o.y - (y1 + ey * u), d = Math.hypot(dx, dy);
    if (d < r && d > 1e-6) { o.x += dx / d * (r - d); o.y += dy / d * (r - d); }
  }
}
// Move in short steps so nothing is ever jumped through.
export function moveCircle(o, dx, dy, r, segs, right, bottom, left = 0, top = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let i = 0; i < steps; i++) {
    o.x += dx / steps; o.y += dy / steps;
    pushOut(o, r, segs);
    o.x = Math.max(left + r, Math.min(right - r, o.x)); o.y = Math.max(top + r, Math.min(bottom - r, o.y));
  }
  return o;
}

const sameCell = (a, b) => Math.floor(a.x / 40) === Math.floor(b.x / 40) && Math.floor(a.y / 40) === Math.floor(b.y / 40);
const climbs = (p) => p.kind === "stairs" || p.kind === "ladder";
const target = (p) => (p.to === "" || p.to == null ? NaN : Number(p.to));
// The stairs, ladder or portal in the cell a token is standing in. Stairs work from both ends: the floor they are
// on, and the floor they go to.
export function exitAt(props, at, lv) {
  return Object.entries(props || {}).find(([, p]) => (climbs(p) || p.kind === "portal") && sameCell(p, at) &&
    ((p.lv ?? 0) === lv || (climbs(p) && target(p) === lv)))?.[0] || null;
}
// Where it leads from floor `lv`: { x, y, lv }, or null when it is not connected.
export function leadsTo(props, id, at, lv) {
  const p = props?.[id]; if (!p) return null;
  if (p.kind === "portal") {
    const other = p.link && Object.entries(props).find(([k, q]) => k !== id && q.kind === "portal" && q.link === p.link)?.[1];
    return other ? { x: other.x, y: other.y, lv: other.lv ?? 0 } : null;
  }
  const from = p.lv ?? 0, to = target(p);
  if (!Number.isFinite(to) || to === from) return null;
  return { x: at.x, y: at.y, lv: lv === from ? to : from };
}
