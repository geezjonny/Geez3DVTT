// Random treasure by tier (GeezVTT's loot rules) and how it lands in a character's bag and coin purse.
export const LOOT_TIERS = [
  { label: "Tier 1 (levels 1–4)", rarity: ["Common", "Uncommon"], gearLimit: 50, coins: { cp: [20, 100], sp: [10, 60], gp: [5, 25] } },
  { label: "Tier 2 (levels 5–10)", rarity: ["Rare"], gearLimit: 500, coins: { sp: [50, 250], gp: [50, 250], pp: [1, 10] } },
  { label: "Tier 3 (levels 11–16)", rarity: ["Very Rare"], gearLimit: 1500, coins: { gp: [250, 1500], pp: [25, 150] } },
  { label: "Tier 4 (levels 17–20)", rarity: ["Legendary"], gearLimit: 5000, coins: { gp: [1000, 5000], pp: [100, 1000] } }
];
const GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

const entry = (item, qty) => {
  const category = item.equipment_category?.name, desc = [...(item.desc || []), ...(item.special || [])].join("\n").slice(0, 700);
  return { name: item.name, qty, ...(category ? { category } : {}), ...(item.weight >= 0 ? { weight: item.weight } : {}), ...(desc ? { desc } : {}) };
};

// reference: SRD equipment and magic items in one list. Returns { coins: { gp: n, ... }, items: [bag entries] }.
export function generateLoot(tier, reference, random = Math.random) {
  const rules = LOOT_TIERS[tier - 1];
  if (!rules) throw new Error("Choose a loot tier from 1 to 4.");
  const roll = (min, max) => min + Math.floor(random() * (max - min + 1));
  const cost = (i) => Number(i.cost?.quantity) * (GP[i.cost?.unit] ?? NaN);
  const gear = reference.filter((i) => i.name && i.weight >= 0 && cost(i) > 0 && cost(i) <= rules.gearLimit && !/mount|vehicle|waterborne/i.test(i.equipment_category?.name || ""));
  const magic = reference.filter((i) => i.name && rules.rarity.includes(i.rarity?.name) && !i.variants?.length);
  if (!gear.length || !magic.length) throw new Error("The item lists did not load.");
  // shortcut: bounded tier loot, not the DMG hoard tables; replace when exact treasure tables are wanted.
  const coins = Object.fromEntries(Object.entries(rules.coins).map(([k, [min, max]]) => [k, roll(min, max)]));
  const items = [];
  for (let n = Math.min(roll(2, 4), gear.length); n > 0; n--) {
    const [item] = gear.splice(roll(0, gear.length - 1), 1);
    items.push(entry(item, roll(1, Math.min(3, Math.floor(rules.gearLimit / cost(item))))));
  }
  items.push(entry(magic[roll(0, magic.length - 1)], 1));
  return { coins, items };
}

// The bag with these items added; a name already carried only gains quantity.
export function addToBag(current, items, newKey = () => "i" + crypto.randomUUID().replaceAll("-", "").slice(0, 16)) {
  const bag = Object.fromEntries(Object.entries(current || {}).filter(([, i]) => i?.name).map(([k, i]) => [k, { ...i }]));
  for (const item of items) {
    const hit = Object.values(bag).find((i) => String(i.name).toLowerCase() === item.name.toLowerCase());
    if (hit) hit.qty = (Number(hit.qty ?? 1) || 1) + item.qty;
    else bag[newKey()] = { ...item, given_by: "GM", given_at: Date.now() };
  }
  return bag;
}

export function addCoins(current, coins) {
  const purse = { ...(current || {}) };
  for (const [k, n] of Object.entries(coins)) purse[k] = (Number(purse[k]) || 0) + n;
  return purse;
}
