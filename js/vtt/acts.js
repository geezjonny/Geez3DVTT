// What a companion.html roll makes its token do. companion.js labels rolls "<name> Attack", "<name> Spell attack",
// "<name> Damage" or "<name> Healing", and damage after a to-hit roll is only rolled once the GM says it hit.
// `tried` remembers (per character) which names have rolled to hit. Pure, so it runs in Node tests.
export function companionAct(label, sheet, tried) {
  const m = /^(.+?) (spell attack|attack|damage|healing)$/i.exec(label || ""); if (!m) return null;
  const name = m[1].toLowerCase(), what = m[2].toLowerCase(), has = (list) => Object.values(list || {}).some((a) => String(a?.name).toLowerCase() === name);
  const weapon = has(sheet?.attacks), spell = has(sheet?.spellcasting?.spells);
  if (what === "attack" && weapon) { tried.add(name); return { fx: "slash" }; }
  if (what === "spell attack") { tried.add(name); return { fx: "magic" }; }
  if (what === "healing" && spell) return { fx: "magic" };
  if (what !== "damage") return null;
  if (weapon) return { act: "attack" };
  return spell ? (tried.has(name) ? { act: "attack" } : { fx: "magic" }) : null; // a save spell has no to-hit roll
}

// The right-click Emote menu. Poses need a mini; bubbles work on any token. Resting poses last until the token moves.
export const EMOTES = [["Wave", "wave"], ["Cheer", "cheer"], ["Dance", "dance"], ["Bow", "bow"], ["Point", "point"], ["Yes", "yes"], ["No", "no"], ["Laugh", "laugh"], ["Shrug", "shrug"], ["Facepalm", "facepalm"], ["Jump", "jump"], ["Flex", "flex"], ["Cry", "cry"], ["Fart", "fart"], ["Sit", "sit"], ["Sleep", "sleep"]];
export const RESTS = ["sit", "sleep"];
export const SAYS = ["❤️", "❓", "❗", "😂", "💤"];
// Is a token still resting? Its record holds the square it sat down on.
export const restOf = (record, token) => (RESTS.includes(record?.act) && record.x === token.x && record.y === token.y ? record.act : null);
