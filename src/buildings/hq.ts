import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * HQ — the heart of the outpost. Its level caps every other building's level,
 * unlocks new buildings and gates land clearance. 15 designed levels in four bands:
 *   Field (1–3) → Camp (4–6) → Base (7–10, release cap) → Command (11–15)
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
  L(11, 'Command HQ · Radar', 1_100_000, 4_000, 3 * DAY, 10000, 275_000, 4, ['Artillery Emplacement', 'Buildings to Lv 11']),
  L(12, 'Command HQ · Atrium', 1_600_000, 5_200, 4 * DAY, 11600, 350_000, 4, ['Buildings to Lv 12', '6th Bunk']),
  L(13, 'Command HQ · Helipad', 2_200_000, 6_600, 5 * DAY, 13400, 450_000, 5, ['Air Defence', '5th construction crew', 'Buildings to Lv 13']),
  L(14, 'Command Centre', 3_000_000, 8_200, 6 * DAY, 15400, 575_000, 5, ['Buildings to Lv 14']),
  L(15, 'Command Centre · Landmark', 4_000_000, 10_000, 7 * DAY, 17500, 700_000, 5, ['Buildings to Lv 15', 'Landmark status']),
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

/** Command band (11–15): radar → atrium → helipad → comms mast → landmark. */
function command(k: Kit, level: number, y: number) {
  k.path(1.2, 1.3, 0, 2.25, y);
  const bw = 3.4, bd = 2.0, bz = -1.5;
  // Main block: hip roof until 13, then flat roof with a helipad.
  const h = k.block(bw, bd, 3, 0, y, bz);
  if (level < 13) k.hipRoof(bw, bd, 0.7, 0, y + h, bz);
  else {
    k.flatRoof(bw, bd, 0, y + h, bz);
    k.helipad(-0.55, y + h + 0.06, bz, 1.4);
    k.windsock(-1.5, y + h + 0.06, bz + 0.75);
  }
  frontWindows(k, 0, bz, bw, bd, 3, y, 6, []);
  sideWindows(k, 0, bz, bw, bd, 3, y);

  // Wings keep the camp's red-brown hip roofs; two storeys (11), three from 12.
  const wingStoreys = level >= 12 ? 3 : 2;
  const ww = 1.0, wd = 1.8, wz = bz - 0.05;
  for (const s of [-1, 1]) {
    const wx = s * (bw / 2 + ww / 2);
    const wh = k.block(ww, wd, wingStoreys, wx, y, wz, C.wallAlt);
    k.hipRoof(ww, wd, 0.45, wx, y + wh, wz);
    for (let f = 0; f < wingStoreys; f++) k.windowRow('front', wx, wz, ww, wd, 1, y + f * STOREY + 0.42, { louvre: f > 0 });
    aircons(k, wx + (s * ww) / 2, wz, wingStoreys, y, s as 1 | -1);
    if (level >= 14) k.fins(ww - 0.1, wingStoreys * STOREY - 0.25, wx, y + 0.12, wz + wd / 2 + 0.07, 4);
  }
  if (level < 13) k.solarPanels(0.9, y + h + 0.05, bz - 0.55, 0.9, 0.5);
  if (level >= 14) k.latticeMast(1.1, y + h + 0.06, bz - 0.45, 3.0);

  // Tower: 5 storeys (11–12), 6 (13–14), 7 + crown (15).
  const floors = level >= 15 ? 7 : level >= 13 ? 6 : 5;
  const tw = 1.3, td = 1.1, tz = bz + bd / 2 + td / 2 - 0.05;
  const th = k.block(tw, td, floors, 0, y, tz, C.wallAlt);
  for (let f = 1; f < floors; f++) k.window('front', 0, tz, tw, td, 0, y + f * STOREY + 0.36, 0.66, 0.44);
  clock(k, y + (floors - 1) * STOREY + 0.55, tz + td / 2);
  if (level >= 15) {
    // Stepped crown: gold band, belvedere storey with arched openings, gold pyramid and spire.
    k.box(tw + 0.14, 0.12, td + 0.14, '#d9b24a', 0, y + th, tz);
    const cy = y + th + 0.12;
    for (const [cx, cz] of [[-0.42, -0.35], [0.42, -0.35], [-0.42, 0.35], [0.42, 0.35]]) k.box(0.16, 0.8, 0.16, C.white, cx, cy, tz + cz);
    k.box(0.7, 0.8, 0.55, '#5d8aa3', 0, cy, tz);
    k.box(1.1, 0.1, 0.95, '#d9b24a', 0, cy + 0.8, tz);
    k.hipRoof(1.0, 0.85, 0.55, 0, cy + 0.9, tz, '#d9b24a', 0.05);
    k.cyl(0.03, 0.55, '#d9b24a', 0, cy + 1.42, tz, 6, 0.005);
  } else {
    k.flatRoof(tw, td, 0, y + th, tz);
    k.radarDome(0, y + th + 0.06, tz, 0.32);
    k.dish(0.45, y + th + 0.06, tz - 0.3, 0.8);
  }
  if (level >= 12) {
    k.glassBox(2.2, 2 * STOREY - 0.1, 0.8, 0, y, tz + td / 2 + 0.4);
    k.door('front', 0, tz + td / 2 + 0.4, 2.2, 0.8, 0, y, 0.5, 0.66, '#3d5a6c');
    // Green entrance canopy on the atrium
    k.box(1.2, 0.07, 0.5, C.roofGreen, 0, y + 0.82, tz + td / 2 + 1.05);
    for (const s of [-0.5, 0.5]) k.box(0.05, 0.82, 0.05, C.white, s, y, tz + td / 2 + 1.25);
  } else {
    k.door('front', 0, tz, tw, td, 0, y, 0.5, 0.66);
    portico(k, tz + td / 2 + 0.42, 2.2, y, 6);
  }

  // Forecourt
  const gold = level >= 15;
  k.flagpole(-2.4, 2.3, 2.8, y);
  k.flagpole(2.4, 2.3, 2.8, y);
  if (gold) for (const s of [-2.4, 2.4]) k.cyl(0.05, 0.06, '#d9b24a', s, y + 0.1 + 2.8, 2.3, 8);
  if (level >= 15) {
    k.box(2.6, 0.015, 1.2, '#e3dccb', 0, y, 2.1); // ceremonial plaza paving
    k.fountain(0, 2.0, 0.42, y);
    k.arch(0, 2.72, 2.1, 'COMMAND CENTRE', y);
    k.hedge(-1.6, 1.65, 0.8, 0.25, y);
    k.hedge(1.6, 1.65, 0.8, 0.25, y);
  } else {
    k.planter(-1.35, 1.9, 0.8, y);
    k.planter(1.35, 1.9, 0.8, y);
    k.plaque(level >= 14 ? 'COMMAND CENTRE' : 'COMMAND HQ', -1.2, 2.6, y, 1.25);
    if (level >= 14) {
      k.hedge(1.45, 2.55, 0.9, 0.25, y);
    }
  }
  k.lamp(-0.8, 2.65, y);
  k.lamp(0.65, 2.65, y);
}

export function buildHq(level: number): Kit {
  const k = new Kit();
  const y = k.pad(6, 6);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else command(k, level, y);
  return k;
}

export const HQ: BuildingDef = {
  id: 'hq',
  name: 'HQ',
  role: 'Command of the outpost. Its level caps every other building and unlocks new ones.',
  footprint: [6, 6],
  unlockHq: 1,
  levels: HQ_LEVELS,
  designedLevels: 15,
  build: buildHq,
};
