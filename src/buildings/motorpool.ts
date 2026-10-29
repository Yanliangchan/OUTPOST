import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, roofCanopy } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Motor Pool ("MT Line"): the camp's vehicles. More vehicles and faster dispatch
 * mean faster deliveries and transport. Signature at every level: parked olive
 * camp vehicles in marked bays under shelters, a fuel point, a wash bay and a
 * dispatch point. (Repairs belong to the Workshop; this is parking and dispatch.)
 * Footprint 5×4; height cap ~3 storeys.
 */

const TITLES = [
  'Vehicle Laager', 'Canvas Carport', 'Timber Vehicle Shed', 'MT Line', 'MT Line · Fuel Point', 'MT Line · Wash Bay',
  'Arched Vehicle Shelter', 'Dispatch Office', 'Fuel Depot', 'Motor Pool Complex', 'Two-Deck Car Park', 'Cantilever Dispatch Hub',
  'Turntable Depot', 'EV Charging Depot', 'Motor Rotunda', 'Blast-Door Hangar', 'Vehicle Stacker', 'Convoy Marshalling Yard',
  'Autonomous Pod Depot', 'Motor Citadel',
];
const SUPPLIES = [350, 1_000, 2_200, 5_000, 10_000, 19_000, 34_000, 58_000, 95_000, 150_000, 235_000, 350_000, 495_000, 670_000, 880_000, 1_140_000, 1_450_000, 1_790_000, 2_170_000, 2_600_000];
const REPUTATION = [0, 0, 30, 110, 260, 470, 820, 1_250, 1_850, 2_550, 3_450, 4_550, 5_850, 7_350, 9_050, 10_850, 13_050, 15_550, 18_350, 21_350];
const TIME = [3 * MIN, 10 * MIN, 30 * MIN, 1.25 * HOUR, 2.5 * HOUR, 4.5 * HOUR, 7 * HOUR, 11 * HOUR, 17 * HOUR, 1.1 * DAY, 1.6 * DAY, 2.1 * DAY, 2.6 * DAY, 3.1 * DAY, 3.6 * DAY, 4.1 * DAY, 4.6 * DAY, 5.1 * DAY, 5.6 * DAY, 6.1 * DAY];

export const MOTOR_POOL_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const vehicles = 1 + Math.floor(i * 0.75);
  const speed = 5 + level * 4;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((340 * Math.pow(1.2, i)) / 10) * 10,
    stats: { vehicles, deliverySpeed: speed },
    unlocks: [`${vehicles} camp vehicle${vehicles > 1 ? 's' : ''}`, `Deliveries +${speed}% faster`],
  };
});

// ------------------------------------------------------------------ palette & materials

const OLIVE = '#5d6b35';
const OLIVE_D = '#4a5a2c';
const CANVAS = '#7d7a4a';
const TYRE = '#2a2b2d';
const ASPHALT = '#5c6166';
const PAINT = '#f4f4f0';
const HAZ = '#ffc93c';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, ...o });

// ------------------------------------------------------------------ vehicles

type VehicleKind = 'jeep' | 'truck' | 'rover' | 'bowser' | 'tow' | 'pod' | 'bus';
interface Vehicle { group: THREE.Group; wheels: THREE.Mesh[]; r: number }

function wheel(g: THREE.Group, x: number, z: number, r: number, w = 0.08) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 10).rotateX(Math.PI / 2), M(TYRE));
  m.position.set(x, r, z);
  g.add(m);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, r * 0.25, w + 0.01), M('#7a8085'));
  hub.position.copy(m.position);
  g.add(hub);
  return [m, hub];
}

/**
 * Camp vehicle model; local +x is forward. Non-combat utility vehicles only.
 * rot is the Y rotation (−π/2 faces +z, toward the front of the pad).
 */
function vehicle(k: Kit, kind: VehicleKind, x: number, z: number, y: number, rot = -Math.PI / 2, color = OLIVE): Vehicle {
  const v = new Kit();
  const wheels: THREE.Mesh[] = [];
  let r = 0.11;
  const add = (ws: THREE.Mesh[]) => wheels.push(...ws);
  if (kind === 'jeep') {
    v.box(0.95, 0.22, 0.48, color, 0, 0.14, 0);
    v.box(0.36, 0.14, 0.46, color, 0.27, 0.36, 0);
    v.box(0.04, 0.2, 0.44, DARK_GLASS, 0.08, 0.36, 0);
    v.box(0.5, 0.04, 0.5, OLIVE_D, -0.22, 0.58, 0);
    for (const sz of [-0.23, 0.23]) v.box(0.03, 0.22, 0.03, OLIVE_D, -0.45, 0.36, sz);
    v.box(0.06, 0.06, 0.5, '#33383d', 0.49, 0.18, 0);
    v.box(0.1, 0.22, 0.2, '#33383d', -0.52, 0.2, 0); // spare wheel
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.24, 0.24]) add(wheel(v.group, sx, sz, r));
  } else if (kind === 'truck') {
    r = 0.13;
    v.box(0.45, 0.42, 0.56, color, 0.62, 0.18, 0); // cab
    v.box(0.03, 0.2, 0.5, DARK_GLASS, 0.85, 0.4, 0);
    v.box(0.47, 0.04, 0.58, OLIVE_D, 0.62, 0.6, 0);
    v.box(1.1, 0.1, 0.6, '#3f4a2a', -0.22, 0.2, 0); // chassis bed
    v.box(1.08, 0.2, 0.58, color, -0.22, 0.3, 0);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 1.06, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), M(CANVAS));
    canopy.position.set(-0.22, 0.5, 0);
    canopy.scale.set(1, 0.9, 1);
    canopy.castShadow = true;
    v.group.add(canopy);
    for (let i = 0; i < 4; i++) v.box(0.02, 0.02, 0.6, '#5f5c38', -0.68 + i * 0.3, 0.76, 0);
    v.box(0.06, 0.08, 0.58, '#33383d', 0.86, 0.18, 0);
    for (const sx of [0.62, -0.25, -0.58]) for (const sz of [-0.28, 0.28]) add(wheel(v.group, sx, sz, r, 0.1));
  } else if (kind === 'rover') {
    r = 0.13;
    v.box(1.25, 0.42, 0.6, color, 0, 0.18, 0);
    const nose = v.box(0.28, 0.3, 0.58, color, 0.68, 0.18, 0);
    nose.rotation.z = -0.35;
    v.box(0.03, 0.18, 0.5, DARK_GLASS, 0.5, 0.44, 0);
    for (const sz of [-0.31, 0.31]) for (const sx of [-0.35, 0.05]) v.box(0.2, 0.12, 0.01, DARK_GLASS, sx, 0.4, sz);
    v.box(0.8, 0.04, 0.5, '#33383d', -0.15, 0.62, 0); // roof rack
    for (const sx of [-0.45, 0.15]) v.box(0.2, 0.08, 0.3, '#7a6a4a', sx, 0.66, 0);
    for (const sx of [0.42, 0, -0.42]) for (const sz of [-0.3, 0.3]) add(wheel(v.group, sx, sz, r, 0.1));
  } else if (kind === 'bowser') {
    r = 0.12;
    v.box(0.4, 0.4, 0.52, color, 0.6, 0.16, 0);
    v.box(0.03, 0.18, 0.46, DARK_GLASS, 0.81, 0.36, 0);
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.65, 4, 10).rotateZ(Math.PI / 2), M('#c9ced2'));
    tank.position.set(-0.2, 0.48, 0);
    tank.castShadow = true;
    v.group.add(tank);
    v.box(0.9, 0.06, 0.04, '#e94f37', -0.2, 0.48, 0.25);
    v.box(0.2, 0.15, 0.2, '#33383d', -0.75, 0.22, 0); // hose reel
    for (const sx of [0.6, -0.1, -0.45]) for (const sz of [-0.25, 0.25]) add(wheel(v.group, sx, sz, r));
  } else if (kind === 'tow') {
    r = 0.12;
    v.box(0.45, 0.4, 0.52, color, 0.45, 0.16, 0);
    v.box(0.03, 0.18, 0.46, DARK_GLASS, 0.68, 0.36, 0);
    v.box(0.75, 0.16, 0.5, OLIVE_D, -0.15, 0.18, 0);
    const boom = v.box(0.65, 0.07, 0.07, HAZ, -0.3, 0.42, 0);
    boom.rotation.z = 0.5;
    v.box(0.02, 0.25, 0.02, '#33383d', -0.6, 0.38, 0);
    for (const sx of [0.45, -0.3]) for (const sz of [-0.25, 0.25]) add(wheel(v.group, sx, sz, r));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 0.2 }));
    b.position.set(0.45, 0.6, 0);
    v.group.add(b);
    k.anims.push((t) => ((b.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 7 + x) > 0.3 ? 1.5 : 0.1));
  } else if (kind === 'pod') {
    r = 0.1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10).rotateZ(Math.PI / 2), M(color));
    body.scale.set(1, 0.9, 1);
    body.position.set(0, 0.32, 0);
    body.castShadow = true;
    v.group.add(body);
    v.box(0.55, 0.16, 0.5, DARK_GLASS, 0.05, 0.36, 0);
    v.box(0.04, 0.04, 0.4, '#7cff8a', 0.48, 0.28, 0);
    for (const sx of [-0.25, 0.25]) for (const sz of [-0.22, 0.22]) add(wheel(v.group, sx, sz, r, 0.06));
  } else {
    // bus: camp shuttle bus
    r = 0.13;
    v.box(1.6, 0.55, 0.62, color, 0, 0.16, 0);
    v.box(1.5, 0.18, 0.64, DARK_GLASS, 0, 0.45, 0);
    v.box(1.62, 0.05, 0.64, '#f4f4f0', 0, 0.71, 0);
    v.box(0.03, 0.3, 0.55, DARK_GLASS, 0.81, 0.35, 0);
    for (const sx of [0.5, -0.5]) for (const sz of [-0.31, 0.31]) add(wheel(v.group, sx, sz, r, 0.1));
  }
  v.group.position.set(x, y, z);
  v.group.rotation.y = rot;
  k.add(v.group);
  return { group: v.group, wheels, r };
}

/**
 * Dispatch loop: the vehicle pulls forward out of its bay, waits, then reverses
 * back in, wheels turning as it moves.
 */
function dispatchLoop(k: Kit, v: Vehicle, dist: number, period = 10, seed = 0) {
  const base = v.group.position.clone();
  const rot = v.group.rotation.y;
  const dir = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  k.anims.push((t) => {
    const c = (((t + seed) % period) + period) % period / period;
    const out = c < 0.15 ? 0 : c < 0.4 ? (c - 0.15) / 0.25 : c < 0.6 ? 1 : c < 0.85 ? 1 - (c - 0.6) / 0.25 : 0;
    const e = out * out * (3 - 2 * out);
    v.group.position.copy(base).addScaledVector(dir, e * dist);
    for (const w of v.wheels) w.rotation.z = -(e * dist) / v.r;
  });
}

// ------------------------------------------------------------------ structures

/** Asphalt hardstanding with painted bay lines; bays run along x, vehicles face +z. */
function bays(k: Kit, n: number, bayW: number, x: number, z: number, len: number, y: number) {
  const w = n * bayW;
  k.box(w + 0.1, 0.012, len, ASPHALT, x, y, z);
  for (let i = 0; i <= n; i++) k.box(0.035, 0.006, len - 0.1, PAINT, x - w / 2 + i * bayW, y + 0.012, z);
  k.box(w, 0.006, 0.035, PAINT, x, y + 0.012, z - len / 2 + 0.05);
  // Bay numbers as small yellow blocks
  for (let i = 0; i < n; i++) k.box(0.1, 0.006, 0.06, HAZ, x - w / 2 + (i + 0.5) * bayW, y + 0.012, z - len / 2 + 0.16);
  // Wheel stops
  for (let i = 0; i < n; i++) k.box(bayW * 0.5, 0.05, 0.06, '#e8e6e0', x - w / 2 + (i + 0.5) * bayW, y, z - len / 2 + 0.28);
}

/** Open carport: posts and a roof slab (green, zinc or canvas). */
function carport(k: Kit, w: number, d: number, x: number, z: number, y: number, h = 1.0, roof: string = C.roofGreen, cols = 3, hip = 0) {
  for (let i = 0; i < cols; i++) {
    const px = x - w / 2 + 0.06 + (i * (w - 0.12)) / (cols - 1);
    for (const pz of [z - d / 2 + 0.06, z + d / 2 - 0.06]) k.box(0.08, h, 0.08, C.white, px, y, pz);
  }
  if (hip > 0) {
    k.box(w + 0.1, 0.08, d + 0.1, C.trim, x, y + h, z);
    k.hipRoof(w, d, hip, x, y + h + 0.08, z, roof, 0.15);
    return;
  }
  const slab = k.box(w + 0.2, 0.07, d + 0.25, roof, x, y + h, z);
  slab.rotation.x = -0.06;
  k.box(w + 0.22, 0.05, 0.05, C.trim, x, y + h - 0.02, z + d / 2 + 0.12);
}

/** Fuel pump with a swaying hose and a counter light. */
function fuelPump(k: Kit, x: number, z: number, y: number, color = '#e94f37') {
  k.box(0.5, 0.08, 0.3, CONCRETE, x, y, z); // island
  k.box(0.22, 0.5, 0.16, color, x, y + 0.08, z);
  k.box(0.16, 0.12, 0.01, '#1f2a2e', x, y + 0.4, z + 0.085);
  k.box(0.24, 0.05, 0.18, '#f4f4f0', x, y + 0.58, z);
  k.blinker(x + 0.07, y + 0.47, z + 0.09, '#7cff8a', 0.012, 1.3);
  const hose = k.box(0.02, 0.3, 0.02, '#1f1f1f', x + 0.13, y + 0.2, z + 0.02);
  k.swing(hose, 0, 0.35, x * 5 + z);
  const nozzle = k.box(0.04, 0.06, 0.08, '#33383d', x + 0.13, y + 0.42, z + 0.06);
  void nozzle;
}

/** Wash bay: frame with two spinning brushes and water spray. */
function washBay(k: Kit, x: number, z: number, y: number, w = 1.0, d = 1.3) {
  k.box(w, 0.012, d, '#4d6d7a', x, y, z); // wet slab
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 1.3, 0.07, '#8a9196', x + sx * w / 2, y, z + sz * d / 2);
  for (const sz of [-1, 1]) k.box(w + 0.07, 0.07, 0.07, '#2bb3a3', x, y + 1.3, z + sz * d / 2);
  k.box(0.07, 0.07, d, '#2bb3a3', x - w / 2, y + 1.3, z);
  k.box(0.07, 0.07, d, '#2bb3a3', x + w / 2, y + 1.3, z);
  k.box(w + 0.15, 0.06, d + 0.15, '#bfe6f2', x, y + 1.37, z);
  const brushes: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), M(sx < 0 ? '#2f6fa8' : '#e94f37'));
    b.position.set(x + sx * (w / 2 - 0.16), y + 0.45, z);
    b.castShadow = true;
    k.add(b);
    brushes.push(b);
  }
  k.anims.push((t) => brushes.forEach((b, i) => (b.rotation.y = t * (i ? -6 : 6))));
  k.emitters.push({ pos: new THREE.Vector3(x - w / 4, y + 1.2, z), kind: 'spray' }, { pos: new THREE.Vector3(x + w / 4, y + 1.2, z + 0.3), kind: 'spray' });
  // Sign
  k.box(0.5, 0.18, 0.03, '#2bb3a3', x, y + 1.1, z + d / 2 + 0.03);
  k.box(0.38, 0.06, 0.035, '#ffffff', x, y + 1.16, z + d / 2 + 0.035);
}

/** Dispatch hut with a lit window and a boom barrier that lifts on a cycle. */
function dispatchHut(k: Kit, x: number, z: number, y: number, boomDir = 1, h = 0.75) {
  k.box(0.55, h, 0.5, C.wall, x, y, z);
  k.box(0.57, 0.12, 0.52, C.trim, x, y, z);
  k.box(0.45, 0.22, 0.01, '#fff1b0', x, y + h - 0.35, z + 0.255);
  k.box(0.68, 0.07, 0.62, C.roofGreen, x, y + h, z);
  k.blinker(x - 0.2, y + h + 0.07, z, '#ffb020', 0.03, 1.6);
  const px = x + boomDir * 0.4;
  k.box(0.12, 0.32, 0.12, HAZ, px, y, z + 0.2);
  const boom = new THREE.Group();
  boom.position.set(px, y + 0.3, z + 0.2);
  for (let i = 0; i < 4; i++) k.box(0.26, 0.035, 0.035, i % 2 ? '#ffffff' : '#d8342c', boomDir * (0.13 + i * 0.26), 0, 0, boom);
  k.add(boom);
  k.anims.push((t) => {
    const c = ((t + x * 3) % 9) / 9;
    const up = c < 0.1 ? c / 0.1 : c < 0.35 ? 1 : c < 0.45 ? 1 - (c - 0.35) / 0.1 : 0;
    boom.rotation.z = boomDir * up * up * (3 - 2 * up) * 1.35;
  });
}

function jerrycans(k: Kit, x: number, z: number, y: number, n = 4) {
  for (let i = 0; i < n; i++) k.box(0.12, 0.2, 0.08, i % 2 ? OLIVE : '#e94f37', x + (i % 2) * 0.14, y, z + Math.floor(i / 2) * 0.1);
}

function tyreStack(k: Kit, x: number, z: number, y: number, n = 3) {
  for (let i = 0; i < n; i++) k.cyl(0.13, 0.08, TYRE, x, y + i * 0.08, z, 10);
}

function camoNet(k: Kit, w: number, d: number, x: number, z: number, y: number, h = 0.85) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, h, 0.05, C.wood, x + (sx * w) / 2, y, z + (sz * d) / 2);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, d + 0.3, 6, 6).rotateX(-Math.PI / 2), M(OLIVE, { side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
  const pos = net.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 3) * 0.05 + Math.cos(pos.getZ(i) * 4) * 0.05 - 0.05);
  net.geometry.computeVertexNormals();
  net.position.set(x, y + h, z);
  net.castShadow = true;
  k.add(net);
  // Net breathes in the wind
  k.anims.push((t) => (net.position.y = y + h + Math.sin(t * 1.3) * 0.02));
}

/** Small two-storey dispatch/MT office with a balcony. */
function mtOffice(k: Kit, x: number, z: number, y: number, w = 1.2, d = 1.0, storeys = 2) {
  const h = k.block(w, d, storeys, x, y, z);
  k.hipRoof(w, d, 0.35, x, y + h, z);
  k.door('front', x, z, w, d, -w * 0.25, y, 0.3, 0.6);
  k.window('front', x, z, w, d, w * 0.2, y + 0.42, 0.34, 0.3);
  for (let f = 1; f < storeys; f++) k.windowRow('front', x, z, w, d, 2, y + f * STOREY + 0.42, { louvre: true });
  k.aircon(x + w / 2 + 0.08, y + 0.3, z - 0.2, Math.PI / 2);
  return h;
}

/** Big painted "MT" sign board. */
function mtSign(k: Kit, text: string, x: number, z: number, y: number, w = 1.0) {
  k.plaque(text, x, z, y, w);
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Vehicle laager: two jeeps under a camo net, jerrycans, tyre tracks
    camoNet(k, 2.6, 1.6, -0.6, -0.6, y);
    vehicle(k, 'jeep', -1.2, -0.6, y);
    const j = vehicle(k, 'jeep', -0.1, -0.6, y);
    dispatchLoop(k, j, 1.3, 11, 0);
    for (const dx of [-0.24, 0.24]) k.box(0.1, 0.006, 1.6, '#8a6e4b', -0.1 + dx, y, 0.9);
    jerrycans(k, 1.2, -1.1, y);
    k.sandbags(1.4, 0.4, 1.2, Math.PI / 2, y);
    k.crates(1.6, -1.4, y, 2);
    k.windsock(2.0, y + 0.05, 1.3);
    k.box(0.04, 0.05, 0.04, C.metal, 2.0, y, 1.3);
    return;
  }
  if (level === 2) {
    // Canvas carport over three bays, drums with a rocking hand pump
    carport(k, 3.4, 1.5, -0.4, -0.7, y, 1.0, CANVAS, 4);
    vehicle(k, 'jeep', -1.5, -0.65, y);
    const j = vehicle(k, 'jeep', -0.4, -0.65, y);
    vehicle(k, 'jeep', 0.7, -0.65, y, -Math.PI / 2, OLIVE_D);
    dispatchLoop(k, j, 1.6, 12, 2);
    for (let i = 0; i < 3; i++) k.drum(1.75 + (i % 2) * 0.25, -0.2 + Math.floor(i / 2) * 0.25, OLIVE, y);
    k.box(0.06, 0.4, 0.06, '#33383d', 1.85, y + 0.32, 0.05);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.03).translate(0.14, 0, 0), M('#33383d'));
    handle.position.set(1.85, y + 0.7, 0.05);
    k.add(handle);
    k.anims.push((t) => (handle.rotation.z = Math.sin(t * 2.6) * 0.35));
    jerrycans(k, 1.6, 1.0, y);
    tyreStack(k, -1.9, 1.2, y, 3);
    return;
  }
  // 3: timber vehicle shed, zinc gable roof, three open bays; 3-tonner and jeep
  const w = 3.8, d = 1.8, z = -0.65;
  for (let i = 0; i < 4; i++) {
    const px = -w / 2 + 0.06 + i * ((w - 0.12) / 3);
    for (const pz of [z - d / 2 + 0.06, z + d / 2 - 0.06]) k.box(0.1, 0.95, 0.1, '#7a5a3b', px, y, pz);
  }
  k.box(w, 0.95, 0.06, C.wood, 0, y, z - d / 2 + 0.03);
  k.gableRoof(w, d, 0.25, 0, y + 0.95, z, C.zinc, 0.2, C.wood);
  k.box(w, 0.012, d, '#8a7a5a', 0, y, z);
  vehicle(k, 'truck', -0.65, z, y);
  const j = vehicle(k, 'jeep', 0.75, z, y);
  dispatchLoop(k, j, 1.5, 10, 1);
  tyreStack(k, -1.95, 1.0, y, 4);
  jerrycans(k, 1.7, 0.8, y);
  k.drum(-1.4, 1.2, '#2f6fa8', y);
  mtSign(k, 'MT', 1.95, 1.4, y, 0.6);
}

function camp(k: Kit, level: number, y: number) {
  // Shared: painted bays under a long green carport along the back
  const z = -0.75;
  if (level === 4) {
    bays(k, 4, 0.95, -0.35, z, 1.75, y);
    carport(k, 3.8, 1.6, -0.35, z, y, 1.15, C.roof, 5, 0.35);
    vehicle(k, 'jeep', -1.78, z, y);
    vehicle(k, 'truck', -0.83, z + 0.05, y);
    const j = vehicle(k, 'jeep', 0.12, z, y);
    vehicle(k, 'jeep', 1.07, z, y, -Math.PI / 2, OLIVE_D);
    dispatchLoop(k, j, 1.9, 12, 0);
    dispatchHut(k, 1.75, 1.0, y, -1);
    mtSign(k, 'MT LINE', -1.4, 1.4, y, 0.9);
    tyreStack(k, -2.05, 0.8, y, 3);
    return;
  }
  if (level === 5) {
    bays(k, 3, 0.95, -0.85, z, 1.75, y);
    carport(k, 2.9, 1.6, -0.85, z, y, 1.2, C.roof, 4, 0.38);
    vehicle(k, 'truck', -1.8, z + 0.05, y);
    const j = vehicle(k, 'jeep', -0.85, z, y);
    vehicle(k, 'rover', 0.1, z, y);
    dispatchLoop(k, j, 1.9, 11, 3);
    // Fuel point with its own canopy
    k.box(1.3, 0.012, 1.3, '#4a4f54', 1.55, y, -0.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.07, 1.25, 0.07, C.white, 1.55 + sx * 0.5, y, -0.2 + sz * 0.5);
    k.box(1.3, 0.1, 1.3, '#e94f37', 1.55, y + 1.25, -0.2);
    k.box(1.32, 0.05, 1.32, C.white, 1.55, y + 1.23, -0.2);
    fuelPump(k, 1.55, -0.2, y);
    vehicle(k, 'bowser', 1.6, 1.15, y, 0);
    dispatchHut(k, -1.6, 1.15, y, 1);
    return;
  }
  // 6: wash bay + carport + fuel point
  bays(k, 3, 0.95, -1.0, z, 1.75, y);
  carport(k, 2.9, 1.6, -1.0, z, y, 1.25, C.roof, 4, 0.4);
  vehicle(k, 'truck', -1.95, z + 0.05, y);
  vehicle(k, 'jeep', -1.0, z, y);
  const j = vehicle(k, 'rover', -0.05, z, y);
  dispatchLoop(k, j, 1.8, 12, 5);
  washBay(k, 1.55, -0.55, y);
  vehicle(k, 'jeep', 1.55, -0.55, y);
  fuelPump(k, 0.9, 1.2, y);
  dispatchHut(k, -1.6, 1.15, y, 1);
  tyreStack(k, 2.15, 1.3, y, 3);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Arched steel shelter over four bays, dispatch tower at the side
    const z = -0.7, w = 3.6, d = 1.8;
    bays(k, 4, 0.9, -0.4, z, d, y);
    for (let i = 0; i < 5; i++) {
      const px = -0.4 - w / 2 + i * (w / 4);
      for (const pz of [z - d / 2 + 0.06, z + d / 2 - 0.06]) k.box(0.08, 1.1, 0.08, '#8a9196', px, y, pz);
    }
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, w + 0.3, 16, 1, true, -Math.PI / 2, Math.PI), M(C.roofGreen, { side: THREE.DoubleSide }));
    arch.rotation.z = Math.PI / 2;
    arch.scale.set(0.55, 1, 1);
    arch.rotation.order = 'ZYX';
    const archG = new THREE.Group();
    archG.add(arch);
    archG.position.set(-0.4, y + 1.1, z);
    archG.scale.set(1, 0.6, 0.85);
    arch.castShadow = true;
    k.add(archG);
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.025, 4, 16, Math.PI), M('#8a9196'));
      rib.rotation.y = Math.PI / 2;
      rib.position.set(-0.4 - w / 2 + i * (w / 4), 0, 0);
      const rg = new THREE.Group();
      rg.add(rib);
      rg.position.set(0, y + 1.1, z);
      rg.scale.set(1, 0.6, 0.85);
      k.add(rg);
    }
    vehicle(k, 'truck', -1.75, z + 0.05, y);
    vehicle(k, 'rover', -0.85, z, y);
    const j = vehicle(k, 'jeep', 0.05, z, y);
    vehicle(k, 'tow', 0.95, z, y);
    dispatchLoop(k, j, 1.9, 11, 2);
    // Dispatch tower: raised box on legs with a stair
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.07, 1.1, 0.07, C.white, 1.95 + sx * 0.3, y, 0.95 + sz * 0.3);
    k.box(0.75, 0.6, 0.75, C.wall, 1.95, y + 1.1, 0.95);
    k.box(0.6, 0.25, 0.01, DARK_GLASS, 1.95, y + 1.38, 1.33);
    k.box(0.9, 0.07, 0.9, C.roofGreen, 1.95, y + 1.7, 0.95);
    k.blinker(1.95, y + 1.77, 0.95, '#ffb020', 0.04, 1.4);
    k.stairs(1.35, 0.95, 0.3, 0.8, 1.1, true);
    fuelPump(k, 0.4, 1.3, y);
    return;
  }
  if (level === 8) {
    // Two-storey dispatch office with balcony; long carport; tow truck on standby
    const oh = mtOffice(k, -1.65, -0.5, y, 1.3, 1.6, 2);
    k.box(1.3, 0.07, 0.45, '#cfc9bc', -1.65, y + STOREY - 0.05, 0.5);
    k.box(1.3, 0.25, 0.04, C.white, -1.65, y + STOREY, 0.72);
    k.antenna(-1.95, y + oh + 0.3, -0.8, 0.8);
    bays(k, 3, 0.95, 0.75, -0.75, 1.75, y);
    carport(k, 2.9, 1.6, 0.75, -0.75, y, 1.25, C.roofGreen, 4);
    vehicle(k, 'truck', -0.2, -0.7, y);
    const j = vehicle(k, 'rover', 0.75, -0.75, y);
    vehicle(k, 'jeep', 1.7, -0.75, y);
    dispatchLoop(k, j, 1.9, 12, 4);
    vehicle(k, 'tow', 0.5, 1.2, y, 0);
    mtSign(k, 'DISPATCH', -1.6, 1.45, y, 0.95);
    tyreStack(k, 2.1, 1.3, y, 4);
    return;
  }
  if (level === 9) {
    // Fuel depot: bunded horizontal fuel tank, double fuel island, bowsers, carport
    k.box(1.9, 0.4, 1.2, CONCRETE, -1.35, y, -1.1); // bund
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.0, 4, 12).rotateZ(Math.PI / 2), M('#e8e6e0'));
    tank.position.set(-1.35, y + 1.05, -1.2);
    tank.castShadow = true;
    k.add(tank);
    k.box(1.4, 0.08, 0.05, '#e94f37', -1.35, y + 1.05, -0.74);
    for (const x of [-1.85, -0.85]) k.box(0.2, 0.65, 0.6, '#8a9196', x, y + 0.4, -1.2);
    k.box(1.7, 0.012, 1.6, '#4a4f54', 0.85, y, -0.4);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.1, 2.15, 0.1, C.white, 0.85 + sx * 0.8, y, -0.4 + sz * 0.75);
    k.box(2.1, 0.22, 1.9, '#e94f37', 0.85, y + 2.15, -0.4);
    k.box(2.12, 0.05, 1.92, C.white, 0.85, y + 2.13, -0.4);
    k.box(1.4, 0.12, 0.02, '#ffffff', 0.85, y + 2.2, 0.56);
    fuelPump(k, 0.45, -0.4, y);
    fuelPump(k, 1.25, -0.4, y, '#ffc93c');
    const b = vehicle(k, 'bowser', -1.2, 0.35, y, 0);
    dispatchLoop(k, b, 1.4, 14, 1);
    vehicle(k, 'jeep', 0.85, 0.5, y, Math.PI);
    vehicle(k, 'truck', 0.7, -1.4, y, 0);
    dispatchHut(k, 1.85, 1.3, y, -1);
    k.box(0.4, 0.4, 0.04, HAZ, -2.1, y + 0.1, -0.68);
    return;
  }
  // 10: Motor Pool complex: two-storey MT office, carport row, wash bay, fuel island, checkpoint
  mtOffice(k, -1.75, -1.15, y, 1.1, 1.2, 2);
  bays(k, 3, 0.9, -0.05, -0.85, 1.6, y);
  carport(k, 2.75, 1.5, -0.05, -0.85, y, 1.3, C.roofGreen, 4);
  vehicle(k, 'truck', -0.95, -0.8, y);
  const j = vehicle(k, 'rover', -0.05, -0.85, y);
  vehicle(k, 'jeep', 0.85, -0.85, y);
  dispatchLoop(k, j, 1.8, 12, 3);
  washBay(k, 1.85, -0.75, y, 0.8, 1.2);
  k.box(1.2, 0.012, 0.9, '#4a4f54', -1.5, y, 0.85);
  for (const sx of [-1, 1]) k.box(0.07, 1.2, 0.07, C.white, -1.5 + sx * 0.5, y, 0.85);
  k.box(1.3, 0.1, 0.9, '#e94f37', -1.5, y + 1.2, 0.85);
  fuelPump(k, -1.5, 0.85, y);
  dispatchHut(k, 1.0, 1.3, y, 1);
  mtSign(k, 'MOTOR POOL', 0.0, 1.45, y, 1.0);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Two-deck car park: concrete deck with vehicles on top, ramp, ground bays
    const w = 3.6, d = 2.2, z = -0.55, x = -0.4;
    for (let i = 0; i < 4; i++) for (const pz of [z - d / 2 + 0.1, z + d / 2 - 0.1]) k.box(0.14, 1.15, 0.14, CONCRETE, x - w / 2 + 0.1 + i * ((w - 0.2) / 3), y, pz);
    k.box(w, 0.14, d, CONCRETE, x, y + 1.15, z);
    k.box(w, 0.012, d, ASPHALT, x, y + 1.29, z);
    for (const pz of [z - d / 2, z + d / 2]) k.box(w, 0.4, 0.05, C.white, x, y + 1.29, pz);
    k.box(0.05, 0.4, d, C.white, x - w / 2, y + 1.29, z);
    for (let i = 0; i <= 3; i++) k.box(0.03, 0.006, d - 0.2, PAINT, x - w / 2 + 0.3 + i * 1.0, y + 1.303, z);
    vehicle(k, 'rover', x - 1.2, z, y + 1.29);
    vehicle(k, 'jeep', x - 0.2, z, y + 1.29);
    vehicle(k, 'truck', x + 0.9, z + 0.05, y + 1.29);
    for (const lx of [x - 1.6, x + 1.6]) {
      k.box(0.05, 0.7, 0.05, '#8a9196', lx, y + 1.29, z - 0.9);
      k.box(0.25, 0.08, 0.1, '#fff6c8', lx, y + 1.99, z - 0.9);
    }
    bays(k, 3, 1.0, x, z, d - 0.2, y);
    vehicle(k, 'jeep', x - 1.0, z, y);
    const g = vehicle(k, 'rover', x, z, y);
    vehicle(k, 'truck', x + 1.0, z, y);
    dispatchLoop(k, g, 2.0, 12, 0);
    // Ramp up the right side
    const ramp = k.box(0.75, 0.08, 2.4, ASPHALT, 1.95, y + 0.62, -0.15);
    ramp.rotation.x = 0.5;
    for (const sx of [-1, 1]) {
      const rail = k.box(0.04, 0.2, 2.4, HAZ, 1.95 + sx * 0.38, y + 0.67, -0.15);
      rail.rotation.x = 0.5;
    }
    dispatchHut(k, 1.1, 1.4, y, -1);
    k.blinker(x - 1.7, y + 1.7, z + 1.05, '#ffb020', 0.04, 1.4);
    return;
  }
  if (level === 12) {
    // Cantilever dispatch hub: glass dispatch office and a deep white cantilevered canopy
    k.glassBox(1.2, 2 * STOREY - 0.1, 1.6, -1.75, y, -0.75);
    k.box(1.3, 0.1, 1.7, C.white, -1.75, y + 2 * STOREY - 0.1, -0.75);
    k.antenna(-2.0, y + 2 * STOREY, -1.2, 0.9);
    k.box(0.25, 2.3, 0.4, CONCRETE, -1.05, y, -1.3); // canopy spine
    k.box(3.6, 0.16, 2.4, C.white, 0.65, y + 2.3, -0.5);
    k.box(3.62, 0.05, 2.42, C.trim, 0.65, y + 2.26, -0.5);
    for (const x of [0.0, 1.2, 2.3]) k.box(0.05, 0.5, 0.05, '#8a9196', x, y + 2.3, 0.65);
    bays(k, 3, 1.05, 0.75, -0.6, 2.0, y);
    vehicle(k, 'bus', 0.75, -0.55, y, -Math.PI / 2, '#f2f0ea');
    vehicle(k, 'rover', -0.3, -0.6, y);
    const j = vehicle(k, 'jeep', 1.8, -0.6, y);
    dispatchLoop(k, j, 1.9, 11, 2);
    for (let i = 0; i < 4; i++) k.blinker(-0.1 + i * 0.95, y + 2.24, -1.5, '#fff6c8', 0.035, 2.0 + i * 0.3);
    dispatchHut(k, -1.6, 1.3, y, 1);
    fuelPump(k, 2.0, 1.35, y);
    return;
  }
  if (level === 13) {
    // Turntable depot: rotating vehicle turntable in front of a three-bay garage block
    const h = k.block(4.0, 1.3, 3, -0.3, y, -1.1, C.wallAlt);
    k.windowRow('front', -0.3, -1.1, 4.0, 1.3, 5, y + 2 * STOREY + 0.42, { louvre: true });
    k.flatRoof(4.0, 1.3, -0.3, y + h, -1.1);
    for (const x of [-1.6, -0.3, 1.0]) k.shutter('front', -0.3, -1.1, 4.0, 1.3, x + 0.3, 0.95, 0.8);
    k.windowRow('front', -0.3, -1.1, 4.0, 1.3, 5, y + STOREY + 0.42, { louvre: true });
    k.box(4.0, 0.1, 0.5, C.roofGreen, -0.3, y + 1.0, -0.25);
    const deck = new THREE.Group();
    deck.position.set(0.3, y, 0.85);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 20), M('#7a8085'));
    plate.position.y = 0.03;
    deck.add(plate);
    for (let i = 0; i < 2; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.01, 0.06), M(HAZ));
      stripe.position.set(0, 0.065, i ? 0.24 : -0.24);
      deck.add(stripe);
    }
    k.add(deck);
    k.cyl(0.88, 0.04, '#33383d', 0.3, y, 0.85, 20);
    const v = vehicle(k, 'rover', 0, 0, 0.06, 0);
    deck.add(v.group);
    k.anims.push((t) => (deck.rotation.y = t * 0.35));
    vehicle(k, 'truck', -1.7, 0.95, y, -Math.PI / 2);
    dispatchHut(k, 1.9, 1.2, y, -1);
    k.blinker(-2.2, y + h, -0.5, '#ffb020', 0.04, 1.6);
    return;
  }
  if (level === 14) {
    // EV charging depot: green canopy over charging bollards with pulsing lights; electric shuttle
    bays(k, 4, 0.95, -0.2, -0.65, 2.0, y);
    for (const x of [-2.0, -0.2, 1.6]) for (const z of [-1.55, 0.25]) k.box(0.1, 2.2, 0.1, '#8a9196', x, y, z);
    k.box(4.1, 0.12, 2.2, '#6cbf45', -0.2, y + 2.2, -0.65);
    k.box(4.12, 0.06, 2.22, C.white, -0.2, y + 2.15, -0.65);
    k.hedge(-0.2, -0.65, 3.8, 1.8, y + 2.32);
    for (let i = 0; i < 4; i++) {
      const cx = -1.62 + i * 0.95;
      k.box(0.14, 0.55, 0.12, '#f4f4f0', cx, y, -1.55);
      k.box(0.1, 0.08, 0.01, '#1f2a2e', cx, y + 0.4, -1.49);
      k.blinker(cx, y + 0.55, -1.55, '#3fd16b', 0.025, 1.0 + i * 0.25);
    }
    vehicle(k, 'bus', -1.0, -0.5, y, -Math.PI / 2, '#2bb3a3');
    vehicle(k, 'pod', 0.25, -0.65, y, -Math.PI / 2, '#f2f0ea');
    const j = vehicle(k, 'rover', 1.2, -0.6, y, -Math.PI / 2, OLIVE);
    dispatchLoop(k, j, 1.8, 12, 4);
    mtOffice(k, 1.75, 1.15, y, 1.0, 0.8, 1);
    dispatchHut(k, -1.6, 1.3, y, 1);
    return;
  }
  // 15: Motor rotunda: round garage with radial bays, central dispatch drum, gold band
  const cx = -0.3, cz = -0.35;
  k.cyl(1.75, 0.012, ASPHALT, cx, y, cz, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.05, 2.0, 0.05, C.white, cx + Math.cos(a) * 1.65, y, cz + Math.sin(a) * 1.65);
    const line = k.box(1.0, 0.006, 0.03, PAINT, cx + Math.cos(a + 0.39) * 1.15, y + 0.012, cz + Math.sin(a + 0.39) * 1.15);
    line.rotation.y = -(a + 0.39);
  }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.14, 24, 1, true), M(C.roofGreen, { side: THREE.DoubleSide }));
  ring.position.set(cx, y + 2.07, cz);
  k.add(ring);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.9, 0.5, 24, 1, true), M(C.roof, { side: THREE.DoubleSide }));
  roof.position.set(cx, y + 2.37, cz);
  roof.castShadow = true;
  k.add(roof);
  k.cyl(1.9, 0.06, '#d9b24a', cx, y + 2.0, cz, 24);
  k.cyl(0.55, 2.6, C.wall, cx, y, cz, 14);
  k.cyl(0.57, 0.08, '#d9b24a', cx, y + 2.6, cz, 14);
  k.cyl(0.4, 0.3, DARK_GLASS, cx, y + 2.1, cz, 14);
  k.blinker(cx, y + 2.68, cz, '#ffb020', 0.05, 1.5);
  const kinds: VehicleKind[] = ['jeep', 'rover', 'truck', 'jeep', 'rover', 'jeep'];
  kinds.forEach((kd, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    vehicle(k, kd, cx + Math.cos(a) * 1.15, cz + Math.sin(a) * 1.15, y, -a + Math.PI);
  });
  // One vehicle drives a lap round the ring
  const lap = vehicle(k, 'jeep', cx, cz, y, 0, OLIVE_D);
  k.anims.push((t) => {
    const a = t * 0.35;
    lap.group.position.set(cx + Math.cos(a) * 2.05, y, cz + Math.sin(a) * 2.05);
    lap.group.rotation.y = -a - Math.PI / 2;
    for (const w of lap.wheels) w.rotation.z = -(a * 2.05) / lap.r;
  });
  mtSign(k, 'MOTOR POOL', 1.6, 1.45, y, 1.0);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 2.22, 1.72, false);
  if (level === 16) {
    // Blast-door hangar: concrete hangar with a sliding blast door that opens and closes
    const w = 3.6, d = 2.4, z = -0.45;
    k.box(w, 2.6, d, CONCRETE, 0, y, z);
    for (let i = 1; i < 4; i++) k.box(w + 0.02, 0.03, d + 0.02, '#c2bdb3', 0, y + i * 0.65, z);
    k.box(2.2, 1.5, 0.02, '#1f2326', 0, y, z + d / 2 + 0.005);
    const door = new THREE.Group();
    k.box(1.15, 1.55, 0.08, '#6b7075', 0, 0, 0, door);
    for (let i = 0; i < 5; i++) k.box(0.18, 0.1, 0.09, i % 2 ? C.kerbB : C.kerbY, -0.45 + i * 0.22, 1.42, 0.005, door);
    door.position.set(-0.55, y, z + d / 2 + 0.06);
    k.add(door);
    const door2 = door.clone();
    door2.position.x = 0.55;
    k.add(door2);
    k.anims.push((t) => {
      const c = (t % 12) / 12;
      const open = c < 0.15 ? c / 0.15 : c < 0.55 ? 1 : c < 0.7 ? 1 - (c - 0.55) / 0.15 : 0;
      const e = open * open * (3 - 2 * open);
      door.position.x = -0.55 - e * 1.05;
      door2.position.x = 0.55 + e * 1.05;
    });
    vehicle(k, 'rover', 0, z + 0.4, y);
    k.box(w + 0.1, 0.1, d + 0.1, C.white, 0, y + 2.6, z);
    roofCanopy(k, 2.6, 1.6, 0, y + 2.7, z, 0.25);
    vehicle(k, 'jeep', -1.5, 1.2, y, 0);
    k.blinker(1.6, y + 1.65, z + d / 2 + 0.06, '#ff3b30', 0.05, 1.0);
    return;
  }
  if (level === 17) {
    // Vehicle stacker: steel tower with a lift platform that raises vehicles
    const tx = -1.0, tz = -0.55;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, 3.0, 0.1, '#8a9196', tx + sx * 0.95, y, tz + sz * 0.75);
    for (let l = 1; l <= 3; l++) {
      k.box(1.95, 0.08, 1.55, '#7a8085', tx - 0.0, y + l * 0.95 - 0.2, tz);
      if (l < 3) vehicle(k, l === 1 ? 'rover' : 'jeep', tx, tz, y + l * 0.95 - 0.12, -Math.PI / 2, l === 1 ? OLIVE : OLIVE_D);
    }
    k.box(2.0, 0.1, 1.6, C.white, tx, y + 3.0, tz);
    for (let i = 0; i < 3; i++) k.blinker(tx + 0.95, y + 0.5 + i * 0.95, tz + 0.78, '#3fd16b', 0.025, 1.2 + i * 0.2);
    // Lift bay beside it
    const lx = 1.05;
    for (const sx of [-1, 1]) k.box(0.1, 3.0, 0.1, HAZ, lx + sx * 0.7, y, tz - 0.6);
    k.box(1.5, 0.1, 0.1, HAZ, lx, y + 3.0, tz - 0.6);
    const lift = new THREE.Group();
    k.box(1.3, 0.06, 1.3, '#5c6166', 0, 0, 0, lift);
    for (const sx of [-1, 1]) k.box(0.04, 0.2, 1.3, HAZ, sx * 0.63, 0.06, 0, lift);
    lift.position.set(lx, y, tz);
    k.add(lift);
    const car = vehicle(k, 'jeep', 0, 0, 0.06, -Math.PI / 2, '#6c7a40');
    lift.add(car.group);
    k.anims.push((t) => {
      const c = (t % 10) / 10;
      const up = c < 0.3 ? c / 0.3 : c < 0.5 ? 1 : c < 0.8 ? 1 - (c - 0.5) / 0.3 : 0;
      lift.position.y = y + up * up * (3 - 2 * up) * 1.9;
    });
    k.glassBox(2.2, 1.1, 1.0, 0.85, y, 1.05);
    k.box(2.3, 0.08, 1.1, C.white, 0.85, y + 1.1, 1.05);
    k.box(1.2, 0.12, 0.02, '#2bb3a3', 0.85, y + 0.85, 1.56);
    return;
  }
  if (level === 18) {
    // Convoy marshalling yard: lined-up convoy, overhead LED gantry sign, lighting masts, control cab
    k.box(4.2, 0.012, 2.6, ASPHALT, 0, y, -0.25);
    for (const z of [-0.95, 0.15]) k.box(4.0, 0.006, 0.04, HAZ, 0, y + 0.012, z);
    const kinds: VehicleKind[] = ['rover', 'truck', 'bowser', 'jeep'];
    kinds.forEach((kd, i) => vehicle(k, kd, 1.55 - i * 1.15, -0.4, y, 0));
    for (const x of [-2.0, 2.0]) k.box(0.12, 2.5, 0.12, '#8a9196', x, y, 0.6);
    k.box(4.1, 0.45, 0.12, '#1f2a2e', 0, y + 2.1, 0.6);
    const led = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 0.01), new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ff8a1f', emissiveIntensity: 1 }));
    led.position.set(0, y + 2.32, 0.67);
    k.add(led);
    k.anims.push((t) => ((led.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + (Math.sin(t * 3) > 0 ? 0.8 : 0)));
    for (const [x, z] of [[-2.0, -1.5], [2.0, -1.5]]) {
      k.box(0.08, 2.9, 0.08, '#8a9196', x, y, z);
      k.box(0.4, 0.14, 0.12, '#33383d', x, y + 2.9, z);
      k.box(0.36, 0.08, 0.02, '#fff6c8', x, y + 2.92, z + 0.07);
    }
    // Marshalling canopy over the convoy lane, with skylight strips
    for (const x of [-1.9, 0, 1.9]) k.box(0.1, 2.6, 0.1, '#8a9196', x, y, -1.35);
    k.box(4.2, 0.12, 1.5, C.white, 0, y + 2.6, -0.65);
    for (let i = 0; i < 4; i++) k.box(0.6, 0.02, 1.3, '#86b7cc', -1.5 + i * 1.0, y + 2.72, -0.65);
    k.glassBox(0.9, 2.6, 0.8, -1.55, y + 0.0, 1.15);
    k.box(1.0, 0.1, 0.9, C.white, -1.55, y + 2.6, 1.15);
    k.antenna(-1.75, y + 2.7, 1.0, 0.7);
    const lead = vehicle(k, 'jeep', 1.2, 1.2, y, Math.PI, OLIVE_D);
    dispatchLoop(k, lead, 1.4, 10, 1);
    return;
  }
  if (level === 19) {
    // Autonomous pod depot: white pods glide round a looped guideway under a green-roofed station
    const h = k.block(1.8, 2.6, 3, -1.25, y, -0.45, '#f2f0ea');
    k.flatRoof(1.8, 2.6, -1.25, y + h, -0.45);
    k.hedge(-1.25, -0.45, 1.5, 2.3, y + h + 0.06);
    for (let f = 0; f < 3; f++) k.box(0.02, 0.3, 2.3, DARK_GLASS, -0.34, y + f * STOREY + 0.4, -0.45);
    // Guideway loop
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 4, 32), M('#c9ced2'));
    loop.rotation.x = Math.PI / 2;
    loop.scale.set(1.15, 1, 1);
    loop.position.set(1.05, y + 0.06, -0.15);
    k.add(loop);
    const pods = [0, 1, 2].map((i) => vehicle(k, 'pod', 0, 0, y, 0, ['#f2f0ea', '#2bb3a3', '#ffc93c'][i]));
    k.anims.push((t) => {
      pods.forEach((p, i) => {
        const a = t * 0.4 + (i / 3) * Math.PI * 2;
        p.group.position.set(1.05 + Math.cos(a) * 1.03, y + 0.06, -0.15 + Math.sin(a) * 0.9);
        p.group.rotation.y = -a - Math.PI / 2;
        for (const w of p.wheels) w.rotation.z = -t * 4;
      });
    });
    k.cyl(0.35, 2.9, '#f2f0ea', 1.05, y, -0.15, 12);
    k.cyl(0.75, 0.12, C.roofGreen, 1.05, y + 2.9, -0.15, 12);
    k.blinker(1.05, y + 3.02, -0.15, '#3fd16b', 0.05, 1.3);
    return;
  }
  // 20: Motor citadel: spiral-ramped multi-deck garage with a gold band and a green roof
  const cx = -0.4, cz = -0.45;
  for (let l = 0; l < 3; l++) {
    const ly = y + l * 0.95;
    k.box(3.2, 0.12, 2.2, CONCRETE, cx, ly + 0.83, cz);
    k.box(3.2, 0.25, 0.05, C.white, cx, ly + 0.95, cz + 1.1);
    for (let i = 0; i < 4; i++) for (const pz of [cz - 1.0, cz + 1.0]) k.box(0.12, 0.83, 0.12, CONCRETE, cx - 1.5 + i * 1.0, ly, pz);
    if (l > 0) {
      vehicle(k, l === 1 ? 'rover' : 'jeep', cx - 0.9, cz, ly - 0.0 + 0.0, -Math.PI / 2);
      vehicle(k, l === 1 ? 'jeep' : 'rover', cx + 0.6, cz, ly, -Math.PI / 2, OLIVE_D);
    }
  }
  vehicle(k, 'truck', cx - 0.7, cz, y);
  const g = vehicle(k, 'rover', cx + 0.7, cz, y);
  dispatchLoop(k, g, 2.0, 12, 2);
  k.box(3.24, 0.1, 2.24, '#d9b24a', cx, y + 2.85, cz);
  k.box(3.0, 0.12, 2.0, '#6cbf45', cx, y + 2.95, cz);
  // Spiral ramp tower
  k.cyl(0.6, 2.9, CONCRETE, 1.85, y, -0.2, 14);
  for (let i = 0; i < 6; i++) {
    const s = k.box(0.5, 0.06, 0.3, ASPHALT, 1.85 + Math.cos(i) * 0.6, y + 0.3 + i * 0.45, -0.2 + Math.sin(i) * 0.6);
    s.rotation.y = -i;
  }
  k.cyl(0.65, 0.1, '#d9b24a', 1.85, y + 2.9, -0.2, 14);
  k.blinker(1.85, y + 3.0, -0.2, '#ffb020', 0.05, 1.5);
}

export function buildMotorPool(level: number): Kit {
  const k = new Kit();
  const y = k.pad(5, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const MOTOR_POOL: BuildingDef = {
  id: 'motorpool',
  name: 'Motor Pool',
  role: 'The camp’s vehicles. More vehicles and faster dispatch speed up deliveries and transport.',
  footprint: [5, 4],
  unlockHq: 4,
  levels: MOTOR_POOL_LEVELS,
  designedLevels: 20,
  build: buildMotorPool,
};
