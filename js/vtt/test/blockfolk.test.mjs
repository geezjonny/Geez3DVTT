import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanHero, RACES, CLASSES } from "../blockfolk-data.js";

test("a hero code keeps good values and replaces bad ones with defaults", () => {
  const h = cleanHero({ race: "Elf", cls: "Wizard", hat: "crown", top: "#112233", skin: "red", main: "<img>", junk: 1 });
  assert.deepEqual([h.hat, h.top, h.skin, h.main], ["crown", "#112233", RACES.Elf.skins[0], CLASSES.Wizard.main]);
  assert.ok(!("junk" in h) && Object.values(h).every((v) => typeof v === "string"));
});

test("a code without a known race and class is refused", () => {
  for (const bad of [null, {}, { race: "__proto__", cls: "Wizard" }, { race: "Elf", cls: "toString" }]) assert.throws(() => cleanHero(bad), /valid race or class/);
});
