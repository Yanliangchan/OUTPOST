import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, ribbonBlock } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Cookhouse: feeds the outpost. Seats and meal output grow with level; good
 * food lifts Morale. Footprint 5×4; height budget ~4 storeys.
 *   Field (1–3) → Camp (4–6) → Base (7–10, release cap) → Command (11–15) → Secure (16–20, reserve)
 */

const TITLES = [
  'Field Kitchen', 'Mess Tent', 'Atap Canteen', 'Cookhouse', 'Cookhouse · Kitchen Wing', 'Cookhouse · Clerestory',
  'Dining Hall · Veranda', 'Food Court', 'Dining Hall · Upper Deck', 'Cookhouse Complex', 'Modern Dining Hall',
  'Rooftop Dining', 'Central Kitchen', 'Food Court Pavilion', 'Grand Dining Hall', 'Canopy Mess', 'Ration Centre',
  'Hydroponic Kitchen', 'Silo Kitchen', 'Pavilion Citadel',
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
  const lid = k.cyl(0.135, 0.025, '#a7adb1', x, y + 0.44, z, 10);
  const ly = lid.position.y;
  const seed = x * 3.1 + z * 1.7;
  // Lid rattles as the pot boils
  k.anims.push((t) => {
    const boil = Math.max(0, Math.sin(t * 2.3 + seed)) ** 6;
    lid.position.y = ly + boil * 0.03 * Math.abs(Math.sin(t * 40));
    lid.rotation.z = boil * 0.08 * Math.sin(t * 33);
  });
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
  const blades = new THREE.Group();
  blades.position.set(x, y - 0.17, z);
  k.box(0.5, 0.01, 0.06, '#f4f4f0', 0, 0, 0, blades);
  k.box(0.06, 0.01, 0.5, '#f4f4f0', 0, 0, 0, blades);
  k.add(blades);
  k.anims.push((t) => (blades.rotation.y = t * 6));
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
  // Kitchen extractor fan on the end wall
  const fx = x - w / 2 - 0.02, fy = y + h - 0.35;
  k.box(0.04, 0.3, 0.3, '#8a9196', fx, fy - 0.15, z);
  const blades = new THREE.Group();
  blades.position.set(fx - 0.03, fy, z);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.24, 0.05), new THREE.MeshStandardMaterial({ color: '#33383d' }));
    b.rotation.x = (i / 4) * Math.PI;
    blades.add(b);
  }
  k.add(blades);
  k.anims.push((t) => (blades.rotation.x = t * 7));
  return h;
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Tarp fly over field stoves
    for (const [x, z] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 0.2], [1.6, 0.2]]) k.box(0.05, 0.62, 0.05, C.wood, x, y, z);
    k.gableRoof(3.3, 1.7, 0.3, 0, y + 0.62, -0.6, '#5b6b3a', 0.08, '#5b6b3a', false);
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
      k.box(0.08, 1.15, 0.08, C.white, x, y, vz + vd / 2 - 0.06);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.box(0.08, 1.15, 0.08, C.white, s * (vw / 2 - 0.06), y, vz - vd / 2 + 0.5 + i * 0.8);
    k.box(vw, 0.04, vd, '#c9c3b5', 0, y, vz);
    k.hipRoof(vw, vd, 1.0, 0, y + 1.17, vz);
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
    hall(k, 3.8, 2.0, -0.4, -0.5, y, 2);
    k.hipRoof(3.8, 2.0, 0.6, -0.4, y + 2 * STOREY, -0.5);
    const dz = 1.0;
    k.box(3.8, 0.08, 1.0, '#cfc9bc', -0.4, y + STOREY - 0.08, dz);
    for (let i = 0; i < 5; i++) k.box(0.08, STOREY - 0.08, 0.08, C.white, -2.25 + i * 0.925, y, dz + 0.46);
    k.box(3.8, 0.28, 0.04, C.white, -0.4, y + STOREY, dz + 0.48);
    umbrella(k, -1.3, dz, y + STOREY, PALETTE.accentOrange);
    umbrella(k, 0.5, dz, y + STOREY, PALETTE.accentTeal);
    kitchen(k, 1.0, 2.0, 2.0, -0.5, y, 2, 2);
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
    // Glass dining hall under a V-shaped butterfly roof
    k.glassBox(3.8, STOREY * 2, 2.0, 0, y, 0.25);
    k.box(3.82, 0.06, 2.02, C.trim, 0, y + STOREY, 0.25);
    for (const s of [-1, 1]) {
      const r = k.box(2.3, 0.1, 2.7, C.white, s * 1.1, y + STOREY * 2 + 0.2, 0.25);
      r.rotation.z = s * 0.22;
    }
    k.cyl(0.05, STOREY * 2 + 0.1, C.metal, 0, y, 1.45, 6);
    kitchen(k, 4.0, 0.8, 0, -1.5, y, 2, 3); // rainwater chain at the valley
    k.door('front', 0, 0.25, 3.8, 2.0, 0, y, 0.6, 0.7, DARK_GLASS);
    k.planter(-1.5, 1.75, 0.8, y);
    return;
  }
  if (level === 12) {
    // Two storeys with a rooftop dining terrace
    const h = hall(k, 4.6, 2.5, 0, -0.45, y, 2);
    k.flatRoof(4.6, 2.5, 0, y + h, -0.45);
    for (const [x, c] of [[-1.2, PALETTE.accentOrange], [0, PALETTE.accentTeal], [1.2, PALETTE.accentYellow]] as [number, string][]) {
      umbrella(k, x, -0.3, y + h + 0.06, c);
    }
    k.glassBox(0.8, 0.9, 0.8, 1.4, y + h + 0.06, -1.3);
    k.chimney(-1.8, y + h + 0.06, -1.4, 0.45, 'steam');
    k.chimney(-1.3, y + h + 0.06, -1.4, 0.35, 'smoke');
    k.box(4.0, 0.3, 0.05, C.white, 0, y + h, 0.73);
    k.box(4.0, 0.03, 0.03, C.metal, 0, y + h + 0.6, 0.73);
    k.porch(0, 1.15, 1.4, 0.6, 0.85, y, 2);
    return;
  }
  if (level === 13) {
    // Central kitchen: stainless exhaust stacks, cold store, solar roof
    const h = ribbonBlock(k, -0.5, -0.5, 3.6, 2.4, 3, y);
    k.solarPanels(-0.5, y + h + 0.1, -0.5, 3.0, 1.4);
    for (const x of [1.6, 2.05]) k.cyl(0.14, h + 1.0, '#c9ced2', x, y, -1.4, 10);
    k.emitters.push({ pos: new THREE.Vector3(1.6, y + h + 1.1, -1.4), kind: 'steam' }, { pos: new THREE.Vector3(2.05, y + h + 1.1, -1.4), kind: 'steam' });
    k.chimney(-1.5, y + h + 0.1, -1.2, 0.4, 'steam');
    k.chimney(0.4, y + h + 0.1, -1.2, 0.4, 'smoke');
    k.box(1.1, 1.3, 1.6, '#e8e8e2', 1.8, y, 0.3);
    k.shutter('front', -0.5, -0.5, 3.6, 2.4, -0.8, 0.9, 0.7);
    k.door('front', -0.5, -0.5, 3.6, 2.4, 0.9, y, 0.5, 0.66, DARK_GLASS);
    return;
  }
  if (level === 14) {
    // Modern food-court pavilion: thin white canopy raised high on slim columns, skylights
    const ch = 2.9;
    k.box(4.4, 0.08, 1.0, '#cfc9bc', 0, y + 1.45, -0.9);
    k.box(4.4, 0.26, 0.04, C.white, 0, y + 1.53, -0.42);
    for (const x of [-1, 1]) umbrella(k, x, -0.9, y + 1.53, x < 0 ? PALETTE.accentOrange : PALETTE.accentTeal);
    for (let i = 0; i < 5; i++) for (const z of [-1.4, 1.6]) k.cyl(0.05, ch, C.white, -2.1 + i * 1.05, y, z, 8);
    k.box(4.7, 0.1, 3.4, C.white, 0, y + ch, 0.1);
    for (const x of [-1.4, 0, 1.4]) k.box(0.7, 0.04, 0.7, '#86b7cc', x, y + ch + 0.08, 0.1);
    k.box(4.72, 0.04, 3.42, C.trim, 0, y + ch - 0.02, 0.1);
    STALL_COLORS.slice(0, 4).forEach((c, i) => stall(k, -1.8 + i * 1.2, -1.15, y, c, 1.0));
    for (const x of [-1.6, 0, 1.6]) for (const z of [0.25, 1.1]) roundTable(k, x, z, y);
    for (const x of [-1.55, 0, 1.55]) ceilingFan(k, x, y + 2.9, 0.6);
    return;
  }
  // 15: Grand Dining Hall: barrel-vaulted hall with a colonnade and a pergola garden with string lights.
  const hw = 4.4, hd = 2.0, hz = -0.5;
  const wh = k.block(hw, hd, 2, 0, y, hz);
  k.windowRow('front', 0, hz, hw, hd, 6, y + 0.45, { louvre: true, skip: [2, 3] });
  k.windowRow('front', 0, hz, hw, hd, 6, y + STOREY + 0.45, { louvre: true });
  for (const dx of [-0.22, 0.22]) k.door('front', 0, hz, hw, hd, dx, y, 0.42, 0.66);
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(hd / 2 + 0.15, hd / 2 + 0.15, hw + 0.3, 12, 1, false, -Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ color: C.roof, flatShading: true, side: THREE.DoubleSide }),
  );
  vault.rotation.z = Math.PI / 2;
  vault.position.set(0, y + wh, hz);
  vault.castShadow = true;
  k.add(vault);
  k.box(hw + 0.34, 0.08, hd + 0.34, '#d9b24a', 0, y + wh - 0.04, hz);
  for (let i = 0; i < 7; i++) k.cyl(0.07, wh, C.white, -2.1 + i * 0.7, y, hz + hd / 2 + 0.35, 8);
  k.box(hw + 0.2, 0.1, 0.5, C.white, 0, y + wh - 0.1, hz + hd / 2 + 0.3);
  for (const x of [-1.6, 1.6]) k.chimney(x, y + wh, hz - 0.7, 0.6, 'steam');
  // Pergola garden with string lights
  for (const x of [-2.0, -0.7, 0.7, 2.0]) for (const z of [0.95, 1.65]) k.box(0.06, 0.8, 0.06, C.wood, x, y, z);
  for (let i = 0; i < 9; i++) k.box(0.05, 0.05, 0.85, C.wood, -2.0 + i * 0.5, y + 0.8, 1.3);
  k.box(4.1, 0.03, 0.8, '#5fae34', 0, y + 0.86, 1.3); // creeper over the pergola
  for (let i = 0; i < 16; i++) k.box(0.05, 0.05, 0.05, '#ffe48a', -2.0 + i * 0.27, y + 0.74 - Math.sin((i / 15) * Math.PI) * 0.08, 1.3);
  for (const x of [-1.3, 0, 1.3]) roundTable(k, x, 1.3, y);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 2.22, 1.75, false);
  if (level === 16) {
    // Secure Mess: compact two-storey kitchen with steel stacks; a huge cantilevered canopy over dining.
    const h = 3 * STOREY;
    k.box(4.0, h, 1.1, CONCRETE, 0, y, -1.0);
    k.box(4.04, 0.06, 1.14, C.trim, 0, y + 2 * STOREY, -1.0);
    k.box(3.6, 0.36, 0.04, DARK_GLASS, 0, y + 2 * STOREY + 0.32, -0.44);
    k.box(4.04, 0.06, 1.14, C.trim, 0, y + STOREY, -1.0);
    k.box(3.6, 0.36, 0.04, DARK_GLASS, 0, y + STOREY + 0.32, -0.44);
    k.shutter('front', 0, -1.0, 4.0, 1.1, -1.2, 0.8, 0.66);
    for (const x of [-0.6, 0, 0.6]) {
      k.cyl(0.1, h + 0.9, '#c9ced2', x, y, -1.3, 10);
      k.emitters.push({ pos: new THREE.Vector3(x, y + h + 1.0, -1.3), kind: 'steam' });
    }
    k.box(4.3, 0.12, 2.0, C.white, 0, y + 1.25, 0.45);
    k.box(4.32, 0.04, 2.02, C.trim, 0, y + 1.23, 0.45);
    for (const x of [-1.9, 1.9]) k.box(0.08, 1.25, 0.08, C.metal, x, y, 1.3);
    for (const x of [-1.1, 0.4]) k.diningTable(x, 0.55, 1.1, y);
    for (const x of [-1.2, 0.6]) ceilingFan(k, x, y + 1.23, 0.45);
    return;
  }
  if (level === 17) {
    // Ration centre: stacked steel containers with a canopy
    const cols = ['#5d6b35', '#7a8a3a', CONCRETE, '#5d8aa3'];
    for (let f = 0; f < 4; f++) for (let i = 0; i < 3; i++) {
      k.box(1.3, 0.75, 0.8, cols[(i + f) % 4], -1.2 + i * 1.35, y + f * 0.77, -1.0);
      for (let r = 0; r < 4; r++) k.box(0.02, 0.7, 0.82, '#33383d', -1.75 + i * 1.35 + r * 0.33, y + f * 0.77 + 0.02, -1.0);
    }
    k.chimney(1.4, y + 3.08, -1.0, 0.45, 'steam');
    k.stairs(-2.0, -0.2, 0.3, 0.8, 2.3);
    k.box(4.2, 0.08, 1.4, C.roofGreen, 0, y + 1.0, 0.4);
    for (const x of [-1.9, 0, 1.9]) k.box(0.08, 1.0, 0.08, C.white, x, y, 1.0);
    for (const x of [-1.2, 0.4]) k.diningTable(x, 0.4, 1.0, y);
    return;
  }
  if (level === 18) {
    // Hydroponic Kitchen: kitchen block plus glass greenhouses growing the outpost's greens.
    const kh = 3 * STOREY;
    k.box(1.5, kh, 2.6, CONCRETE, -1.3, y, -0.4);
    k.box(1.54, 0.06, 2.64, C.trim, -1.3, y + 2 * STOREY, -0.4);
    k.box(1.54, 0.06, 2.64, C.trim, -1.3, y + STOREY, -0.4);
    k.box(0.04, 0.36, 2.2, DARK_GLASS, -0.54, y + STOREY + 0.32, -0.4);
    k.chimney(-1.6, y + kh, -1.2, 0.5, 'steam');
    k.chimney(-1.0, y + kh, -1.2, 0.4, 'smoke');
    k.door('right', -1.3, -0.4, 1.5, 2.6, 0.6, y, 0.4, 0.66, DARK_GLASS);
    for (const z of [-1.2, -0.25, 0.7]) {
      const g = new Kit();
      g.box(2.4, 0.5, 0.8, '#bfe3ea', 0, 0, 0);
      g.gableRoof(2.4, 0.8, 0.4, 0, 0.5, 0, '#bfe3ea', 0.03, '#bfe3ea', false);
      for (let r = 0; r < 3; r++) g.box(2.2, 0.12, 0.12, '#4fae3a', 0, 0.05, -0.24 + r * 0.24);
      for (let i = 0; i < 6; i++) g.box(0.03, 0.9, 0.82, C.white, -1.2 + i * 0.48, 0, 0);
      g.group.position.set(1.05, y, z);
      g.group.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).color.getHexString() === 'bfe3ea') {
          o.material = new THREE.MeshStandardMaterial({ color: '#bfe3ea', transparent: true, opacity: 0.55, flatShading: true });
        }
      });
      k.add(g.group);
    }
    return;
  }
  if (level === 19) {
    // Silo Kitchen: food silos feed the kitchen by a conveyor bridge.
    for (const [x, z] of [[1.4, -1.1], [2.0, -0.35], [1.4, 0.4]]) {
      k.cyl(0.32, 2.6, '#d6d8da', x, y, z, 12);
      k.cyl(0.33, 0.04, C.trim, x, y + 1.3, z, 12);
      k.cyl(0.33, 0.35, '#c9ced2', x, y + 2.6, z, 12, 0.05);
      k.cyl(0.05, 0.4, C.metal, x, y, z, 6);
    }
    const kh = 3 * STOREY;
    k.box(2.6, kh, 2.4, CONCRETE, -0.9, y, -0.4);
    k.box(2.64, 0.06, 2.44, C.trim, -0.9, y + 2 * STOREY, -0.4);
    k.box(2.64, 0.06, 2.44, C.trim, -0.9, y + STOREY, -0.4);
    k.box(2.2, 0.36, 0.04, DARK_GLASS, -0.9, y + STOREY + 0.32, 0.81);
    const conveyor = k.box(1.3, 0.12, 0.2, '#8a9196', 0.85, y + 2.3, -0.7);
    conveyor.rotation.z = 0.25;
    k.chimney(-1.6, y + kh, -1.2, 0.5, 'steam');
    k.box(2.6, 0.08, 0.8, C.roofGreen, -0.9, y + 0.9, 1.2);
    for (const x of [-2.1, 0.3]) k.box(0.07, 0.9, 0.07, C.white, x, y, 1.55);
    roundTable(k, -1.5, 1.2, y);
    roundTable(k, -0.3, 1.2, y);
    return;
  }
  // 20: Mess Citadel: octagonal glass dining pavilion with a gold-ringed faceted roof; kitchen behind.
  k.box(4.2, 3 * STOREY, 0.9, CONCRETE, 0, y, -1.2);
  for (const x of [-1.5, -0.5, 0.5, 1.5]) k.chimney(x, y + 3 * STOREY, -1.35, 0.45, x < 0 ? 'steam' : 'smoke');
  k.cyl(1.45, STOREY * 2.2, '#86b7cc', 0, y, 0.35, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.box(0.06, STOREY * 2.2, 0.06, C.trim, Math.sin(a) * 1.36, y, 0.35 + Math.cos(a) * 1.36);
  }
  k.cyl(1.62, 0.1, '#d9b24a', 0, y + STOREY * 2.2, 0.35, 8);
  k.cyl(1.55, 0.7, C.roof, 0, y + STOREY * 2.2 + 0.1, 0.35, 8, 0.25);
  k.cyl(0.25, 0.3, '#d9b24a', 0, y + STOREY * 2.2 + 0.8, 0.35, 8, 0.02);
  k.cyl(1.47, 0.06, C.trim, 0, y + STOREY, 0.35, 8);
  k.door('front', 0, 0.35, 2.4, 2.9, 0, y, 0.5, 0.66, DARK_GLASS);
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
