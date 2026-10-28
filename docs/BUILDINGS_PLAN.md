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
- **Height budget:** a building's bulk stays within about **4 storeys** so it never hides what's behind it; only thin elements (masts, flags, spires) go higher.
- **Theme by band, identity by building:** the band sets the shared theme (materials, colours, era). Each building keeps its own signature at every level: **HQ** has flags, clock, command tower and antennas; **Bunk** has rows of rooms, corridors or balconies and laundry; **Cookhouse** has chimneys or steam stacks, dining tables, umbrellas and canopies; **QM Store** has crates and pallets, a forklift and a loading dock or roller shutter; **Workshop** has workbenches, a vehicle on a lift or hoist, oil drums and welding sparks.
- **No shared concepts:** no two buildings use the same idea at the same level. Check with the compare view: open the game with `?showcase=11-15` or `?showcase=16-20` (all buildings side by side, one row per level).
- **Every step is an upgrade:** height rises level by level until it reaches the building's cap (**HQ 5 storeys, Bunk 4.5, Cookhouse 3.5, QM Store 3.5**), then holds while coverage and detail keep growing. Checked by measurement: open the browser console and run `__outpost.metrics()` to get the height, peak, coverage and detail of every level. A level fails if height drops by more than half a storey or presence (height × coverage) drops by more than 15%.
- **Every building is alive:** each has a signature "working" micro-animation at every level, like the Clash of Clans gold-mine cart (see the table below). Each building also gets a random timing offset so a base never moves in lockstep. Checked with `__outpost.animCheck()`, which counts moving parts per level; every level has at least one, on top of flags, blinking lights, steam and sparks.
- **Every level is a visible change.** Each level adds a recognisable silhouette or detail.
- **Five art bands:** Field (1–3) → Camp (4–6) → Base (7–10) → Command (11–15, post-release) → Secure (16–20, reserve).
- **Stats live in data:** cost, Reputation, build time, HP and building-specific stats, defined per level in each building's file.

## Micro-animations

| Building | Signature animation | Shared details |
|---|---|---|
| **HQ** | Flags wave; radar and satellite dishes sweep; clock hands turn; antenna and mast lights blink; windsock sways (field levels) | Aircon fans spin, chimney cowls turn |
| **Bunk** | Laundry and towels flap on lines, corridors and balconies; rooftop wind turbines spin | |
| **Cookhouse** | Pot lids rattle as they boil; ceiling fans spin; kitchen extractor fans whirr; steam and smoke rise | |
| **QM Store** | Forklift shuttles stock: drives in, raises its forks, reverses and lowers them; gantry hoist travels and drops its hook | |
| **Workshop** | Vehicle lift raises and lowers the jeep; the engine is winched on the hoist; overhead crane trolley travels; robot arms swing; turbines and roof vents spin; welding sparks | |
| **Utilities** | Generator fans spin and exhaust smokes; hand pump rocks; float gauge rises and falls; clarifier arm sweeps; flywheel turns; battery LEDs blink; energy-core rings spin | |
| **Secure band (16–20)** | Boom gate lifts to let vehicles in; CCTV cameras pan | |

## Roster and build order

Buildings are completed **one at a time** through all 15 levels: art and stats, then review.

| # | Building | Footprint | Unlock (HQ) | Role | Status |
|---|---|---|---|---|---|
| 1 | **HQ** | 6×6 | — | Caps levels; unlocks buildings; gates land clearance | ✅ 20/20 designed |
| 2 | **Bunk** | 6×4 | 1 | Houses Recruits | ✅ 20/20 designed |
| 3 | **Cookhouse** | 5×4 | 1 | Food → Morale and work speed | ✅ 20/20 designed |
| 4 | **QM Store** | 4×4 | 1 | Stores Supplies; delivery trucks unload here | ✅ 20/20 designed |
| 5 | **Workshop** | 4×4 | 2 | Produces Supplies; repairs | ✅ 20/20 designed |
| 6 | **Utilities** | 3×3 | 2 | Power and water; nearby buildings run faster | ✅ 20/20 designed |
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
| 16 | Secure Compound | 5,200,000 | 12,000 | 8 d | 19,800 | 850,000 | 5 | Buildings to Lv 16 |
| 17 | Operations Centre | 6,600,000 | 14,500 | 9 d | 22,300 | 1,000,000 | 6 | Buildings to Lv 17, 6th construction crew |
| 18 | Fortress Command | 8,200,000 | 17,000 | 10 d | 25,000 | 1,200,000 | 6 | Buildings to Lv 18 |
| 19 | Comms Hub | 10,000,000 | 20,000 | 11 d | 28,000 | 1,400,000 | 6 | Buildings to Lv 19 |
| 20 | Citadel | 12,000,000 | 23,000 | 12 d | 31,000 | 1,600,000 | 7 | Buildings to Lv 20, 7th construction crew, Citadel status |
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
| 8 | **Headquarters:** three-storey main block with wings, grand porch, twin flagpoles; **rooftop cupola with a flag** (a preview of the Lv 9 clock tower) |
| 9 | **Headquarters · Clock Tower:** four-storey clock tower with a dish and antenna |
| 10 | **HQ Complex:** five-storey tower, two-storey wings with red roofs, white columned portico with a pediment *(release cap)* |
| 11 | **Ops Block · Radar:** wide four-storey flat-roof block topped by a **giant white radar dome** on a drum; clock over a projecting entrance; low red-roofed pavilions either side |
| 12 | **Command HQ · Atrium:** **full-width two-storey glass atrium** with sun fins across the front; rooftop garden |
| 13 | **Helipad Tower:** asymmetric: three-storey red-roofed block and a **four-storey slab with a rooftop helipad** |
| 14 | **Command Centre · Twin Towers:** **twin four-storey towers** bridged by a three-storey glass block, with a red-and-white lattice comms mast between them |
| 15 | **Command Centre · Landmark:** **five-storey crowned tower** on a podium; red-roofed wings; fountain plaza and ceremonial arch |
| 16 | **Secure Compound:** the secure band begins. **Perimeter wall with mesh fence, gatehouse, boom gate, bollards and CCTV**; wide three-storey concrete block with dark ribbon windows, glass lobby, rooftop solar |
| 17 | **Operations Centre:** four-storey block with **vertical white fins** and a glass fifth storey cantilevered over the entrance, with a green roof |
| 18 | **Fortress Command:** earth-bermed two-storey concrete base with blast doors, and a three-storey glass command tower rising from the grass roof |
| 19 | **Comms Hub:** three-storey block with a **saw-tooth solar roof**; big satellite dish on a low terrace; short lattice mast |
| 20 | **Citadel:** low **courtyard ring** of three-storey ranges with **glass corner towers**, gold accent band, Supertree garden in the courtyard and a glass gate |

Review scene: open the game with `?showcase=hq`.

---

# Bunk: full specification

Houses Recruits. Higher levels house more of them and help them rest faster. Footprint **6×4**; height budget about 4 storeys.

| Lv | Title | Supplies | Reputation | Build time | HP | Capacity | Rest |
|---|---|---|---|---|---|---|---|
| 1 | Basha Lines | 200 | 0 | 1 min | 300 | 4 | 12%/h |
| 2 | Tent Lines | 600 | 0 | 5 min | 360 | 6 | 14%/h |
| 3 | Kampong Barrack | 1,500 | 25 | 20 min | 430 | 8 | 16%/h |
| 4 | Barrack | 4,000 | 100 | 1 h | 520 | 10 | 18%/h |
| 5 | Twin Barracks | 9,000 | 250 | 2 h | 620 | 12 | 20%/h |
| 6 | Bunk Block | 18,000 | 450 | 4 h | 750 | 14 | 22%/h |
| 7 | Bunk Block · Stair Tower | 35,000 | 800 | 6 h | 900 | 16 | 24%/h |
| 8 | Three-Storey Bunk | 60,000 | 1,200 | 10 h | 1,070 | 18 | 26%/h |
| 9 | Bunk · Void Deck | 100,000 | 1,800 | 16 h | 1,290 | 20 | 28%/h |
| 10 | Bunk Complex *(release cap)* | 170,000 | 2,500 | 1 d | 1,550 | 22 | 30%/h |
| 11 | Modern Bunk | 270,000 | 3,400 | 1.5 d | 1,860 | 24 | 32%/h |
| 12 | Bunk · Sky Garden | 400,000 | 4,500 | 2 d | 2,230 | 26 | 34%/h |
| 13 | Twin Block | 550,000 | 5,800 | 2.5 d | 2,670 | 28 | 36%/h |
| 14 | Terrace Bunk | 750,000 | 7,300 | 3 d | 3,210 | 30 | 38%/h |
| 15 | Residences | 1,000,000 | 9,000 | 3.5 d | 3,850 | 32 | 40%/h |
| 16 | Balcony Quarters | 1,300,000 | 10,800 | 4 d | 4,620 | 34 | 42%/h |
| 17 | Pod Quarters | 1,650,000 | 13,000 | 4.5 d | 5,550 | 36 | 44%/h |
| 18 | Garden Quarters | 2,050,000 | 15,500 | 5 d | 6,660 | 38 | 46%/h |
| 19 | Green-Wall Quarters | 2,500,000 | 18,300 | 5.5 d | 7,990 | 40 | 48%/h |
| 20 | Townhouse Citadel | 3,000,000 | 21,300 | 6 d | 9,580 | 42 | 50%/h |

*Levels 11–15 are post-release; 16–20 are reserve. Bunk level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Basha Lines:** olive tarp shelters on poles over sleeping mats, field packs, sandbags, crates |
| 2 | **Tent Lines:** two big canvas tents, washing line, water drums and cooler |
| 3 | **Kampong Barrack:** timber hut on stilts, zinc roof, wooden steps |
| 4 | **Barrack:** long cream barrack with a **red-brown hip roof** and a full-length green veranda |
| 5 | **Twin Barracks:** two parallel red-roofed barracks joined by covered link-ways |
| 6 | **Bunk Block:** first two storeys; front corridor with towels on the parapet; end stair |
| 7 | **Stair Tower:** two storeys plus a three-storey stair tower with a pyramid roof |
| 8 | **Three-Storey Bunk:** corridor block, three storeys, **long gable roof** with white gable ends, water tank |
| 9 | **Void Deck:** HDB-style open ground floor with benches; projecting gabled stair/lift core with a painted block number |
| 10 | **Bunk Complex:** void deck plus three room floors; stair towers at both ends; rooftop tanks |
| 11 | **Modern Bunk:** flat roof, white vertical fins, rooftop solar |
| 12 | **Sky Garden:** void deck plus three room floors, and a planted roof terrace with a low glass garden pavilion and pergola |
| 13 | **Twin Block:** two slim red-roofed blocks joined by glass sky-bridges |
| 14 | **Terrace Bunk:** stepped tiers with planted terraces |
| 15 | **Residences:** U-shape, red roofs, gold band, courtyard Supertree, entrance arch |
| 16 | **Balcony Quarters:** perimeter wall and gate; long three-storey block with recessed, colour-panelled balconies and laundry; solar roof |
| 17 | **Pod Quarters:** stacked modular pods with coloured doors, steel walkways |
| 18 | **Garden Quarters:** two slim four-storey slabs with planter boxes on every floor, joined by a tree-lined street with a pergola |
| 19 | **Green-Wall Quarters:** chequerboard of planted panels and windows across the facade; rooftop wind turbines |
| 20 | **Townhouse Citadel:** staggered row of four three- and four-storey townhouse units with coloured balconies, gold-trimmed roof terraces |

Review scene: open the game with `?showcase=bunk`.

---

# Cookhouse: full specification

Feeds the outpost. Well-fed Recruits work faster and Morale rises. Footprint **5×4**; height budget about 4 storeys.

| Lv | Title | Supplies | Reputation | Build time | HP | Seats | Meals/h | Morale |
|---|---|---|---|---|---|---|---|---|
| 1 | Field Kitchen | 150 | 0 | 1 min | 280 | 8 | 20 | +2 |
| 2 | Mess Tent | 500 | 0 | 5 min | 340 | 12 | 32 | +2 |
| 3 | Atap Canteen | 1,300 | 25 | 20 min | 400 | 16 | 44 | +3 |
| 4 | Cookhouse | 3,500 | 100 | 1 h | 480 | 20 | 56 | +3 |
| 5 | Cookhouse · Kitchen Wing | 8,000 | 250 | 2 h | 580 | 24 | 68 | +4 |
| 6 | Cookhouse · Clerestory | 16,000 | 450 | 4 h | 700 | 28 | 80 | +4 |
| 7 | Dining Hall · Veranda | 30,000 | 800 | 6 h | 840 | 32 | 92 | +5 |
| 8 | Food Court | 55,000 | 1,200 | 10 h | 1,000 | 36 | 104 | +5 |
| 9 | Dining Hall · Upper Deck | 90,000 | 1,800 | 16 h | 1,200 | 40 | 116 | +6 |
| 10 | Cookhouse Complex *(release cap)* | 150,000 | 2,500 | 1 d | 1,440 | 44 | 128 | +6 |
| 11 | Modern Dining Hall | 240,000 | 3,400 | 1.5 d | 1,730 | 48 | 140 | +7 |
| 12 | Rooftop Dining | 360,000 | 4,500 | 2 d | 2,080 | 52 | 152 | +7 |
| 13 | Central Kitchen | 500,000 | 5,800 | 2.5 d | 2,500 | 56 | 164 | +8 |
| 14 | Food Court Pavilion | 680,000 | 7,300 | 3 d | 3,000 | 60 | 176 | +8 |
| 15 | Grand Dining Hall | 900,000 | 9,000 | 3.5 d | 3,590 | 64 | 188 | +9 |
| 16 | Canopy Mess | 1,200,000 | 10,800 | 4 d | 4,310 | 68 | 200 | +9 |
| 17 | Ration Centre | 1,500,000 | 13,000 | 4.5 d | 5,180 | 72 | 212 | +10 |
| 18 | Hydroponic Kitchen | 1,850,000 | 15,500 | 5 d | 6,210 | 76 | 224 | +10 |
| 19 | Silo Kitchen | 2,250,000 | 18,300 | 5.5 d | 7,450 | 80 | 236 | +11 |
| 20 | Pavilion Citadel | 2,700,000 | 21,300 | 6 d | 8,950 | 84 | 248 | +11 |

*Levels 11–15 are post-release; 16–20 are reserve. Cookhouse level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Field Kitchen:** olive tarp fly over steaming pots, trestle tables, jerrycans |
| 2 | **Mess Tent:** big canvas tent plus a timber cook shed with a smoking chimney |
| 3 | **Atap Canteen:** open timber shelter with a zinc roof, long tables, kitchen shed |
| 4 | **Cookhouse:** first enclosed cream hall with louvre windows; kitchen block behind |
| 5 | **Kitchen Wing:** L-plan; kitchen wing projects forward with a loading dock; link-way |
| 6 | **Clerestory:** big hall with a raised clerestory roof; outdoor umbrellas |
| 7 | **Veranda:** hall wrapped in a deep columned veranda under one big hip roof |
| 8 | **Food Court:** hawker-centre pavilion: **two-tier teal roof** with a ventilation lantern, colourful stalls, round tables and stools, ceiling fans |
| 9 | **Upper Deck:** two-storey hall with a covered upper dining deck and umbrellas |
| 10 | **Cookhouse Complex:** food-court pavilion, two-storey central kitchen, cold room |
| 11 | **Modern Dining Hall:** glass hall under a V-shaped **butterfly roof** with a rain chain |
| 12 | **Rooftop Dining:** two storeys with a rooftop terrace and umbrellas |
| 13 | **Central Kitchen:** concrete ribbon block, tall stainless exhaust stacks, cold store |
| 14 | **Food Court Pavilion:** thin white canopy on slim columns, skylights, stalls |
| 15 | **Grand Dining Hall:** **barrel-vaulted** red roof with a gold band and white colonnade; pergola garden with string lights and tables |
| 16 | **Canopy Mess:** perimeter wall; compact kitchen with three steel exhaust stacks; huge cantilevered canopy over the dining tables |
| 17 | **Ration Centre:** stacked steel containers with a green canopy over tables |
| 18 | **Hydroponic Kitchen:** kitchen block beside three glass greenhouses growing greens |
| 19 | **Silo Kitchen:** three food silos feeding the kitchen by a conveyor bridge; dining canopy |
| 20 | **Pavilion Citadel:** **octagonal glass dining pavilion** with a gold ring and faceted red roof; kitchen with four stacks behind |

Review scene: open the game with `?showcase=cookhouse`.

---

# QM Store: full specification

Stores Supplies; delivery trucks unload here. **Signature at every level:** crates and pallets, a forklift, a loading dock or roller shutter. Footprint **4×4**.

| Lv | Title | Supplies | Reputation | Build time | HP | Capacity | Unload |
|---|---|---|---|---|---|---|---|
| 1 | Supply Dump | 100 | 0 | 1 min | 320 | 1,500 | 13/min |
| 2 | Container Store | 400 | 0 | 4 min | 380 | 2,000 | 16/min |
| 3 | Timber Godown | 1,100 | 20 | 15 min | 460 | 3,000 | 19/min |
| 4 | QM Store | 3,000 | 80 | 45 min | 550 | 4,000 | 22/min |
| 5 | Store · Steel Shed | 7,000 | 200 | 1.5 h | 660 | 5,500 | 25/min |
| 6 | Quonset Store | 14,000 | 400 | 3 h | 800 | 7,500 | 28/min |
| 7 | Store · Gantry Yard | 26,000 | 700 | 5 h | 960 | 10,500 | 31/min |
| 8 | Distribution Depot | 48,000 | 1,100 | 8 h | 1,150 | 14,500 | 34/min |
| 9 | High-Bay Store | 80,000 | 1,600 | 14 h | 1,380 | 19,500 | 37/min |
| 10 | Logistics Hub *(release cap)* | 135,000 | 2,300 | 20 h | 1,650 | 27,000 | 40/min |
| 11 | Automated Store | 210,000 | 3,100 | 1.25 d | 1,980 | 37,500 | 43/min |
| 12 | Drone Depot | 320,000 | 4,100 | 1.75 d | 2,380 | 52,000 | 46/min |
| 13 | Vertical Store | 450,000 | 5,300 | 2.25 d | 2,850 | 71,500 | 49/min |
| 14 | Wave-Roof Depot | 610,000 | 6,700 | 2.75 d | 3,420 | 98,500 | 52/min |
| 15 | Grand Goods Shed | 800,000 | 8,300 | 3.25 d | 4,110 | 136,500 | 55/min |
| 16 | Vault Store | 1,050,000 | 10,000 | 3.75 d | 4,930 | 188,000 | 58/min |
| 17 | Robotic Warehouse | 1,350,000 | 12,000 | 4.25 d | 5,920 | 259,500 | 61/min |
| 18 | Tensile Depot | 1,650,000 | 14,300 | 4.75 d | 7,100 | 358,000 | 64/min |
| 19 | Rail Depot | 2,000,000 | 16,900 | 5.25 d | 8,520 | 494,000 | 67/min |
| 20 | Dome Depot | 2,400,000 | 19,800 | 5.75 d | 10,220 | 682,000 | 70/min |

*Levels 11–15 are post-release; 16–20 are reserve. QM Store level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Supply Dump:** pallets of crates, drums and sacks under a camo net; sandbag walls |
| 2 | **Container Store:** olive shipping container with a zinc lean-to canopy over pallets |
| 3 | **Timber Godown:** plank shed with sliding barn doors, zinc roof, timber ramp |
| 4 | **QM Store:** cream store with a roller shutter, red gable roof, issue window with a counter, loading dock |
| 5 | **Steel Shed:** small store plus a tall open-sided steel shed with orange/blue pallet racking |
| 6 | **Quonset Store:** corrugated half-cylinder hut with ribs; shutter in the end wall |
| 7 | **Gantry Yard:** store beside a yellow gantry crane over stacked containers |
| 8 | **Distribution Depot:** long depot with three dock shutters under a canopy; zinc **monitor roof** with a louvred ridge strip |
| 9 | **High-Bay Store:** tall shed with a clerestory strip and a glass mezzanine office pod |
| 10 | **Logistics Hub:** high-bay store, cold store, covered dock and weighbridge |
| 11 | **Automated Store:** white high-bay with a giant yellow/black chevron band and a cantilevered glass control room |
| 12 | **Drone Depot:** flat roof with three yellow drone pads; a delivery drone hovering |
| 13 | **Vertical Store:** tall glass storage tower with colourful stacked stock and a yellow cap, beside a two-storey dock hall |
| 14 | **Wave-Roof Depot:** light glazed shed under big **teal and white wave roofs** |
| 15 | **Grand Goods Shed:** railway-style goods shed with three gabled arched doorways, gold band, 'QM DEPOT' plaque |
| 16 | **Vault Store:** concrete strongroom with a round vault door, hazard-stripe band, floodlights and a covered crate cage |
| 17 | **Robotic Warehouse:** glass walls reveal a colourful robot shelving grid; conveyor out to the dock |
| 18 | **Tensile Depot:** three peaked white fabric canopies over a pallet yard |
| 19 | **Rail Depot:** rail siding with a red freight wagon under a platform canopy, beside a **brick-red** goods shed |
| 20 | **Dome Depot:** geodesic storage dome with a gold ring and a glazed dock entrance |

Review scene: open the game with `?showcase=qmstore`.

---

# Workshop: full specification

Produces Supplies and repairs vehicles and equipment. **Signature at every level:** workbenches and tool racks, a vehicle on a lift or hoist, oil drums, welding sparks. Footprint **4×4**; unlocked at HQ 2.

| Lv | Title | Supplies | Reputation | Build time | HP | Output | Repair |
|---|---|---|---|---|---|---|---|
| 1 | Field Repair Point | 300 | 0 | 2 min | 300 | 60/h | +14% |
| 2 | Tool Shed | 900 | 0 | 8 min | 360 | 80/h | +18% |
| 3 | Lean-to Workshop | 2,000 | 30 | 25 min | 430 | 100/h | +22% |
| 4 | Twin-Bay Workshop | 4,500 | 100 | 1 h | 520 | 140/h | +26% |
| 5 | Workshop · Spray Booth | 9,500 | 250 | 2 h | 620 | 180/h | +30% |
| 6 | Sawtooth Workshop | 18,000 | 450 | 4 h | 750 | 240/h | +34% |
| 7 | Vehicle Bays | 32,000 | 800 | 6 h | 900 | 320/h | +38% |
| 8 | Machine Shop | 55,000 | 1,200 | 10 h | 1,070 | 420/h | +42% |
| 9 | Engineering Block | 90,000 | 1,800 | 16 h | 1,290 | 550/h | +46% |
| 10 | Workshop Complex *(release cap)* | 145,000 | 2,500 | 1 d | 1,550 | 730/h | +50% |
| 11 | CNC Workshop | 225,000 | 3,400 | 1.5 d | 1,860 | 960/h | +54% |
| 12 | Folded-Roof Fab Lab | 340,000 | 4,500 | 2 d | 2,230 | 1,270/h | +58% |
| 13 | Test Rig Yard | 480,000 | 5,800 | 2.5 d | 2,670 | 1,680/h | +62% |
| 14 | Cantilever Service Apron | 650,000 | 7,300 | 3 d | 3,210 | 2,220/h | +66% |
| 15 | Grand Engineering Hall | 860,000 | 9,000 | 3.5 d | 3,850 | 2,930/h | +70% |
| 16 | Blast-Door Workshop | 1,120,000 | 10,800 | 4 d | 4,620 | 3,860/h | +74% |
| 17 | Robot Assembly Hall | 1,420,000 | 13,000 | 4.5 d | 5,550 | 5,100/h | +78% |
| 18 | Energy Workshop | 1,750,000 | 15,500 | 5 d | 6,660 | 6,730/h | +82% |
| 19 | Ramp Test Workshop | 2,120,000 | 18,300 | 5.5 d | 7,990 | 8,880/h | +86% |
| 20 | Forge Citadel | 2,550,000 | 21,300 | 6 d | 9,580 | 11,720/h | +90% |

*Levels 11–15 are post-release; 16–20 are reserve. Workshop level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Field Repair Point:** A-frame chain hoist over an engine, workbench, drums, olive jeep; welding sparks |
| 2 | **Tool Shed:** timber shed with a zinc roof, outdoor anvil and welding station, gas bottles |
| 3 | **Lean-to Workshop:** single-slope zinc roof with a high open front over benches and a hoist |
| 4 | **Twin-Bay Workshop:** red-roofed building with two open bays; jeep on a two-post lift |
| 5 | **Spray Booth:** gabled workshop plus a tall white spray booth with an exhaust stack |
| 6 | **Sawtooth Workshop:** classic north-light **sawtooth factory roof** |
| 7 | **Vehicle Bays:** long three-bay shed with a tall red hip roof and an outdoor inspection ramp |
| 8 | **Machine Shop:** tall open-sided bay with a **yellow overhead travelling crane** and lathes |
| 9 | **Engineering Block:** two-storey office plus a tall workshop with spinning turbine vents |
| 10 | **Workshop Complex:** sawtooth bay, spray booth, parts store, jeep on a lift |
| 11 | **CNC Workshop:** solid hall with a long window strip onto CNC machines with green status lights, teal stripe |
| 12 | **Folded-Roof Fab Lab:** zig-zag **pleated teal and white roof** over a glazed fab lab |
| 13 | **Test Rig Yard:** workshop plus a red open-steel test tower and an engine test cell |
| 14 | **Cantilever Service Apron:** deep cantilevered roof over an outdoor apron with two lifts |
| 15 | **Grand Engineering Hall:** brick industrial hall with arched windows, gold band and a tall brick chimney |
| 16 | **Blast-Door Workshop:** concrete hall with three heavy doors in hazard-striped frames, roof vents |
| 17 | **Robot Assembly Hall:** full glass hall with two big yellow robot arms over an assembly line |
| 18 | **Energy Workshop:** battery packs, a small wind turbine and a solar canopy over the bays |
| 19 | **Ramp Test Workshop:** jeep cresting a raised yellow test ramp beside a three-storey workshop |
| 20 | **Forge Citadel:** hall with a glowing forge tower, glass gallery and gold accents |

Review scene: open the game with `?showcase=workshop`.

---

# Utilities: full specification

Power and water for the outpost; nearby buildings run faster when supplied. **Signature at every level:** a generator or electrical gear, water tanks, pipes and cables. Footprint **3×3**; unlocked at HQ 2.

| Lv | Title | Supplies | Reputation | Build time | HP | Power | Water | Boost radius |
|---|---|---|---|---|---|---|---|---|
| 1 | Field Genset | 250 | 0 | 2 min | 260 | 20 kW | 30 kL/day | 6 tiles |
| 2 | Water Point | 800 | 0 | 8 min | 310 | 25 kW | 40 kL/day | 6 tiles |
| 3 | Pump Hut | 1,800 | 30 | 25 min | 370 | 35 kW | 50 kL/day | 7 tiles |
| 4 | Generator Hut | 4,200 | 100 | 1 h | 450 | 45 kW | 65 kL/day | 7 tiles |
| 5 | Water Tower | 9,000 | 250 | 2 h | 540 | 55 kW | 85 kL/day | 8 tiles |
| 6 | Substation | 17,000 | 450 | 4 h | 650 | 75 kW | 110 kL/day | 8 tiles |
| 7 | Pump & Power House | 30,000 | 800 | 6 h | 780 | 95 kW | 145 kL/day | 9 tiles |
| 8 | Cooling Tower | 52,000 | 1,200 | 10 h | 930 | 125 kW | 190 kL/day | 9 tiles |
| 9 | Twin Tanks | 85,000 | 1,800 | 16 h | 1,120 | 165 kW | 245 kL/day | 10 tiles |
| 10 | Utilities Plant *(release cap)* | 140,000 | 2,500 | 1 d | 1,340 | 210 kW | 320 kL/day | 10 tiles |
| 11 | Solar Array | 215,000 | 3,400 | 1.5 d | 1,610 | 275 kW | 415 kL/day | 11 tiles |
| 12 | Water Treatment | 330,000 | 4,500 | 2 d | 1,930 | 360 kW | 540 kL/day | 11 tiles |
| 13 | Fuel Cell Block | 465,000 | 5,800 | 2.5 d | 2,320 | 465 kW | 700 kL/day | 12 tiles |
| 14 | Pipe Gallery | 630,000 | 7,300 | 3 d | 2,780 | 605 kW | 910 kL/day | 12 tiles |
| 15 | Mushroom Water Tower | 840,000 | 9,000 | 3.5 d | 3,340 | 785 kW | 1180 kL/day | 13 tiles |
| 16 | Secure Substation | 1,090,000 | 10,800 | 4 d | 4,010 | 1025 kW | 1535 kL/day | 13 tiles |
| 17 | Battery Bank | 1,390,000 | 13,000 | 4.5 d | 4,810 | 1330 kW | 1995 kL/day | 14 tiles |
| 18 | Desalination Unit | 1,720,000 | 15,500 | 5 d | 5,770 | 1730 kW | 2595 kL/day | 14 tiles |
| 19 | Rain Harvest Tower | 2,080,000 | 18,300 | 5.5 d | 6,920 | 2250 kW | 3375 kL/day | 15 tiles |
| 20 | Energy Core | 2,500,000 | 21,300 | 6 d | 8,310 | 2925 kW | 4385 kL/day | 15 tiles |

*Levels 11–15 are post-release; 16–20 are reserve. Utilities level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Field Genset:** portable generator with a spinning fan and exhaust, jerrycans, blue water bladder, cable reel |
| 2 | **Water Point:** raised water tank on a timber stand with a tap, genset, timber power pole |
| 3 | **Pump Hut:** timber pump hut, raised drum, **hand pump with a rocking handle** |
| 4 | **Generator Hut:** red-roofed hut with louvres and an exhaust stack, red fuel tank, transformer, overhead cable |
| 5 | **Water Tower:** steel-legged water tower with a **rising and falling float gauge**, pump room |
| 6 | **Substation:** fenced transformer yard with insulators and gantry, two-storey switch room |
| 7 | **Pump & Power House:** two-storey plant house, ground tank, blue and yellow pipes |
| 8 | **Cooling Tower:** curved concrete cooling tower **puffing steam**, cooling basin |
| 9 | **Twin Tanks:** two tall tanks with a catwalk and spiral stair, bund wall, pump with a turning flywheel |
| 10 | **Utilities Plant:** power house, water tower, pipe rack and transformer yard |
| 11 | **Solar Array:** big raised solar canopy over a battery container and control block |
| 12 | **Water Treatment:** round clarifier with a **rotating sweep arm**, three-storey filter block |
| 13 | **Fuel Cell Block:** stepped white fuel-cell modules with status lights, horizontal hydrogen tanks |
| 14 | **Pipe Gallery:** tall two-tier rack of colour-coded pipes looping to a pump hall |
| 15 | **Mushroom Water Tower:** landmark concrete mushroom tower with a gold ring and beacon |
| 16 | **Secure Substation:** perimeter; tall concrete transformer bunkers with lightning rods and hazard bands |
| 17 | **Battery Bank:** stacked teal battery containers with **blinking LED strips** |
| 18 | **Desalination Unit:** racks of white membrane tubes beside a tall seawater tank |
| 19 | **Rain Harvest Tower:** green-walled tank under an inverted funnel roof, rain chain dripping into a basin |
| 20 | **Energy Core:** glowing core in a glass drum with **three spinning gold rings** |

Review scene: open the game with `?showcase=utilities`.
