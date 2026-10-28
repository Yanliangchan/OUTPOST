# Building plan: 20 levels each (15 planned + 5 reserve), 10 at release

Every building is **designed and balanced to level 20**. Players can reach **level 10 at release**. Levels 11–15 are the planned post-release updates, and **16–20 are held in reserve** for later. Each step ships by raising one setting:

```ts
// src/config/release.ts
export const MAX_DESIGNED_LEVEL = 20;
export const PLANNED_MAX_LEVEL = 15;
export const RELEASE_MAX_LEVEL = 10;
```

## Rules
- **The HQ caps everything.** No building can be upgraded above the current HQ level.
- **Footprints never change.** An upgrade replaces the model on the same tiles, so it never needs re-placing (as in Clash of Clans).
- **Every level is a visible change.** Each level adds a recognisable silhouette or detail.
- **Five art bands:** Field (1–3) → Camp (4–6) → Base (7–10) → Command (11–15, post-release) → Strategic (16–20, reserve).
- **Stats live in data:** cost, Reputation, build time, HP and building-specific stats, defined per level in each building's file.

## Roster and build order

Buildings are completed **one at a time** through all 15 levels: art and stats, then review.

| # | Building | Footprint | Unlock (HQ) | Role | Status |
|---|---|---|---|---|---|
| 1 | **HQ** | 6×6 | — | Caps levels; unlocks buildings; gates land clearance | ✅ 20/20 designed |
| 2 | Bunk | 6×4 | 1 | Houses Recruits | concept Lv 1–3 |
| 3 | Cookhouse | 5×4 | 1 | Food → Morale and work speed | concept Lv 1–3 |
| 4 | QM Store | 4×4 | 1 | Stores Supplies; delivery trucks unload here | planned |
| 5 | Workshop | 4×4 | 2 | Produces Supplies; repairs | planned |
| 6 | Utilities | 3×3 | 2 | Power and water; buildings run better when supplied | planned |
| 7 | Mama Shop | 2×2 | 2 | Small Morale boost and a trickle of income | planned |
| 8 | Admin Office | 4×3 | 3 | Objectives and Reputation boosts | planned |
| 9 | Rec Centre | 4×4 | 3 | Morale | planned |
| 10 | Medical Centre | 4×3 | 4 | Recovery (and healing units, later) | planned |
| 11 | Motor Pool | 5×4 | 4 | Vehicles: faster deliveries | planned |
| 12 | Parade Square | 6×6 | 5 | Fall-in events; Cohesion | planned |
| 13 | Guardhouse | 3×2 | 6 | Entrance; first line of defence | planned |
| 14+ | Defences: Sentry Tower, Sandbag Wall, Mortar Pit, Searchlight, Artillery, Air Defence | various | 6–13 | Raids phase | planned |
| — | Special plots: Boat Jetty (Cove), Adventure Training Centre (Lakeside), Signal Station (Ridge) | 9×9 sites | 8–9 | Late-game landmarks | planned |

---

# HQ: full specification

The HQ is the heart of the outpost. Each level raises the cap for every other building, unlocks new buildings and land, and increases Supplies storage.

| Lv | Title | Supplies | Reputation | Build time | HP | Storage | Crews | Unlocks |
|---|---|---|---|---|---|---|---|---|
| 1 | Command Tent | 0 | 0 | instant | 1,200 | 2,000 | 2 | Bunk, Cookhouse, QM Store |
| 2 | Field Office | 1,000 | 0 | 5 min | 1,600 | 5,000 | 2 | Workshop, Utilities, Mama Shop, Clear jungle zones 1–2 |
| 3 | Admin Hut | 4,000 | 50 | 30 min | 2,100 | 10,000 | 2 | Admin Office, Rec Centre, 2nd Bunk, Clear zones 3–4 |
| 4 | Camp HQ | 12,000 | 150 | 2 h | 2,700 | 20,000 | 2 | Medical Centre, Motor Pool, 2nd QM Store, Clear zones 5–6 |
| 5 | Camp HQ · East Wing | 30,000 | 350 | 4 h | 3,400 | 35,000 | 3 | Parade Square, 3rd Bunk, 3rd construction crew, Clear zones 7–8 |
| 6 | Admin Block · Veranda | 60,000 | 600 | 8 h | 4,200 | 50,000 | 3 | Guardhouse, Sentry Tower, Sandbag Wall, Raids begin, Clear zones 9–10 |
| 7 | Admin Block · Courtyard | 120,000 | 1,000 | 12 h | 5,100 | 75,000 | 3 | Training Shed, 4th Bunk, Clear zones 11–12 |
| 8 | Headquarters | 220,000 | 1,500 | 1 d | 6,100 | 100,000 | 3 | Mortar Pit, 2nd Cookhouse, Boat Jetty (Cove), Adventure Training Centre (Lakeside) |
| 9 | Headquarters · Clock Tower | 400,000 | 2,200 | 1.5 d | 7,200 | 150,000 | 4 | Searchlight, Armoury, Signal Station (Ridge), 4th construction crew |
| 10 | HQ Complex | 700,000 | 3,000 | 2 d | 8,500 | 200,000 | 4 | Firing Range, 5th Bunk, All buildings to Lv 10 |
| 11 | Ops Block · Radar | 1,100,000 | 4,000 | 3 d | 10,000 | 275,000 | 4 | Artillery Emplacement, Buildings to Lv 11 |
| 12 | Command HQ · Atrium | 1,600,000 | 5,200 | 4 d | 11,600 | 350,000 | 4 | Buildings to Lv 12, 6th Bunk |
| 13 | Helipad Tower | 2,200,000 | 6,600 | 5 d | 13,400 | 450,000 | 5 | Air Defence, 5th construction crew, Buildings to Lv 13 |
| 14 | Command Centre · Twin Towers | 3,000,000 | 8,200 | 6 d | 15,400 | 575,000 | 5 | Buildings to Lv 14 |
| 15 | Command Centre · Landmark | 4,000,000 | 10,000 | 7 d | 17,500 | 700,000 | 5 | Buildings to Lv 15, Landmark status |
| 16 | Strategic HQ · Rotunda | 5,200,000 | 12,000 | 8 d | 19,800 | 850,000 | 5 | Buildings to Lv 16 |
| 17 | Strategic HQ · Skybridge | 6,600,000 | 14,500 | 9 d | 22,300 | 1,000,000 | 6 | Buildings to Lv 17, 6th construction crew |
| 18 | Strategic HQ · Control Tower | 8,200,000 | 17,000 | 10 d | 25,000 | 1,200,000 | 6 | Buildings to Lv 18 |
| 19 | Strategic HQ · Satellite Uplink | 10,000,000 | 20,000 | 11 d | 28,000 | 1,400,000 | 6 | Buildings to Lv 19 |
| 20 | Citadel · Gardens | 12,000,000 | 23,000 | 12 d | 31,000 | 1,600,000 | 7 | Buildings to Lv 20, 7th construction crew, Citadel status |
*Levels 11–15 are post-release; 16–20 are reserve.* "Crews" means construction crews (simultaneous builds). All numbers are first-pass balance and will be tuned against the economy in Phase 6.

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Command Tent:** canvas tent, field radio on a folding table, sandbag berms, crates, drums, field flag |
| 2 | **Field Office:** timber hut with a zinc roof and a veranda; radio mast, supplies piled up |
| 3 | **Admin Hut:** first permanent cream building; zinc gable roof, louvre windows, green porch, flagpole, "HQ" plaque, noticeboard |
| 4 | **Camp HQ:** simple single-storey rectangle; red-brown hip roof arrives; small porch |
| 5 | **Camp HQ · East Wing:** **L-shape**: a red-roofed east wing projects forward; gabled entrance bay; covered link-way; antenna |
| 6 | **Admin Block · Veranda:** first **two storeys**; full-width green veranda on columns; rooftop water tank |
| 7 | **Admin Block · Courtyard:** **U-shape**: two-storey wings either side; projecting gabled entrance with a balcony; courtyard with a central flagpole and hedges |
| 8 | **Headquarters:** three-storey main block with wings, grand porch, twin flagpoles |
| 9 | **Headquarters · Clock Tower:** four-storey clock tower with a dish and antenna |
| 10 | **HQ Complex:** five-storey tower, two-storey wings with red roofs, white columned portico with a pediment *(release cap)* |
| 11 | **Ops Block · Radar:** wide four-storey flat-roof block topped by a **giant white radar dome** on a drum; clock over a projecting entrance; low red-roofed pavilions either side |
| 12 | **Command HQ · Atrium:** **full-width two-storey glass atrium** with sun fins across the front; rooftop garden |
| 13 | **Helipad Tower:** **asymmetric**: four-storey red-roofed block and a **tall six-storey slab with a rooftop helipad** |
| 14 | **Command Centre · Twin Towers:** **twin six-storey towers** bridged by a glass block, with a **giant red-and-white lattice comms mast** between them |
| 15 | **Command Centre · Landmark:** **single eight-storey tower with a gold belvedere crown and spire** on a podium; red-roofed wings; fountain plaza and ceremonial arch |

| 16 | **Strategic HQ · Rotunda:** round colonnaded three-storey hall with a green dome; the crowned tower rises through it |
| 17 | **Skybridge:** two crowned nine-storey towers joined by glass sky-bridges above a podium |
| 18 | **Control Tower:** slender ten-storey shaft with a wide glass observation deck and radar, like an airport tower |
| 19 | **Satellite Uplink:** crowned tower beside a block carrying a huge satellite dish; lattice mast |
| 20 | **Citadel · Gardens:** stepped twelve-storey tower with green terraces at every setback, gold crown; "Supertree" sculptures on the plaza |

Review scene: open the game with `?showcase=hq`.
