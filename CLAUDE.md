# CLAUDE.md — MarblePerso

## Project Overview

**Marble Sorter** is a browser-based puzzle game built with vanilla JavaScript and HTML5 Canvas. Players tap boxes on a grid to release colored marbles, which fall through a funnel onto a conveyor belt and must be sorted into matching columns. The game features 12 built-in levels, a full level editor, and multiple box mechanics (ice, hidden, blocker, pack, tunnels, rockets, walls).

## Prototyping New Mechanics

This project is set up as a **team prototyping tool**. Anyone can describe a new game mechanic to Claude Code and have it implemented on an isolated branch with a playable preview URL.

### Quick Start

Use the slash command: `/new-mechanic <describe your mechanic idea>`

Example: `/new-mechanic a magnet box that attracts nearby marbles when opened`

Claude will handle branching, implementation, testing, and deployment automatically.

### Branch Rules

- **NEVER commit directly to `main`**. Always create a feature branch.
- Branch naming: `mechanic/<short-name>` (e.g., `mechanic/magnet-box`, `mechanic/gravity-well`)
- One mechanic per branch. Keep changes isolated.
- When done, push and open a PR. Do not merge without review.

### Preview URLs

Each `mechanic/*` branch is automatically deployed to:
`https://quintusonus.github.io/MarblePerso/preview/<mechanic-name>/`

After pushing, wait ~1 minute for the GitHub Action to deploy. Share this URL with the team for feedback.

### Two-Tier Mechanic Classification

**Tier 1 — Registry Box Types** (simpler, no core file changes):
New visual/behavioral variants of boxes that use `registerBoxType()`. Only needs:
- A new `js/box_<name>.js` file
- A `<script>` tag in `index.html` (after `box_pack.js`, before `calibration.js`)
- Implementation of the 4 required methods: `drawClosed`, `drawReveal`, `editorCellStyle`, `editorCellHTML`
- See `js/box_template.js.example` for a documented starting skeleton
- Examples: `box_default.js`, `box_hidden.js`, `box_ice.js`, `box_blocker.js`, `box_pack.js`

**Tier 2 — Core Mechanics** (complex, requires core file changes):
Mechanics that introduce new entities with their own physics, rendering, and editor UI. Requires:
- A new `js/<mechanic>.js` file
- Changes to `game.js` (level parsing in `startLevel`, update loop, win condition in `checkWin`)
- Changes to `rendering.js` (new draw function called from `draw()`)
- Changes to `editor.js` (new mode, panel, placement logic)
- Possibly changes to `physics.js` (if interacting with marble physics)
- A `<script>` tag in `index.html` (after `physics.js`, before `rendering.js`)
- Study `js/rocket.js` as the canonical Tier 2 example — search for `rocket` in `game.js`, `rendering.js`, and `editor.js` to see all integration points
- Examples: tunnels (`tunnel.js`), walls (`wall.js`), rockets (`rocket.js`)

### Step-by-Step Checklist (for Claude)

When implementing a new mechanic, follow these steps in order:

1. **Branch**: `git checkout -b mechanic/<name> main`
2. **Classify**: Determine if this is Tier 1 or Tier 2 (see above)
3. **Implement**:
   - Tier 1: Copy pattern from `js/box_default.js`, reference `js/box_template.js.example`
   - Tier 2: List ALL files that need changes before writing any code
4. **Script tag**: Add `<script src="js/box_<name>.js"></script>` in `index.html` at the correct position
5. **Test level**: Create a JSON level that exercises the new mechanic (see Level Data Format below)
6. **Commit**: Descriptive commit message explaining the mechanic
7. **Push & PR**: Push branch, open a PR including:
   - Description of what the mechanic does
   - The test level JSON (so reviewers can paste it into Import Level)
   - Preview URL: `https://quintusonus.github.io/MarblePerso/preview/<mechanic-name>/`

### What NOT To Do

- Do not introduce npm, build tools, TypeScript, or ES modules
- Do not rename or reorganize existing files
- Do not modify the registry pattern in `registry.js`
- Do not modify other box type files (e.g., don't change `box_ice.js` when adding a new type)
- Do not change the script load order unless adding a new file at the correct position

---

## Architecture

### Tech Stack
- **No build tools, no frameworks, no bundler** — pure vanilla JS + HTML5 Canvas
- Single `index.html` with inline CSS, loads JS files via `<script>` tags
- All game state lives in global variables (no modules/imports)
- Script load order matters (defined in `index.html` lines 268–286)

### File Structure

```
index.html              — HTML shell, all CSS, UI overlays (level select, editor, win screen, calibration panel)
js/
  config.js             — Global constants, colors, level definitions, shared state arrays
  registry.js           — Box type plugin registry (BoxTypes, registerBoxType, getBoxType)
  box_default.js        — Standard colored box type
  box_hidden.js         — Mystery "?" box (color unknown until opened)
  box_ice.js            — Frozen box (HP 2→1→0, damaged by adjacent empties)
  box_blocker.js        — Contains regular + gray blocker marbles
  box_pack.js           — Contains 9 marbles across 3 colors
  calibration.js        — UI calibration sliders for layout tuning
  audio.js              — Web Audio API synth tones and SFX
  particles.js          — Burst, confetti, and trail particle effects
  layout.js             — Computes all layout metrics (L object) from window size + calibration
  belt.js               — Conveyor belt path (Bezier), 30 slots, movement logic
  physics.js            — Marble physics: gravity, collision, funnel walls (3 substeps/frame)
  tunnel.js             — Tunnel mechanic: stores boxes, spawns when exit is free
  wall.js               — Inert structural wall blocks
  rocket.js             — Rocket mechanic: 2-cell rockets with trigger, projectiles, chain reactions
  rendering.js          — All canvas drawing (stock grid, funnel, belt, sort area, marbles, UI)
  editor.js             — Full level editor UI and logic
  game.js               — Main game loop, level loading, state machine, win detection
```

### Script Load Order (required)
```
config → registry → box_default → box_hidden → box_ice → box_blocker → box_pack →
calibration → audio → particles → layout → belt → physics → tunnel → wall → rocket →
rendering → editor → game
```

## Key Patterns

### Box Type Registry
Box types are registered as plugins via `registerBoxType(id, definition)` in `registry.js`. Each type must implement:
- `label` — display name
- `editorColor` — toolbar button color
- `drawClosed(ctx, x, y, w, h, ci, S, tick, idlePhase, stockItem)` — locked state rendering
- `drawReveal(ctx, x, y, w, h, ci, S, phase, remaining, tick, stockItem)` — opening animation
- `editorCellStyle(ci, gridItem)` — returns `{background, borderColor}`
- `editorCellHTML(ci, gridItem)` — returns inner HTML for editor cell

Current types: `default`, `hidden`, `ice`, `blocker`, `pack`

### Global State (all in config.js)
- `stock[]` — 49 grid cells (7x7), the main game board
- `physMarbles[]` — marbles in physics simulation (falling through funnel)
- `beltSlots[]` — 30 conveyor belt slots
- `sortCols[]` — 4 sort columns (stacks of target boxes)
- `jumpers[]` — marbles animating from belt to sort area
- `particles[]` — active visual effects
- `L` — computed layout metrics (set by `computeLayout()`)
- `cal` — calibration offsets/scales
- `S` — global scale factor (`H / 850`)
- `tick` — global frame counter
- `gameActive`, `won` — game state flags

### Marble Colors
8 colors indexed 0–7 (pink, blue, green, yellow, purple, orange, teal, crimson), each with `fill`, `light`, `dark`, `glow` properties. Blocker marbles use index 8 (gray, not in `NUM_COLORS`).

### Animation Conventions
- `*T` suffix = animation progress (0→1): `popT`, `revealT`, `shakeT`, `hoverT`, `emptyT`, `rocketLaunchT`
- Phase values typically 0–1, used with easing (`Math.sin(phase * Math.PI)`)
- `tick` used for continuous animations (sparkle, shimmer, glow cycles)

### Naming Conventions
- `b`, `s` — box/stock item
- `m` — marble (physics)
- `c`, `r` — column, row
- `ci` — color index
- `idx` — array index
- `draw*` — rendering functions
- `*Step` — simulation functions
- `spawn*` — creation functions
- `is*` — boolean checks
- `compute*` — calculation functions

## Game Flow

```
Boot → resize() → showHomeScreen()
  │
  ├─ Home Screen: "Level Editor" or "Import Level"
  │   ├─ Level Editor → create/edit → Test Play → startLevel(idx)
  │   └─ Import Level → paste JSON → playImportedLevel(lvl)
  │
  ├─ Gameplay: requestAnimationFrame(frame) loop
  │   update(): physicsStep → trySpawnFromTunnels → updateRockets →
  │             belt→sort matching → jumper animation → blocker collection →
  │             stock animations → particle updates → checkWin
  │   draw():  background → funnel → stock grid → physics marbles →
  │            rockets → belt → blocker progress → jumpers → sort area →
  │            back button → particles
  │
  └─ Win: all sort boxes cleared ∧ no tunnel contents ∧ all rockets launched
         → win screen → replayLevel() or showHomeScreen()
```

## Level Data Format

Levels are created via the editor or imported as JSON. Each level has: `name`, `desc`, `mrbPerBox`, `sortCap`, and a `grid` array of 49 cells. Each cell is either `null` (empty) or an object:
- `{ci, type}` — standard box (type: 'default', 'hidden', 'ice', 'blocker', 'pack')
- `{tunnel: true, dir, contents[]}` — tunnel entry point
- `{wall: true}` — wall block
- `{rocket: true, rocketId, rocketDir, rocketRole, underCi, underType}` — rocket part

## Development

### Running Locally
Open `index.html` in a browser. No build step required. Use any HTTP server for local development:
```bash
python3 -m http.server 8000
# or
npx serve .
```

### Adding a New Box Type
1. Create `js/box_yourtype.js`
2. Call `registerBoxType('yourtype', { ... })` implementing the required interface
3. Add `<script src="js/box_yourtype.js"></script>` in `index.html` after `registry.js` and before `calibration.js`
4. Update editor.js if the type needs special editor UI panels

### Key Mechanics to Understand
- **Ice boxes**: HP system, damaged by adjacent empty cells — check `box_ice.js` and ice-related logic in `game.js`
- **Tunnels**: Store queued boxes, auto-spawn when exit tile is free — see `tunnel.js`
- **Rockets**: 2-cell entities (back + front), fire when trigger cell becomes empty, support chain reactions — see `rocket.js`
- **Blockers**: Gray marbles (ci=8) that must all be collected from the belt for win condition — see `box_blocker.js` and blocker logic in `game.js`
- **Packs**: Single box containing 9 marbles in 3 colors — see `box_pack.js`

### Code Size
~4000 lines of JS total. Largest files: `editor.js` (973), `game.js` (659), `rendering.js` (505), `rocket.js` (348).

## Guidelines for AI Assistants

- **No modules/bundlers** — all code uses global scope. New globals are fine; don't try to convert to ES modules.
- **Script order matters** — if adding a new file, place it correctly in the `<script>` chain in `index.html`.
- **Canvas-based rendering** — all visuals are drawn procedurally on a 2D canvas. There is no DOM-based game UI.
- **Respect the registry pattern** — new box types should use `registerBoxType()`, not modify existing type files.
- **Layout is dynamic** — all positions derive from `computeLayout()` using `S` (scale) and `cal` (calibration). Never hardcode pixel positions.
- **Animation phases** — follow the `*T` convention (0→1 progress) for new animations.
- **Keep it vanilla** — no npm packages, no TypeScript, no frameworks. This is intentionally simple.
- **Test in browser** — there are no automated tests. Verify changes by opening `index.html` and playing.
- **No built-in levels** — all levels are created in the editor or imported as JSON. There is no level selector or progression system.
