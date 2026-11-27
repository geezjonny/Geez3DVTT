// The two save files. Pure: no DOM, no Firebase.
//   .geezmap   the whole table except tokens and initiative. Its outer half is the geezmap / dd2vtt format other tools
//              read; `table` is the exact copy this table loads.
//   .geezscene the same copy with tokens and initiative.
const MAP_PARTS = ["map", "objects", "groups", "mapimg", "atmosphere"], PLAY_PARTS = ["tokens", "initiative"];

// Uploaded floor pictures live apart from the map, at mapimgs/<id>; a file has to carry them along.
export const imageIds = (mapimg) => (!mapimg ? [] : mapimg.id || mapimg.src ? [mapimg] : Object.values(mapimg)).map((r) => r?.id).filter(Boolean);

export function buildFile(kind, name, snap, images = {}, geezmap = {}) {
  const parts = kind === "scene" ? [...MAP_PARTS, ...PLAY_PARTS] : MAP_PARTS;
  const table = { ...Object.fromEntries(parts.map((p) => [p, snap[p] ?? null])), images };
  return kind === "scene" ? { format: "geezscene", version: 1, name, table } : { ...geezmap, table };
}

// What loading a file writes, or null when it is not one of ours (then it goes to the other importers).
export function restorePlan(file) {
  const t = file?.table;
  if (!["geezmap", "geezscene"].includes(file?.format) || !t) return null;
  if (!t.map || typeof t.map !== "object") throw new Error("That file has no map in it.");
  const parts = file.format === "geezscene" ? [...MAP_PARTS, ...PLAY_PARTS] : MAP_PARTS;   // a map keeps the tokens on the table
  const changes = Object.fromEntries(parts.map((p) => [p, t[p] ?? null]));
  if (!t.atmosphere) delete changes.atmosphere;
  const images = Object.fromEntries(Object.entries(t.images || {}).filter(([id]) => /^[a-z0-9]+$/i.test(id)));
  return { changes, images, name: String(file.name || "Imported").slice(0, 80) };
}
