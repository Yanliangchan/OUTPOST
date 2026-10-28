import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, ribbonBlock, supertree } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Cookhouse: feeds the outpost. Seats and meal output grow with level; good
 * food lifts Morale. Footprint 5×4; height budget ~4 storeys.
 *   Field (1–3) → Camp (4–6) → Base (7–10, release cap) → Command (11–15) → Secure (16–20, reserve)
 */

const TITLES = [
  'Field Kitchen', 'Mess Tent', 'Atap Canteen', 'Cookhouse', 'Cookhouse · Kitchen Wing', 'Cookhouse · Clerestory',
  'Dining Hall · Veranda', 'Food Court', 'Dining Hall · Upper Deck', 'Cookhouse Complex', 'Modern Dining Hall',
  'Rooftop Dining', 'Central Kitchen', 'Food Court Pavilion', 'Grand Dining Hall', 'Secure Mess', 'Ration Centre',
  'Bermed Kitchen', 'Solar Kitchen', 'Mess Citadel',
];
const SUPPLIES = [150, 500, 1_300, 3_500, 8_000, 16_000, 30_000, 55_000, 90_000, 150_000, 240_000, 360_000, 500_000, 680_000, 900_000, 1_200_000, 1_500_000, 1_850_000, 2_250_000, 2_700_000];
const REPUTATION = [0, 0, 25, 100, 250, 450, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [1 * MIN, 5 * MIN, 20 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const COOKHOUSE_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const seats = 8 + i * 4;
  const meals = 20 + i * 12;
  const morale = 2 + Math.floor(i / 2);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((280 * Math.pow(1.2, i)) / 10) * 10,
    stats: { seats, mealsPerHour: meals, morale },
    unlocks: [`${seats} seats`, `${meals} meals/h`, `+${morale} Morale when fed`],
  };
});

// ------------------------------------------------------------------ props

const STALL_COLORS = ['#e94f37', '#2bb3a3', '#ffc93c', '#5d8aa3', '#ff8a3d', '#8a5cb8'];

/** Burner with a big steaming pot. */
function pot(k: Kit, x: number, z: number, y: number) {
  k.box(0.3, 0.26, 0.3, '#5c6166', x, y, z);
  k.cyl(0.13, 0.18, '#c9ced2', x, y + 0.26, z, 10);
  k.emitters.push({ pos: new THREE.Vector3(x, y + 0.5, z), kind: 'steam' });
}

function umbrella(k: Kit, x: number, z: number, y: number, color: string) {
  k.cyl(0.025, 0.7, C.metal, x, y, z, 5);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.22, 8), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  top.position.set(x, y + 0.8, z);
  k.add(top);
  k.cyl(0.26, 0.03, '#e9e4d6', x, y + 0.26, z, 10);
  k.cyl(0.04, 0.26, C.metal, x, y, z, 5);
}

/** Round hawker table with four stools. */
function roundTable(k: Kit, x: number, z: number, y: number) {
  k.cyl(0.04, 0.26, C.metal, x, y, z, 5);
  k.cyl(0.22, 0.03, '#e9e4d6', x, y + 0.26, z, 10);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    k.cyl(0.07, 0.15, STALL_COLORS[i % 3], x + Math.cos(a) * 0.33, y, z + Math.sin(a) * 0.33, 8);
  }
}

/** Hawker stall: counter, back wall, coloured signboard. */
function stall(k: Kit, x: number, z: number, y: number, color: string, w = 0.9) {
  k.box(w, 0.32, 0.35, '#e9e4d6', x, y, z + 0.15);
  k.box(w, 0.8, 0.05, '#cfc9bc', x, y, z - 0.08);
  k.box(w, 0.22, 0.06, color, x, y + 0.8, z + 0.1);
  k.box(0.2, 0.12, 0.14, '#c9ced2', x - w / 4, y + 0.32, z);
  k.emitters.push({ pos: new THREE.Vector3(x - w / 4, y + 0.5, z), kind: 'steam' });
}

function ceilingFan(k: Kit, x: number, y: number, z: number) {
  k.cyl(0.015, 0.15, C.dark, x, y - 0.15, z, 4);
  k.box(0.5, 0.01, 0.06, '#f4f4f0', x, y - 0.17, z);
  k.box(0.06, 0.01, 0.5, '#f4f4f0', x, y - 0.17, z);
}

/** Open-sided pavilion on columns with a hip roof (hawker centre / canteen). */
function pavilionRoof(k: Kit, w: number, d: number, x: number, z: number, y: number, h = 0.95, roof: string = C.roof, cols = 4) {
  for (let i = 0; i < cols; i++) {
    const cx = x - w / 2 + 0.08 + (i * (w - 0.16)) / (cols - 1);
    for (const cz of [z - d / 2 + 0.08, z + d / 2 - 0.08]) k.box(0.1, h, 0.1, C.white, cx, y, cz);
  }
  k.box(w + 0.1, 0.06, d + 0.1, C.trim, x, y + h, z);
  k.hipRoof(w, d, 0.5, x, y + h + 0.06, z, roof);
  return h;
}

/** Enclosed dining hall: cream walls, louvre windows, double doors; returns wall height. */
function hall(k: Kit, w: number, d: number, x: number, z: number, y: number, storeys = 1) {
  const h = k.block(w, d, storeys, x, y, z);
  for (let f = 0; f < storeys; f++) {
    k.windowRow('front', x, z, w, d, Math.max(3, Math.round(w / 0.7)), y + f * STOREY + 0.45, { louvre: true, skip: f === 0 ? [Math.floor(Math.max(3, Math.round(w / 0.7)) / 2)] : [] });
    k.windowRow('left', x, z, w, d, 2, y + f * STOREY + 0.45, { louvre: true });
    k.windowRow('right', x, z, w, d, 2, y + f * STOREY + 0.45, { louvre: true });
  }
  for (const dx of [-0.22, 0.22]) k.door('front', x, z, w, d, dx, y, 0.42, 0.66);
  return h;
}

/** Back-of-house kitchen block with chimneys and a roller shutter. */
function kitchen(k: Kit, w: number, d: number, x: number, z: number, y: number, storeys = 1, stacks = 2) {
  const h = k.block(w, d, storeys, x, y, z, C.wallAlt);
  k.flatRoof(w, d, x, y + h, z);
  for (let i = 0; i < stacks; i++) k.chimney(x - w / 2 + 0.35 + i * 0.7, y + h, z - 0.1, 0.5, i % 2 ? 'smoke' : 'steam');
  k.shutter('right', x, z, w, d, 0, Math.min(0.6, d - 0.2), 0.62);
  return h;
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Tarp fly over field stoves
    for (const [x, z] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 0.2], [1.6, 0.2]]) k.box(0.05, 0.85, 0.05, C.wood, x, y, z);
    k.gableRoof(3.3, 1.7, 0.4, 0, y + 0.85, -0.6, '#5b6b3a', 0.08, '#5b6b3a', false);
    for (const x of [-0.9, -0.3, 0.3]) pot(k, x, -1.05, y);
    k.box(1.0, 0.28, 0.4, C.wood, 1.0, y, -1.05);
    k.diningTable(-0.6, 1.2, 1.1, y);
    k.diningTable(0.9, 1.2, 1.1, y);
    for (const x of [1.95, 2.15]) k.box(0.14, 0.3, 0.1, '#5b6b3a', x, y, -1.6); // jerrycans
    k.crates(-2.1, -1.5, y, 3);
    return;
  }
  if (level === 2) {
    k.tent(3.0, 1.6, -0.4, 0.15, y, '#b9a878');
    // Cook shed lean-to with a chimney
    k.box(1.4, 0.7, 0.8, C.wood, 1.5, y, -1.45);
    k.box(1.6, 0.05, 1.0, C.zinc, 1.5, y + 0.75, -1.45);
    k.chimney(1.9, y + 0.8, -1.6, 0.45, 'smoke');
    pot(k, 1.1, -0.85, y);
    k.waterPoint(-2.1, -1.5, y);
    k.drum(2.2, 1.4, '#2f6fa8', y);
    k.bin(-2.2, 1.6, y);
    return;
  }
  // 3: atap canteen: open timber shelter with long tables, kitchen shed behind
  const sz = 0.35;
  for (const x of [-1.75, -0.6, 0.6, 1.75]) for (const z of [-0.85, 0.85]) k.box(0.08, 0.85, 0.08, C.wood, x, y, sz + z);
  k.gableRoof(3.6, 1.8, 0.45, 0, y + 0.85, sz, C.zinc, 0.18, C.wood);
  for (const z of [-0.3, 0.4]) for (const x of [-0.85, 0.85]) k.diningTable(x, sz + z, 1.2, y);
  const h = k.block(2.4, 0.85, 1, -0.5, y, -1.38, C.wood);
  k.gableRoof(2.4, 0.85, 0.3, -0.5, y + h, -1.38, C.zinc, 0.15, C.wood);
  k.chimney(-1.2, y + h, -1.38, 0.55, 'steam');
  k.gasCylinders(1.55, -1.4, 3, y);
  k.waterPoint(-2.05, 1.5, y);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    hall(k, 3.8, 1.9, 0, 0.3, y);
    k.gableRoof(3.8, 1.9, 0.55, 0, y + STOREY, 0.3);
    kitchen(k, 2.8, 0.85, -0.3, -1.1, y);
    k.gasCylinders(1.9, -1.35, 3, y);
    k.waterPoint(-2.05, 1.7, y);
    k.bench(1.2, 1.65, 0.9, y);
    return;
  }
  if (level === 5) {
    // L-plan: hall left, kitchen wing projecting forward on the right with a loading bay.
    hall(k, 2.9, 2.0, -0.95, -0.5, y);
    k.gableRoof(2.9, 2.0, 0.55, -0.95, y + STOREY, -0.5);
    const kh = k.block(1.3, 3.2, 1, 1.75, y, 0.0, C.wallAlt);
    k.hipRoof(1.3, 3.2, 0.45, 1.75, y + kh, 0.0);
    k.chimney(1.75, y + kh + 0.2, -0.9, 0.5, 'steam');
    k.chimney(1.75, y + kh + 0.2, 0.3, 0.4, 'smoke');
    k.shutter('front', 1.75, 0.0, 1.3, 3.2, 0, 0.8, 0.66);
    k.box(1.3, 0.25, 0.4, CONCRETE, 1.75, y, 1.8); // loading dock
    k.linkway(-1.6, 1.2, 0.9, 1.2, y, 0.7, 0.55);
    k.gasCylinders(-2.0, -1.75, 3, y);
    return;
  }
  // 6: big hall with a raised clerestory and outdoor umbrellas
  hall(k, 4.3, 2.1, 0, 0.15, y);
  k.box(4.3, 0.15, 2.1, C.wall, 0, y + STOREY, 0.15);
  const h = STOREY + 0.15;
  k.gableRoof(4.3, 2.1, 0.55, 0, y + h, 0.15);
  k.box(2.8, 0.3, 0.7, C.wall, 0, y + h + 0.32, 0.15);
  k.windowRow('front', 0, 0.15, 2.8, 0.7, 6, y + h + 0.4, { ww: 0.3, wh: 0.16, louvre: true, span: 2.4 });
  k.gableRoof(2.8, 0.7, 0.25, 0, y + h + 0.62, 0.15);
  kitchen(k, 3.4, 0.7, -0.3, -1.5, y, 1, 2);
  umbrella(k, -1.7, 1.6, y, PALETTE.accentOrange);
  umbrella(k, 1.7, 1.6, y, PALETTE.accentTeal);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Hall wrapped in a veranda on three sides
    hall(k, 3.2, 1.6, 0, 0.1, y);
    const vw = 4.4, vd = 2.6, vz = 0.35;
    for (let i = 0; i < 6; i++) {
      const x = -vw / 2 + 0.06 + (i * (vw - 0.12)) / 5;
      k.box(0.08, 0.9, 0.08, C.white, x, y, vz + vd / 2 - 0.06);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.box(0.08, 0.9, 0.08, C.white, s * (vw / 2 - 0.06), y, vz - vd / 2 + 0.5 + i * 0.8);
    k.box(vw, 0.04, vd, '#c9c3b5', 0, y, vz);
    k.hipRoof(vw, vd, 0.6, 0, y + 0.92, vz);
    kitchen(k, 3.6, 0.75, 0, -1.55, y, 1, 3);
    k.lamp(-2.3, 1.75, y);
    return;
  }
  if (level === 8) {
    // Hawker-style food court: two-tier teal roof with a raised ventilation lantern
    const HAWKER = '#2f8f83';
    const ph = pavilionRoof(k, 4.6, 2.9, 0, 0.2, y, 1.0, HAWKER, 5);
    for (const [x, z] of [[-1.0, -0.2], [1.0, -0.2], [-1.0, 0.6], [1.0, 0.6]]) k.box(0.06, 0.45, 0.06, C.white, x, y + ph + 0.35, z);
    k.box(2.3, 0.05, 1.1, C.trim, 0, y + ph + 0.8, 0.2);
    k.hipRoof(2.2, 1.0, 0.35, 0, y + ph + 0.85, 0.2, HAWKER);
    k.box(2.2, 0.3, 0.04, '#ffc93c', 0, y + 0.72, 1.66); // signboard band along the front
    STALL_COLORS.slice(0, 4).forEach((c, i) => stall(k, -1.65 + i * 1.1, -0.85, y, c));
    for (const x of [-1.5, 0, 1.5]) for (const z of [0.35, 1.2]) roundTable(k, x, z, y);
    for (const x of [-1.2, 1.2]) ceilingFan(k, x, y + 1.0, 0.6);
    k.gasCylinders(-2.0, -1.75, 3, y);
    k.bin(2.2, -1.7, y);
    return;
  }
  if (level === 9) {
    // Two-storey dining hall with an upper deck and umbrellas
    hall(k, 3.6, 1.7, 0, -0.4, y, 2);
    k.hipRoof(3.6, 1.7, 0.55, 0, y + 2 * STOREY, -0.4);
    const dz = 0.85;
    k.box(3.6, 0.08, 0.8, '#cfc9bc', 0, y + STOREY - 0.08, dz);
    for (let i = 0; i < 5; i++) k.box(0.08, STOREY - 0.08, 0.08, C.white, -1.75 + i * 0.875, y, dz + 0.36);
    k.box(3.6, 0.28, 0.04, C.white, 0, y + STOREY, dz + 0.38);
    umbrella(k, -0.9, dz, y + STOREY, PALETTE.accentOrange);
    umbrella(k, 0.9, dz, y + STOREY, PALETTE.accentTeal);
    kitchen(k, 1.0, 1.7, 2.1, -0.4, y, 2, 2);
    return;
  }
  // 10: complex: food-court pavilion + two-storey central kitchen + cold room
  pavilionRoof(k, 2.8, 2.4, -1.0, 0.6, y, 1.0, C.roof, 4);
  STALL_COLORS.slice(0, 2).forEach((c, i) => stall(k, -1.55 + i * 1.1, -0.35, y, c));
  for (const x of [-1.6, -0.4]) roundTable(k, x, 1.15, y);
  ceilingFan(k, -1.0, y + 1.0, 0.6);
  const kh = k.block(1.9, 3.4, 2, 1.45, y, -0.1, C.wallAlt);
  k.hipRoof(1.9, 3.4, 0.5, 1.45, y + kh, -0.1);
  for (let f = 0; f < 2; f++) k.windowRow('left', 1.45, -0.1, 1.9, 3.4, 3, y + f * STOREY + 0.45, { louvre: true });
  k.shutter('front', 1.45, -0.1, 1.9, 3.4, 0, 0.9, 0.66);
  k.chimney(1.1, y + kh + 0.2, -1.2, 0.55, 'steam');
  k.chimney(1.8, y + kh + 0.2, -1.2, 0.5, 'smoke');
  k.box(1.3, 0.75, 0.8, '#e8e8e2', -1.6, y, -1.5); // cold room
  k.box(0.4, 0.3, 0.2, '#c9ced2', -1.6, y + 0.75, -1.5);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Glass-walled dining hall with deep flat roof and fins
    k.glassBox(3.8, STOREY * 1.2, 2.0, 0, y, 0.25);
    k.box(4.4, 0.14, 2.6, C.white, 0, y + STOREY * 1.2, 0.25);
    k.fins(4.4, STOREY * 1.2 - 0.1, 0, y, 1.5, 12);
    kitchen(k, 4.0, 0.8, 0, -1.5, y, 1, 3);
    k.door('front', 0, 0.25, 3.8, 2.0, 0, y, 0.6, 0.7, DARK_GLASS);
    k.planter(-1.5, 1.75, 0.8, y);
    return;
  }
  if (level === 12) {
    // Two storeys with a rooftop dining terrace
    const h = hall(k, 4.0, 2.4, 0, -0.5, y, 2);
    k.flatRoof(4.0, 2.4, 0, y + h, -0.5);
    for (const [x, c] of [[-1.2, PALETTE.accentOrange], [0, PALETTE.accentTeal], [1.2, PALETTE.accentYellow]] as [number, string][]) {
      umbrella(k, x, -0.3, y + h + 0.06, c);
    }
    k.glassBox(0.8, 0.9, 0.8, 1.4, y + h + 0.06, -1.3);
    k.box(4.0, 0.3, 0.05, C.white, 0, y + h, 0.73);
    k.box(4.0, 0.03, 0.03, C.metal, 0, y + h + 0.6, 0.73);
    k.porch(0, 1.15, 1.4, 0.6, 0.85, y, 2);
    return;
  }
  if (level === 13) {
    // Central kitchen: stainless exhaust stacks, cold store, solar roof
    const h = ribbonBlock(k, -0.5, -0.5, 3.6, 2.4, 2, y);
    k.solarPanels(-0.5, y + h + 0.1, -0.5, 3.0, 1.4);
    for (const x of [1.6, 2.05]) k.cyl(0.14, h + 1.0, '#c9ced2', x, y, -1.4, 10);
    k.emitters.push({ pos: new THREE.Vector3(1.6, y + h + 1.1, -1.4), kind: 'steam' }, { pos: new THREE.Vector3(2.05, y + h + 1.1, -1.4), kind: 'steam' });
    k.box(1.1, 1.3, 1.6, '#e8e8e2', 1.8, y, 0.3);
    k.shutter('front', -0.5, -0.5, 3.6, 2.4, -0.8, 0.9, 0.7);
    k.door('front', -0.5, -0.5, 3.6, 2.4, 0.9, y, 0.5, 0.66, DARK_GLASS);
    return;
  }
  if (level === 14) {
    // Modern food-court pavilion: thin white canopy raised high on slim columns, skylights
    const ch = 1.45;
    for (let i = 0; i < 5; i++) for (const z of [-1.4, 1.6]) k.cyl(0.05, ch, C.white, -2.1 + i * 1.05, y, z, 8);
    k.box(4.7, 0.1, 3.4, C.white, 0, y + ch, 0.1);
    for (const x of [-1.4, 0, 1.4]) k.box(0.7, 0.04, 0.7, '#86b7cc', x, y + ch + 0.08, 0.1);
    k.box(4.72, 0.04, 3.42, C.trim, 0, y + ch - 0.02, 0.1);
    STALL_COLORS.slice(0, 4).forEach((c, i) => stall(k, -1.8 + i * 1.2, -1.15, y, c, 1.0));
    for (const x of [-1.6, 0, 1.6]) for (const z of [0.25, 1.1]) roundTable(k, x, z, y);
    for (const x of [-1.55, 0, 1.55]) ceilingFan(k, x, y + 1.45, 0.6);
    return;
  }
  // 15: Grand Dining Hall: U-shape around a garden court, gold band, arch
  const bh = hall(k, 4.6, 1.2, 0, -1.3, y, 2);
  k.hipRoof(4.6, 1.2, 0.5, 0, y + bh, -1.3);
  for (const s of [-1, 1]) {
    const wx = s * 1.85;
    const h = k.block(0.9, 2.0, 2, wx, y, 0.3);
    k.hipRoof(0.9, 2.0, 0.45, wx, y + h, 0.3);
    k.windowRow(s < 0 ? 'right' : 'left', wx, 0.3, 0.9, 2.0, 2, y + 0.45, { louvre: true });
    k.box(0.94, 0.06, 2.04, '#d9b24a', wx, y + h - 0.12, 0.3);
  }
  k.box(4.64, 0.06, 1.24, '#d9b24a', 0, y + bh - 0.12, -1.3);
  k.box(2.6, 0.04, 2.0, '#6cbf45', 0, y, 0.3);
  supertree(k, 0, 0.0, 0.9, y + 0.04, '#d98a3c');
  umbrella(k, -0.8, 0.8, y, PALETTE.accentOrange);
  umbrella(k, 0.8, 0.8, y, PALETTE.accentTeal);
  k.arch(0, 1.75, 1.4, 'DINING HALL', y);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 2.22, 1.75, false);
  if (level === 16) {
    const h = ribbonBlock(k, -0.3, -0.6, 3.6, 1.8, 2, y);
    k.box(1.0, 0.3, 1.8, CONCRETE, 1.7, y, -0.6); // loading dock
    k.shutter('right', -0.3, -0.6, 3.6, 1.8, 0.2, 0.8, 0.66);
    k.solarPanels(-0.3, y + h + 0.1, -0.6, 3.0, 1.0);
    k.glassBox(1.0, STOREY * 1.4, 0.4, -0.3, y, 0.5);
    return;
  }
  if (level === 17) {
    // Ration centre: stacked steel containers with a canopy
    const cols = ['#5d6b35', '#7a8a3a', CONCRETE, '#5d8aa3'];
    for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) {
      k.box(1.3, 0.75, 0.8, cols[(i + f) % 4], -1.2 + i * 1.35, y + f * 0.77, -1.0);
      for (let r = 0; r < 4; r++) k.box(0.02, 0.7, 0.82, '#33383d', -1.75 + i * 1.35 + r * 0.33, y + f * 0.77 + 0.02, -1.0);
    }
    k.box(4.2, 0.08, 1.4, C.roofGreen, 0, y + 1.0, 0.4);
    for (const x of [-1.9, 0, 1.9]) k.box(0.08, 1.0, 0.08, C.white, x, y, 1.0);
    for (const x of [-1.2, 0.4]) k.diningTable(x, 0.4, 1.0, y);
    return;
  }
  if (level === 18) {
    k.box(3.6, 1.6, 2.0, CONCRETE, 0, y, -0.7);
    k.box(3.6, 0.08, 2.0, '#6cbf45', 0, y + 1.6, -0.7);
    for (const s of [-1, 1]) {
      const g = new THREE.BufferGeometry();
      const pts = [0, 1.6, -1, 0, 1.6, 1, 0.7 * s, 0, 1, 0, 1.6, -1, 0.7 * s, 0, 1, 0.7 * s, 0, -1];
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6cbf45', flatShading: true, side: THREE.DoubleSide }));
      m.position.set(s * 1.8, y, -0.7);
      k.add(m);
    }
    k.box(1.0, 0.9, 0.06, '#6b7075', 0, y, 0.33);
    for (const x of [-1.0, 0, 1.0]) k.cyl(0.1, 0.5, '#c9ced2', x, y + 1.68, -1.2, 8);
    k.emitters.push({ pos: new THREE.Vector3(0, y + 2.3, -1.2), kind: 'steam' });
    k.glassBox(1.6, STOREY - 0.05, 1.0, 0, y + 1.68, -0.4);
    return;
  }
  if (level === 19) {
    const h = ribbonBlock(k, 0, -0.6, 4.0, 1.8, 2, y);
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.04, 0.55), new THREE.MeshStandardMaterial({ color: '#284a73', flatShading: true, roughness: 0.4 }));
      p.position.set(0, y + h + 0.3, -1.15 + i * 0.55);
      p.rotation.x = -0.6;
      k.add(p);
      k.box(3.8, 0.3, 0.04, C.white, 0, y + h + 0.1, -0.9 + i * 0.55);
    }
    k.fins(4.0, h - 0.2, 0, y + 0.1, 0.32, 12);
    k.box(3.0, 0.08, 0.9, C.roofGreen, 0, y + 0.9, 0.85);
    for (const x of [-1.4, 1.4]) k.box(0.07, 0.9, 0.07, C.white, x, y, 1.25);
    return;
  }
  // 20: courtyard citadel with glass corners and a supertree garden
  ribbonBlock(k, 0, -1.25, 4.2, 0.8, 2, y);
  for (const s of [-1, 1]) {
    ribbonBlock(k, s * 1.7, 0.1, 0.8, 1.9, 2, y);
    k.glassBox(0.8, 3 * STOREY - 0.1, 0.8, s * 1.7, y, -1.25);
    k.box(0.82, 0.08, 1.92, '#d9b24a', s * 1.7, y + 2 * STOREY + 0.1, 0.1);
  }
  k.box(2.6, 0.08, 0.82, '#d9b24a', 0, y + 2 * STOREY + 0.1, -1.25);
  k.box(2.6, 0.05, 1.9, '#6cbf45', 0, y, 0.1);
  supertree(k, 0, 0.0, 1.0, y + 0.05);
  for (const x of [-0.8, 0.8]) roundTable(k, x, 0.75, y + 0.05);
}

export function buildCookhouse(level: number): Kit {
  const k = new Kit();
  const y = k.pad(5, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const COOKHOUSE: BuildingDef = {
  id: 'cookhouse',
  name: 'Cookhouse',
  role: 'Feeds the outpost. Well-fed Recruits work faster and Morale rises.',
  footprint: [5, 4],
  unlockHq: 1,
  levels: COOKHOUSE_LEVELS,
  designedLevels: 20,
  build: buildCookhouse,
};
