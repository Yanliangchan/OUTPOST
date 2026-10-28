import * as THREE from 'three';
import { TREE_KINDS, stumpGeo, type ClearableVegetation, type Kind, type Spot } from '../world/vegetation';
import type { Zone } from '../world/zones';
import { Terrain } from '../world/terrain';
import { DUST, LEAF, SAWDUST, SMOKE, type Particles } from '../fx/particles';
import { createBulldozer, createExcavator, createLogTruck, Driver, type Bulldozer, type Excavator, type LogTruck } from '../vehicles/models';
import { createWorker, Walker, type WorkerRig } from '../agents/worker';
import { createSiteProps, type SiteProps } from './siteProps';
import { GRADE_LAG, HAUL_LAG, REGROW_FRACTION } from './pacing';

export type Side = 'minX' | 'maxX' | 'minZ' | 'maxZ';

interface ItemRef {
  kind: Kind;
  i: number;
  x: number;
  y: number;
  z: number;
  s: number;
  r: number;
  /** Set when felled: direction it fell and the real time the fall finishes. */
  fallDir?: THREE.Vector3;
  fallEndAt?: number;
}
interface Stump { si: number; base: THREE.Vector3; q: THREE.Quaternion; s: number; readyAt: number }
interface Tile {
  cx: number;
  cz: number;
  items: ItemRef[];
  trees: ItemRef[];
  stumps: Stump[];
  regrowAt: number;
}

interface Anim { start: number; dur: number; fn: (t: number) => void; done?: () => void }

const UP = new THREE.Vector3(0, 1, 0);
const ease = (t: number) => t * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const FRESH_DIRT = new THREE.Color('#8a6a48');
const GRADED_DIRT = new THREE.Color('#b8956b');

/**
 * One land-clearance job: the contractor crew works through a jungle zone
 * tile by tile in serpentine rows starting from the entrance edge.
 *
 * Per tile, driven purely by game-time progress (so it can be saved and caught up):
 *   1. felled  — chainsaw crew drops the trees (they tip over away from the crew)
 *   2. hauled  — logs are removed, stumps remain, undergrowth grubbed out, raw dirt
 *   3. graded  — bulldozer pushes out stumps and levels the ground
 *   4. regrown — after the job, grass slowly reclaims the bare ground (patchily)
 */
export class ClearanceJob {
  readonly group = new THREE.Group();
  readonly tiles: Tile[] = [];
  private readonly inward = new THREE.Vector3();
  private readonly along = new THREE.Vector3();
  readonly gate = new THREE.Vector3();
  private readonly groundY: number;
  private felled = 0;
  private hauled = 0;
  private graded = 0;
  private realTime = 0;
  private anims: Anim[] = [];
  private dirt: THREE.InstancedMesh;
  private stumps: THREE.InstancedMesh;
  private stumpCount = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private dirty = new Set<THREE.InstancedMesh>();
  private site: SiteProps;
  private ex: Excavator;
  private exDriver: Driver;
  private dz: Bulldozer;
  private dzDriver: Driver;
  private dzPhase: 'forward' | 'back' = 'forward';
  private truck: LogTruck;
  private truckDriver: Driver;
  private truckState: 'park' | 'toLoad' | 'loading' | 'toPile' | 'unloading' = 'park';
  private truckRoute: THREE.Vector3[] = [];
  private truckTimer = 0;
  private loadsPending = 0;
  private treesSinceLoad = 0;
  private pileLogs = 0;
  private crew: { walker: Walker; role: 'saw' | 'flag' | 'boss' | 'rake'; slot: number; wait: number; step: number }[] = [];
  private activeFalls = 0;
  private finished = false;
  private regrowDone = false;
  private packedUp = false;

  constructor(
    readonly zone: Zone,
    private readonly veg: ClearableVegetation,
    readonly side: Side,
    readonly startTime: number,
    readonly duration: number,
    private readonly fx: Particles,
  ) {
    this.group.name = `clearance:${zone.id}`;
    this.groundY = Terrain.levelHeight(zone.level);
    this.setupFrame();
    this.buildTiles();
    this.dirt = this.makeDirt();
    this.stumps = this.makeStumps();
    this.site = createSiteProps(this.gate, this.inward, this.edgeLength, new THREE.Vector3(0, this.groundY, 0));
    this.group.add(this.site.group);
    this.popIn(this.site.group);

    this.ex = createExcavator();
    this.exDriver = new Driver(this.ex.root, 1.4, 1.3);
    this.dz = createBulldozer();
    this.dzDriver = new Driver(this.dz.root, 1.3, 1.5);
    this.truck = createLogTruck();
    this.truckDriver = new Driver(this.truck.root, 2.6, 1.4, 2.0);
    const start = this.gate.clone().addScaledVector(this.inward, -2.2);
    this.ex.root.position.copy(start).addScaledVector(this.along, 1.2);
    this.dz.root.position.copy(start).addScaledVector(this.along, -1.2).addScaledVector(this.inward, -1);
    this.truck.root.position.copy(this.site.truckPark);
    for (const d of [this.exDriver, this.dzDriver, this.truckDriver]) d.face(this.inward);
    this.group.add(this.ex.root, this.dz.root, this.truck.root);

    const roles: ('saw' | 'flag' | 'boss' | 'rake')[] = ['saw', 'saw', 'flag', 'boss', 'rake'];
    roles.forEach((role, n) => {
      const tool = role === 'saw' ? 'chainsaw' : role === 'flag' ? 'flag' : role === 'boss' ? 'clipboard' : 'rake';
      const rig: WorkerRig = createWorker(tool, n + zone.id.charCodeAt(0), role === 'boss');
      rig.root.position.copy(this.site.cabinDoor).addScaledVector(this.along, (n - 2) * 0.35);
      this.group.add(rig.root);
      this.crew.push({ walker: new Walker(rig, role === 'boss' ? 0.7 : 0.95), role, slot: n, wait: 0, step: 0 });
    });
  }

  // ---------- Setup ----------

  private get edgeLength() {
    return this.side === 'minX' || this.side === 'maxX' ? this.zone.maxZ - this.zone.minZ : this.zone.maxX - this.zone.minX;
  }

  private setupFrame() {
    const z = this.zone;
    const cx = (z.minX + z.maxX) / 2;
    const cz = (z.minZ + z.maxZ) / 2;
    const map: Record<Side, [number, number, number, number]> = {
      minX: [1, 0, z.minX, cz],
      maxX: [-1, 0, z.maxX, cz],
      minZ: [0, 1, cx, z.minZ],
      maxZ: [0, -1, cx, z.maxZ],
    };
    const [nx, nz, gx, gz] = map[this.side];
    this.inward.set(nx, 0, nz);
    this.along.crossVectors(UP, this.inward.clone().negate());
    this.gate.set(gx, this.groundY, gz);
  }

  /** Serpentine tile order: rows parallel to the entrance edge, working inward. */
  private buildTiles() {
    const z = this.zone;
    const w = z.maxX - z.minX;
    const d = z.maxZ - z.minZ;
    const rows = this.side === 'minX' || this.side === 'maxX' ? w : d;
    const cols = this.side === 'minX' || this.side === 'maxX' ? d : w;
    const grid = new Map<string, Tile>();
    const key = (ix: number, iz: number) => `${ix},${iz}`;
    for (let r = 0; r < rows; r++) {
      for (let c0 = 0; c0 < cols; c0++) {
        const c = r % 2 === 0 ? c0 : cols - 1 - c0;
        let ix: number, iz: number;
        switch (this.side) {
          case 'minX': ix = r; iz = c; break;
          case 'maxX': ix = w - 1 - r; iz = c; break;
          case 'minZ': ix = c; iz = r; break;
          default: ix = c; iz = d - 1 - r;
        }
        const tile: Tile = { cx: z.minX + ix + 0.5, cz: z.minZ + iz + 0.5, items: [], trees: [], stumps: [], regrowAt: Math.random() * 0.8 };
        this.tiles.push(tile);
        grid.set(key(ix, iz), tile);
      }
    }
    // Assign every plant / rock in the zone to the tile it stands on.
    for (const [kind, list] of Object.entries(this.veg.spots) as [Kind, Spot[]][]) {
      list.forEach((s, i) => {
        const ix = Math.max(0, Math.min(w - 1, Math.floor(s.x - z.minX)));
        const iz = Math.max(0, Math.min(d - 1, Math.floor(s.z - z.minZ)));
        const t = grid.get(key(ix, iz))!;
        const ref: ItemRef = { kind, i, x: s.x, y: s.y, z: s.z, s: s.s, r: s.r };
        (TREE_KINDS.has(kind) ? t.trees : t.items).push(ref);
      });
    }
  }

  private makeDirt() {
    const geo = new THREE.PlaneGeometry(1.04, 1.04).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), this.tiles.length);
    mesh.receiveShadow = true;
    this.tiles.forEach((t, k) => {
      this.m4.compose(new THREE.Vector3(t.cx, this.groundY + 0.025, t.cz), this.q.identity(), new THREE.Vector3(0, 1, 0));
      mesh.setMatrixAt(k, this.m4);
      mesh.setColorAt(k, FRESH_DIRT);
    });
    this.group.add(mesh);
    return mesh;
  }

  private makeStumps() {
    const trees = this.tiles.reduce((a, t) => a + t.trees.length, 0);
    const mesh = new THREE.InstancedMesh(stumpGeo(), new THREE.MeshStandardMaterial({ color: '#9c6b45', flatShading: true, roughness: 0.9 }), Math.max(1, trees));
    mesh.count = 0;
    mesh.castShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  // ---------- Instance helpers ----------

  private setItem(ref: ItemRef, pos: THREE.Vector3, quat: THREE.Quaternion, scale: number) {
    this.m4.compose(pos, quat, this.v.set(scale, scale, scale));
    for (const mesh of this.veg.meshes[ref.kind]) {
      mesh.setMatrixAt(ref.i, this.m4);
      this.dirty.add(mesh);
    }
  }

  private baseQuat(ref: ItemRef) {
    return new THREE.Quaternion().setFromAxisAngle(UP, ref.r);
  }

  private animate(dur: number, fn: (t: number) => void, delay = 0, done?: () => void) {
    this.anims.push({ start: this.realTime + delay, dur, fn, done });
  }

  private popIn(obj: THREE.Object3D) {
    const children = [...obj.children];
    children.forEach((c, k) => {
      const s0 = c.scale.clone();
      c.scale.setScalar(0.001);
      this.animate(0.35, (t) => c.scale.copy(s0).multiplyScalar(Math.max(0.001, smooth(t) * (1 + 0.15 * Math.sin(t * Math.PI)))), k * 0.04);
    });
  }

  // ---------- Tile stages ----------

  private fell(tile: Tile) {
    tile.trees.forEach((ref, n) => {
      // Fall away from the crew (into the jungle), with some scatter.
      const dir = this.inward.clone().applyAxisAngle(UP, (Math.random() - 0.5) * 1.3);
      const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const base = new THREE.Vector3(ref.x, ref.y - 0.02, ref.z);
      const yaw = this.baseQuat(ref);
      const delay = n * 0.35 + Math.random() * 0.4;
      const height = ref.kind === 'tall' ? 3 : ref.kind === 'banana' ? 1 : 2.2;
      this.activeFalls++;
      // Chainsaw cut: sawdust and a shiver before it goes.
      this.animate(0.5, (t) => {
        const wob = new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(t * 40) * 0.02 * (1 - t));
        this.setItem(ref, base, wob.multiply(yaw), ref.s);
        if (Math.random() < 0.3) this.fx.emit(base.clone().setY(base.y + 0.2), { color: SAWDUST, size: 0.05, life: 0.6, chip: true, gravity: 3, vel: new THREE.Vector3(0, 1.2, 0), spread: 0.8, grow: 1 });
      }, delay);
      ref.fallDir = dir;
      ref.fallEndAt = this.realTime + delay + 0.5 + 1.25;
      this.animate(1.25, (t) => {
        const a = ease(t) * 1.45 + (t > 0.9 ? Math.sin((t - 0.9) * 30) * 0.03 : 0);
        const tip = new THREE.Quaternion().setFromAxisAngle(axis, a);
        this.setItem(ref, base, tip.multiply(yaw), ref.s);
      }, delay + 0.5, () => {
        this.activeFalls--;
        const land = base.clone().addScaledVector(dir, height * ref.s * 0.8);
        this.fx.emit(land, { color: DUST, size: 0.45, life: 1.4, spread: 0.6, vel: new THREE.Vector3(0, 0.5, 0), opacity: 0.55 }, 4);
        this.fx.emit(land.setY(land.y + 0.5), { color: LEAF, size: 0.07, life: 1.6, chip: true, gravity: 0.6, spread: 1, vel: new THREE.Vector3(0, 0.8, 0), grow: 1 }, 6);
      });
    });
  }

  private haul(tile: Tile, k: number) {
    for (const ref of tile.trees) {
      // Wait for this tree to finish falling, then let it lie a moment.
      const fallEnd = Math.max(0, (ref.fallEndAt ?? this.realTime) - this.realTime) + 0.6;
      const dir = ref.fallDir ?? this.inward;
      const base = new THREE.Vector3(ref.x, ref.y - 0.02, ref.z);
      const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const lying = new THREE.Quaternion().setFromAxisAngle(axis, 1.45).multiply(this.baseQuat(ref));
      this.animate(0.6, (t) => this.setItem(ref, base.clone().setY(base.y - t * 0.3), lying, ref.s * (1 - smooth(t))), fallEnd);
      // Leave a stump behind.
      const si = this.stumpCount++;
      const stump: Stump = { si, base, q: this.baseQuat(ref), s: ref.s * 0.9, readyAt: this.realTime + fallEnd + 0.3 };
      tile.stumps.push(stump);
      this.stumps.count = this.stumpCount;
      this.animate(0.3, (t) => {
        this.m4.compose(base, stump.q, this.v.setScalar(stump.s * smooth(t)));
        this.stumps.setMatrixAt(si, this.m4);
        this.dirty.add(this.stumps);
      }, fallEnd);
      this.treesSinceLoad++;
    }
    if (this.treesSinceLoad >= 6) {
      this.loadsPending++;
      this.treesSinceLoad = 0;
    }
    // Grub out undergrowth and rocks.
    tile.items.forEach((ref, n) => {
      const base = new THREE.Vector3(ref.x, ref.y - 0.02, ref.z);
      const q = this.baseQuat(ref);
      this.animate(0.45, (t) => this.setItem(ref, base, q, ref.s * (1 - smooth(t))), 0.2 + n * 0.08);
    });
    if (tile.items.length) this.fx.emit(new THREE.Vector3(tile.cx, this.groundY + 0.1, tile.cz), { color: DUST, size: 0.3, life: 1, spread: 0.5, opacity: 0.4 }, 2);
    // Raw dirt appears.
    this.animate(0.6, (t) => {
      this.m4.compose(new THREE.Vector3(tile.cx, this.groundY + 0.025, tile.cz), this.q.identity(), this.v.set(smooth(t), 1, smooth(t)));
      this.dirt.setMatrixAt(k, this.m4);
      this.dirty.add(this.dirt);
    }, 0.3);
  }

  private grade(tile: Tile, k: number) {
    for (const st of tile.stumps) {
      // Never grind a stump before it has appeared.
      const delay = Math.max(0, st.readyAt - this.realTime) + Math.random() * 0.4;
      this.animate(0.5, (t) => {
        this.m4.compose(st.base, st.q, this.v.setScalar(st.s * (1 - smooth(t))));
        this.stumps.setMatrixAt(st.si, this.m4);
        this.dirty.add(this.stumps);
      }, delay);
    }
    this.animate(0.8, (t) => {
      this.dirt.setColorAt(k, FRESH_DIRT.clone().lerp(GRADED_DIRT, t));
      this.dirty.add(this.dirt);
    });
    this.fx.emit(new THREE.Vector3(tile.cx, this.groundY + 0.1, tile.cz), { color: DUST, size: 0.35, life: 1.2, spread: 0.6, opacity: 0.45 }, 2);
  }

  // ---------- Per frame ----------

  progress(gameTime: number) {
    return Math.min(1, Math.max(0, (gameTime - this.startTime) / this.duration));
  }

  get isComplete() {
    return this.finished;
  }

  /** True once the ground has fully regrown and the job can be disposed. */
  get isDone() {
    return this.regrowDone;
  }

  update(gameTime: number, realDt: number) {
    this.realTime += realDt;
    const n = this.tiles.length;
    const p = this.progress(gameTime);
    const units = p * (n + GRADE_LAG);
    while (this.felled < n && this.felled <= units) this.fell(this.tiles[this.felled++]);
    while (this.hauled < n && this.hauled + HAUL_LAG <= units) this.haul(this.tiles[this.hauled], this.hauled++);
    while (this.graded < n && this.graded + GRADE_LAG <= units) this.grade(this.tiles[this.graded], this.graded++);
    if (p >= 1 && !this.finished) {
      while (this.hauled < n) this.haul(this.tiles[this.hauled], this.hauled++);
      while (this.graded < n) this.grade(this.tiles[this.graded], this.graded++);
      this.finished = true;
    }

    // Grass reclaims the graded ground after the job, patch by patch.
    if (this.finished) {
      const regrow = (gameTime - (this.startTime + this.duration)) / (this.duration * REGROW_FRACTION);
      this.tiles.forEach((t, k) => {
        const s = 1 - smooth(Math.min(1, Math.max(0, (regrow - t.regrowAt) / 0.2)));
        this.m4.compose(new THREE.Vector3(t.cx, this.groundY + 0.025, t.cz), this.q.identity(), this.v.set(s, 1, s));
        this.dirt.setMatrixAt(k, this.m4);
      });
      this.dirty.add(this.dirt);
      if (regrow >= 1) this.regrowDone = true;
    }

    // Run tweens.
    this.anims = this.anims.filter((a) => {
      const t = (this.realTime - a.start) / a.dur;
      if (t < 0) return true;
      a.fn(Math.min(1, t));
      if (t >= 1) {
        a.done?.();
        return false;
      }
      return true;
    });

    if (!this.finished || this.anims.length) this.updateMachines(realDt);
    else if (!this.packedUp) this.packUp();
    this.updateCrew(realDt);

    for (const mesh of this.dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.dirty.clear();
  }

  private tilePos(k: number) {
    const t = this.tiles[Math.max(0, Math.min(this.tiles.length - 1, k))];
    return new THREE.Vector3(t.cx, this.groundY, t.cz);
  }

  private depth(p: THREE.Vector3) {
    return (p.x - this.gate.x) * this.inward.x + (p.z - this.gate.z) * this.inward.z;
  }

  private beacons(...b: THREE.Mesh[]) {
    const on = Math.sin(this.realTime * 7) > 0.3;
    for (const m of b) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.4 : 0.15;
  }

  private exhaust(obj: THREE.Object3D, moving: boolean) {
    if (Math.random() < (moving ? 0.25 : 0.06)) {
      obj.getWorldPosition(this.v);
      this.fx.emit(this.v.clone().setY(this.v.y + 0.2), { color: SMOKE, size: 0.12, life: 1.4, spread: 0.05, vel: new THREE.Vector3(0, 0.9, 0), opacity: 0.5, grow: 3 });
    }
  }

  private updateMachines(dt: number) {
    const front = Math.min(this.felled, this.tiles.length - 1);
    // Excavator: stands on cleared ground just behind the felling front, swings and grabs.
    const fpos = this.tilePos(front);
    const exTarget = fpos.clone().addScaledVector(this.inward, -1.7);
    if (this.depth(exTarget) < -1.5) exTarget.addScaledVector(this.inward, -this.depth(exTarget) - 1.5);
    const exArrived = this.exDriver.driveTo(exTarget, dt, 0.3);
    const ex = this.ex;
    if (exArrived) {
      const local = fpos.clone().sub(ex.root.position);
      const want = Math.atan2(-local.z, local.x) - this.exDriver.heading;
      ex.upper.rotation.y += (Math.atan2(Math.sin(want), Math.cos(want)) - ex.upper.rotation.y) * Math.min(1, dt * 2);
      const c = this.realTime * 1.6;
      ex.boom.rotation.z = -0.15 + Math.sin(c) * 0.22;
      ex.stick.rotation.z = -0.25 + Math.sin(c + 1) * 0.3;
      ex.bucket.rotation.z = Math.sin(c + 2) * 0.5;
      if (Math.random() < 0.04 && this.felled < this.tiles.length) {
        ex.bucket.getWorldPosition(this.v);
        this.fx.emit(this.v.clone(), { color: DUST, size: 0.2, life: 0.8, opacity: 0.4 });
      }
    } else {
      ex.upper.rotation.y *= 1 - Math.min(1, dt * 2);
      ex.boom.rotation.z += (0.35 - ex.boom.rotation.z) * Math.min(1, dt * 2);
      ex.stick.rotation.z += (-0.6 - ex.stick.rotation.z) * Math.min(1, dt * 2);
    }
    for (const w of ex.wheels) w.rotation.y += this.exDriver.speed * dt * 4;
    this.exhaust(ex.exhaust, !exArrived);

    // Bulldozer: push passes over the grading row, blade down going forward.
    const gpos = this.tilePos(Math.max(0, this.graded - 1));
    const dzFwd = gpos.clone().addScaledVector(this.inward, 0.4);
    const dzBack = gpos.clone().addScaledVector(this.inward, -1.6);
    if (this.depth(dzBack) < -1.5) dzBack.addScaledVector(this.inward, -this.depth(dzBack) - 1.5);
    if (this.graded === 0) {
      this.dzDriver.driveTo(this.gate.clone().addScaledVector(this.inward, -1.6).addScaledVector(this.along, -2), dt, 0.3);
    } else if (this.dzPhase === 'forward') {
      if (this.dzDriver.driveTo(dzFwd, dt, 0.25)) this.dzPhase = 'back';
      if (this.dzDriver.speed > 0.3 && Math.random() < 0.2) {
        this.dz.blade.getWorldPosition(this.v);
        this.fx.emit(this.v.clone().setY(this.groundY + 0.15), { color: DUST, size: 0.22, life: 1, spread: 0.4, opacity: 0.45 });
      }
    } else if (this.dzDriver.driveTo(dzBack, dt, 0.25, true)) this.dzPhase = 'forward';
    this.dz.blade.position.y += ((this.dzPhase === 'forward' ? 0.3 : 0.45) - this.dz.blade.position.y) * Math.min(1, dt * 3);
    for (const w of this.dz.wheels) w.rotation.y += this.dzDriver.speed * dt * 4;
    this.exhaust(this.dz.exhaust, this.dzDriver.speed > 0.2);

    // Log truck: shuttles loads from the haul front to the log pile.
    const tr = this.truck;
    const via = this.gate.clone().addScaledVector(this.inward, 0.6);
    const outside = this.gate.clone().addScaledVector(this.inward, -1.4);
    switch (this.truckState) {
      case 'park':
        this.truckDriver.driveTo(this.site.truckPark, dt, 0.3);
        if (this.loadsPending > 0) {
          const target = this.tilePos(Math.max(0, this.hauled - 2)).addScaledVector(this.inward, -0.6);
          this.truckRoute = [outside, via, target];
          this.truckState = 'toLoad';
        }
        break;
      case 'toLoad':
      case 'toPile':
        if (this.truckDriver.driveTo(this.truckRoute[0], dt, 0.35)) {
          this.truckRoute.shift();
          if (!this.truckRoute.length) {
            this.truckState = this.truckState === 'toLoad' ? 'loading' : 'unloading';
            this.truckTimer = 0;
          }
        }
        break;
      case 'loading':
        this.truckTimer += dt;
        tr.cargo.forEach((c, i) => (c.visible = this.truckTimer > 0.5 + i * 0.5));
        if (this.truckTimer > 3.8) {
          this.loadsPending = Math.max(0, this.loadsPending - 1);
          this.truckRoute = [via, outside, this.site.pileFront.clone().addScaledVector(this.inward, -0.6)];
          this.truckState = 'toPile';
        }
        break;
      case 'unloading':
        this.truckTimer += dt;
        tr.cargo.forEach((c, i) => (c.visible = this.truckTimer < 0.5 + (tr.cargo.length - i) * 0.4));
        if (this.truckTimer > 3) {
          this.pileLogs = Math.min(this.site.pileCapacity, this.pileLogs + 3);
          this.site.setPileLogs(this.pileLogs);
          this.truckState = 'park';
        }
        break;
    }
    for (const w of tr.wheels) w.rotation.z -= this.truckDriver.speed * dt * 4.5;
    tr.body.position.y = Math.sin(this.realTime * 18) * 0.008 * Math.min(1, this.truckDriver.speed);
    this.exhaust(tr.exhaust, this.truckDriver.speed > 0.3);
    this.beacons(ex.beacon, this.dz.beacon, tr.beacon);
  }

  private updateCrew(dt: number) {
    const frontK = Math.min(this.felled, this.tiles.length - 1);
    const front = this.tilePos(frontK);
    for (const c of this.crew) {
      const w = c.walker;
      let work = 0;
      if (this.packedUp) {
        w.walkTo(this.site.cabinDoor, dt);
      } else if (c.role === 'saw') {
        const target = front.clone().addScaledVector(this.along, c.slot === 0 ? -0.75 : 0.75).addScaledVector(this.inward, -0.45);
        if (w.walkTo(target, dt)) {
          w.faceTowards(front);
          work = this.activeFalls > 0 && !this.finished ? 1 : 0.2;
          if (work > 0.5 && Math.random() < 0.15) {
            this.fx.emit(w.pos.clone().addScaledVector(this.inward, 0.25).setY(this.groundY + 0.35), { color: SAWDUST, size: 0.04, life: 0.5, chip: true, gravity: 3, spread: 0.6, vel: new THREE.Vector3(0, 0.8, 0), grow: 1 });
          }
        }
      } else if (c.role === 'flag') {
        if (w.walkTo(this.site.flagSpot, dt)) w.faceTowards(this.site.flagSpot.clone().addScaledVector(this.inward, -3));
        work = 0.55;
        const go = this.truckState === 'toLoad' || this.truckState === 'toPile';
        const sign = w.rig.sign?.material as THREE.MeshStandardMaterial | undefined;
        sign?.color.set(go ? '#2fae4a' : '#d8342c');
      } else if (c.role === 'boss') {
        const stops = [this.site.cabinDoor, this.ex.root.position.clone().addScaledVector(this.inward, -1.4).addScaledVector(this.along, 1.2), this.site.pileFront];
        if (c.wait > 0) {
          c.wait -= dt;
          work = 0.35;
        } else if (w.walkTo(stops[c.step % stops.length], dt)) {
          c.wait = 3 + Math.random() * 3;
          c.step++;
          w.faceTowards(front);
        }
      } else {
        const target = this.dz.root.position.clone().addScaledVector(this.inward, -1.3).addScaledVector(this.along, 0.9);
        if (this.depth(target) < -1.2) target.addScaledVector(this.inward, -this.depth(target) - 1.2);
        if (w.walkTo(target, dt) || w.pos.distanceTo(target) < 0.5) {
          w.faceTowards(this.dz.root.position);
          work = 0.6;
        }
      }
      w.pos.y = this.groundY;
      w.animate(dt, work);
    }
  }

  /** Crew packs up: site props, machines and workers pop away once all work is done. */
  private packUp() {
    this.packedUp = true;
    const objs = [this.site.group, this.ex.root, this.dz.root, this.truck.root, ...this.crew.map((c) => c.walker.rig.root)];
    objs.forEach((o, k) => {
      const s0 = o.scale.clone();
      this.animate(0.4, (t) => {
        o.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - smooth(t)));
        if (o === this.site.group) {
          // The site group uses a manual matrix; rebuild it with the scale.
          o.matrix.decompose(this.v, this.q, new THREE.Vector3());
          o.matrix.compose(this.v, this.q, new THREE.Vector3().setScalar(Math.max(0.001, 1 - smooth(t))));
        }
      }, 0.5 + k * 0.06, () => (o.visible = false));
      o.getWorldPosition(this.v);
      this.fx.emit(this.v.clone().setY(this.groundY + 0.3), { color: DUST, size: 0.3, life: 1, spread: 0.5, opacity: 0.4 }, 2);
    });
    this.veg.group.visible = false;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
