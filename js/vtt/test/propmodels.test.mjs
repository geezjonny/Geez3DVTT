import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { propParts } from "../propmodels.js";

const source = readFileSync(new URL("../draw.js", import.meta.url), "utf8");
const kinds = [...new Set(source.match(/const PROP_NAMES = `([^`]+)`/)[1].split(" "))];
const byView = ["stairs", "ladder", "portal"];

test("every catalog prop has a model with sane, light geometry", () => {
  for (const kind of kinds.filter((k) => !byView.includes(k))) {
    const parts = propParts(kind);
    assert.ok(parts?.length, `${kind} has no model`);
    assert.ok(parts.length <= 60, `${kind} has ${parts.length} shapes`);
    for (const p of parts) assert.ok([...p.a, ...p.at, ...(p.rot || [])].every(Number.isFinite), `${kind} has a bad number`);
  }
});

test("unknown kinds have no model", () => {
  assert.equal(propParts("toString"), null);
  assert.equal(propParts("decal_nope"), null);
});
