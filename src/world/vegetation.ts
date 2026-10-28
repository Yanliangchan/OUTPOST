import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../config/palette';
import { WORLD } from '../config/world';
import { fbm, mulberry32 } from '../core/rng';
import { addWindSway } from '../core/wind';
import type { Terrain } from './terrain';

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

// ---------- Instanced placement ----------

type Kind = 'pine' | 'rain' | 'tall' | 'palm' | 'banana' | 'fern' | 'bush' | 'bougain' | 'rock' | 'tuft' | 'flower';
interface Spot { x: number; y: number; z: number; s: number; r: number; tint: number }

const std = (opts: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0, ...opts });

export function createVegetation(terrain: Terrain): THREE.Group {
  const rand = mulberry32(WORLD.seed + 42);
  const spots: Record<Kind, Spot[]> = { pine: [], rain: [], tall: [], palm: [], banana: [], fern: [], bush: [], bougain: [], rock: [], tuft: [], flower: [] };
  const add = (k: Kind, x: number, y: number, z: number, sMin = 0.85, sMax = 1.25) =>
    spots[k].push({ x, y, z, s: sMin + rand() * (sMax - sMin), r: rand() * Math.PI * 2, tint: rand() });

  // Palms prefer the outer ring of the island.
  const coastal_ = (x: number, z: number) => Math.hypot(x, z) > WORLD.landRadius * 0.72;

  for (let j = 0; j < terrain.n; j++) {
    for (let i = 0; i < terrain.n; i++) {
      const lvl = terrain.cellLevel(i, j);
      if (lvl === null || lvl < 0) continue;
      const [cx, cz] = terrain.cellCenter(i, j);
      const x = cx + (rand() - 0.5) * 0.6;
      const z = cz + (rand() - 0.5) * 0.6;
      const y = terrain.cellTop(i, j);
      const sq = Math.max(Math.abs(cx), Math.abs(cz));
      const forest = fbm(cx * 0.09, cz * 0.09, WORLD.seed + 5, 3);
      const r = rand();

      // Boulders gather at the foot of cliffs.
      const nearCliff = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => terrain.cellLevel(i + di, j + dj) === null);
      if (nearCliff && sq > WORLD.buildHalf + 1 && r < 0.07) {
        add('rock', x, y, z, 1.2, 2.4);
        continue;
      }

      const shore = terrain.isShore(cx, cz);
      const high = lvl >= WORLD.plateauLevel + 2;
      if (lvl === 0 && shore) {
        // Beaches: palms, a few rocks.
        if (r < 0.07) add('palm', x, y, z, 0.9, 1.35);
        else if (r < 0.1) add('rock', x, y, z, 0.6, 1.4);
        else if (r < 0.13) add('tuft', x, y, z);
      } else if (sq <= WORLD.buildHalf) {
        // The open plateau: a clearing with a few groves and scattered clutter.
        const starter = sq <= WORLD.starterHalf;
        const grove = forest > 0.3 && !starter;
        const tree = (): Kind => (rand() < 0.5 ? 'rain' : rand() < 0.5 ? 'palm' : 'tall');
        if (grove && r < 0.14) add(tree(), x, y, z);
        else if (grove && r < 0.22) add(rand() < 0.5 ? 'banana' : 'fern', x, y, z);
        else if (r < (starter ? 0.004 : 0.01)) add(tree(), x, y, z);
        else if (r < 0.018) add('rock', x, y, z, 0.6, 1.3);
        else if (r < 0.026) add('bush', x, y, z, 0.7, 1.1);
        else if (r < 0.029) add('bougain', x, y, z, 0.7, 1.0);
        else if (r < 0.05) add('flower', x, y, z);
        else if (r < 0.1) add('tuft', x, y, z, 1.0, 1.5);
      } else {
        // Tropical jungle with open meadows; a few conifers on the high ground.
        const dense = forest > 0.05;
        const coastal = coastal_(cx, cz);
        if (high && r < 0.05) add('pine', x, y, z, 0.9, 1.4);
        else if (dense && r < 0.17) add(rand() < 0.6 ? 'rain' : 'tall', x, y, z, 0.9, 1.35);
        else if (dense && r < 0.22) add(coastal ? 'palm' : 'banana', x, y, z, 0.9, 1.3);
        else if (dense && r < 0.33) add('fern', x, y, z, 0.9, 1.5);
        else if (dense && r < 0.39) add('bush', x, y, z, 0.8, 1.3);
        else if (r < 0.025) add(coastal ? 'palm' : 'rain', x, y, z, 0.8, 1.2);
        else if (r < 0.04) add('bush', x, y, z);
        else if (r < 0.048) add('bougain', x, y, z, 0.8, 1.2);
        else if (r < 0.06) add('rock', x, y, z, 0.6, 1.4);
        else if (r < 0.1) add('tuft', x, y, z);
        else if (r < 0.12) add('flower', x, y, z);
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'vegetation';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();

  const instanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    list: Spot[],
    colors?: string[],
    opts: { cast?: boolean; tilt?: number } = {},
  ) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(list.length, 1));
    mesh.count = list.length;
    list.forEach((s, idx) => {
      q.setFromAxisAngle(up, s.r);
      m4.compose(new THREE.Vector3(s.x, s.y - 0.02, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      mesh.setMatrixAt(idx, m4);
      if (colors) {
        const k = Math.floor(s.tint * colors.length) % colors.length;
        tmpC.set(colors[k]).multiplyScalar(0.92 + s.tint * 0.16);
        mesh.setColorAt(idx, tmpC);
      }
    });
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const trunkMat = std({ color: PALETTE.trunk });
  const leafMat = std({ color: '#ffffff' });
  addWindSway(leafMat, 0.035, 1.2);
  const leaves = [PALETTE.leafA, PALETTE.leafB, PALETTE.leafC, PALETTE.grassDeep];

  // Conifers
  instanced(trunk(0.08, 0.13, 0.9), trunkMat, spots.pine);
  const pineMat = std({ color: '#ffffff' });
  addWindSway(pineMat, 0.02, 1.0);
  instanced(pineCanopy(rand), pineMat, spots.pine, [PALETTE.pineA, PALETTE.pineB, PALETTE.pineC]);
  // Rain trees
  instanced(trunk(0.1, 0.17, 1.55), trunkMat, spots.rain);
  instanced(rainCanopy(rand), leafMat, spots.rain, leaves);
  // Tall trees
  instanced(trunk(0.09, 0.15, 2.0), trunkMat, spots.tall);
  instanced(tallCanopy(rand), leafMat, spots.tall, [PALETTE.leafB, PALETTE.grassForest, PALETTE.leafA]);
  // Palms
  const pt = palmTrunk();
  const palmTrunkMat = std({ color: PALETTE.trunkPalm });
  instanced(pt.geo, palmTrunkMat, spots.palm);
  const frondMat = std({ color: '#ffffff', side: THREE.DoubleSide });
  addWindSway(frondMat, 0.05, 1.6);
  instanced(palmCrown(pt.top, rand), frondMat, spots.palm, [PALETTE.leafPalm, PALETTE.leafC, PALETTE.leafA]);
  // Banana plants and ferns
  instanced(trunk(0.06, 0.09, 0.6, 5), palmTrunkMat, spots.banana);
  instanced(bananaLeaves(rand), frondMat, spots.banana, [PALETTE.banana, PALETTE.leafC]);
  instanced(fernGeo(rand), frondMat, spots.fern, [PALETTE.fern, PALETTE.leafB, PALETTE.leafC], { cast: false });
  // Bushes
  const bushMat = std({ color: '#ffffff' });
  addWindSway(bushMat, 0.03, 0.15);
  instanced(bushGeo(rand), bushMat, spots.bush, [PALETTE.bush, PALETTE.leafB, PALETTE.leafC, PALETTE.olive]);
  // Bougainvillea: flowering bushes for a splash of tropical colour
  instanced(bushGeo(rand), bushMat, spots.bougain, [PALETTE.bougainvillea, PALETTE.bougainvilleaB, PALETTE.flowerOrange]);
  // Rocks
  instanced(rockGeo(rand), std({ color: '#ffffff' }), spots.rock, [PALETTE.rock, PALETTE.rockDark, PALETTE.cliffLight]);
  // Grass tufts and flowers (no shadow casting — too small to matter)
  const tuftMat = std({ color: '#ffffff' });
  addWindSway(tuftMat, 0.12, 0.02);
  instanced(tuftGeo(), tuftMat, spots.tuft, [PALETTE.grassBright, PALETTE.grassDeep, PALETTE.leafC], { cast: false });
  instanced(flowerGeo(), std({ color: '#ffffff' }), spots.flower, [PALETTE.flowerOrange, PALETTE.flowerYellow, PALETTE.flowerPink, '#ffffff'], { cast: false });

  group.userData.counts = Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v.length]));
  return group;
}
