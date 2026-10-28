import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../config/palette';
import { WORLD } from '../config/world';
import { fbm, mulberry32 } from '../core/rng';
import { addWindSway } from '../core/wind';
import { Terrain } from './terrain';
import { ZONES, plateauZoneAt } from './zones';

// ---------- Low-poly geometry builders ----------

const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

function jitterGeo(g: THREE.BufferGeometry, amount: number, rand: () => number) {
  // Move shared vertex positions consistently so faces stay closed.
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const map = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let o = map.get(key);
    if (!o) {
      o = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount];
      map.set(key, o);
    }
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
  g.computeVertexNormals();
  return g;
}

function blob(r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, rand: () => number) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  jitterGeo(g, r * 0.35, rand);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return ni(g);
}

function trunk(rTop: number, rBot: number, h: number, sides = 5) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, sides, 1);
  g.translate(0, h / 2, 0);
  return ni(g);
}

/** Broad tropical rain tree (canopy only; trunk separate). */
function rainCanopy(rand: () => number) {
  return mergeGeometries([
    blob(0.8, 1.25, 0.6, 1.2, 0, 1.75, 0, rand),
    blob(0.6, 1.2, 0.65, 1.1, 0.55, 1.6, 0.25, rand),
    blob(0.6, 1.1, 0.6, 1.2, -0.45, 1.65, -0.35, rand),
    blob(0.5, 1, 0.7, 1, 0.05, 2.15, 0.05, rand),
  ])!;
}

/** Taller, rounder jungle tree. */
function tallCanopy(rand: () => number) {
  return mergeGeometries([
    blob(0.7, 1, 0.85, 1, 0, 2.2, 0, rand),
    blob(0.55, 1, 0.9, 1, 0.25, 2.9, -0.1, rand),
    blob(0.45, 1, 0.9, 1, -0.2, 2.6, 0.35, rand),
  ])!;
}

/** Stacked-cone conifer, as in the reference image. */
function pineCanopy(rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  const tiers = [
    [0.78, 1.0, 0.75],
    [0.62, 0.9, 1.3],
    [0.45, 0.8, 1.8],
  ];
  for (const [r, h, y] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 7, 1);
    jitterGeo(g, 0.08, rand);
    g.translate(0, y + h / 2, 0);
    parts.push(ni(g));
  }
  return mergeGeometries(parts)!;
}

function bushGeo(rand: () => number) {
  return mergeGeometries([
    blob(0.42, 1.2, 0.75, 1.1, 0, 0.28, 0, rand),
    blob(0.32, 1.1, 0.8, 1, 0.35, 0.22, 0.1, rand),
    blob(0.3, 1, 0.8, 1.1, -0.25, 0.22, -0.25, rand),
  ])!;
}

/** Curved, segmented palm trunk. */
function palmTrunk() {
  const parts: THREE.BufferGeometry[] = [];
  const segs = 5;
  const segH = 0.48;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const r = 0.11 - i * 0.012;
    const g = new THREE.CylinderGeometry(r * 0.85, r, segH, 6, 1);
    g.translate(0, segH / 2, 0);
    g.rotateZ(-0.08 * i);
    g.translate(x, y, 0);
    parts.push(ni(g));
    const ang = 0.08 * i;
    x += Math.sin(ang) * segH;
    y += Math.cos(ang) * segH * 0.98;
  }
  return { geo: mergeGeometries(parts)!, top: new THREE.Vector3(x, y, 0) };
}

/** A single drooping palm frond with a central crease for faceting. */
function frond(len: number, width: number, droop: number) {
  const steps = 5;
  const verts: number[] = [];
  const pt = (s: number, side: number): [number, number, number] => {
    const t = s / steps;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * width * (1 - t * 0.3);
    const xx = t * len;
    const yy = Math.sin(t * 1.4) * 0.35 - t * t * droop;
    return [xx, yy + (side === 0 ? 0.04 : -0.02), side * w];
  };
  for (let s = 0; s < steps; s++) {
    const c0 = pt(s, 0);
    const c1 = pt(s + 1, 0);
    for (const side of [-1, 1]) {
      const e0 = pt(s, side);
      const e1 = pt(s + 1, side);
      verts.push(...c0, ...e0, ...c1, ...e0, ...e1, ...c1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

function palmCrown(top: THREE.Vector3, rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const f = frond(1.25 + rand() * 0.3, 0.26, 0.9 + rand() * 0.3);
    f.rotateZ(0.15);
    f.rotateY((i / count) * Math.PI * 2 + rand() * 0.3);
    f.translate(top.x, top.y, top.z);
    parts.push(f);
  }
  // Coconuts
  for (let i = 0; i < 3; i++) {
    const c = new THREE.IcosahedronGeometry(0.07, 0);
    const a = (i / 3) * Math.PI * 2;
    c.translate(top.x + Math.cos(a) * 0.09, top.y - 0.08, top.z + Math.sin(a) * 0.09);
    parts.push(c);
  }
  parts.forEach((p) => p.deleteAttribute('uv'));
  return mergeGeometries(parts)!;
}

/** Banana plant: short stem with a few broad, upright leaves. */
function bananaLeaves(rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const f = frond(0.85 + rand() * 0.2, 0.32, 0.35);
    f.rotateZ(0.55);
    f.rotateY((i / 5) * Math.PI * 2 + rand() * 0.4);
    f.translate(0, 0.55, 0);
    parts.push(f);
  }
  return mergeGeometries(parts)!;
}

/** Low fern clump for jungle undergrowth. */
function fernGeo(rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const f = frond(0.5 + rand() * 0.15, 0.1, 0.45);
    f.rotateZ(0.35);
    f.rotateY((i / 7) * Math.PI * 2 + rand() * 0.3);
    parts.push(f);
  }
  return mergeGeometries(parts)!;
}

function rockGeo(rand: () => number) {
  const g = new THREE.DodecahedronGeometry(0.4, 0);
  jitterGeo(g, 0.18, rand);
  g.scale(1.2, 0.7, 1);
  g.translate(0, 0.12, 0);
  return ni(g);
}

function tuftGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const offs = [[0, 0, 0.0], [0.08, 0.05, 0.4], [-0.07, 0.06, -0.35]];
  for (const [x, z, tilt] of offs) {
    const g = new THREE.ConeGeometry(0.05, 0.32, 3);
    g.translate(0, 0.16, 0);
    g.rotateZ(tilt);
    g.translate(x, 0, z);
    parts.push(ni(g));
  }
  return mergeGeometries(parts)!;
}

function flowerGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const offs = [[0, 0], [0.12, 0.06], [-0.08, 0.1], [0.04, -0.11]];
  for (const [x, z] of offs) {
    const g = new THREE.OctahedronGeometry(0.06, 0);
    g.translate(x, 0.12, z);
    parts.push(ni(g));
  }
  return mergeGeometries(parts)!;
}

export function logGeo() {
  const g = new THREE.CylinderGeometry(0.11, 0.13, 1.2, 6, 1);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.11, 0);
  const stub = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 5, 1);
  stub.rotateZ(-0.7);
  stub.translate(0.25, 0.25, 0.02);
  return mergeGeometries([ni(g), ni(stub)])!;
}

export function stumpGeo() {
  const g = new THREE.CylinderGeometry(0.15, 0.2, 0.26, 6, 1);
  g.translate(0, 0.13, 0);
  return ni(g);
}

/** Lalang: tall pale grass that grows in open outfield patches. */
function lalangGeo(rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const h = 0.45 + rand() * 0.3;
    const g = new THREE.ConeGeometry(0.035, h, 3);
    g.translate(0, h / 2, 0);
    g.rotateZ((rand() - 0.5) * 0.5);
    g.rotateX((rand() - 0.5) * 0.5);
    g.translate((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
    parts.push(ni(g));
  }
  return mergeGeometries(parts)!;
}

function reedGeo(rand: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.6 + rand() * 0.35;
    const g = new THREE.CylinderGeometry(0.015, 0.025, h, 4, 1);
    g.translate(0, h / 2, 0);
    g.rotateZ((rand() - 0.5) * 0.25);
    g.translate((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
    parts.push(ni(g));
    if (rand() < 0.5) {
      const head = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 5, 1);
      head.translate(0, h * 0.85, 0);
      head.rotateZ((rand() - 0.5) * 0.25);
      parts.push(ni(head));
    }
  }
  return mergeGeometries(parts)!;
}

/** Bamboo clump: culms plus a leafy top (returned separately for two materials). */
function bambooGeo(rand: () => number) {
  const culms: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const h = 2.0 + rand() * 1.1;
    const tilt = (rand() - 0.5) * 0.35;
    const a = rand() * Math.PI * 2;
    const ox = Math.cos(a) * 0.18;
    const oz = Math.sin(a) * 0.18;
    const g = new THREE.CylinderGeometry(0.04, 0.05, h, 5, 3);
    g.translate(0, h / 2, 0);
    g.rotateZ(tilt);
    g.translate(ox, 0, oz);
    culms.push(ni(g));
    leaves.push(blob(0.28, 1.4, 0.5, 1.1, ox - Math.sin(tilt) * h, h * 0.95, oz, rand));
  }
  return { culms: mergeGeometries(culms)!, leaves: mergeGeometries(leaves)! };
}

function lilyGeo() {
  const g = new THREE.CircleGeometry(0.24, 7, 0.35, Math.PI * 2 - 0.7);
  g.rotateX(-Math.PI / 2);
  const g2 = new THREE.CircleGeometry(0.16, 6, 2.2, Math.PI * 2 - 0.7);
  g2.rotateX(-Math.PI / 2);
  g2.translate(0.38, 0, 0.12);
  return mergeGeometries([g, g2])!;
}

// ---------- Instanced placement ----------

export type Kind =
  | 'pine' | 'rain' | 'tall' | 'palm' | 'banana' | 'fern' | 'bush' | 'bougain' | 'rock' | 'tuft' | 'flower'
  | 'log' | 'stump' | 'lalang' | 'reed' | 'bamboo' | 'lily';
export interface Spot { x: number; y: number; z: number; s: number; r: number; tint: number }
export type Layer = Record<Kind, Spot[]>;
/** Plants that are felled (tip over) during land clearing; everything else is grubbed out. */
export const TREE_KINDS = new Set<Kind>(['pine', 'rain', 'tall', 'palm', 'banana', 'bamboo']);

/** A clearable zone's vegetation: its spots and the instanced meshes that draw them (same index order). */
export interface ClearableVegetation {
  group: THREE.Group;
  spots: Layer;
  meshes: Record<Kind, THREE.InstancedMesh[]>;
}
const KINDS: Kind[] = ['pine', 'rain', 'tall', 'palm', 'banana', 'fern', 'bush', 'bougain', 'rock', 'tuft', 'flower', 'log', 'stump', 'lalang', 'reed', 'bamboo', 'lily'];
const emptyLayer = (): Layer => Object.fromEntries(KINDS.map((k) => [k, []])) as unknown as Layer;

const std = (opts: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0, ...opts });

export interface Vegetation {
  group: THREE.Group;
  /** One entry per clearable zone (jungle zones and hidden sites), keyed by zone id. */
  clearables: Record<string, ClearableVegetation>;
  counts: Record<string, number>;
}

export function createVegetation(terrain: Terrain): Vegetation {
  const rand = mulberry32(WORLD.seed + 42);
  const main = emptyLayer();
  const zoneLayers: Record<string, Layer> = Object.fromEntries(ZONES.filter((z) => z.kind !== 'starter').map((z) => [z.id, emptyLayer()]));
  let layer = main;
  const add = (k: Kind, x: number, y: number, z: number, sMin = 0.85, sMax = 1.25) =>
    layer[k].push({ x, y, z, s: sMin + rand() * (sMax - sMin), r: rand() * Math.PI * 2, tint: rand() });

  // Palms prefer the outer ring of the island.
  const coastal_ = (x: number, z: number) => Math.hypot(x, z) > WORLD.landRadius * 0.72;
  const jit = (c: number, a = 0.6) => c + (rand() - 0.5) * a;

  /** Deep jungle: closed canopy with undergrowth. Also used to bury hidden sites. */
  const deepJungle = (cx: number, cz: number, y: number, coastal: boolean) => {
    const n = rand() < 0.45 ? 2 : 1;
    for (let t = 0; t < n; t++) {
      const pick = rand();
      const k: Kind = pick < 0.45 ? 'rain' : pick < 0.75 ? 'tall' : pick < 0.88 ? (coastal ? 'palm' : 'banana') : 'bamboo';
      if (rand() < 0.62) add(k, jit(cx, 0.9), y, jit(cz, 0.9), 0.95, 1.45);
    }
    if (rand() < 0.55) add('fern', jit(cx, 0.9), y, jit(cz, 0.9), 1.0, 1.6);
    if (rand() < 0.22) add('bush', jit(cx, 0.9), y, jit(cz, 0.9), 0.9, 1.4);
    if (rand() < 0.03) add('log', jit(cx), y, jit(cz), 0.8, 1.2);
    if (rand() < 0.02) add('bougain', jit(cx), y, jit(cz), 0.8, 1.1);
  };

  for (let j = 0; j < terrain.n; j++) {
    for (let i = 0; i < terrain.n; i++) {
      const lvl = terrain.cellLevel(i, j);
      const [cx, cz] = terrain.cellCenter(i, j);
      const y = terrain.cellTop(i, j);
      const sq = Math.max(Math.abs(cx), Math.abs(cz));
      const r = rand();
      const site = Terrain.siteAt(cx, cz, 1.5);
      const pz = sq <= WORLD.buildHalf ? plateauZoneAt(cx, cz) : undefined;
      const jungleZone = pz?.kind === 'jungle' ? pz : undefined;
      layer = site ? zoneLayers[site.id] : jungleZone ? zoneLayers[jungleZone.id] : main;

      // ---- Sloped cells: cliff faces and banks ----
      if (lvl === null) {
        if (sq <= WORLD.buildHalf + 1) continue;
        // Reeds fringe the lake banks.
        if (y < 1.4 && Terrain.nearLake(cx, cz, 1.45)) {
          if (r < 0.35) add('reed', jit(cx), Math.max(y, WORLD.waterLevel), jit(cz), 0.9, 1.3);
          continue;
        }
        if (y < 0.6) continue;
        if (r < 0.06) add('rock', jit(cx), y, jit(cz), 0.9, 1.8);
        else if (r < 0.1) add('bush', jit(cx), y, jit(cz), 0.7, 1.1);
        else if (r < 0.12) add('fern', jit(cx), y, jit(cz), 0.8, 1.2);
        continue;
      }

      // ---- Water: lily pads in lakes, rocks in the shallows ----
      if (lvl < 0) {
        if (Terrain.nearLake(cx, cz, 1.1)) {
          if (Terrain.nearLake(cx, cz, 0.9) && r < 0.1) add('lily', jit(cx), WORLD.waterLevel + 0.1, jit(cz), 0.8, 1.3);
        } else if (y > -1.4 && y < -0.2 && r < 0.025) {
          add('rock', jit(cx), y, jit(cz), 1.6, 3.0);
        }
        continue;
      }

      const x = jit(cx);
      const z = jit(cz);
      const forest = fbm(cx * 0.09, cz * 0.09, WORLD.seed + 5, 3);
      const coastal = coastal_(cx, cz);
      const shore = terrain.isShore(cx, cz);
      const high = lvl >= WORLD.plateauLevel + 2;

      // Boulders gather at the foot of cliffs.
      const nearCliff = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => terrain.cellLevel(i + di, j + dj) === null);
      if (nearCliff && sq > WORLD.buildHalf + 1 && r < 0.07) {
        add('rock', x, y, z, 1.2, 2.4);
        continue;
      }

      if (lvl === 0 && shore) {
        if (Terrain.nearLake(cx, cz, 1.7)) {
          // Lake banks: reeds and the odd bamboo clump.
          if (r < 0.28) add('reed', x, y, z, 0.9, 1.3);
          else if (r < 0.31) add('bamboo', x, y, z, 0.8, 1.1);
          else if (r < 0.36) add('tuft', x, y, z);
        } else {
          // Beaches: palms, rocks, driftwood.
          if (r < 0.07) add('palm', x, y, z, 0.9, 1.35);
          else if (r < 0.1) add('rock', x, y, z, 0.6, 1.4);
          else if (r < 0.115) add('log', x, y, z, 0.45, 0.7);
          else if (r < 0.14) add('tuft', x, y, z);
        }
      } else if (jungleZone) {
        // Overgrown plateau zones: cleared one by one as the outpost expands.
        deepJungle(cx, cz, y, false);
        if (rand() < 0.03) add('rock', jit(cx), y, jit(cz), 0.8, 1.6);
      } else if (sq <= WORLD.buildHalf) {
        // The starting clearing: open ground with a few trees and rocks to clear.
        const tree = (): Kind => (rand() < 0.5 ? 'rain' : rand() < 0.5 ? 'palm' : 'tall');
        if (r < 0.006) add(tree(), x, y, z);
        else if (r < 0.014) add('rock', x, y, z, 0.6, 1.3);
        else if (r < 0.022) add('bush', x, y, z, 0.7, 1.1);
        else if (r < 0.025) add('bougain', x, y, z, 0.7, 1.0);
        else if (r < 0.028) add('stump', x, y, z, 0.8, 1.1);
        else if (r < 0.045) add('flower', x, y, z);
        else if (r < 0.09) add('tuft', x, y, z, 1.0, 1.5);
      } else if (site || forest > 0.32) {
        // Deep jungle (hidden sites are buried in exactly the same mix).
        deepJungle(cx, cz, y, coastal);
      } else {
        // Wild country: jungle edges, meadows, lalang fields, bamboo stands.
        const dense = forest > 0.05;
        const lalang = fbm(cx * 0.11 + 40, cz * 0.11 - 12, WORLD.seed + 77, 2) > 0.28 && !dense;
        const bamboo = fbm(cx * 0.14 - 9, cz * 0.14 + 30, WORLD.seed + 91, 2) > 0.42 && !coastal;
        if (high && r < 0.05) add('pine', x, y, z, 0.9, 1.4);
        else if (bamboo && r < 0.3) add('bamboo', x, y, z, 0.9, 1.3);
        else if (dense && r < 0.2) add(rand() < 0.6 ? 'rain' : 'tall', x, y, z, 0.9, 1.35);
        else if (dense && r < 0.26) add(coastal ? 'palm' : 'banana', x, y, z, 0.9, 1.3);
        else if (dense && r < 0.38) add('fern', x, y, z, 0.9, 1.5);
        else if (dense && r < 0.44) add('bush', x, y, z, 0.8, 1.3);
        else if (lalang && r < 0.55) {
          add('lalang', x, y, z, 0.9, 1.4);
          if (rand() < 0.4) add('lalang', jit(cx, 0.9), y, jit(cz, 0.9), 0.8, 1.2);
        } else if (r < 0.025) add(coastal ? 'palm' : 'rain', x, y, z, 0.8, 1.2);
        else if (r < 0.04) add('bush', x, y, z);
        else if (r < 0.048) add('bougain', x, y, z, 0.8, 1.2);
        else if (r < 0.06) add('rock', x, y, z, 0.6, 1.4);
        else if (r < 0.066) add('log', x, y, z, 0.7, 1.1);
        else if (r < 0.072) add('stump', x, y, z, 0.8, 1.2);
        else if (r < 0.11) add('tuft', x, y, z);
        else if (r < 0.13) add('flower', x, y, z);
      }
    }
  }

  // ---- Build instanced meshes per layer ----
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();

  const trunkMat = std({ color: PALETTE.trunk });
  const palmTrunkMat = std({ color: PALETTE.trunkPalm });
  const tintMat = std({ color: '#ffffff' });
  const leafMat = std({ color: '#ffffff' });
  addWindSway(leafMat, 0.035, 1.2);
  const pineMat = std({ color: '#ffffff' });
  addWindSway(pineMat, 0.02, 1.0);
  const frondMat = std({ color: '#ffffff', side: THREE.DoubleSide });
  addWindSway(frondMat, 0.05, 1.6);
  const bushMat = std({ color: '#ffffff' });
  addWindSway(bushMat, 0.03, 0.15);
  const grassMat = std({ color: '#ffffff' });
  addWindSway(grassMat, 0.12, 0.02);
  const bambooMat = std({ color: '#ffffff' });
  addWindSway(bambooMat, 0.03, 0.8);
  const lilyMat = std({ color: '#ffffff', side: THREE.DoubleSide });
  const leaves = [PALETTE.leafA, PALETTE.leafB, PALETTE.leafC, PALETTE.grassDeep];
  const pt = palmTrunk();
  const bamboo = bambooGeo(rand);

  interface Part { kind: Kind; geo: THREE.BufferGeometry; mat: THREE.Material; colors?: string[]; cast?: boolean }
  const parts: Part[] = [
    { kind: 'pine', geo: trunk(0.08, 0.13, 0.9), mat: trunkMat },
    { kind: 'pine', geo: pineCanopy(rand), mat: pineMat, colors: [PALETTE.pineA, PALETTE.pineB, PALETTE.pineC] },
    { kind: 'rain', geo: trunk(0.1, 0.17, 1.55), mat: trunkMat },
    { kind: 'rain', geo: rainCanopy(rand), mat: leafMat, colors: leaves },
    { kind: 'tall', geo: trunk(0.09, 0.15, 2.0), mat: trunkMat },
    { kind: 'tall', geo: tallCanopy(rand), mat: leafMat, colors: [PALETTE.leafB, PALETTE.grassForest, PALETTE.leafA] },
    { kind: 'palm', geo: pt.geo, mat: palmTrunkMat },
    { kind: 'palm', geo: palmCrown(pt.top, rand), mat: frondMat, colors: [PALETTE.leafPalm, PALETTE.leafC, PALETTE.leafA] },
    { kind: 'banana', geo: trunk(0.06, 0.09, 0.6, 5), mat: palmTrunkMat },
    { kind: 'banana', geo: bananaLeaves(rand), mat: frondMat, colors: [PALETTE.banana, PALETTE.leafC] },
    { kind: 'fern', geo: fernGeo(rand), mat: frondMat, colors: [PALETTE.fern, PALETTE.leafB, PALETTE.leafC], cast: false },
    { kind: 'bush', geo: bushGeo(rand), mat: bushMat, colors: [PALETTE.bush, PALETTE.leafB, PALETTE.leafC, PALETTE.olive] },
    { kind: 'bougain', geo: bushGeo(rand), mat: bushMat, colors: [PALETTE.bougainvillea, PALETTE.bougainvilleaB, PALETTE.flowerOrange] },
    { kind: 'rock', geo: rockGeo(rand), mat: tintMat, colors: [PALETTE.rock, PALETTE.rockDark, PALETTE.cliffLight] },
    { kind: 'tuft', geo: tuftGeo(), mat: grassMat, colors: [PALETTE.grassBright, PALETTE.grassDeep, PALETTE.leafC], cast: false },
    { kind: 'flower', geo: flowerGeo(), mat: tintMat, colors: [PALETTE.flowerOrange, PALETTE.flowerYellow, PALETTE.flowerPink, '#ffffff'], cast: false },
    { kind: 'log', geo: logGeo(), mat: tintMat, colors: [PALETTE.trunk, PALETTE.wood, '#9c8466'] },
    { kind: 'stump', geo: stumpGeo(), mat: tintMat, colors: [PALETTE.trunk, PALETTE.wood] },
    { kind: 'lalang', geo: lalangGeo(rand), mat: grassMat, colors: [PALETTE.lalang, PALETTE.lalangB, PALETTE.grassLime], cast: false },
    { kind: 'reed', geo: reedGeo(rand), mat: grassMat, colors: [PALETTE.reed, PALETTE.grassDeep], cast: false },
    { kind: 'bamboo', geo: bamboo.culms, mat: bambooMat, colors: [PALETTE.bamboo, PALETTE.bambooB] },
    { kind: 'bamboo', geo: bamboo.leaves, mat: leafMat, colors: [PALETTE.leafC, PALETTE.leafA] },
    { kind: 'lily', geo: lilyGeo(), mat: lilyMat, colors: [PALETTE.leafA, PALETTE.leafC, PALETTE.grassDeep], cast: false },
  ];

  const build = (l: Layer, name: string): ClearableVegetation => {
    const g = new THREE.Group();
    g.name = name;
    const meshes = Object.fromEntries(KINDS.map((k) => [k, []])) as unknown as Record<Kind, THREE.InstancedMesh[]>;
    for (const p of parts) {
      const list = l[p.kind];
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(p.geo, p.mat, list.length);
      list.forEach((s, idx) => {
        q.setFromAxisAngle(up, s.r);
        m4.compose(new THREE.Vector3(s.x, s.y - 0.02, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
        mesh.setMatrixAt(idx, m4);
        if (p.colors) {
          const k = Math.floor(s.tint * p.colors.length) % p.colors.length;
          tmpC.set(p.colors[k]).multiplyScalar(0.92 + s.tint * 0.16);
          mesh.setColorAt(idx, tmpC);
        }
      });
      mesh.castShadow = p.cast ?? true;
      mesh.receiveShadow = true;
      g.add(mesh);
      meshes[p.kind].push(mesh);
    }
    return { group: g, spots: l, meshes };
  };

  const group = build(main, 'vegetation').group;
  const clearables: Record<string, ClearableVegetation> = {};
  for (const [id, l] of Object.entries(zoneLayers)) {
    clearables[id] = build(l, `zone:${id}`);
    group.add(clearables[id].group);
  }
  const counts: Record<string, number> = {};
  for (const l of [main, ...Object.values(zoneLayers)]) for (const k of KINDS) counts[k] = (counts[k] ?? 0) + l[k].length;
  return { group, clearables, counts };
}
