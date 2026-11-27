import { watch, read, put, patch } from "../store.js";
import { S } from "./state.js";
import { toolbar, svg } from "./ui.js";
import { buildInitiative } from "./initiative-rules.js";
import { tickEffects } from "./effects.js";
import { visibleToPlayer } from "./visibility.js";

let current = { turn: null, round: 1, order: {} };
let win = null, startBtn = null, nextBtn = null, started = false;

const isGM = () => S.isGM;
function entries() {
  return Object.entries(current.order || {})
    .filter(([id]) => S.tokens[id] && visibleToPlayer(S.tokens[id], Object.values(S.map.fog || {}), S.isGM, S.currentVisible, S.map.exploredEnabled !== false))
    .sort((a, b) => {
      const ai = a[1].init, bi = b[1].init;
      if (ai == null && bi != null) return 1;
      if (ai != null && bi == null) return -1;
      if (ai !== bi) return (bi ?? 0) - (ai ?? 0);
      return (a[1].n ?? 0) - (b[1].n ?? 0);
    });
}

function saveOrder(order) { return patch({ "initiative/order": order }); }

// GeezVTT's panel: Start/End, the next four turns (current first), Next. Players see only the four turns.
function render() {
  if (!win) return;
  const list = entries(), at = Math.max(0, list.findIndex(([id]) => id === current.turn)), order = [...list.slice(at), ...list.slice(0, at)];
  const active = current.turn != null;
  const tiles = [0, 1, 2, 3].map((i) => {
    const tile = document.createElement("div"), id = order[i]?.[0], token = id && S.tokens[id], name = token ? String(token.label || id).trim() : "";
    tile.className = "turn"; tile.textContent = token ? Array.from(name)[0].toUpperCase() : "·";
    tile.title = token ? `${name}${order[i][1].init == null ? "" : ` (${order[i][1].init})`}` : "Empty turn";
    tile.setAttribute("aria-label", token ? `${active && i === 0 ? "Current turn" : `Turn ${i + 1}`}: ${tile.title}` : tile.title);
    if (token && active && i === 0) tile.setAttribute("aria-current", "true");
    if (token?.img) { const img = Object.assign(document.createElement("img"), { alt: "", src: token.img }); img.addEventListener("error", () => img.remove(), { once: true }); tile.append(img); }
    return tile;
  });
  win.body.replaceChildren(...(isGM() ? [startBtn, ...tiles, nextBtn] : tiles));
  startBtn.textContent = active ? "End" : "Start";
  startBtn.title = active ? "End Initiative" : "Start Initiative"; startBtn.setAttribute("aria-label", startBtn.title);
  startBtn.classList.toggle("on", active); startBtn.disabled = !active && !list.length;
  nextBtn.disabled = !active;
}

// Start keeps the scores people have and gives the highest the first turn; End keeps them for next time.
function toggleCombat() {
  if (!isGM()) return;
  const first = entries()[0]?.[0] ?? null;
  return patch({ "initiative/turn": current.turn == null ? first : null, "initiative/round": 1 });
}

async function cleanMissing() {
  if (!isGM()) return;
  const order = { ...(current.order || {}) }; let changed = false;
  for (const id of Object.keys(order)) if (!S.tokens[id]) { delete order[id]; changed = true; }
  if (changed) await saveOrder(order);
}

export function inInitiative(tokenId) { return !!current.order?.[tokenId]; }

export async function addToInitiative(tokenId) {
  if (!isGM() || inInitiative(tokenId)) return;
  const raw = prompt(`Initiative for ${S.tokens[tokenId]?.label || tokenId}:`, "0"); if (raw === null) return;
  const init = Number(raw); if (!raw.trim() || !Number.isInteger(init)) return alert("Enter a whole number for initiative.");
  const fresh = (await read("initiative")) || current, order = { ...(fresh.order || {}) };
  if (order[tokenId]) return;
  const n = Object.values(order).reduce((max, item) => Math.max(max, Number(item?.n) || 0), 0) + 1;
  await patch({ "initiative/order": { ...order, [tokenId]: { init, n } }, "initiative/round": fresh.round || 1, "initiative/turn": fresh.turn ?? null });
}

export async function removeFromInitiative(tokenId) {
  if (!isGM() || !inInitiative(tokenId)) return;
  const order = { ...(current.order || {}) }, ids = entries().map(([id]) => id); delete order[tokenId];
  const next = ids[(ids.indexOf(tokenId) + 1) % ids.length];
  await patch({ "initiative/order": order, ...(current.turn === tokenId ? { "initiative/turn": next && next !== tokenId ? next : null } : {}) });
}

export async function nextTurn() {
  if (!isGM()) return;
  const list = entries().map(([id]) => id); if (!list.length) return;
  const index = current.turn == null ? -1 : list.indexOf(current.turn), next = (index + 1) % list.length;
  const round = (current.round || 1) + (index >= 0 && next === 0 ? 1 : 0), changes = { "initiative/turn": list[next], "initiative/round": round };
  if (round !== (current.round || 1)) {
    const tick = tickEffects(S.tokens, round);
    for (const [id, effects] of Object.entries(tick.changes)) changes[`tokens/${id}/effects`] = effects.length ? effects : null;
    if (tick.expired.length) changes["events/last"] = { t: Date.now(), text: `Expired: ${tick.expired.map((x) => `${x.name} (${S.tokens[x.tokenId]?.label || x.tokenId})`).join(", ")}` };
  }
  await patch(changes);
}

// Start combat: everyone on the map joins, each rolls a d20 (unless already numbered), and the highest goes first.
export async function startInitiative(mode = "all") {
  if (!isGM()) return;
  const fresh = (await read("initiative")) || {}, r = new Uint32Array(1);
  const { order, first } = buildInitiative(S.tokens, fresh.order, mode, () => { crypto.getRandomValues(r); return (r[0] % 20) + 1; });
  await patch({ "initiative/order": order, "initiative/round": 1, "initiative/turn": first });
}

export const endInitiative = () => isGM() && put("initiative", null);

export function initInitiative() {
  if (started) return; started = true;
  win = toolbar("init", "Initiative", 345);
  win.body.classList.toggle("players", !isGM());
  const button = (onClick) => { const b = document.createElement("button"); b.type = "button"; b.className = "barbtn"; b.addEventListener("click", onClick); return b; };
  startBtn = button(toggleCombat); nextBtn = button(nextTurn);
  nextBtn.title = "Next Turn"; nextBtn.setAttribute("aria-label", nextBtn.title); nextBtn.innerHTML = svg('<path d="m5 4 10 8-10 8ZM19 4v16"/>');
  render();
  watch("initiative", (value) => { S.combat = value?.turn != null; current = { turn: value?.turn ?? null, round: value?.round || 1, order: value?.order || {} }; S.round = current.round; if (S.turn !== current.turn) { S.turn = current.turn; document.dispatchEvent(new Event("turnchanged")); } render(); cleanMissing(); });
  watch("tokens", (value) => { if (value) S.tokens = value; render(); cleanMissing(); });
  document.addEventListener("tokenschanged", render);
  document.addEventListener("vttvisibilitychange", render);
}
