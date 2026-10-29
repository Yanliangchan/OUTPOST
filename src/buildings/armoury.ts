import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Armoury: the research building (the camp's answer to a Laboratory). It
 * researches upgrades for defences and troop kit, one research per slot at a
 * time; higher levels open higher research tiers and research faster.
 *
 * Signature at every level: a secure strongroom with a heavy door that opens
 * and shuts on a loop (timber → container doors → steel slab → sliding slab →
 * round vault door → blast door → gold vault door), an armourer at a workbench
 * hammering and testing parts, a sentry at the door, and a research glow that
 * grows with the bands (bench lamp → spinning test jig → blueprint table → test
 * chamber → hologram projector → gold vault). Guns only ever appear as chunky
 * dark cartoon silhouettes on racks.
 * Footprint 3×3; bulk climbs from ~1 storey to ~3.4 storeys.
 */

const TITLES = [
  'Sandbag Strongpoint', 'Container Strongroom', 'Arms Hut', 'Armoury', 'Armoury · Test Bay', 'Two-Storey Armoury',
  'Vault Armoury', 'Blueprint Hall', 'Test Chamber', 'Armoury Complex',
  'Research Lab', 'Twin Lab', 'Hologram Lab', 'Test Dome', 'Research Spire',
  'Hardened Lab', 'Bunker Vault', 'Triple Vault', 'Scanner Vault', 'Gold Vault',
];
const RESEARCH = [
  'Rifle sights', 'Helmet padding', 'Sandbag fill', 'Sentry optics', 'Mortar fuzes', 'Body-armour plates', 'Wall reinforcement',
  'Searchlight lenses', 'Mortar range', 'Tower armour', 'Artillery shells', 'Night vision', 'Air-defence tracking', 'Drone jammers',
  'Composite armour', 'Hardened walls', 'Guided rounds', 'Thermal optics', 'Sensor fusion', 'Citadel-grade armour',
];
const nice = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
};
const SUPPLIES = Array.from({ length: 20 }, (_, i) => nice(150_000 * Math.pow(1.28, i)));
const REPUTATION = [2_000, 2_400, 2_900, 3_400, 4_000, 4_700, 5_500, 6_400, 7_400, 8_500, 9_700, 11_000, 12_500, 14_000, 15_700, 17_500, 19_500, 21_600, 23_800, 26_000];
const TIME = [4 * HOUR, 6 * HOUR, 8 * HOUR, 10 * HOUR, 12 * HOUR, 16 * HOUR, 20 * HOUR, 1 * DAY, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY, 7 * DAY, 8 * DAY];

export const ARMOURY_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const speed = i * 5;
  const slots = level >= 18 ? 3 : level >= 12 ? 2 : 1;
  const unlocks = [`Tier ${level} research: ${RESEARCH[i]}`];
  if (speed) unlocks.push(`Research speed +${speed}%`);
  if (level === 12 || level === 18) unlocks.push(`Research slot ${slots}`);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((1000 * Math.pow(1.2, i)) / 10) * 10,
    stats: { researchSpeed: speed, researchSlots: slots, maxTier: level },
    unlocks,
  };
});

// ------------------------------------------------------------------ palette

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const CONT = '#5d6b35';
const BERET = '#2a3326';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const DIRT = '#a98a5e';
const WOOD_D = '#7a5a3b';
const PLANK = '#b07a4a';
const STEEL = '#8b949a';
const STEEL_D = '#5f686e';
const GUNMETAL = '#b0babf';
const ARMOUR = '#8b979d';
const SLATE = '#4f6577';
const HAZ = '#f2c230';
const TEAL = '#2bb3a3';
const GUN = '#262a2f';
const LAMP = '#ffd36b';
const BLUE = '#46a8ff';
const HOLO = '#3fe8d6';
const WHITE = '#f4f4f0';
const GRASS = '#5fae34';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const ghost = (c: string, o = 0.45, i = 1.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, flatShading: true });
const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};

// ------------------------------------------------------------------ the door cycle

/** Every door, porter and status light of a level shares this cycle. */
const PERIOD = 11;
const cyc = (t: number, p = PERIOD) => (((t % p) + p) % p) / p;
const smooth = (u: number) => u * u * (3 - 2 * u);
/** How open the strongroom door is: unlocks (0–0.12), opens (0.12–0.22), stays open while the porter goes out and back, shuts (0.7–0.8). */
function openAt(c: number) {
  const u = c < 0.12 ? 0 : c < 0.22 ? (c - 0.12) / 0.1 : c < 0.7 ? 1 : c < 0.8 ? 1 - (c - 0.7) / 0.1 : 0;
  return smooth(u);
}

// ------------------------------------------------------------------ signs & textures

function signMat(text: string, bg: string, fg: string, font = 40, border?: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 5;
    g.strokeRect(4, 4, 248, 56);
  }
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
}

/** Flat sign board with lettering on its front (+z) face. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, border?: string) {
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg, 40, border), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** Sign on two posts. */
function postSign(k: Kit, text: string, x: number, z: number, y: number, bg = OLIVE_D, post = WOOD_D, w = 0.6) {
  for (const s of [-1, 1]) k.box(0.04, 0.5, 0.04, post, x + s * (w / 2 - 0.04), y, z);
  board(k, text, w, 0.16, x, y + 0.34, z + 0.03, bg, '#ffffff', 0, HAZ);
}

let blueprintTex: THREE.CanvasTexture | null = null;
/** Blueprint sheet: white line drawings of a gear and a part on blue grid paper. */
function blueprintMat(intensity = 0.35) {
  if (!blueprintTex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2a63b0';
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = '#5d93d6';
    g.lineWidth = 1;
    for (let i = 0; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 160); g.stroke(); }
    for (let j = 0; j < 160; j += 16) { g.beginPath(); g.moveTo(0, j); g.lineTo(256, j); g.stroke(); }
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.beginPath(); g.arc(70, 80, 40, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(70, 80, 14, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillStyle = '#ffffff';
      g.fillRect(70 + Math.cos(a) * 44 - 6, 80 + Math.sin(a) * 44 - 6, 12, 12);
    }
    g.strokeRect(140, 40, 90, 34);
    g.strokeRect(150, 90, 30, 46);
    g.beginPath(); g.moveTo(140, 140); g.lineTo(236, 140); g.stroke();
    g.font = '900 22px Nunito, system-ui, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText('MK II', 190, 124);
    blueprintTex = new THREE.CanvasTexture(c);
    blueprintTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ map: blueprintTex, emissive: '#ffffff', emissiveMap: blueprintTex, emissiveIntensity: intensity, roughness: 0.8 });
}

/** Alternating yellow/black hazard strip, along x (or z). */
function hazard(k: Kit, len: number, h: number, x: number, y: number, z: number, alongZ = false, seg = 0.12, parent?: THREE.Object3D) {
  const n = Math.max(2, Math.round(len / seg));
  const s = len / n;
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + s * (i + 0.5);
    k.box(alongZ ? 0.03 : s, h, alongZ ? s : 0.03, i % 2 ? C.kerbB : HAZ, alongZ ? x : x + t, y, alongZ ? z + t : z, parent);
  }
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }

/** A ~0.6-tall low-poly figure facing +x with pivoting limbs. */
function figure(seed: number, uniform = OLIVE, beret: string | null = BERET, trousers = OLIVE_D, apron?: string): Figure {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, c: string, x: number, yy: number, z: number, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, M(c));
    m.position.set(x, yy, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const limb = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(0, 0.26, -0.045);
  legR.position.set(0, 0.26, 0.045);
  for (const l of [legL, legR]) {
    add(limb(0.065, 0.22, 0.065), trousers, 0, 0, 0, l);
    add(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, l);
    root.add(l);
  }
  add(new THREE.BoxGeometry(0.12, 0.2, 0.17), uniform, 0, 0.36, 0);
  add(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.27, 0);
  if (apron) add(new THREE.BoxGeometry(0.02, 0.24, 0.13), apron, 0.065, 0.33, 0);
  add(new THREE.IcosahedronGeometry(0.062, 0), SKIN[seed % SKIN.length], 0, 0.52, 0);
  if (beret) {
    const b = add(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), beret, -0.005, 0.575, 0.01);
    b.rotation.x = 0.2;
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(limb(0.05, 0.18, 0.05), uniform, 0, 0, 0, a);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.045), SKIN[seed % SKIN.length], 0, -0.19, 0, a);
    root.add(a);
  }
  return { root, legL, legR, armL, armR };
}

function pose(f: Figure, walk: number, amp = 0.5) {
  const s = Math.sin(walk);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.8;
  f.armR.rotation.z = s * amp * 0.8;
}

/** Heading (rotation.y) that faces a figure built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** A sentry standing at ease by the door: shifts weight, glances around, snaps to attention while the door is open. */
function sentry(k: Kit, x: number, z: number, y: number, rotY = face(0, 1), seed = 2, uniform = OLIVE) {
  const f = figure(seed, uniform);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  k.anims.push((t) => {
    const o = openAt(cyc(t));
    f.root.rotation.y = rotY + Math.sin(t * 0.5 + seed) * 0.4 * (1 - o);
    f.armL.rotation.z = Math.sin(t * 0.9 + seed) * 0.08;
    f.armR.rotation.z = o > 0.9 && cyc(t) < 0.3 ? 2.55 : 0; // salutes the door open
  });
  return f;
}

/** The armourer at a bench: hammers at a part, then lifts it up to inspect it. */
function armourer(k: Kit, parent: THREE.Object3D, x: number, z: number, y: number, rotY: number, seed = 0, uniform = '#4f6046', tool = '#9aa3a6') {
  const f = figure(seed, uniform, '#3a4a2e', OLIVE_D, '#8a6a45');
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  // Hammer in the right hand
  const hammer = new THREE.Group();
  hammer.position.set(0.0, -0.2, 0);
  hammer.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.1), M(WOOD_D), 0, 0, 0.03));
  hammer.add(mesh(new THREE.BoxGeometry(0.05, 0.035, 0.035), M(tool), 0, 0, 0.08));
  hammer.rotation.y = -Math.PI / 2;
  f.armR.add(hammer);
  // Part held in the left hand
  f.armL.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), M('#c9ced2'), 0.02, -0.21, 0));
  parent.add(f.root);
  const P = 7 + (seed % 3);
  k.anims.push((t) => {
    const c = cyc(t + seed * 1.3, P);
    if (c < 0.68) {
      const s = Math.max(0, Math.sin(t * 7 + seed));
      f.armR.rotation.z = 0.8 + s * 0.75;
      f.armL.rotation.z = 0.95;
      f.root.position.y = y - s * 0.006;
      f.root.rotation.y = rotY;
    } else {
      // Lift the part to the light, turning it over
      const u = Math.min(1, (c - 0.68) / 0.06, (1 - c) / 0.06);
      f.armL.rotation.z = 0.95 + u * 0.8;
      f.armR.rotation.z = 0.8 + u * 0.3;
      f.root.rotation.y = rotY + Math.sin(t * 1.5) * 0.25 * u;
      f.root.position.y = y;
    }
  });
  return f;
}

/** Officer at the blueprint table: points at the sheet, nods. */
function officer(k: Kit, parent: THREE.Object3D, x: number, z: number, y: number, rotY: number, seed = 1, uniform = OLIVE) {
  const f = figure(seed, uniform, '#5a1f24');
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  parent.add(f.root);
  k.anims.push((t) => {
    const c = cyc(t + seed, 6);
    f.armR.rotation.z = c < 0.5 ? 1.0 + Math.sin(t * 3) * 0.15 : 0.2;
    f.armL.rotation.z = c < 0.5 ? 0.1 : 0.6 + Math.sin(t * 2) * 0.1;
    f.root.rotation.y = rotY + (c < 0.5 ? 0 : Math.sin(t * 1.2) * 0.3);
  });
  return f;
}

/** The porter wheels a kit case out of the strongroom while the door is open, then back in. Hidden inside while it is shut. */
function porter(k: Kit, x: number, zDoor: number, zOut: number, y: number, caseColor = OLIVE_D, uniform = OLIVE) {
  const f = figure(3, uniform);
  const cart = new THREE.Group();
  cart.position.set(0.28, 0, 0);
  const wheels: THREE.Mesh[] = [];
  cart.add(mesh(new THREE.BoxGeometry(0.32, 0.03, 0.22), M(STEEL_D), 0, 0.09, 0));
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.1, 0.1]) {
    const w = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8).rotateX(Math.PI / 2), M('#2a2b2d'), sx, 0.04, sz);
    cart.add(w);
    wheels.push(w);
  }
  cart.add(mesh(new THREE.BoxGeometry(0.03, 0.22, 0.2), M(STEEL_D), -0.16, 0.1, 0));
  cart.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.18), M(caseColor), 0, 0.15, 0));
  cart.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.185), M(HAZ), 0, 0.2, 0));
  f.root.add(cart);
  k.add(f.root);
  const heading = face(0, zOut - zDoor);
  k.anims.push((t) => {
    const c = cyc(t);
    let u = 0, moving = false;
    if (c < 0.2) u = 0;
    else if (c < 0.4) { u = smooth((c - 0.2) / 0.2); moving = true; }
    else if (c < 0.48) u = 1;
    else if (c < 0.68) { u = 1 - smooth((c - 0.48) / 0.2); moving = true; }
    const z = zDoor - 0.35 + (zOut - zDoor + 0.35) * u;
    f.root.position.set(x, y, z);
    f.root.rotation.y = heading;
    f.root.visible = u > 0.02;
    pose(f, moving ? t * 8 : 0, 0.45);
    f.armL.rotation.z = f.armR.rotation.z = 1.2;
    for (const w of wheels) w.rotation.z = -z / 0.04;
  });
  return f;
}

// ------------------------------------------------------------------ props

/** Chunky cartoon gun silhouette standing upright (stock down). */
function gun(k: Kit, parent: THREE.Object3D, x: number, y: number, z: number, s = 1) {
  k.box(0.045 * s, 0.1 * s, 0.035 * s, GUN, x, y, z, parent);
  k.box(0.035 * s, 0.13 * s, 0.03 * s, GUN, x + 0.005, y + 0.1 * s, z, parent);
  k.box(0.04 * s, 0.05 * s, 0.025 * s, GUN, x + 0.03 * s, y + 0.11 * s, z, parent);
  k.box(0.015 * s, 0.12 * s, 0.015 * s, GUN, x + 0.005, y + 0.23 * s, z, parent);
}

/** Rack of cartoon rifles. */
function rack(k: Kit, x: number, z: number, y: number, rotY = 0, n = 3, frame = WOOD_D, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const w = n * 0.1 * s + 0.08;
  k.box(w, 0.04, 0.12, frame, 0, 0, 0, g);
  k.box(w, 0.03, 0.05, frame, 0, 0.26 * s, -0.04, g);
  for (const sx of [-1, 1]) k.box(0.03, 0.32 * s, 0.1, frame, sx * (w / 2 - 0.015), 0, -0.01, g);
  for (let i = 0; i < n; i++) gun(k, g, -((n - 1) * 0.1 * s) / 2 + i * 0.1 * s, 0.04, 0, s);
  return k.add(g);
}

/** A spinning test part: a toothed gear on an axle. `axis` is the spin axis. */
function gear(k: Kit, parent: THREE.Object3D, x: number, y: number, z: number, r: number, color = '#c9ced2', axis: 'y' | 'z' = 'z', speed = 1.6, teeth = 8) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const disc = mesh(new THREE.CylinderGeometry(r, r, r * 0.35, 12), M(color));
  if (axis === 'z') disc.rotation.x = Math.PI / 2;
  g.add(disc);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = mesh(new THREE.BoxGeometry(r * 0.35, r * 0.35, r * 0.35), M(color));
    if (axis === 'z') tooth.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    else tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tooth.rotation[axis] = a;
    g.add(tooth);
  }
  const hub = mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 0.5, 8), M('#4a4f54'));
  if (axis === 'z') hub.rotation.x = Math.PI / 2;
  g.add(hub);
  parent.add(g);
  k.anims.push((t) => (g.rotation[axis] = t * speed));
  return g;
}

/** Bench lamp with a flickering warm glow. */
function benchLamp(k: Kit, parent: THREE.Object3D, x: number, y: number, z: number, color = LAMP) {
  k.box(0.08, 0.02, 0.08, '#3a3f44', x, y, z, parent);
  k.box(0.015, 0.2, 0.015, '#3a3f44', x, y, z, parent);
  const arm = k.box(0.12, 0.015, 0.015, '#3a3f44', x + 0.05, y + 0.2, z, parent);
  arm.rotation.z = -0.3;
  const head = mesh(new THREE.ConeGeometry(0.045, 0.06, 8, 1, true), M('#2f6b3a', { side: THREE.DoubleSide }), x + 0.11, y + 0.17, z);
  parent.add(head);
  const bulb = mesh(new THREE.SphereGeometry(0.022, 8, 6), glow(color, 1.6), x + 0.11, y + 0.15, z);
  parent.add(bulb);
  const pool = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.004, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }), x + 0.11, y + 0.004, z);
  parent.add(pool);
  k.anims.push((t) => ((bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(t * 17) * 0.15 + Math.sin(t * 5.3) * 0.15));
}

/**
 * Armourer's workbench with vice, lamp and a spinning test part, and the armourer behind it.
 * Built facing +z (the armourer stands at local -z); `top` is the bench top colour.
 */
function station(k: Kit, x: number, z: number, y: number, rotY = 0, o: { len?: number; top?: string; legs?: string; lamp?: string; seed?: number; uniform?: string; jig?: string } = {}) {
  const len = o.len ?? 0.66;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const top = o.top ?? C.wood, legs = o.legs ?? C.metal;
  k.box(len, 0.04, 0.3, top, 0, 0.26, 0, g);
  for (const sx of [-1, 1]) k.box(0.04, 0.26, 0.26, legs, sx * (len / 2 - 0.04), 0, 0, g);
  k.box(len - 0.1, 0.02, 0.24, legs, 0, 0.08, 0, g); // shelf
  k.box(0.1, 0.06, 0.08, '#4a4f54', -len / 2 + 0.1, 0.3, 0.08, g); // vice
  k.box(0.04, 0.02, 0.12, '#4a4f54', -len / 2 + 0.1, 0.33, 0.12, g);
  k.box(0.08, 0.03, 0.05, '#c9ced2', 0.02, 0.3, 0.02, g); // part being fitted
  for (let i = 0; i < 3; i++) k.box(0.05, 0.02, 0.03, ['#d8342c', '#2f6fa8', HAZ][i], -0.06 + i * 0.07, 0.3, -0.09, g);
  benchLamp(k, g, len / 2 - 0.18, 0.3, -0.06, o.lamp ?? LAMP);
  // Test jig: a gear spinning on an upright at the bench end
  k.box(0.03, 0.14, 0.03, '#4a4f54', len / 2 - 0.07, 0.3, 0.06, g);
  gear(k, g, len / 2 - 0.07, 0.48, 0.08, 0.05, o.jig ?? '#c9ced2', 'z', 2.2, 6);
  armourer(k, g, 0, -0.28, 0, face(0, 1), o.seed ?? 0, o.uniform);
  k.add(g);
  return g;
}

/** Blueprint table with a glowing sheet and an officer studying it. Faces +z. */
function blueprintTable(k: Kit, x: number, z: number, y: number, rotY = 0, w = 0.6, d = 0.4, seed = 1, uniform = OLIVE) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.03, 0.27, 0.03, '#4a4f54', sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04), g);
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), [M('#2a63b0'), M('#2a63b0'), blueprintMat(0.45), M('#2a63b0'), M('#2a63b0'), M('#2a63b0')]);
  sheet.position.set(0, 0.29, 0);
  sheet.rotation.x = 0.22;
  g.add(sheet);
  officer(k, g, 0, -d / 2 - 0.14, 0, face(0, 1), seed, uniform);
  k.add(g);
  return g;
}

/** Hanging hurricane lantern swaying in the breeze. */
function lantern(k: Kit, x: number, y: number, z: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.box(0.01, 0.1, 0.01, '#33383d', 0, -0.1, 0, g);
  const body = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 6), glow('#ffcf6a', 0.9), 0, -0.16, 0);
  g.add(body, mesh(new THREE.ConeGeometry(0.055, 0.04, 6), M('#4a4f54'), 0, -0.1, 0));
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 1.5 + seed) * 0.18;
    g.rotation.x = Math.sin(t * 1.1 + seed * 2) * 0.1;
  });
}

/** Status light over the strongroom door: red while shut, green while open. */
function statusLight(k: Kit, x: number, y: number, z: number) {
  k.box(0.16, 0.08, 0.05, '#33383d', x, y, z);
  const red = mesh(new THREE.SphereGeometry(0.025, 8, 6), glow('#ff3b30', 1.4), x - 0.04, y + 0.04, z + 0.03);
  const green = mesh(new THREE.SphereGeometry(0.025, 8, 6), glow('#3fd16b', 0.1), x + 0.04, y + 0.04, z + 0.03);
  k.add(red);
  k.add(green);
  k.anims.push((t) => {
    const o = openAt(cyc(t)) > 0.05;
    (red.material as THREE.MeshStandardMaterial).emissiveIntensity = o ? 0.1 : 1.4;
    (green.material as THREE.MeshStandardMaterial).emissiveIntensity = o ? 1.6 : 0.1;
  });
}

/** Spinning test stand: a tripod holding a big part that turns on a jig, with a glowing ring. */
function testStand(k: Kit, x: number, z: number, y: number, r = 0.12, glowC = LAMP, h = 0.45) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = k.box(0.025, h + 0.04, 0.025, '#4a4f54', x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1);
    leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  k.box(0.08, 0.06, 0.08, '#4a4f54', x, y + h, z);
  const g = new THREE.Group();
  g.position.set(x, y + h + r + 0.06, z);
  k.add(g);
  gear(k, g, 0, 0, 0, r, '#c9ced2', 'z', 1.4, 8);
  const ring = mesh(new THREE.TorusGeometry(r * 1.5, 0.012, 6, 20), glow(glowC, 1.4));
  g.add(ring);
  k.anims.push((t) => (ring.rotation.y = t * 0.8));
}

/** Hologram projector: a disc base, a light cone and a slowly turning glowing part with orbiting rings. */
function hologram(k: Kit, x: number, y: number, z: number, s = 1, color = HOLO, base = C.metal) {
  k.cyl(0.28 * s, 0.08, base, x, y, z, 12);
  k.cyl(0.22 * s, 0.03, '#33383d', x, y + 0.08, z, 12);
  const lens = mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.02, 12), glow(color, 1.6), x, y + 0.12, z);
  k.add(lens);
  const cone = mesh(new THREE.CylinderGeometry(0.3 * s, 0.12 * s, 0.5 * s, 12, 1, true), ghost(color, 0.18, 0.8), x, y + 0.13 + 0.25 * s, z);
  k.add(cone);
  const g = new THREE.Group();
  g.position.set(x, y + 0.55 * s, z);
  const core = mesh(new THREE.IcosahedronGeometry(0.15 * s, 0), ghost(color, 0.55, 1.3));
  g.add(core);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tooth = mesh(new THREE.BoxGeometry(0.07 * s, 0.07 * s, 0.07 * s), ghost(color, 0.6, 1.3), Math.cos(a) * 0.2 * s, 0, Math.sin(a) * 0.2 * s);
    tooth.rotation.y = -a;
    g.add(tooth);
  }
  k.add(g);
  const rings = [0, 1].map(() => {
    const r = mesh(new THREE.TorusGeometry(0.27 * s, 0.012 * s + 0.004, 6, 24).rotateX(Math.PI / 2), glow(color, 1.5), x, y + 0.4 * s, z);
    k.add(r);
    return r;
  });
  k.anims.push((t) => {
    g.rotation.y = t * 0.9;
    g.rotation.x = Math.sin(t * 0.7) * 0.2;
    g.position.y = y + 0.55 * s + Math.sin(t * 1.6) * 0.03 * s;
    rings.forEach((r, i) => {
      const u = ((t * 0.35 + i * 0.5) % 1);
      r.position.y = y + 0.18 * s + u * 0.6 * s;
      r.scale.setScalar(0.7 + u * 0.5);
    });
    (core.material as THREE.MeshStandardMaterial).opacity = 0.45 + Math.sin(t * 4) * 0.1;
  });
  return g;
}

/** Half-cylinder (barrel-vault) roof with the axis along x, rising h above y. */
function barrelRoof(k: Kit, len: number, d: number, h: number, x: number, y: number, z: number, color = SLATE, ends = CONCRETE) {
  const r = d / 2;
  const roof = mesh(new THREE.CylinderGeometry(r, r, len, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), M(color, { side: THREE.DoubleSide }), x, y, z);
  roof.scale.set(1, h / r, 1);
  k.add(roof);
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CircleGeometry(r - 0.02, 16, 0, Math.PI), M(ends, { side: THREE.DoubleSide }), x + s * (len / 2 - 0.03), y, z);
    cap.rotation.y = Math.PI / 2;
    cap.scale.set(1, h / r, 1);
    k.add(cap);
  }
  // Seam ribs over the vault
  const n = Math.max(3, Math.round(len / 0.4));
  for (let i = 0; i <= n; i++) {
    const rib = mesh(new THREE.TorusGeometry(r + 0.005, 0.018, 4, 16, Math.PI), M(color === SLATE ? '#3c4e5e' : C.roofDark), x - len / 2 + 0.04 + ((len - 0.08) / n) * i, y, z);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, h / r, 1);
    k.add(rib);
  }
  k.box(len + 0.06, 0.06, d + 0.06, C.trim, x, y - 0.06, z);
}

/** Hemispherical dome. */
function dome(k: Kit, r: number, x: number, y: number, z: number, color = WHITE, sy = 1) {
  const d = mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(color), x, y, z);
  d.scale.y = sy;
  return k.add(d);
}

/** Olive shipping container running along z, doors at the +z end. */
function container(k: Kit, x: number, z: number, y: number, w: number, len: number, h: number, color = CONT) {
  k.box(w, h, len, color, x, y, z);
  const n = Math.round(len / 0.13);
  for (let i = 1; i < n; i++) for (const s of [-1, 1]) k.box(0.02, h - 0.1, 0.035, '#4b5a2c', x + s * (w / 2 + 0.005), y + 0.05, z - len / 2 + (len / n) * i);
  k.box(w + 0.03, 0.05, len + 0.03, '#4b5a2c', x, y + h - 0.05, z);
  k.box(w + 0.03, 0.05, len + 0.03, '#4b5a2c', x, y, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 0.07, 0.07, '#3c4522', x + sx * (w / 2 - 0.02), y + h - 0.07, z + sz * (len / 2 - 0.02));
}

type DoorStyle = 'timber' | 'container' | 'steel' | 'slide' | 'round' | 'blast' | 'gold';

/**
 * The strongroom door, set into a wall whose face is at (x, z) facing +z. It
 * opens on the shared cycle and reveals the research glow inside. For round
 * doors, w is the diameter. `hinge` picks the hinge side for swinging doors.
 */
function strongDoor(k: Kit, style: DoorStyle, x: number, y: number, z: number, w: number, h: number, o: { inner?: string; hinge?: 1 | -1; color?: string; frame?: string; rotY?: number } = {}) {
  const G = new THREE.Group();
  G.position.set(x, y, z);
  G.rotation.y = o.rotY ?? 0;
  const inner = o.inner ?? LAMP;
  const hinge = o.hinge ?? -1;
  const round = style === 'round' || style === 'gold';
  const r = w / 2;
  // Dark recess with the research glow at the back
  if (round) {
    G.add(mesh(new THREE.CylinderGeometry(r, r, 0.02, 20).rotateX(Math.PI / 2), M('#1b1f22'), 0, r + 0.02, 0.005));
    G.add(mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.01, 16).rotateX(Math.PI / 2), glow(inner, 1.1), 0, r + 0.02, 0.016));
  } else {
    k.box(w, h, 0.02, '#1b1f22', 0, 0, 0.0, G);
    k.box(w * 0.7, h * 0.55, 0.01, inner, 0, h * 0.2, 0.012, G).material = glow(inner, 1.1);
  }
  const anims: ((u: number, t: number) => void)[] = [];
  const hinged = (leafW: number, side: 1 | -1, build: (leaf: THREE.Group) => void, maxA = 1.75) => {
    const p = new THREE.Group();
    p.position.set(side * (w / 2), 0, 0.03);
    const leaf = new THREE.Group();
    leaf.position.x = -side * leafW / 2;
    build(leaf);
    p.add(leaf);
    G.add(p);
    anims.push((u) => (p.rotation.y = side * u * maxA));
  };
  if (style === 'timber') {
    hinged(w, hinge, (leaf) => {
      for (let i = 0; i < 4; i++) k.box(w / 4 - 0.01, h, 0.04, i % 2 ? PLANK : '#a06c3e', -w / 2 + (w / 4) * (i + 0.5), 0, 0, leaf);
      for (const yy of [0.08, h - 0.14]) k.box(w, 0.06, 0.03, WOOD_D, 0, yy, 0.03, leaf);
      const brace = k.box(0.05, h * 0.85, 0.025, WOOD_D, 0, h * 0.08, 0.03, leaf);
      brace.rotation.z = 0.5;
      k.box(0.06, 0.06, 0.05, '#33383d', hinge * -w * 0.35, h * 0.5, 0.04, leaf); // padlock
    });
    k.box(w + 0.1, 0.07, 0.08, WOOD_D, 0, h, 0.02, G);
  } else if (style === 'container') {
    for (const side of [-1, 1] as const) {
      const p = new THREE.Group();
      p.position.set(side * w / 2, 0, 0.03);
      const leaf = new THREE.Group();
      leaf.position.x = -side * w / 4;
      k.box(w / 2 - 0.01, h, 0.035, o.color ?? CONT, 0, 0, 0, leaf);
      for (let i = 0; i < 4; i++) k.box(0.025, h - 0.08, 0.03, '#4b5a2c', -w / 4 + 0.05 + i * ((w / 2 - 0.1) / 3), 0.04, 0.02, leaf);
      for (const dx of [-0.06, 0.06]) k.box(0.018, h, 0.03, '#c9ced2', dx, 0, 0.04, leaf); // locking bars
      p.add(leaf);
      G.add(p);
      anims.push((u) => (p.rotation.y = side * u * 1.9));
    }
  } else if (style === 'steel') {
    hinged(w, hinge, (leaf) => {
      k.box(w - 0.02, h - 0.02, 0.07, o.color ?? STEEL, 0, 0.01, 0, leaf);
      k.box(w - 0.14, h - 0.16, 0.02, STEEL_D, 0, 0.08, 0.07, leaf);
      for (const yy of [0.08, h * 0.5, h - 0.1]) for (const xx of [-1, 1]) k.box(0.03, 0.03, 0.02, '#c9ced2', xx * (w / 2 - 0.06), yy, 0.075, leaf);
      // Locking wheel
      const wheel = new THREE.Group();
      wheel.position.set(hinge * -w * 0.22, h * 0.52, 0.1);
      wheel.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 12), M('#d8342c')));
      for (let i = 0; i < 2; i++) {
        const spoke = mesh(new THREE.BoxGeometry(0.14, 0.015, 0.015), M('#d8342c'));
        spoke.rotation.z = (i * Math.PI) / 2;
        wheel.add(spoke);
      }
      leaf.add(wheel);
      anims.push((_u, t) => {
        const c = cyc(t);
        wheel.rotation.z = c < 0.12 ? (c / 0.12) * Math.PI * 2 : c > 0.8 && c < 0.92 ? -((c - 0.8) / 0.12) * Math.PI * 2 : 0;
      });
    }, 1.6);
    hazard(k, w + 0.16, 0.08, 0, h, 0.02, false, 0.1, G);
    for (const s of [-1, 1]) {
      const n = Math.max(2, Math.round(h / 0.1));
      for (let i = 0; i < n; i++) k.box(0.08, h / n, 0.03, i % 2 ? C.kerbB : HAZ, s * (w / 2 + 0.04), (h / n) * i, 0.02, G);
    }
  } else if (style === 'slide' || style === 'blast') {
    const leaf = new THREE.Group();
    leaf.position.z = 0.04;
    const col = o.color ?? (style === 'blast' ? '#6b757c' : STEEL);
    k.box(w, h, style === 'blast' ? 0.12 : 0.07, col, 0, 0, 0, leaf);
    if (style === 'blast') {
      for (let i = 0; i < 6; i++) {
        const s = k.box(0.06, h * 0.32, 0.02, i % 2 ? C.kerbB : HAZ, -w / 2 + 0.08 + i * ((w - 0.16) / 5), 0.04, 0.065, leaf);
        s.rotation.z = 0.6;
      }
      k.box(w - 0.12, 0.05, 0.02, STEEL_D, 0, h * 0.5, 0.065, leaf);
      k.box(w - 0.12, 0.05, 0.02, STEEL_D, 0, h * 0.75, 0.065, leaf);
    } else {
      for (let i = 1; i < 4; i++) k.box(w - 0.06, 0.025, 0.02, STEEL_D, 0, (h / 4) * i, 0.04, leaf);
      k.box(0.04, 0.18, 0.03, '#33383d', -w / 2 + 0.06, h * 0.45, 0.05, leaf);
    }
    G.add(leaf);
    // Track above and a frame
    k.box(w * 2.1, 0.06, 0.08, '#4a4f54', w * 0.55, h + 0.01, 0.06, G);
    for (let i = 0; i < 3; i++) {
      const roller = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8).rotateX(Math.PI / 2), M('#2a2b2d'), -w / 2 + 0.08 + i * ((w - 0.16) / 2), h + 0.04, 0.1);
      leaf.add(roller);
    }
    anims.push((u) => (leaf.position.x = u * w * 1.02));
    if (style === 'blast') {
      for (const s of [-1, 1]) {
        const n = Math.max(2, Math.round(h / 0.12));
        for (let i = 0; i < n; i++) k.box(0.09, h / n, 0.03, i % 2 ? C.kerbB : HAZ, s * (w / 2 + 0.045), (h / n) * i, 0.02, G);
      }
    } else for (const s of [-1, 1]) k.box(0.06, h + 0.04, 0.05, o.frame ?? '#4a4f54', s * (w / 2 + 0.03), 0, 0.02, G);
  } else {
    // Round bank-vault door: a thick disc on a side hinge with a spoked locking wheel
    const gold = style === 'gold';
    const p = new THREE.Group();
    p.position.set(hinge * r, 0, 0.04);
    const leaf = new THREE.Group();
    leaf.position.x = -hinge * r;
    leaf.add(mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.1, 22).rotateX(Math.PI / 2), M(gold ? GOLD : o.color ?? '#b8bfc4', { metalness: 0.3, roughness: 0.5 }), 0, r + 0.02, 0.05));
    leaf.add(mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.02, 22).rotateX(Math.PI / 2), M(gold ? '#c99a2e' : '#9aa3a8'), 0, r + 0.02, 0.11));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      leaf.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), M(gold ? '#fff0a8' : '#d9dde0'), Math.cos(a) * r * 0.88, r + 0.02 + Math.sin(a) * r * 0.88, 0.11));
    }
    const wheel = new THREE.Group();
    wheel.position.set(0, r + 0.02, 0.14);
    wheel.add(mesh(new THREE.TorusGeometry(r * 0.36, 0.022, 6, 16), M(gold ? '#fff0a8' : '#d8342c')));
    for (let i = 0; i < 3; i++) {
      const spoke = mesh(new THREE.BoxGeometry(r * 0.95, 0.028, 0.028), M(gold ? '#fff0a8' : '#d8342c'));
      spoke.rotation.z = (i * Math.PI) / 3;
      wheel.add(spoke);
    }
    wheel.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8).rotateX(Math.PI / 2), M('#33383d')));
    leaf.add(wheel);
    // Locking bolts slide out of the rim
    p.add(leaf);
    G.add(p);
    // Hinge block and frame ring
    k.box(0.1, r * 1.2, 0.12, '#4a4f54', hinge * (r + 0.02), r * 0.4, 0.04, G);
    const ring = mesh(new THREE.TorusGeometry(r + 0.03, 0.05, 6, 24), M(gold ? GOLD : '#7d868c', { metalness: 0.3 }), 0, r + 0.02, 0.03);
    G.add(ring);
    anims.push((u, t) => {
      const c = cyc(t);
      p.rotation.y = hinge * u * 1.5;
      wheel.rotation.z = c < 0.12 ? (c / 0.12) * Math.PI * 2 : c > 0.8 && c < 0.92 ? -((c - 0.8) / 0.12) * Math.PI * 2 : 0;
    });
  }
  k.add(G);
  k.anims.push((t) => {
    const u = openAt(cyc(t));
    for (const a of anims) a(u, t);
  });
  return G;
}

/** Barred window on a +z face (or rotated). */
function barredWindow(k: Kit, x: number, y: number, z: number, w = 0.34, h = 0.3, frame = C.trim, rotY = 0, glowC?: string) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w + 0.08, h + 0.08, 0.03, frame, 0, -0.04, 0, g);
  const pane = k.box(w, h, 0.04, glowC ?? DARK_GLASS, 0, 0, 0.005, g);
  if (glowC) pane.material = glow(glowC, 0.7);
  for (let i = 1; i < 4; i++) k.box(0.02, h, 0.05, '#33383d', -w / 2 + (w / 4) * i, 0, 0.012, g);
  k.box(w + 0.1, 0.035, 0.08, C.sill, 0, -0.06, 0.025, g);
  return k.add(g);
}

/** Slit windows (bunker style) along x. */
function slits(k: Kit, n: number, w: number, x: number, y: number, z: number, color = '#1f2a2e', sw = 0.22, sh = 0.07) {
  for (let i = 0; i < n; i++) k.box(sw, sh, 0.03, color, x - w / 2 + (w / (n - 1 || 1)) * i, y, z);
}

/** Sensor post: a slim mast with a rotating sensor head and a blinking tip. */
function sensorMast(k: Kit, x: number, z: number, y: number, h = 1.8, head = '#e8e6e0', eye = '#ff3b30') {
  k.box(0.22, 0.08, 0.22, CONCRETE, x, y, z);
  k.cyl(0.035, h, C.metal, x, y + 0.08, z, 6);
  const g = new THREE.Group();
  g.position.set(x, y + h, z);
  k.box(0.18, 0.12, 0.14, head, 0.04, 0, 0, g);
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8).rotateZ(Math.PI / 2), glow(eye, 1), 0.14, 0.06, 0));
  k.add(g);
  k.anims.push((t) => (g.rotation.y = Math.sin(t * 0.45 + x) * 1.3 + 0.8));
  k.blinker(x, y + h + 0.12, z, '#ff3b30', 0.025, 1.3);
}

/** CCTV camera on a bracket, panning. */
function cctv(k: Kit, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.03, 0.03, 0.1, '#4a4f54', 0, 0, 0.05, g);
  const cam = new THREE.Group();
  cam.position.set(0, -0.02, 0.1);
  k.box(0.07, 0.07, 0.16, '#f4f4f0', 0, -0.03, 0.06, cam);
  k.box(0.04, 0.04, 0.02, '#1f2326', 0, -0.015, 0.14, cam);
  g.add(cam);
  k.add(g);
  k.anims.push((t) => (cam.rotation.y = Math.sin(t * 0.4 + x * 3) * 0.7));
}

/** Laser/scan bar sweeping up and down a door frame while the door is shut. */
function scanBar(k: Kit, x: number, y: number, z: number, w: number, h: number, color = '#ff3b30') {
  const b = mesh(new THREE.BoxGeometry(w, 0.02, 0.02), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }), x, y, z);
  k.add(b);
  k.anims.push((t) => {
    const c = cyc(t);
    b.visible = c < 0.12 || c > 0.82;
    b.position.y = y + 0.04 + (0.5 + 0.5 * Math.sin(t * 5)) * (h - 0.08);
  });
}

/** Low concrete podium with a hazard edge; keeps the secure levels' footprint solid. */
function podium(k: Kit, w: number, d: number, y: number, h = 0.26, color = CONCRETE, x = 0, z = 0) {
  k.box(w, h, d, color, x, y, z);
  k.box(w + 0.02, 0.04, d + 0.02, '#a9a395', x, y + h - 0.04, z);
  hazard(k, w, 0.05, x, y + h - 0.09, z + d / 2 + 0.01, false, 0.14);
  return y + h;
}

/** Ramp of steps up a podium on the front. */
function steps(k: Kit, x: number, z: number, w: number, y: number, h: number, color = '#c2bcae') {
  const n = Math.max(2, Math.round(h / 0.08));
  for (let i = 0; i < n; i++) k.box(w, h * (1 - i / n), 0.1, color, x, y, z - i * 0.1);
}

/** White lab block with glass front, fins, teal band and a green roof slab. Returns its height. */
function labBlock(k: Kit, x: number, z: number, w: number, d: number, floors: number, y: number, o: { fins?: boolean; roof?: string; glassFrom?: number; band?: string; tilt?: number } = {}) {
  const h = floors * STOREY;
  k.box(w, h, d, WHITE, x, y, z);
  k.box(w + 0.03, 0.14, d + 0.03, '#d7d3c8', x, y, z);
  const from = o.glassFrom ?? 1;
  for (let f = from; f < floors; f++) {
    k.box(w - 0.24, STOREY - 0.3, 0.04, '#86b7cc', x, y + f * STOREY + 0.15, z + d / 2 + 0.01);
    k.box(0.04, STOREY - 0.3, d - 0.3, '#86b7cc', x + w / 2 + 0.01, y + f * STOREY + 0.15, z);
    k.box(0.04, STOREY - 0.3, d - 0.3, '#86b7cc', x - w / 2 - 0.01, y + f * STOREY + 0.15, z);
  }
  for (let f = 1; f < floors; f++) k.box(w + 0.05, 0.07, d + 0.05, o.band ?? TEAL, x, y + f * STOREY - 0.03, z);
  if (o.fins !== false) k.fins(w - 0.2, h - STOREY - 0.05, x, y + STOREY, z + d / 2 + 0.06, Math.max(3, Math.round(w / 0.3)));
  if (o.tilt) {
    // Mono-pitch roof: a raised wedge wall on the high side and a tilted slab
    const rise = Math.tan(Math.abs(o.tilt)) * (w + 0.22);
    const side = Math.sign(o.tilt);
    const wedge = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, side > 0 ? 0 : rise), new THREE.Vector2(-w / 2, side > 0 ? rise : 0)]);
    const wg = new THREE.ExtrudeGeometry(wedge, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
    k.add(mesh(wg, M(WHITE), x, y + h, z));
    const slab = k.box(w / Math.cos(o.tilt) + 0.24, 0.1, d + 0.22, o.roof ?? C.roofGreen, x, y + h + rise / 2 - 0.05, z);
    slab.rotation.z = -o.tilt;
    return h + rise + 0.1;
  }
  k.box(w + 0.22, 0.1, d + 0.22, o.roof ?? C.roofGreen, x, y + h, z);
  k.box(w + 0.24, 0.04, d + 0.24, C.white, x, y + h - 0.02, z);
  return h + 0.1;
}

/** Hardened armoured block: dark concrete, angled armour plates on the sides, hazard band. Returns height. */
function armourBlock(k: Kit, x: number, z: number, w: number, d: number, h: number, y: number, color = GUNMETAL) {
  k.box(w, h, d, color, x, y, z);
  k.box(w + 0.04, 0.2, d + 0.04, ARMOUR, x, y, z);
  hazard(k, w - 0.1, 0.06, x, y + 0.2, z + d / 2 + 0.03, false, 0.14);
  for (const s of [-1, 1]) {
    const plate = k.box(0.14, h * 0.92, d + 0.06, ARMOUR, x + s * (w / 2 + 0.04), y, z);
    plate.rotation.z = -s * 0.07;
  }
  k.box(w + 0.12, 0.14, d + 0.12, ARMOUR, x, y + h, z);
  for (let i = 0; i < Math.round(w / 0.5); i++) k.box(0.08, 0.06, 0.04, '#c9ced2', x - w / 2 + 0.3 + i * 0.5, y + h + 0.04, z + d / 2 + 0.08);
  return h + 0.14;
}

// ------------------------------------------------------------------ field (1–3)

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Sandbagged dugout strongpoint with a timber door; tarp awning over the armourer's bench
    const cx = -0.4, cz = -0.45;
    k.box(1.95, 0.16, 1.45, DIRT, cx, y, cz);
    const top = y + 0.16;
    k.box(1.5, 0.42, 1.0, '#4a3f30', cx, top, cz);
    k.sandbags(cx, cz - 0.6, 1.75, 0, top, 4);
    k.sandbags(cx - 0.82, cz, 1.05, Math.PI / 2, top, 4);
    k.sandbags(cx + 0.82, cz, 1.05, Math.PI / 2, top, 4);
    k.sandbags(cx - 0.56, cz + 0.6, 0.62, 0, top, 4);
    k.sandbags(cx + 0.56, cz + 0.6, 0.62, 0, top, 4);
    const dz = cz + 0.6;
    for (const s of [-1, 1]) k.box(0.07, 0.44, 0.07, WOOD_D, cx + s * 0.25, top, dz + 0.02);
    k.box(0.62, 0.07, 0.12, WOOD_D, cx, top + 0.42, dz + 0.02);
    strongDoor(k, 'timber', cx, top, dz + 0.06, 0.4, 0.42);
    // Log roof, tarp and a row of bags to hold it down
    for (let i = 0; i < 6; i++) k.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6).rotateZ(Math.PI / 2), M(C.wood), cx, top + 0.46, cz - 0.62 + i * 0.25));
    const tarp = k.box(1.95, 0.05, 1.5, OLIVE, cx, top + 0.5, cz);
    tarp.rotation.x = 0.04;
    k.sandbags(cx, cz - 0.55, 1.6, 0, top + 0.54, 1);
    k.sandbags(cx - 0.3, cz + 0.55, 1.0, 0, top + 0.53, 1);
    lantern(k, cx + 0.2, top + 0.42, dz + 0.1, 1);
    // Awning on poles over the bench
    for (const [px, pz, ph] of [[0.3, 0.2, 0.98], [1.28, 0.2, 0.98], [0.3, 0.72, 0.9], [1.28, 0.72, 0.9]]) k.box(0.05, ph, 0.05, WOOD_D, px, y, pz);
    const aw = k.box(1.15, 0.04, 0.72, '#8a8458', 0.79, y + 0.92, 0.45);
    aw.rotation.x = 0.12;
    station(k, 0.78, 0.92, y);
    rack(k, 1.12, 0.42, y, -Math.PI / 2, 3);
    k.drum(1.3, -0.85, OLIVE_D, y);
    k.drum(1.05, -1.05, OLIVE_D, y);
    sentry(k, 0.12, 0.45, y, face(0, 1));
    postSign(k, 'ARMOURY', -1.0, 0.95, y);
    return;
  }
  if (level === 2) {
    // Olive shipping container strongroom with double doors; tarp awning off its side
    const cx = -0.72, cz = -0.25, cw = 0.95, cl = 1.9, ch = 0.9;
    container(k, cx, cz, y, cw, cl, ch);
    strongDoor(k, 'container', cx, y, cz + cl / 2 + 0.01, 0.86, 0.84);
    k.sandbags(cx - 0.6, cz, 1.8, Math.PI / 2, y, 3);
    k.sandbags(cx, cz - 1.08, 1.0, 0, y, 3);
    board(k, 'ARMOURY', 0.62, 0.15, cx + cw / 2 + 0.02, y + 0.62, cz + 0.4, OLIVE_D, '#ffffff', Math.PI / 2, HAZ);
    // Awning from the container roof to two poles
    for (const pz of [-1.05, 0.45]) k.box(0.05, 0.78, 0.05, WOOD_D, 1.2, y, pz);
    const aw = k.box(1.55, 0.04, 1.6, '#8a8458', 0.45, y + 0.86, -0.3);
    aw.rotation.z = -0.15;
    station(k, 0.55, 0.85, y, 0, { seed: 1 });
    testStand(k, 0.75, 0.15, y, 0.1);
    rack(k, 0.3, -0.95, y, 0, 4);
    lantern(k, 0.4, y + 0.8, -0.45, 2);
    porter(k, cx, cz + cl / 2, 1.15, y);
    sentry(k, -0.05, 0.95, y, face(0, 1));
    k.drum(1.25, -0.6, OLIVE_D, y);
    k.drum(1.25, -0.85, OLIVE_D, y);
    return;
  }
  // 3: arms hut: timber hut with a zinc gable roof beside the steel-doored container strongroom
  const hx = 0.42, hz = -0.5, hw = 1.75, hd = 1.2, hh = 0.78;
  k.box(hw + 0.1, 0.1, hd + 0.1, '#8a6a45', hx, y, hz); // floor on low stumps
  k.box(hw, hh, hd, PLANK, hx, y + 0.1, hz);
  for (let i = 0; i < 12; i++) k.box(0.02, hh, 0.02, '#8f5f35', hx - hw / 2 + 0.08 + i * ((hw - 0.16) / 11), y + 0.1, hz + hd / 2 + 0.005);
  k.gableRoof(hw, hd, 0.55, hx, y + 0.1 + hh, hz, C.zinc, 0.2, PLANK);
  // Big shuttered window showing the lamp-lit bench inside
  k.box(0.7, 0.34, 0.03, '#2c2620', hx + 0.25, y + 0.42, hz + hd / 2 + 0.01);
  k.box(0.5, 0.16, 0.01, LAMP, hx + 0.25, y + 0.5, hz + hd / 2 + 0.025).material = glow(LAMP, 0.8);
  const shutter = k.box(0.78, 0.04, 0.32, PLANK, hx + 0.25, y + 0.78, hz + hd / 2 + 0.12);
  shutter.rotation.x = -0.6;
  k.box(0.78, 0.04, 0.12, '#8f5f35', hx + 0.25, y + 0.38, hz + hd / 2 + 0.06);
  k.door('front', hx, hz, hw, hd, -0.5, y + 0.1, 0.32, 0.56, '#7a5a3b');
  board(k, 'ARMOURY', 0.7, 0.16, hx, y + 0.1 + hh + 0.06, hz + hd / 2 + 0.06, OLIVE_D, '#ffffff', 0, HAZ);
  // Container strongroom with a steel door
  const cx = -0.98, cz = -0.25;
  container(k, cx, cz, y, 0.85, 1.85, 0.92);
  strongDoor(k, 'steel', cx, y, cz + 0.93, 0.5, 0.74, { inner: LAMP });
  statusLight(k, cx, y + 0.8, cz + 0.95);
  k.sandbags(cx, cz - 1.0, 0.9, 0, y, 3);
  k.sandbags(cx, cz + 0.2, 0.85, 0, y + 0.92, 1);
  station(k, 0.55, 0.85, y, 0, { seed: 2 });
  testStand(k, 1.22, 0.55, y, 0.11);
  rack(k, -0.25, 0.28, y, 0, 4);
  porter(k, cx, cz + 0.93, 1.2, y);
  sentry(k, -0.35, 0.85, y, face(0, 1));
  lantern(k, cx + 0.3, y + 0.9, cz + 1.0, 3);
  k.drum(1.3, -1.25, OLIVE_D, y);
}

// ------------------------------------------------------------------ camp (4–6)

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // First permanent armoury: cream block, red hip roof, steel strongroom door in a hazard frame
    const bx = 0, bz = -0.4, bw = 2.35, bd = 1.45;
    k.block(bw, bd, 1, bx, y, bz);
    k.hipRoof(bw, bd, 0.66, bx, y + STOREY, bz, C.roof);
    const fz = bz + bd / 2 + 0.03;
    strongDoor(k, 'steel', -0.45, y, fz, 0.5, 0.72);
    statusLight(k, -0.45, y + 0.8, fz);
    barredWindow(k, 0.45, y + 0.45, fz, 0.34, 0.28);
    barredWindow(k, 0.92, y + 0.45, fz, 0.34, 0.28);
    for (const s of [-1, 1]) barredWindow(k, bx + s * (bw / 2 + 0.03), y + 0.45, bz, 0.3, 0.26, C.trim, s * Math.PI / 2);
    board(k, 'ARMOURY', 0.8, 0.18, 0.68, y + 0.72, fz + 0.02, C.trim, '#ffffff', 0, HAZ);
    k.porch(-0.45, fz + 0.3, 0.85, 0.55, 0.86, y, 2);
    station(k, 0.65, 0.9, y, 0, { seed: 1 });
    rack(k, -1.0, fz + 0.08, y, 0, 4, C.trim);
    porter(k, -0.45, fz, 1.2, y);
    sentry(k, -1.05, 0.75, y, face(0, 1));
    k.aircon(1.25, y + 0.25, -0.6, Math.PI / 2);
    k.bin(-1.3, 1.25, y);
    return;
  }
  if (level === 5) {
    // L-shape: armoury block plus an open-fronted test bay wing with a spinning test stand
    const bx = -0.3, bz = -0.6, bw = 2.3, bd = 1.2;
    k.block(bw, bd, 1, bx, y, bz);
    k.hipRoof(bw, bd, 0.82, bx, y + STOREY, bz, C.roof);
    const fz = bz + bd / 2 + 0.03;
    strongDoor(k, 'steel', -0.9, y, fz, 0.52, 0.74);
    statusLight(k, -0.9, y + 0.82, fz);
    barredWindow(k, -0.25, y + 0.45, fz, 0.3, 0.28);
    // Test bay wing
    const wx = 0.85, wz = 0.3, ww = 1.1, wd = 1.15;
    k.box(ww, 0.95, 0.08, C.wall, wx, y, wz - wd / 2 + 0.04);
    for (const s of [-1, 1]) k.box(0.1, 0.95, wd, C.wall, wx + s * (ww / 2 - 0.05), y, wz);
    k.box(ww, 0.05, wd, '#c9c3b5', wx, y, wz);
    k.box(ww + 0.04, 0.16, wd, C.trim, wx, y + 0.79, wz + 0.0);
    k.gableRoof(ww, wd, 0.5, wx, y + 0.95, wz, C.roof, 0.14);
    hazard(k, ww - 0.2, 0.06, wx, y + 0.06, wz + wd / 2 - 0.04);
    testStand(k, wx, wz - 0.1, y + 0.05, 0.14, '#ff9a3c', 0.42);
    k.box(0.5, 0.36, 0.02, '#bfe6f2', wx - 0.1, y + 0.05, wz + 0.2).material = M('#bfe6f2', { transparent: true, opacity: 0.4 }); // blast shield
    board(k, 'TEST BAY', 0.6, 0.14, wx, y + 0.8, wz + wd / 2 + 0.01, C.trim, '#ffffff', 0, HAZ);
    station(k, -0.35, 0.75, y, 0, { seed: 1 });
    rack(k, -1.3, 0.25, y, Math.PI / 2, 4, C.trim);
    porter(k, -0.9, fz, 1.2, y);
    sentry(k, -1.3, 0.85, y, face(0, 1));
    k.planter(0.85, 1.2, 0.8, y);
    return;
  }
  // 6: two-storey armoury with a sliding strongroom door, a glowing roof lantern and the test bay wing
  const bx = -0.25, bz = -0.55, bw = 2.35, bd = 1.3;
  k.block(bw, bd, 2, bx, y, bz);
  k.hipRoof(bw, bd, 0.55, bx, y + STOREY * 2, bz, C.roof);
  // Glowing research lantern on the ridge
  const lx = bx, ly = y + STOREY * 2 + 0.45;
  k.box(0.44, 0.24, 0.32, C.wall, lx, ly, bz);
  k.box(0.38, 0.12, 0.33, LAMP, lx, ly + 0.07, bz).material = glow(LAMP, 0.9);
  k.hipRoof(0.44, 0.32, 0.18, lx, ly + 0.24, bz, C.roof, 0.06);
  const fz = bz + bd / 2 + 0.03;
  strongDoor(k, 'slide', -0.85, y, fz, 0.55, 0.76);
  statusLight(k, -0.85, y + 0.86, fz);
  for (const x of [-1.05, -0.45, 0.15, 0.6]) barredWindow(k, x, y + STOREY + 0.42, fz, 0.3, 0.28);
  for (const s of [-1, 1]) for (let f = 0; f < 2; f++) barredWindow(k, bx + s * (bw / 2 + 0.03), y + f * STOREY + 0.45, bz, 0.3, 0.26, C.trim, s * Math.PI / 2);
  board(k, 'ARMOURY', 0.9, 0.2, -0.25, y + STOREY + 0.05, fz + 0.02, C.trim, '#ffffff', 0, HAZ);
  // Test bay wing
  const wx = 0.88, wz = 0.48, ww = 1.05, wd = 0.95;
  k.box(ww, 0.95, 0.08, C.wall, wx, y, wz - wd / 2 + 0.04);
  for (const s of [-1, 1]) k.box(0.1, 0.95, wd, C.wall, wx + s * (ww / 2 - 0.05), y, wz);
  k.box(ww + 0.04, 0.16, wd, C.trim, wx, y + 0.79, wz);
  k.gableRoof(ww, wd, 0.45, wx, y + 0.95, wz, C.roof, 0.14);
  hazard(k, ww - 0.2, 0.06, wx, y + 0.02, wz + wd / 2 - 0.04);
  testStand(k, wx, wz - 0.05, y, 0.14, '#ff9a3c', 0.42);
  // Green sentry box beside the door
  k.box(0.36, 0.7, 0.34, C.wall, -1.25, y, 0.4);
  k.box(0.3, 0.55, 0.02, '#2c3530', -1.25, y + 0.08, 0.575);
  k.hipRoof(0.36, 0.34, 0.2, -1.25, y + 0.7, 0.4, C.trim, 0.06);
  sentry(k, -1.25, 0.82, y, face(0, 1));
  station(k, -0.2, 0.85, y, 0, { seed: 2 });
  rack(k, 0.56, 0.3, y, Math.PI / 2, 3, C.trim);
  porter(k, -0.85, fz, 1.2, y);
  k.aircon(bx - bw / 2 - 0.08, y + STOREY + 0.25, bz - 0.3, -Math.PI / 2);
  k.antenna(bx + 0.8, y + STOREY * 2 + 0.2, bz - 0.2, 0.6);
}

// ------------------------------------------------------------------ base (7–10)

/** Concrete hall with a slate barrel-vault roof. Returns its top. */
function barrelHall(k: Kit, x: number, z: number, w: number, d: number, wallH: number, roofH: number, y: number, roof = SLATE) {
  k.box(w, wallH, d, CONCRETE, x, y, z);
  k.box(w + 0.03, 0.16, d + 0.03, C.trim, x, y, z);
  k.box(w + 0.05, 0.06, d + 0.05, C.trim, x, y + STOREY - 0.03, z);
  for (const s of [-1, 1]) k.box(0.12, wallH, 0.12, '#c7c2b7', x + s * (w / 2 - 0.02), y, z + d / 2 - 0.02);
  barrelRoof(k, w + 0.12, d + 0.14, roofH, x, y + wallH, z, roof);
  return y + wallH + roofH;
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Concrete strongroom under a slate barrel roof, round vault door in a projecting portal
    const hx = -0.1, hz = -0.5, hw = 2.5, hd = 1.5, wh = 2.0;
    barrelHall(k, hx, hz, hw, hd, wh, 0.6, y);
    slits(k, 4, 2.0, hx, y + STOREY + 0.45, hz + hd / 2 + 0.01);
    // Glowing skylight lantern on the vault crown
    k.box(0.6, 0.18, 0.3, '#c7c2b7', hx - 0.5, y + wh + 0.52, hz);
    k.box(0.52, 0.1, 0.31, LAMP, hx - 0.5, y + wh + 0.56, hz).material = glow(LAMP, 1);
    // Portal
    const px = 0.35, pz = hz + hd / 2 + 0.15, pw = 1.15, ph = 1.25;
    k.box(pw, ph, 0.32, '#c7c2b7', px, y, pz);
    k.box(pw + 0.06, 0.1, 0.36, C.trim, px, y + ph, pz);
    hazard(k, pw, 0.08, px, y, pz + 0.17);
    strongDoor(k, 'round', px, y + 0.08, pz + 0.16, 0.82, 0.82, { hinge: -1 });
    statusLight(k, px, y + 1.0, pz + 0.17);
    board(k, 'ARMOURY', 0.9, 0.18, px, y + ph + 0.1, pz + 0.17, C.trim, '#ffffff', 0, HAZ);
    station(k, -0.85, 0.95, y, 0, { seed: 1 });
    rack(k, -1.1, hz + hd / 2 + 0.08, y, 0, 5, C.trim);
    porter(k, px, pz + 0.16, 1.2, y);
    sentry(k, 1.15, 0.75, y, face(0, 1));
    for (const z of [-0.9, -0.3]) k.aircon(hx + hw / 2 + 0.08, y + 0.3, z, Math.PI / 2);
    k.planter(1.0, 1.25, 0.6, y);
    return;
  }
  if (level === 8) {
    // Blueprint hall: barrel hall plus a two-storey drawing-office wing with a glowing blueprint wall
    const hx = 0.3, hz = -0.6, hw = 2.3, hd = 1.35;
    barrelHall(k, hx, hz, hw, hd, 2.05, 0.72, y);
    slits(k, 3, 1.4, hx + 0.35, y + STOREY + 0.45, hz + hd / 2 + 0.01);
    const fz = hz + hd / 2 + 0.03;
    strongDoor(k, 'round', 0.45, y + 0.08, fz, 0.84, 0.84, { hinge: -1 });
    k.box(1.05, 0.1, 0.12, C.trim, 0.45, y + 1.02, fz);
    hazard(k, 1.0, 0.08, 0.45, y, fz + 0.03);
    statusLight(k, 0.45, y + 1.12, fz);
    board(k, 'ARMOURY', 0.9, 0.18, 0.45, y + 1.3, fz + 0.01, C.trim, '#ffffff', 0, HAZ);
    // Drawing-office wing
    const wx = -0.85, wz = 0.28, ww = 1.2, wd = 1.15;
    k.box(ww, STOREY * 2, wd, CONCRETE, wx, y, wz);
    k.box(ww + 0.03, 0.16, wd + 0.03, C.trim, wx, y, wz);
    k.flatRoof(ww, wd, wx, y + STOREY * 2, wz, 0.16);
    k.box(ww + 0.1, 0.06, wd + 0.1, C.trim, wx, y + STOREY * 2 + 0.2, wz);
    // Big glazed front with the blueprint wall lit up behind
    const front = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.24, 1.15, 0.03), [M(BLUE), M(BLUE), M(BLUE), M(BLUE), blueprintMat(0.7), M(BLUE)]);
    front.position.set(wx, y + 0.42 + 0.575, wz + wd / 2 + 0.01);
    k.add(front);
    for (let i = 0; i <= 3; i++) k.box(0.04, 1.2, 0.05, C.trim, wx - (ww - 0.24) / 2 + ((ww - 0.24) / 3) * i, y + 0.4, wz + wd / 2 + 0.02);
    for (const yy of [0.4, 1.0, 1.58]) k.box(ww - 0.2, 0.04, 0.05, C.trim, wx, y + yy, wz + wd / 2 + 0.02);
    k.box(0.04, 0.6, wd - 0.3, BLUE, wx - ww / 2 - 0.01, y + STOREY + 0.15, wz).material = glow(BLUE, 0.5);
    blueprintTable(k, wx, 1.12, y, 0, 0.6, 0.36, 1);
    station(k, 1.05, 0.95, y, 0, { seed: 2 });
    rack(k, -0.15, 0.25, y, Math.PI / 2, 5, C.trim);
    porter(k, 0.45, fz, 1.2, y);
    sentry(k, -0.12, 1.0, y, face(0, 1));
    k.aircon(hx + hw / 2 + 0.08, y + 0.3, hz, Math.PI / 2);
    k.antenna(hx + 0.8, y + 2.05 + 0.45, hz - 0.3, 0.7);
    return;
  }
  if (level === 9) {
    // Tall cylindrical test chamber with a glowing window band and a part spinning inside
    const hx = -0.45, hz = -0.6, hw = 2.0, hd = 1.4;
    barrelHall(k, hx, hz, hw, hd, 2.1, 0.72, y);
    const fz = hz + hd / 2 + 0.03;
    strongDoor(k, 'round', -0.5, y + 0.08, fz, 0.84, 0.84, { hinge: 1 });
    k.box(1.05, 0.1, 0.12, C.trim, -0.5, y + 1.02, fz);
    hazard(k, 1.0, 0.08, -0.5, y, fz + 0.03);
    statusLight(k, -0.5, y + 1.12, fz);
    board(k, 'ARMOURY', 0.9, 0.18, -0.5, y + 1.3, fz + 0.01, C.trim, '#ffffff', 0, HAZ);
    slits(k, 3, 1.4, hx, y + STOREY + 0.62, fz - 0.02);
    testChamber(k, 0.82, -0.25, y, 0.6, 2.55, CONCRETE, '#ff9a3c');
    blueprintTable(k, -1.05, 1.0, y, 0, 0.5, 0.34, 1);
    station(k, 0.6, 1.0, y, 0, { seed: 2 });
    rack(k, 0.15, 0.45, y, -Math.PI / 2, 4, C.trim);
    porter(k, -0.5, fz, 1.2, y);
    sentry(k, 1.25, 0.6, y, face(0, 1));
    k.aircon(hx - hw / 2 - 0.08, y + 0.3, hz, -Math.PI / 2);
    return;
  }
  // 10: grand complex: barrel hall, white columned portico over the vault door, test chamber, flagpole
  const hx = -0.15, hz = -0.72, hw = 2.7, hd = 1.2;
  barrelHall(k, hx, hz, hw, hd, 2.25, 0.72, y, C.roof);
  slits(k, 2, 0.7, -1.05, y + STOREY + 0.62, hz + hd / 2 + 0.01);
  testChamber(k, 0.95, -0.72, y, 0.56, 2.85, CONCRETE, '#ff9a3c', C.roof);
  // Portico
  const px = -0.2, pz0 = hz + hd / 2 + 0.02, pd = 0.78, pw = 1.55, ph = 1.45;
  k.box(pw + 0.1, 0.08, pd + 0.1, '#c2bcae', px, y, pz0 + pd / 2);
  for (const cx of [-0.7, -0.25, 0.25, 0.7]) k.cyl(0.07, ph, C.white, px + cx * (pw / 1.6), y + 0.08, pz0 + pd - 0.08, 10);
  k.box(pw + 0.1, 0.16, pd + 0.1, C.white, px, y + ph + 0.08, pz0 + pd / 2);
  k.gableRoof(pw + 0.1, pd + 0.1, 0.42, px, y + ph + 0.24, pz0 + pd / 2, C.roof, 0.05, C.white);
  strongDoor(k, 'round', px, y + 0.08, pz0, 0.9, 0.9, { hinge: 1 });
  statusLight(k, px, y + 1.15, pz0);
  board(k, 'ARMOURY', 0.95, 0.15, px, y + ph + 0.08, pz0 + pd + 0.06, C.trim, '#ffffff', 0, GOLD);
  blueprintTable(k, -1.1, 1.0, y, 0, 0.5, 0.34, 1);
  station(k, 0.95, 1.0, y, 0, { seed: 2 });
  rack(k, -1.25, pz0 + 0.1, y, 0, 3, C.trim);
  porter(k, px, pz0, 1.25, y);
  sentry(k, -0.75, 0.82, y, face(0, 1), 4);
  sentry(k, 0.38, 0.82, y, face(0, 1), 5);
  k.flagpole(1.35, 0.42, 2.0, y);
  k.aircon(hx - hw / 2 - 0.08, y + 0.3, hz, -Math.PI / 2);
}

/** Cylindrical test chamber with a glass band, a part spinning inside and a domed cap. */
function testChamber(k: Kit, x: number, z: number, y: number, r: number, h: number, wall = CONCRETE, glowC = '#ff9a3c', capColor = '#9aa3a8', band = 0.55) {
  k.cyl(r, h, wall, x, y, z, 18);
  k.cyl(r + 0.02, 0.16, C.trim, x, y, z, 18);
  hazard(k, r * 1.2, 0.07, x, y + 0.16, z + r + 0.01);
  const by = y + h * band;
  // Glass band: dark inside, glowing ring, spinning part visible through it
  k.cyl(r * 0.5, 0.4, glowC, x, by, z, 12).material = glow(glowC, 1.0);
  k.cyl(r - 0.04, 0.02, '#1f2326', x, by, z, 18);
  k.cyl(r - 0.04, 0.02, '#1f2326', x, by + 0.38, z, 18);
  const glass = mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.38, 18, 1, true), ghost('#bfe6f2', 0.25, 0.2), x, by + 0.2, z);
  k.add(glass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.04, 0.4, 0.04, wall, x + Math.cos(a) * (r + 0.01), by, z + Math.sin(a) * (r + 0.01));
  }
  const part = new THREE.Group();
  part.position.set(x, by + 0.2, z);
  k.add(part);
  for (let i = 0; i < 4; i++) {
    const vane = mesh(new THREE.BoxGeometry(r * 0.42, 0.3, 0.05), M('#3a3f44'), Math.cos((i * Math.PI) / 2) * r * 0.7, 0, Math.sin((i * Math.PI) / 2) * r * 0.7);
    vane.rotation.y = -(i * Math.PI) / 2;
    part.add(vane);
  }
  k.anims.push((t) => (part.rotation.y = t * 2.4));
  k.cyl(r + 0.04, 0.06, C.trim, x, by - 0.03, z, 18);
  k.cyl(r + 0.04, 0.06, C.trim, x, by + 0.4, z, 18);
  dome(k, r * 0.98, x, y + h, z, capColor, 0.55);
  k.blinker(x, y + h + r * 0.54, z, '#ff3b30', 0.035, 1.2);
  // Inspection hatch at the base
  k.box(0.3, 0.45, 0.04, STEEL_D, x, y + 0.22, z + r - 0.01);
  return y + h + r * 0.55;
}

// ------------------------------------------------------------------ command (11–15)

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Research lab: white three-storey block, glass front with fins, green roof, sliding teal vault door
    const bx = 0, bz = -0.45, bw = 2.65, bd = 1.65;
    const h = labBlock(k, bx, bz, bw, bd, 3, y);
    const fz = bz + bd / 2 + 0.03;
    strongDoor(k, 'slide', -0.55, y, fz, 0.62, 0.74, { color: '#e8e6e0', inner: HOLO });
    k.box(0.64, 0.05, 0.03, TEAL, -0.55, y + 0.78, fz + 0.06);
    statusLight(k, -0.55, y + 0.84, fz);
    // Glass lobby with a test stand
    k.box(0.9, 0.7, 0.03, '#86b7cc', 0.6, y + 0.1, fz).material = M('#86b7cc', { transparent: true, opacity: 0.55 });
    testStand(k, 0.6, fz - 0.25, y, 0.1, HOLO, 0.3);
    // Entrance canopy
    k.box(2.0, 0.07, 0.6, C.white, 0, y + 0.92, fz + 0.28);
    k.box(2.02, 0.03, 0.62, TEAL, 0, y + 0.9, fz + 0.28);
    for (const x of [-0.9, 0.9]) k.box(0.05, 0.92, 0.05, C.white, x, y, fz + 0.55);
    board(k, 'ARMOURY R&D', 1.0, 0.18, 0, y + STOREY * 3 - 0.36, fz + 0.1, TEAL, '#ffffff');
    for (const x of [-0.8, 0.0]) k.aircon(x, y + h, bz - 0.4);
    k.antenna(bx + 1.0, y + h, bz - 0.5, 0.6);
    blueprintTable(k, 0.3, 1.12, y, 0, 0.5, 0.34, 1);
    station(k, -1.0, 1.05, y, 0, { seed: 2, top: '#e8e6e0' });
    rack(k, 1.15, 0.85, y, -Math.PI / 2, 4, TEAL);
    porter(k, -0.55, fz, 1.25, y);
    sentry(k, 0.95, 1.05, y, face(0, 1));
    return;
  }
  if (level === 12) {
    // Twin lab: two white towers with green roofs bridged by glass, one research bay each
    const bz = -0.4, tw = 1.12, td = 1.85;
    for (const s of [-1, 1]) labBlock(k, s * 0.86, bz, tw, td, 3, y, { tilt: s * 0.2 });
    // Central strongroom between the towers
    k.box(0.62, STOREY * 2, td - 0.25, CONCRETE, 0, y, bz - 0.1);
    k.box(0.68, 0.1, td - 0.2, C.roofGreen, 0, y + STOREY * 2, bz - 0.1);
    const fz = bz + td / 2 - 0.1;
    strongDoor(k, 'round', 0, y + 0.06, fz, 0.5, 0.5, { hinge: -1, inner: HOLO, color: '#e8e6e0' });
    k.box(0.62, 0.05, 0.04, TEAL, 0, y + 0.66, fz + 0.03);
    statusLight(k, 0, y + 0.75, fz);
    // Glass sky-bridge
    k.box(0.62, 0.55, 0.7, '#86b7cc', 0, y + STOREY * 2 + 0.2, bz + 0.2).material = M('#86b7cc', { transparent: true, opacity: 0.75 });
    k.box(0.64, 0.05, 0.72, TEAL, 0, y + STOREY * 2 + 0.75, bz + 0.2);
    const lz = bz + td / 2 + 0.03;
    for (const s of [-1, 1]) {
      strongDoor(k, 'slide', s * 0.86 - 0.15, y, lz, 0.45, 0.68, { color: '#e8e6e0', inner: HOLO });
      board(k, s < 0 ? 'BAY 1' : 'BAY 2', 0.5, 0.16, s * 0.86, y + STOREY * 3 - 0.36, lz + 0.08, TEAL);
      station(k, s * 0.86, 1.08, y, 0, { seed: s < 0 ? 1 : 2, top: '#e8e6e0' });
      k.aircon(s * 0.86, y + STOREY * 3 + 0.1, bz - 0.5);
    }
    testStand(k, 0.33, 0.82, y, 0.1, HOLO, 0.4);
    porter(k, 0, fz, 0.7, y);
    sentry(k, -0.35, 1.15, y, face(0, 1));
    rack(k, 0.33, 1.28, y, 0, 3, TEAL);
    return;
  }
  if (level === 13) {
    // Hologram lab: tall lab with a two-storey wing whose roof carries a big hologram projector
    const ax = -0.55, az = -0.45, aw = 1.75, ad = 1.75;
    labBlock(k, ax, az, aw, ad, 3, y);
    const wx = 0.85, wz = -0.25, ww = 1.15, wd = 1.75;
    const wh = labBlock(k, wx, wz, ww, wd, 2, y, { fins: false });
    k.box(ww - 0.2, 0.08, 0.04, HOLO, wx, y + 0.3, wz + wd / 2 + 0.02).material = glow(HOLO, 0.8);
    hologram(k, wx, y + wh, wz, 2.0);
    const fz = az + ad / 2 + 0.03;
    strongDoor(k, 'slide', -0.85, y, fz, 0.6, 0.74, { color: '#e8e6e0', inner: HOLO });
    k.box(0.62, 0.05, 0.03, TEAL, -0.85, y + 0.78, fz + 0.06);
    statusLight(k, -0.85, y + 0.84, fz);
    board(k, 'ARMOURY R&D', 1.0, 0.18, ax, y + STOREY * 3 - 0.36, fz + 0.1, TEAL, '#ffffff');
    k.box(1.4, 0.07, 0.55, C.white, -0.5, y + 0.92, fz + 0.26);
    k.box(1.42, 0.03, 0.57, TEAL, -0.5, y + 0.9, fz + 0.26);
    for (const x of [-1.15, 0.15]) k.box(0.05, 0.92, 0.05, C.white, x, y, fz + 0.5);
    blueprintTable(k, 0.85, 1.05, y, 0, 0.5, 0.34, 1);
    station(k, -0.2, 1.08, y, 0, { seed: 2, top: '#e8e6e0' });
    porter(k, -0.85, fz, 1.25, y);
    sentry(k, -1.3, 1.0, y, face(0, 1));
    rack(k, 1.3, 0.85, y, -Math.PI / 2, 3, TEAL);
    k.aircon(ax, y + STOREY * 3 + 0.1, az - 0.5);
    return;
  }
  if (level === 14) {
    // Test dome: lab block plus a big white observatory-style test dome with a glowing slit that turns
    const ax = -0.62, az = -0.45, aw = 1.65, ad = 1.8;
    const ah = labBlock(k, ax, az, aw, ad, 3, y);
    const dx = 0.78, dz = -0.15, dr = 0.72, dh = 1.95;
    k.cyl(dr, dh, WHITE, dx, y, dz, 20);
    k.cyl(dr + 0.02, 0.14, '#d7d3c8', dx, y, dz, 20);
    k.cyl(dr + 0.03, 0.08, TEAL, dx, y + dh - 0.08, dz, 20);
    for (const f of [1]) k.cyl(dr + 0.02, 0.06, TEAL, dx, y + f * STOREY, dz, 20);
    const cap = new THREE.Group();
    cap.position.set(dx, y + dh, dz);
    const dm = mesh(new THREE.SphereGeometry(dr, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(WHITE));
    dm.scale.y = 0.85;
    cap.add(dm);
    const slit = mesh(new THREE.BoxGeometry(0.18, 0.1, dr * 1.1), glow(HOLO, 1.3), 0, dr * 0.55, dr * 0.45);
    slit.rotation.x = -0.75;
    cap.add(slit);
    cap.add(mesh(new THREE.TorusGeometry(dr * 0.72, 0.03, 6, 24).rotateX(Math.PI / 2), glow(HOLO, 1.2), 0, dr * 0.45, 0));
    k.add(cap);
    k.anims.push((t) => (cap.rotation.y = t * 0.25));
    // Test chamber window in the drum
    k.box(0.5, 0.5, 0.05, '#1f2326', dx, y + 0.3, dz + dr - 0.03);
    k.box(0.44, 0.44, 0.03, HOLO, dx, y + 0.33, dz + dr).material = ghost(HOLO, 0.45, 0.8);
    const spin = new THREE.Group();
    spin.position.set(dx, y + 0.55, dz + dr - 0.12);
    k.add(spin);
    gear(k, spin, 0, 0, 0, 0.13, HOLO, 'z', 2.5, 8);
    const fz = az + ad / 2 + 0.03;
    strongDoor(k, 'slide', -0.9, y, fz, 0.6, 0.74, { color: '#e8e6e0', inner: HOLO });
    statusLight(k, -0.9, y + 0.84, fz);
    board(k, 'ARMOURY R&D', 1.0, 0.18, ax, y + STOREY * 3 - 0.36, fz + 0.1, TEAL, '#ffffff');
    hologram(k, ax + 0.35, y + ah, az - 0.1, 1.0);
    blueprintTable(k, 0.1, 1.05, y, 0, 0.5, 0.34, 1);
    station(k, 0.95, 1.05, y, 0, { seed: 2, top: '#e8e6e0' });
    station(k, -1.05, 1.1, y, 0, { seed: 3, top: '#e8e6e0' });
    porter(k, -0.9, fz, 0.75, y);
    sentry(k, -0.4, 0.75, y, face(0, 1));
    rack(k, 1.32, 0.5, y, -Math.PI / 2, 3, TEAL);
    return;
  }
  // 15: research spire: wide lab block, test dome, glass lobby with a hologram, slim spire with an orbiting ring
  const ax = -0.25, az = -0.75, aw = 2.5, ad = 1.25;
  const ah = labBlock(k, ax, az, aw, ad, 3, y);
  const dx = 0.85, dz = 0.08, dr = 0.55, dh = 1.4;
  k.cyl(dr, dh, WHITE, dx, y, dz, 20);
  k.cyl(dr + 0.03, 0.08, TEAL, dx, y + dh - 0.08, dz, 20);
  const cap = new THREE.Group();
  cap.position.set(dx, y + dh, dz);
  const dm = mesh(new THREE.SphereGeometry(dr, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(WHITE));
  dm.scale.y = 0.85;
  cap.add(dm);
  const slit = mesh(new THREE.BoxGeometry(0.15, 0.1, dr * 1.1), glow(HOLO, 1.3), 0, dr * 0.55, dr * 0.45);
  slit.rotation.x = -0.75;
  cap.add(slit);
  k.add(cap);
  k.anims.push((t) => (cap.rotation.y = t * 0.25));
  const fz = az + ad / 2 + 0.03;
  strongDoor(k, 'round', 0.15, y + 0.06, fz, 0.6, 0.6, { hinge: 1, inner: HOLO, color: '#e8e6e0' });
  k.box(0.75, 0.05, 0.04, TEAL, 0.15, y + 0.76, fz + 0.03);
  statusLight(k, 0.15, y + 0.85, fz);
  board(k, 'ARMOURY R&D', 1.0, 0.18, ax + 0.4, y + STOREY * 3 - 0.36, fz + 0.1, TEAL, '#ffffff');
  hologram(k, ax + 0.75, y + ah, az - 0.1, 0.9);
  // Teal glass rotunda tower on the front left, green dome, spire with an orbiting ring
  const sx = -0.88, sz = 0.2, sr = 0.5, sh = STOREY * 2.5;
  k.cyl(sr + 0.04, 0.14, C.white, sx, y, sz, 16);
  k.cyl(sr, sh, '#5fd6c8', sx, y + 0.14, sz, 16).material = M('#5fd6c8', { emissive: HOLO, emissiveIntensity: 0.3, roughness: 0.3 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.box(0.035, sh, 0.035, C.white, sx + Math.cos(a) * (sr + 0.005), y + 0.14, sz + Math.sin(a) * (sr + 0.005));
  }
  for (let f = 1; f <= 2; f++) k.cyl(sr + 0.03, 0.06, C.white, sx, y + 0.14 + f * STOREY - 0.03, sz, 16);
  k.cyl(sr + 0.08, 0.08, C.white, sx, y + 0.14 + sh, sz, 16);
  dome(k, sr + 0.02, sx, y + 0.22 + sh, sz, C.roofGreen, 0.55);
  k.box(0.5, 0.65, 0.04, '#e8e6e0', sx + 0.1, y, sz + sr - 0.02); // lobby door
  k.box(0.04, 0.6, 0.05, TEAL, sx + 0.1, y, sz + sr + 0.0);
  const sy = y + 0.22 + sh + (sr + 0.02) * 0.55 - 0.04;
  k.cyl(0.05, 0.85, C.white, sx, sy, sz, 8, 0.015);
  const ring = new THREE.Group();
  ring.position.set(sx, sy + 0.45, sz);
  ring.add(mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 20), glow(HOLO, 1.3)));
  k.add(ring);
  k.anims.push((t) => {
    ring.rotation.y = t * 1.1;
    ring.rotation.x = 1.2 + Math.sin(t * 0.8) * 0.3;
  });
  k.blinker(sx, sy + 0.85, sz, '#ff3b30', 0.03);
  k.aircon(ax + 0.6, y + ah, az - 0.3);
  station(k, 0.78, 1.1, y, 0, { seed: 2, top: '#e8e6e0' });
  blueprintTable(k, -0.85, 1.08, y, 0, 0.5, 0.34, 1);
  porter(k, 0.15, fz, 0.6, y);
  sentry(k, -0.2, 1.1, y, face(0, 1));
  rack(k, -0.2, 0.5, y, 0, 3, TEAL);
}

// ------------------------------------------------------------------ secure (16–20)

function secure(k: Kit, level: number, y: number) {
  if (level === 16) {
    // Hardened lab: gunmetal armoured block, huge sliding blast door with a scan bar, sensor mast
    const bx = -0.05, bz = -0.42, bw = 2.65, bd = 1.8, bh = STOREY * 2.85;
    armourBlock(k, bx, bz, bw, bd, bh, y);
    slits(k, 4, 2.0, bx, y + STOREY * 2 + 0.3, bz + bd / 2 + 0.01, HOLO);
    slits(k, 4, 2.0, bx, y + STOREY + 0.3, bz + bd / 2 + 0.01);
    const fz = bz + bd / 2 + 0.04;
    strongDoor(k, 'blast', -0.45, y, fz, 0.8, 0.9, { inner: HOLO });
    scanBar(k, -0.45, y, fz + 0.15, 0.8, 0.9);
    statusLight(k, -0.45, y + 1.02, fz);
    board(k, 'ARMOURY', 0.9, 0.18, 0.3, y + STOREY + 0.6, fz + 0.01, ARMOUR, HAZ);
    cctv(k, bx - bw / 2 + 0.1, y + 1.3, fz, 0.4);
    cctv(k, bx + bw / 2 - 0.1, y + 1.3, fz, -0.4);
    k.solarPanels(bx - 0.4, y + bh + 0.14, bz, 1.2, 0.8);
    hazard(k, bw + 0.12, 0.1, bx, y + bh + 0.04, bz + bd / 2 + 0.07, false, 0.18);
    // Leaning armour shields either side of the blast door
    for (const sx of [-1.1, 1.0]) {
      const sh = k.box(0.42, bh * 0.82, 0.12, ARMOUR, sx, y, fz + 0.22);
      sh.rotation.x = -0.14;
      k.box(0.44, 0.06, 0.13, HAZ, sx, y + bh * 0.8, fz + 0.1).rotation.x = -0.14;
    }
    sensorMast(k, bx + 0.85, bz - 0.2, y + bh + 0.14, 0.9);
    station(k, 0.75, 1.05, y, 0, { seed: 2, top: '#8b949a', legs: '#4a4f54', lamp: HOLO });
    porter(k, -0.45, fz, 1.25, y, '#33383d');
    sentry(k, -1.15, 0.9, y, face(0, 1));
    rack(k, 1.3, 0.45, y, -Math.PI / 2, 3, ARMOUR);
    for (const x of [-1.3, 1.3]) k.cyl(0.07, 0.3, HAZ, x, y, 1.25, 8);
    return;
  }
  if (level === 17) {
    // Bunker vault: grass-covered berm with a concrete portal and blast door, test chamber cupola on top
    const bz = -0.35;
    const berm = mesh(new THREE.CylinderGeometry(1.15, 1.85, 1.3, 4, 1).rotateY(Math.PI / 4), M(GRASS), 0, y + 0.65, bz);
    berm.scale.set(1.0, 1, 0.82);
    k.add(berm);
    const top = y + 1.3;
    k.box(1.6, 0.06, 1.3, '#4f9a2c', 0, top, bz);
    for (const [x, z] of [[-1.05, 0.35], [1.1, 0.3], [-0.9, -1.2], [1.0, -1.15]]) {
      const b = mesh(new THREE.IcosahedronGeometry(0.16, 0), M(i2c(x)), x, y + 0.2, z);
      b.scale.y = 0.8;
      k.add(b);
    }
    // Research block on the berm
    const rb = 1.4;
    k.box(rb, STOREY * 1.3, 1.1, GUNMETAL, 0, top, bz - 0.05);
    k.box(rb + 0.1, 0.12, 1.2, ARMOUR, 0, top + STOREY * 1.3, bz - 0.05);
    hazard(k, rb, 0.06, 0, top + STOREY * 1.3 - 0.08, bz + 0.51);
    slits(k, 3, 0.9, 0, top + 0.6, bz + 0.51, HOLO);
    testChamberMini(k, -0.3, bz - 0.1, top + STOREY * 1.3 + 0.12, 0.36, HOLO);
    sensorMast(k, 0.45, bz - 0.3, top + STOREY * 1.3 + 0.12, 0.55);
    // Portal pushing out of the berm
    const pz = bz + 0.85, pw = 1.2;
    k.box(pw, 1.25, 0.75, CONCRETE, 0, y, pz - 0.15);
    k.box(pw + 0.1, 0.12, 0.8, ARMOUR, 0, y + 1.25, pz - 0.15);
    for (const s of [-1, 1]) {
      const wing = k.box(0.12, 0.9, 0.7, CONCRETE, s * (pw / 2 + 0.2), y, pz - 0.05);
      wing.rotation.y = s * 0.5;
    }
    const fz = pz + 0.23;
    strongDoor(k, 'blast', -0.08, y, fz, 0.72, 0.85, { inner: HOLO });
    scanBar(k, -0.08, y, fz + 0.15, 0.72, 0.85);
    statusLight(k, 0, y + 0.98, fz);
    board(k, 'ARMOURY', 0.75, 0.16, 0, y + 1.05, fz + 0.03, ARMOUR, HAZ);
    cctv(k, -0.55, y + 1.15, fz, 0.5);
    station(k, -0.95, 1.12, y, 0, { seed: 2, top: '#8b949a', legs: '#4a4f54', lamp: HOLO });
    blueprintTable(k, 0.98, 1.12, y, 0, 0.5, 0.34, 1);
    porter(k, -0.08, fz, 1.28, y, '#33383d');
    sentry(k, 0.55, 1.1, y, face(0, 1));
    rack(k, -1.25, 0.45, y, Math.PI / 2, 3, ARMOUR);
    k.sandbags(1.1, 0.35, 0.5, Math.PI / 2, y, 2);
    return;
  }
  if (level === 18) {
    // Triple vault: three armoured research pods round a central command block, one armourer per slot
    const top = podium(k, 2.85, 2.6, y, 0.3, CONCRETE, 0, -0.15);
    steps(k, 0, 1.25, 0.8, y, 0.3);
    const cz = -0.65;
    armourBlock(k, 0, cz, 1.1, 1.05, STOREY * 2.75, top, GUNMETAL);
    slits(k, 2, 0.6, 0, top + STOREY * 2.4, cz + 0.54, HOLO);
    sensorMast(k, 0.25, cz - 0.2, top + STOREY * 2.75 + 0.14, 0.4);
    const fz = cz + 0.56;
    strongDoor(k, 'blast', 0, top, fz, 0.6, 0.8, { inner: HOLO });
    scanBar(k, 0, top, fz + 0.15, 0.6, 0.8);
    statusLight(k, 0, top + 0.92, fz);
    const pods: [number, number, string][] = [[-0.92, -0.3, '#ff5a4a'], [0.92, -0.3, '#ffb020']];
    for (const [px, pz, c] of pods) {
      k.cyl(0.5, STOREY * 2.3, ARMOUR, px, top, pz, 10);
      k.cyl(0.52, 0.1, HAZ, px, top + 0.22, pz, 10);
      k.cyl(0.53, 0.14, GUNMETAL, px, top + STOREY * 2.3, pz, 10);
      k.cyl(0.4, 0.2, c, px, top + STOREY * 2.3 + 0.14, pz, 10).material = glow(c, 0.9);
      k.cyl(0.44, 0.06, GUNMETAL, px, top + STOREY * 2.3 + 0.34, pz, 10);
      strongDoor(k, 'round', px, top + 0.05, pz + 0.49, 0.46, 0.46, { inner: c, hinge: px < 0 ? -1 : 1, color: '#9aa3a8' });
    }
    // Third pod rides on the rear of the command block's roof as a glowing teal vault drum
    k.cyl(0.4, 0.3, ARMOUR, -0.1, top + STOREY * 2.75 + 0.14, cz + 0.05, 10);
    k.cyl(0.34, 0.14, HOLO, -0.1, top + STOREY * 2.75 + 0.44, cz + 0.05, 10).material = glow(HOLO, 1);
    k.cyl(0.38, 0.05, ARMOUR, -0.1, top + STOREY * 2.75 + 0.58, cz + 0.05, 10);
    station(k, -0.85, 0.75, top, 0, { seed: 1, top: '#8b949a', legs: '#4a4f54', lamp: '#ff5a4a', jig: '#ff5a4a' });
    station(k, 0.85, 0.75, top, 0, { seed: 2, top: '#8b949a', legs: '#4a4f54', lamp: '#ffb020', jig: '#ffb020' });
    station(k, 0, 0.42, top, 0, { seed: 3, top: '#8b949a', legs: '#4a4f54', lamp: HOLO, jig: HOLO, len: 0.5 });
    sentry(k, -0.55, 1.2, y, face(0, 1));
    sentry(k, 0.55, 1.2, y, face(0, 1), 5);
    cctv(k, -0.55, top + 1.6, fz, 0.4);
    board(k, 'ARMOURY', 0.75, 0.16, 0, top + 1.0, fz + 0.03, ARMOUR, HAZ);
    return;
  }
  if (level === 19) {
    // Scanner vault: hardened block wrapped by a rotating sensor ring, laser scan arch over the door path
    const top = podium(k, 2.85, 2.6, y, 0.3, CONCRETE, 0, -0.15);
    steps(k, -0.3, 1.25, 0.8, y, 0.3);
    const bx = 0, bz = -0.55, bw = 2.3, bd = 1.45, bh = STOREY * 2.6;
    const h = armourBlock(k, bx, bz, bw, bd, bh, top, GUNMETAL);
    slits(k, 4, 1.8, bx, top + STOREY * 2 + 0.25, bz + bd / 2 + 0.01, '#ff5a4a');
    // Sensor ring on stand-offs around the roof, with pods
    const ring = new THREE.Group();
    ring.position.set(bx, top + h + 0.25, bz);
    ring.add(mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 32).rotateX(Math.PI / 2), M('#f4f4f0')));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pod = mesh(new THREE.SphereGeometry(0.14, 10, 8), glow(i % 2 ? '#ff5a4a' : HOLO, 1.2), Math.cos(a) * 0.95, 0.02, Math.sin(a) * 0.95);
      ring.add(pod);
    }
    k.add(ring);
    k.cyl(0.14, 0.25, '#e8e6e0', bx, top + h, bz, 8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = mesh(new THREE.BoxGeometry(0.95, 0.05, 0.05), M('#f4f4f0'), Math.cos(a) * 0.47, 0, Math.sin(a) * 0.47);
      arm.rotation.y = -a;
      ring.add(arm);
    }
    k.anims.push((t) => (ring.rotation.y = t * 0.6));
    const fz = bz + bd / 2 + 0.04;
    strongDoor(k, 'blast', -0.3, top, fz, 0.8, 0.9, { inner: '#ff5a4a' });
    statusLight(k, -0.3, top + 1.02, fz);
    board(k, 'ARMOURY', 0.75, 0.16, 0.65, top + STOREY + 0.5, fz + 0.01, ARMOUR, HAZ);
    // Laser scan arch over the porter's path
    const az = 0.75;
    for (const s of [-1, 1]) k.box(0.1, 1.0, 0.12, '#33383d', -0.3 + s * 0.42, top, az);
    k.box(0.94, 0.1, 0.14, '#33383d', -0.3, top + 1.0, az);
    for (let i = 0; i < 3; i++) {
      const beam = mesh(new THREE.BoxGeometry(0.74, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.8 }), -0.3, top + 0.25 + i * 0.25, az);
      k.add(beam);
      k.anims.push((t) => {
        const o = openAt(cyc(t));
        beam.visible = o < 0.3;
        beam.position.y = top + 0.25 + i * 0.25 + Math.sin(t * 2 + i) * 0.06;
      });
    }
    scanBar(k, -0.3, top, fz + 0.15, 0.8, 0.9, HOLO);
    station(k, 0.75, 0.9, top, 0, { seed: 2, top: '#8b949a', legs: '#4a4f54', lamp: '#ff5a4a', jig: '#ff5a4a' });
    station(k, -1.05, 0.55, top, Math.PI / 2, { seed: 1, top: '#8b949a', legs: '#4a4f54', lamp: HOLO, jig: HOLO, len: 0.55 });
    porter(k, -0.3, fz, 1.05, top, '#33383d');
    sentry(k, 0.25, 1.22, y, face(0, 1));
    sentry(k, -0.95, 1.22, y, face(0, 1), 5);
    sensorMast(k, 1.25, 0.95, top, 1.3);
    cctv(k, bx - bw / 2 + 0.1, top + 1.4, fz, 0.4);
    return;
  }
  // 20: gold vault: octagonal armoured keep with gold bands, a giant gold vault door and a gold hologram crown
  const top = podium(k, 2.9, 2.75, y, 0.32, '#e2ddd2', 0, -0.1);
  hazard(k, 2.9, 0.0, 0, top, 1.28);
  k.box(2.92, 0.04, 2.77, GOLD, 0, top - 0.04, -0.1);
  steps(k, 0, 1.3, 0.9, y, 0.32);
  const kx = 0, kz = -0.45, kr = 1.12, kh = STOREY * 2.3;
  const keep = mesh(new THREE.CylinderGeometry(kr, kr, kh, 8).rotateY(Math.PI / 8), M(GUNMETAL), kx, top + kh / 2, kz);
  k.add(keep);
  for (const yy of [0.2, STOREY * 1.4, kh - 0.12]) k.add(mesh(new THREE.CylinderGeometry(kr + 0.03, kr + 0.03, 0.08, 8).rotateY(Math.PI / 8), M(GOLD, { metalness: 0.4, roughness: 0.45 }), kx, top + yy, kz));
  // Armour buttresses
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.5) continue; // leave the front clear for the door
    const b = k.box(0.16, kh * 0.85, 0.22, ARMOUR, kx + Math.cos(a) * (kr + 0.04), top, kz + Math.sin(a) * (kr + 0.04));
    b.rotation.y = -a;
  }
  // Crown: gold-trimmed drum and an eight-sided gold roof
  const ct = top + kh;
  k.add(mesh(new THREE.CylinderGeometry(kr + 0.1, kr + 0.1, 0.12, 8).rotateY(Math.PI / 8), M(ARMOUR), kx, ct + 0.06, kz));
  const gd = mesh(new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(GOLD, { metalness: 0.4, roughness: 0.45 }), kx, ct + 0.12, kz);
  gd.scale.y = 0.55;
  k.add(gd);
  for (let i = 0; i < 8; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.955, 0.025, 4, 12, Math.PI / 2), M('#fff0a8'), kx, ct + 0.12, kz);
    rib.rotation.set(0, (i / 8) * Math.PI * 2, 0);
    rib.scale.set(1, 0.55, 1);
    k.add(rib);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.1, 0.1, 0.1, GOLD, kx + Math.cos(a) * (kr + 0.02), ct + 0.12, kz + Math.sin(a) * (kr + 0.02));
  }
  hologram(k, kx, ct + 0.62, kz, 0.8, '#ffd84a', GOLD);
  slits(k, 2, 1.2, kx, top + STOREY * 2.1, kz + kr * 0.92 + 0.01, '#ffd84a', 0.25, 0.08);
  // Giant gold vault door in a gold frame
  const fz = kz + kr * Math.cos(Math.PI / 8) + 0.02;
  k.box(1.2, 1.25, 0.12, ARMOUR, kx, top, fz - 0.04);
  strongDoor(k, 'gold', kx, top + 0.08, fz + 0.02, 0.96, 0.96, { hinge: 1, inner: '#ffd84a' });
  statusLight(k, kx, top + 1.12, fz + 0.04);
  board(k, 'ARMOURY', 0.85, 0.16, kx, top + 1.3, fz + 0.02, ARMOUR, GOLD, 0, GOLD);
  // Gold-capped sensor pylons at the front corners
  for (const s of [-1, 1]) {
    k.box(0.22, 1.5, 0.22, GUNMETAL, s * 1.22, top, 0.55);
    k.box(0.26, 0.08, 0.26, GOLD, s * 1.22, top + 1.5, 0.55);
    const eye = new THREE.Group();
    eye.position.set(s * 1.22, top + 1.62, 0.55);
    eye.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), M('#e8e6e0')));
    eye.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8).rotateZ(Math.PI / 2), glow('#ff3b30', 1.2), 0.1, 0, 0));
    k.add(eye);
    k.anims.push((t) => (eye.rotation.y = Math.sin(t * 0.5 + s) * 1.2 - Math.PI / 2));
  }
  station(k, 0.75, 1.0, top, 0, { seed: 2, top: '#e8e6e0', legs: GOLD, lamp: '#ffd84a', jig: GOLD });
  station(k, -0.8, 1.0, top, 0, { seed: 1, top: '#e8e6e0', legs: GOLD, lamp: HOLO, jig: HOLO });
  porter(k, kx, fz + 0.02, 1.05, top, GOLD);
  sentry(k, -0.62, 1.28, y, face(0, 1));
  sentry(k, 0.62, 1.28, y, face(0, 1), 5);
  k.flagpole(-1.25, -1.2, 1.6, top);
  cctv(k, kx - 0.6, top + 1.5, fz - 0.15, 0.5);
}

const i2c = (x: number) => (x > 0 ? '#3f8a2e' : '#55a832');

/** Small glowing test cupola for roofs. */
function testChamberMini(k: Kit, x: number, z: number, y: number, r: number, glowC: string) {
  k.cyl(r, 0.35, ARMOUR, x, y, z, 12);
  const glass = mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.3, 12, 1, true), ghost(glowC, 0.4, 1), x, y + 0.5, z);
  k.add(glass);
  const part = new THREE.Group();
  part.position.set(x, y + 0.5, z);
  k.add(part);
  gear(k, part, 0, 0, 0, r * 0.45, glowC, 'y', 2.2, 8);
  dome(k, r * 0.9, x, y + 0.65, z, GUNMETAL, 0.6);
}

// ------------------------------------------------------------------ assembly

export function buildArmoury(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const ARMOURY: BuildingDef = {
  id: 'armoury',
  name: 'Armoury',
  role: 'Researches upgrades for defences and troop kit. Higher levels open higher research tiers, research faster and add research slots.',
  footprint: [3, 3],
  unlockHq: 9,
  levels: ARMOURY_LEVELS,
  designedLevels: 20,
  build: buildArmoury,
};
