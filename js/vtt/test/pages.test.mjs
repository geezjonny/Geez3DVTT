import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = (name) => readFileSync(new URL(`../../../${name}`, import.meta.url), "utf8").replaceAll("\r", "");

test("gm.html is index.html plus the GM role", () => {
  assert.equal(page("gm.html"), page("index.html").replace('<html lang="en">', '<html lang="en" data-role="gm">').replace("<title>Geez 3D Table</title>", "<title>Geez 3D Table (GM)</title>"));
  assert.ok(!page("index.html").includes("data-role"));
});
