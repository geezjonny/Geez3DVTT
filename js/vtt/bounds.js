// The map is a box of cells that grows to hold whatever is drawn past its edge. x, y: its top-left cell.
export const MAX_CELLS = 200;
export function grown({ x, y, cols, rows }, x1, y1, x2, y2, cell = 40) {
  const left = Math.min(x, Math.floor(Math.min(x1, x2) / cell)), top = Math.min(y, Math.floor(Math.min(y1, y2) / cell));
  const right = Math.max(x + cols, Math.ceil(Math.max(x1, x2) / cell)), bottom = Math.max(y + rows, Math.ceil(Math.max(y1, y2) / cell));
  if (left === x && top === y && right === x + cols && bottom === y + rows) return null;
  return { x: left, y: top, cols: right - left, rows: bottom - top, grown: true };
}
