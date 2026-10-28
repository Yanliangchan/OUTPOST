import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Admin Office: the paperwork hub. Runs objectives and boosts the Reputation
 * the outpost earns. Signature at every level: a noticeboard with fluttering
 * papers, grey filing cabinets, and the red dispatch bike that rides the front
 * apron. Footprint 4×3; height cap ~3.5 storeys.
 */

const TITLES = [
  'Orderly Tent', "Clerk's Hut", 'Atap Pavilion', 'Orderly Room', 'Records Office', 'Admin Block · Hoods',
  'Lantern Office', 'Pay Office', 'Registry', 'Admin Complex', 'Paperless Office', 'Records Tower',
  'Brise-Soleil Office', 'Rotunda Office', 'Grand Secretariat', 'Secure Registry', 'Data Vault',
  'Mail Sorting Centre', 'Mesh-Screen Bureau', 'Grand Bureau',
];
const SUPPLIES = [400, 1_000, 2_200, 4_800, 9_800, 18_500, 33_000, 56_000, 92_000, 148_000, 230_000, 345_000, 485_000, 655_000, 870_000, 1_130_000, 1_430_000, 1_760_000, 2_130_000, 2_560_000];
const REPUTATION = [0, 0, 30, 100, 250, 450, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [2 * MIN, 8 * MIN, 25 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const ADMIN_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const boost = 2 + i * 2;
  const slots = 1 + Math.floor(i / 4);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((290 * Math.pow(1.2, i)) / 10) * 10,
    stats: { reputationBoost: boost, objectiveSlots: slots },
    unlocks: [`+${boost}% Reputation earned`, `${slots} active objective${slots > 1 ? 's' : ''}`],
  };
});

// ------------------------------------------------------------------ signature props

const CABINET = '#7f888c';
const BIKE_RED = '#c8372d';
const PAPERS = ['#ffffff', '#fff3a8', '#d7ecff', '#ffd9d0', '#ffffff', '#e2f5d8'];
const THATCH = '#c9a86a';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, ...o });

/** Cork noticeboard on posts; pinned papers flutter in the breeze. */
function noticeBoard(k: Kit, x: number, z: number, y: number, rotY = 0, w = 0.7) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-w / 2 + 0.04, w / 2 - 0.04]) k.box(0.04, 0.62, 0.04, C.trim, s, 0, 0, g);
  k.box(w, 0.4, 0.05, C.trim, 0, 0.36, 0, g);
  k.box(w - 0.08, 0.32, 0.055, '#c79a5b', 0, 0.4, 0.004, g);
  k.box(w + 0.06, 0.05, 0.12, C.roofGreen, 0, 0.78, 0.02, g);
  const n = Math.max(3, Math.round(w / 0.16));
  for (let i = 0; i < n; i++) {
    const p = k.box(0.1, 0.13, 0.01, PAPERS[i % PAPERS.length], -w / 2 + 0.1 + i * ((w - 0.2) / (n - 1)), 0.47 - (i % 2) * 0.05, 0.035, g);
    k.swing(p, 0, 0.35, i + Math.round(x * 7));
    k.box(0.02, 0.02, 0.012, '#e94f37', p.position.x, 0.6 - (i % 2) * 0.05, 0.04, g); // pin
  }
  k.add(g);
  return g;
}

/** Row of grey filing cabinets with drawer handles. */
function cabinets(k: Kit, x: number, z: number, y: number, n = 2, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (let i = 0; i < n; i++) {
    const cx = -((n - 1) * 0.2) / 2 + i * 0.2;
    k.box(0.18, 0.46, 0.22, CABINET, cx, 0, 0, g);
    for (let d = 0; d < 3; d++) k.box(0.08, 0.015, 0.01, '#d8dde0', cx, 0.1 + d * 0.13, 0.115, g);
  }
  k.add(g);
}

/**
 * Red dispatch motorbike with a rider. It rides back and forth along the
 * front apron (x0 → x1 at depth z), pausing at each end to "drop off" mail.
 */
function dispatchBike(k: Kit, x0: number, x1: number, z: number, y: number, seed = 0) {
  const g = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  for (const wx of [-0.13, 0.13]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 5, 10), M('#2a2b2d'));
    w.position.set(wx, 0.08, 0);
    g.add(w);
    wheels.push(w);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.06), M(BIKE_RED));
  body.position.set(0, 0.15, 0);
  g.add(body);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.12), M('#ffffff'));
  box.position.set(-0.13, 0.23, 0);
  g.add(box);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.08), M('#5b6b3a'));
  torso.position.set(0.0, 0.26, 0);
  g.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), M('#ffffff'));
  helmet.position.set(0.02, 0.36, 0);
  g.add(helmet);
  g.traverse((o) => (o.castShadow = true));
  k.add(g);
  const span = x1 - x0;
  k.anims.push((t) => {
    const c = ((t + seed) % 10) / 10;
    // 0–0.4 ride out, 0.4–0.5 pause, 0.5–0.9 ride back, 0.9–1 pause
    let p: number, dir: number, moving: boolean;
    if (c < 0.4) { p = c / 0.4; dir = 1; moving = true; }
    else if (c < 0.5) { p = 1; dir = 1; moving = false; }
    else if (c < 0.9) { p = 1 - (c - 0.5) / 0.4; dir = -1; moving = true; }
    else { p = 0; dir = -1; moving = false; }
    const e = p * p * (3 - 2 * p);
    g.position.set(x0 + span * e, y, z);
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    for (const w of wheels) w.rotation.z -= moving ? 0.25 : 0;
    g.position.y = y + (moving ? Math.abs(Math.sin(t * 30)) * 0.006 : 0);
  });
}

/** Post box whose little red flag flips up when mail is waiting. */
function mailbox(k: Kit, x: number, z: number, y: number) {
  k.box(0.04, 0.35, 0.04, C.trim, x, y, z);
  k.box(0.16, 0.12, 0.22, '#2f5a3a', x, y + 0.35, z);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.05).translate(0, 0.06, 0), M('#e94f37'));
  flag.position.set(x + 0.085, y + 0.4, z - 0.05);
  k.add(flag);
  k.anims.push((t) => {
    const c = (t % 6) / 6;
    flag.rotation.x = c < 0.5 ? 0 : -Math.PI / 2;
  });
}

/** Photocopier glimpsed through a window: its scan light sweeps back and forth. */
function copier(k: Kit, x: number, z: number, y: number) {
  k.box(0.3, 0.26, 0.24, '#e8e8e2', x, y, z);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: '#bfffd0', emissive: '#7cff8a', emissiveIntensity: 1.4 }));
  bar.position.set(x, y + 0.27, z);
  k.add(bar);
  k.anims.push((t) => (bar.position.x = x + Math.sin(t * 2.2) * 0.12));
}

/** Ceiling fan (veranda / pavilion). */
function fan(k: Kit, x: number, y: number, z: number) {
  k.box(0.015, 0.12, 0.015, C.dark, x, y - 0.12, z);
  const blades = new THREE.Group();
  blades.position.set(x, y - 0.13, z);
  k.box(0.46, 0.01, 0.06, '#f4f4f0', 0, 0, 0, blades);
  k.box(0.06, 0.01, 0.46, '#f4f4f0', 0, 0, 0, blades);
  k.add(blades);
  k.anims.push((t) => (blades.rotation.y = t * 6));
}

/** Simple office desk with papers and an in-tray. */
function desk(k: Kit, x: number, z: number, y: number) {
  k.box(0.42, 0.03, 0.24, C.wood, x, y + 0.24, z);
  for (const sx of [-0.18, 0.18]) k.box(0.03, 0.24, 0.2, '#5c6166', x + sx, y, z);
  k.box(0.12, 0.03, 0.09, '#ffffff', x - 0.08, y + 0.27, z);
  k.box(0.08, 0.05, 0.07, '#2f6fa8', x + 0.12, y + 0.27, z);
}

/** Concrete "eyebrow" sun hood above a window (Singapore modernist detail). */
function hood(k: Kit, x: number, y: number, z: number, w = 0.48) {
  k.box(w, 0.05, 0.18, C.white, x, y, z + 0.09);
  for (const s of [-1, 1]) k.box(0.04, 0.3, 0.18, C.white, x + s * (w / 2 - 0.02), y - 0.3, z + 0.09);
}

function ventGrille(k: Kit, x: number, y: number, z: number) {
  k.box(0.32, 0.24, 0.03, '#8a9196', x, y, z);
  for (let i = 0; i < 5; i++) k.box(0.3, 0.02, 0.04, C.dark, x, y + 0.03 + i * 0.045, z + 0.005);
}

/** Rooftop condenser with a spinning fan. */
function condenser(k: Kit, x: number, y: number, z: number) {
  k.box(0.36, 0.22, 0.36, '#e8e8e2', x, y, z);
  const f = new THREE.Group();
  f.position.set(x, y + 0.23, z);
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.05), M('#4a4f54'));
    blade.rotation.y = (b / 3) * Math.PI;
    f.add(blade);
  }
  k.add(f);
  k.anims.push((t) => (f.rotation.y = t * 8 + x));
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Orderly tent: field desk with a typewriter, easel noticeboard, ammo-box files
    k.tent(2.0, 1.3, -0.6, -0.45, y, '#b9a878');
    k.box(0.6, 0.03, 0.32, C.wood, 0.95, y + 0.3, -0.55);
    for (const sx of [-0.26, 0.26]) k.box(0.03, 0.3, 0.28, C.metal, 0.95 + sx, y, -0.55);
    k.box(0.2, 0.08, 0.14, '#33383d', 0.88, y + 0.33, -0.55); // typewriter
    k.box(0.12, 0.03, 0.09, '#ffffff', 1.1, y + 0.33, -0.55);
    noticeBoard(k, 1.05, 0.4, y, -0.3, 0.6);
    for (let i = 0; i < 3; i++) k.box(0.22, 0.14, 0.12, '#5b6b3a', -1.4 + i * 0.25, y, 0.6); // ammo-box files
    k.sandbags(-0.6, 0.85, 1.4, 0, y);
    mailbox(k, 1.5, 0.95, y);
    return;
  }
  if (level === 2) {
    // Clerk's hut: timber hut, outdoor noticeboard, mailbox, bicycles
    const h = k.block(2.0, 1.3, 1, -0.6, y, -0.45, C.wood);
    for (let i = 1; i < 6; i++) k.box(2.01, 0.015, 1.31, '#8a5a3b', -0.6, y + i * 0.15, -0.45);
    k.gableRoof(2.0, 1.3, 0.38, -0.6, y + h, -0.45, C.zinc, 0.15, C.wood);
    k.door('front', -0.6, -0.45, 2.0, 1.3, -0.4, y, 0.32, 0.6, '#7a5a3b');
    k.window('front', -0.6, -0.45, 2.0, 1.3, 0.4, y + 0.42, 0.36, 0.3, true);
    noticeBoard(k, 1.0, 0.25, y, -0.25, 0.7);
    cabinets(k, 1.25, -0.8, y, 2, -Math.PI / 2);
    mailbox(k, 1.45, 0.85, y);
    k.bicycleRack(-0.6, 0.85, 2, y);
    return;
  }
  // 3: atap pavilion: raised timber deck under a deep thatch roof, desks and fans inside
  k.box(3.0, 0.15, 2.0, '#9c6b45', -0.25, y, -0.35);
  for (const x of [-1.6, -0.25, 1.1]) for (const z of [-1.25, 0.55]) k.box(0.08, 0.85, 0.08, '#7a5a3b', x, y + 0.15, z);
  k.hipRoof(3.0, 2.0, 0.5, -0.25, y + 1.0, -0.35, THATCH, 0.25);
  for (const x of [-1.0, 0.0, 0.8]) desk(k, x, -0.6, y + 0.15);
  cabinets(k, -0.25, -1.15, y + 0.15, 4);
  fan(k, -0.7, y + 1.0, -0.35);
  fan(k, 0.4, y + 1.0, -0.35);
  noticeBoard(k, 1.45, 0.75, y, -0.6, 0.6);
  k.stairs(-0.25, 0.85, 0.6, 0.3, 0.15);
  mailbox(k, -1.5, 0.95, y);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Orderly room: long cream block, full-length green link-way along the front with noticeboards
    const h = k.block(3.4, 1.2, 1, 0, y, -0.6);
    k.hipRoof(3.4, 1.2, 0.6, 0, y + h, -0.6);
    k.windowRow('front', 0, -0.6, 3.4, 1.2, 5, y + 0.42, { louvre: true, skip: [2] });
    k.door('front', 0, -0.6, 3.4, 1.2, 0, y, 0.38, 0.62);
    k.linkway(-1.6, 0.35, 1.6, 0.35, y, 0.78, 0.55);
    noticeBoard(k, -0.85, 0.25, y, 0, 0.6);
    noticeBoard(k, 0.85, 0.25, y, 0, 0.6);
    dispatchBike(k, -1.4, 1.4, 0.95, y);
    k.aircon(1.78, y + 0.3, -0.8, Math.PI / 2);
    return;
  }
  if (level === 5) {
    // Records office: office block plus a square two-storey records tower with a pyramid roof
    const h = k.block(2.4, 1.3, 1, -0.55, y, -0.5);
    k.hipRoof(2.4, 1.3, 0.55, -0.55, y + h, -0.5);
    k.windowRow('front', -0.55, -0.5, 2.4, 1.3, 4, y + 0.42, { skip: [1] });
    k.door('front', -0.55, -0.5, 2.4, 1.3, -0.25, y, 0.34, 0.62);
    const th = k.block(1.0, 1.0, 2, 1.2, y, -0.6, C.wallAlt);
    k.hipRoof(1.0, 1.0, 0.5, 1.2, y + th, -0.6);
    for (let f = 0; f < 2; f++) k.window('front', 1.2, -0.6, 1.0, 1.0, 0, y + f * STOREY + 0.4, 0.3, 0.4, true);
    noticeBoard(k, -1.2, 0.5, y, 0, 0.7);
    mailbox(k, 0.4, 0.55, y);
    dispatchBike(k, -1.4, 1.3, 1.0, y, 3);
    return;
  }
  // 6: two storeys with a projecting glazed bay and concrete eyebrow hoods over every window
  const w = 3.4, d = 1.4, z = -0.55;
  const h = k.block(w, d, 2, 0, y, z);
  k.hipRoof(w, d, 0.5, 0, y + h, z);
  for (let f = 0; f < 2; f++) for (const x of [-1.25, -0.65, 0.65, 1.25]) {
    k.window('front', 0, z, w, d, x, y + f * STOREY + 0.42, 0.36, 0.36);
    hood(k, x, y + f * STOREY + 0.84, z + d / 2);
  }
  k.glassBox(0.8, 2 * STOREY - 0.1, 0.35, 0, y, z + d / 2 + 0.17);
  k.box(0.9, 0.06, 0.42, C.white, 0, y + 2 * STOREY - 0.1, z + d / 2 + 0.17);
  k.door('front', 0, z + 0.17, 0.8, d + 0.35, 0, y, 0.34, 0.6, DARK_GLASS);
  noticeBoard(k, -1.2, 0.5, y, 0, 0.6);
  cabinets(k, 1.3, 0.5, y, 2);
  dispatchBike(k, -1.4, 1.4, 1.0, y, 5);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Lantern office: two storeys with a raised roof lantern and a single-storey mail-room annex
    const h = k.block(2.7, 1.5, 2, -0.6, y, -0.5);
    k.flatRoof(2.7, 1.5, -0.6, y + h, -0.5);
    for (let f = 0; f < 2; f++) k.windowRow('front', -0.6, -0.5, 2.7, 1.5, 4, y + f * STOREY + 0.42, { louvre: f > 0, skip: f === 0 ? [1] : [] });
    k.door('front', -0.6, -0.5, 2.7, 1.5, -0.35, y, 0.36, 0.62);
    k.box(1.5, 0.45, 0.6, C.white, -0.6, y + h + 0.06, -0.5);
    k.windowRow('front', -0.6, -0.5, 1.5, 0.6, 4, y + h + 0.16, { ww: 0.26, wh: 0.2, span: 1.1 });
    k.gableRoof(1.5, 0.6, 0.3, -0.6, y + h + 0.51, -0.5, C.roof, 0.1);
    const ah = k.block(1.0, 1.2, 1, 1.25, y, -0.4, C.wallAlt);
    k.hipRoof(1.0, 1.2, 0.4, 1.25, y + ah, -0.4);
    k.window('front', 1.25, -0.4, 1.0, 1.2, 0, y + 0.42, 0.4, 0.3);
    copier(k, 1.25, -0.2, y + 0.05);
    noticeBoard(k, -1.35, 0.55, y, 0, 0.6);
    mailbox(k, 1.55, 0.55, y);
    dispatchBike(k, -1.4, 1.4, 1.0, y, 7);
    return;
  }
  if (level === 8) {
    // Pay office: two-storey office with a single-storey pay counter, awning and queue rails
    const h = k.block(2.4, 1.6, 2, -0.65, y, -0.45);
    k.hipRoof(2.4, 1.6, 0.6, -0.65, y + h, -0.45);
    for (let f = 0; f < 2; f++) k.windowRow('front', -0.65, -0.45, 2.4, 1.6, 4, y + f * STOREY + 0.42, { louvre: f > 0, skip: f === 0 ? [1] : [] });
    k.door('front', -0.65, -0.45, 2.4, 1.6, -0.3, y, 0.36, 0.62);
    const ph = k.block(1.1, 1.4, 1, 1.2, y, -0.5, C.wallAlt);
    k.hipRoof(1.1, 1.4, 0.4, 1.2, y + ph, -0.5);
    k.box(0.6, 0.3, 0.03, DARK_GLASS, 1.2, y + 0.45, 0.21);
    k.box(0.7, 0.04, 0.18, C.wood, 1.2, y + 0.42, 0.3);
    k.box(1.2, 0.06, 0.5, C.roofGreen, 1.2, y + 0.9, 0.42);
    k.blinker(1.2, y + 0.8, 0.22, '#3fd16b', 0.025, 1.5);
    for (let i = 0; i < 4; i++) k.box(0.04, 0.32, 0.04, C.metal, 0.75 + i * 0.3, y, 0.95);
    k.box(0.95, 0.02, 0.02, '#e94f37', 1.2, y + 0.28, 0.95);
    noticeBoard(k, -1.3, 0.6, y, 0, 0.6);
    dispatchBike(k, -1.4, 0.3, 1.0, y, 1);
    return;
  }
  if (level === 9) {
    // Registry: three-storey office beside a windowless two-storey archive wing with vents
    const h = k.block(2.0, 1.6, 3, -0.75, y, -0.45);
    k.hipRoof(2.0, 1.6, 0.5, -0.75, y + h, -0.45);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.75, -0.45, 2.0, 1.6, 3, y + f * STOREY + 0.42, { louvre: f > 0, skip: f === 0 ? [1] : [] });
    k.door('front', -0.75, -0.45, 2.0, 1.6, 0, y, 0.36, 0.62);
    k.box(1.5, 2 * STOREY, 1.6, CONCRETE, 1.0, y, -0.45);
    k.box(1.54, 0.08, 1.64, C.trim, 1.0, y + 2 * STOREY, -0.45);
    for (const x of [0.6, 1.4]) ventGrille(k, x, y + 1.2, 0.36);
    k.box(1.2, 0.15, 0.05, C.trim, 1.0, y + 0.6, 0.36);
    cabinets(k, 1.0, 0.6, y, 4);
    condenser(k, 1.0, y + 2 * STOREY + 0.08, -0.45);
    noticeBoard(k, -1.35, 0.6, y, 0, 0.55);
    dispatchBike(k, -1.4, 1.4, 1.05, y, 4);
    return;
  }
  // 10: admin complex: three-storey main block, two-storey wing, covered drop-off
  const h = k.block(2.3, 1.5, 3, -0.6, y, -0.55);
  k.hipRoof(2.3, 1.5, 0.55, -0.6, y + h, -0.55);
  for (let f = 0; f < 3; f++) k.windowRow('front', -0.6, -0.55, 2.3, 1.5, 4, y + f * STOREY + 0.42, { louvre: f > 0, skip: f === 0 ? [1, 2] : [] });
  for (let f = 0; f < 3; f++) for (const x of [-1.45, 0.25]) hood(k, x, y + f * STOREY + 0.84, 0.2, 0.42);
  const wh = k.block(1.1, 2.2, 2, 1.25, y, -0.2, C.wallAlt);
  k.hipRoof(1.1, 2.2, 0.45, 1.25, y + wh, -0.2);
  for (let f = 0; f < 2; f++) k.window('front', 1.25, -0.2, 1.1, 2.2, 0, y + f * STOREY + 0.42);
  k.porch(-0.6, 0.55, 1.3, 0.7, 0.85, y, 2);
  k.door('front', -0.6, -0.55, 2.3, 1.5, 0, y, 0.42, 0.66);
  copier(k, 1.25, 0.4, y + 0.05);
  noticeBoard(k, 0.7, 0.75, y, -0.4, 0.55);
  k.plaque('ADMIN', -1.55, 0.95, y, 0.6);
  dispatchBike(k, -1.5, 1.5, 1.1, y, 2);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Paperless office: three storeys with a glass front and a server room glowing with status LEDs
    const w = 3.4, d = 1.9, z = -0.45;
    k.box(w, 3 * STOREY, d, '#f2f0ea', 0, y, z);
    k.box(1.6, 0.45, 0.9, '#c9ced2', -0.4, y + 3 * STOREY + 0.1, z - 0.3); // rooftop plant enclosure
    for (let i = 0; i < 6; i++) k.box(0.02, 0.4, 0.92, '#9aa3a6', -1.1 + i * 0.28, y + 3 * STOREY + 0.12, z - 0.3);
    k.box(2.4, 0.06, 0.55, C.white, -0.5, y + 0.85, z + d / 2 + 0.45);
    for (const x of [-1.6, 0.6]) k.box(0.05, 0.85, 0.05, C.metal, x, y, z + d / 2 + 0.65);
    k.glassBox(2.2, 3 * STOREY - 0.1, 0.25, -0.5, y, z + d / 2 + 0.1);
    k.box(w + 0.06, 0.1, d + 0.06, C.trim, 0, y + 3 * STOREY, z);
    // Server room on the right: dark window onto blinking racks
    k.box(0.8, 1.5, 0.04, DARK_GLASS, 1.15, y + 0.2, z + d / 2 + 0.01);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) k.blinker(0.9 + r * 0.25, y + 0.4 + i * 0.3, z + d / 2 + 0.04, i % 2 ? '#3fd16b' : '#2bb3d4', 0.018, 0.8 + r * 0.3 + i * 0.1);
    for (const x of [0.8, 1.3]) condenser(k, x, y + 3 * STOREY + 0.1, z - 0.3);
    k.door('front', -0.5, z + 0.1, 2.2, d + 0.25, 0, y, 0.45, 0.66, DARK_GLASS);
    noticeBoard(k, 1.25, 0.85, y, 0, 0.5);
    dispatchBike(k, -1.5, 1.5, 1.15, y, 6);
    return;
  }
  if (level === 12) {
    // Records tower: slim four-storey archive tower with a vertical window slot, beside a three-storey office
    const h = k.block(2.3, 2.0, 3, -0.6, y, -0.35, C.wallAlt);
    k.flatRoof(2.3, 2.0, -0.6, y + h, -0.35);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.6, -0.35, 2.3, 2.0, 4, y + f * STOREY + 0.42, { skip: f === 0 ? [1, 2] : [] });
    k.door('front', -0.6, -0.35, 2.3, 2.0, 0, y, 0.42, 0.66);
    k.box(1.4, 0.06, 0.45, C.roofGreen, -0.6, y + 0.85, 0.85);
    const tw = 1.2, tx = 1.2, tz = -0.4;
    k.box(tw, 3.4, tw, CONCRETE, tx, y, tz);
    k.box(0.22, 2.9, 0.03, DARK_GLASS, tx, y + 0.3, tz + tw / 2 + 0.01);
    for (let f = 1; f < 4; f++) k.box(tw + 0.04, 0.05, tw + 0.04, C.trim, tx, y + f * 0.85, tz);
    k.box(tw + 0.1, 0.12, tw + 0.1, '#2f5a3a', tx, y + 3.4, tz);
    condenser(k, -1.2, y + h + 0.06, -0.6);
    copier(k, 1.2, 0.5, y);
    noticeBoard(k, -1.45, 0.95, y, 0, 0.45);
    dispatchBike(k, -1.5, 1.5, 1.15, y, 8);
    return;
  }
  if (level === 13) {
    // Brise-soleil office: three storeys wrapped in angled horizontal louvres, roof garden
    const w = 3.4, d = 1.7, z = -0.45;
    k.box(w, 3 * STOREY, d, '#e6e1d6', 0, y, z);
    k.box(w - 0.3, 3 * STOREY - 0.3, 0.03, DARK_GLASS, 0, y + 0.15, z + d / 2 + 0.01);
    for (let i = 0; i < 13; i++) {
      const slat = k.box(w + 0.04, 0.035, 0.22, i % 4 === 0 ? C.trim : C.white, 0, y + 0.25 + i * 0.2, z + d / 2 + 0.1);
      slat.rotation.x = 0.45;
    }
    k.box(w + 0.06, 0.1, d + 0.06, C.white, 0, y + 3 * STOREY, z);
    k.hedge(0, z, w - 0.4, d - 0.5, y + 3 * STOREY + 0.1);
    k.door('front', 0, z, w, d, 0, y, 0.45, 0.6, DARK_GLASS);
    k.box(1.2, 0.06, 0.5, C.roofGreen, 0, y + 0.72, z + d / 2 + 0.35);
    noticeBoard(k, -1.35, 0.85, y, 0, 0.55);
    cabinets(k, 1.25, 0.85, y, 2);
    dispatchBike(k, -1.4, 1.4, 1.12, y, 9);
    return;
  }
  if (level === 14) {
    // Rotunda office: three-storey drum with a conical roof, joined to a flat-roofed office wing
    const cx = -0.8, cz = -0.35;
    k.cyl(0.9, 3 * STOREY, C.wall, cx, y, cz, 18);
    for (let f = 1; f <= 3; f++) k.cyl(0.92, 0.05, f === 3 ? C.white : C.trim, cx, y + f * STOREY - 0.05, cz, 18);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI;
      const win = k.box(0.22, 0.34, 0.04, C.glass, cx + Math.sin(a) * 0.91, y + f * STOREY + 0.3, cz + Math.cos(a) * 0.91);
      win.rotation.y = a;
    }
    k.cyl(1.02, 0.6, C.roof, cx, y + 3 * STOREY, cz, 18, 0.12);
    const h = k.block(1.6, 1.6, 3, 0.95, y, -0.5, C.wallAlt);
    k.flatRoof(1.6, 1.6, 0.95, y + h, -0.5);
    for (let f = 0; f < 3; f++) k.windowRow('front', 0.95, -0.5, 1.6, 1.6, 2, y + f * STOREY + 0.42, { louvre: f > 0 });
    k.door('front', cx, cz, 1.8, 1.8, 0, y, 0.38, 0.62);
    condenser(k, 1.0, y + h + 0.06, -0.6);
    noticeBoard(k, 0.9, 0.7, y, 0, 0.6);
    dispatchBike(k, -1.5, 1.5, 1.1, y, 10);
    return;
  }
  // 15: grand secretariat: three storeys over a white arched arcade, red hip roof, gold band
  const w = 3.4, d = 1.6, z = -0.55;
  const h = k.block(w, d, 3, 0, y, z);
  for (let f = 1; f < 3; f++) k.windowRow('front', 0, z, w, d, 6, y + f * STOREY + 0.42, { louvre: true });
  // Arcade: arches across the ground floor, set forward
  k.box(w, STOREY, 0.12, C.white, 0, y, z + d / 2 + 0.3);
  for (let i = 0; i < 5; i++) {
    const ax = -1.36 + i * 0.68;
    k.box(0.4, 0.55, 0.14, '#4a3a2e', ax, y, z + d / 2 + 0.3);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10, 0, Math.PI), M('#4a3a2e', { side: THREE.DoubleSide }));
    arch.position.set(ax, y + 0.55, z + d / 2 + 0.375);
    k.add(arch);
  }
  k.box(w + 0.06, 0.08, 0.45, C.white, 0, y + STOREY, z + d / 2 + 0.15);
  for (let i = 0; i < 7; i++) k.box(0.08, 2 * STOREY, 0.06, C.white, -1.65 + i * 0.55, y + STOREY, z + d / 2 + 0.02); // pilasters
  k.box(w + 0.08, 0.08, d + 0.08, '#d9b24a', 0, y + h - 0.15, z);
  k.hipRoof(w, d, 0.55, 0, y + h, z);
  k.plaque('SECRETARIAT', 0, 1.0, y, 1.1);
  noticeBoard(k, -1.35, 0.75, y, 0, 0.5);
  fan(k, 0.0, y + STOREY - 0.02, z + d / 2 + 0.15);
  dispatchBike(k, -1.5, 1.5, 1.12, y, 11);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 1.6, 1.1, false);
  const z = -0.38, d = 1.25;
  if (level === 16) {
    // Secure registry: concrete block with slot windows, hazard band, smoking burn-bin for classified waste
    const w = 3.0;
    k.box(w, 3.1, d, CONCRETE, 0, y, z);
    for (let f = 0; f < 4; f++) for (let i = 0; i < 6; i++) k.box(0.08, 0.36, 0.03, DARK_GLASS, -1.25 + i * 0.5, y + 0.4 + f * 0.75, z + d / 2 + 0.01);
    for (let i = 0; i < 15; i++) k.box(0.2, 0.12, 0.04, i % 2 ? C.kerbB : C.kerbY, -1.4 + i * 0.2, y + 0.18, z + d / 2 + 0.02);
    k.box(w + 0.08, 0.1, d + 0.08, C.white, 0, y + 3.1, z);
    condenser(k, -0.8, y + 3.2, z);
    condenser(k, 0.8, y + 3.2, z);
    k.box(0.7, 0.62, 0.06, '#6b7075', 0.6, y, z + d / 2 + 0.03);
    k.box(1.3, 0.07, 0.5, '#33383d', 0.6, y + 0.8, z + d / 2 + 0.25); // steel entrance canopy
    for (const x of [0.0, 1.2]) k.box(0.05, 0.8, 0.05, C.metal, x, y, z + d / 2 + 0.45);
    k.cyl(0.16, 0.36, '#5c6166', 1.35, y, 0.6, 10); // burn bin
    k.emitters.push({ pos: new THREE.Vector3(1.35, y + 0.5, 0.6), kind: 'smoke' });
    noticeBoard(k, -0.3, 0.5, y, 0, 0.5);
    return;
  }
  if (level === 17) {
    // Data vault: concrete vault with glowing roof skylights, LED-lit server slot and condensers
    const w = 3.0;
    k.box(w, 3.15, d, CONCRETE, 0, y, z);
    for (let i = 1; i < 6; i++) k.box(w + 0.02, 0.03, d + 0.02, '#c2bdb3', 0, y + i * 0.55, z);
    k.box(2.4, 0.5, 0.03, DARK_GLASS, 0, y + 1.2, z + d / 2 + 0.01);
    for (let i = 0; i < 10; i++) k.blinker(-1.05 + i * 0.23, y + 1.45, z + d / 2 + 0.03, i % 3 ? '#3fd16b' : '#2bb3d4', 0.02, 0.7 + i * 0.13);
    for (const x of [-0.9, 0, 0.9]) {
      const sky = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: '#bfe6f2', emissive: '#6fc8e0', emissiveIntensity: 0.5 }));
      sky.position.set(x, y + 3.21, z);
      k.add(sky);
    }
    k.box(w + 0.08, 0.06, d + 0.08, C.white, 0, y + 3.15, z);
    condenser(k, -1.25, y + 3.21, z - 0.4);
    condenser(k, 1.25, y + 3.21, z - 0.4);
    k.box(0.6, 0.62, 0.06, '#6b7075', 0.8, y, z + d / 2 + 0.03);
    noticeBoard(k, -0.3, 0.5, y, 0, 0.5);
    cabinets(k, 1.25, 0.5, y, 2);
    return;
  }
  if (level === 18) {
    // Mail sorting centre: open sorting hall with a conveyor carrying parcels, offices above
    const w = 3.0;
    k.box(w, 3.2, d - 0.5, '#f2f0ea', 0, y, z - 0.25);
    for (const x of [-1.45, -0.5, 0.5, 1.45]) k.box(0.1, 1.0, 0.1, C.white, x, y, z + d / 2 - 0.05);
    k.box(w, 2.2, d, '#f2f0ea', 0, y + 1.0, z);
    for (let f = 0; f < 2; f++) k.box(w - 0.3, 0.4, 0.03, DARK_GLASS, 0, y + 1.3 + f * STOREY, z + d / 2 + 0.01);
    k.box(w + 0.08, 0.1, d + 0.08, BIKE_RED, 0, y + 3.2, z);
    // Conveyor with moving parcels
    k.box(2.6, 0.26, 0.3, '#5c6166', 0, y, z + 0.25);
    k.box(2.6, 0.02, 0.26, '#2a2b2d', 0, y + 0.26, z + 0.25);
    const parcels: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1 + (i % 2) * 0.04, 0.16), M(['#c49a6c', '#d9c08a', '#b07a4a'][i % 3]));
      p.castShadow = true;
      k.add(p);
      parcels.push(p);
    }
    k.anims.push((t) => parcels.forEach((p, i) => {
      const u = ((t * 0.25 + i / parcels.length) % 1);
      p.position.set(-1.25 + u * 2.5, y + 0.33, z + 0.25);
    }));
    cabinets(k, -1.2, z - 0.3, y, 3);
    noticeBoard(k, 0.6, 0.55, y, 0, 0.5);
    dispatchBike(k, -0.6, 1.3, 0.62, y, 12);
    return;
  }
  if (level === 19) {
    // Mesh-screen bureau: block behind a perforated metal screen, green roof, rooftop vents
    const w = 3.0;
    k.box(w, 3.25, d, C.wallAlt, 0, y, z);
    k.box(w + 0.04, 3.15, 0.05, '#c9ced2', 0, y + 0.05, z + d / 2 + 0.12);
    const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 6), M('#2f4a57'), 14 * 15);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
      const s = 0.6 + 0.4 * Math.sin(i * 0.5 + j * 0.35) ** 2;
      m4.makeScale(s, s, 1).setPosition(-1.36 + i * 0.21, y + 0.25 + j * 0.21, z + d / 2 + 0.15);
      holes.setMatrixAt(n++, m4);
    }
    k.add(holes);
    k.box(0.7, 0.62, 0.06, DARK_GLASS, 0, y, z + d / 2 + 0.16);
    k.box(w + 0.08, 0.08, d + 0.08, C.trim, 0, y + 3.25, z);
    k.hedge(0, z, w - 0.4, d - 0.4, y + 3.33);
    condenser(k, 1.2, y + 3.33, z);
    noticeBoard(k, -1.0, 0.5, y, 0, 0.5);
    mailbox(k, 1.1, 0.5, y);
    return;
  }
  // 20: grand bureau: glass office raised on white pilotis, gold fascia, glass lobby with a revolving door
  const w = 3.1;
  for (const x of [-1.4, -0.47, 0.47, 1.4]) for (const zz of [z - d / 2 + 0.1, z + d / 2 - 0.1]) k.cyl(0.07, 1.0, C.white, x, y, zz, 10);
  k.glassBox(w, 2.25, d, 0, y + 1.0, z);
  k.box(w + 0.1, 0.12, d + 0.1, '#d9b24a', 0, y + 1.0, z);
  k.box(w + 0.1, 0.14, d + 0.1, '#d9b24a', 0, y + 3.25, z);
  k.hedge(0, z, w - 0.5, d - 0.4, y + 3.39);
  k.glassBox(1.0, 0.9, 0.7, 0, y, z);
  const door = new THREE.Group();
  door.position.set(0, y, z + 0.38);
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.02).translate(0.15, 0.3, 0), M('#bfe6f2', { transparent: true, opacity: 0.7 }));
    wing.rotation.y = (i / 4) * Math.PI * 2;
    door.add(wing);
  }
  k.add(door);
  k.cyl(0.32, 0.04, '#d9b24a', 0, y + 0.62, z + 0.38, 12);
  k.anims.push((t) => (door.rotation.y = t * 0.8));
  cabinets(k, -1.1, z, y, 3);
  noticeBoard(k, 1.0, 0.5, y, 0, 0.5);
}

export function buildAdmin(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const ADMIN_OFFICE: BuildingDef = {
  id: 'admin',
  name: 'Admin Office',
  role: 'The paperwork hub: runs objectives and boosts the Reputation the outpost earns.',
  footprint: [4, 3],
  unlockHq: 3,
  levels: ADMIN_LEVELS,
  designedLevels: 20,
  build: buildAdmin,
};
