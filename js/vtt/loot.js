// GM Loot window: roll a tier's treasure, then give it to a character's sheet (the bag companion.html shows).
import { txnAt } from "../store.js";
import { addBarButton, floatWindow } from "./ui.js";
import { LOOT_TIERS, generateLoot, addToBag, addCoins } from "./lootroll.js";

export function initLoot({ loadPcs }) {
  let win = null, loot = null, reference = null, busy = false;
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const tier = el("select", { title: "Loot tier" }, ...LOOT_TIERS.map((t, i) => el("option", { value: i + 1, textContent: t.label })));
  const who = el("select", { title: "Character" });
  const roll = el("button", { type: "button", textContent: "Roll loot" }), give = el("button", { type: "button", textContent: "Give" });
  const list = el("div"), status = el("div"); status.setAttribute("role", "status");

  function draw() {
    const coins = Object.entries(loot?.coins || {}).map(([k, n]) => `${n} ${k}`).join(", ");
    list.replaceChildren(...(coins ? [el("div", { className: "inv-item", textContent: coins })] : []),
      ...(loot?.items || []).map((i) => el("div", { className: "inv-item", title: i.desc || "", textContent: `${i.name} ×${i.qty}` })));
    roll.disabled = busy; give.disabled = busy || !loot || !who.value;
  }
  async function characters() {
    const pcs = (await loadPcs()).filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)), chosen = who.value;
    who.replaceChildren(el("option", { value: "", textContent: "Give to…" }), ...pcs.map((c) => el("option", { value: c.id, textContent: c.name })));
    who.value = chosen; draw();
  }
  roll.addEventListener("click", async () => {
    try {
      reference ||= (await Promise.all(["data/equipment.json", "data/magic_items.json"].map((f) => fetch(f).then((r) => r.json())))).flat();
      loot = generateLoot(Number(tier.value), reference); status.textContent = "";
    } catch (err) { status.textContent = `Could not roll: ${err.message}`; }
    draw();
  });
  who.addEventListener("change", draw);
  give.addEventListener("click", async () => {
    if (busy || !loot || !who.value) return;
    const id = who.value, name = who.selectedOptions[0].textContent;
    const save = async (part, change) => { if ((await txnAt(`characters/pcs/${id}/${part}`, change))?.committed === false) throw new Error("the sheet changed"); };
    busy = true; status.textContent = "Giving…"; draw();
    try {   // each part leaves the list once saved, so pressing Give again never hands it over twice
      if (loot.items.length) { const items = loot.items; await save("inventory", (bag) => addToBag(bag, items)); loot.items = []; draw(); }
      await save("coin_purse", (purse) => addCoins(purse, loot.coins));
      loot = null; status.textContent = `Given to ${name}.`;
    } catch (err) { console.warn("Loot not saved", err); status.textContent = `Not all saved (${err.message}). What is still listed was not confirmed: check ${name}'s bag before giving again.`; }
    busy = false; draw();
  });

  addBarButton({ id: "loot", label: "Loot", title: "Random loot by tier", onClick: () => {
    if (win) { win.toggle(); } else {
      win = floatWindow({ id: "loot", title: "Loot", x: 240, y: 120 });
      win.body.classList.add("invwin");
      win.body.append(el("div", { className: "inv-add" }, tier, roll), list, el("div", { className: "inv-add" }, who, give), status);
    }
    if (win.visible()) characters();
  } });
}
