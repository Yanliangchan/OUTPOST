# OUTPOST

A vibrant low-poly isometric town-builder about growing a small tropical outpost into a thriving camp community, with PvE defence and raids later on.

**Status:** Phase 0, a world prototype. See [`docs/PHASE0_DESIGN.md`](docs/PHASE0_DESIGN.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

## Controls (prototype)

| Input | Action |
|---|---|
| Drag | Pan |
| Scroll | Zoom toward the cursor |
| W A S D / arrows | Pan |
| Q / E | Rotate 90° |
| R | Reset camera |
| G | Toggle build grid (yellow = starter plot) |
| B | Toggle greybox scale markers |

## Tech

Three.js + TypeScript + Vite. All tunables live in `src/config/`.
