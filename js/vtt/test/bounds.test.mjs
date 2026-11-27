import test from "node:test";
import assert from "node:assert/strict";
import { grown } from "../bounds.js";
import { cellsForHoles, decodeCells, encodeCells, mergeCells } from "../explored.js";
import { moveCircle } from "../movement.js";

const map = { x: 0, y: 0, cols: 10, rows: 8 };

test("the map grows only for what is drawn past its edge", () => {
  assert.equal(grown(map, 0, 0, 400, 320), null);
  assert.deepEqual(grown(map, -80, 40, 120, 400), { x: -2, y: 0, cols: 12, rows: 10, grown: true });
  assert.deepEqual(grown({ x: -2, y: 0, cols: 12, rows: 10 }, 400, -40, 480, 0), { x: -2, y: -1, cols: 14, rows: 11, grown: true });
});

test("sight, memory and walking work left of and above the old edge", () => {
  const seen = cellsForHoles([[-20, -20, 1]], 3, 3, -2, -2);
  assert.deepEqual(seen, new Set(["-1,-1"]));
  assert.deepEqual(mergeCells(seen, new Set(["0,0"])), new Set(["-1,-1", "0,0"]));
  const cells = new Set(["-3,-1", "-2,-1", "-1,-1", "0,-1", "-5,2"]);
  assert.deepEqual(decodeCells(encodeCells(cells)), cells);
  assert.equal(moveCircle({ x: 20, y: 20 }, -500, -500, 12, [], 400, 400, -80, -80).x, -68);
});
