// "Who are you?" card on the player page, shown on each visit unless the link names a character (?char=<id>).
// Nobody's token moves until they choose.
import { S } from "./state.js";

export function initJoin({ loadPcs, setMe, getMe }) {
  S.choosing = true;
  const card = document.createElement("dialog"), title = document.createElement("h2"), list = document.createElement("div");
  card.id = "joincard"; title.textContent = "Who are you?"; list.className = "join-list";
  card.setAttribute("aria-label", title.textContent);
  card.append(title, list);
  card.addEventListener("cancel", (e) => e.preventDefault());
  card.addEventListener("close", () => { if (S.choosing) card.showModal(); });   // browsers let a second Escape through
  document.body.append(card); card.showModal();

  const button = (text, onClick) => { const b = document.createElement("button"); b.type = "button"; b.textContent = text; b.addEventListener("click", onClick); return b; };
  async function fill(tries = 5) {
    list.textContent = "Loading characters…";
    const pcs = (await loadPcs()).filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name));
    if (!pcs.length && tries > 1) return setTimeout(fill, 1500, tries - 1);   // the first read can arrive empty
    if (!pcs.length) return list.replaceChildren("Could not load the characters.", button("Try again", () => fill()));
    const buttons = pcs.map((pc) => button(pc.name, () => { S.choosing = false; card.remove(); setMe({ id: pc.id, name: pc.name }); }));
    list.replaceChildren(...buttons);
    (buttons[pcs.findIndex((c) => c.id === getMe()?.id)] || buttons[0]).focus();   // last time's character: Enter joins
  }
  fill();
}
