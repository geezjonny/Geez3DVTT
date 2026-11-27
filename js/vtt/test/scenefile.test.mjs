import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFile, restorePlan, imageIds } from "../scenefile.js";
import { exportGeezMap } from "../geezmap-export.js";
import { parseGeezMap } from "../geezmap.js";

const snap = {
  map: { size: { cols: 10, rows: 8 }, walls: { w: { x1: 0, y1: 0, x2: 40, y2: 0, hidden: true } } },
  objects: { s: { kind: "switch", x: 20, y: 20, links: { w: { vis: true } } } }, groups: null, mapimg: { 0: { id: "abc", chunks: 1 } },
  atmosphere: { time: 20 }, tokens: { t: { x: 20, y: 20 } }, initiative: { turn: "t" },
};
const trip = (x) => restorePlan(JSON.parse(JSON.stringify(x)));

test("a .geezmap keeps everything but tokens and still reads as a geezmap", () => {
  const file = buildFile("map", "Hall", snap, { abc: { c0: "AA" } }, exportGeezMap({ name: "Hall", ...snap }));
  assert.equal(parseGeezMap(file).name, "Hall");
  const plan = trip(file);
  assert.deepEqual(plan.changes.objects, snap.objects);
  assert.deepEqual(plan.changes.map, snap.map);
  assert.ok(!("tokens" in plan.changes) && !("initiative" in plan.changes));
  assert.deepEqual(plan.images, { abc: { c0: "AA" } });
});

test("a .geezscene brings the tokens back too", () => {
  const plan = trip(buildFile("scene", "Hall", snap));
  assert.deepEqual(plan.changes.tokens, snap.tokens);
  assert.deepEqual(plan.changes.initiative, snap.initiative);
});

test("other files are left to the other importers, and bad picture keys are dropped", () => {
  assert.equal(restorePlan({ format: "geezmap", version: 1 }), null);
  assert.equal(restorePlan({ line_of_sight: [] }), null);
  assert.deepEqual(trip(buildFile("scene", "x", snap, { "../tokens": {} })).images, {});
  assert.deepEqual(imageIds(snap.mapimg), ["abc"]);
  assert.deepEqual(imageIds({ src: "battlemap/a.dd2vtt" }), []);
});
