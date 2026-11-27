import test from "node:test";
import assert from "node:assert/strict";
import { derive, actionsOf, conditionsOf, onFired, newObject, evaluate, resetAll, behaviorsFor } from "../index.js";

const plate = (x = 100, y = 100, extra = {}) => newObject("plate", x, y, 1, extra);

test("plate is down when a token stands on it", () => {
  assert.equal(derive(plate(), { A: { x: 100, y: 100 } }), "down");
  assert.equal(derive(plate(), { A: { x: 140, y: 100 } }), "up");
});
test("latched plate stays down", () => {
  const p = { ...plate(100, 100, { latch: true }), state: "down" };
  assert.equal(derive(p, {}), "down");
});
test("tripwire trips on any of its cells", () => {
  const t = newObject("tripwire", 100, 100, 1, { len: 3, dir: "h" });
  assert.equal(derive(t, { A: { x: 180, y: 100 } }), "tripped");
  assert.equal(derive(t, { A: { x: 220, y: 100 } }), "clear");
});
test("gauge follows token hp", () => {
  const g = newObject("gauge", 0, 0, 1, { token: "G" });
  assert.equal(derive(g, { G: { hp: 10, max: 10 } }), "alive");
  assert.equal(derive(g, { G: { hp: 5, max: 10 } }), "bloodied");
  assert.equal(derive(g, { G: { hp: 0, max: 10 } }), "dead");
});
test("action and condition lists", () => {
  assert.deepEqual(actionsOf(newObject("door", 0, 0)), ["open", "closed", "toggle", "move"]);
  assert.deepEqual(actionsOf(newObject("spawn", 0, 0)), ["fire", "move"]);
  assert.deepEqual(actionsOf(plate()), []);
  assert.deepEqual(conditionsOf(plate()), ["down", "up", "at"]);
});
test("level rule: plate opens door, releases when unmet", () => {
  const objects = { p: plate(), d: newObject("door", 300, 300) };
  const groups = { g: { when: [{ id: "p", state: "down" }], then: [{ id: "d", action: "open" }], met: false } };
  let c = evaluate({ objects, groups, tokens: { A: { x: 100, y: 100 } } });
  assert.equal(c["objects/d/state"], "open"); assert.equal(c["groups/g/met"], true);
  objects.p.state = "down"; objects.d.state = "open"; groups.g.met = true;
  c = evaluate({ objects, groups, tokens: {} });
  assert.equal(c["objects/d/state"], "closed"); assert.equal(c["groups/g/met"], false);
});
test("toggle only on rising edge", () => {
  const objects = { s: newObject("switch", 0, 0), l: newObject("light", 40, 0) };
  objects.s.state = "on";
  const g = { when: [{ id: "s", state: "on" }], then: [{ id: "l", action: "toggle" }], met: false };
  assert.equal(evaluate({ objects, groups: { g } })["objects/l/state"], "off");
  assert.equal(evaluate({ objects, groups: { g: { ...g, met: true } } })["objects/l/state"], undefined);
});
test("fire latches and move/at work", () => {
  const objects = { s: newObject("stone", 100, 100, 1, { to: { x: 200, y: 100 } }), p: plate(60, 60) };
  const groups = { g: { when: [{ id: "A", at: { x: 60, y: 60 } }], then: [{ id: "s", action: "fire" }, { id: "p", action: "move", to: { x: 300, y: 300 } }], met: false } };
  const c = evaluate({ objects, groups, tokens: { A: { x: 60, y: 60 } } });
  assert.equal(c["objects/s/state"], "fired");
  assert.equal(c["objects/p/x"], 300);
});
test("resetAll restores start state and place", () => {
  const o = { ...plate(100, 100), state: "down", x: 500, y: 500 };
  const c = resetAll({ p: o }, { g: {} });
  assert.equal(c["objects/p/state"], "up"); assert.equal(c["objects/p/x"], 100); assert.equal(c["groups/g/met"], false);
});
test("onFired spawn adds token, stone moves", () => {
  const sp = onFired("sp", newObject("spawn", 40, 40, 1, { hp: 7 }));
  const key = Object.keys(sp.changes).find((k) => k.startsWith("tokens/"));
  assert.equal(sp.changes[key].hp, 7);
  const st = onFired("st", newObject("stone", 0, 0, 1, { to: { x: 80, y: 0 } }));
  assert.equal(st.changes["objects/st/x"], 80);
});
test("traps start hidden, others visible, and hidden does not stop a trip", () => {
  assert.equal(newObject("tripwire", 0, 0).hidden, true);
  assert.equal(newObject("floor", 0, 0).hidden, true);
  assert.equal(newObject("door", 0, 0).hidden, false);
  const t = newObject("tripwire", 100, 100, 1, { len: 1 });
  assert.equal(derive(t, { A: { x: 100, y: 100 } }), "tripped");
});

test("connections flip the target once per use, plates only when set off, and never loop", () => {
  const lever = { ...newObject("switch", 0, 0), state: "on", was: "off", links: { d: { open: true, lock: true }, b: { activate: true }, p1: { vis: true, light: true }, w1: { vis: true } } };
  const other = { ...newObject("switch", 40, 0), was: "off", links: { s: { activate: true } } };
  const objects = { s: lever, b: other, d: newObject("door", 80, 0) };
  const c = evaluate({ objects, props: { p1: { kind: "obelisk" } }, walls: { w1: { x1: 0 } } });
  assert.equal(c["map/props/p1/off"], true); assert.equal(c["map/walls/w1/hidden"], true);
  assert.equal(c["objects/d/state"], "open"); assert.equal(c["objects/d/locked"], true); assert.equal(c["map/props/p1/hidden"], true);
  assert.equal(c["objects/b/state"], "on"); assert.equal(c["objects/b/was"], "on"); assert.equal(c["objects/s/state"], undefined);
  assert.deepEqual(evaluate({ objects: { s: { ...lever, was: "on" }, d: objects.d } }), {});
  const p = { ...plate(100, 100), state: "down", was: "down", links: { d: { open: true } } };
  assert.equal(evaluate({ objects: { p, d: objects.d } })["objects/d/state"], undefined);   // stepping off
  assert.equal(evaluate({ objects: { p: { ...p, state: "up", was: "up" }, d: objects.d }, tokens: { A: { x: 100, y: 100 } } })["objects/d/state"], "open");
});

test("each target offers only what it can do, and activate fires a trap", () => {
  assert.deepEqual(behaviorsFor("object", newObject("door", 0, 0)), ["open", "lock", "vis"]);
  assert.deepEqual(behaviorsFor("object", newObject("light", 0, 0)), ["light", "vis"]);
  assert.deepEqual(behaviorsFor("object", newObject("catapult", 0, 0)), ["activate", "vis"]);
  assert.deepEqual(behaviorsFor("object", newObject("plate", 0, 0)), ["vis"]);
  assert.deepEqual(behaviorsFor("prop", { kind: "obelisk" }, true), ["light", "vis"]);
  assert.deepEqual(behaviorsFor("wall", {}), ["vis"]);
  const objects = { s: { ...newObject("switch", 0, 0), state: "on", was: "off", links: { c: { activate: true } } }, c: newObject("catapult", 40, 0) };
  assert.equal(evaluate({ objects })["objects/c/state"], "fired");
});

test("setting off a hidden trap reveals it once, only from its own floor", () => {
  const p = plate(100, 100, { hidden: true }), on = { A: { x: 100, y: 100 } };
  assert.equal(evaluate({ objects: { p }, tokens: on })["objects/p/hidden"], false);
  assert.equal(evaluate({ objects: { p: { ...p, state: "down" } }, tokens: on })["objects/p/hidden"], undefined);   // re-hidden by the GM
  assert.deepEqual(evaluate({ objects: { p }, tokens: { A: { x: 100, y: 100, lv: 1 } } }), {});
});
