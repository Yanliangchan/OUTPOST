import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, Kit, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Mortar Pit: splash damage lobbed at ground raiders. Signature at every level:
 * a dug-in circular pit (sandbag ring → timber revetment → cream bay → concrete
 * ring → white ring → armoured casemate) with a short, steep mortar tube in the
 * centre, ready ammo and bomb racks, and a loader who drops a bomb down the
 * muzzle, ducks and covers his ears on a loop. Later levels add twin tubes, a
 * semi-automatic turret mortar, a turntable with a robot loader arm and a
 * hardened casemate with sliding magazine hatches. The tube is held at a fixed
 * steep elevation (`lob`); only the yaw tracks. Footprint 3×3; stays low
 * (bulk ≤ ~2.5 storeys) and grows by coverage and detail.
 */

const TITLES = [
  'Shell Scrape', 'Sandbag Pit', 'Revetted Pit', 'Mortar Bay', 'Fire-Post Bay', 'Twin-Tube Bay',
  'Concrete Pit', 'Heavy Mortar Pit', 'Fire-Direction Pit', 'Mortar Battery', 'Turret Mortar', 'Autoloader Turret',
  'Met-Station Turret', 'Turntable Mortar', 'Mortar Rotunda', 'Hardened Casemate', 'Armoured Casemate', 'Drone-Spotted Casemate',
  'Twin-Turret Casemate', 'Citadel Mortar',
];
const nice = (v: number) => {
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / p) * p;
};
const SUPPLIES = TITLES.map((_, i) => nice(25_000 * Math.pow(1.33, i)));
const REPUTATION = TITLES.map((_, i) => nice(1_200 * Math.pow(1.16, i)));
const TIME = [3 * HOUR, 4 * HOUR, 5 * HOUR, 6 * HOUR, 8 * HOUR, 10 * HOUR, 12 * HOUR, 15 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4.25 * DAY, 5 * DAY, 6 * DAY, 7 * DAY];
const TUBES = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4];

export const MORTAR_PIT_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const damage = Math.round(20 * Math.pow(1.2, i));
  const range = Math.round((10 + (i * 2) / 19) * 10) / 10;
  const splash = Math.round((1.5 + Math.floor(i / 5) * 0.1) * 10) / 10;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((900 * Math.pow(1.2, i)) / 10) * 10,
    stats: { damage, splash, range, minRange: 3, reload: 4, tubes: TUBES[i] },
    unlocks: [`${damage} splash damage (${splash}-tile radius) every 4 s`, `Range ${range} tiles (3-tile dead zone)`, `${TUBES[i]} tube${TUBES[i] > 1 ? 's' : ''}`],
  };
});

// ------------------------------------------------------------------ palette

const LOB = 1.0;
/** Crew scale: big enough to read next to the fat cartoon barrels. */
const CS = 1.25;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const DIRT_D = '#8a6440';
const EARTH = '#b08a5c';
const GRASS = '#6fb24a';
const GRASS_D = '#5a9a3c';
const BAG = ['#cdb98a', '#c2ad7e', '#d8c699', '#b8a274'];
const TIMBER = '#8a6038';
const LOGC = '#7a5634';
const GUN = '#3f4a2c';
const GUN_D = '#2c3320';
const STEEL = '#5c6166';
const STEEL_D = '#41464b';
const HAZ = '#f2c230';
const TEAL = '#2bb3a3';
const ARMOUR = '#6a6f5e';
const ARMOUR_D = '#545947';
const RED = '#d8342c';
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const sm = (u: number) => {
  const v = Math.min(1, Math.max(0, u));
  return v * v * (3 - 2 * v);
};
const cyc = (t: number, p: number, off = 0) => ((((t + off) % p) + p) % p) / p;
/** Heading that turns a part built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
/** Point on a circle by compass angle φ (0 = front/+z, π/2 = right/+x). */
const P = (phi: number, r: number): [number, number] => [r * Math.sin(phi), r * Math.cos(phi)];

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mesh(k: Kit, geo: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  return k.add(m, parent);
}

/** Cylinder between two points. */
function strut(k: Kit, parent: THREE.Object3D | undefined, a: THREE.Vector3, b: THREE.Vector3, r: number, color: string, sides = 5) {
  const d = V().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), sides), mat(color));
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return k.add(m, parent);
}

/** Lathe ring wall (optionally with a gap centred on compass angle `gapAt`). */
function ring(k: Kit, rIn: number, rOut: number, h: number, y: number, color: string, gap = 0, gapAt = 0, profile: 'wall' | 'berm' = 'wall', seg = 32, parent?: THREE.Object3D) {
  const pts = profile === 'berm'
    ? [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut - (rOut - rIn) * 0.45, h), new THREE.Vector2(rIn + (rOut - rIn) * 0.15, h), new THREE.Vector2(rIn, h * 0.5), new THREE.Vector2(rIn, 0)]
    : [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
  const geo = new THREE.LatheGeometry(pts, seg, gapAt + gap / 2, Math.PI * 2 - gap);
  const m = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide }));
  m.position.y = y;
  return k.add(m, parent);
}

function disc(k: Kit, r: number, h: number, color: string, x: number, y: number, z: number, seg = 28, parent?: THREE.Object3D) {
  return mesh(k, new THREE.CylinderGeometry(r, r, h, seg).translate(0, h / 2, 0), color, x, y, z, parent);
}

// ------------------------------------------------------------------ sandbags (merged per colour)

class Bags {
  private readonly list: { m: THREE.Matrix4; c: number }[] = [];
  private readonly r: () => number;
  constructor(seed: number, private readonly size = 1) {
    this.r = rng(seed);
  }
  add(x: number, y: number, z: number, ry: number, big = 1) {
    const r = this.r;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.08, ry + (r() - 0.5) * 0.14, (r() - 0.5) * 0.07));
    const s = V((0.92 + r() * 0.16) * big, 0.88 + r() * 0.22, (0.94 + r() * 0.12) * big);
    this.list.push({ m: new THREE.Matrix4().compose(V(x, y + 0.05 * this.size, z), q, s), c: Math.floor(r() * BAG.length) });
  }
  /** A ring of bags around the origin, skipping a gap centred on compass angle gapAt. */
  ring(r: number, layers: number, y: number, gap = 0, gapAt = 0, cx = 0, cz = 0) {
    for (let l = 0; l < layers; l++) {
      const rr = r - l * 0.02 * this.size;
      const n = Math.max(6, Math.round((2 * Math.PI * rr) / (0.25 * this.size)));
      for (let i = 0; i < n; i++) {
        const phi = ((i + (l % 2) * 0.5) / n) * Math.PI * 2;
        const dphi = Math.atan2(Math.sin(phi - gapAt), Math.cos(phi - gapAt));
        if (gap && Math.abs(dphi) < gap / 2) continue;
        const [x, z] = P(phi, rr);
        this.add(cx + x, y + l * 0.095 * this.size, cz + z, phi);
      }
    }
  }
  line(x: number, z: number, len: number, ry: number, y: number, layers = 2) {
    const n = Math.max(1, Math.round(len / 0.26));
    for (let l = 0; l < layers; l++) for (let i = 0; i < n - (l % 2); i++) {
      const t = -len / 2 + 0.13 + i * 0.26 + (l % 2) * 0.13;
      this.add(x + Math.cos(ry) * t, y + l * 0.095, z - Math.sin(ry) * t, ry);
    }
  }
  flush(k: Kit, parent?: THREE.Object3D) {
    const z = this.size;
    const base = new RoundedBoxGeometry(0.26 * z, 0.11 * z, 0.16 * z, 1, 0.035 * z);
    BAG.forEach((c, ci) => {
      const geos = this.list.filter((b) => b.c === ci).map((b) => base.clone().applyMatrix4(b.m));
      if (geos.length) mesh(k, mergeGeometries(geos)!, c, 0, 0, 0, parent);
    });
  }
}

// ------------------------------------------------------------------ signs & stencils

const texCache = new Map<string, THREE.MeshStandardMaterial>();
function textMat(text: string, bg: string, fg: string, font = 40, w = 256, h = 64, border?: string) {
  const key = [text, bg, fg, font, w, h, border].join('|');
  let m = texCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
  }
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  texCache.set(key, m);
  return m;
}

/** Flat sign board with lettering on its front (+z) face, base at y. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, parent?: THREE.Object3D) {
  const side = mat(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, textMat(text, bg, fg, 40, 256, Math.round((256 * h) / w), fg), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m, parent);
}

function signPost(k: Kit, text: string, x: number, z: number, y: number, rotY = 0, bg = RED, w = 0.5, h = 0.18, postH = 0.42, post = TIMBER) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-1, 1]) k.box(0.035, postH + h, 0.035, post, s * (w / 2 - 0.04), 0, -0.02, g);
  board(k, text, w, h, 0, postH, 0, bg, '#ffffff', 0, g);
  return k.add(g);
}

/** Ammo box with a stencil on the lid and front. */
function ammoBox(k: Kit, x: number, y: number, z: number, ry = 0, color = OLIVE, w = 0.3, h = 0.13, d = 0.18, text = 'HE', parent?: THREE.Object3D) {
  const side = mat(color);
  const st = textMat(text, color, '#f2e3a0', 34, 128, 64);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, st, side, st, side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  k.add(m, parent);
  // Rope handles and a darker lid seam
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, 0.012, d + 0.006), mat('#2f3a22'));
  seam.position.set(0, h * 0.3, 0);
  m.add(seam);
  return m;
}

/** Timber crate stack (with stencils). */
function crateStack(k: Kit, x: number, y: number, z: number, ry: number, n: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const spots: [number, number, number][] = [[0, 0, 0], [0.32, 0, 0.02], [0.16, 0.14, 0.0], [-0.32, 0, -0.02], [-0.16, 0.14, 0.01], [0, 0.28, 0]];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [dx, dy, dz] = spots[i];
    ammoBox(k, dx, dy, dz, ((i + seed) % 3 - 1) * 0.06, (i + seed) % 3 === 2 ? '#7a6a3a' : OLIVE, 0.3, 0.14, 0.2, (i + seed) % 2 ? 'HE' : 'SMK', g);
  }
  return k.add(g);
}

// ------------------------------------------------------------------ bombs

let BOMB: { body: THREE.BufferGeometry; band: THREE.BufferGeometry } | null = null;
function bombGeos() {
  if (!BOMB) {
    const body = new THREE.SphereGeometry(0.034, 8, 6);
    body.scale(1, 1.9, 1);
    body.translate(0, 0.035, 0);
    const tail = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6).translate(0, -0.04, 0);
    const f1 = new THREE.BoxGeometry(0.06, 0.04, 0.006).translate(0, -0.06, 0);
    const f2 = new THREE.BoxGeometry(0.006, 0.04, 0.06).translate(0, -0.06, 0);
    BOMB = {
      body: mergeGeometries([body.toNonIndexed(), tail.toNonIndexed(), f1.toNonIndexed(), f2.toNonIndexed()])!,
      band: new THREE.CylinderGeometry(0.0355, 0.0355, 0.014, 8).translate(0, 0.05, 0),
    };
  }
  return BOMB;
}

/** A mortar bomb standing nose-up (≈0.18 long), origin at its middle. */
function bomb(k: Kit, parent?: THREE.Object3D, color = GUN, band = HAZ, s = 1) {
  const g = new THREE.Group();
  const b = bombGeos();
  g.add(new THREE.Mesh(b.body, mat(color)), new THREE.Mesh(b.band, mat(band)));
  g.scale.setScalar(s);
  return k.add(g, parent);
}

/** Timber A-frame rack of bombs standing nose-up. */
function bombRack(k: Kit, x: number, y: number, z: number, ry: number, n = 6, frame = TIMBER, parent?: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const w = n * 0.085 + 0.06;
  for (const s of [-1, 1]) {
    k.box(0.03, 0.26, 0.03, frame, s * w / 2, 0, -0.06, g);
    k.box(0.03, 0.26, 0.03, frame, s * w / 2, 0, 0.06, g);
  }
  k.box(w + 0.04, 0.025, 0.16, frame, 0, 0.04, 0, g);
  k.box(w + 0.04, 0.025, 0.16, frame, 0, 0.17, 0, g);
  for (let i = 0; i < n; i++) {
    const b = bomb(k, g);
    b.position.set(-w / 2 + 0.07 + i * 0.085, 0.14, 0);
  }
  return k.add(g, parent);
}

// ------------------------------------------------------------------ people

interface Look { shirt: string; pants: string; helmet: string | null; ears?: string; vest?: string; beret?: string }
const FIELD: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#4f5c33', vest: '#6b6a3e' };
const CAMP: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#4f5c33', ears: '#f2c230' };
const BASE: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#47542e', ears: '#f2c230', vest: '#3e4a2a' };
const CMD: Look = { shirt: '#5f7448', pants: '#3f4d30', helmet: '#3f4a2c', ears: TEAL, vest: '#33402a' };
const SEC: Look = { shirt: '#4a5240', pants: '#33382d', helmet: '#2a2e2a', ears: '#e8e6e0', vest: '#2a2e2a' };
const OFFICER: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: null, beret: '#2a3326' };

interface Crew { root: THREE.Group; torso: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group }

/** ~0.6-tall low-poly crewman facing +x; torso bends at the hips, arms pivot at the shoulders. */
function crew(k: Kit, seed: number, look: Look, parent?: THREE.Object3D): Crew {
  const root = new THREE.Group();
  const put = (geo: THREE.BufferGeometry, c: string, x: number, y: number, z: number, p: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
  const limb = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);
  const skin = SKIN[seed % SKIN.length];
  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0, 0.26, s * 0.045);
    put(limb(0.065, 0.22, 0.065), look.pants, 0, 0, 0, g);
    put(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, g);
    root.add(g);
    return g;
  });
  const torso = new THREE.Group();
  torso.position.y = 0.26;
  root.add(torso);
  put(new THREE.BoxGeometry(0.12, 0.2, 0.17), look.shirt, 0, 0.1, 0, torso);
  put(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.01, 0, torso);
  if (look.vest) put(new THREE.BoxGeometry(0.135, 0.11, 0.18), look.vest, 0, 0.12, 0, torso);
  put(new THREE.IcosahedronGeometry(0.062, 0), skin, 0, 0.26, 0, torso);
  if (look.helmet) {
    put(new THREE.SphereGeometry(0.074, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), look.helmet, 0, 0.27, 0, torso);
    put(new THREE.CylinderGeometry(0.084, 0.084, 0.012, 8), look.helmet, 0, 0.27, 0, torso);
  }
  if (look.beret) put(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), look.beret, -0.005, 0.315, 0.01, torso).rotation.x = 0.2;
  if (look.ears) for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.035, 0.045, 0.025), look.ears, 0, 0.255, s * 0.066, torso);
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0, 0.19, s * 0.105);
    put(limb(0.05, 0.18, 0.05), look.shirt, 0, 0, 0, g);
    put(new THREE.BoxGeometry(0.045, 0.04, 0.045), skin, 0, -0.19, 0, g);
    torso.add(g);
    return g;
  });
  root.scale.setScalar(CS);
  k.add(root, parent);
  return { root, torso, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1] };
}

/** Hand position (torso space) for an arm swung forward by θ. */
const hand = (th: number) => V(0.2 * Math.sin(th), 0.19 - 0.2 * Math.cos(th), 0);

function kneel(f: Crew, e: number, y: number) {
  f.root.position.y = y - 0.1 * CS * e;
  f.legL.rotation.z = 0.9 * e;
  f.legR.rotation.z = -0.9 * e;
}

function walkPose(f: Crew, ph: number, amp = 0.5) {
  const s = Math.sin(ph);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.7;
  f.armR.rotation.z = s * amp * 0.7;
}

interface Drop { parent: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; rot: number }

/**
 * The loader: lifts a bomb over the muzzle (or into a feed tray), lets it go,
 * ducks with his hands over his ears, stands, turns for the next round.
 */
function loader(k: Kit, parent: THREE.Object3D, foot: THREE.Vector3, rotY: number, reach: number, look: Look, seed: number, drop: Drop | null, period = 4.4, offset = 0, turn = 1.2) {
  const f = crew(k, seed, look, parent);
  f.root.position.copy(foot);
  f.root.rotation.y = rotY;
  const hb = bomb(k, f.torso);
  const db = drop ? bomb(k, drop.parent) : null;
  if (db) {
    db.rotation.z = drop!.rot;
    db.visible = false;
  }
  const rest = 0.55;
  k.anims.push((t) => {
    const u = cyc(t, period, offset);
    let th = rest, lean = -0.08, duck = 0, tn = 0, hold = true;
    if (u < 0.26) {
      const e = sm(u / 0.26);
      th = rest + (reach - rest) * e;
      lean = -0.08 - 0.14 * e;
    } else if (u < 0.36) {
      th = reach;
      lean = -0.22;
      hold = u < 0.31;
    } else if (u < 0.45) {
      const e = sm((u - 0.36) / 0.09);
      duck = e;
      th = reach + (2.75 - reach) * e;
      lean = -0.22 - 0.3 * e;
      hold = false;
    } else if (u < 0.68) {
      duck = 1;
      th = 2.75 + Math.sin(t * 14) * 0.04;
      lean = -0.52;
      hold = false;
    } else if (u < 0.78) {
      const e = sm((u - 0.68) / 0.1);
      duck = 1 - e;
      th = 2.75 + (0.25 - 2.75) * e;
      lean = -0.52 + 0.44 * e;
      hold = false;
    } else if (u < 0.9) {
      const e = sm((u - 0.78) / 0.08);
      tn = e * turn;
      th = 0.25 + Math.max(0, (u - 0.84) / 0.06) * 0.3;
      lean = -0.08 - 0.25 * sm((u - 0.8) / 0.06) * (1 - sm((u - 0.86) / 0.04));
      hold = u > 0.86;
    } else {
      tn = (1 - sm((u - 0.9) / 0.1)) * turn;
      th = rest;
    }
    kneel(f, duck, foot.y);
    f.torso.rotation.z = lean;
    f.armL.rotation.z = th;
    f.armR.rotation.z = th;
    f.root.rotation.y = rotY + tn;
    hb.visible = hold;
    hb.position.copy(hand(th));
    hb.position.y -= 0.02;
    hb.rotation.z = -lean;
    if (db) {
      const v = u >= 0.31 && u < 0.4;
      db.visible = v;
      if (v) db.position.lerpVectors(drop!.from, drop!.to, Math.pow((u - 0.31) / 0.09, 2));
    }
  });
  return f;
}

/** A kneeling or standing spotter who raises binoculars, scans and points. */
function spotter(k: Kit, x: number, y: number, z: number, rotY: number, look: Look, seed: number, kneeling = true, parent?: THREE.Object3D) {
  const f = crew(k, seed, look, parent);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  kneel(f, kneeling ? 1 : 0, y);
  const bino = new THREE.Group();
  for (const s of [-1, 1]) mesh(k, new THREE.CylinderGeometry(0.018, 0.02, 0.06, 6).rotateZ(Math.PI / 2), '#2a2b2d', 0, 0, s * 0.025, bino);
  f.torso.add(bino);
  k.anims.push((t) => {
    const c = cyc(t, 9, seed * 2.3);
    const up = c < 0.6 ? sm(c / 0.08) : 1 - sm((c - 0.6) / 0.08);
    const th = 0.45 + up * 1.85;
    f.armL.rotation.z = th;
    f.armR.rotation.z = c > 0.74 && c < 0.92 ? 1.6 + Math.sin(t * 3) * 0.08 : th;
    bino.position.copy(hand(th)).add(V(0.02, 0.025, 0));
    bino.visible = up > 0.3;
    f.torso.rotation.y = Math.sin(t * 0.45 + seed) * 0.35;
  });
  return f;
}

/** A crewman carrying a bomb from A to B and walking back (fades in/out at a doorway A). */
function bearer(k: Kit, a: THREE.Vector3, b: THREE.Vector3, look: Look, seed: number, period = 9, offset = 0, hideAtA = true) {
  const f = crew(k, seed, look);
  const hb = bomb(k, f.torso);
  const out = face(b.x - a.x, b.z - a.z), back = face(a.x - b.x, a.z - b.z);
  k.anims.push((t) => {
    const u = cyc(t, period, offset);
    let p = 0, rot = out, walking = false, carry = true;
    if (u < 0.1) p = 0;
    else if (u < 0.42) (p = sm((u - 0.1) / 0.32)), (walking = true);
    else if (u < 0.55) (p = 1), (carry = u < 0.5);
    else if (u < 0.88) (p = 1 - sm((u - 0.55) / 0.33)), (walking = true), (rot = back), (carry = false);
    else (p = 0), (rot = back), (carry = false);
    f.root.position.lerpVectors(a, b, p);
    f.root.rotation.y = rot;
    if (walking) walkPose(f, t * 9, 0.45);
    else walkPose(f, 0);
    const th = carry ? (u >= 0.42 && u < 0.55 ? 1.0 + Math.sin(((u - 0.42) / 0.13) * Math.PI) * 0.3 : 0.75) : walking ? f.armL.rotation.z : 0;
    if (carry) {
      f.armL.rotation.z = th;
      f.armR.rotation.z = th;
      f.torso.rotation.z = u >= 0.42 ? -0.35 : -0.05;
    } else f.torso.rotation.z = 0;
    hb.visible = carry;
    hb.position.copy(hand(th));
    if (hideAtA) f.root.visible = u > 0.06 && u < 0.94;
  });
  return { fig: f, open: (t: number) => {
    const u = cyc(t, period, offset);
    return u < 0.16 ? 1 - sm((u - 0.1) / 0.06) * 0 : u > 0.84 ? 1 : u < 0.2 ? 1 - sm((u - 0.16) / 0.04) : u > 0.8 ? sm((u - 0.8) / 0.04) : 0;
  } };
}


// ------------------------------------------------------------------ small animated props

function pennant(k: Kit, x: number, z: number, y: number, h = 0.7, color = RED) {
  k.cyl(0.012, h, TIMBER, x, y, z, 4);
  const g = new THREE.Group();
  g.position.set(x, y + h - 0.02, z);
  const tri = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -0.12, 0), V(0.22, -0.06, 0)]);
  tri.computeVertexNormals();
  mesh(k, tri, mat(color, { side: THREE.DoubleSide }), 0.01, 0, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = 0.6 + Math.sin(t * 2.3 + x) * 0.45;
    g.rotation.x = Math.sin(t * 5.1 + z) * 0.12;
  });
}

/** Red range flag on a tall pole ("live firing"), waving. */
function rangeFlag(k: Kit, x: number, z: number, y: number, h = 1.6, color = RED, pole = '#c9a36a') {
  k.cyl(0.02, h, pole, x, y, z, 5);
  const g = new THREE.Group();
  g.position.set(x, y + h - 0.04, z);
  const segs = 3;
  let parent: THREE.Object3D = g;
  const parts: THREE.Object3D[] = [];
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Group();
    s.position.x = i === 0 ? 0.01 : 0.13;
    mesh(k, new THREE.BoxGeometry(0.13, 0.24 - i * 0.03, 0.008).translate(0.065, -0.12 + i * 0.015, 0), color, 0, 0, 0, s);
    parent.add(s);
    parts.push(s);
    parent = s;
  }
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = 0.7 + Math.sin(t * 0.7 + x) * 0.5;
    parts.forEach((p, i) => (p.rotation.y = Math.sin(t * 5 - i * 1.1 + z) * 0.35));
  });
}

/** Hurricane lantern hanging from a post, swinging. */
function lantern(k: Kit, x: number, z: number, y: number, h = 0.62, seed = 0) {
  k.box(0.04, h, 0.04, TIMBER, x, y, z);
  k.box(0.16, 0.03, 0.03, TIMBER, x + 0.06, y + h - 0.03, z);
  const g = new THREE.Group();
  g.position.set(x + 0.12, y + h - 0.03, z);
  mesh(k, new THREE.BoxGeometry(0.005, 0.06, 0.005), '#33383d', 0, -0.03, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.032, 0.036, 0.07, 6), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 0.9, flatShading: true }), 0, -0.1, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.01, 0.04, 0.03, 6), '#7a1f1a', 0, -0.05, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 2.1 + seed) * 0.25;
    g.rotation.x = Math.sin(t * 1.3 + seed) * 0.12;
  });
}

/** Breathing camouflage net draped over four poles. */
function camoNet(k: Kit, x: number, z: number, w: number, d: number, y: number, h: number, ry = 0, seed = 3, poles = true, pole = TIMBER) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  if (poles) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, h, 0.035, pole, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), g);
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(w + 0.2, d + 0.2, 6, 5).rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2 + 0.1), v = pos.getZ(i) / (d / 2 + 0.1);
    const edge = Math.max(Math.abs(u), Math.abs(v));
    pos.setY(i, -0.09 * Math.cos(u * Math.PI * 0.5) * Math.cos(v * Math.PI * 0.5) - (edge > 0.95 ? 0.1 : 0) + (r() - 0.5) * 0.04);
  }
  geo.computeVertexNormals();
  const net = new THREE.Group();
  net.position.y = h + 0.02;
  mesh(k, geo, mat('#56663a', { side: THREE.DoubleSide }), 0, 0, 0, net);
  const cols = ['#6b7a3e', '#8a7a4a', '#46552c', '#7c8c46'];
  for (let i = 0; i < 26; i++) {
    const s = mesh(k, new THREE.BoxGeometry(0.1 + r() * 0.08, 0.012, 0.08 + r() * 0.06), cols[i % 4], (r() - 0.5) * w, 0.005 - r() * 0.05, (r() - 0.5) * d, net);
    s.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
  }
  g.add(net);
  k.add(g);
  k.anims.push((t) => {
    net.scale.y = 1 + Math.sin(t * 1.1 + seed) * 0.35;
    net.position.y = h + 0.02 + Math.sin(t * 1.1 + seed) * 0.012;
    net.rotation.z = Math.sin(t * 0.8 + seed) * 0.015;
  });
  return g;
}

/** Red/white aiming stakes planted out front. */
function aimingStakes(k: Kit, x: number, z: number, y: number, n = 2, dx = 0.2, dz = 0.12) {
  for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) k.box(0.025, 0.1, 0.025, j % 2 ? '#ffffff' : RED, x + i * dx, y + j * 0.1, z + i * dz);
}

function fieldPhone(k: Kit, x: number, z: number, y: number, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  k.box(0.14, 0.09, 0.1, '#4b5a3a', 0, 0, 0, g);
  k.box(0.1, 0.03, 0.035, '#2a2b2d', 0, 0.09, 0, g);
  k.box(0.02, 0.05, 0.02, '#2a2b2d', 0.08, 0.03, 0.03, g);
  return k.add(g);
}

function jerrycan(k: Kit, x: number, z: number, y: number, ry = 0, color = '#4b5a3a') {
  const m = k.box(0.08, 0.16, 0.13, color, x, y, z);
  m.rotation.y = ry;
  k.box(0.02, 0.03, 0.05, C.dark, x, y + 0.16, z - 0.03);
}

/** Spinning-cup anemometer with a wind vane on a mast. */
function metMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.cyl(0.025, h, C.white, x, y, z, 6);
  for (let i = 1; i < 4; i++) k.box(0.12, 0.012, 0.012, C.white, x, y + (h * i) / 4, z);
  const cups = new THREE.Group();
  cups.position.set(x, y + h + 0.04, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = mesh(k, new THREE.BoxGeometry(0.16, 0.01, 0.01), C.metal, Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, cups);
    arm.rotation.y = -a;
    mesh(k, new THREE.SphereGeometry(0.03, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2), C.white, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, cups);
  }
  k.add(cups);
  const vane = new THREE.Group();
  vane.position.set(x, y + h - 0.12, z);
  mesh(k, new THREE.BoxGeometry(0.26, 0.012, 0.012), C.metal, 0, 0, 0, vane);
  mesh(k, new THREE.BoxGeometry(0.08, 0.07, 0.006), RED, -0.12, 0, 0, vane);
  mesh(k, new THREE.ConeGeometry(0.02, 0.05, 5).rotateZ(-Math.PI / 2), C.metal, 0.14, 0, 0, vane);
  k.add(vane);
  k.anims.push((t) => {
    cups.rotation.y = t * 7;
    vane.rotation.y = 0.8 + Math.sin(t * 0.5) * 0.4 + Math.sin(t * 2.3) * 0.08;
  });
}

/** Gently bobbing tethered weather balloon. */
function balloon(k: Kit, x: number, z: number, y: number, h: number) {
  k.box(0.14, 0.08, 0.14, C.white, x, y, z);
  const g = new THREE.Group();
  g.position.set(x, y + 0.08, z);
  const line = mesh(k, new THREE.BoxGeometry(0.006, 1, 0.006).translate(0, 0.5, 0), '#e8e6e0', 0, 0, 0, g);
  line.scale.y = h;
  const b = mesh(k, new THREE.IcosahedronGeometry(0.15, 1), '#f7f5ef', 0, h + 0.12, 0, g);
  b.scale.y = 1.15;
  mesh(k, new THREE.BoxGeometry(0.05, 0.05, 0.05), '#ff8a3d', 0, h - 0.05, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 0.6) * 0.08;
    g.rotation.x = Math.sin(t * 0.43 + 1) * 0.06;
  });
}

/** Red siren-style warning beacon that spins (amber at the secure band). */
function beacon(k: Kit, x: number, y: number, z: number, color = '#ff9a1f') {
  k.cyl(0.05, 0.04, C.dark, x, y, z, 8);
  const dome = mesh(k, new THREE.CylinderGeometry(0.04, 0.045, 0.07, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, flatShading: true }), x, y + 0.075, z);
  const vane = mesh(k, new THREE.BoxGeometry(0.06, 0.05, 0.012), glow('#fff2c0', 1.2), x, y + 0.075, z);
  k.anims.push((t) => {
    vane.rotation.y = t * 6;
    ((dome as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 6)) * 1.2;
  });
}

/** Pulsing status lamp with its own material. */
function pulse(k: Kit, w: number, h: number, d: number, color: string, x: number, y: number, z: number, speed = 2, parent?: THREE.Object3D) {
  const m = mesh(k, new THREE.BoxGeometry(w, h, d), glow(color, 0.8), x, y, z, parent);
  const off = x * 3 + z;
  k.anims.push((t) => ((m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + (Math.sin(t * speed + off) * 0.5 + 0.5) * 1.1));
  return m;
}

/** Panning CCTV camera on a pole. */
function cctv(k: Kit, x: number, z: number, y: number, h = 1.0, base = 0) {
  k.cyl(0.022, h, '#4a4f54', x, y, z, 5);
  const cam = new THREE.Group();
  cam.position.set(x, y + h, z);
  k.box(0.15, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0, cam);
  k.box(0.03, 0.045, 0.045, '#33383d', 0.135, 0.012, 0, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.45 + x + z) * 0.8));
}

/** Simple sub-kit placed and turned as a unit (its animations are merged in). */
function sub(k: Kit, x: number, y: number, z: number, ry: number, fn: (s: Kit) => void) {
  const s = new Kit();
  fn(s);
  s.group.position.set(x, y, z);
  s.group.rotation.y = ry;
  k.add(s.group);
  k.anims.push(...s.anims);
  return s;
}

// ------------------------------------------------------------------ structures

/** Yellow/black painted kerb ring round the weapon plinth. */
function plinth(k: Kit, r: number, y: number, h = 0.06) {
  disc(k, r, h, '#c9c3b5', 0, y, 0, 24);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const [px, pz] = P(((i + 0.5) / n) * Math.PI * 2, r - 0.02);
    const m = k.box(0.2, h + 0.01, 0.05, i % 2 ? C.kerbB : C.kerbY, px, y, pz);
    m.rotation.y = ((i + 0.5) / n) * Math.PI * 2;
  }
  return y + h;
}

/** Small red-roofed ammo hut whose door swings open for the bearer. */
function ammoHut(k: Kit, x: number, z: number, y: number, ry: number, open: (t: number) => number, w = 0.6, d = 0.52, roof: string = C.roof) {
  sub(k, x, y, z, ry, (s) => {
    s.block(w, d, 0.68, 0, 0, 0);
    s.hipRoof(w, d, 0.34, 0, 0.646, 0, roof, 0.12);
    const hinge = new THREE.Group();
    hinge.position.set(-0.12, 0, d / 2 + 0.02);
    s.box(0.24, 0.46, 0.035, C.trim, 0.12, 0, 0, hinge);
    s.box(0.03, 0.03, 0.04, '#d8c26a', 0.2, 0.22, 0.01, hinge);
    s.add(hinge);
    s.box(0.32, 0.03, 0.06, C.white, 0, 0.48, d / 2 + 0.02);
    board(s, 'AMMO', 0.24, 0.08, 0, 0.52, d / 2 + 0.025, RED);
    s.anims.push((t) => (hinge.rotation.y = -open(t) * 1.6));
  });
}

/** Grass-roofed concrete ready-ammo bunker with a sliding steel blast door. */
function readyBunker(k: Kit, x: number, z: number, y: number, ry: number, w = 0.9, d = 0.55, h = 0.5, period = 8) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, CONCRETE, 0, 0, 0);
    s.box(w + 0.1, 0.08, d + 0.1, '#bdb8ad', 0, h, 0);
    const mound = mesh(s, new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), GRASS, 0, h + 0.06, 0);
    mound.scale.set(w * 0.95, 0.32, d * 1.6);
    s.box(0.42, 0.42, 0.02, '#2a2e2a', 0, 0.04, d / 2 + 0.005);
    const door = s.box(0.42, 0.42, 0.04, '#5c6166', 0, 0.04, d / 2 + 0.03);
    for (let i = 0; i < 3; i++) s.box(0.4, 0.02, 0.045, '#8a9196', 0, 0.1 + i * 0.12, 0, door).position.set(0, -0.12 + i * 0.12, 0.002);
    s.box(0.56, 0.03, 0.03, '#33383d', 0, 0.47, d / 2 + 0.035);
    for (let i = 0; i < 5; i++) s.box(0.1, 0.04, 0.012, i % 2 ? C.kerbB : HAZ, -0.2 + i * 0.1, 0.5, d / 2 + 0.01);
    s.anims.push((t) => {
      const u = cyc(t, period, 0.5);
      door.position.x = (u < 0.15 ? sm(u / 0.15) : u < 0.55 ? 1 : 1 - sm((u - 0.55) / 0.15)) * 0.4;
    });
  });
}

/** Tripod stereo rangefinder with a slowly traversing bar. */
function rangefinder(k: Kit, x: number, z: number, y: number, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    strut(k, undefined, V(x + Math.cos(a) * 0.14, y, z + Math.sin(a) * 0.14), V(x, y + 0.42, z), 0.012, STEEL_D);
  }
  const head = new THREE.Group();
  head.position.set(x, y + 0.44, z);
  mesh(k, new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8).rotateZ(Math.PI / 2), '#4b5a3a', 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(k, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), '#2f3a22', s * 0.31, 0, 0, head);
  mesh(k, new THREE.BoxGeometry(0.08, 0.07, 0.08), '#2f3a22', 0, 0.02, 0.03, head);
  k.add(head);
  k.anims.push((t) => (head.rotation.y = 0.8 + Math.sin(t * 0.3 + seed) * 0.7));
}

/** Davit hoist: post and jib that swings in over the pit and lowers a crate on a chain. */
function davit(k: Kit, x: number, z: number, y: number, h: number, jib: number, inward: number, period = 10) {
  k.cyl(0.05, h, '#d8b24a', x, y, z, 8);
  k.box(0.2, 0.06, 0.2, STEEL_D, x, y, z);
  const arm = new THREE.Group();
  arm.position.set(x, y + h, z);
  k.box(jib + 0.08, 0.06, 0.06, HAZ, jib / 2 - 0.04, 0, 0, arm);
  strut(k, arm, V(0, -0.28, 0), V(jib * 0.6, 0, 0), 0.015, HAZ);
  for (let i = 0; i < 4; i++) k.box(0.05, 0.065, 0.065, C.kerbB, 0.05 + i * (jib / 4), 0, 0, arm);
  const chain = mesh(k, new THREE.BoxGeometry(0.012, 1, 0.012).translate(0, -0.5, 0), '#33383d', jib - 0.02, -0.02, 0, arm);
  const hook = new THREE.Group();
  hook.position.set(jib - 0.02, 0, 0);
  ammoBox(k, 0, -0.14, 0, 0, OLIVE, 0.2, 0.12, 0.14, 'HE', hook);
  for (const s of [-1, 1]) strut(k, hook, V(s * 0.08, -0.02, 0), V(0, 0.08, 0), 0.005, '#33383d', 3);
  arm.add(hook);
  k.add(arm);
  k.anims.push((t) => {
    const u = cyc(t, period);
    const swing = u < 0.2 ? sm(u / 0.2) : u < 0.65 ? 1 : 1 - sm((u - 0.65) / 0.2);
    const drop = u < 0.25 ? 0 : u < 0.4 ? sm((u - 0.25) / 0.15) : u < 0.55 ? 1 : u < 0.68 ? 1 - sm((u - 0.55) / 0.13) : 0;
    arm.rotation.y = inward - 1.3 + swing * 1.3;
    const L = 0.2 + drop * (h - 0.42);
    chain.scale.y = L;
    hook.position.y = -L - 0.02;
    hook.rotation.y = Math.sin(t * 1.7) * 0.2;
    hook.visible = !(u > 0.47 && u < 0.53) || true;
  });
}

/** Concrete crew shelter with a sandbag parapet on the roof and a dark doorway facing the pit. */
function shelter(k: Kit, x: number, z: number, y: number, ry: number, w: number, d: number, h: number, seed: number) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, CONCRETE, 0, 0, 0);
    s.box(w + 0.08, 0.06, d + 0.08, '#bdb8ad', 0, h, 0);
    s.box(0.3, 0.5, 0.02, '#1d2326', 0, 0, d / 2 + 0.005);
    s.box(0.36, 0.05, 0.05, C.trim, 0, 0.5, d / 2 + 0.02);
    s.box(w - 0.16, 0.05, 0.02, '#1d2326', 0, h - 0.22, -d / 2 - 0.005);
    board(s, 'CREW', 0.22, 0.08, 0.3, 0.3, d / 2 + 0.02, C.trim);
    const b = new Bags(seed);
    b.line(0, -d / 2 + 0.1, w - 0.05, 0, h + 0.06, 2);
    b.line(-w / 2 + 0.1, 0, d - 0.25, Math.PI / 2, h + 0.06, 2);
    b.line(w / 2 - 0.1, 0, d - 0.25, Math.PI / 2, h + 0.06, 2);
    b.flush(s);
    s.antenna(w / 2 - 0.1, h + 0.06, d / 2 - 0.12, 0.6);
  });
}

/** Glass control kiosk with fins and a green roof (screens pulse inside). */
function kiosk(k: Kit, x: number, z: number, y: number, ry: number, w: number, d: number, h: number, storeys = 1) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, 0.12, d, C.white, 0, 0, 0);
    s.glassBox(w - 0.06, h, d - 0.06, 0, 0.12, 0);
    if (storeys > 1) {
      s.box(w + 0.04, 0.08, d + 0.04, C.white, 0, 0.12 + h, 0);
      s.box(w, h * 0.8, d, C.white, 0, 0.2 + h, 0);
      s.box(w - 0.2, 0.18, 0.02, DARK_GLASS, 0, 0.32 + h, d / 2 + 0.005);
      s.fins(w - 0.1, h * 0.8, 0, 0.2 + h, d / 2 + 0.06, 6);
    }
    const top = 0.12 + h + (storeys > 1 ? 0.08 + h * 0.8 : 0);
    s.box(w + 0.16, 0.07, d + 0.16, C.roofGreen, 0, top, 0);
    s.box(w + 0.18, 0.03, d + 0.18, C.white, 0, top - 0.02, 0);
    pulse(s, w * 0.5, 0.14, 0.02, '#5fe0d0', 0, 0.3, -d / 2 + 0.06, 1.7);
    s.aircon(w / 2 + 0.05, 0.14, -0.05, Math.PI / 2);
  });
}

/** Hovering tethered spotter drone with spinning rotors. */
function drone(k: Kit, x: number, z: number, y: number, h: number, gold = false) {
  const g = new THREE.Group();
  g.position.set(x, y + h, z);
  k.box(0.2, 0.06, 0.2, '#2a2e2a', 0, 0, 0, g);
  k.box(0.08, 0.05, 0.08, gold ? GOLD : '#4a4f54', 0, -0.05, 0, g);
  mesh(k, new THREE.SphereGeometry(0.03, 6, 4), DARK_GLASS, 0.03, -0.07, 0, g);
  const props: THREE.Object3D[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const a = k.box(0.18, 0.02, 0.025, '#2a2e2a', dx * 0.09, 0.02, dz * 0.09, g);
    a.rotation.y = Math.atan2(dz, dx) * -1;
    disc(k, 0.025, 0.03, '#33383d', dx * 0.15, 0.02, dz * 0.15, 6, g);
    const p = mesh(k, new THREE.BoxGeometry(0.18, 0.006, 0.025), '#9aa3a6', dx * 0.15, 0.06, dz * 0.15, g);
    props.push(p);
  }
  const led = mesh(k, new THREE.BoxGeometry(0.03, 0.02, 0.03), glow('#3fd16b', 1), -0.1, 0.03, 0, g);
  k.add(g);
  const tether = mesh(k, new THREE.BoxGeometry(0.006, 1, 0.006).translate(0, 0.5, 0), '#e8e6e0', x, y, z);
  k.anims.push((t) => {
    g.position.set(x + Math.sin(t * 0.5) * 0.12, y + h + Math.sin(t * 1.3) * 0.05, z + Math.cos(t * 0.37) * 0.1);
    g.rotation.y = t * 0.3;
    g.rotation.z = Math.sin(t * 0.5) * 0.06;
    props.forEach((p, i) => (p.rotation.y = t * 40 + i));
    tether.scale.y = g.position.y - y;
    tether.position.set(x, y, z);
    tether.rotation.z = -(g.position.x - x) / h;
    tether.rotation.x = (g.position.z - z) / h;
    ((led as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5) > 0 ? 1.5 : 0.2;
  });
}

/** Electro-optical sensor ball on a mast, slewing. */
function sensorBall(k: Kit, x: number, z: number, y: number, h: number, gold = false) {
  k.cyl(0.04, h, '#4a4f54', x, y, z, 6);
  const head = new THREE.Group();
  head.position.set(x, y + h + 0.1, z);
  mesh(k, new THREE.SphereGeometry(0.1, 10, 8), gold ? GOLD : '#e8e6e0', 0, 0, 0, head);
  mesh(k, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8).rotateZ(Math.PI / 2), DARK_GLASS, 0.09, 0.0, -0.03, head);
  mesh(k, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateZ(Math.PI / 2), '#ff3b30', 0.09, 0.0, 0.04, head);
  k.box(0.14, 0.05, 0.14, '#4a4f54', x, y + h, z);
  k.add(head);
  k.anims.push((t) => {
    head.rotation.y = Math.sin(t * 0.4) * 1.6;
    head.rotation.z = Math.sin(t * 0.7) * 0.2 - 0.1;
  });
}


/** Grassed earth berm hugging the outside of the pit. */
function berm(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number) {
  ring(k, rIn, rOut, h, y, GRASS_D, gap, gapAt, 'berm', 36);
}

/** Acoustic sensor mast: a cluster of horns that turns slowly. */
function acousticMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.cyl(0.03, h, '#4a4f54', x, y, z, 6);
  const head = new THREE.Group();
  head.position.set(x, y + h, z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const horn = mesh(k, new THREE.CylinderGeometry(0.05, 0.015, 0.14, 8).rotateZ(-Math.PI / 2), '#d5d9dc', Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, head);
    horn.rotation.y = -a;
  }
  disc(k, 0.04, 0.06, '#33383d', 0, -0.03, 0, 6, head);
  k.add(head);
  k.anims.push((t) => (head.rotation.y = t * 0.6 + x));
}

// ------------------------------------------------------------------ the weapon: a big, fat cartoon barrel

interface Tube { g: THREE.Group; len: number; z: number; o: number; r: number }
interface Rig { yaw: THREE.Group; pitch: THREE.Group; tubes: Tube[]; px: number; py: number }
interface Barrel { len: number; r: number; color: string; band: string; bands: number; lip: string; lash?: boolean; spring?: string }

function newRig(k: Kit, x: number, y: number, z: number, px: number, py: number, parent?: THREE.Object3D): Rig {
  const yaw = new THREE.Group();
  yaw.position.set(x, y, z);
  const pitch = new THREE.Group();
  pitch.position.set(px, py, 0);
  pitch.rotation.z = LOB;
  yaw.add(pitch);
  k.add(yaw, parent);
  return { yaw, pitch, tubes: [], px, py };
}

/** A stubby barrel along +x from the pivot: breech ball, reinforcing bands, wide muzzle lip, dark bore. */
function addBarrel(k: Kit, rig: Rig, b: Barrel, z = 0, o = 0): Tube {
  const g = new THREE.Group();
  g.position.set(0, o, z);
  rig.pitch.add(g);
  const { len, r } = b;
  mesh(k, new THREE.CylinderGeometry(r, r * 1.18, len, 14).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0), b.color, 0, 0, 0, g);
  mesh(k, new THREE.CylinderGeometry(r * 1.34, r * 1.3, 0.1, 14).rotateZ(-Math.PI / 2), b.lip, len - 0.05, 0, 0, g);
  mesh(k, new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.01, 14).rotateZ(-Math.PI / 2), '#141618', len + 0.002, 0, 0, g);
  mesh(k, new THREE.SphereGeometry(r * 1.3, 12, 8), b.lip, 0, 0, 0, g);
  for (let i = 0; i < b.bands; i++) {
    const f = b.bands === 1 ? 0.3 : 0.2 + (i / (b.bands - 1)) * 0.5;
    mesh(k, new THREE.CylinderGeometry(r * 1.2, r * 1.2, Math.max(0.05, r * 0.45), 14).rotateZ(-Math.PI / 2), b.band, len * f, 0, 0, g);
  }
  if (b.lash) {
    // Timber slats lashed round the middle with rope
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(k, new THREE.BoxGeometry(len * 0.3, 0.04, 0.05), TIMBER, len * 0.55, Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, g).rotation.x = a;
    }
    for (const f of [0.44, 0.66]) mesh(k, new THREE.CylinderGeometry(r * 1.28, r * 1.28, 0.03, 12).rotateZ(-Math.PI / 2), '#d8c48a', len * f, 0, 0, g);
  }
  if (b.spring) {
    // Recoil spring housing slung under the barrel
    const sy = -r * 1.55;
    mesh(k, new THREE.CylinderGeometry(r * 0.42, r * 0.42, len * 0.55, 10).rotateZ(-Math.PI / 2), '#33383d', len * 0.42, sy, 0, g);
    for (let i = 0; i < 7; i++) mesh(k, new THREE.TorusGeometry(r * 0.5, r * 0.1, 5, 12).rotateY(Math.PI / 2), b.spring, len * 0.2 + i * len * 0.075, sy, 0, g);
    for (const f of [0.18, 0.68]) mesh(k, new THREE.BoxGeometry(0.06, r * 1.4, r * 0.9), '#33383d', len * f, sy * 0.55, 0, g);
  }
  const m = new THREE.Object3D();
  m.position.x = len;
  g.add(m);
  const t: Tube = { g, len, z, o, r };
  rig.tubes.push(t);
  return t;
}

/** Muzzle mouth (plus `e` along the bore) in yaw space. */
const mouth = (rig: Rig, t: Tube, e = 0) => {
  const L = t.len + e, c = Math.cos(LOB), s = Math.sin(LOB);
  return V(rig.px + L * c - t.o * s, rig.py + L * s + t.o * c, t.z);
};

function registerRig(k: Kit, rig: Rig, level: number, seed = 0, sweep = 0.8, base = 0.5) {
  const yaw = rig.yaw, pitch = rig.pitch;
  k.turret({
    yaw, pitch,
    muzzles: rig.tubes.map((t) => t.g.children[t.g.children.length - 1]),
    recoil: rig.tubes.map((t) => t.g),
    weapon: 'mortar', targets: 'ground', rate: 0.25, lob: LOB,
    turnRate: 0.9 + level * 0.06, kick: 0.06 + Math.min(0.06, rig.tubes[0].r * 0.3),
    idle: (t) => {
      yaw.rotation.y = base + Math.sin(t * 0.21 + seed) * sweep + Math.sin(t * 0.083 + seed * 2) * sweep * 0.6;
      pitch.rotation.z = LOB + Math.sin(t * 0.55 + seed) * 0.015;
    },
  });
}

/** Barrels laid out in the pitch group: in a row (z) or a 2×2 square. */
function barrels(k: Kit, rig: Rig, b: Barrel, n: number, layout: 'row' | 'square' = 'row') {
  const gap = b.r * 2.7;
  if (layout === 'square') for (const o of [-1, 1]) for (const z of [-1, 1]) addBarrel(k, rig, b, (z * gap) / 2, (o * gap) / 2);
  else for (let i = 0; i < n; i++) addBarrel(k, rig, b, (i - (n - 1) / 2) * gap);
}

/** Field mount: a chunky baseplate under the breech and a fat bipod to a yoke round the barrel(s). */
function bipodMount(k: Kit, rig: Rig, plate: string, legs: string, plateR: number) {
  const Y = rig.yaw, t0 = rig.tubes[0];
  const zs = rig.tubes.map((t) => t.z);
  const zMax = Math.max(...zs.map(Math.abs));
  const wide = zMax > 0;
  if (wide) {
    k.box(plateR * 1.6, 0.09, zMax * 2 + plateR * 1.4, plate, rig.px, 0, 0, Y);
    k.box(plateR * 1.7, 0.03, zMax * 2 + plateR * 1.5, '#2a2e2a', rig.px, 0, 0, Y);
  } else {
    disc(k, plateR, 0.09, plate, rig.px, 0, 0, 14, Y);
    disc(k, plateR * 1.05, 0.03, '#2a2e2a', rig.px, 0, 0, 14, Y);
    for (let i = 0; i < 4; i++) k.box(0.05, 0.05, plateR * 2.1, plate, rig.px, 0.07, 0, Y).rotation.y = (i * Math.PI) / 4;
  }
  const d = t0.len * 0.52;
  const cx = rig.px + d * Math.cos(LOB), cy = rig.py + d * Math.sin(LOB);
  const spread = zMax + t0.r * 2.6 + 0.12;
  const lr = 0.03 + t0.r * 0.15;
  for (const s of [-1, 1]) {
    strut(k, Y, V(cx + 0.28, 0.02, s * spread), V(cx, cy, s * (zMax + t0.r * 1.3)), lr, legs, 6);
    k.box(0.14, 0.04, 0.12, '#2a2e2a', cx + 0.28, 0, s * spread, Y);
  }
  strut(k, Y, V(cx + 0.17, cy * 0.42, -spread * 0.62), V(cx + 0.17, cy * 0.42, spread * 0.62), lr * 0.8, legs, 6);
  strut(k, Y, V(cx + 0.17, cy * 0.42, 0), V(cx, cy, 0), lr * 1.1, '#2a2e2a', 6);
  // Yoke clamped round the barrels
  for (const t of rig.tubes) mesh(k, new THREE.CylinderGeometry(t.r * 1.32, t.r * 1.32, 0.09, 12).rotateZ(-Math.PI / 2), '#2a2e2a', d, t.o, t.z, rig.pitch);
  if (wide) mesh(k, new THREE.BoxGeometry(0.07, 0.07, zMax * 2 + 0.1), '#2a2e2a', d, 0, 0, rig.pitch);
  // Sight box
  mesh(k, new THREE.BoxGeometry(0.1, 0.08, 0.06), '#2f3a22', cx + 0.03, cy + 0.05, -(zMax + t0.r * 1.5 + 0.06), Y);
}

type Plat = 'crate' | 'timber' | 'steel' | 'white' | 'dark' | 'gold';

/** The loader on a step beside the muzzle of tube t, with ready rounds behind him. */
function crewLoader(k: Kit, rig: Rig, t: Tube, look: Look, seed: number, plat: Plat, period = 4.4, offset = 0, ready = true) {
  const M = mouth(rig, t, 0.1);
  const s = t.z < 0 ? -1 : 1;
  const target = M.y + 0.08;
  const sh = 0.45 * CS, ar = 0.2 * CS;
  let th = 2.1, feet = target - (sh - ar * Math.cos(th));
  if (feet < 0.03) {
    th = Math.acos(Math.max(-1, Math.min(1, (sh - target) / ar)));
    feet = 0;
  }
  const lz = t.z + s * (ar * Math.sin(th) + t.r * 0.25);
  const Y = rig.yaw;
  if (feet > 0.01) {
    const px = M.x - 0.02, pz = lz + s * 0.04;
    if (plat === 'crate') ammoBox(k, px, 0, pz, 0, '#8a6038', 0.34, feet, 0.28, 'HE', Y);
    else if (plat === 'timber') {
      k.box(0.36, feet, 0.3, TIMBER, px, 0, pz, Y);
      for (let i = 0; i < 3; i++) k.box(0.37, 0.02, 0.06, LOGC, px, feet - 0.02, pz - 0.1 + i * 0.1, Y);
    } else {
      const col = plat === 'white' ? '#e8e9e6' : plat === 'dark' ? '#3a3f45' : plat === 'gold' ? '#2a2b2d' : STEEL;
      k.box(0.36, feet, 0.3, col, px, 0, pz, Y);
      const edge = plat === 'white' ? TEAL : plat === 'gold' ? GOLD : HAZ;
      for (let i = 0; i < 4; i++) k.box(0.09, 0.025, 0.31, i % 2 && plat !== 'white' && plat !== 'gold' ? C.kerbB : edge, px - 0.135 + i * 0.09, feet - 0.02, pz, Y);
      for (const sd of [-1, 1]) k.box(0.025, 0.3, 0.025, edge, px - 0.16, feet, pz + sd * 0.13, Y);
      k.box(0.025, 0.025, 0.28, edge, px - 0.16, feet + 0.28, pz, Y);
    }
  }
  loader(k, Y, V(M.x, feet, lz), s > 0 ? Math.PI / 2 : -Math.PI / 2, th, look, seed, { parent: t.g, from: V(t.len + 0.1, 0, 0), to: V(t.len - 0.4, 0, 0), rot: -Math.PI / 2 }, period, offset, s * 1.25);
  if (ready) {
    const bx = M.x - 0.36, bz = lz + s * 0.02;
    ammoBox(k, bx, feet, bz, 0, OLIVE, 0.18, 0.09, 0.24, '', Y);
    for (const dz of [-0.06, 0, 0.06]) bomb(k, Y, GUN, HAZ, 1.1).position.set(bx, feet + 0.17, bz + dz);
  }
}

// ------------------------------------------------------------------ rings

/** Lathe ring with a material (for textured walls). */
function ringM(k: Kit, rIn: number, rOut: number, h: number, y: number, m: THREE.Material, gap = 0, gapAt = 0, seg = 36) {
  const pts = [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
  const geo = new THREE.LatheGeometry(pts, seg, gapAt + gap / 2, Math.PI * 2 - gap);
  const mm = new THREE.Mesh(geo, m);
  mm.position.y = y;
  return k.add(mm);
}

let BRICK: THREE.MeshStandardMaterial | null = null;
function brickMat() {
  if (BRICK) return BRICK;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e6d6bd';
  g.fillRect(0, 0, 128, 64);
  const cols = ['#b5523b', '#a84a35', '#bf5c42', '#9e4430'];
  for (let row = 0; row < 4; row++) for (let i = -1; i < 4; i++) {
    g.fillStyle = cols[(row * 3 + i + 4) % 4];
    g.fillRect(i * 32 + (row % 2) * 16 + 2, row * 16 + 2, 28, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 2);
  BRICK = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, flatShading: true });
  return BRICK;
}

/** Red brick ring with cream coping and brick piers at the opening. */
function brickRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number, piers = 0) {
  ringM(k, rIn, rOut, h, y, brickMat(), gap, gapAt);
  ring(k, rIn - 0.03, rOut + 0.04, 0.07, y + h, C.wall, gap, gapAt, 'wall', 36);
  const pier = (phi: number, hh: number) => {
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.2, hh, rOut - rIn + 0.1, '#b5523b', px, y, pz);
    p.rotation.y = phi;
    const cap = k.box(0.26, 0.07, rOut - rIn + 0.16, C.wall, px, y + hh, pz);
    cap.rotation.y = phi;
  };
  for (const sd of [-1, 1]) pier(gapAt + sd * (gap / 2 + 0.05), h + 0.14);
  for (let i = 0; i < piers; i++) {
    const phi = gapAt + gap / 2 + ((i + 1) / (piers + 1)) * (Math.PI * 2 - gap);
    pier(phi, h + 0.1);
  }
}

/** Grey concrete ring with a yellow/black painted rim. */
function hazardRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number, wall = CONCRETE, n = 24) {
  ring(k, rIn, rOut, h, y, wall, gap, gapAt, 'wall', 36);
  for (let i = 0; i < n; i++) {
    const phi = ((i + 0.5) / n) * Math.PI * 2;
    const dphi = Math.atan2(Math.sin(phi - gapAt), Math.cos(phi - gapAt));
    if (Math.abs(dphi) < gap / 2 + 0.06) continue;
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const seg = k.box(((2 * Math.PI * (rIn + rOut)) / 2 / n) * 1.02, 0.07, rOut - rIn + 0.04, i % 2 ? C.kerbB : HAZ, px, y + h, pz);
    seg.rotation.y = phi;
  }
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.05);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.16, h + 0.16, rOut - rIn + 0.08, wall, px, y, pz);
    p.rotation.y = phi;
    const c = k.box(0.18, 0.06, rOut - rIn + 0.1, HAZ, px, y + h + 0.16, pz);
    c.rotation.y = phi;
  }
}

/** White ring with a bold teal rim. */
function whiteRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number) {
  ring(k, rIn, rOut, h, y, C.white, gap, gapAt, 'wall', 40);
  ring(k, rIn - 0.03, rOut + 0.04, 0.08, y + h, TEAL, gap, gapAt, 'wall', 40);
  ring(k, rOut, rOut + 0.015, 0.06, y + 0.06, TEAL, gap, gapAt, 'wall', 40);
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.05);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.14, h + 0.18, rOut - rIn + 0.08, C.white, px, y, pz);
    p.rotation.y = phi;
    const [lx, lz] = P(phi, rOut + 0.05);
    pulse(k, 0.06, 0.06, 0.06, '#5fe0d0', lx, y + h + 0.1, lz, 2.4);
  }
}

/** Octagonal armoured block round the weapon well, with a contrasting rim. */
function armourBlock(k: Kit, rIn: number, rOut: number, h: number, y: number, wall: string, rim: string, chevrons?: string) {
  const pts = [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut - 0.08, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
  const g = new THREE.LatheGeometry(pts, 8, Math.PI / 8, Math.PI * 2);
  mesh(k, g, mat(wall, { side: THREE.DoubleSide }), 0, y, 0);
  const rg = new THREE.LatheGeometry([new THREE.Vector2(rOut - 0.04, 0), new THREE.Vector2(rOut - 0.04, 0.07), new THREE.Vector2(rIn - 0.03, 0.07), new THREE.Vector2(rIn - 0.03, 0)], 8, Math.PI / 8, Math.PI * 2);
  mesh(k, rg, mat(rim, { side: THREE.DoubleSide }), 0, y + h, 0);
  if (chevrons) for (let i = 0; i < 8; i++) {
    const phi = (i / 8) * Math.PI * 2 + Math.PI / 8 + Math.PI / 8;
    const r = Math.cos(Math.PI / 8) * rOut - 0.02;
    for (let j = 0; j < 4; j++) {
      const [cx, cz] = P(phi + (j - 1.5) * 0.11, r + 0.005);
      const c = k.box(0.12, 0.2, 0.02, j % 2 ? '#2a2b2d' : chevrons, cx, y + h * 0.3, cz);
      c.rotation.set(0, phi, j % 2 ? 0.6 : -0.6);
    }
  }
}

function floor(k: Kit, r: number, y: number, color: string) {
  disc(k, r, 0.014, color, 0, y, 0, 36);
  return y + 0.014;
}

// ------------------------------------------------------------------ extra set pieces

/** Tall fire-direction hut on stilts, with a spotter on the deck and a ladder. */
function stiltHut(k: Kit, x: number, z: number, y: number, ry: number, h: number) {
  sub(k, x, y, z, ry, (s) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(0.06, h, 0.06, TIMBER, sx * 0.3, 0, sz * 0.26);
    strut(s, undefined, V(-0.3, 0.05, 0.26), V(0.3, h - 0.05, 0.26), 0.02, TIMBER);
    strut(s, undefined, V(0.3, 0.05, -0.26), V(-0.3, h - 0.05, -0.26), 0.02, TIMBER);
    s.box(0.8, 0.06, 0.74, TIMBER, 0, h, 0.04);
    s.box(0.64, 0.42, 0.5, '#6b7a4a', 0, h + 0.06, -0.08);
    s.box(0.5, 0.12, 0.02, '#1d2326', 0, h + 0.3, 0.175);
    const roof = s.box(0.82, 0.05, 0.72, C.zinc, 0, h + 0.5, -0.04);
    roof.rotation.x = 0.12;
    for (let i = 0; i < 4; i++) s.box(0.8, 0.02, 0.02, TIMBER, 0, h + 0.2, 0.4).position.set(0, h + 0.18, 0.4);
    for (const sx of [-1, 1]) s.box(0.03, 0.22, 0.03, TIMBER, sx * 0.38, h + 0.06, 0.4);
    // Ladder
    for (const sx of [-0.08, 0.08]) {
      const rail = s.box(0.025, h + 0.1, 0.025, TIMBER, sx, 0, 0.55);
      rail.rotation.x = -0.2;
    }
    spotter(s, 0.15, h + 0.06, 0.25, face(0.6, 1), FIELD, 41, false);
    s.antenna(-0.3, h + 0.5, -0.3, 0.6);
  });
}

/** Revolving magazine drum (bomb noses round the top) that steps round each load. */
function magDrum(k: Kit, parent: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, accent: string) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  disc(k, r + 0.03, 0.06, '#c9ced2', 0, 0, 0, 14, g);
  disc(k, r, h, '#e8e9e6', 0, 0.06, 0, 14, g);
  for (const f of [0.25, 0.75]) disc(k, r + 0.015, 0.05, accent, 0, 0.06 + h * f, 0, 14, g);
  disc(k, r + 0.03, 0.05, '#c9ced2', 0, h + 0.06, 0, 14, g);
  for (let i = 0; i < 8; i++) {
    const [bx, bz] = P((i / 8) * Math.PI * 2, r * 0.7);
    bomb(k, g, GUN, accent, 1.3).position.set(bx, h + 0.17, bz);
  }
  parent.add(g);
  k.anims.push((t) => {
    const n = Math.floor((t + 100) / 4.4), u = cyc(t, 4.4);
    g.rotation.y = (n + sm((u - 0.8) / 0.15)) * (Math.PI / 4);
  });
  return g;
}

/** Big yellow sliding roof hatch doors on a casemate (open and close on a loop). */
function hatchDoors(k: Kit, y: number, w: number, d: number, gapClosed: number, gapOpen: number) {
  const doors = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    k.box(w, 0.08, d, HAZ, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) {
      const c = k.box(0.08, 0.085, d * 0.9, '#2a2b2d', -w / 2 + 0.12 + i * (w - 0.2) / 3, 0, 0, g);
      c.rotation.y = 0.5 * sd;
    }
    k.box(w + 0.04, 0.03, 0.06, '#3a3f45', 0, 0.08, d / 2, g);
    k.box(w + 0.04, 0.03, 0.06, '#3a3f45', 0, 0.08, -d / 2, g);
    g.position.y = y;
    k.add(g);
    return { g, sd };
  });
  for (const sd of [-1, 1]) k.box(0.06, 0.06, d + 0.3, '#2a2b2d', sd * (gapOpen + w), y - 0.03, 0);
  k.anims.push((t) => {
    const u = cyc(t, 9);
    const open = u < 0.12 ? sm(u / 0.12) : u < 0.7 ? 1 : u < 0.85 ? 1 - sm((u - 0.7) / 0.15) : 0;
    const gp = gapClosed + (gapOpen - gapClosed) * open;
    doors.forEach(({ g, sd }) => (g.position.x = sd * (gp + w / 2)));
  });
}

/** Striped turntable disc (alternating wedges) for the yaw group. */
function stripedDisc(k: Kit, parent: THREE.Object3D, r: number, h: number, a: string, b: string, n = 16) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(r, r, h, 4, 1, false, (i / n) * Math.PI * 2, (Math.PI * 2) / n).translate(0, h / 2, 0);
    mesh(k, g, i % 2 ? a : b, 0, 0, 0, parent);
  }
  ring(k, r - 0.03, r + 0.03, h + 0.02, 0, '#33383d', 0, 0, 'wall', 32, parent);
  disc(k, 0.16, h + 0.03, '#33383d', 0, 0, 0, 12, parent);
}

// ------------------------------------------------------------------ the 20 levels

const OLV = '#66773b';
const GREEN = '#3f8a4a';
const BLUE = '#4f7193';
const INK = '#24272b';

function build(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  const fl = y;
  switch (level) {
    case 1: {
      // Dirt scrape: a brown earth bowl, one olive tube, a timber ammo box
      ring(k, 0.95, 1.42, 0.14, fl, EARTH, 0.7, 0.6, 'berm', 36);
      const f = floor(k, 1.0, fl, DIRT_D);
      const rig = newRig(k, 0.05, f, 0.0, -0.25, 0.1);
      barrels(k, rig, { len: 0.95, r: 0.11, color: OLV, band: GUN_D, bands: 1, lip: GUN_D }, 1);
      bipodMount(k, rig, STEEL, GUN_D, 0.3);
      crewLoader(k, rig, rig.tubes[0], FIELD, 1, 'crate');
      registerRig(k, rig, level, 1);
      sub(k, -0.62, f, -0.62, 0.5, (s) => {
        s.box(0.56, 0.3, 0.36, TIMBER, 0, 0, 0);
        for (const dy of [0.04, 0.24]) s.box(0.58, 0.04, 0.38, LOGC, 0, dy, 0);
        board(s, 'AMMO', 0.3, 0.1, 0, 0.1, 0.185, TIMBER, '#f2e3a0');
        for (let i = 0; i < 3; i++) bomb(s, undefined, GUN, HAZ, 1.2).position.set(-0.15 + i * 0.15, 0.4, 0);
      });
      spotter(k, -0.6, f, 0.45, face(0.5, 1), FIELD, 2);
      pennant(k, -1.2, -1.15, fl, 0.8);
      aimingStakes(k, 0.95, 1.18, fl, 2, 0.18, 0.05);
      jerrycan(k, 0.75, -0.75, f, 0.4);
      fieldPhone(k, -0.85, 0.15, f, 0.5);
      break;
    }
    case 2: {
      // Sandbag pit: a tan ring of big sandbags, timber-lashed tube
      ring(k, 1.15, 1.45, 0.1, fl, EARTH, 0.6, 0.6, 'berm', 36);
      const f = floor(k, 1.12, fl, DIRT_D);
      const bags = new Bags(22, 1.35);
      bags.ring(1.17, 3, fl, 0.55, 0.6);
      bags.flush(k);
      const rig = newRig(k, 0.05, f, 0.05, -0.27, 0.1);
      barrels(k, rig, { len: 1.0, r: 0.12, color: OLV, band: GUN_D, bands: 1, lip: GUN_D, lash: true }, 1);
      bipodMount(k, rig, STEEL, GUN_D, 0.32);
      crewLoader(k, rig, rig.tubes[0], FIELD, 3, 'crate');
      registerRig(k, rig, level, 2);
      crateStack(k, -0.5, f, -0.65, 0.6, 5, 1);
      camoNet(k, -0.55, -0.6, 0.95, 0.6, f, 0.62, 0.8, 4);
      bearer(k, V(-0.75, f, -0.25), V(-0.45, f, 0.15), FIELD, 4, 8, 1.5, false);
      spotter(k, 0.62, f, -0.62, face(0.4, 1), FIELD, 5);
      pennant(k, 1.25, -1.22, fl, 0.85);
      aimingStakes(k, 1.05, 1.15, fl, 3, 0.15, 0.04);
      break;
    }
    case 3: {
      // Log-revetted pit: a ring of brown logs, tube on a red-painted baseplate
      ring(k, 1.25, 1.48, 0.12, fl, EARTH, 0.55, 0.6, 'berm', 36);
      const f = floor(k, 1.16, fl, DIRT_D);
      for (let i = 0; i < 7; i++) k.box(0.12, 0.02, 1.3, TIMBER, -0.45 + i * 0.15, f, 0.0);
      const logs: THREE.BufferGeometry[] = [];
      const n = 46;
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(phi - 0.6), Math.cos(phi - 0.6))) < 0.3) continue;
        const [px, pz] = P(phi, 1.2);
        const hh = 0.44 + (i % 3) * 0.04;
        logs.push(new THREE.CylinderGeometry(0.08, 0.085, hh, 7).translate(px, fl + hh / 2, pz).toNonIndexed());
      }
      mesh(k, mergeGeometries(logs)!, LOGC);
      ring(k, 1.1, 1.3, 0.05, fl + 0.44, '#a8784a', 0.6, 0.6, 'wall', 36);
      const rig = newRig(k, 0.05, f + 0.02, 0.05, -0.28, 0.12);
      barrels(k, rig, { len: 1.05, r: 0.125, color: OLV, band: GUN_D, bands: 2, lip: GUN_D }, 1);
      bipodMount(k, rig, RED, GUN_D, 0.38);
      crewLoader(k, rig, rig.tubes[0], FIELD, 6, 'timber');
      registerRig(k, rig, level, 3);
      bearer(k, V(-0.8, f, -0.3), V(-0.5, f, 0.1), FIELD, 7, 8, 2.5, false);
      spotter(k, 0.6, f, -0.7, face(0.3, 1), FIELD, 8, false);
      crateStack(k, -0.55, f, -0.75, 0.6, 4, 2);
      rangeFlag(k, 1.28, -1.28, fl, 1.7);
      lantern(k, -1.3, 0.9, fl, 0.62, 1);
      signPost(k, 'DANGER', -1.0, 1.35, fl, 0.3, RED, 0.42, 0.14, 0.3);
      break;
    }
    case 4:
    case 5:
    case 6: {
      // Brick bay: red brick ring with cream coping; L5 adds the green-roofed shed, L6 twin tubes
      const rr = level === 6 ? 1.18 : 1.12;
      brickRing(k, rr, rr + 0.17, level === 6 ? 0.42 : 0.36, fl, 0.6, 0.6, level === 6 ? 4 : 0);
      const f = floor(k, rr, fl, '#cfc9bb');
      const twin = level === 6;
      const rig = newRig(k, 0.05, f, 0.05, -0.3, 0.1);
      barrels(k, rig, { len: twin ? 1.05 : 1.1, r: twin ? 0.11 : 0.13, color: GREEN, band: level >= 5 ? '#f7f5ef' : '#2f6a3a', bands: level >= 5 ? 3 : 2, lip: '#2f6a3a' }, twin ? 2 : 1);
      bipodMount(k, rig, STEEL, '#2f5a3a', 0.36);
      crewLoader(k, rig, rig.tubes[twin ? 1 : 0], CAMP, 9 + level, 'steel');
      registerRig(k, rig, level, level, 0.7, 0.6);
      if (level === 4) {
        bombRack(k, -0.55, f, -0.62, -0.75, 6);
        bombRack(k, 0.62, f, -0.55, 0.75, 5);
        bearer(k, V(-1.25, fl, 0.3), V(-0.75, f, 0.1), CAMP, 12, 9, 1, true);
        signPost(k, 'MORTAR BAY', -1.0, 1.3, fl, 0.6, C.trim, 0.6, 0.16, 0.36, C.white);
        k.lamp(1.25, 1.25, fl, 1.1);
        spotter(k, 0.62, f, 0.0, face(0.5, 1), CAMP, 13, false);
        break;
      }
      // Green-roofed ammo shed (big silhouette at the back-left corner)
      const b = bearer(k, V(-0.95, fl, -0.95), V(-0.55, f, -0.45), CAMP, 14, 9);
      ammoHut(k, -1.06, -1.06, fl, Math.PI / 4, b.open, 0.78, 0.62, C.roofGreen);
      bombRack(k, 0.62, f, -0.55, 0.75, 6);
      k.lamp(1.25, 1.25, fl, 1.1);
      signPost(k, level === 5 ? 'MORTAR BAY' : 'TWIN BAY', 0.3, 1.36, fl, 0, C.trim, 0.56, 0.16, 0.36, C.white);
      if (level === 6) {
        // Alarm bell with a swinging striker
        const [bx, bz] = P(2.0, 1.42);
        k.box(0.06, 1.0, 0.06, C.trim, bx, fl, bz);
        k.box(0.24, 0.05, 0.05, C.trim, bx - 0.08, fl + 0.98, bz);
        const bell = new THREE.Group();
        bell.position.set(bx - 0.17, fl + 0.96, bz);
        mesh(k, new THREE.CylinderGeometry(0.05, 0.1, 0.13, 10).translate(0, -0.065, 0), '#d8b24a', 0, 0, 0, bell);
        mesh(k, new THREE.SphereGeometry(0.025, 6, 4), '#7a5a2a', 0, -0.15, 0, bell);
        k.add(bell);
        k.anims.push((t) => (bell.rotation.z = Math.sin(t * 7) * 0.25 * (cyc(t, 6) < 0.3 ? 1 : 0.15)));
      } else spotter(k, 0.7, f, 0.1, face(0.5, 1), OFFICER, 15, false);
      break;
    }
    case 7: {
      // Concrete pit: grey ring with a yellow/black rim, one big black-and-yellow tube
      hazardRing(k, 1.12, 1.32, 0.42, fl, 0.6, 0.6);
      const f = floor(k, 1.12, fl, '#c2bdb2');
      const pl = plinth(k, 0.62, f, 0.06);
      const rig = newRig(k, 0.0, pl, 0.0, -0.32, 0.11);
      barrels(k, rig, { len: 1.15, r: 0.16, color: INK, band: HAZ, bands: 3, lip: HAZ }, 1);
      bipodMount(k, rig, '#4a4f54', '#2a2e2a', 0.42);
      crewLoader(k, rig, rig.tubes[0], BASE, 16, 'steel');
      registerRig(k, rig, level, 7);
      readyBunker(k, -1.02, -1.02, fl, Math.PI / 4, 0.82, 0.56, 0.62);
      rangefinder(k, 0.7, -0.6, f, 1);
      spotter(k, 0.95, f, -0.25, face(0.3, 1), BASE, 17, false);
      bombRack(k, -0.75, f, 0.3, -1.4, 6, '#4b6b3a');
      k.lamp(1.3, 1.3, fl, 1.15);
      signPost(k, 'NO SMOKING', -1.2, 1.2, fl, 0.7, RED, 0.48, 0.14, 0.32, C.metal);
      break;
    }
    case 8: {
      // Heavy pit: the biggest single tube, steel blue with a recoil spring housing
      berm(k, 1.26, 1.5, 0.36, fl, 0.6, 0.6);
      hazardRing(k, 1.1, 1.3, 0.46, fl, 0.6, 0.6);
      const f = floor(k, 1.1, fl, '#c2bdb2');
      const rig = newRig(k, 0.1, f, 0.08, -0.36, 0.14);
      barrels(k, rig, { len: 1.28, r: 0.19, color: BLUE, band: '#33465a', bands: 2, lip: '#33465a', spring: '#d8b24a' }, 1);
      bipodMount(k, rig, '#4a4f54', '#2a2e2a', 0.48);
      crewLoader(k, rig, rig.tubes[0], BASE, 18, 'steel');
      registerRig(k, rig, level, 8);
      shelter(k, -1.02, -1.02, fl, Math.PI / 4, 0.72, 0.56, 0.95, 72);
      davit(k, 1.0, -0.95, fl + 0.32, 1.2, 0.62, face(-1, 1));
      k.box(0.34, 0.32, 0.34, CONCRETE, 1.0, fl, -0.95);
      k.lamp(1.3, 1.3, fl + 0.2, 1.1);
      break;
    }
    case 9: {
      // Fire-direction pit: twin heavy blue tubes + a tall FDC hut on stilts
      berm(k, 1.26, 1.5, 0.38, fl, 0.6, 0.6);
      hazardRing(k, 1.1, 1.3, 0.48, fl, 0.6, 0.6);
      const f = floor(k, 1.1, fl, '#c2bdb2');
      const rig = newRig(k, 0.12, f, 0.12, -0.34, 0.13);
      barrels(k, rig, { len: 1.18, r: 0.15, color: BLUE, band: '#33465a', bands: 2, lip: '#33465a', spring: '#d8b24a' }, 2);
      bipodMount(k, rig, '#4a4f54', '#2a2e2a', 0.42);
      crewLoader(k, rig, rig.tubes[1], BASE, 20, 'steel');
      registerRig(k, rig, level, 9);
      stiltHut(k, -1.0, -1.0, fl, Math.PI / 4, 0.95);
      davit(k, 1.02, -0.95, fl + 0.34, 1.2, 0.6, face(-1, 1), 11);
      k.box(0.34, 0.34, 0.34, CONCRETE, 1.02, fl, -0.95);
      k.lamp(1.3, 1.3, fl + 0.2, 1.1);
      break;
    }
    case 10: {
      // Mortar battery: triple tubes on a cream bunker with a red-tile skirt and a gold rim
      ring(k, 1.08, 1.32, 0.46, fl, C.wall, 0, 0, 'wall', 40);
      ring(k, 1.32, 1.335, 0.12, fl, C.trim, 0, 0, 'wall', 40);
      ring(k, 1.02, 1.45, 0.18, fl + 0.46, C.roof, 0, 0, 'berm', 40);
      ring(k, 1.0, 1.06, 0.08, fl + 0.6, GOLD, 0, 0, 'wall', 40);
      for (let i = 0; i < 8; i++) {
        const [wx, wz] = P((i / 8) * Math.PI * 2 + 0.2, 1.335);
        const w = k.box(0.18, 0.06, 0.02, '#1d2326', wx, fl + 0.24, wz);
        w.rotation.y = (i / 8) * Math.PI * 2 + 0.2;
      }
      const deck = fl + 0.42;
      disc(k, 1.06, deck - fl, '#d9d4c8', 0, fl, 0, 36);
      ring(k, 0.86, 0.9, 0.006, deck, GOLD, 0, 0, 'wall', 36);
      const rig = newRig(k, 0.05, deck, 0.0, -0.3, 0.12);
      barrels(k, rig, { len: 1.05, r: 0.12, color: BLUE, band: GOLD, bands: 2, lip: '#33465a' }, 3);
      bipodMount(k, rig, '#4a4f54', '#2a2e2a', 0.34);
      crewLoader(k, rig, rig.tubes[2], BASE, 21, 'steel');
      registerRig(k, rig, level, 10);
      // Steps up to the deck and a gateway sign
      for (let i = 0; i < 3; i++) {
        const [sx, sz] = P(0.6, 1.36 + i * 0.07);
        k.box(0.5, 0.42 - i * 0.13, 0.1, '#c2bcae', sx, fl, sz).rotation.y = 0.6;
      }
      board(k, 'MORTAR BATTERY', 0.7, 0.13, -0.62, fl + 0.24, 1.2, C.trim, '#ffffff', 0.5);
      k.flagpole(-1.3, -1.3, 1.9, fl);
      k.flagpole(1.3, -1.3, 1.9, fl);
      k.lamp(1.3, 1.3, fl, 1.2);
      spotter(k, -0.55, deck, -0.55, face(0.4, 1), OFFICER, 22, false);
      bombRack(k, 0.62, deck, -0.6, 0.75, 6, '#4b6b3a');
      break;
    }
    case 11: {
      // Dome turret: a white half-sphere with a slot, teal-rimmed white ring
      whiteRing(k, 1.12, 1.3, 0.38, fl, 0.6, 0.6);
      const f = floor(k, 1.12, fl, '#dcdedd');
      disc(k, 0.66, 0.05, '#9aa0a4', 0.0, f, 0.0, 28);
      const rig = newRig(k, 0.0, f + 0.05, 0.0, -0.05, 0.36);
      const Y = rig.yaw;
      mesh(k, new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.white, 0, 0, 0, Y);
      ring(k, 0.58, 0.63, 0.1, 0, TEAL, 0, 0, 'wall', 28, Y);
      const slot = k.box(0.5, 0.06, 0.3, '#2a2e2a', 0.25, 0.48, 0, Y);
      slot.rotation.z = -0.6;
      disc(k, 0.1, 0.08, '#d5d9dc', -0.25, 0.5, 0.2, 10, Y);
      barrels(k, rig, { len: 1.05, r: 0.13, color: '#4a4f54', band: TEAL, bands: 2, lip: '#33383d' }, 1);
      crewLoader(k, rig, rig.tubes[0], CMD, 23, 'white');
      registerRig(k, rig, level, 11);
      kiosk(k, -1.02, -1.02, fl, Math.PI / 4, 0.62, 0.5, 0.56, 2);
      k.flagpole(1.25, -1.25, 1.9, fl);
      k.lamp(1.3, 1.25, fl, 1.2);
      signPost(k, 'MORTAR 11', -1.15, 1.25, fl, 0.6, TEAL, 0.5, 0.15, 0.34, C.white);
      break;
    }
    case 12: {
      // Autoloader: low white turret, a big revolving magazine drum beside the tube
      whiteRing(k, 1.12, 1.3, 0.4, fl, 0.6, 0.6);
      const f = floor(k, 1.12, fl, '#dcdedd');
      disc(k, 0.7, 0.05, '#9aa0a4', 0.0, f, 0.0, 28);
      const rig = newRig(k, 0.0, f + 0.05, 0.0, -0.15, 0.3);
      const Y = rig.yaw;
      disc(k, 0.55, 0.26, C.white, 0, 0, 0, 24, Y);
      ring(k, 0.54, 0.57, 0.06, 0.16, TEAL, 0, 0, 'wall', 24, Y);
      k.box(0.34, 0.2, 0.42, '#e2e5e7', -0.15, 0.24, 0, Y);
      barrels(k, rig, { len: 1.08, r: 0.14, color: '#4a4f54', band: TEAL, bands: 2, lip: '#33383d' }, 1);
      magDrum(k, Y, -0.3, 0.26, -0.42, 0.24, 0.5, TEAL);
      crewLoader(k, rig, rig.tubes[0], CMD, 24, 'white');
      registerRig(k, rig, level, 12);
      kiosk(k, -1.02, -1.02, fl, Math.PI / 4, 0.66, 0.5, 0.62, 2);
      metMast(k, 1.25, -1.25, fl, 1.2);
      k.lamp(1.3, 1.25, fl, 1.2);
      signPost(k, 'AUTOLOADER', -1.15, 1.25, fl, 0.6, TEAL, 0.52, 0.15, 0.34, C.white);
      break;
    }
    case 13: {
      // Roof-deck turret: raised white podium with a green deck, twin-tube white turret
      const top = fl + 0.4;
      k.box(2.5, 0.4, 2.5, C.white, 0, fl, 0);
      k.box(2.56, 0.06, 2.56, TEAL, 0, fl + 0.12, 0);
      k.box(2.4, 0.04, 2.4, C.roofGreen, 0, top, 0);
      for (const [hx, hz, w, d] of [[0, -1.12, 2.2, 0.18], [-1.12, 0, 0.18, 2.2]] as [number, number, number, number][]) k.hedge(hx, hz, w, d, top + 0.04);
      for (let i = 0; i < 3; i++) k.box(0.6, 0.4 - i * 0.13, 0.12, '#c9c3b5', 0.6, fl, 1.3 + i * 0.08);
      const rig = newRig(k, 0.1, top + 0.04, 0.1, -0.2, 0.3);
      const Y = rig.yaw;
      disc(k, 0.5, 0.06, '#9aa0a4', 0, 0, 0, 24, Y);
      k.box(0.7, 0.32, 0.74, C.white, -0.15, 0.06, 0, Y);
      k.box(0.72, 0.06, 0.76, TEAL, -0.15, 0.24, 0, Y);
      const gl = k.box(0.3, 0.06, 0.74, C.white, 0.25, 0.28, 0, Y);
      gl.rotation.z = -0.6;
      barrels(k, rig, { len: 1.0, r: 0.12, color: '#4a4f54', band: C.white, bands: 2, lip: '#33383d' }, 2);
      crewLoader(k, rig, rig.tubes[1], CMD, 25, 'white');
      registerRig(k, rig, level, 13);
      metMast(k, -1.1, -1.1, top + 0.04, 1.0);
      balloon(k, 1.0, -1.0, top + 0.04, 1.1);
      k.flagpole(-1.05, 0.9, 1.6, top + 0.04);
      pulse(k, 0.5, 0.06, 0.02, '#5fe0d0', 0, fl + 0.26, 1.255, 1.8);
      break;
    }
    case 14: {
      // Turntable: a big red/white striped disc is the traversing mount; tube on a wheeled carriage
      whiteRing(k, 1.22, 1.36, 0.22, fl, 0.6, 0.6);
      const f = floor(k, 1.22, fl, '#dcdedd');
      const rig = newRig(k, 0.0, f, 0.0, -0.28, 0.36);
      const Y = rig.yaw;
      stripedDisc(k, Y, 1.14, 0.08, RED, '#f7f5ef', 16);
      for (const sd of [-1, 1]) {
        k.box(0.8, 0.2, 0.06, '#e2e5e7', -0.15, 0.08, sd * 0.24, Y);
        for (const wx of [-0.42, 0.12]) mesh(k, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12).rotateX(Math.PI / 2), '#33383d', wx, 0.19, sd * 0.3, Y);
      }
      k.box(0.3, 0.22, 0.42, '#e2e5e7', -0.28, 0.12, 0, Y);
      barrels(k, rig, { len: 1.08, r: 0.14, color: '#e8e9e6', band: TEAL, bands: 3, lip: TEAL }, 1);
      for (const sd of [-1, 1]) strut(k, Y, V(0.22, 0.26, sd * 0.24), mouth(rig, rig.tubes[0], -0.55).add(V(0, 0, sd * 0.2)), 0.035, HAZ, 8);
      crewLoader(k, rig, rig.tubes[0], CMD, 26, 'white');
      registerRig(k, rig, level, 14);
      kiosk(k, -1.08, -1.08, fl, Math.PI / 4, 0.62, 0.48, 0.66, 2);
      k.flagpole(1.3, -1.3, 1.9, fl);
      beacon(k, 1.3, fl, 1.3, '#ffd23f');
      break;
    }
    case 15: {
      // Quad rotunda: teal-and-white round platform raised a step, quad tubes in a square
      const top = fl + 0.28;
      disc(k, 1.42, 0.12, '#cfd3d2', 0, fl, 0, 40);
      disc(k, 1.28, 0.28, C.white, 0, fl, 0, 40);
      ring(k, 1.28, 1.3, 0.1, fl + 0.12, TEAL, 0, 0, 'wall', 40);
      ring(k, 1.2, 1.3, 0.04, top, TEAL, 0, 0, 'wall', 40);
      for (let i = 0; i < 10; i++) {
        const [px, pz] = P((i / 10) * Math.PI * 2 + 0.3, 1.2);
        k.cyl(0.05, 0.42, C.white, px, top, pz, 8);
        pulse(k, 0.08, 0.05, 0.08, '#5fe0d0', px, top + 0.42, pz, 1.6);
      }
      const rig = newRig(k, 0.0, top, 0.0, -0.22, 0.36);
      const Y = rig.yaw;
      disc(k, 0.55, 0.3, C.white, 0, 0, 0, 24, Y);
      ring(k, 0.54, 0.57, 0.07, 0.18, TEAL, 0, 0, 'wall', 24, Y);
      k.box(0.4, 0.36, 0.62, '#e2e5e7', -0.2, 0.18, 0, Y);
      barrels(k, rig, { len: 0.98, r: 0.11, color: '#4a4f54', band: TEAL, bands: 2, lip: TEAL }, 4, 'square');
      crewLoader(k, rig, rig.tubes[3], CMD, 27, 'white');
      registerRig(k, rig, level, 15);
      k.flagpole(-1.25, -1.25, 1.9, fl);
      k.flagpole(1.3, -1.3, 1.9, fl);
      const crest = mesh(k, new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14).rotateX(Math.PI / 2), TEAL, -0.8, fl + 0.18, 1.12);
      crest.rotation.y = 0.6;
      break;
    }
    case 16: {
      // Hatch casemate: dark steel block, two big yellow sliding roof doors either side of the well
      const h = 0.5;
      k.box(2.7, h, 2.7, '#3a3f45', 0, fl, 0);
      k.box(2.74, 0.06, 2.74, '#2a2e33', 0, fl + 0.1, 0);
      const f = floor(k, 0.82, fl + h - 0.3, '#2a2e33');
      ring(k, 0.8, 0.86, 0.32, fl + h - 0.3, HAZ, 0, 0, 'wall', 28);
      hatchDoors(k, fl + h, 0.42, 1.5, 0.62, 0.84);
      const rig = newRig(k, 0.0, f, 0.0, -0.3, 0.12);
      barrels(k, rig, { len: 1.18, r: 0.16, color: '#3a3f45', band: HAZ, bands: 2, lip: HAZ }, 1);
      bipodMount(k, rig, '#2a2e33', '#2a2e2a', 0.4);
      crewLoader(k, rig, rig.tubes[0], SEC, 28, 'dark');
      registerRig(k, rig, level, 16);
      k.box(0.5, 0.34, 0.04, '#5c6166', 0.6, fl, 1.36);
      for (let i = 0; i < 6; i++) k.box(0.1, 0.06, 0.05, i % 2 ? C.kerbB : HAZ, 0.35 + i * 0.1, fl + 0.36, 1.36);
      cctv(k, -1.25, -1.25, fl + h, 0.8, Math.PI * 0.25);
      beacon(k, 1.2, fl + h, -1.2);
      k.blinker(-1.2, fl + h, 1.2, '#ff3b30', 0.04);
      break;
    }
    case 17: {
      // Hydraulic mortar: olive armour block with orange chevrons, heavy single tube on rams
      armourBlock(k, 0.86, 1.45, 0.48, fl, ARMOUR, '#e0782a', '#e0782a');
      const f = floor(k, 0.86, fl, '#4a4f45');
      const rig = newRig(k, 0.0, f, 0.0, -0.3, 0.3);
      const Y = rig.yaw;
      disc(k, 0.5, 0.14, ARMOUR_D, 0, 0, 0, 16, Y);
      k.box(0.46, 0.3, 0.5, ARMOUR, -0.3, 0.1, 0, Y);
      barrels(k, rig, { len: 1.25, r: 0.2, color: ARMOUR, band: '#e0782a', bands: 2, lip: ARMOUR_D }, 1);
      for (const sd of [-1, 1]) {
        const a = V(0.25, 0.14, sd * 0.3), b = mouth(rig, rig.tubes[0], -0.62).add(V(0, 0, sd * 0.3));
        strut(k, Y, a, b, 0.06, HAZ, 10);
        strut(k, Y, a.clone().lerp(b, 0.5), b, 0.035, '#c9ced2', 8);
        mesh(k, new THREE.SphereGeometry(0.07, 8, 6), '#33383d', a.x, a.y, a.z, Y);
      }
      crewLoader(k, rig, rig.tubes[0], SEC, 29, 'dark');
      registerRig(k, rig, level, 17);
      acousticMast(k, -1.25, -1.25, fl, 1.3);
      beacon(k, 1.0, fl + 0.55, -1.0);
      beacon(k, -1.0, fl + 0.55, 1.0);
      cctv(k, 1.32, 1.0, fl, 1.0, Math.PI);
      break;
    }
    case 18: {
      // Drone-spotted quad: dark armour base, drone pad and a hovering spotter drone, quad tubes
      armourBlock(k, 0.9, 1.4, 0.5, fl, '#3a3f45', HAZ);
      const f = floor(k, 0.9, fl, '#2a2e33');
      sub(k, -1.0, fl, -1.0, Math.PI / 4, (s) => {
        s.box(0.74, 0.86, 0.74, '#3a3f45', 0, 0, 0);
        s.box(0.78, 0.05, 0.78, HAZ, 0, 0.86, 0);
        s.helipad(0, 0.9, 0, 0.6);
        s.box(0.3, 0.44, 0.03, '#5c6166', 0, 0, 0.375);
      });
      drone(k, -1.0, -1.0, fl + 0.95, 0.75);
      const rig = newRig(k, 0.1, f, 0.1, -0.24, 0.36);
      const Y = rig.yaw;
      disc(k, 0.5, 0.32, '#3a3f45', 0, 0, 0, 16, Y);
      ring(k, 0.49, 0.52, 0.06, 0.24, HAZ, 0, 0, 'wall', 16, Y);
      k.box(0.36, 0.4, 0.62, '#2a2e33', -0.22, 0.2, 0, Y);
      barrels(k, rig, { len: 1.0, r: 0.115, color: '#3a3f45', band: HAZ, bands: 2, lip: '#2a2e33' }, 4, 'square');
      crewLoader(k, rig, rig.tubes[3], SEC, 30, 'dark');
      registerRig(k, rig, level, 18);
      acousticMast(k, 1.25, -1.25, fl, 1.3);
      beacon(k, 1.05, fl + 0.56, 0.9);
      cctv(k, -1.3, 1.1, fl, 1.0, 0);
      break;
    }
    case 19: {
      // Black turret: chamfered black turret with twin long tubes and red sensor lights
      armourBlock(k, 0.92, 1.42, 0.5, fl, '#2a2d31', '#d8342c');
      const f = floor(k, 0.92, fl, '#2a2e33');
      const rig = newRig(k, 0.08, f, 0.08, -0.12, 0.42);
      const Y = rig.yaw;
      disc(k, 0.6, 0.12, '#1f2226', 0, 0, 0, 16, Y);
      k.box(0.86, 0.42, 0.78, '#1f2226', -0.2, 0.12, 0, Y);
      const gl = k.box(0.34, 0.06, 0.78, '#1f2226', 0.28, 0.42, 0, Y);
      gl.rotation.z = -0.7;
      k.box(0.88, 0.04, 0.8, RED, -0.2, 0.34, 0, Y);
      for (const [lx, lz] of [[-0.45, 0.4], [-0.45, -0.4], [0.05, 0.4], [0.05, -0.4]]) pulse(k, 0.07, 0.06, 0.02, '#ff2a20', lx, 0.42, lz, 3.2, Y);
      pulse(k, 0.14, 0.08, 0.1, '#ff2a20', -0.45, 0.58, 0, 2.2, Y);
      barrels(k, rig, { len: 1.38, r: 0.11, color: INK, band: RED, bands: 3, lip: '#1f2226' }, 2);
      crewLoader(k, rig, rig.tubes[1], SEC, 31, 'dark');
      registerRig(k, rig, level, 19);
      sensorBall(k, -1.2, -1.2, fl, 1.25);
      for (const [bx, bz] of [[1.2, -1.2], [-1.2, 1.2]] as [number, number][]) k.blinker(bx, fl + 0.5, bz, '#ff2a20', 0.05, 1.0);
      cctv(k, 1.3, 1.1, fl, 1.0, Math.PI);
      beacon(k, 1.15, fl + 0.55, 0.35, '#ff3b30');
      break;
    }
    default: {
      // 20 Citadel mortar: huge gold-banded black barrel on a gold-rimmed armoured ring
      armourBlock(k, 0.95, 1.45, 0.56, fl, '#1f2226', GOLD);
      const f = floor(k, 0.95, fl, '#2a2e33');
      ring(k, 0.75, 0.8, 0.006, f, GOLD, 0, 0, 'wall', 32);
      const rig = newRig(k, 0.05, f, 0.05, -0.38, 0.16);
      barrels(k, rig, { len: 1.4, r: 0.22, color: INK, band: GOLD, bands: 3, lip: GOLD }, 1);
      bipodMount(k, rig, GOLD, '#1f2226', 0.52);
      crewLoader(k, rig, rig.tubes[0], SEC, 32, 'gold');
      registerRig(k, rig, level, 20);
      for (const [bx, bz] of [[-1.18, 1.18], [-1.2, -1.2], [1.2, -1.2]] as [number, number][]) {
        const bs = k.box(0.42, 0.86, 0.42, '#1f2226', bx, fl, bz);
        bs.rotation.y = Math.PI / 4;
        const cap = k.box(0.5, 0.08, 0.5, GOLD, bx, fl + 0.86, bz);
        cap.rotation.y = Math.PI / 4;
        pulse(k, 0.08, 0.08, 0.08, '#ffe48a', bx, fl + 0.94, bz, 2);
      }
      const crest = mesh(k, new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16).rotateX(Math.PI / 2), GOLD, 0.95, fl + 0.36, 0.95);
      crest.rotation.y = Math.PI / 4;
      k.flagpole(-1.18, 1.18, 1.3, fl + 0.94);
      k.flagpole(1.2, -1.2, 1.3, fl + 0.94);
      drone(k, -1.2, -1.2, fl + 0.94, 0.7, true);
      beacon(k, 1.05, fl + 0.62, 1.05 - 0.4, '#ffd23f');
      break;
    }
  }
  return k;
}

export const MORTAR_PIT: BuildingDef = {
  id: 'mortarpit',
  name: 'Mortar Pit',
  role: 'Defence: lobs splash-damage bombs at ground raiders from a dug-in pit (3-tile dead zone).',
  footprint: [3, 3],
  unlockHq: 8,
  levels: MORTAR_PIT_LEVELS,
  designedLevels: 20,
  build,
};
