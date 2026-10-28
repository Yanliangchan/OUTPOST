# Land Clearance: design

The outpost begins as a **22×22 clearing in the jungle**. Everything else on the plateau is cleared zone by zone by a **contractor crew with machines**. This is the outpost's long-term expansion track.

## Land plan (long term)

| Land | Size | Tiles | When |
|---|---|---|---|
| Start clearing | 22×22 | 484 | Day 1 |
| Jungle zones (12) | 11×11 each | 1,452 | Through the whole mid game |
| Hidden sites: Cove, Lakeside, Ridge | 9×9 each | 243 | Late game, revealed by a surprise unlock |
| **Total on this island** | | **2,179** | |
| *Secondary island (option)* | — | — | *Only if late-game players run out of space* |

### Why 11×11 zones
I kept 12 zones of 11×11 rather than ~24 smaller ones:
- **Visible progress inside a zone.** Each zone clears **tile by tile in serpentine rows** over its timer, so progress shows continuously across the whole job instead of one pop at the end.
- **A meaningful choice.** Each zone is big enough to matter: the first one cleared roughly doubles usable land. Players choose which direction to grow.
- **Readable UI.** 12 zones stay easy to read in the Plan view.

## Pacing

Cost and time depend on **how many zones have been cleared already**, not on which zone. One crew means one job at a time.

| # | Time | Supplies | HQ |
|---|---|---|---|
| 1 | 2 h | 1,500 | 2 |
| 2 | 4 h | 4,000 | 2 |
| 3 | 8 h | 9,000 | 3 |
| 4 | 12 h | 16,000 | 3 |
| 5 | 16 h | 28,000 | 4 |
| 6 | 24 h | 45,000 | 4 |
| 7 | 30 h | 70,000 | 5 |
| 8 | 36 h | 100,000 | 5 |
| 9 | 2 d | 150,000 | 6 |
| 10 | 2.5 d | 200,000 | 6 |
| 11 | 3 d | 260,000 | 7 |
| 12 | 3.5 d | 330,000 | 7 |
| Cove | 4 d | 400,000 | 8 |
| Lakeside | 5 d | 500,000 | 8 |
| Ridge | 6 d | 650,000 | 9 |

That is about **12 days of crew time** for the jungle plus 15 days for the hidden sites, spread across the HQ levels. All values live in `src/clearance/pacing.ts`. Supplies and HQ requirements are shown but **not enforced until the economy exists (Phase 6)**.

## What the player sees (one tile at a time)

| Stage | When | What happens |
|---|---|---|
| 1. Felled | At the work front | Two chainsaw workers cut. The tree shivers and sheds sawdust, then tips over away from the crew. Leaves scatter and dust rises where it lands. |
| 2. Hauled | ~4 tiles behind | Logs are removed and the stump stays. Bushes, ferns and rocks are grubbed out. Raw brown dirt appears. |
| 3. Graded | ~1 row behind | The bulldozer makes push passes (blade down going forward, reversing back) and grinds stumps out. The dirt turns lighter. A worker with a rake follows the dozer. |
| 4. Regrown | After the job | Grass reclaims the bare ground patch by patch, over 20% of the job's duration. |

### The crew and machines (contractor yellow, distinct from olive camp vehicles)

**Machines**

- **Excavator:** tracked, with a swinging cab, boom, stick and grapple. It works the front from cleared ground.
- **Bulldozer:** push blade and rear ripper, grading behind the front.
- **Log truck:** white cab with an orange stripe. It shuttles between the haul front and the log pile, through the gate. Logs appear on the bed one by one as it loads and disappear as it unloads, and the **log pile** by the cabin grows with each trip.
- **All machines:** amber rotating beacons, exhaust smoke (more when moving), turning wheels and tracks.

**Workers** (hi-vis vests, hard hats)

- 2 chainsaw operators
- 1 flagman with a Stop/Go sign, which turns green when the truck passes the gate
- 1 supervisor (white hard hat, clipboard) who walks a loop: site office → excavator → log pile
- 1 labourer with a rake

**Site setup** (pops in at the start, packs up at the end)

- Striped barriers along the zone edge, with a gated gap and traffic cones
- A "Site Clearance" signboard
- A portacabin site office with an aircon unit
- A portable toilet, generator and floodlight mast
- A log pile on timber chocks

## Hidden sites
These never appear in the UI or the Plan view until revealed. The `?dev` URL flag shows them for development. Each has its own pacing entry. How the crew gets to them (by sea for the Cove, a track for the Ridge) will be designed with the unlock in Phase 6.

## Tech notes
- Progress is a pure function of **game time** (`startTime`, `duration`), so saving and catching up after the game is closed (Phase 8) needs no extra state.
- The **Preview speed** control (1×/60×/600×/3600×) exists to review long timers. It's a dev/review tool and will be hidden for players.
- Code: `src/clearance/` (system, job, pacing, site props), `src/vehicles/models.ts`, `src/agents/worker.ts`, `src/fx/particles.ts`.
