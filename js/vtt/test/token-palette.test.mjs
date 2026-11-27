import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { recentTokenRefs, tokenInitials, artFor } from "../token-palette.js";

test("token initials are compact and readable", () => {
  assert.equal(tokenInitials("  Red Wizard "), "RW");
  assert.equal(tokenInitials(""), "?");
});

test("token art is found by name, and the list matches the folder", () => {
  assert.equal(artFor(" Adult Black Dragon ", ["adult_black_dragon.png"]), "token/adult_black_dragon.png");
  assert.equal(artFor("", ["a.png"]), "");
  assert.equal(artFor("Nobody", ["a.png"]), "");
  const dir = new URL("../../../token/", import.meta.url);
  const listed = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));
  assert.deepEqual([...listed].sort(), readdirSync(dir).filter((f) => f !== "index.json").sort());
});

test("recent token refs keep available entries in recent order", () => {
  const available = [{ kind: "pc", id: "a" }, { kind: "npc", id: "b" }];
  assert.deepEqual(recentTokenRefs(["npc:b", "npc:missing", "pc:a", "npc:b"], available), ["npc:b", "pc:a"]);
});
