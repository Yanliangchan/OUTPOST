import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, ribbonBlock, supertree } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Bunk: houses Recruits. Capacity and rest recovery grow with level.
 * Footprint 6×4; height budget ~4 storeys. Bands:
 *   Field (1–3) → Camp (4–6) → Base (7–10, release cap) → Command (11–15) → Secure (16–20, reserve)
 */

const TITLES = [
  'Basha Lines', 'Tent Lines', 'Kampong Barrack', 'Barrack', 'Twin Barracks', 'Bunk Block', 'Bunk Block · Stair Tower',
  'Three-Storey Bunk', 'Bunk · Void Deck', 'Bunk Complex', 'Modern Bunk', 'Bunk · Sky Garden', 'Twin Block', 'Terrace Bunk',
  'Residences', 'Secure Quarters', 'Pod Quarters', 'Bermed Quarters', 'Solar Quarters', 'Quarters Citadel',
];
const SUPPLIES = [200, 600, 1_500, 4_000, 9_000, 18_000, 35_000, 60_000, 100_000, 170_000, 270_000, 400_000, 550_000, 750_000, 1_000_000, 1_300_000, 1_650_000, 2_050_000, 2_500_000, 3_000_000];
const REPUTATION = [0, 0, 25, 100, 250, 450, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [1 * MIN, 5 * MIN, 20 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const BUNK_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const capacity = 4 + i * 2;
  return {
    level,
    title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((300 * Math.pow(1.2, i)) / 10) * 10,
    stats: { capacity, restRate: 10 + level * 2 },
    unlocks: [`Houses ${capacity} Recruits`, `Rest recovery ${10 + level * 2}%/h`],
  };
});

// ------------------------------------------------------------------ helpers

const OLIVE = '#5b6b3a';
const TOWELS = ['#4b6b3a', '#ffffff', '#ff8a3d', '#4b6b3a', '#2f5a8a', '#ffd23f'];

/** A row of cell doors with a small louvre window beside each, on one floor. */
function rooms(k: Kit, bx: number, bz: number, bw: number, bd: number, fy: number, n: number) {
  for (let i = 0; i < n; i++) {
    const along = -bw / 2 + (bw / n) * (i + 0.5) - 0.18;
    k.door('front', bx, bz, bw, bd, along, fy, 0.28, 0.58);
    k.window('front', bx, bz, bw, bd, along + 0.38, fy + 0.46, 0.26, 0.22, true);
  }
}

/** Towels and uniforms hung on a corridor parapet. */
function towels(k: Kit, x0: number, x1: number, fy: number, z: number, seed = 0) {
  const n = Math.max(3, Math.round((x1 - x0) / 0.7));
  for (let t = 0; t < n; t++) {
    k.box(0.16, 0.2, 0.012, TOWELS[(t + seed) % TOWELS.length], x0 + ((x1 - x0) / n) * (t + 0.5), fy + 0.12, z);
  }
}

interface CorridorOpts {
  bx?: number;
  bw: number;
  bd: number;
  bz: number;
  cd?: number;
  storeys: number;
  y: number;
  voidDeck?: boolean;
  roof?: 'hip' | 'flat' | 'none';
  roofColor?: string;
  wall?: string;
}

/**
 * Classic bunk block: rooms behind an open corridor with a parapet, columns
 * carrying the corridor, towels on the rails. Optional HDB-style void deck.
 * Returns the height of the top of the walls.
 */
function corridorBlock(k: Kit, o: CorridorOpts) {
  const bx = o.bx ?? 0, cd = o.cd ?? 0.55;
  const cz = o.bz + o.bd / 2 + cd / 2;
  const base = o.voidDeck ? STOREY : 0;
  const roomStoreys = o.storeys - (o.voidDeck ? 1 : 0);
  if (o.voidDeck) {
    // Open ground floor: pillars, ceiling slab, benches and a table.
    for (let i = 0; i < 5; i++) {
      const px = bx - o.bw / 2 + 0.1 + (i * (o.bw - 0.2)) / 4;
      for (const pz of [o.bz - o.bd / 2 + 0.1, o.bz + o.bd / 2 - 0.1, cz + cd / 2 - 0.06]) k.box(0.14, STOREY, 0.14, C.white, px, o.y, pz);
    }
    k.box(o.bw, 0.02, o.bd + cd, '#d6d0c2', bx, o.y, o.bz + cd / 2);
    k.bench(bx - 1.2, o.bz, 0.8, o.y);
    k.bench(bx + 1.2, o.bz, 0.8, o.y);
    k.diningTable(bx, o.bz + 0.1, 0.8, o.y);
    k.box(0.4, 0.5, 0.05, C.trim, bx + o.bw / 2 - 0.4, o.y + 0.2, o.bz - o.bd / 2 + 0.06); // letterboxes
  }
  const h = k.block(o.bw, o.bd, roomStoreys, bx, o.y + base, o.bz, o.wall);
  const top = base + h;
  for (let f = 0; f < roomStoreys; f++) {
    const fy = o.y + base + f * STOREY;
    if (f > 0 || o.voidDeck) {
      k.corridor(bx, cz, o.bw, cd, fy);
      towels(k, bx - o.bw / 2 + 0.2, bx + o.bw / 2 - 0.2, fy, cz + cd / 2 + 0.02, f);
    }
    rooms(k, bx, o.bz, o.bw, o.bd, fy, Math.max(2, Math.round(o.bw / 1.2)));
    k.windowRow('back', bx, o.bz, o.bw, o.bd, Math.max(3, Math.round(o.bw / 0.8)), fy + 0.45, { louvre: true });
    k.aircon(bx + o.bw / 2 + 0.08, fy + 0.3, o.bz - 0.2, Math.PI / 2);
  }
  for (let i = 0; i < 5; i++) k.box(0.08, top, 0.08, C.white, bx - o.bw / 2 + 0.06 + (i * (o.bw - 0.12)) / 4, o.y, cz + cd / 2 - 0.06);
  if (!o.voidDeck) k.box(o.bw, 0.03, cd, '#c9c3b5', bx, o.y, cz);
  const roofY = o.y + top;
  if (o.roof === 'hip' || o.roof === undefined) k.hipRoof(o.bw, o.bd + cd, 0.6, bx, roofY, o.bz + cd / 2, o.roofColor ?? C.roof);
  else if (o.roof === 'flat') k.flatRoof(o.bw, o.bd + cd, bx, roofY, o.bz + cd / 2);
  return top;
}

/** External stair at the right end. */
function endStair(k: Kit, x: number, bz: number, storeys: number, y: number) {
  const h = (storeys - 1) * STOREY;
  if (h <= 0) return;
  k.stairs(x, bz + 0.2, 0.42, 1.8, h);
  k.box(0.04, h + 0.3, 1.8, C.white, x + 0.22, y, bz + 0.2);
}

/** Single-storey barrack with louvre windows; zinc or red roof. */
function barrack(k: Kit, x: number, z: number, w: number, d: number, y: number, roof: 'zinc' | 'red') {
  const h = k.block(w, d, 1, x, y, z);
  if (roof === 'zinc') k.gableRoof(w, d, 0.5, x, y + h, z, C.zinc);
  else k.hipRoof(w, d, 0.5, x, y + h, z);
  k.windowRow('front', x, z, w, d, Math.max(4, Math.round(w / 0.7)), y + 0.42, { louvre: true, skip: [1, Math.max(4, Math.round(w / 0.7)) - 2] });
  k.windowRow('back', x, z, w, d, Math.max(4, Math.round(w / 0.7)), y + 0.42, { louvre: true });
  for (const dx of [-w * 0.28, w * 0.28]) k.door('front', x, z, w, d, dx, y);
  return h;
}

/** Big painted block number on a facade (a Singapore HDB staple). */
function blockNumber(k: Kit, text: string, x: number, y: number, z: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f5a3a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.font = '900 96px Nunito, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 64, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.position.set(x, y + 0.16, z);
  k.add(m);
}

/** Low tarp shelter on poles with sleeping mats and packs. */
function basha(k: Kit, x: number, z: number, y: number, rot = 0) {
  const g = new Kit();
  for (const s of [-0.75, 0.75]) g.box(0.04, 0.62, 0.04, C.wood, s, 0, 0);
  g.gableRoof(1.4, 1.0, 0.45, 0, 0.15, 0, OLIVE, 0.06, OLIVE, false);
  g.box(1.5, 0.02, 0.02, '#c9b98a', 0, 0.6, 0);
  for (const dz of [-0.22, 0.22]) {
    g.box(1.0, 0.03, 0.24, '#2f5a8a', 0, 0, dz);
    g.box(0.18, 0.2, 0.14, OLIVE, 0.62, 0, dz);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rot;
  k.add(g.group);
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    basha(k, -1.6, -0.9, y);
    basha(k, 0, -0.9, y);
    basha(k, 1.6, -0.9, y);
    k.clothesLine(-1.4, 0.6, 1.4, y);
    k.sandbags(1.3, 0.8, 1.4, 0, y);
    k.crates(-2.5, 1.4, y, 2);
    k.drum(2.55, -1.5, '#2f6fa8', y);
    return;
  }
  if (level === 2) {
    k.tent(2.2, 1.4, -1.35, -0.55, y);
    k.tent(2.2, 1.4, 1.35, -0.55, y);
    k.clothesLine(-1.3, 1.35, 1.6, y);
    k.drum(2.2, 1.3, '#2f6fa8', y);
    k.drum(2.45, 1.4, '#2f6fa8', y);
    k.waterPoint(0.9, 1.4, y);
    k.sandbags(-2.55, 0.2, 1.0, Math.PI / 2, y);
    return;
  }
  // 3: kampong barrack on stilts
  const w = 4.6, d = 1.8, z = -0.6, lift = 0.35;
  for (let i = 0; i < 6; i++) for (const sz of [-d / 2 + 0.1, d / 2 - 0.1]) k.box(0.1, lift, 0.1, '#7a5a3b', -w / 2 + 0.15 + (i * (w - 0.3)) / 5, y, z + sz);
  k.box(w + 0.1, 0.06, d + 0.1, '#9c6b45', 0, y + lift, z);
  const h = k.block(w, d, 1, 0, y + lift + 0.06, z, C.wood);
  for (let i = 1; i < 6; i++) k.box(w + 0.01, 0.015, d + 0.01, '#8a5a3b', 0, y + lift + 0.06 + i * 0.15, z);
  k.gableRoof(w, d, 0.6, 0, y + lift + 0.06 + h, z, C.zinc, 0.2, C.wood);
  k.windowRow('front', 0, z, w, d, 5, y + lift + 0.5, { louvre: true, skip: [2] });
  k.door('front', 0, z, w, d, 0, y + lift + 0.06);
  k.stairs(0, z + d / 2 + 0.3, 0.5, 0.5, lift + 0.06);
  k.clothesLine(-1.6, 1.4, 1.4, y);
  k.drum(2.4, 1.3, '#2f6fa8', y);
  k.bench(1.4, 1.3, 0.8, y);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    barrack(k, 0, -0.55, 5.2, 1.7, y, 'zinc');
    k.clothesLine(-1.6, 1.35, 1.6, y);
    k.bench(1.3, 1.05, 0.8, y);
    k.bin(2.6, 1.5, y);
    return;
  }
  if (level === 5) {
    barrack(k, 0, -1.2, 5.0, 1.2, y, 'red');
    barrack(k, 0, 0.6, 5.0, 1.2, y, 'red');
    k.linkway(2.3, -0.55, 2.3, -0.02, y, 0.7, 0.5);
    k.linkway(-2.3, -0.55, -2.3, -0.02, y, 0.7, 0.5);
    k.clothesLine(-0.6, 1.65, 1.4, y);
    k.bin(2.65, 1.7, y);
    return;
  }
  // 6: first two-storey bunk block
  corridorBlock(k, { bw: 4.8, bd: 1.35, bz: -0.95, storeys: 2, y });
  endStair(k, 2.68, -0.95, 2, y);
  k.clothesLine(-1.9, 1.5, 1.4, y);
  k.bicycleRack(1.6, 1.55, 3, y);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    corridorBlock(k, { bx: -0.5, bw: 4.0, bd: 1.35, bz: -0.95, storeys: 2, y });
    // Stair tower with a pyramid roof and water tank
    const tx = 2.15, tz = -0.6;
    const h = k.block(1.0, 1.3, 3, tx, y, tz, C.wallAlt);
    k.hipRoof(1.0, 1.3, 0.55, tx, y + h, tz);
    for (let f = 0; f < 3; f++) k.window('front', tx, tz, 1.0, 1.3, 0, y + f * STOREY + 0.4, 0.3, 0.4, true);
    k.door('front', tx, tz, 1.0, 1.3, 0, y, 0.34);
    k.linkway(1.55, 1.0, 1.55, 1.55, y, 0.7, 0.5);
    k.clothesLine(-1.9, 1.5, 1.4, y);
    k.bicycleRack(0.4, 1.55, 3, y);
    return;
  }
  if (level === 8) {
    corridorBlock(k, { bw: 4.8, bd: 1.35, bz: -0.95, storeys: 3, y });
    endStair(k, 2.68, -0.95, 3, y);
    k.waterTank(-2.7, y, -1.45, 0.17, 0.3);
    k.clothesLine(-1.9, 1.5, 1.4, y);
    k.bicycleRack(1.6, 1.55, 3, y);
    k.lamp(-2.6, 1.6, y);
    return;
  }
  if (level === 9) {
    const top = corridorBlock(k, { bw: 4.8, bd: 1.35, bz: -0.95, storeys: 3, y, voidDeck: true });
    // HDB-style central stair/lift core projecting forward, gable to the front, big block number.
    const cz = 0.15;
    const ch = k.block(1.0, 0.9, 3, 0, y, cz, C.wallAlt) + 0.35;
    k.box(1.0, 0.35, 0.9, C.wallAlt, 0, y + ch - 0.35, cz);
    const g = new Kit();
    g.gableRoof(0.9, 1.0, 0.45, 0, 0, 0, C.roof, 0.1, C.white);
    g.group.rotation.y = Math.PI / 2;
    g.group.position.set(0, y + ch, cz);
    k.add(g.group);
    for (let f = 1; f < 3; f++) k.window('front', 0, cz, 1.0, 0.9, 0, y + f * STOREY + 0.36, 0.5, 0.3, true);
    blockNumber(k, '9', 0, y + ch - 0.32, cz + 0.46);
    k.door('front', 0, cz, 1.0, 0.9, 0, y, 0.42, 0.64, '#3d5a6c');
    void top;
    k.noticeboard(-2.2, 1.6, 0, y);
    k.bicycleRack(1.6, 1.6, 3, y);
    k.planter(0.2, 1.65, 0.8, y);
    return;
  }
  // 10: void deck + three room floors, stair towers at both ends
  const top = corridorBlock(k, { bw: 4.2, bd: 1.35, bz: -0.95, storeys: 4, y, voidDeck: true });
  for (const s of [-1, 1]) {
    const tx = s * 2.5;
    const h = k.block(0.7, 1.4, 4, tx, y, -0.8, C.wallAlt);
    k.hipRoof(0.7, 1.4, 0.4, tx, y + h, -0.8);
    for (let f = 0; f < 4; f++) k.window('front', tx, -0.8, 0.7, 1.4, 0, y + f * STOREY + 0.4, 0.22, 0.4, true);
  }
  k.waterTank(-0.9, y + top + 0.2, -1.2, 0.16, 0.26);
  k.waterTank(0.9, y + top + 0.2, -1.2, 0.16, 0.26);
  k.noticeboard(-1.4, 1.65, 0, y);
  k.bicycleRack(1.4, 1.65, 3, y);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    const top = corridorBlock(k, { bw: 4.8, bd: 1.35, bz: -0.95, storeys: 3, y, voidDeck: true, roof: 'flat' });
    k.fins(4.8, top - STOREY - 0.1, 0, y + STOREY, -0.95 + 0.675 + 0.6, 10);
    k.solarPanels(0, y + top + 0.06, -0.9, 3.6, 0.9);
    k.planter(-1.5, 1.65, 0.8, y);
    k.planter(1.5, 1.65, 0.8, y);
    return;
  }
  if (level === 12) {
    const top = corridorBlock(k, { bw: 4.8, bd: 1.35, bz: -0.95, storeys: 3, y, voidDeck: true, roof: 'flat' });
    const ry = y + top + 0.06;
    // Roof garden with a pergola
    k.box(4.6, 0.04, 1.7, '#6cbf45', 0, ry, -0.7);
    for (const x of [-1.6, -0.6, 0.4, 1.4]) for (const z of [-1.2, -0.2]) k.box(0.06, 0.6, 0.06, C.white, x, ry, z);
    for (let i = 0; i < 8; i++) k.box(0.05, 0.05, 1.1, C.wood, -1.7 + i * 0.45, ry + 0.6, -0.7);
    k.hedge(-1.8, -0.1, 0.8, 0.2, ry);
    k.hedge(1.6, -1.3, 0.9, 0.2, ry);
    k.glassBox(0.7, top - 0.1, 1.2, 2.7, y, -0.9);
    return;
  }
  if (level === 13) {
    for (const s of [-1, 1]) {
      corridorBlock(k, { bx: s * 1.55, bw: 2.3, bd: 1.3, bz: -0.95, storeys: 3, y, roof: 'hip' });
    }
    k.glassBox(0.8, STOREY - 0.1, 0.7, 0, y + STOREY, -1.0);
    k.glassBox(0.8, STOREY - 0.1, 0.7, 0, y + 2 * STOREY, -1.0);
    k.box(0.8, 0.04, 1.6, '#6cbf45', 0, y, 0.3);
    k.planter(0, 1.65, 0.6, y);
    return;
  }
  if (level === 14) {
    // Terraces stepping down toward the front, each roof planted
    const tiers: [number, number, number][] = [[1.0, -1.45, 4], [1.0, -0.45, 3], [1.0, 0.55, 2]];
    tiers.forEach(([d, z, storeys], i) => {
      const h = k.block(5.0, d, storeys, 0, y, z, i % 2 ? C.wallAlt : C.wall);
      for (let f = 0; f < storeys; f++) rooms(k, 0, z, 5.0, d, y + f * STOREY, 4);
      k.box(5.0, 0.05, d, '#6cbf45', 0, y + h, z);
      k.hedge(0, z + d / 2 - 0.12, 4.8, 0.18, y + h + 0.05);
    });
    k.hipRoof(5.0, 1.0, 0.45, 0, y + 4 * STOREY, -1.45);
    k.aircon(2.58, y + 0.3, 0.55, Math.PI / 2);
    k.bicycleRack(1.6, 1.6, 3, y);
    return;
  }
  // 15: Residences: U-shape with red roofs, gold band, entrance gate
  const back = corridorBlock(k, { bw: 3.0, bd: 1.2, bz: -1.3, storeys: 4, y, roof: 'hip' });
  for (const s of [-1, 1]) {
    const wx = s * 2.2, wz = -0.3;
    const h = k.block(1.3, 2.6, 3, wx, y, wz);
    k.hipRoof(1.3, 2.6, 0.5, wx, y + h, wz);
    for (let f = 0; f < 3; f++) k.windowRow(s < 0 ? 'right' : 'left', wx, wz, 1.3, 2.6, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
    for (let f = 0; f < 3; f++) k.window('front', wx, wz, 1.3, 2.6, 0, y + f * STOREY + 0.42);
    k.box(1.34, 0.06, 2.64, '#d9b24a', wx, y + h - 0.12, wz);
  }
  k.box(3.04, 0.06, 1.24, '#d9b24a', 0, y + back - 0.12, -1.3);
  k.box(2.4, 0.04, 1.4, '#6cbf45', 0, y, 0.35);
  supertree(k, 0, 0.4, 0.9, y + 0.04, '#d98a3c');
  k.arch(0, 1.75, 1.6, 'RESIDENCES', y);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 2.72, 1.75, false);
  if (level === 16) {
    // L-shape: three-storey range at the back, two-storey wing stepping forward on the right.
    const h = ribbonBlock(k, -0.6, -0.9, 3.6, 1.4, 3, y);
    ribbonBlock(k, 1.75, 0.0, 1.3, 2.4, 2, y);
    k.glassBox(1.0, 2 * STOREY - 0.1, 0.5, -0.6, y, 0.05);
    k.door('front', -0.6, 0.05, 1.0, 0.5, 0, y, 0.5, 0.66, DARK_GLASS);
    k.solarPanels(-0.6, y + h + 0.1, -0.9, 3.0, 0.8);
    k.hedge(1.75, 0.0, 1.0, 2.0, y + 2 * STOREY + 0.1);
    return;
  }
  if (level === 17) {
    // Stacked modular pods with coloured doors and steel walkways
    const accents = ['#2bb3a3', '#ff8a3d', '#ffc93c', '#5d8aa3'];
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < 4; i++) {
        const px = -1.8 + i * 1.2 + (f % 2) * 0.3;
        k.box(1.1, STOREY - 0.05, 1.5, i % 2 ? C.wallAlt : CONCRETE, px, y + f * STOREY, -0.75);
        k.box(0.3, 0.6, 0.04, accents[(i + f) % 4], px - 0.25, y + f * STOREY, 0.01);
        k.box(0.4, 0.28, 0.04, DARK_GLASS, px + 0.25, y + f * STOREY + 0.35, 0.01);
      }
      if (f > 0) {
        k.box(5.2, 0.05, 0.45, '#8a9196', 0.15, y + f * STOREY - 0.05, 0.25);
        k.box(5.2, 0.03, 0.03, C.metal, 0.15, y + f * STOREY + 0.3, 0.46);
      }
    }
    k.stairs(2.6, -0.2, 0.4, 1.6, 2 * STOREY);
    k.solarPanels(0, y + 3 * STOREY + 0.05, -0.75, 3.6, 0.8);
    return;
  }
  if (level === 18) {
    k.box(4.4, 2 * STOREY, 2.0, CONCRETE, 0, y, -0.75);
    for (let i = 0; i < 5; i++) k.box(0.5, 0.3, 0.04, DARK_GLASS, -1.8 + i * 0.9, y + STOREY + 0.35, 0.27);
    k.box(1.0, 0.9, 0.06, '#6b7075', 0, y, 0.28);
    k.box(0.03, 0.9, 0.07, C.dark, 0, y, 0.29);
    // Earth berms on both ends and green roof
    for (const s of [-1, 1]) {
      const g = new THREE.BufferGeometry();
      const pts = [
        0, 1.9, -1, 0, 1.9, 1, 0.8 * s, 0, 1, 0, 1.9, -1, 0.8 * s, 0, 1, 0.8 * s, 0, -1,
        0, 0, 1, 0, 1.9, 1, 0.8 * s, 0, 1, 0, 0, -1, 0.8 * s, 0, -1, 0, 1.9, -1,
      ];
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6cbf45', flatShading: true, side: THREE.DoubleSide }));
      m.position.set(s * 2.2, y, -0.75);
      k.add(m);
    }
    k.box(4.4, 0.08, 2.0, '#6cbf45', 0, y + 2 * STOREY, -0.75);
    for (const x of [-1.2, 1.2]) k.cyl(0.08, 0.35, '#8a9196', x, y + 2 * STOREY + 0.08, -1.2, 8);
    k.hedge(0, -0.4, 2.4, 0.25, y + 2 * STOREY + 0.08);
    return;
  }
  if (level === 19) {
    const h = ribbonBlock(k, 0, -0.65, 4.8, 1.8, 3, y);
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: '#284a73', flatShading: true, roughness: 0.4 }));
      p.position.set(0, y + h + 0.3, -1.25 + i * 0.6);
      p.rotation.x = -0.6;
      k.add(p);
      k.box(4.6, 0.3, 0.04, C.white, 0, y + h + 0.1, -1.0 + i * 0.6);
    }
    k.fins(4.8, h - 0.2, 0, y + 0.1, 0.32, 14);
    k.door('front', 0, -0.65, 4.8, 1.8, 0, y, 0.5, 0.66, DARK_GLASS);
    return;
  }
  // 20: modern courtyard U with glass corners and a small supertree
  ribbonBlock(k, 0, -1.2, 4.8, 0.9, 3, y);
  for (const s of [-1, 1]) {
    ribbonBlock(k, s * 1.95, 0.05, 0.9, 1.6, 3, y);
    k.glassBox(0.9, 4 * STOREY - 0.1, 0.9, s * 1.95, y, -1.2);
    k.box(0.92, 0.08, 1.62, '#d9b24a', s * 1.95, y + 3 * STOREY + 0.1, 0.05);
  }
  k.box(3.0, 0.08, 0.92, '#d9b24a', 0, y + 3 * STOREY + 0.1, -1.2);
  k.box(3.0, 0.05, 1.6, '#6cbf45', 0, y, 0.05);
  supertree(k, 0, 0.1, 1.1, y + 0.05);
  k.hedge(-0.9, 0.6, 0.5, 0.2, y + 0.05);
  k.hedge(0.9, 0.6, 0.5, 0.2, y + 0.05);
}

export function buildBunk(level: number): Kit {
  const k = new Kit();
  const y = k.pad(6, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const BUNK: BuildingDef = {
  id: 'bunk',
  name: 'Bunk',
  role: 'Houses Recruits. Higher levels house more and help them rest faster.',
  footprint: [6, 4],
  unlockHq: 1,
  levels: BUNK_LEVELS,
  designedLevels: 20,
  build: buildBunk,
};

