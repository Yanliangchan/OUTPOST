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
- **No shared concepts:** no two buildings use the same idea at the same level. Check with the compare view: open the game with `?showcase=11-15` or `?showcase=16-20` (all buildings side by side, one row per level); add `&only=admin,parade,…` to compare a subset.
- **Every step is an upgrade:** height rises level by level until it reaches the building's cap (**HQ 5 storeys, Bunk 4.5, Cookhouse 3.5, QM Store 3.5; the other buildings stay at or under 4, and the Parade Square stays mostly flat at about 2**), then holds while coverage and detail keep growing. Checked by measurement: open the browser console and run `__outpost.metrics()` to get the height, peak, coverage and detail of every level. A level fails if height drops by more than half a storey or presence (height × coverage) drops by more than 15%.
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
| **Mama Shop** | Awning fringe flaps; hanging snack packets sway; fridge light flickers; tri-vision billboard turns; bubble-tea cup spins; lanterns sway; vending lights blink; delivery drone lands | |
| **Admin Office** | Noticeboard papers flutter; red dispatch bike rides out and back with spinning wheels; mailbox flag flips up; photocopier scan light sweeps; ceiling and condenser fans spin; server LEDs blink; parcels ride the sorting conveyor; burn bin smokes; revolving door turns | |
| **Rec Centre** | Basketballs dribble and arc into hoops; takraw balls and shuttles volley over swaying nets; punching bags and ropes swing; climber, diver, runners and swimmers move; scoreboards and screens flicker; bowling balls roll and the giant pin wobbles; the wave pool rolls | |
| **Medical Centre** | Ambulance light bars flash blue/amber and ambulances pull out and back; cross signs and cross-cube beacons turn; IV drips and privacy curtains sway; heartbeat monitors pulse; ceiling fans spin; medevac rotors spin and the helicopter lifts off at Lv 14; scanner ring turns; field-hospital domes breathe; isolation vents spin; gold ring orbits the citadel cross | |
| **Motor Pool** | Vehicles pull out of their bays and reverse back in (wheels turning); boom barriers lift at dispatch huts; fuel hoses sway; wash-bay brushes spin with spray; tow-truck beacon flashes; camo net breathes; turntable rotates; blast doors slide; stacker lift rises; LED gantry flashes; pods circle the guideway; a jeep laps the rotunda | |
| **Parade Square** | Squads of Recruits march in step around the square (legs and arms swing, leader out front); drill instructor paces and points; flags raised, held and lowered; drummers beat; crowds bob and cheer | Bunting sways, sprinklers spray, scoreboard and mast lights blink, LED screens and grid floor cycle colours |
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
| 7 | **Mama Shop** | 2×2 | 2 | Morale and a trickle of Supplies | ✅ 20/20 designed |
| 8 | **Admin Office** | 4×3 | 3 | Objectives and Reputation boosts | ✅ 20/20 designed |
| 9 | **Rec Centre** | 4×4 | 3 | Morale | ✅ 20/20 designed |
| 10 | **Medical Centre** | 4×3 | 4 | Recovery (and healing units, later) | ✅ 20/20 designed |
| 11 | **Motor Pool** | 5×4 | 4 | Vehicles: faster deliveries | ✅ 20/20 designed |
| 12 | **Parade Square** | 6×6 | 5 | Fall-in events; Cohesion | ✅ 20/20 designed |
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

---

# Mama Shop: full specification

The neighbourhood provision shop: lifts Morale nearby and earns a trickle of Supplies. **Signature at every level:** a striped awning with a flapping fringe, shelves of colourful snacks, a drinks fridge with a flickering light. Footprint **2×2**; unlocked at HQ 2.

| Lv | Title | Supplies | Reputation | Build time | HP | Morale | Income |
|---|---|---|---|---|---|---|---|
| 1 | Tricycle Cart | 150 | 0 | 1 min | 200 | +1 | 15/h |
| 2 | Drinks Kiosk | 450 | 0 | 5 min | 240 | +1 | 20/h |
| 3 | Kedai Kayu | 1,000 | 25 | 15 min | 290 | +2 | 25/h |
| 4 | Mama Shop | 2,500 | 90 | 45 min | 350 | +2 | 35/h |
| 5 | Corner Shop | 5,500 | 220 | 1.5 h | 410 | +3 | 45/h |
| 6 | Shophouse | 11,000 | 400 | 3 h | 500 | +3 | 55/h |
| 7 | Mini-Mart | 20,000 | 700 | 5 h | 600 | +4 | 70/h |
| 8 | Billboard Shop | 36,000 | 1,100 | 8 h | 720 | +4 | 95/h |
| 9 | Twin Shophouses | 60,000 | 1,600 | 14 h | 860 | +5 | 120/h |
| 10 | Convenience Store *(release cap)* | 95,000 | 2,300 | 20 h | 1,030 | +5 | 160/h |
| 11 | Vending Pavilion | 150,000 | 3,100 | 1.25 d | 1,240 | +6 | 205/h |
| 12 | Bubble Tea Kiosk | 225,000 | 4,100 | 1.75 d | 1,490 | +6 | 270/h |
| 13 | Container Pop-up | 320,000 | 5,300 | 2.25 d | 1,780 | +7 | 350/h |
| 14 | Glass Cube Store | 440,000 | 6,700 | 2.75 d | 2,140 | +7 | 455/h |
| 15 | Heritage Shophouse | 590,000 | 8,300 | 3.25 d | 2,570 | +8 | 590/h |
| 16 | Armoured Kiosk | 770,000 | 10,000 | 3.75 d | 3,080 | +8 | 770/h |
| 17 | Locker Shop | 990,000 | 12,000 | 4.25 d | 3,700 | +9 | 1000/h |
| 18 | Garden Kiosk | 1,240,000 | 14,300 | 4.75 d | 4,440 | +9 | 1300/h |
| 19 | Drone Drop Kiosk | 1,520,000 | 16,900 | 5.25 d | 5,320 | +10 | 1685/h |
| 20 | Galleria | 1,850,000 | 19,800 | 5.75 d | 6,390 | +10 | 2195/h |

*Levels 11–15 are post-release; 16–20 are reserve. Mama Shop level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Tricycle Cart:** tricycle cart with a striped canopy, snacks, cooler box, plastic stools |
| 2 | **Drinks Kiosk:** tiny olive kiosk with a flip-up flap, fridge, drink crates, hanging snack packets |
| 3 | **Kedai Kayu:** timber shop with folding doors flung open, zinc roof, hanging snacks, 'KEDAI' sign |
| 4 | **Mama Shop:** cream shop with a rolled-up shutter, red-and-white awning, 'MAMA SHOP' fascia, fridge outside |
| 5 | **Corner Shop:** wrap-around teal awning, ice-cream freezer chest, newspaper rack |
| 6 | **Shophouse:** two-storey pastel shophouse with a **five-foot-way arcade** and green shuttered windows |
| 7 | **Mini-Mart:** tall store with a big shop window, blinking OPEN light, red 'MINI MART' fascia |
| 8 | **Billboard Shop:** two-storey shop with a rooftop **rotating tri-vision billboard** |
| 9 | **Twin Shophouses:** two narrow pastel shophouses with gable fronts, 'MAMA & SONS' |
| 10 | **Convenience Store:** three-storey 24/7 mart with a teal fascia, vending machines, ATM |
| 11 | **Vending Pavilion:** tall glass pavilion lined with colourful vending machines |
| 12 | **Bubble Tea Kiosk:** round kiosk with a giant **spinning bubble-tea cup** on the roof |
| 13 | **Container Pop-up:** three stacked shipping containers converted into a shop, rooftop deck |
| 14 | **Glass Cube Store:** glass box with visible shelves and a planted roof |
| 15 | **Heritage Shophouse:** three-storey ornate pastel shophouse, gold bands, **swaying red lanterns** |
| 16 | **Armoured Kiosk:** concrete kiosk with a steel service hatch, hazard band, bollards, CCTV |
| 17 | **Locker Shop:** wall of colourful parcel lockers with blinking lights, plus a service counter |
| 18 | **Garden Kiosk:** kiosk wrapped in a living wall with swaying hanging planters |
| 19 | **Drone Drop Kiosk:** three-storey kiosk with a rooftop pad and a **delivery drone** landing and taking off |
| 20 | **Galleria:** glass barrel-vault arcade with gold ribs and a gold entrance arch |

Review scene: open the game with `?showcase=mamashop`.

# Admin Office: full specification

The paperwork hub: runs objectives and boosts the Reputation the outpost earns. **Signature at every level:** a noticeboard with fluttering papers, grey filing cabinets, and the red dispatch bike that rides along the front apron. Footprint **4×3**; unlocked at HQ 3.

| Lv | Title | Supplies | Reputation | Build time | HP | Reputation boost | Objective slots |
|---|---|---|---|---|---|---|---|
| 1 | Orderly Tent | 400 | 0 | 2 min | 290 | +2% | 1 |
| 2 | Clerk's Hut | 1,000 | 0 | 8 min | 350 | +4% | 1 |
| 3 | Atap Pavilion | 2,200 | 30 | 25 min | 420 | +6% | 1 |
| 4 | Orderly Room | 4,800 | 100 | 1 h | 500 | +8% | 1 |
| 5 | Records Office | 9,800 | 250 | 2 h | 600 | +10% | 2 |
| 6 | Admin Block · Hoods | 18,500 | 450 | 4 h | 720 | +12% | 2 |
| 7 | Lantern Office | 33,000 | 800 | 6 h | 870 | +14% | 2 |
| 8 | Pay Office | 56,000 | 1,200 | 10 h | 1,040 | +16% | 2 |
| 9 | Registry | 92,000 | 1,800 | 16 h | 1,250 | +18% | 3 |
| 10 | Admin Complex *(release cap)* | 148,000 | 2,500 | 1 d | 1,500 | +20% | 3 |
| 11 | Paperless Office | 230,000 | 3,400 | 1.5 d | 1,800 | +22% | 3 |
| 12 | Records Tower | 345,000 | 4,500 | 2 d | 2,150 | +24% | 3 |
| 13 | Brise-Soleil Office | 485,000 | 5,800 | 2.5 d | 2,590 | +26% | 4 |
| 14 | Rotunda Office | 655,000 | 7,300 | 3 d | 3,100 | +28% | 4 |
| 15 | Grand Secretariat | 870,000 | 9,000 | 3.5 d | 3,720 | +30% | 4 |
| 16 | Secure Registry | 1,130,000 | 10,800 | 4 d | 4,470 | +32% | 4 |
| 17 | Data Vault | 1,430,000 | 13,000 | 4.5 d | 5,360 | +34% | 5 |
| 18 | Mail Sorting Centre | 1,760,000 | 15,500 | 5 d | 6,430 | +36% | 5 |
| 19 | Mesh-Screen Bureau | 2,130,000 | 18,300 | 5.5 d | 7,720 | +38% | 5 |
| 20 | Grand Bureau | 2,560,000 | 21,300 | 6 d | 9,260 | +40% | 5 |

*Levels 11–15 are post-release; 16–20 are reserve. Admin Office level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Orderly Tent:** canvas tent, field desk with a typewriter, easel noticeboard, ammo-box files, sandbags, mailbox |
| 2 | **Clerk's Hut:** timber hut with a zinc roof, outdoor noticeboard, filing cabinets, mailbox, bicycles |
| 3 | **Atap Pavilion:** raised timber deck under a deep thatch hip roof, open desks, filing cabinets, **ceiling fans** |
| 4 | **Orderly Room:** long cream block with a full-length green link-way sheltering two noticeboards |
| 5 | **Records Office:** office block plus a square two-storey records tower with a pyramid roof |
| 6 | **Admin Block · Hoods:** two storeys with a projecting glazed bay and concrete **eyebrow sun hoods** over every window |
| 7 | **Lantern Office:** two storeys with a raised roof lantern, single-storey mail-room annex with a photocopier |
| 8 | **Pay Office:** two-storey office with a pay-counter annex, green awning, queue rails and a 'paying' light |
| 9 | **Registry:** three-storey office beside a windowless archive wing with vent grilles and a rooftop condenser |
| 10 | **Admin Complex:** three-storey main block with eyebrow hoods, two-storey wing, porch drop-off, 'ADMIN' plaque |
| 11 | **Paperless Office:** three storeys with a glass front, server room of **blinking status LEDs**, rooftop plant screen |
| 12 | **Records Tower:** slim archive tower with a vertical window slot beside a three-storey office |
| 13 | **Brise-Soleil Office:** three storeys wrapped in angled horizontal sun louvres, roof garden |
| 14 | **Rotunda Office:** three-storey drum with a conical red roof joined to a flat-roofed wing |
| 15 | **Grand Secretariat:** white arched arcade under three storeys with pilasters, gold band, red hip roof |
| 16 | **Secure Registry:** perimeter; concrete block with slot windows, hazard band, steel canopy, **smoking burn bin** |
| 17 | **Data Vault:** perimeter; banded concrete vault with glowing skylights and a strip of blinking server LEDs |
| 18 | **Mail Sorting Centre:** perimeter; open sorting hall with **parcels riding a conveyor**, red-trimmed offices above |
| 19 | **Mesh-Screen Bureau:** perimeter; block behind a perforated metal screen with a gradient hole pattern, green roof |
| 20 | **Grand Bureau:** perimeter; glass office raised on white pilotis, gold fascias, lobby with a **revolving door** |

Review scene: open the game with `?showcase=admin`.

# Rec Centre: full specification

Where recruits blow off steam: lifts Morale across the base and hosts a number of Recruits at a time. **Signature at every level:** sport and leisure kit in play, such as courts with hoops and nets, balls in motion, gym gear, pools and stands. It never shows food counters or shop shelves. Footprint **4×4**; unlocked at HQ 3.

| Lv | Title | Supplies | Reputation | Build time | HP | Morale | Capacity |
|---|---|---|---|---|---|---|---|
| 1 | Fitness Corner | 300 | 0 | 2 min | 280 | +2 | 6 |
| 2 | Half-Court | 900 | 20 | 8 min | 340 | +2 | 9 |
| 3 | Games Shed | 2,100 | 60 | 25 min | 400 | +3 | 12 |
| 4 | Takraw Court | 4,800 | 120 | 1 h | 480 | +3 | 15 |
| 5 | Gym Hut | 10,000 | 260 | 2 h | 580 | +4 | 18 |
| 6 | Covered Court | 19,000 | 460 | 4 h | 700 | +5 | 21 |
| 7 | Rec Hall | 34,000 | 800 | 6 h | 840 | +5 | 24 |
| 8 | Sports Pavilion | 58,000 | 1,200 | 10 h | 1,000 | +6 | 27 |
| 9 | Gym & Pool | 95,000 | 1,800 | 16 h | 1,200 | +6 | 30 |
| 10 | Rec Centre Complex *(release cap)* | 150,000 | 2,500 | 1 d | 1,440 | +7 | 33 |
| 11 | Climbing Wall Hall | 230,000 | 3,400 | 1.5 d | 1,730 | +8 | 36 |
| 12 | Rooftop Futsal | 345,000 | 4,500 | 2 d | 2,080 | +8 | 39 |
| 13 | Aquatic Centre | 485,000 | 5,800 | 2.5 d | 2,500 | +9 | 42 |
| 14 | E-Sports Arena | 655,000 | 7,300 | 3 d | 3,000 | +9 | 45 |
| 15 | Stadium Bowl | 870,000 | 9,000 | 3.5 d | 3,590 | +10 | 48 |
| 16 | Obstacle Course | 1,130,000 | 10,800 | 4 d | 4,310 | +11 | 51 |
| 17 | Sky Track | 1,430,000 | 13,000 | 4.5 d | 5,180 | +11 | 54 |
| 18 | Bowling Lanes | 1,770,000 | 15,500 | 5 d | 6,210 | +12 | 57 |
| 19 | Wave Pool Hall | 2,150,000 | 18,300 | 5.5 d | 7,450 | +12 | 60 |
| 20 | Arena Citadel | 2,580,000 | 21,300 | 6 d | 8,950 | +13 | 63 |

*Levels 11–15 are post-release; 16–20 are reserve. Rec Centre level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Fitness Corner:** sand pit with pull-up bars, a **swinging punching bag**, a recruit kicking a takraw ball, timber shade shelter |
| 2 | **Half-Court:** red half-court with a hoop and a **dribbling, shooting basketball**, fitness bars, timber changing hut, two players bouncing on court |
| 3 | **Games Shed:** zinc-roofed timber shed with ping-pong and carrom tables, a spinning fan, and a hoop outside |
| 4 | **Takraw Court:** green court with a **takraw ball volleying over a swaying net**, long hip-roofed pavilion, low stand |
| 5 | **Gym Hut:** hut with weights and a punching bag, side court with a hoop, linkway, small stand |
| 6 | **Covered Court:** full court under a **curved green roof**, two hoops, players |
| 7 | **Rec Hall:** two-storey hall with a TV screen and fan; badminton court with a **shuttle rally** |
| 8 | **Sports Pavilion:** clubhouse under a **roofed five-row grandstand**, court with hoops, flickering scoreboard |
| 9 | **Gym & Pool:** two-storey gym, lap pool with a **swimmer doing laps**, umbrellas, shade pavilion |
| 10 | **Rec Centre Complex:** sports hall with a clerestory and gable roof, plaque, side pool, fitness corner |
| 11 | **Climbing Wall Hall:** three-storey hall with a coloured-hold **climbing wall and a climber**, court |
| 12 | **Rooftop Futsal:** three-storey block topped by a **netted futsal cage** with a moving ball |
| 13 | **Aquatic Centre:** open-sided hall under a wavy white roof, teal band, diving tower with an **animated diver** |
| 14 | **E-Sports Arena:** dark box with neon bands, **colour-cycling screens**, and a rotating logo cube on the roof, spinning roof vents, fans queuing excitedly at the door |
| 15 | **Stadium Bowl:** four roofed stands around a pitch, gold band, floodlights, scoreboard |
| 16 | **Obstacle Course:** rope-climb tower, vault wall, monkey bars, **swinging rope**, tyres, a runner |
| 17 | **Sky Track:** three-storey block with a **rooftop running track and a runner** |
| 18 | **Bowling Lanes:** purple-banded hall with **rolling balls** and a giant **wobbling pin** on the roof |
| 19 | **Wave Pool Hall:** glass barrel-vault hall over a **rolling wave pool**, yellow slide |
| 20 | **Arena Citadel:** ribbed arena drum with a gold ring roof, dome, **floating gold ring**, screen, floodlights |

Review scene: open the game with `?showcase=reccentre`.

# Medical Centre: full specification

Recovery for the outpost: beds for injured troops and a faster heal rate. **Signature at every level:** a green medical cross sign (white cross on a green square; never the protected red cross), an ambulance, stretcher or medevac helicopter, and a white-and-green clinical look. Footprint **4×3**; unlocked at HQ 4.

| Lv | Title | Supplies | Reputation | Build time | HP | Beds | Heal rate |
|---|---|---|---|---|---|---|---|
| 1 | Aid Post | 400 | 0 | 3 min | 280 | 2 | 14%/h |
| 2 | Field Clinic | 1,100 | 20 | 10 min | 340 | 4 | 18%/h |
| 3 | Sick Bay Hut | 2,400 | 60 | 30 min | 400 | 6 | 22%/h |
| 4 | Medical Centre | 5,500 | 150 | 1.25 h | 480 | 8 | 26%/h |
| 5 | Clinic · Ward Wing | 11,000 | 300 | 2.5 h | 580 | 10 | 30%/h |
| 6 | Clinic · Veranda Ward | 20,000 | 500 | 4.5 h | 700 | 12 | 34%/h |
| 7 | Polyclinic | 35,000 | 850 | 7 h | 840 | 14 | 38%/h |
| 8 | Ward Block | 58,000 | 1,250 | 11 h | 1,000 | 16 | 42%/h |
| 9 | Medevac Clinic | 95,000 | 1,850 | 17 h | 1,200 | 18 | 46%/h |
| 10 | Medical Complex *(release cap)* | 150,000 | 2,550 | 1 d | 1,440 | 20 | 50%/h |
| 11 | Modern Clinic | 230,000 | 3,450 | 1.5 d | 1,730 | 22 | 54%/h |
| 12 | Rehab Centre | 345,000 | 4,550 | 2 d | 2,080 | 24 | 58%/h |
| 13 | Imaging Centre | 485,000 | 5,850 | 2.5 d | 2,500 | 26 | 62%/h |
| 14 | Raised Medevac Pad | 655,000 | 7,350 | 3 d | 3,000 | 28 | 66%/h |
| 15 | Grand Hospital | 870,000 | 9,050 | 3.5 d | 3,590 | 30 | 70%/h |
| 16 | Secure Med Bunker | 1,130,000 | 10,850 | 4 d | 4,310 | 32 | 74%/h |
| 17 | Field Hospital Domes | 1,430,000 | 13,050 | 4.5 d | 5,180 | 34 | 78%/h |
| 18 | Isolation Wards | 1,770,000 | 15,550 | 5 d | 6,210 | 36 | 82%/h |
| 19 | Bio-Lab | 2,150,000 | 18,350 | 5.5 d | 7,450 | 38 | 86%/h |
| 20 | Medical Citadel | 2,600,000 | 21,350 | 6 d | 8,950 | 40 | 90%/h |

*Levels 11–15 are post-release; 16–20 are reserve. Medical Centre level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Aid Post:** olive canvas tent with a green cross flag, stretcher on trestles with a **swinging IV bag**, first-aid crates |
| 2 | **Field Clinic:** long ward tent with a cross on the roof, olive field ambulance with **flashing light bar**, triage table |
| 3 | **Sick Bay Hut:** timber hut on stilts with a corrugated roof, **turning cross sign on a pole**, ramp and stretcher |
| 4 | **Medical Centre:** white clinic with a green band and red hipped roof, green entrance canopy, wall cross, ambulance bay |
| 5 | **Clinic · Ward Wing:** L-shaped clinic with a ward wing, beds behind windows, ambulance **pulling out and back** |
| 6 | **Clinic · Veranda Ward:** two-storey ward with a long green veranda, **ceiling fans spinning**, beds on the veranda |
| 7 | **Polyclinic:** flat-roofed two-storey block, green glass entrance canopy, EMERGENCY fascia, ambulance |
| 8 | **Ward Block:** three-storey ward block with balconies, **swaying privacy curtains**, heartbeat monitor |
| 9 | **Medevac Clinic:** three-storey clinic with a two-storey wing, rooftop green helipad with blinking corners and a **medevac helicopter, rotors spinning**, windsock |
| 10 | **Medical Complex:** main ward block plus emergency wing with a drive-through canopy, **rotating cross-cube beacon**, two ambulances |
| 11 | **Modern Clinic:** long white modern block with dark glass bands, rooftop cross cube, ambulance bay |
| 12 | **Rehab Centre:** four-storey ward tower with a glass hydrotherapy pavilion and garden benches |
| 13 | **Imaging Centre:** ward block with a transparent glass rotunda; inside, a **scanner ring turns and the bed slides through** |
| 14 | **Raised Medevac Pad:** ward tower beside a helipad on steel legs; the **helicopter lifts off and lands**, ramp down to the ambulance |
| 15 | **Grand Hospital:** central block with two red-roofed wings, porte-cochère, cross beacon, ambulances |
| 16 | **Secure Med Bunker:** concrete bunker with a mint decon annex, jersey barriers, olive armoured ambulance, secure perimeter |
| 17 | **Field Hospital Domes:** two **breathing** inflatable domes off a concrete core, generator container, perimeter |
| 18 | **Isolation Wards:** sealed block with glass isolation pods, **spinning extract vents**, perimeter |
| 19 | **Bio-Lab:** tall clean lab with steel process tanks, airlock tunnel, perimeter |
| 20 | **Medical Citadel:** three-storey white tower crowned by a cross cube with an **orbiting gold ring**, green glass ward drum with gold floor bands, gold link bridge, ambulance and stretcher |

Review scene: open the game with `?showcase=medical`.

# Motor Pool: full specification

The camp's vehicles: parking and dispatch, not repair. More vehicles and faster dispatch speed up deliveries and transport. **Signature at every level:** olive camp vehicles parked in painted bays under carports, a fuel point, a wash bay, and a dispatch hut with a boom-barrier checkpoint; one vehicle always pulls out and reverses back in. Footprint **5×4**; unlocked at HQ 4.

| Lv | Title | Supplies | Reputation | Build time | HP | Vehicles | Delivery speed |
|---|---|---|---|---|---|---|---|
| 1 | Vehicle Laager | 350 | 0 | 3 min | 340 | 1 | +9% |
| 2 | Canvas Carport | 1,000 | 0 | 10 min | 410 | 1 | +13% |
| 3 | Timber Vehicle Shed | 2,200 | 30 | 30 min | 490 | 2 | +17% |
| 4 | MT Line | 5,000 | 110 | 1.25 h | 590 | 3 | +21% |
| 5 | MT Line · Fuel Point | 10,000 | 260 | 2.5 h | 710 | 4 | +25% |
| 6 | MT Line · Wash Bay | 19,000 | 470 | 4.5 h | 850 | 4 | +29% |
| 7 | Arched Vehicle Shelter | 34,000 | 820 | 7 h | 1,020 | 5 | +33% |
| 8 | Dispatch Office | 58,000 | 1,250 | 11 h | 1,220 | 6 | +37% |
| 9 | Fuel Depot | 95,000 | 1,850 | 17 h | 1,460 | 7 | +41% |
| 10 | Motor Pool Complex *(release cap)* | 150,000 | 2,550 | 1.1 d | 1,750 | 7 | +45% |
| 11 | Two-Deck Car Park | 235,000 | 3,450 | 1.6 d | 2,110 | 8 | +49% |
| 12 | Cantilever Dispatch Hub | 350,000 | 4,550 | 2.1 d | 2,530 | 9 | +53% |
| 13 | Turntable Depot | 495,000 | 5,850 | 2.6 d | 3,030 | 10 | +57% |
| 14 | EV Charging Depot | 670,000 | 7,350 | 3.1 d | 3,640 | 10 | +61% |
| 15 | Motor Rotunda | 880,000 | 9,050 | 3.6 d | 4,370 | 11 | +65% |
| 16 | Blast-Door Hangar | 1,140,000 | 10,850 | 4.1 d | 5,240 | 12 | +69% |
| 17 | Vehicle Stacker | 1,450,000 | 13,050 | 4.6 d | 6,290 | 13 | +73% |
| 18 | Convoy Marshalling Yard | 1,790,000 | 15,550 | 5.1 d | 7,540 | 13 | +77% |
| 19 | Autonomous Pod Depot | 2,170,000 | 18,350 | 5.6 d | 9,050 | 14 | +81% |
| 20 | Motor Citadel | 2,600,000 | 21,350 | 6.1 d | 10,860 | 15 | +85% |

*Levels 11–15 are post-release; 16–20 are reserve. Motor Pool level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Vehicle Laager:** two jeeps under a **breathing camo net**, tyre tracks, jerrycans, sandbags, windsock |
| 2 | **Canvas Carport:** canvas carport over three jeeps, fuel drums with a **rocking hand pump**, tyre stack |
| 3 | **Timber Vehicle Shed:** timber shed with a zinc gable roof, a 3-tonner and a jeep, 'MT' sign |
| 4 | **MT Line:** four painted bays under a long green hip-roofed carport, dispatch hut with a **lifting boom barrier** |
| 5 | **MT Line · Fuel Point:** carport row plus a red-and-white fuel canopy with a pump and a parked bowser |
| 6 | **MT Line · Wash Bay:** carport row, fuel pump and a wash bay with **spinning brushes and spray** |
| 7 | **Arched Vehicle Shelter:** ribbed green arched shelter over four bays, a tow truck, a raised dispatch tower with a beacon |
| 8 | **Dispatch Office:** two-storey dispatch office with a balcony and antenna, long carport, tow truck on standby |
| 9 | **Fuel Depot:** bunded white fuel tank, tall red double fuel island, bowser doing the rounds |
| 10 | **Motor Pool Complex:** two-storey MT office, carport row, wash bay, fuel island, checkpoint, 'MOTOR POOL' sign |
| 11 | **Two-Deck Car Park:** concrete deck with vehicles on top and in the bays below, yellow-railed ramp, deck lamps |
| 12 | **Cantilever Dispatch Hub:** glass dispatch office and a deep white cantilevered canopy with blinking downlights, a camp bus |
| 13 | **Turntable Depot:** three-storey garage block with shutters behind a **rotating vehicle turntable** |
| 14 | **EV Charging Depot:** green-roofed canopy over charging bollards with **pulsing green lights**, electric shuttle and pod |
| 15 | **Motor Rotunda:** round garage with radial bays, a central dispatch drum, a gold band, and **a jeep lapping the ring** |
| 16 | **Blast-Door Hangar:** concrete hangar with **sliding hazard-striped blast doors**, red warning beacon, secure fence |
| 17 | **Vehicle Stacker:** three-tier steel stacker beside a yellow **lift that raises a jeep**, glass kiosk |
| 18 | **Convoy Marshalling Yard:** lined-up convoy under a skylit canopy, **flashing LED gantry sign**, lighting masts, glass control tower |
| 19 | **Autonomous Pod Depot:** green-roofed white station and **pods gliding round a looped guideway** around a beacon pylon |
| 20 | **Motor Citadel:** three-deck garage with a gold band and green roof beside a spiral-ramp tower |

Review scene: open the game with `?showcase=motorpool`.

# Parade Square: full specification

The camp's fall-in ground: hosts Fall-in ceremonies and builds Cohesion, which lifts Morale camp-wide. **Signature at every level:** a painted parade ground with rank lines and file markers, a rostrum, and flagpoles in plain camp colours, with squads of Recruits marching in formation around it. Footprint **6×6**; unlocked at HQ 5.

| Lv | Title | Supplies | Reputation | Build time | HP | Cohesion | Fall-in |
|---|---|---|---|---|---|---|---|
| 1 | Rope Square | 4,500 | 150 | 1 h | 450 | +3 | 12 |
| 2 | Laterite Square | 9,000 | 250 | 2 h | 540 | +5 | 20 |
| 3 | Drill Square | 15,000 | 400 | 3 h | 650 | +7 | 28 |
| 4 | Parade Square | 24,000 | 600 | 5 h | 780 | +9 | 36 |
| 5 | Square · Spectator Stand | 36,000 | 850 | 7 h | 930 | +11 | 44 |
| 6 | Square · Bandstand | 52,000 | 1,150 | 10 h | 1,120 | +13 | 52 |
| 7 | Asphalt Parade Ground | 75,000 | 1,500 | 14 h | 1,340 | +15 | 60 |
| 8 | Ceremonial Gate | 105,000 | 1,900 | 18 h | 1,610 | +17 | 68 |
| 9 | Grandstand Square | 145,000 | 2,350 | 22 h | 1,930 | +19 | 76 |
| 10 | Parade Ground *(release cap)* | 200,000 | 2,850 | 1.25 d | 2,320 | +21 | 84 |
| 11 | Shell Rostrum | 270,000 | 3,500 | 1.5 d | 2,790 | +23 | 92 |
| 12 | Garden Parade | 360,000 | 4,400 | 2 d | 3,340 | +25 | 100 |
| 13 | Floodlit Parade | 470,000 | 5,500 | 2.5 d | 4,010 | +27 | 108 |
| 14 | Amphitheatre Square | 610,000 | 6,800 | 3 d | 4,810 | +29 | 116 |
| 15 | Grand Parade | 790,000 | 8,300 | 3.5 d | 5,780 | +31 | 124 |
| 16 | Secure Square | 1,010,000 | 10,000 | 4 d | 6,930 | +33 | 132 |
| 17 | Smart Grid Square | 1,280,000 | 12,000 | 4.5 d | 8,320 | +35 | 140 |
| 18 | Berm Amphitheatre | 1,600,000 | 14,300 | 5 d | 9,980 | +37 | 148 |
| 19 | Solar Stands | 1,980,000 | 16,900 | 5.5 d | 11,980 | +39 | 156 |
| 20 | Parade Citadel | 2,420,000 | 19,800 | 6 d | 14,380 | +41 | 164 |

*Levels 11–15 are post-release; 16–20 are reserve. Parade Square level is capped by HQ level.*

## Visual progression

| Lv | Look |
|---|---|
| 1 | **Rope Square:** roped-off grass patch on pegs, tree-stump rostrum, bamboo flagpole, one squad drilling |
| 2 | **Laterite Square:** orange laterite square edged with whitewashed stones, timber dais, two flagpoles |
| 3 | **Drill Square:** whitewashed rank lines on laterite, timber rostrum under a zinc lean-to, benches, drill instructor |
| 4 | **Parade Square:** concrete square with yellow ranks and file markers, concrete rostrum with a green canopy, lamps |
| 5 | **Square · Spectator Stand:** adds a **covered spectator stand** with a cheering crowd along the left side |
| 6 | **Square · Bandstand:** adds a **bandstand with drummers** and bunting strung between the flagpoles |
| 7 | **Asphalt Parade Ground:** dark asphalt ground, two **rustic zinc lean-to stands** on timber purlins, zinc-roofed rostrum, **ceremonial flag raising** |
| 8 | **Ceremonial Gate:** **gateway arch** on the right edge, a colonnade along the back, green-roofed stand, gold-trimmed dais and a **red carpet** from gate to dais |
| 9 | **Grandstand Square:** **two-tier red-roofed grandstand** with a cantilever roof, an open bleacher on the side, and a blinking scoreboard |
| 10 | **Parade Ground:** maroon ceremonial border, grandstand, gold VIP dais, arch, obelisk and two squads marching |
| 11 | **Shell Rostrum:** white **acoustic shell** over the dais, modern stands under white canopies, LED screen |
| 12 | **Garden Parade:** lawn borders with **sprinklers**, planted terraces, green-roofed stands |
| 13 | **Floodlit Parade:** navy floodlit court with yellow lines, four **floodlight masts**, big LED screen, **steel cantilever stands** with a yellow fascia and underslung lights |
| 14 | **Amphitheatre Square:** stands curved round the back corner in a stepped **quarter-ring amphitheatre** |
| 15 | **Grand Parade:** gold-trimmed U of colonnades, glass reviewing pavilion, memorial obelisk, saluting officer |
| 16 | **Secure Square:** secure perimeter, concrete stands under steel canopies, guarded dais with a blast screen |
| 17 | **Smart Grid Square:** **LED grid floor** whose tiles light up in waves under the squads, glass review box |
| 18 | **Berm Amphitheatre:** grassy **terraced berms** as seating, glass reviewing pavilion on a green roof |
| 19 | **Solar Stands:** stands roofed with **solar canopies**, scoreboard, light masts |
| 20 | **Parade Citadel:** gold-trimmed colonnaded ring of stands, glass corner pavilions, obelisk |

Review scene: open the game with `?showcase=parade`.
