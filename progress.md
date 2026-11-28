# Progress

## 2026-11-28

### Done (fixes after the first session)
- **Dragon minis:** long neck, wedge head with open jaw and slit eyes, frill, one-piece bat wings; new **Tentacles**
  mouth and **Illithid dragon** preset. Checked as test renders.
- **Roll call:** stays open after the last result.
- **Guard routes:** right-click an NPC > **Draw patrol route**, click spots, right-click, Enter or Esc to finish.
- **New tokens** without a player character start hidden.
- **Skill rolls (GeezSheets):** `sheet.html` now sends rolls to the board; both sheet pages warn when a send fails.
- Token sizes checked: Medium to Gargantuan are 1 to 4 squares, as in D&D.

### Done (later: Blockbench and race heads)
- **Heroic heads** (`blockfolk.html`, **Head > Heroic**): sculpted head shapes, ears, horns and tusks for all 12 races,
  male and female, with the cute sparkly-eyed face drawn on top. Dragonborn keeps a modelled snout and teeth.
- **Body > Female:** female head, narrower shoulders and waist, wider hips. Old hero codes stay male with their old head.
- Shapes were modelled in Blockbench and stored in `js/vtt/raceparts-data.js`. The Blockbench-to-data script and the
  `race_heads` project are not in the repo (temporary folder / unsaved tab).
- Tests pass (88). All 24 heads render and build as table minis; not yet clicked through in the creator or on the live
  table. Cheek markings and male/female differences are faint at a distance; the old helm looks patchy on these heads.
- Also in Blockbench, not part of the game: a sailing ship (unsaved) and an illithid dragon exported to
  `Documents\illithid_dragon.glb`. Companion save and pack fixes are recorded in GeezSheets.
- **Next:** torsos in the same Blockbench-to-data way.

### Where it stands
- Tests pass. A `companion.html` skill roll showed on the live GM board (two tabs on one computer).
- Why players' rolls did not show in the session is unknown; only one reached the database that night.

### Left to do
- Next session: each player rolls one skill while the GM watches; note the page address of any that fails.
- Set Zersayth to **Mouth > Tentacles** in the creator and reapply it with **3D mini...**.
- Try on real devices: `sheet.html` rolls, patrol routes on the castle map, hidden NPCs.
- Hidden guards can still spot players. Large and Gargantuan tokens sit half a square off the grid lines.

## 2026-11-27

### Done
- **Doors:** a drag makes one long door; iron draws as iron; every door type and door material has its own 3D look.
  Bars are now a swinging gate (only the portcullis lifts).
- **Token minis (optional):** Blockfolk heroes from `blockfolk.html`, set per token by the GM. Pictures stay the default.
- **Animations:** walk while moving, attack on a hit, flinch on HP loss.
- **Attack effects:** slash for weapons, flash for spells and cantrips, small camera shake.
- **Emotes:** speech bubbles on any token; poses for minis, including sit and sleep until the token moves.
- **Creator:** body sliders; head, torso, arm and leg types; ears, horns, tail; more armour, weapons, hats and
  accessories; any skin, hair and eye colour.
- **Squishy:** a floating, glowing six-eyed octopus mini, picked from **3D mini…**.
- **Monster creator:** new `blockcreature.html` with seven body shapes, legs, arms, heads, eyes, wings, tails, markings
  and presets (Squishy included). Saved monsters appear in **3D mini…** like heroes.
- **Token menu:** type or step HP, and set token size.
- Castle scene saved in `scene/` as "Battle at Castle Alaris": more props, and minis on 7 tokens.
- **Stealth:** GM can right-click a character and pick **Neutral to guards**; no guard sees or hears them until switched
  back. Tests pass (83); not yet tried in a live browser.
- **Minigame:** new `minigame.html` (GM adds `?gm=jonny`, a link and not a password). GM brings table tokens in as
  hostiles or Fighter/Ranger/Cleric/Bard heroes; players pick one, move with arrows, type words to attack and use a
  Space-bar skill gauge. Synced under `geez3d/minigame`; the GM page runs the hostiles, so keep it open. A five-screen
  headless test passed; real keyboards, separate computers, reset and late joining are untried.
- **Minigame, later changes:** each enemy has its own word overhead; a d20 per hero at Start sets word length and gauge
  timing; waves spawn as pixel guards, pixel zombies or any `token/` picture chosen by the GM.
- **Sneak and escape:** new `minigame2.html` (own table, `geez3d/minigame2`). GM sets map size, drags rectangular rooms,
  puts doors into walls, wires levers to doors, marks exits, places heroes, guards (two-click patrol with a vision cone)
  and zombies (follow the closest sound). Everyone must escape. Both pages share `js/minigame*.js` and `js/minigame.css`.
- **Caught (`minigame2.html`):** a guard or zombie that reaches a hero holds them instead of doing damage. The player
  presses Space for one Stealth check (d20 + sheet modifier, GM can type over it) against the GM's DC (default 12);
  rolls itself after 8 seconds. Pass: that enemy ignores them for 3 seconds. Fail: back to their start. A fighter holding
  the line cannot be caught. The headless test covers both results but does not check the position after a fail.
- Headless tests passed for both pages. Left: try hand drawing, real keyboards, separate computers and several players on
  `minigame2.html`. There is no quiet-walk key.

### Where it stands
- Everything is on `main`, the only branch, and live on the GitHub Pages site. Every push updates the live table.
- Tests pass. Doors, minis, animations and effects were checked in a test copy with the database stubbed out.

### Left to do
- Try in the live app: dragging and moving long doors, the **Emote** menu, a GM attack, a companion attack roll (the GM
  page must be open), an HP drop, the HP boxes, **Size** and the octopus.
- Try a saved monster on a token. Monster looks were checked as test renders; their animations only for errors.
- Doors in the top-down view and glTF export from the creator are untested.
- Player spells cast without any roll show no effect.
- Older open items are in `TODO.md`.
