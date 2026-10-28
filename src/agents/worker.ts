import * as THREE from 'three';

/** Contractor worker look: hi-vis vest and hard hat (distinct from camp Recruits). */
const W = {
  vest: '#ff8a1f',
  vestStripe: '#e8ecef',
  shirt: '#3d5a80',
  pants: '#2f3b4a',
  boots: '#3b2a1e',
  skin: ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'],
  hatYellow: '#ffd23f',
  hatWhite: '#f4f4f0',
};

const cache = new Map<string, THREE.MeshStandardMaterial>();
const m = (c: string) => {
  let x = cache.get(c);
  if (!x) cache.set(c, (x = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85 })));
  return x;
};

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, m(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export type Tool = 'none' | 'chainsaw' | 'clipboard' | 'flag' | 'rake';

export interface WorkerRig {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  tool: THREE.Group;
  sign?: THREE.Mesh;
}

/** A ~0.62-unit tall miniature worker with pivoting limbs. Faces local +x. */
export function createWorker(tool: Tool, seed: number, supervisor = false): WorkerRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const limb = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(0, 0.28, -0.05);
  legR.position.set(0, 0.28, 0.05);
  for (const leg of [legL, legR]) {
    part(leg, limb(0.07, 0.24, 0.07), W.pants, 0, 0, 0);
    part(leg, new THREE.BoxGeometry(0.1, 0.05, 0.08), W.boots, 0.015, -0.255, 0);
    body.add(leg);
  }
  // Torso: shirt with hi-vis vest and reflective band
  part(body, new THREE.BoxGeometry(0.13, 0.2, 0.19), W.shirt, 0, 0.38, 0);
  part(body, new THREE.BoxGeometry(0.14, 0.17, 0.2), W.vest, 0, 0.385, 0);
  part(body, new THREE.BoxGeometry(0.145, 0.025, 0.205), W.vestStripe, 0, 0.35, 0);
  const skin = W.skin[seed % W.skin.length];
  part(body, new THREE.IcosahedronGeometry(0.07, 0), skin, 0, 0.54, 0);
  // Hard hat with brim
  const hat = part(body, new THREE.SphereGeometry(0.075, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), supervisor ? W.hatWhite : W.hatYellow, 0, 0.565, 0);
  hat.scale.set(1.05, 0.9, 1.05);
  part(body, new THREE.CylinderGeometry(0.095, 0.095, 0.012, 9), supervisor ? W.hatWhite : W.hatYellow, 0.012, 0.567, 0);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(0, 0.47, -0.12);
  armR.position.set(0, 0.47, 0.12);
  for (const arm of [armL, armR]) {
    part(arm, limb(0.055, 0.19, 0.055), W.vest, 0, 0, 0);
    part(arm, new THREE.BoxGeometry(0.05, 0.04, 0.05), skin, 0, -0.2, 0);
    body.add(arm);
  }

  const tool_ = new THREE.Group();
  armR.add(tool_);
  tool_.position.set(0.02, -0.2, 0);
  let sign: THREE.Mesh | undefined;
  if (tool === 'chainsaw') {
    part(tool_, new THREE.BoxGeometry(0.12, 0.07, 0.05), '#ff6a13', 0.04, 0, 0);
    part(tool_, new THREE.BoxGeometry(0.2, 0.02, 0.015), '#c9ced2', 0.18, 0, 0);
  } else if (tool === 'clipboard') {
    part(tool_, new THREE.BoxGeometry(0.02, 0.1, 0.075), '#b07a4a', 0.04, 0.02, 0);
    part(tool_, new THREE.BoxGeometry(0.022, 0.08, 0.06), '#ffffff', 0.042, 0.02, 0);
  } else if (tool === 'flag') {
    part(tool_, new THREE.CylinderGeometry(0.01, 0.01, 0.34, 5), '#5b5b5b', 0, 0.12, 0);
    // Stop/Go lollipop sign: its own material so it can switch colour.
    sign = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.015, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#d8342c', flatShading: true }),
    );
    sign.position.set(0, 0.3, 0);
    tool_.add(sign);
  } else if (tool === 'rake') {
    part(tool_, new THREE.CylinderGeometry(0.01, 0.01, 0.5, 5).rotateZ(1.1), '#b07a4a', 0.15, -0.05, 0);
    part(tool_, new THREE.BoxGeometry(0.03, 0.03, 0.14), '#5b5b5b', 0.37, -0.16, 0);
  }
  root.traverse((o) => (o.castShadow = true));
  return { root, body, legL, legR, armL, armR, tool: tool_, sign };
}

/** Walks a worker toward targets with a simple gait; poses for idle work. */
export class Walker {
  private phase = Math.random() * 10;
  heading = 0;
  moving = false;

  constructor(
    readonly rig: WorkerRig,
    private readonly speed = 0.9,
  ) {}

  get pos() {
    return this.rig.root.position;
  }

  faceTowards(p: THREE.Vector3) {
    this.heading = Math.atan2(-(p.z - this.pos.z), p.x - this.pos.x);
    this.rig.root.rotation.y = this.heading;
  }

  /** Step toward the target; returns true when arrived. */
  walkTo(target: THREE.Vector3, dt: number): boolean {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      this.moving = false;
      return true;
    }
    this.moving = true;
    const want = Math.atan2(-dz, dx);
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += Math.sign(diff) * Math.min(Math.abs(diff), 8 * dt);
    this.rig.root.rotation.y = this.heading;
    const step = Math.min(this.speed * dt, dist);
    this.pos.x += (dx / dist) * step;
    this.pos.z += (dz / dist) * step;
    return false;
  }

  /** Animate limbs. `work` is a 0..1 intensity for tool use while standing. */
  animate(dt: number, work = 0) {
    const r = this.rig;
    if (this.moving) {
      this.phase += dt * this.speed * 11;
      const s = Math.sin(this.phase);
      r.legL.rotation.z = s * 0.6;
      r.legR.rotation.z = -s * 0.6;
      r.armL.rotation.z = -s * 0.45;
      r.armR.rotation.z = s * 0.45 * (1 - work);
      r.body.position.y = Math.abs(Math.cos(this.phase)) * 0.025;
    } else {
      this.phase += dt * 6;
      r.legL.rotation.z *= 0.8;
      r.legR.rotation.z *= 0.8;
      r.body.position.y = 0;
      r.armL.rotation.z = 0.5 * work + Math.sin(this.phase * 0.3) * 0.03;
      r.armR.rotation.z = 1.0 * work + Math.sin(this.phase * 2.2) * 0.12 * work;
      // Chainsaw buzz
      r.tool.position.y = -0.2 + (work > 0.5 ? Math.sin(this.phase * 9) * 0.006 : 0);
    }
  }
}
