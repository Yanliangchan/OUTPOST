import * as THREE from 'three';
import { WORLD } from '../config/world';
import { PALETTE } from '../config/palette';
import { clamp, fbm, mulberry32, smoothstep } from '../core/rng';
import { applyCloudShadow } from '../core/cloudShadow';

const C = (hex: string) => new THREE.Color(hex);

/**
 * Terraced, faceted heightfield island.
 * Heights are quantised into "levels" so cliffs form crisp layered steps,
 * then vertices are jittered to give the hand-cut low-poly look.
 */
export class Terrain {
  readonly n = WORLD.gridCells;
  readonly half = WORLD.gridCells / 2;
  readonly levels: Int8Array;
  readonly heights: Float32Array;
  readonly mesh: THREE.Mesh;
  private readonly dist: Float32Array;
  /** 1 where a vertex lies within a couple of tiles of open water. */
  readonly shore: Uint8Array;

  constructor(private readonly seed = WORLD.seed) {
    const v = this.n + 1;
    this.levels = new Int8Array(v * v);
    this.heights = new Float32Array(v * v);
    this.dist = new Float32Array(v * v);
    this.shore = new Uint8Array(v * v);
    this.generateLevels();
    this.computeShore();
    this.mesh = this.buildMesh();
  }

  /** Vertex index for grid coords. */
  private vi(i: number, j: number) {
    return j * (this.n + 1) + i;
  }

  static levelHeight(level: number) {
    return WORLD.levelHeights[clamp(level + 1, 0, WORLD.levelHeights.length - 1)];
  }

  private generateLevels() {
    const { seed } = this;
    for (let j = 0; j <= this.n; j++) {
      for (let i = 0; i <= this.n; i++) {
        const x = i - this.half;
        const z = j - this.half;
        const ax = Math.abs(x);
        const az = Math.abs(z);
        const len = Math.hypot(x, z) || 1;
        // 1 at the back diagonal (away from the default camera), 0 at the front.
        const back = clamp(-(x + z) / (Math.SQRT2 * len), 0, 1);
        const R = WORLD.landRadius;
        const P = WORLD.islandShapePower;
        // Rounded island with coves and headlands from low-frequency noise.
        const d =
          Math.pow(Math.pow(ax / R, P) + Math.pow(az / R, P), 1 / P) +
          fbm(x * 0.022, z * 0.022, seed, 4) * 0.16 +
          fbm(x * 0.07, z * 0.07, seed + 4, 2) * 0.03;

        // Rolling terraced relief around the flat build plateau.
        const sq = Math.max(ax, az);
        const edge = smoothstep(WORLD.buildHalf + 1.5, WORLD.buildHalf + 7, sq);
        let rel = fbm(x * 0.02 + 11, z * 0.02 - 7, seed + 21, 3) * 5.5 + back * 2.2 + 0.6;
        for (const lake of WORLD.lakes) {
          const ld = Math.hypot(x - lake.x, z - lake.z) / lake.r + fbm(x * 0.15, z * 0.15, seed + 31, 2) * 0.25;
          rel -= smoothstep(1.25, 0.35, ld) * lake.depth;
        }
        let level = WORLD.plateauLevel + Math.round(clamp(rel * edge, -2, 5));
        if (level < 0) level = -1;

        // The landmass eventually falls away to the sea at the map edge.
        // Terraces step down toward the coast, then a beach ring, then the sea.
        level = Math.min(level, WORLD.plateauLevel + Math.floor((1 - d) * 28));
        if (d > WORLD.beachEnd) level = -1;
        else if (d > 1) level = Math.min(level, 0);

        if (sq <= WORLD.buildHalf + 1.5) level = WORLD.plateauLevel;
        const site = Terrain.siteAt(x, z, 0.5);
        if (site) level = site.level;

        const idx = this.vi(i, j);
        this.levels[idx] = level;
        this.dist[idx] = d;
      }
    }
  }

  private computeShore() {
    const r = 2;
    for (let j = 0; j <= this.n; j++) {
      for (let i = 0; i <= this.n; i++) {
        if (this.levels[this.vi(i, j)] > 0) continue;
        let near = false;
        for (let dj = -r; dj <= r && !near; dj++) {
          for (let di = -r; di <= r; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii > this.n || jj > this.n) continue;
            if (this.levels[this.vi(ii, jj)] < 0) { near = true; break; }
          }
        }
        if (near) this.shore[this.vi(i, j)] = 1;
      }
    }
  }

  isShore(x: number, z: number) {
    const i = clamp(Math.round(x + this.half), 0, this.n);
    const j = clamp(Math.round(z + this.half), 0, this.n);
    return this.shore[this.vi(i, j)] === 1;
  }

  private buildMesh(): THREE.Mesh {
    const rand = mulberry32(this.seed + 7);
    const v = this.n + 1;
    const px = new Float32Array(v * v);
    const pz = new Float32Array(v * v);
    const inBuild = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) <= WORLD.buildHalf + 1;

    for (let j = 0; j <= this.n; j++) {
      for (let i = 0; i <= this.n; i++) {
        const idx = this.vi(i, j);
        const x = i - this.half;
        const z = j - this.half;
        const border = i === 0 || j === 0 || i === this.n || j === this.n;
        const flat = inBuild(x, z);
        const jit = border || flat ? 0 : WORLD.vertexJitter;
        const yJit = border ? 0 : flat ? 0.035 : 0.07;
        px[idx] = x + (rand() * 2 - 1) * jit;
        pz[idx] = z + (rand() * 2 - 1) * jit;
        const level = this.levels[idx];
        let y: number;
        if (level < 0) {
          y = this.dist[idx] > WORLD.beachEnd
            ? clamp(-0.25 - (this.dist[idx] - WORLD.beachEnd) * 11, -5, -0.25)
            : Terrain.levelHeight(-1);
        } else {
          y = Terrain.levelHeight(level) + (rand() * 2 - 1) * yJit;
        }
        this.heights[idx] = y;
      }
    }

    const triCount = this.n * this.n * 2;
    const pos = new Float32Array(triCount * 9);
    const col = new Float32Array(triCount * 9);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const color = new THREE.Color();
    let t = 0;

    const pushTri = (i0: number, i1: number, i2: number) => {
      a.set(px[i0], this.heights[i0], pz[i0]);
      b.set(px[i1], this.heights[i1], pz[i1]);
      c.set(px[i2], this.heights[i2], pz[i2]);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      nrm.crossVectors(ab, ac).normalize();
      if (nrm.y < 0) {
        nrm.negate();
        // keep CCW winding facing up
        const tmp = b.clone();
        b.copy(c);
        c.copy(tmp);
      }
      const cx = (a.x + b.x + c.x) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      this.faceColor(color, nrm.y, cx, cy, cz, rand);
      const o = t * 9;
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], o);
      for (let k = 0; k < 3; k++) col.set([color.r, color.g, color.b], o + k * 3);
      t++;
    };

    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const i00 = this.vi(i, j);
        const i10 = this.vi(i + 1, j);
        const i01 = this.vi(i, j + 1);
        const i11 = this.vi(i + 1, j + 1);
        // Alternate the split diagonal for a less regular facet pattern.
        if ((i + j) % 2 === 0) {
          pushTri(i00, i01, i11);
          pushTri(i00, i11, i10);
        } else {
          pushTri(i00, i01, i10);
          pushTri(i10, i01, i11);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (shader) => applyCloudShadow(shader);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  private faceColor(out: THREE.Color, ny: number, x: number, y: number, z: number, rand: () => number) {
    const jitter = 1 + (rand() * 2 - 1) * 0.025;
    const water = WORLD.waterLevel;
    if (y < water - 0.05) {
      const depth = clamp((water - y) / 4, 0, 1);
      out.copy(C(PALETTE.seabedShallow)).lerp(C(PALETTE.seabedDeep), depth);
    } else if (y < 0.85 && this.isShore(x, z)) {
      out.copy(C(ny > 0.75 ? PALETTE.sand : PALETTE.sandWet));
    } else if (ny > 0.72) {
      const patch = fbm(x * 0.12, z * 0.12, this.seed + 3, 3);
      const sq = Math.max(Math.abs(x), Math.abs(z));
      if (sq <= WORLD.buildHalf + 1) {
        out.copy(C(PALETTE.grassBright)).lerp(C(PALETTE.grassLime), clamp(patch * 0.9 + 0.45, 0, 1));
      } else {
        out.copy(C(PALETTE.grassBright)).lerp(C(PALETTE.grassLime), clamp(patch * 0.8 + 0.5, 0, 1));
        if (patch < -0.35) out.lerp(C(PALETTE.grassDeep), 0.35);
      }
    } else {
      // Cliff faces: horizontal rock strata.
      // Cliff faces: pale faceted rock, lit per-facet by flat shading.
      const band = Math.floor(y * 1.3 + fbm(x * 0.3, z * 0.3, this.seed + 11, 2) * 0.8);
      const bands = [PALETTE.cliffLight, PALETTE.cliffMid, PALETTE.cliffLight, PALETTE.cliffLight];
      out.copy(C(bands[((band % 4) + 4) % 4]));
      if (ny > 0.68) out.copy(C(PALETTE.grassDeep));
    }
    out.multiplyScalar(jitter);
  }

  /** The hidden site containing a point, if any (with optional margin in tiles). */
  static siteAt(x: number, z: number, margin = 0) {
    return WORLD.hiddenSites.find((s) => Math.abs(x - s.x) <= s.half + margin && Math.abs(z - s.z) <= s.half + margin);
  }

  /** True for open water inside one of the island's lakes (not the sea). */
  static nearLake(x: number, z: number, scale = 1) {
    return WORLD.lakes.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * scale);
  }

  /** True when all four corners of a cell share one level (a flat tile). */
  cellLevel(i: number, j: number): number | null {
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return null;
    const l = this.levels[this.vi(i, j)];
    if (this.levels[this.vi(i + 1, j)] !== l || this.levels[this.vi(i, j + 1)] !== l || this.levels[this.vi(i + 1, j + 1)] !== l) {
      return null;
    }
    return l;
  }

  /** Approximate surface height at the centre of a flat cell. */
  cellTop(i: number, j: number): number {
    const h = this.heights;
    return (h[this.vi(i, j)] + h[this.vi(i + 1, j)] + h[this.vi(i, j + 1)] + h[this.vi(i + 1, j + 1)]) / 4;
  }

  cellCenter(i: number, j: number): [number, number] {
    return [i - this.half + 0.5, j - this.half + 0.5];
  }

  get plateauHeight() {
    return Terrain.levelHeight(WORLD.plateauLevel);
  }
}
