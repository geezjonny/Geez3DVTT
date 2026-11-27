# Progress

## 2026-11-27

### Done
- **Doors:** a drag makes one long door; iron draws as iron; every door type and door material has its own 3D look.
  Bars are now a swinging gate (only the portcullis lifts).
- **Token minis (optional):** Blockfolk heroes from `blockfolk.html`, set per token by the GM. Pictures stay the default.
- **Animations:** walk while moving, attack on a hit, flinch on HP loss.
- **Attack effects:** slash for weapons, flash for spells and cantrips, small camera shake.
- **Emotes:** speech bubbles on any token; poses for minis, including sit and sleep until the token moves.
- Castle scene saved in `scene/` as "Battle at Castle Alaris": more props, and minis on 7 tokens.

### Where it stands
- Everything is on `main`, the only branch, and live on the GitHub Pages site. Every push updates the live table.
- Tests pass. Doors, minis, animations and effects were checked in a test copy with the database stubbed out.

### Left to do
- Try in the live app: dragging and moving long doors, the **Emote** menu, a GM attack, a companion attack roll (the GM
  page must be open), an HP drop.
- Doors in the top-down view and glTF export from the creator are untested.
- Player spells cast without any roll show no effect.
- Older open items are in `TODO.md`.
