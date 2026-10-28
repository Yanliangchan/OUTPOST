import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, roofCanopy } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Workshop: produces Supplies and repairs vehicles and equipment.
 * Signature at every level: workbenches and tool racks, a vehicle on a lift or
 * hoist, oil drums, welding sparks. Footprint 4×4; height cap ~3.5 storeys.
 */

const TITLES = [
  'Field Repair Point', 'Tool Shed', 'Lean-to Workshop', 'Twin-Bay Workshop', 'Workshop · Spray Booth', 'Sawtooth Workshop',
  'Vehicle Bays', 'Machine Shop', 'Engineering Block', 'Workshop Complex', 'CNC Workshop', 'Folded-Roof Fab Lab',
  'Test Rig Yard', 'Cantilever Service Apron', 'Grand Engineering Hall', 'Blast-Door Workshop', 'Robot Assembly Hall',
  'Energy Workshop', 'Ramp Test Workshop', 'Forge Citadel',
];
const SUPPLIES = [300, 900, 2_000, 4_500, 9_500, 18_000, 32_000, 55_000, 90_000, 145_000, 225_000, 340_000, 480_000, 650_000, 860_000, 1_120_000, 1_420_000, 1_750_000, 2_120_000, 2_550_000];
const REPUTATION = [0, 0, 30, 100, 250, 450, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [2 * MIN, 8 * MIN, 25 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const WORKSHOP_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const output = Math.round((60 * Math.pow(1.32, i)) / 10) * 10;
  const repair = 10 + level * 4;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((300 * Math.pow(1.2, i)) / 10) * 10,
    stats: { suppliesPerHour: output, repairSpeed: repair },
    unlocks: [`Produces ${output.toLocaleString('en')} Supplies/h`, `Repair speed +${repair}%`],
  };
});

// ------------------------------------------------------------------ signature props

const OLIVE = '#5d6b35';
const SAFETY = '#ffc93c';

function workbench(k: Kit, x: number, z: number, y: number, w = 0.9, rotY = 0) {
  const g = new Kit();
  g.box(w, 0.05, 0.36, C.wood, 0, 0.3, 0);
  for (const s of [-w / 2 + 0.05, w / 2 - 0.05]) g.box(0.05, 0.3, 0.32, '#5c6166', s, 0, 0);
  g.box(0.16, 0.08, 0.12, '#e94f37', -w / 4, 0.35, 0); // toolbox
  g.box(0.1, 0.1, 0.08, '#5c6166', w / 4, 0.35, 0.05); // vice
  g.box(w, 0.42, 0.03, '#8a9196', 0, 0.35, -0.17); // pegboard
  for (let i = 0; i < 4; i++) g.box(0.03, 0.14, 0.02, ['#e94f37', SAFETY, '#2f6fa8', '#33383d'][i], -w / 2 + 0.15 + i * (w / 4), 0.5, -0.15);
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
}

function drums(k: Kit, x: number, z: number, y: number, n = 3) {
  for (let i = 0; i < n; i++) k.drum(x + (i % 2) * 0.24, z + Math.floor(i / 2) * 0.24, i % 2 ? '#e94f37' : OLIVE, y);
}

/** Olive utility jeep (camp vehicle), facing +x. */
function jeep(k: Kit, x: number, z: number, y: number, rot = 0, raise = 0) {
  const g = new Kit();
  g.box(0.95, 0.22, 0.48, OLIVE, 0, 0.14, 0);
  g.box(0.36, 0.14, 0.46, OLIVE, 0.27, 0.36, 0); // bonnet
  g.box(0.04, 0.2, 0.44, DARK_GLASS, 0.08, 0.36, 0); // windscreen
  g.box(0.5, 0.04, 0.5, '#4a5a2c', -0.22, 0.58, 0); // canvas top
  for (const sx of [-0.3, 0.3]) for (const sz of [-0.24, 0.24]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2b2d', flatShading: true }));
    w.position.set(sx, 0.11, sz);
    g.add(w);
  }
  g.box(0.06, 0.06, 0.5, '#33383d', 0.49, 0.18, 0);
  g.group.position.set(x, y + raise, z);
  g.group.rotation.y = rot;
  k.add(g.group);
  return g.group;
}

/** Two-post vehicle lift with a jeep raised on it. */
function lift(k: Kit, x: number, z: number, y: number, rot = 0) {
  const g = new Kit();
  for (const sz of [-0.42, 0.42]) {
    g.box(0.1, 1.0, 0.1, SAFETY, 0, 0, sz);
    g.box(0.5, 0.04, 0.06, '#5c6166', 0, 0.48, sz * 0.7);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rot;
  k.add(g.group);
  const car = jeep(k, x, z, y, rot + Math.PI / 2, 0.42);
  const arms = g.group.children.filter((_c, i) => i % 2 === 1);
  const seed = (x * 5 + z * 2) % 9;
  // Lift cycle: the jeep rises for work, pauses, then comes back down.
  k.anims.push((t) => {
    const c = ((t + seed) % 12) / 12;
    const up = c < 0.2 ? c / 0.2 : c < 0.6 ? 1 : c < 0.8 ? 1 - (c - 0.6) / 0.2 : 0;
    const e = up * up * (3 - 2 * up);
    car.position.y = y + 0.05 + e * 0.42;
    for (const a of arms) a.position.y = 0.08 + e * 0.42;
  });
}

/** A-frame chain hoist over an engine block. */
function hoist(k: Kit, x: number, z: number, y: number, h = 1.1) {
  for (const s of [-1, 1]) {
    const leg = k.box(0.06, h + 0.1, 0.06, SAFETY, x + s * 0.35, y, z);
    leg.rotation.z = s * 0.25;
  }
  k.box(0.9, 0.06, 0.06, SAFETY, x, y + h, z);
  const chain = k.box(0.02, 0.45, 0.02, '#33383d', x, y + h - 0.45, z);
  const engine = new THREE.Group();
  k.box(0.32, 0.22, 0.26, '#5c6166', 0, 0, 0, engine);
  k.box(0.12, 0.08, 0.2, '#33383d', 0.2, 0.15, 0, engine);
  engine.position.set(x, y + 0.15, z);
  k.add(engine);
  // Engine is slowly winched up and lowered back onto its stand.
  k.anims.push((t) => {
    const lift = (Math.sin(t * 0.6) * 0.5 + 0.5) * 0.35;
    engine.position.y = y + 0.15 + lift;
    engine.rotation.y = Math.sin(t * 0.9) * 0.15;
    chain.scale.y = Math.max(0.2, 1 - lift / 0.45);
    chain.position.y = y + h - 0.45 * chain.scale.y + 0.225 * chain.scale.y;
  });
}

function sparks(k: Kit, x: number, y: number, z: number) {
  k.emitters.push({ pos: new THREE.Vector3(x, y, z), kind: 'sparks' });
}

/** Tall sliding/folding vehicle door on a face. */
function bayDoor(k: Kit, x: number, z: number, w: number, h: number, y: number, open = false) {
  k.box(w + 0.12, h + 0.08, 0.05, C.trim, x, y, z);
  if (open) k.box(w, h, 0.06, '#2a2f33', x, y, z + 0.005);
  else for (let i = 0; i < 4; i++) k.box(w / 4 - 0.02, h, 0.06, i % 2 ? '#a7adb1' : '#b9bfc3', x - w / 2 + (w / 4) * (i + 0.5), y, z + 0.005);
}

function turbineVent(k: Kit, x: number, y: number, z: number) {
  k.cyl(0.1, 0.1, C.metal, x, y, z, 8);
  const v = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4), new THREE.MeshStandardMaterial({ color: '#c9ced2', flatShading: true }));
  v.position.set(x, y + 0.18, z);
  k.add(v);
  k.anims.push((t) => (v.rotation.y = t * 4));
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    hoist(k, -0.5, -0.6, y, 1.1);
    workbench(k, 0.9, -1.2, y);
    drums(k, -1.5, 0.8, y, 3);
    k.crates(1.3, 0.9, y, 3);
    jeep(k, 0.3, 0.6, y, -0.4);
    k.sandbags(-1.5, -1.6, 1.0, 0, y);
    sparks(k, -0.5, y + 0.35, -0.6);
    return;
  }
  if (level === 2) {
    // Tool shed plus an outdoor welding station
    const h = k.block(1.6, 1.2, 1, -0.9, y, -1.1, C.wood);
    k.gableRoof(1.6, 1.2, 0.45, -0.9, y + h, -1.1, C.zinc, 0.15, C.wood);
    k.door('front', -0.9, -1.1, 1.6, 1.2, 0, y, 0.5, 0.62, '#7a5a3b');
    workbench(k, 1.0, -1.2, y);
    k.box(0.4, 0.3, 0.3, '#5c6166', 0.9, y, 0.1); // anvil block
    k.box(0.5, 0.08, 0.2, '#33383d', 0.9, y + 0.3, 0.1);
    k.gasCylinders(1.4, 0.9, 2, y);
    jeep(k, -0.7, 0.8, y, 0.3);
    hoist(k, 0.1, -0.5, y, 0.9);
    sparks(k, 0.9, y + 0.45, 0.1);
    return;
  }
  // 3: lean-to: single-slope zinc roof, high open front, benches inside
  for (const x of [-1.6, 0, 1.6]) {
    k.box(0.08, 1.45, 0.08, '#7a5a3b', x, y, 0.3);
    k.box(0.08, 0.95, 0.08, '#7a5a3b', x, y, -1.5);
  }
  k.box(3.4, 0.95, 0.06, C.wood, 0, y, -1.55);
  const roof = k.box(3.6, 0.06, 2.2, C.zinc, 0, y + 1.2, -0.6);
  roof.rotation.x = -0.25;
  workbench(k, -0.9, -1.25, y, 1.0);
  workbench(k, 0.7, -1.25, y, 1.0);
  hoist(k, 0.2, -0.3, y, 1.0);
  drums(k, -1.5, 1.0, y, 2);
  jeep(k, 0.8, 1.1, y, Math.PI);
  sparks(k, 0.7, y + 0.4, -1.1);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Two open bays separated by columns, red roof, vehicle visible inside
    const w = 3.4, d = 2.2, z = -0.6;
    k.box(w, 1.2, 0.1, C.wall, 0, y, z - d / 2 + 0.05);
    for (const s of [-1, 1]) k.box(0.1, 1.2, d, C.wall, s * (w / 2 - 0.05), y, z);
    k.box(0.12, 1.2, 0.12, C.white, 0, y, z + d / 2 - 0.06);
    k.box(w, 0.12, d, C.wall, 0, y + 1.2, z);
    k.hipRoof(w, d, 0.4, 0, y + 1.32, z);
    lift(k, -0.85, z - 0.1, y);
    workbench(k, 0.85, z - 0.85, y);
    jeep(k, 0.85, z + 0.3, y, Math.PI / 2);
    drums(k, 1.4, 1.2, y, 3);
    sparks(k, 0.85, y + 0.45, z - 0.8);
    return;
  }
  if (level === 5) {
    // Workshop plus a tall spray booth with an exhaust stack
    const h = k.block(2.4, 2.0, 1, -0.6, y, -0.7);
    k.box(2.4, 0.3, 2.0, C.wall, -0.6, y + STOREY, -0.7);
    k.gableRoof(2.4, 2.0, 0.5, -0.6, y + h + 0.3, -0.7);
    bayDoor(k, -0.6, 0.31, 1.5, 1.0, y, true);
    k.box(1.0, 1.6, 1.4, '#e8e8e2', 1.35, y, -0.9);
    k.box(0.9, 0.9, 0.04, '#5d8aa3', 1.35, y + 0.1, -0.19);
    k.cyl(0.1, 0.9, C.metal, 1.6, y + 1.6, -1.3, 8);
    k.emitters.push({ pos: new THREE.Vector3(1.6, y + 2.6, -1.3), kind: 'smoke' });
    lift(k, -0.6, 1.2, y, 0);
    turbineVent(k, -0.6, y + 1.55, -0.7);
    workbench(k, 1.3, 0.9, y, 0.8, Math.PI);
    sparks(k, -0.6, y + 0.4, 0.6);
    return;
  }
  // 6: sawtooth north-light factory roof
  const w = 3.4, d = 2.6, z = -0.5;
  k.box(w, 1.5, d, C.wall, 0, y, z);
  k.box(w + 0.03, 0.15, d + 0.03, C.trim, 0, y, z);
  for (let i = 0; i < 4; i++) {
    const tz = z - d / 2 + 0.33 + i * 0.65;
    const slope = k.box(w, 0.05, 0.75, C.roof, 0, y + 1.75, tz);
    slope.rotation.x = 0.6;
    k.box(w, 0.42, 0.04, '#86b7cc', 0, y + 1.5, tz + 0.3);
  }
  bayDoor(k, -0.6, z + d / 2 + 0.01, 1.4, 1.2, y, true);
  k.windowRow('front', 0, z, w, d, 2, y + 0.6, { span: 0.8, skip: [0] });
  lift(k, 1.2, 1.2, y, Math.PI / 2);
  drums(k, -1.5, 1.2, y, 3);
  sparks(k, -0.6, y + 0.4, 0.9);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Three bays in a long shed with an outdoor inspection ramp
    const w = 3.6, d = 1.8, z = -1.0;
    const h = k.block(w, d, 1, 0, y, z) + 0.3;
    k.box(w, 0.3, d, C.wall, 0, y + STOREY, z);
    k.hipRoof(w, d, 0.85, 0, y + h, z);
    for (const x of [-1.2, 0, 1.2]) bayDoor(k, x, z + d / 2 + 0.01, 0.95, 1.0, y, x === 0);
    const ramp = k.box(1.2, 0.08, 1.2, '#5c6166', -0.6, y + 0.18, 0.95);
    ramp.rotation.x = 0.12;
    for (const s of [-0.35, 0.35]) k.box(0.24, 0.3, 1.2, SAFETY, -0.6 + s, y, 0.95);
    jeep(k, -0.6, 0.95, y, Math.PI / 2, 0.3);
    workbench(k, 1.1, 1.0, y, 0.9, Math.PI);
    for (const vx of [-1.2, 0, 1.2]) turbineVent(k, vx, y + h + 0.5, z);
    sparks(k, 0, y + 0.4, 0.0);
    return;
  }
  if (level === 8) {
    // Machine shop: tall open-sided bay with a yellow overhead travelling crane
    const w = 3.4, d = 2.4, z = -0.6;
    k.box(w, 2.3, 0.12, C.wall, 0, y, z - d / 2 + 0.06);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.box(0.14, 2.3, 0.14, C.white, s * (w / 2 - 0.07), y, z - d / 2 + 0.1 + i * ((d - 0.2) / 3));
    k.gableRoof(w, d, 0.45, 0, y + 2.3, z, C.zinc);
    for (const s of [-1, 1]) k.box(0.08, 0.1, d, '#5c6166', s * (w / 2 - 0.25), y + 1.9, z);
    const bridge = new THREE.Group();
    k.box(w - 0.4, 0.14, 0.18, SAFETY, 0, 1.95, 0, bridge);
    const trolley = new THREE.Group();
    k.box(0.2, 0.2, 0.24, '#33383d', 0, 1.78, 0, trolley);
    k.box(0.02, 0.9, 0.02, '#33383d', 0, 0.9, 0, trolley);
    k.box(0.4, 0.3, 0.3, '#5c6166', 0, 0.6, 0, trolley);
    bridge.add(trolley);
    bridge.position.set(0, y, z + 0.3);
    k.add(bridge);
    // Overhead crane: bridge travels along the bay while the trolley crosses it.
    k.anims.push((t) => {
      bridge.position.z = z + 0.3 + Math.sin(t * 0.4) * 0.7;
      trolley.position.x = Math.sin(t * 0.7 + 1) * 1.1;
    });
    for (const x of [-1.0, 0.0]) {
      k.box(0.5, 0.5, 0.4, '#5d8aa3', x, y, z - 0.6); // lathes
      k.box(0.3, 0.1, 0.2, '#33383d', x, y + 0.5, z - 0.6);
    }
    workbench(k, 1.1, z - 0.8, y);
    jeep(k, -0.7, 1.25, y, 0);
    sparks(k, 0.4, y + 0.6, z + 0.3);
    return;
  }
  if (level === 9) {
    // Engineering block: two-storey office plus tall workshop with turbine vents
    const oh = k.block(1.2, 2.2, 2, -1.2, y, -0.7, C.wallAlt);
    k.hipRoof(1.2, 2.2, 0.45, -1.2, y + oh, -0.7);
    for (let f = 0; f < 2; f++) k.windowRow('front', -1.2, -0.7, 1.2, 2.2, 2, y + f * STOREY + 0.42, { louvre: f > 0 });
    const w = 2.2, d = 2.6, x = 0.6, z = -0.5;
    k.box(w, 2.6, d, C.wall, x, y, z);
    k.box(w + 0.03, 0.15, d + 0.03, C.trim, x, y, z);
    k.flatRoof(w, d, x, y + 2.6, z);
    for (const vx of [0.0, 0.6, 1.2]) turbineVent(k, vx, y + 2.66, z - 0.4);
    bayDoor(k, x, z + d / 2 + 0.01, 1.4, 1.6, y, true);
    lift(k, x, z + 0.2, y, Math.PI / 2);
    drums(k, -1.6, 1.3, y, 3);
    workbench(k, 1.3, 1.3, y, 0.8, Math.PI);
    sparks(k, x - 0.3, y + 0.5, z + 0.5);
    return;
  }
  // 10: complex: sawtooth bay + spray booth + parts store + jeep on lift
  const w = 2.6, d = 2.6, z = -0.5, x = -0.6;
  k.box(w, 2.2, d, C.wall, x, y, z);
  k.box(w + 0.03, 0.15, d + 0.03, C.trim, x, y, z);
  for (let i = 0; i < 4; i++) {
    const tz = z - d / 2 + 0.33 + i * 0.65;
    const slope = k.box(w, 0.05, 0.75, C.roof, x, y + 2.45, tz);
    slope.rotation.x = 0.6;
    k.box(w, 0.42, 0.04, '#86b7cc', x, y + 2.2, tz + 0.3);
  }
  bayDoor(k, x, z + d / 2 + 0.01, 1.4, 1.4, y, true);
  lift(k, x, z + 0.2, y, Math.PI / 2);
  k.box(1.1, 2.0, 1.3, '#e8e8e2', 1.35, y, -1.1);
  k.cyl(0.1, 1.0, C.metal, 1.6, y + 2.0, -1.5, 8);
  k.emitters.push({ pos: new THREE.Vector3(1.6, y + 3.1, -1.5), kind: 'smoke' });
  k.box(1.1, 0.9, 0.9, C.wallAlt, 1.35, y, 0.35); // parts store
  k.hipRoof(1.1, 0.9, 0.3, 1.35, y + 0.9, 0.35);
  jeep(k, 0.4, 1.35, y, 0);
  sparks(k, x + 0.4, y + 0.5, z + 0.6);
}

function command(k: Kit, level: number, y: number) {
  const w = 3.4, d = 2.6, z = -0.5;
  if (level === 11) {
    // CNC workshop: solid hall with a long window strip onto the machine floor and a teal stripe
    k.box(w, 2.75, d, '#e6e9eb', 0, y, z);
    k.box(w - 0.3, 0.75, 0.04, DARK_GLASS, 0, y + 0.35, z + d / 2 + 0.01);
    k.box(w + 0.02, 0.25, d + 0.02, '#2bb3a3', 0, y + 2.2, z);
    for (let i = 0; i < 4; i++) {
      k.box(0.6, 0.8, 0.55, '#d9d2c3', -1.2 + i * 0.8, y, z + 0.4);
      k.box(0.3, 0.25, 0.04, DARK_GLASS, -1.2 + i * 0.8, y + 0.4, z + 0.68);
      k.box(0.06, 0.06, 0.06, '#3fd16b', -0.98 + i * 0.8, y + 0.85, z + 0.6);
    }
    k.box(w + 0.06, 0.1, d + 0.06, C.trim, 0, y + 2.75, z);
    for (const x of [-1.0, 0, 1.0]) turbineVent(k, x, y + 2.85, z - 0.5);
    lift(k, 1.2, 1.3, y, 0);
    sparks(k, -0.4, y + 0.6, z + 0.4);
    return;
  }
  if (level === 12) {
    // Fab lab under a folded (zig-zag pleated) roof
    k.box(w, 2.6, d, C.wall, 0, y, z);
    k.box(w - 0.3, 1.0, 0.04, DARK_GLASS, 0, y + 1.3, z + d / 2 + 0.01);
    for (let i = 0; i < 6; i++) {
      const p = k.box(0.62, 0.05, d + 0.3, i % 2 ? C.white : '#2bb3a3', -w / 2 + 0.28 + i * 0.57, y + 2.75, z);
      p.rotation.z = i % 2 ? -0.5 : 0.5;
    }
    bayDoor(k, -0.8, z + d / 2 + 0.01, 1.2, 1.1, y, true);
    workbench(k, 1.0, 1.2, y, 0.9, Math.PI);
    lift(k, -0.8, 1.25, y, 0);
    sparks(k, -0.8, y + 0.5, z + 0.8);
    return;
  }
  if (level === 13) {
    // Test rig yard: workshop + open steel test tower + engine test cell
    k.box(2.2, 2.7, d, C.wallAlt, -0.6, y, z);
    k.flatRoof(2.2, d, -0.6, y + 2.7, z);
    bayDoor(k, -0.6, z + d / 2 + 0.01, 1.3, 1.4, y, true);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.07, 3.2, 0.07, '#e94f37', 1.25 + sx * 0.4, y, -0.9 + sz * 0.4);
    for (let i = 1; i <= 4; i++) k.box(0.9, 0.05, 0.9, '#5c6166', 1.25, y + i * 0.78, -0.9);
    k.box(0.5, 0.35, 0.4, '#5c6166', 1.25, y + 2.4, -0.9); // test engine
    k.box(0.9, 1.0, 0.8, CONCRETE, 1.25, y, 0.6); // test cell
    k.box(0.5, 0.3, 0.04, DARK_GLASS, 1.25, y + 0.55, 1.01);
    lift(k, -0.6, z + 0.2, y, Math.PI / 2);
    sparks(k, 1.25, y + 2.6, -0.6);
    return;
  }
  if (level === 14) {
    // Cantilevered service roof over an outdoor apron with two lifts
    k.box(w, 2.8, 1.2, C.wall, 0, y, -1.3);
    k.box(w + 0.03, 0.12, 1.23, C.trim, 0, y, -1.3);
    for (const x of [-1.0, 0, 1.0]) bayDoor(k, x, -0.69, 0.8, 1.1, y, false);
    k.box(w + 0.3, 0.14, 3.0, C.white, 0, y + 2.8, -0.2);
    k.box(w + 0.32, 0.05, 3.02, C.trim, 0, y + 2.76, -0.2);
    for (const x of [-1.7, 1.7]) k.box(0.1, 2.8, 0.1, C.metal, x, y, 1.1);
    lift(k, -0.8, 0.4, y, 0);
    lift(k, 0.8, 0.4, y, 0);
    drums(k, -1.5, 1.4, y, 2);
    sparks(k, 0, y + 0.6, 0.4);
    return;
  }
  // 15: Grand engineering hall with a tall brick chimney and gold band
  k.box(w, 2.6, d, '#b5654a', 0, y, z);
  for (let i = 0; i < 5; i++) {
    k.box(0.4, 1.2, 0.04, DARK_GLASS, -1.3 + i * 0.65, y + 1.1, z + d / 2 + 0.01);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8, 0, Math.PI), new THREE.MeshStandardMaterial({ color: DARK_GLASS, side: THREE.DoubleSide }));
    arch.position.set(-1.3 + i * 0.65, y + 2.3, z + d / 2 + 0.02);
    k.add(arch);
  }
  k.box(w + 0.06, 0.1, d + 0.06, '#d9b24a', 0, y + 2.6, z);
  k.gableRoof(w, d, 0.6, 0, y + 2.7, z, C.zinc);
  k.cyl(0.22, 3.6, '#a8473a', 1.5, y, -1.6, 10, 0.16);
  k.cyl(0.24, 0.1, '#d9b24a', 1.5, y + 3.0, -1.6, 10);
  k.emitters.push({ pos: new THREE.Vector3(1.5, y + 3.7, -1.6), kind: 'smoke' });
  bayDoor(k, -0.2, z + d / 2 + 0.02, 1.2, 0.95, y, true);
  lift(k, -0.2, 1.3, y, 0);
  workbench(k, 1.2, 1.3, y, 0.8, Math.PI);
  k.plaque('ENGINEERING', -1.1, 1.6, y, 1.0);
  sparks(k, -0.2, y + 0.5, z + 1.0);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 1.72, 1.72, false);
  if (level === 16) {
    // Blast-door workshop: concrete hall with three heavy doors in hazard frames, roof vents
    k.box(3.4, 3.0, 2.6, CONCRETE, 0, y, -0.6);
    for (const x of [-1.0, 0, 1.0]) {
      k.box(0.86, 1.25, 0.08, '#6b7075', x, y, 0.72);
      for (let i = 0; i < 6; i++) k.box(0.16, 0.08, 0.1, i % 2 ? C.kerbB : C.kerbY, x - 0.4 + i * 0.16, y + 1.27, 0.74);
    }
    for (const x of [-1.0, 0, 1.0]) turbineVent(k, x, y + 3.0, -1.2);
    k.box(3.44, 0.1, 2.64, C.white, 0, y + 3.0, -0.6);
    jeep(k, 0.0, 1.25, y, 0);
    sparks(k, -1.0, y + 0.4, 0.9);
    return;
  }
  if (level === 17) {
    // Robot assembly hall: glass hall with two big yellow robot arms over a line
    k.glassBox(3.2, 2.9, 2.4, 0, y, -0.7);
    k.box(3.3, 0.12, 2.5, C.white, 0, y + 2.9, -0.7);
    k.box(2.8, 0.3, 0.4, '#5c6166', 0, y, -0.6); // line
    for (const x of [-0.8, 0.8]) {
      k.cyl(0.16, 0.3, SAFETY, x, y, -1.2, 8);
      const s = x < 0 ? 1 : -1;
      const base = new THREE.Group();
      base.position.set(x, y + 0.3, -1.2);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: SAFETY, flatShading: true }));
      base.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = 1.0;
      upper.add(elbow);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1).translate(0, 0.375, 0), new THREE.MeshStandardMaterial({ color: SAFETY, flatShading: true }));
      elbow.add(fore);
      k.add(base);
      k.anims.push((t) => {
        base.rotation.y = Math.sin(t * 0.8 + x) * 0.6;
        upper.rotation.z = -s * (0.45 + Math.sin(t * 1.1 + x) * 0.15);
        elbow.rotation.z = -s * (1.1 + Math.sin(t * 1.3 + x) * 0.3);
      });
    }
    jeep(k, 0, -0.6, y + 0.3, 0);
    roofCanopy(k, 2.8, 2.0, 0, y + 3.02, -0.7, 0.3);
    sparks(k, 0, y + 0.8, -0.6);
    return;
  }
  if (level === 18) {
    // Energy workshop: battery packs, a small wind turbine and a solar canopy over the bays
    k.box(2.4, 2.8, 2.2, CONCRETE, -0.6, y, -0.8);
    bayDoor(k, -0.6, 0.31, 1.4, 1.3, y, true);
    roofCanopy(k, 2.2, 2.0, -0.6, y + 2.8, -0.8, 0.4);
    for (let i = 0; i < 3; i++) {
      k.box(0.8, 0.55, 0.45, '#2bb3a3', 1.3, y + i * 0.57, -1.3);
      k.box(0.82, 0.04, 0.47, C.white, 1.3, y + i * 0.57 + 0.5, -1.3);
    }
    k.cyl(0.04, 3.2, C.white, 1.4, y, 0.2, 6);
    const rotor = new THREE.Group();
    rotor.position.set(1.4, y + 3.2, 0.25);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.02).translate(0, 0.27, 0), new THREE.MeshStandardMaterial({ color: C.white, flatShading: true }));
      blade.rotation.z = (b / 3) * Math.PI * 2;
      rotor.add(blade);
    }
    k.add(rotor);
    k.anims.push((t) => (rotor.rotation.z = t * 2.2));
    jeep(k, -0.6, 1.1, y, Math.PI / 2);
    sparks(k, -0.6, y + 0.5, -0.2);
    return;
  }
  if (level === 19) {
    // Ramp test workshop: workshop with a raised test ramp and a jeep cresting it
    k.box(2.0, 2.9, 2.4, C.wallAlt, -0.8, y, -0.7);
    k.flatRoof(2.0, 2.4, -0.8, y + 2.9, -0.7);
    for (let f = 0; f < 3; f++) k.box(1.7, 0.3, 0.04, DARK_GLASS, -0.8, y + f * STOREY + 0.4, 0.51);
    const up = k.box(0.6, 0.06, 1.6, '#5c6166', 1.25, y + 0.55, 0.2);
    up.rotation.x = -0.6;
    k.box(0.6, 1.0, 0.6, SAFETY, 1.25, y, -1.1);
    k.box(0.64, 0.06, 0.64, '#5c6166', 1.25, y + 1.0, -1.1);
    jeep(k, 1.25, -1.1, y + 1.06, Math.PI / 2);
    for (const s of [-1, 1]) k.box(0.04, 0.4, 1.6, SAFETY, 1.25 + s * 0.32, y + 0.4, 0.2).rotation.x = -0.6;
    workbench(k, -0.8, 1.2, y, 1.0, Math.PI);
    for (const vx of [-1.3, -0.3]) turbineVent(k, vx, y + 2.96, -1.2);
    sparks(k, -0.8, y + 0.5, 1.1);
    return;
  }
  // 20: Forge citadel: hall with a glowing forge tower, glass gallery, gold accents
  k.box(3.0, 2.6, 2.2, CONCRETE, -0.3, y, -0.8);
  k.glassBox(3.0, 0.8, 0.4, -0.3, y + 1.8, 0.5);
  k.box(3.04, 0.1, 2.24, '#d9b24a', -0.3, y + 2.6, -0.8);
  const fx = 1.4, fz = -1.2;
  k.box(0.8, 3.3, 0.8, '#5c6166', fx, y, fz);
  k.box(0.5, 0.4, 0.04, '#ff8a1f', fx, y + 0.5, fz + 0.41);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff6a13', emissiveIntensity: 1.2 }));
  glow.position.set(fx, y + 0.7, fz + 0.43);
  k.add(glow);
  k.box(0.86, 0.1, 0.86, '#d9b24a', fx, y + 3.3, fz);
  k.emitters.push({ pos: new THREE.Vector3(fx, y + 3.5, fz), kind: 'smoke' });
  bayDoor(k, -0.6, 0.31, 1.4, 1.2, y, true);
  lift(k, -0.6, 1.1, y, 0);
  sparks(k, fx, y + 0.7, fz + 0.6);
}

export function buildWorkshop(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const WORKSHOP: BuildingDef = {
  id: 'workshop',
  name: 'Workshop',
  role: 'Produces Supplies and repairs vehicles and equipment.',
  footprint: [4, 4],
  unlockHq: 2,
  levels: WORKSHOP_LEVELS,
  designedLevels: 20,
  build: buildWorkshop,
};
