import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, roofCanopy } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * QM Store: stores Supplies; delivery trucks unload here.
 * Signature at every level: crates & pallets, a forklift, a loading dock / roller shutter.
 * Footprint 4×4; height budget ~4 storeys.
 */

const TITLES = [
  'Supply Dump', 'Container Store', 'Timber Godown', 'QM Store', 'Store · Steel Shed', 'Quonset Store',
  'Store · Gantry Yard', 'Distribution Depot', 'High-Bay Store', 'Logistics Hub', 'Automated Store', 'Drone Depot',
  'Vertical Store', 'Wave-Roof Depot', 'Grand Goods Shed', 'Vault Store', 'Robotic Warehouse', 'Tensile Depot',
  'Rail Depot', 'Dome Depot',
];
const SUPPLIES = [100, 400, 1_100, 3_000, 7_000, 14_000, 26_000, 48_000, 80_000, 135_000, 210_000, 320_000, 450_000, 610_000, 800_000, 1_050_000, 1_350_000, 1_650_000, 2_000_000, 2_400_000];
const REPUTATION = [0, 0, 20, 80, 200, 400, 700, 1_100, 1_600, 2_300, 3_100, 4_100, 5_300, 6_700, 8_300, 10_000, 12_000, 14_300, 16_900, 19_800];
const TIME = [1 * MIN, 4 * MIN, 15 * MIN, 45 * MIN, 1.5 * HOUR, 3 * HOUR, 5 * HOUR, 8 * HOUR, 14 * HOUR, 20 * HOUR, 1.25 * DAY, 1.75 * DAY, 2.25 * DAY, 2.75 * DAY, 3.25 * DAY, 3.75 * DAY, 4.25 * DAY, 4.75 * DAY, 5.25 * DAY, 5.75 * DAY];

export const QM_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const capacity = Math.round((1500 * Math.pow(1.38, i)) / 500) * 500;
  const unload = 10 + level * 3;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((320 * Math.pow(1.2, i)) / 10) * 10,
    stats: { capacity, unloadPerMin: unload },
    unlocks: [`Stores ${capacity.toLocaleString('en')} Supplies`, `Unloads ${unload} Supplies/min`],
  };
});

// ------------------------------------------------------------------ signature props

const OLIVE = '#5b6b3a';
const RACK_UP = '#ff8a1f';
const RACK_BEAM = '#2f6fa8';
const BOX = ['#c49a6c', '#b07a4a', OLIVE, '#d9c08a'];

/** Wooden pallet with a load on it. */
function pallet(k: Kit, x: number, z: number, y: number, load: 'crates' | 'drums' | 'sacks' | 'none' = 'crates', seed = 0) {
  k.box(0.5, 0.06, 0.5, '#b8895a', x, y, z);
  if (load === 'crates') {
    k.box(0.44, 0.24, 0.44, BOX[seed % BOX.length], x, y + 0.06, z);
    if (seed % 2 === 0) k.box(0.3, 0.18, 0.3, BOX[(seed + 1) % BOX.length], x, y + 0.3, z);
  } else if (load === 'drums') {
    for (const [dx, dz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) k.cyl(0.09, 0.26, seed % 2 ? '#2f6fa8' : OLIVE, x + dx, y + 0.06, z + dz, 8);
  } else if (load === 'sacks') {
    for (let l = 0; l < 2; l++) for (const dz of [-0.12, 0.12]) k.box(0.42, 0.1, 0.2, '#d8c79a', x, y + 0.06 + l * 0.1, z + dz);
  }
}

/** Little yellow forklift, facing +x by default. */
function forklift(k: Kit, x: number, z: number, y: number, rot = 0, loaded = true) {
  const g = new Kit();
  g.box(0.42, 0.18, 0.3, '#ffc93c', 0, 0.08, 0);
  g.box(0.14, 0.18, 0.3, '#33383d', -0.18, 0.08, 0); // counterweight
  for (const sx of [-0.14, 0.14]) for (const sz of [-0.16, 0.16]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2b2d', flatShading: true }));
    w.position.set(sx, 0.07, sz);
    g.add(w);
  }
  for (const sz of [-0.12, 0.12]) g.box(0.03, 0.42, 0.03, '#33383d', -0.05, 0.26, sz); // overhead guard
  g.box(0.24, 0.02, 0.3, '#33383d', -0.08, 0.68, 0);
  g.box(0.03, 0.55, 0.22, '#5c6166', 0.23, 0.04, 0); // mast
  for (const sz of [-0.07, 0.07]) g.box(0.24, 0.02, 0.04, '#5c6166', 0.36, 0.06, sz); // forks
  if (loaded) {
    g.box(0.36, 0.05, 0.36, '#b8895a', 0.38, 0.08, 0);
    g.box(0.3, 0.2, 0.3, BOX[0], 0.38, 0.13, 0);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rot;
  k.add(g.group);
}

/** Orange/blue pallet racking with boxes. */
function racking(k: Kit, x: number, z: number, y: number, w: number, levels: number, rotY = 0) {
  const g = new Kit();
  const bays = Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i <= bays; i++) g.box(0.04, levels * 0.38, 0.36, RACK_UP, -w / 2 + (w / bays) * i, 0, 0);
  for (let l = 1; l <= levels; l++) {
    g.box(w, 0.04, 0.04, RACK_BEAM, 0, l * 0.38 - 0.06, 0.16);
    g.box(w, 0.04, 0.04, RACK_BEAM, 0, l * 0.38 - 0.06, -0.16);
    for (let b = 0; b < bays; b++) g.box(0.42, 0.24, 0.3, BOX[(b + l) % BOX.length], -w / 2 + (w / bays) * (b + 0.5), (l - 1) * 0.38 + 0.02, 0);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
}

/** Corrugated shipping container. */
function container(k: Kit, x: number, z: number, y: number, len: number, color: string, rotY = 0) {
  const g = new Kit();
  g.box(len, 0.6, 0.55, color, 0, 0, 0);
  const n = Math.round(len / 0.12);
  const rib = '#' + new THREE.Color(color).multiplyScalar(0.75).getHexString();
  for (let i = 1; i < n; i++) g.box(0.02, 0.56, 0.57, rib, -len / 2 + (len / n) * i, 0.02, 0);
  g.box(0.02, 0.56, 0.5, '#33383d', len / 2 + 0.005, 0.02, 0);
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
}

/** Raised loading dock with black/yellow bumpers along the front. */
function dock(k: Kit, x: number, z: number, w: number, y: number, d = 0.45, h = 0.28) {
  k.box(w, h, d, CONCRETE, x, y, z);
  for (let i = 0; i < Math.round(w / 0.5); i++) k.box(0.1, 0.12, 0.05, i % 2 ? C.kerbY : C.kerbB, x - w / 2 + 0.25 + i * 0.5, y + 0.08, z + d / 2 + 0.02);
  return h;
}

/** Store building with a roller shutter on the front. Returns wall height. */
function store(k: Kit, w: number, d: number, x: number, z: number, y: number, storeys = 1, wall: string = C.wall) {
  const h = k.block(w, d, storeys, x, y, z, wall);
  k.shutter('front', x, z, w, d, 0, Math.min(1.0, w * 0.45), Math.min(0.8, storeys * STOREY * 0.75));
  return h;
}

function camoNet(k: Kit, w: number, d: number, x: number, z: number, y: number, h = 0.7) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, h, 0.05, C.wood, x + (sx * w) / 2, y, z + (sz * d) / 2);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, d + 0.3, 6, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: OLIVE, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  const pos = net.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 3) * 0.05 + Math.cos(pos.getZ(i) * 4) * 0.05 - 0.04);
  net.geometry.computeVertexNormals();
  net.position.set(x, y + h, z);
  k.add(net);
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Supply Dump: pallets in the open under a camo net, sandbag ring.
    camoNet(k, 2.4, 2.0, -0.2, -0.3, y);
    [[-0.9, -0.9, 'crates'], [-0.3, -0.9, 'drums'], [0.3, -0.9, 'crates'], [-0.9, -0.2, 'sacks'], [0.3, -0.2, 'crates'], [-0.3, 0.4, 'sacks']].forEach(([x, z, l], i) =>
      pallet(k, x as number, z as number, y, l as 'crates', i));
    k.sandbags(-0.2, 1.1, 2.4, 0, y);
    k.sandbags(1.45, -0.3, 1.6, Math.PI / 2, y);
    k.crates(1.4, 1.4, y, 3);
    return;
  }
  if (level === 2) {
    // Container Store: olive container with a lean-to canopy and pallets.
    container(k, -0.2, -1.1, y, 2.6, '#5b6b3a');
    container(k, -0.4, -1.1, y + 0.6, 2.2, '#7a8a3a');
    pallet(k, 1.2, 0.6, y, 'drums', 3);
    pallet(k, -1.4, 0.8, y, 'crates', 2);
    for (const x of [-1.4, 0, 1.0]) k.box(0.05, 0.8, 0.05, C.wood, x, y, 0.1);
    const lean = k.box(2.6, 0.04, 1.1, C.zinc, -0.2, y + 0.82, -0.35);
    lean.rotation.x = -0.12;
    pallet(k, -1.0, -0.2, y, 'crates', 0);
    pallet(k, -0.4, -0.2, y, 'drums', 1);
    pallet(k, 0.6, 0.6, y, 'sacks', 2);
    k.crates(1.4, -1.4, y, 2);
    return;
  }
  // 3: Timber Godown: plank shed with big sliding barn doors and a ramp.
  const w = 3.0, d = 2.0, z = -0.55;
  const h = k.block(w, d, 1, 0, y, z, C.wood);
  for (let i = 1; i < 6; i++) k.box(w + 0.01, 0.015, d + 0.01, '#8a5a3b', 0, y + i * 0.15, z);
  k.gableRoof(w, d, 0.55, 0, y + h, z, C.zinc, 0.18, C.wood);
  k.box(0.7, 0.72, 0.05, '#7a5a3b', -0.35, y, z + d / 2 + 0.03);
  k.box(0.7, 0.72, 0.05, '#8a6040', 0.55, y, z + d / 2 + 0.05);
  for (const s of [-0.65, 0.85]) k.box(0.04, 0.72, 0.06, '#5a3e28', s, y, z + d / 2 + 0.06); // X braces hint
  k.box(1.6, 0.03, 0.08, C.metal, 0.1, y + 0.74, z + d / 2 + 0.05); // door rail
  const ramp = k.box(0.9, 0.05, 0.6, '#9c6b45', -0.35, y + 0.05, z + d / 2 + 0.3);
  ramp.rotation.x = 0.15;
  pallet(k, 1.3, 1.2, y, 'sacks', 0);
  pallet(k, 0.7, 1.3, y, 'crates', 1);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // QM Store: cream store, red gable roof, issue window with counter, dock.
    const w = 3.2, d = 1.9, z = -0.75;
    const h = store(k, w, d, 0, z, y);
    k.gableRoof(w, d, 0.55, 0, y + h, z);
    k.window('front', 0, z, w, d, 1.15, y + 0.42, 0.42, 0.3);
    k.box(0.55, 0.05, 0.25, C.wood, 1.15, y + 0.38, z + d / 2 + 0.12); // issue counter
    k.box(0.6, 0.06, 0.4, C.roofGreen, 1.15, y + 0.85, z + d / 2 + 0.2);
    dock(k, -0.3, z + d / 2 + 0.24, 1.6, y);
    pallet(k, -1.2, 1.3, y, 'crates', 0);
    forklift(k, 0.3, 1.25, y, Math.PI);
    return;
  }
  if (level === 5) {
    // Store + tall open-sided steel shed with a single-slope roof and racking.
    const h = store(k, 1.6, 1.8, -1.0, -0.8, y);
    k.hipRoof(1.6, 1.8, 0.45, -1.0, y + h, -0.8);
    for (const x of [0.25, 1.75]) for (const z of [-1.6, 0.0]) k.box(0.08, 1.3, 0.08, '#8a9196', x, y, z);
    const roof = k.box(1.9, 0.06, 2.0, C.zinc, 1.0, y + 1.2, -0.8);
    roof.rotation.x = 0.2;
    racking(k, 1.0, -1.35, y, 1.4, 3);
    pallet(k, 0.7, -0.4, y, 'drums', 1);
    forklift(k, 0.3, 0.9, y, -0.4);
    pallet(k, -1.3, 1.2, y, 'sacks', 2);
    return;
  }
  // 6: Quonset Store: corrugated half-cylinder hut, end wall with shutter.
  const r = 1.5, len = 3.2, z = -0.4;
  const q = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: C.zinc, flatShading: true, side: THREE.DoubleSide }));
  q.rotation.x = Math.PI / 2;
  q.rotation.y = Math.PI / 2;
  q.position.set(0, y, z);
  q.castShadow = true;
  k.add(q);
  // Rib lines
  for (let i = 0; i <= 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.015, 3, 14, Math.PI), new THREE.MeshStandardMaterial({ color: '#7f888c' }));
    rib.position.set(0, y, z - len / 2 + (len / 6) * i);
    k.add(rib);
  }
  const end = new THREE.Mesh(new THREE.CircleGeometry(r, 14, 0, Math.PI), new THREE.MeshStandardMaterial({ color: C.wall, flatShading: true, side: THREE.DoubleSide }));
  end.position.set(0, y, z + len / 2);
  k.add(end);
  k.shutter('front', 0, z, 1.6, len, 0, 0.9, 0.9);
  dock(k, 0, z + len / 2 + 0.24, 1.4, y);
  // Lean-to bay along the side
  k.box(0.9, 0.05, 3.0, C.zinc, 1.6, y + 1.0, -0.4);
  for (const z2 of [-1.6, 0.7]) k.box(0.05, 1.0, 0.05, '#8a9196', 1.95, y, z2);
  pallet(k, 1.65, -1.0, y, 'drums', 1);
  pallet(k, 1.65, -0.2, y, 'sacks', 2);
  pallet(k, -1.5, 1.55, y, 'crates', 0);
  forklift(k, 1.3, 1.55, y, Math.PI);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Store + gantry crane yard with containers.
    const h = store(k, 1.7, 3.4, -1.05, -0.1, y);
    k.hipRoof(1.7, 3.4, 0.45, -1.05, y + h, -0.1);
    container(k, 1.05, -1.0, y, 1.5, '#2f6fa8', Math.PI / 2);
    container(k, 1.05, 0.7, y, 1.5, '#e0622c', Math.PI / 2);
    container(k, 1.05, -1.0, y + 0.6, 1.5, '#5b6b3a', Math.PI / 2);
    for (const z of [-1.7, 1.5]) for (const x of [0.25, 1.85]) k.box(0.08, 1.6, 0.08, '#ffc93c', x, y, z);
    for (const z of [-1.7, 1.5]) k.box(1.7, 0.1, 0.1, '#ffc93c', 1.05, y + 1.6, z);
    for (const x of [0.25, 1.85]) k.box(0.1, 0.1, 3.3, '#ffc93c', x, y + 1.6, -0.1);
    k.box(0.4, 0.2, 0.3, '#33383d', 1.05, y + 1.5, 0.2);
    k.box(0.02, 0.6, 0.02, '#33383d', 1.05, y + 0.9, 0.2);
    return;
  }
  if (level === 8) {
    // Distribution Depot: long low warehouse, three dock doors under a canopy.
    const w = 3.6, d = 2.0, z = -0.8;
    const h = k.block(w, d, 1, 0, y, z) + 0.2;
    k.box(w, 0.2, d, C.wall, 0, y + STOREY, z);
    // Monitor roof: low zinc roof with a raised, louvred ventilation strip along the ridge.
    k.gableRoof(w, d, 0.3, 0, y + h, z, C.zinc);
    k.box(w - 0.4, 0.28, 0.6, C.wallAlt, 0, y + h + 0.22, z);
    k.windowRow('front', 0, z, w - 0.4, 0.6, 6, y + h + 0.28, { ww: 0.3, wh: 0.14, louvre: true, span: w - 0.8 });
    k.gableRoof(w - 0.4, 0.6, 0.2, 0, y + h + 0.5, z, C.zinc, 0.1);
    for (const x of [-1.15, 0, 1.15]) k.shutter('front', 0, z, w, d, x, 0.8, 0.75);
    dock(k, 0, z + d / 2 + 0.24, w, y);
    k.box(w + 0.2, 0.06, 0.8, C.roofGreen, 0, y + 1.05, z + d / 2 + 0.35);
    pallet(k, -1.2, 1.3, y, 'crates', 0);
    pallet(k, -0.6, 1.3, y, 'drums', 1);
    forklift(k, 0.6, 1.35, y, Math.PI);
    return;
  }
  if (level === 9) {
    // High-Bay Store: tall shed with clerestory strip and a glass mezzanine office pod.
    const w = 3.4, d = 2.6, z = -0.5;
    k.box(w, 2.2, d, '#d9d2c3', 0, y, z);
    k.box(w + 0.02, 0.2, d + 0.02, C.trim, 0, y, z);
    k.box(w - 0.3, 0.2, 0.04, DARK_GLASS, 0, y + 1.85, z + d / 2 + 0.01);
    k.box(0.04, 0.2, d - 0.3, DARK_GLASS, w / 2 + 0.01, y + 1.85, z);
    k.gableRoof(w, d, 0.4, 0, y + 2.2, z, C.zinc);
    k.shutter('front', 0, z, w, d, -0.6, 1.0, 1.1);
    k.glassBox(0.9, 0.5, 0.5, 1.0, y + 0.95, z + d / 2 + 0.25);
    k.box(0.04, 0.95, 0.04, C.metal, 1.4, y, z + d / 2 + 0.45);
    forklift(k, -0.6, 1.4, y, Math.PI / 2);
    pallet(k, 0.6, 1.4, y, 'crates', 0);
    return;
  }
  // 10: Logistics Hub: high-bay + cold store + covered dock + weighbridge.
  const h = 2.4;
  k.box(2.6, h, 2.6, '#d9d2c3', -0.6, y, -0.6);
  k.box(2.62, 0.2, 2.62, C.trim, -0.6, y, -0.6);
  k.box(2.3, 0.2, 0.04, DARK_GLASS, -0.6, y + 2.0, 0.71);
  k.hipRoof(2.6, 2.6, 0.45, -0.6, y + h, -0.6);
  k.shutter('front', -0.6, -0.6, 2.6, 2.6, -0.3, 1.0, 1.0);
  k.box(1.1, 1.4, 1.6, '#e8e8e2', 1.25, y, -0.9); // cold store
  k.box(0.4, 0.3, 0.2, '#c9ced2', 1.25, y + 1.4, -0.9);
  k.box(1.6, 0.06, 0.7, C.roofGreen, -0.6, y + 1.05, 0.9);
  dock(k, -0.6, 0.85, 2.0, y);
  k.box(1.0, 0.04, 0.6, '#5c6166', 1.2, y, 1.2); // weighbridge
  k.box(0.2, 0.4, 0.2, C.white, 1.85, y, 1.5);
  forklift(k, 1.0, 0.3, y, Math.PI);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Automated Store: white high-bay with a giant chevron stripe and a cantilevered control room.
    const w = 3.4, d = 2.6, z = -0.5;
    k.box(w, 2.6, d, '#f2f0ea', 0, y, z);
    for (let i = 0; i < 8; i++) k.box(0.36, 0.3, 0.04, i % 2 ? C.kerbB : C.kerbY, -1.45 + i * 0.41, y + 1.7, z + d / 2 + 0.01);
    k.box(w + 0.06, 0.08, d + 0.06, C.trim, 0, y + 2.6, z);
    k.glassBox(1.0, 0.6, 0.7, 1.3, y + 2.0, z + d / 2 + 0.2);
    k.shutter('front', 0, z, w, d, -0.6, 1.0, 1.0);
    dock(k, -0.6, z + d / 2 + 0.24, 1.6, y);
    forklift(k, 0.6, 1.5, y, Math.PI);
    return;
  }
  if (level === 12) {
    // Drone Depot: flat roof with drone pads and a delivery drone in flight.
    const w = 3.4, d = 2.6, z = -0.5;
    const h = k.block(w, d, 3, 0, y, z, C.wallAlt);
    k.flatRoof(w, d, 0, y + h, z);
    for (let f = 1; f < 3; f++) k.windowRow('front', 0, z, w, d, 5, y + f * STOREY + 0.42, { louvre: true });
    for (const [x, zz] of [[-0.9, -1.0], [0.9, -1.0], [0, 0.2]]) {
      k.cyl(0.42, 0.03, '#4a4f54', x, y + h + 0.06, zz, 12);
      k.cyl(0.36, 0.01, '#ffc93c', x, y + h + 0.09, zz, 12);
    }
    const drone = new Kit();
    drone.box(0.18, 0.06, 0.18, '#33383d', 0, 0, 0);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) drone.cyl(0.1, 0.01, '#c9ced2', dx * 0.16, 0.05, dz * 0.16, 10);
    drone.box(0.14, 0.12, 0.14, BOX[0], 0, -0.13, 0);
    drone.group.position.set(0.6, y + h + 0.9, 0.5);
    k.add(drone.group);
    k.shutter('front', 0, z, w, d, 0, 1.0, 0.75);
    dock(k, 0, z + d / 2 + 0.24, 1.8, y);
    pallet(k, -1.3, 1.4, y, 'crates', 0);
    forklift(k, 1.2, 1.4, y, Math.PI);
    return;
  }
  if (level === 13) {
    // Vertical Store: glass automated tower beside a low dock hall.
    k.glassBox(1.2, 3.1, 1.2, -1.15, y, -1.0);
    for (let l = 0; l < 5; l++) k.box(1.0, 0.04, 1.0, RACK_UP, -1.15, y + 0.5 + l * 0.55, -1.0);
    k.box(1.3, 0.12, 1.3, C.white, -1.15, y + 3.1, -1.0);
    const h = store(k, 2.4, 2.6, 0.75, -0.5, y, 3, CONCRETE);
    k.flatRoof(2.4, 2.6, 0.75, y + h, -0.5);
    const belt = k.box(0.9, 0.08, 0.2, '#5c6166', -0.15, y + 1.2, -1.0);
    belt.rotation.z = -0.3;
    dock(k, 0.75, 1.05, 2.0, y);
    forklift(k, 0.3, 1.6, y, Math.PI);
    pallet(k, 1.4, 1.6, y, 'drums', 1);
    return;
  }
  if (level === 14) {
    // Wave-Roof Depot: undulating roof of alternating arcs over a glazed shed.
    const w = 3.4, d = 2.6, z = -0.5;
    k.box(w, 2.85, d, CONCRETE, 0, y, z);
    k.box(w - 0.3, 0.4, 0.04, DARK_GLASS, 0, y + 2.2, z + d / 2 + 0.01);
    k.box(w + 0.02, 0.06, d + 0.02, C.trim, 0, y + 1.15, z);
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, d + 0.3, 10, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: i % 2 ? C.white : '#9aa3a6', flatShading: true, side: THREE.DoubleSide }));
      arc.rotation.x = Math.PI / 2;
      arc.scale.set(1, 1, i % 2 ? 0.45 : 0.75);
      arc.position.set(-1.27 + i * 0.85, y + 2.85, z);
      arc.rotation.y = 0;
      arc.castShadow = true;
      k.add(arc);
    }
    k.shutter('front', 0, z, w, d, 0.6, 1.0, 0.75);
    dock(k, 0.6, z + d / 2 + 0.24, 1.6, y);
    forklift(k, -0.7, 1.4, y, 0);
    pallet(k, -1.4, 1.4, y, 'crates', 1);
    return;
  }
  // 15: Grand Goods Shed: railway-style shed with three arched gable doorways and gold trim.
  const w = 3.6, d = 2.2, z = -0.6;
  const h = k.block(w, d, 2, 0, y, z) + 0.3;
  k.box(w, 0.3, d, C.wall, 0, y + 2 * STOREY, z);
  k.windowRow('front', 0, z, w, d, 6, y + STOREY + 0.45, { louvre: true });
  for (let i = 0; i < 3; i++) {
    const g = new Kit();
    g.gableRoof(1.1, d, 0.55, 0, 0, 0, C.roof, 0.08);
    g.group.rotation.y = Math.PI / 2;
    g.group.position.set(-1.2 + i * 1.2, y + h, z);
    k.add(g.group);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#7a8085', side: THREE.DoubleSide }));
    arch.position.set(-1.2 + i * 1.2, y + 0.7, z + d / 2 + 0.03);
    k.add(arch);
    k.box(0.76, 0.7, 0.04, '#a7adb1', -1.2 + i * 1.2, y, z + d / 2 + 0.03);
  }
  k.box(w + 0.04, 0.08, d + 0.04, '#d9b24a', 0, y + h - 0.1, z);
  dock(k, 0, z + d / 2 + 0.24, w, y);
  k.plaque('QM DEPOT', 1.2, 1.55, y, 1.0);
  forklift(k, -0.8, 1.45, y, Math.PI);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 1.72, 1.72, false);
  if (level === 16) {
    // Vault Store: windowless concrete box with a round vault door; fenced cage of crates.
    k.box(2.8, 2.9, 2.0, CONCRETE, -0.3, y, -0.8);
    for (let i = 0; i < 7; i++) k.box(2.82, 0.03, 2.02, '#c2bdb3', -0.3, y + 0.4 + i * 0.4, -0.8);
    roofCanopy(k, 2.4, 1.6, -0.3, y + 2.9, -0.8, 0.3);
    const door = k.cyl(0.5, 0.12, '#8a9196', -0.3, y + 0.15, 0.25, 16);
    door.rotation.x = Math.PI / 2;
    door.position.set(-0.3, y + 0.62, 0.22);
    k.cyl(0.08, 0.16, '#d9b24a', -0.3, y + 0.62, 0.28, 8).rotation.x = Math.PI / 2;
    for (const [x, z] of [[1.4, -1.2], [1.4, -0.4]]) pallet(k, x, z, y, 'crates', 2);
    for (let i = 0; i < 6; i++) k.box(0.03, 0.8, 0.03, C.metal, 1.05 + (i % 3) * 0.33, y, i < 3 ? -1.55 : -0.05);
    forklift(k, 0.8, 1.0, y, Math.PI);
    return;
  }
  if (level === 17) {
    // Robotic Warehouse: glass walls reveal a colourful robot shelving grid.
    k.glassBox(3.0, 2.85, 2.2, 0, y, -0.7);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const col = ['#ffc93c', '#2bb3a3', '#ff8a3d', '#5d8aa3'][(i + j) % 4];
      k.box(0.32, 2.2, 0.32, col, -1.1 + i * 0.55, y + 0.05, -1.4 + j * 0.6);
      k.box(0.26, 0.08, 0.26, '#e94f37', -1.1 + i * 0.55, y, -1.4 + j * 0.6 + 0.3);
    }
    k.box(3.1, 0.1, 2.3, C.white, 0, y + 2.85, -0.7);
    const belt = k.box(1.4, 0.08, 0.25, '#5c6166', 0.6, y + 0.35, 0.75);
    belt.rotation.y = 0;
    dock(k, -0.6, 0.65, 1.2, y);
    forklift(k, -0.6, 1.3, y, Math.PI);
    return;
  }
  if (level === 18) {
    // Tensile Depot: white peaked fabric canopies over a pallet yard.
    for (const [x, z] of [[-0.75, -0.8], [0.75, -0.8], [0, 0.55]]) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.75, 4, 1, true), new THREE.MeshStandardMaterial({ color: '#f7f5ef', flatShading: true, side: THREE.DoubleSide }));
      peak.rotation.y = Math.PI / 4;
      peak.position.set(x, y + 2.55, z);
      peak.castShadow = true;
      k.add(peak);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 2.2, 0.05, '#8a9196', x + sx * 0.6, y, z + sz * 0.6);
      k.cyl(0.02, 0.4, '#8a9196', x, y + 2.8, z, 4);
      racking(k, x, z - 0.35, y, 1.0, 2);
      pallet(k, x - 0.22, z, y, 'crates', Math.round(x * 3 + z));
      pallet(k, x + 0.3, z + 0.1, y, 'drums', 1);
    }
    forklift(k, 1.3, 0.9, y, Math.PI / 2);
    return;
  }
  if (level === 19) {
    // Rail Depot: short siding with a freight wagon beside a covered platform store.
    for (const x of [-1.25, -0.85]) k.box(0.04, 0.04, 3.4, '#5c6166', x, y + 0.02, -0.1);
    for (let i = 0; i < 9; i++) k.box(0.6, 0.03, 0.08, '#7a5a3b', -1.05, y, -1.7 + i * 0.4);
    k.box(0.5, 0.5, 1.6, '#a8473a', -1.05, y + 0.15, -0.6);
    k.box(0.52, 0.05, 1.62, '#7d3b27', -1.05, y + 0.65, -0.6);
    // Platform canopy over the siding
    k.box(1.4, 0.07, 3.0, C.roofGreen, -1.05, y + 2.0, -0.3);
    for (const z2 of [-1.6, -0.3, 1.0]) k.box(0.06, 2.0, 0.06, C.white, -0.4, y, z2);
    for (const z of [-1.2, 0.0]) k.cyl(0.08, 0.06, '#2a2b2d', -1.05, y + 0.08, z, 8).rotation.z = Math.PI / 2;
    const h = store(k, 1.9, 2.4, 0.8, -0.6, y, 3, CONCRETE);
    k.box(1.9, 0.07, 0.9, C.roofGreen, 0.8, y + 1.0, 1.05);
    for (const x2 of [0.0, 1.6]) k.box(0.06, 1.0, 0.06, C.white, x2, y, 1.45);
    k.box(2.4, 0.08, 2.6, C.roofGreen, 0.55, y + h + 0.1, -0.6);
    dock(k, -0.45, -0.6, 0.35, y, 2.2, 0.3);
    forklift(k, 0.6, 1.2, y, Math.PI);
    pallet(k, 1.4, 1.2, y, 'sacks', 0);
    return;
  }
  // 20: Dome Depot: geodesic storage dome with a gold ring and a glazed dock entrance.
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), new THREE.MeshStandardMaterial({ color: '#e9ecee', flatShading: true }));
  k.cyl(1.5, 1.4, CONCRETE, 0, y, -0.45, 14);
  dome.position.set(0, y + 1.4, -0.45);
  dome.scale.set(1.05, 1.15, 1.05);
  k.cyl(0.08, 0.5, '#d9b24a', 0, y + 3.05, -0.45, 6, 0.01);
  dome.castShadow = true;
  k.add(dome);
  k.cyl(1.55, 0.1, '#d9b24a', 0, y + 1.4, -0.45, 14);
  k.glassBox(1.2, 0.9, 0.6, 0, y, 0.95);
  k.box(1.4, 0.08, 0.8, '#d9b24a', 0, y + 0.9, 0.95);
  forklift(k, -1.2, 1.25, y, 0);
  pallet(k, 1.2, 1.25, y, 'crates', 0);
}

export function buildQmStore(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const QM_STORE: BuildingDef = {
  id: 'qmstore',
  name: 'QM Store',
  role: 'Stores Supplies. Delivery trucks unload here; higher levels hold more and unload faster.',
  footprint: [4, 4],
  unlockHq: 1,
  levels: QM_LEVELS,
  designedLevels: 20,
  build: buildQmStore,
};
