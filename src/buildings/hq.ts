import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * HQ — the heart of the outpost. Its level caps every other building's level,
 * unlocks new buildings and gates land clearance. 15 designed levels in four bands:
 *   Field (1–3) → Camp (4–6) → Base (7–10, release cap) → Command (11–15) → Strategic (16–20, reserve)
 */

const L = (
  level: number, title: string, supplies: number, reputation: number, buildTime: number,
  hp: number, storage: number, crews: number, unlocks: string[],
): LevelStats => ({ level, title, supplies, reputation, buildTime, hp, stats: { storage, crews }, unlocks });

export const HQ_LEVELS: LevelStats[] = [
  L(1, 'Command Tent', 0, 0, 0, 1200, 2_000, 2, ['Bunk', 'Cookhouse', 'QM Store']),
  L(2, 'Field Office', 1_000, 0, 5 * MIN, 1600, 5_000, 2, ['Workshop', 'Utilities', 'Mama Shop', 'Clear jungle zones 1–2']),
  L(3, 'Admin Hut', 4_000, 50, 30 * MIN, 2100, 10_000, 2, ['Admin Office', 'Rec Centre', '2nd Bunk', 'Clear zones 3–4']),
  L(4, 'Camp HQ', 12_000, 150, 2 * HOUR, 2700, 20_000, 2, ['Medical Centre', 'Motor Pool', '2nd QM Store', 'Clear zones 5–6']),
  L(5, 'Camp HQ · East Wing', 30_000, 350, 4 * HOUR, 3400, 35_000, 3, ['Parade Square', '3rd Bunk', '3rd construction crew', 'Clear zones 7–8']),
  L(6, 'Admin Block · Veranda', 60_000, 600, 8 * HOUR, 4200, 50_000, 3, ['Guardhouse', 'Sentry Tower', 'Sandbag Wall', 'Raids begin', 'Clear zones 9–10']),
  L(7, 'Admin Block · Courtyard', 120_000, 1_000, 12 * HOUR, 5100, 75_000, 3, ['Training Shed', '4th Bunk', 'Clear zones 11–12']),
  L(8, 'Headquarters', 220_000, 1_500, 1 * DAY, 6100, 100_000, 3, ['Mortar Pit', '2nd Cookhouse', 'Boat Jetty (Cove)', 'Adventure Training Centre (Lakeside)']),
  L(9, 'Headquarters · Clock Tower', 400_000, 2_200, 1.5 * DAY, 7200, 150_000, 4, ['Searchlight', 'Armoury', 'Signal Station (Ridge)', '4th construction crew']),
  L(10, 'HQ Complex', 700_000, 3_000, 2 * DAY, 8500, 200_000, 4, ['Firing Range', '5th Bunk', 'All buildings to Lv 10']),
  L(11, 'Ops Block · Radar', 1_100_000, 4_000, 3 * DAY, 10000, 275_000, 4, ['Artillery Emplacement', 'Buildings to Lv 11']),
  L(12, 'Command HQ · Atrium', 1_600_000, 5_200, 4 * DAY, 11600, 350_000, 4, ['Buildings to Lv 12', '6th Bunk']),
  L(13, 'Helipad Tower', 2_200_000, 6_600, 5 * DAY, 13400, 450_000, 5, ['Air Defence', '5th construction crew', 'Buildings to Lv 13']),
  L(14, 'Command Centre · Twin Towers', 3_000_000, 8_200, 6 * DAY, 15400, 575_000, 5, ['Buildings to Lv 14']),
  L(15, 'Command Centre · Landmark', 4_000_000, 10_000, 7 * DAY, 17500, 700_000, 5, ['Buildings to Lv 15', 'Landmark status']),
  // Reserve levels (designed in advance; not yet scheduled for release).
  L(16, 'Strategic HQ · Rotunda', 5_200_000, 12_000, 8 * DAY, 19800, 850_000, 5, ['Buildings to Lv 16']),
  L(17, 'Strategic HQ · Skybridge', 6_600_000, 14_500, 9 * DAY, 22300, 1_000_000, 6, ['Buildings to Lv 17', '6th construction crew']),
  L(18, 'Strategic HQ · Control Tower', 8_200_000, 17_000, 10 * DAY, 25000, 1_200_000, 6, ['Buildings to Lv 18']),
  L(19, 'Strategic HQ · Satellite Uplink', 10_000_000, 20_000, 11 * DAY, 28000, 1_400_000, 6, ['Buildings to Lv 19']),
  L(20, 'Citadel · Gardens', 12_000_000, 23_000, 12 * DAY, 31000, 1_600_000, 7, ['Buildings to Lv 20', '7th construction crew', 'Citadel status']),
];

// ------------------------------------------------------------------ visuals

/** Pediment: small gable on top of a portico. */
function pediment(k: Kit, x: number, y: number, z: number, w: number) {
  k.gableRoof(w, 0.5, 0.32, x, y, z, C.roof, 0.08, C.white, false);
}

function portico(k: Kit, z: number, w: number, y: number, cols = 6, withPediment = true) {
  k.porch(0, z, w, 0.8, 0.9, y, cols, C.white);
  if (withPediment) {
    k.box(0.6, 0.18, 0.84, C.trim, 0, y + 0.98, z);
    pediment(k, 0, y + 1.0, z, w * 0.7);
  }
}

function frontWindows(k: Kit, bx: number, bz: number, bw: number, bd: number, floors: number, y: number, count: number, skip: number[] = [], louvreFrom = 1) {
  for (let f = 0; f < floors; f++) k.windowRow('front', bx, bz, bw, bd, count, y + f * STOREY + 0.42, { skip: f === 0 ? skip : [], louvre: f >= louvreFrom });
}

function sideWindows(k: Kit, bx: number, bz: number, bw: number, bd: number, floors: number, y: number, n = 2) {
  for (let f = 0; f < floors; f++) {
    k.windowRow('left', bx, bz, bw, bd, n, y + f * STOREY + 0.42);
    k.windowRow('right', bx, bz, bw, bd, n, y + f * STOREY + 0.42);
  }
}

function aircons(k: Kit, x: number, bz: number, floors: number, y: number, side: 1 | -1) {
  for (let f = 0; f < floors; f++) k.aircon(x + side * 0.08, y + f * STOREY + 0.25, bz - 0.35, (side * Math.PI) / 2);
}

/** Field band (1–3): tent → timber field office → admin hut. */
function field(k: Kit, level: number, y: number) {
  k.path(0.8, 1.7, 0, 2.05, y);
  if (level === 1) {
    k.tent(2.4, 1.6, -0.2, -0.6, y);
    k.radioTable(1.55, -0.35, y);
    k.fieldFlag(-2.25, 2.1, y);
    k.crates(1.75, -1.85, y, 4);
    k.sandbags(-1.55, 1.15, 1.3, 0.35, y);
    k.sandbags(1.35, 1.3, 1.0, -0.3, y);
    k.drum(-2.2, -1.85, '#2f6fa8', y);
    k.drum(-1.95, -1.95, '#5b6b3a', y);
    return;
  }
  if (level === 2) {
    const bw = 2.8, bd = 1.8, bz = -0.75;
    const h = k.block(bw, bd, 1, 0, y, bz, C.wood);
    for (let i = 1; i < 6; i++) k.box(bw + 0.01, 0.015, bd + 0.01, '#8a5a3b', 0, y + i * 0.15, bz); // plank lines
    k.gableRoof(bw, bd, 0.5, 0, y + h, bz, C.zinc, 0.18, C.wood);
    // Veranda with a lean-to
    k.box(bw, 0.07, 0.7, '#9c6b45', 0, y, bz + bd / 2 + 0.35);
    for (const x of [-1.3, 0, 1.3]) k.box(0.07, 0.72, 0.07, '#8a5a3b', x, y + 0.07, bz + bd / 2 + 0.65);
    k.box(bw + 0.2, 0.05, 0.85, C.zinc, 0, y + 0.8, bz + bd / 2 + 0.38);
    k.door('front', 0, bz, bw, bd, 0, y + 0.07);
    k.windowRow('front', 0, bz, bw, bd, 2, y + 0.45, { span: 1.8 });
    k.windowRow('left', 0, bz, bw, bd, 1, y + 0.45);
    k.flagpole(-2.3, 2.15, 1.9, y);
    k.antenna(1.75, y, -1.95, 1.4);
    k.crates(2.0, 0.95, y, 3);
    k.drum(-2.15, -1.6, '#2f6fa8', y);
    k.drum(-1.9, -1.75, '#5b6b3a', y);
    k.sandbags(-1.5, 1.7, 1.0, 0, y);
    k.radioTable(-1.9, 0.6, y);
    return;
  }
  // Level 3: first permanent building.
  const bw = 3.2, bd = 1.9, bz = -0.75;
  const h = k.block(bw, bd, 1, 0, y, bz);
  k.gableRoof(bw, bd, 0.55, 0, y + h, bz, C.zinc);
  k.door('front', 0, bz, bw, bd, 0, y);
  k.windowRow('front', 0, bz, bw, bd, 4, y + 0.42, { louvre: true });
  sideWindows(k, 0, bz, bw, bd, 1, y);
  k.porch(0, bz + bd / 2 + 0.38, 0.9, 0.7, 0.72, y);
  k.aircon(bw / 2 + 0.08, y + 0.25, bz - 0.35, Math.PI / 2);
  k.flagpole(-2.3, 2.15, 2.0, y);
  k.planter(-1.0, 0.75, 0.6, y);
  k.plaque('HQ', 1.6, 2.2, y, 0.8);
  k.noticeboard(2.35, 0.35, -Math.PI / 2, y);
  k.crates(-2.2, -1.9, y, 2);
}

/** Camp band (4–6): each level changes the silhouette, not just the details. */
function camp(k: Kit, level: number, y: number) {
  k.path(0.9, 1.6, 0, 2.1, y);
  k.flagpole(-2.35, 2.2, level >= 6 ? 2.4 : 2.1, y);
  k.plaque('HQ', 1.6, 2.25, y, 0.85);

  if (level === 4) {
    // Simple rectangle: one storey, red hip roof, small porch.
    const bw = 3.5, bd = 2.0, bz = -0.8;
    const h = k.block(bw, bd, 1, 0, y, bz);
    k.hipRoof(bw, bd, 0.6, 0, y + h, bz);
    k.door('front', 0, bz, bw, bd, 0, y, 0.42);
    frontWindows(k, 0, bz, bw, bd, 1, y, 5, [2]);
    sideWindows(k, 0, bz, bw, bd, 1, y);
    k.porch(0, bz + bd / 2 + 0.42, 1.2, 0.8, 0.74, y);
    aircons(k, bw / 2, bz, 1, y, 1);
    k.planter(-1.0, 0.85, 0.6, y);
    k.planter(1.0, 0.85, 0.6, y);
    return;
  }

  if (level === 5) {
    // L-shape: main block shifts left, a red-roofed east wing projects forward,
    // and a raised entrance gable marks the door.
    const bw = 3.2, bd = 1.8, bx = -0.8, bz = -1.2;
    const h = k.block(bw, bd, 1, bx, y, bz);
    k.hipRoof(bw, bd, 0.6, bx, y + h, bz);
    frontWindows(k, bx, bz, bw, bd, 1, y, 4, [1]);
    sideWindows(k, bx, bz, bw, bd, 1, y);
    // Entrance gable (front-facing): rotated gable roof over a projecting bay.
    const ex = bx - 0.4, ez = bz + bd / 2 + 0.35;
    k.block(1.0, 0.7, 1, ex, y, ez, C.wallAlt);
    const eg = new Kit();
    eg.gableRoof(0.7, 1.0, 0.45, 0, 0, 0, C.roof, 0.12);
    eg.group.rotation.y = Math.PI / 2;
    eg.group.position.set(ex, y + STOREY, ez);
    k.add(eg.group);
    k.door('front', ex, ez, 1.0, 0.7, 0, y, 0.4);
    // East wing, perpendicular, reaching toward the front
    const wx = 1.75, ww = 1.3, wd = 3.0, wz = -0.4;
    const wh = k.block(ww, wd, 1, wx, y, wz);
    k.hipRoof(ww, wd, 0.55, wx, y + wh, wz);
    k.windowRow('left', wx, wz, ww, wd, 3, y + 0.42);
    k.windowRow('front', wx, wz, ww, wd, 1, y + 0.42);
    k.door('left', wx, wz, ww, wd, 1.0, y, 0.34);
    aircons(k, wx + ww / 2, wz, 1, y, 1);
    k.linkway(ex + 0.5, ez + 0.75, wx - ww / 2 - 0.05, ez + 0.75, y, 0.7, 0.55);
    k.antenna(bx - 1.0, y + h + 0.3, bz - 0.3, 1.3);
    k.planter(-2.2, 0.8, 0.6, y);
    k.lamp(0.5, 1.5, y);
    return;
  }

  // Level 6: two storeys with a full-width green veranda and a rooftop water tank.
  const bw = 4.2, bd = 1.9, bz = -1.0;
  const h = k.block(bw, bd, 2, 0, y, bz);
  k.hipRoof(bw, bd, 0.7, 0, y + h, bz);
  frontWindows(k, 0, bz, bw, bd, 2, y, 5, [2]);
  k.window('front', 0, bz, bw, bd, 0, y + STOREY + 0.42);
  sideWindows(k, 0, bz, bw, bd, 2, y);
  k.door('front', 0, bz, bw, bd, 0, y, 0.44);
  // Veranda: columns + green lean-to roof along the whole front
  const vz = bz + bd / 2 + 0.4;
  k.box(bw, 0.05, 0.8, '#c9c3b5', 0, y, vz);
  for (let i = 0; i < 6; i++) k.box(0.08, 0.78, 0.08, C.white, -bw / 2 + 0.1 + (i * (bw - 0.2)) / 5, y, vz + 0.32);
  k.box(bw + 0.2, 0.07, 0.95, C.roofGreen, 0, y + 0.8, vz);
  k.box(bw + 0.22, 0.04, 0.97, C.white, 0, y + 0.78, vz);
  k.waterTank(1.2, y + h + 0.1, bz - 0.3, 0.2, 0.32);
  k.antenna(-1.3, y + h + 0.35, bz - 0.25, 1.3);
  aircons(k, bw / 2, bz, 2, y, 1);
  aircons(k, -bw / 2, bz + 0.6, 2, y, -1);
  k.noticeboard(2.45, 0.9, -Math.PI / 2, y);
  k.lamp(-1.3, 2.4, y);
  k.planter(-1.4, 1.75, 0.6, y);
}

/** Base band (7–10): balcony + annex → three storeys → clock tower → HQ complex. */
function base(k: Kit, level: number, y: number) {
  k.path(1.0, 1.4, 0, 2.2, y);
  if (level === 7) {
    // U-shape: two-storey main range, two forward wings, projecting gabled entrance with a balcony.
    const bw = 3.0, bd = 1.6, bz = -1.5;
    const h = k.block(bw, bd, 2, 0, y, bz);
    k.hipRoof(bw, bd, 0.65, 0, y + h, bz);
    frontWindows(k, 0, bz, bw, bd, 2, y, 4, [1, 2]);
    for (const s of [-1, 1]) {
      const wx = s * 1.95, ww = 1.1, wd = 3.0, wz = -0.8;
      const wh = k.block(ww, wd, 2, wx, y, wz);
      k.hipRoof(ww, wd, 0.55, wx, y + wh, wz);
      for (let f = 0; f < 2; f++) {
        k.windowRow(s < 0 ? 'right' : 'left', wx, wz, ww, wd, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
        k.window('front', wx, wz, ww, wd, 0, y + f * STOREY + 0.42);
      }
      aircons(k, wx + (s * ww) / 2, wz, 2, y, s as 1 | -1);
    }
    // Central entrance bay
    const ez = bz + bd / 2 + 0.45;
    const eh = k.block(1.2, 0.9, 2, 0, y, ez, C.wallAlt);
    const eg = new Kit();
    eg.gableRoof(0.9, 1.2, 0.5, 0, 0, 0, C.roof, 0.12, C.white);
    eg.group.rotation.y = Math.PI / 2;
    eg.group.position.set(0, y + eh, ez);
    k.add(eg.group);
    k.door('front', 0, ez, 1.2, 0.9, 0, y, 0.44);
    k.box(1.0, 0.08, 0.35, '#cfc9bc', 0, y + STOREY - 0.04, ez + 0.6);
    k.box(1.0, 0.26, 0.04, C.white, 0, y + STOREY, ez + 0.76);
    k.window('front', 0, ez, 1.2, 0.9, 0, y + STOREY + 0.42, 0.5, 0.42);
    for (const s of [-0.45, 0.45]) k.box(0.07, STOREY - 0.04, 0.07, C.white, s, y, ez + 0.74);
    // Courtyard
    k.box(2.2, 0.015, 1.3, '#e3dccb', 0, y, 1.3);
    k.flagpole(0, 1.25, 2.5, y);
    k.hedge(-0.9, 1.9, 0.6, 0.22, y);
    k.hedge(0.9, 1.9, 0.6, 0.22, y);
    k.antenna(1.0, y + h + 0.35, bz - 0.25, 1.5);
    k.plaque('HQ', 1.65, 2.45, y, 0.9);
    k.lamp(-1.3, 2.45, y);
    k.lamp(0.85, 2.45, y);
    return;
  }
  // 8–10: three-storey main block with single-storey (8–9) or two-storey (10) wings.
  const complex = level === 10;
  const bw = complex ? 3.4 : 3.6, bd = 2.0, bz = complex ? -1.5 : -0.95;
  const h = k.block(bw, bd, 3, 0, y, bz);
  k.hipRoof(bw, bd, 0.7, 0, y + h, bz);
  const tower = level >= 9;
  frontWindows(k, 0, bz, bw, bd, 3, y, 6, tower ? [] : [2, 3]);
  sideWindows(k, 0, bz, bw, bd, 3, y);
  const wingStoreys = complex ? 2 : 1;
  const ww = complex ? 1.0 : 0.75, wd = complex ? 1.8 : 1.6, wz = bz - 0.05;
  for (const s of [-1, 1]) {
    const wx = s * (bw / 2 + ww / 2);
    const wh = k.block(ww, wd, wingStoreys, wx, y, wz, C.wallAlt);
    if (complex) k.hipRoof(ww, wd, 0.45, wx, y + wh, wz);
    else k.flatRoof(ww, wd, wx, y + wh, wz);
    k.windowRow('front', wx, wz, ww, wd, 1, y + 0.42);
    if (complex) k.windowRow('front', wx, wz, ww, wd, 1, y + STOREY + 0.42);
    aircons(k, wx + (s * ww) / 2, wz, wingStoreys, y, s as 1 | -1);
  }
  if (!tower) {
    k.door('front', 0, bz, bw, bd, 0, y, 0.46, 0.66);
    k.porch(0, bz + bd / 2 + 0.45, 1.8, 0.85, STOREY - 0.05, y, 4);
  } else {
    const tw = 1.3, td = complex ? 1.1 : 0.9, tz = bz + bd / 2 + td / 2 - 0.05;
    const floors = complex ? 5 : 4;
    const th = k.block(tw, td, floors, 0, y, tz, C.wallAlt);
    k.flatRoof(tw, td, 0, y + th, tz);
    k.door('front', 0, tz, tw, td, 0, y, 0.5, 0.66);
    for (let f = 1; f < floors; f++) k.window('front', 0, tz, tw, td, 0, y + f * STOREY + 0.36, 0.66, 0.44);
    clock(k, y + (floors - 1) * STOREY + 0.55, tz + td / 2);
    k.dish(0.35, y + th + 0.06, tz - 0.15);
    k.antenna(-0.35, y + th + 0.06, tz - 0.2, 1.3);
    if (complex) portico(k, tz + td / 2 + 0.42, 2.2, y, 6);
    else k.porch(0, tz + td / 2 + 0.42, 1.8, 0.8, STOREY - 0.05, y, 4);
  }
  k.flagpole(-2.4, 2.3, 2.6, y);
  if (level >= 8) k.flagpole(2.4, 2.3, 2.6, y);
  k.planter(-1.35, complex ? 1.85 : 1.25, 0.8, y);
  k.planter(1.35, complex ? 1.85 : 1.25, 0.8, y);
  k.plaque(complex ? 'HEADQUARTERS' : 'HQ', complex ? -1.25 : 1.35, 2.55, y, complex ? 1.25 : 0.9);
  k.lamp(-0.75, 2.6, y);
  k.lamp(0.6, 2.6, y);
  if (!complex) k.antenna(1.3, y + h + 0.35, bz - 0.25, 1.4);
}

function clock(k: Kit, y: number, z: number) {
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f7f5ef', flatShading: true }));
  face.position.set(0, y, z + 0.04);
  k.add(face);
  k.cyl(0.215, 0.03, C.trim, 0, y - 0.015, z + 0.02, 16);
  k.box(0.02, 0.14, 0.02, C.dark, 0, y - 0.02, z + 0.07);
  k.box(0.1, 0.02, 0.02, C.dark, 0.04, y, z + 0.07);
}

/** Command band (11–15): every level gets its own massing. */
function command(k: Kit, level: number, y: number) {
  k.path(1.2, 1.3, 0, 2.25, y);
  if (level === 11) opsRadar(k, y);
  else if (level === 12) atrium(k, y);
  else if (level === 13) helipadTower(k, y);
  else if (level === 14) twinTowers(k, y);
  else landmark(k, y);
}

/** Shared forecourt: flags, lamps, planters, name plaque. */
function forecourt(k: Kit, y: number, name: string, plaque = true) {
  k.flagpole(-2.4, 2.3, 2.8, y);
  k.flagpole(2.4, 2.3, 2.8, y);
  k.lamp(-0.85, 2.65, y);
  k.lamp(0.7, 2.65, y);
  if (plaque) k.plaque(name, -1.25, 2.6, y, 1.25);
}

/** Low red-roofed pavilion: keeps the camp look on the modern levels. */
function pavilion(k: Kit, x: number, z: number, w: number, d: number, y: number, storeys = 1) {
  const h = k.block(w, d, storeys, x, y, z);
  k.hipRoof(w, d, 0.45, x, y + h, z);
  k.window('front', x, z, w, d, 0, y + 0.42);
  return h;
}

/** 11 — Ops Block: broad four-storey flat-roofed block crowned by a giant radar dome. */
function opsRadar(k: Kit, y: number) {
  const bw = 3.6, bd = 2.2, bz = -1.2;
  const h = k.block(bw, bd, 4, 0, y, bz);
  k.flatRoof(bw, bd, 0, y + h, bz);
  frontWindows(k, 0, bz, bw, bd, 4, y, 6, [2, 3]);
  sideWindows(k, 0, bz, bw, bd, 4, y);
  // Radar drum + big dome
  k.cyl(0.6, 0.45, C.wallAlt, 0, y + h + 0.06, bz, 12);
  k.cyl(0.64, 0.06, C.trim, 0, y + h + 0.51, bz, 12);
  k.radarDome(0, y + h + 0.5, bz, 0.72);
  k.dish(1.4, y + h + 0.06, bz - 0.6, 0.6);
  k.dish(-1.4, y + h + 0.06, bz - 0.6, 2.4);
  // Projecting entrance with a clock over it
  const ez = bz + bd / 2 + 0.4;
  const eh = k.block(1.4, 0.8, 2, 0, y, ez, C.wallAlt);
  k.flatRoof(1.4, 0.8, 0, y + eh, ez);
  clock(k, y + STOREY + 0.5, ez + 0.4);
  k.door('front', 0, ez, 1.4, 0.8, 0, y, 0.5, 0.66);
  k.porch(0, ez + 0.75, 1.2, 0.6, 0.8, y, 2);
  // Camp-style pavilions either side
  for (const s of [-1, 1]) pavilion(k, s * 2.35, -0.2, 1.0, 1.6, y);
  aircons(k, bw / 2, bz, 4, y, 1);
  aircons(k, -bw / 2, bz, 4, y, -1);
  k.planter(-1.4, 1.8, 0.7, y);
  k.planter(1.4, 1.8, 0.7, y);
  forecourt(k, y, 'COMMAND HQ');
}

/** 12 — Atrium: full-width glass atrium across the front; roof garden on top. */
function atrium(k: Kit, y: number) {
  const bw = 4.6, bd = 2.0, bz = -1.6;
  const h = k.block(bw, bd, 4, 0, y, bz);
  k.flatRoof(bw, bd, 0, y + h, bz);
  frontWindows(k, 0, bz, bw, bd, 4, y, 7, []);
  sideWindows(k, 0, bz, bw, bd, 4, y);
  // Roof garden: hedges, a small tree canopy and a pergola
  const ry = y + h + 0.06;
  k.hedge(-1.5, bz + 0.6, 1.2, 0.3, ry);
  k.hedge(1.5, bz + 0.6, 1.2, 0.3, ry);
  for (const x of [-1.2, 0, 1.2]) {
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#4fae3a', flatShading: true }));
    t.position.set(x, ry + 0.45, bz - 0.35);
    k.add(t);
    k.box(0.05, 0.3, 0.05, '#8a5a3b', x, ry, bz - 0.35);
  }
  k.radarDome(1.7, ry, bz - 0.5, 0.3);
  // Full-width glass atrium, two storeys, with sun fins and a long canopy
  const az = bz + bd / 2 + 0.65;
  k.glassBox(4.6, 2 * STOREY - 0.1, 1.3, 0, y, az);
  k.fins(4.6, 2 * STOREY - 0.2, 0, y + 0.05, az + 0.7, 12);
  k.door('front', 0, az, 4.6, 1.3, 0, y, 0.6, 0.7, '#3d5a6c');
  k.box(2.2, 0.08, 0.6, C.roofGreen, 0, y + 0.9, az + 0.95);
  for (const s of [-1, 1]) k.box(0.06, 0.9, 0.06, C.white, s * 1.0, y, az + 1.2);
  clock(k, y + 3 * STOREY + 0.5, bz + bd / 2);
  aircons(k, bw / 2, bz, 4, y, 1);
  aircons(k, -bw / 2, bz, 4, y, -1);
  forecourt(k, y, 'COMMAND HQ');
}

/** 13 — Helipad Tower: asymmetric; a tall six-storey slab carries the helipad. */
function helipadTower(k: Kit, y: number) {
  // Lower four-storey block on the left
  const lw = 2.8, ld = 2.0, lx = -0.9, lz = -1.4;
  const lh = k.block(lw, ld, 4, lx, y, lz);
  k.hipRoof(lw, ld, 0.6, lx, y + lh, lz);
  frontWindows(k, lx, lz, lw, ld, 4, y, 4, [1, 2]);
  k.windowRow('left', lx, lz, lw, ld, 2, y + 0.42);
  // Tall slab on the right
  const tw = 1.7, td = 2.6, tx = 1.55, tz = -1.1;
  const th = k.block(tw, td, 6, tx, y, tz, C.wallAlt);
  k.flatRoof(tw, td, tx, y + th, tz);
  for (let f = 0; f < 6; f++) {
    k.windowRow('front', tx, tz, tw, td, 2, y + f * STOREY + 0.42, { louvre: f > 0 });
    k.windowRow('left', tx, tz, tw, td, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
  }
  k.fins(tw - 0.1, 6 * STOREY - 0.3, tx, y + 0.15, tz + td / 2 + 0.07, 5);
  k.helipad(tx, y + th + 0.06, tz, 1.5);
  k.windsock(tx + 0.75, y + th + 0.06, tz - 1.1);
  aircons(k, tx + tw / 2, tz, 6, y, 1);
  // Glass link between the two blocks, and a glass entrance on the low block
  k.glassBox(1.1, 2 * STOREY - 0.1, 1.0, lx + 0.4, y, lz + ld / 2 + 0.5);
  k.door('front', lx + 0.4, lz + ld / 2 + 0.5, 1.1, 1.0, 0, y, 0.5, 0.66, '#3d5a6c');
  k.box(1.3, 0.07, 0.5, C.roofGreen, lx + 0.4, y + 0.9, lz + ld / 2 + 1.2);
  clock(k, y + 3 * STOREY + 0.5, lz + ld / 2);
  k.radarDome(lx - 0.7, y + lh + 0.25, lz, 0.28);
  k.hedge(-2.2, 1.0, 0.8, 0.25, y);
  forecourt(k, y, 'COMMAND HQ');
}

/** 14 — Command Centre: twin towers bridged by a glass block, giant comms mast between. */
function twinTowers(k: Kit, y: number) {
  for (const s of [-1, 1]) {
    const tw = 1.35, td = 2.2, tx = s * 1.8, tz = -1.2;
    const th = k.block(tw, td, 6, tx, y, tz);
    k.hipRoof(tw, td, 0.5, tx, y + th, tz);
    for (let f = 0; f < 6; f++) {
      k.windowRow('front', tx, tz, tw, td, 2, y + f * STOREY + 0.42, { louvre: f > 0 });
      k.windowRow(s < 0 ? 'left' : 'right', tx, tz, tw, td, 2, y + f * STOREY + 0.42);
    }
    k.fins(tw - 0.1, 6 * STOREY - 0.3, tx, y + 0.15, tz + td / 2 + 0.07, 4);
    aircons(k, tx + (s * tw) / 2, tz, 6, y, s as 1 | -1);
  }
  // Glass bridge block: four storeys between the towers
  const bw = 2.25, bd = 1.8, bz = -1.3;
  k.glassBox(bw, 4 * STOREY - 0.1, bd, 0, y, bz);
  k.flatRoof(bw, bd, 0, y + 4 * STOREY, bz);
  k.latticeMast(0, y + 4 * STOREY + 0.06, bz - 0.1, 4.0, 0.7);
  // Entrance canopy and clock on the bridge
  k.door('front', 0, bz, bw, bd, 0, y, 0.6, 0.7, '#3d5a6c');
  k.box(1.6, 0.08, 0.7, C.roofGreen, 0, y + 0.9, bz + bd / 2 + 0.35);
  for (const s of [-0.7, 0.7]) k.box(0.06, 0.9, 0.06, C.white, s, y, bz + bd / 2 + 0.65);
  k.hedge(-1.6, 1.4, 1.0, 0.25, y);
  k.hedge(1.6, 1.4, 1.0, 0.25, y);
  forecourt(k, y, 'COMMAND CENTRE');
}

/** 15 — Landmark: one eight-storey tower with a gold crown on a stepped podium. */
function landmark(k: Kit, y: number) {
  // Podium: three storeys, stepped
  const pw = 3.4, pd = 2.4, pz = -1.3;
  const ph = k.block(pw, pd, 2, 0, y, pz);
  k.flatRoof(pw, pd, 0, y + ph, pz);
  frontWindows(k, 0, pz, pw, pd, 2, y, 6, [2, 3]);
  // Red-roofed camp wings
  for (const s of [-1, 1]) {
    const h = pavilion(k, s * 2.35, -1.0, 1.1, 2.0, y, 2);
    k.window('front', s * 2.35, -1.0, 1.1, 2.0, 0, y + STOREY + 0.42);
    void h;
  }
  // Tower
  const tw = 1.4, td = 1.4, tz = pz;
  const floors = 8;
  const th = k.block(tw, td, floors, 0, y, tz, C.wallAlt);
  for (let f = 2; f < floors; f++) {
    k.window('front', 0, tz, tw, td, -0.32, y + f * STOREY + 0.36, 0.3, 0.44);
    k.window('front', 0, tz, tw, td, 0.32, y + f * STOREY + 0.36, 0.3, 0.44);
    k.window('right', 0, tz, tw, td, 0, y + f * STOREY + 0.36, 0.5, 0.44);
  }
  clock(k, y + (floors - 1) * STOREY + 0.5, tz + td / 2);
  // Gold crown: band, open belvedere, pyramid, spire
  k.box(tw + 0.16, 0.12, td + 0.16, '#d9b24a', 0, y + th, tz);
  const cy = y + th + 0.12;
  for (const [cx, cz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) k.box(0.16, 0.85, 0.16, C.white, cx, cy, tz + cz);
  k.box(0.7, 0.85, 0.7, '#5d8aa3', 0, cy, tz);
  k.box(1.2, 0.1, 1.2, '#d9b24a', 0, cy + 0.85, tz);
  k.hipRoof(1.1, 1.1, 0.6, 0, cy + 0.95, tz, '#d9b24a', 0.05);
  k.cyl(0.035, 0.7, '#d9b24a', 0, cy + 1.5, tz, 6, 0.005);
  // Grand entrance and plaza
  portico(k, pz + pd / 2 + 0.42, 2.0, y, 6);
  k.box(3.0, 0.015, 1.3, '#e3dccb', 0, y, 2.05);
  k.fountain(0, 1.95, 0.42, y);
  k.arch(0, 2.72, 2.1, 'COMMAND CENTRE', y);
  k.hedge(-1.6, 1.6, 0.8, 0.25, y);
  k.hedge(1.6, 1.6, 0.8, 0.25, y);
  forecourt(k, y, '', false);
  for (const s of [-2.4, 2.4]) k.cyl(0.05, 0.06, '#d9b24a', s, y + 2.9, 2.3, 8);
}


// ------------------------------------------------------------------ Strategic band (16–20, reserve)

const GOLD = '#d9b24a';

/** Gold belvedere crown with a pyramid and spire, sized by s. */
function crown(k: Kit, x: number, y: number, z: number, s = 1) {
  k.box(1.56 * s, 0.12, 1.56 * s, GOLD, x, y, z);
  const cy = y + 0.12;
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.16, 0.85 * s, 0.16, C.white, x + cx * 0.45 * s, cy, z + cz * 0.45 * s);
  k.box(0.7 * s, 0.85 * s, 0.7 * s, '#5d8aa3', x, cy, z);
  k.box(1.2 * s, 0.1, 1.2 * s, GOLD, x, cy + 0.85 * s, z);
  k.hipRoof(1.1 * s, 1.1 * s, 0.6 * s, x, cy + 0.85 * s + 0.1, z, GOLD, 0.05);
  k.cyl(0.035, 0.7 * s, GOLD, x, cy + 0.85 * s + 0.6 * s, z, 6, 0.005);
}

/** Plain tower shaft with windows on the two camera-facing sides; returns its top y. */
function shaft(k: Kit, x: number, z: number, w: number, d: number, floors: number, y: number, wall: string = C.wallAlt) {
  const h = k.block(w, d, floors, x, y, z, wall);
  for (let f = 1; f < floors; f++) {
    k.window('front', x, z, w, d, -w * 0.22, y + f * STOREY + 0.36, 0.28, 0.42);
    k.window('front', x, z, w, d, w * 0.22, y + f * STOREY + 0.36, 0.28, 0.42);
    k.window('right', x, z, w, d, 0, y + f * STOREY + 0.36, 0.4, 0.42);
  }
  return y + h;
}

function bigDish(k: Kit, x: number, y: number, z: number, r: number, rotY = 0.7) {
  k.cyl(0.18, 0.5, C.metal, x, y, z, 8);
  k.box(0.6, 0.12, 0.6, C.metal, x, y, z);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 3.3),
    new THREE.MeshStandardMaterial({ color: '#f4f4f0', flatShading: true, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  dish.position.set(x, y + 0.55 + r, z);
  dish.rotation.set(-2.2, rotY, 0);
  k.add(dish);
  // Feed horn on a tripod
  const fy = y + 0.55 + r * 0.55;
  k.cyl(0.02, r * 0.9, C.metal, x + Math.sin(rotY) * r * 0.35, fy, z + Math.cos(rotY) * r * 0.35, 4);
  k.box(0.12, 0.12, 0.12, C.dark, x + Math.sin(rotY) * r * 0.45, fy + r * 0.9, z + Math.cos(rotY) * r * 0.45);
}

/** Gardens-by-the-Bay-style "supertree": steel trunk, flared planted canopy. */
function supertree(k: Kit, x: number, z: number, h: number, y: number, color = '#8a5cb8') {
  k.cyl(0.16, h, '#6e6a78', x, y, z, 8, 0.07);
  for (let i = 0; i < 4; i++) k.box(0.06, h * 0.6, 0.02, '#4fae3a', x + Math.cos(i * 1.6) * 0.12, y + 0.2, z + Math.sin(i * 1.6) * 0.12);
  k.cyl(0.12, 0.35, color, x, y + h, z, 10, 0.6);
  k.cyl(0.62, 0.05, '#4fae3a', x, y + h + 0.35, z, 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.06, 0.06, 0.06, '#ffe48a', x + Math.cos(a) * 0.5, y + h + 0.36, z + Math.sin(a) * 0.5);
  }
}

function strategic(k: Kit, level: number, y: number) {
  k.path(1.2, 1.2, 0, 2.3, y);
  if (level === 16) rotunda(k, y);
  else if (level === 17) skybridge(k, y);
  else if (level === 18) controlTower(k, y);
  else if (level === 19) uplink(k, y);
  else citadel(k, y);
}

/** 16 — Rotunda: a round colonnaded hall with a green dome; the crowned tower rises through it. */
function rotunda(k: Kit, y: number) {
  const cz = -0.7, r = 2.0;
  k.cyl(r, 3 * STOREY, C.wall, 0, y, cz, 20);
  for (let f = 0; f <= 3; f++) k.cyl(r + 0.03, f === 3 ? 0.08 : 0.06, f === 3 ? C.white : C.trim, 0, y + f * STOREY - (f === 3 ? 0.08 : 0.03), cz, 20);
  // Windows around the upper floors
  for (let f = 1; f < 3; f++) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const w = k.box(0.3, 0.38, 0.05, C.glass, Math.sin(a) * (r + 0.02), y + f * STOREY + 0.28, cz + Math.cos(a) * (r + 0.02));
      w.rotation.y = a;
    }
  }
  // Ground-floor colonnade with a green ring canopy
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    k.cyl(0.06, 0.85, C.white, Math.sin(a) * (r + 0.35), y, cz + Math.cos(a) * (r + 0.35), 6);
  }
  k.cyl(r + 0.48, 0.08, C.roofGreen, 0, y + 0.85, cz, 20);
  // Dome around the tower base
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5e9e8a', flatShading: true }));
  dome.position.set(0, y + 3 * STOREY, cz);
  dome.scale.y = 0.7;
  k.add(dome);
  const top = shaft(k, 0, cz, 1.2, 1.2, 9, y);
  clock(k, top - 0.45, cz + 0.6);
  crown(k, 0, top, cz, 0.9);
  k.fountain(0, 2.35, 0.32, y);
  forecourt(k, y, '', false);
}

/** 17 — Skybridge: two crowned towers joined by a glass bridge high above a podium. */
function skybridge(k: Kit, y: number) {
  const pz = -1.1;
  const ph = k.block(4.8, 2.4, 2, 0, y, pz);
  k.flatRoof(4.8, 2.4, 0, y + ph, pz);
  frontWindows(k, 0, pz, 4.8, 2.4, 2, y, 8, [3, 4]);
  for (const s of [-1, 1]) {
    const top = shaft(k, s * 1.45, pz - 0.1, 1.3, 1.5, 9, y);
    crown(k, s * 1.45, top, pz - 0.1, 0.85);
  }
  k.glassBox(1.6, STOREY - 0.1, 0.8, 0, y + 6 * STOREY, pz - 0.1);
  k.glassBox(1.6, STOREY - 0.1, 0.8, 0, y + 3 * STOREY, pz - 0.1);
  clock(k, y + 7.5 * STOREY, pz + 0.65);
  k.glassBox(1.6, STOREY * 1.6, 0.7, 0, y, pz + 1.55);
  k.door('front', 0, pz + 1.55, 1.6, 0.7, 0, y, 0.5, 0.66, '#3d5a6c');
  for (const s of [-1, 1]) pavilion(k, s * 2.35, 1.05, 1.0, 0.9, y);
  forecourt(k, y, 'STRATEGIC HQ');
}

/** 18 — Control Tower: slender shaft carrying a wide glass observation deck. */
function controlTower(k: Kit, y: number) {
  const tz = -1.0;
  // Red-roofed two-storey wings and a glass lobby
  for (const s of [-1, 1]) {
    const wx = s * 1.75;
    const wh = k.block(1.6, 2.2, 2, wx, y, tz);
    k.hipRoof(1.6, 2.2, 0.5, wx, y + wh, tz);
    for (let f = 0; f < 2; f++) k.windowRow('front', wx, tz, 1.6, 2.2, 2, y + f * STOREY + 0.42, { louvre: f > 0 });
    aircons(k, wx + s * 0.8, tz, 2, y, s as 1 | -1);
  }
  k.glassBox(1.9, 2 * STOREY - 0.1, 1.4, 0, y, tz + 0.6);
  k.door('front', 0, tz + 0.6, 1.9, 1.4, 0, y, 0.5, 0.66, '#3d5a6c');
  // Shaft
  const sh = 10 * STOREY;
  k.box(1.0, sh, 1.0, C.wallAlt, 0, y, tz - 0.3);
  for (let f = 2; f < 10; f++) k.window('front', 0, tz - 0.3, 1.0, 1.0, 0, y + f * STOREY + 0.36, 0.22, 0.4);
  for (let f = 1; f < 10; f++) k.box(1.03, 0.05, 1.03, C.trim, 0, y + f * STOREY, tz - 0.3);
  // Flared support, glass cab, roof, radar
  const cy = y + sh;
  k.cyl(0.6, 0.5, C.white, 0, cy, tz - 0.3, 8, 1.2);
  k.cyl(1.2, 0.85, '#86b7cc', 0, cy + 0.5, tz - 0.3, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.box(0.05, 0.85, 0.05, C.trim, Math.sin(a) * 1.13, cy + 0.5, tz - 0.3 + Math.cos(a) * 1.13);
  }
  k.cyl(1.4, 0.1, C.roofGreen, 0, cy + 1.35, tz - 0.3, 8);
  k.radarDome(0, cy + 1.45, tz - 0.3, 0.4);
  k.antenna(0.8, cy + 1.45, tz - 0.6, 0.9);
  forecourt(k, y, 'STRATEGIC HQ');
}

/** 19 — Satellite Uplink: crowned tower beside a huge dish on its own block. */
function uplink(k: Kit, y: number) {
  const top = shaft(k, -1.35, -1.2, 1.4, 1.5, 9, y);
  crown(k, -1.35, top, -1.2, 0.9);
  clock(k, top - 0.45, -1.2 + 0.75 + 0.0);
  k.latticeMast(-2.45, y, -2.4, 3.6, 0.55);
  // Dish block
  const bx = 1.25, bz = -0.9;
  const bh = k.block(2.6, 2.8, 3, bx, y, bz);
  k.flatRoof(2.6, 2.8, bx, y + bh, bz);
  for (let f = 0; f < 3; f++) k.windowRow('front', bx, bz, 2.6, 2.8, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
  aircons(k, bx + 1.3, bz, 3, y, 1);
  bigDish(k, bx, y + bh + 0.06, bz, 1.05, 0.7);
  k.dish(bx + 1.0, y + bh + 0.06, bz - 1.1, 0.4);
  k.dish(bx - 1.0, y + bh + 0.06, bz - 1.1, 2.4);
  // Glass link and entrance
  k.glassBox(1.2, 2 * STOREY - 0.1, 1.1, -0.2, y, 0.65);
  k.door('front', -0.2, 0.65, 1.2, 1.1, 0, y, 0.5, 0.66, '#3d5a6c');
  k.box(1.4, 0.07, 0.5, C.roofGreen, -0.2, y + 0.9, 1.4);
  pavilion(k, -2.3, 0.9, 1.0, 1.0, y);
  forecourt(k, y, 'UPLINK HQ');
}

/** 20 — Citadel Gardens: stepped tower with planted terraces; supertrees on the plaza. */
function citadel(k: Kit, y: number) {
  const tz = -1.0;
  const tiers: [number, number, number][] = [[4.6, 3.2, 3], [3.6, 2.5, 3], [2.6, 1.9, 3], [1.6, 1.4, 3]];
  let ty = y;
  tiers.forEach(([w, d, floors], i) => {
    const h = k.block(w, d, floors, 0, ty, tz, i % 2 ? C.wallAlt : C.wall);
    for (let f = 0; f < floors; f++) k.windowRow('front', 0, tz, w, d, Math.max(2, Math.round(w / 0.6)), ty + f * STOREY + 0.42, { louvre: f > 0, skip: i === 0 && f === 0 ? [3, 4] : [] });
    for (let f = 0; f < floors; f++) k.windowRow('right', 0, tz, w, d, Math.max(2, Math.round(d / 0.6)), ty + f * STOREY + 0.42);
    ty += h;
    if (i < tiers.length - 1) {
      // Planted terrace on the setback
      const [nw, nd] = tiers[i + 1];
      k.box(w, 0.08, d, '#cfc9bc', 0, ty, tz);
      k.hedge(0, tz + nd / 2 + (d - nd) / 4, w - 0.2, (d - nd) / 2 - 0.1, ty + 0.08);
      for (const s of [-1, 1]) k.hedge(s * (nw / 2 + (w - nw) / 4), tz, (w - nw) / 2 - 0.1, d - 0.2, ty + 0.08);
      ty += 0.08;
    }
  });
  k.flatRoof(1.6, 1.4, 0, ty, tz);
  crown(k, 0, ty + 0.06, tz, 1.0);
  clock(k, y + 7.5 * STOREY + 0.2, tz + 1.25);
  k.door('front', 0, tz, 4.6, 3.2, 0, y, 0.6, 0.7, '#3d5a6c');
  k.box(1.8, 0.08, 0.6, C.roofGreen, 0, y + 0.9, tz + 1.9);
  // Plaza with supertrees and arch
  k.box(5.4, 0.015, 1.4, '#e3dccb', 0, y, 2.15);
  supertree(k, -2.3, 2.0, 1.7, y);
  supertree(k, 2.3, 2.0, 1.7, y, '#c0567e');
  supertree(k, -1.5, 2.45, 1.2, y, '#d98a3c');
  supertree(k, 1.5, 2.45, 1.2, y);
  k.arch(0, 2.72, 1.9, 'CITADEL', y);
}

export function buildHq(level: number): Kit {
  const k = new Kit();
  const y = k.pad(6, 6);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else strategic(k, level, y);
  return k;
}

export const HQ: BuildingDef = {
  id: 'hq',
  name: 'HQ',
  role: 'Command of the outpost. Its level caps every other building and unlocks new ones.',
  footprint: [6, 6],
  unlockHq: 1,
  levels: HQ_LEVELS,
  designedLevels: 20,
  build: buildHq,
};
