import * as THREE from 'three';

interface Puff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  vel: THREE.Vector3;
  life: number;
  age: number;
  grow: number;
  size: number;
  gravity: number;
  spin: number;
  fade: number;
  alive: boolean;
}

export interface PuffOptions {
  color: string;
  size?: number;
  life?: number;
  vel?: THREE.Vector3;
  spread?: number;
  grow?: number;
  gravity?: number;
  opacity?: number;
  /** Small solid bits (sawdust, leaves, chips) instead of soft puffs. */
  chip?: boolean;
}

/**
 * Pooled low-poly particles: dust clouds, exhaust smoke, sawdust, leaves.
 * Cheap enough for dozens on screen at once.
 */
export class Particles {
  readonly group = new THREE.Group();
  private pool: Puff[] = [];
  private readonly puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
  private readonly chipGeo = new THREE.TetrahedronGeometry(0.5, 0);

  constructor(size = 260) {
    this.group.name = 'particles';
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshStandardMaterial({ flatShading: true, transparent: true, depthWrite: false, roughness: 1 });
      const mesh = new THREE.Mesh(this.puffGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, mat, vel: new THREE.Vector3(), life: 1, age: 0, grow: 1, size: 1, gravity: 0, spin: 0, fade: 1, alive: false });
    }
  }

  emit(pos: THREE.Vector3, o: PuffOptions, count = 1) {
    for (let n = 0; n < count; n++) {
      const p = this.pool.find((q) => !q.alive);
      if (!p) return;
      const spread = o.spread ?? 0.3;
      p.alive = true;
      p.age = 0;
      p.life = (o.life ?? 1.2) * (0.8 + Math.random() * 0.4);
      p.size = (o.size ?? 0.3) * (0.7 + Math.random() * 0.6);
      p.grow = o.grow ?? 1.8;
      p.gravity = o.gravity ?? 0;
      p.spin = (Math.random() - 0.5) * 6;
      p.fade = o.opacity ?? 0.8;
      p.vel.copy(o.vel ?? new THREE.Vector3(0, 0.6, 0));
      p.vel.x += (Math.random() - 0.5) * spread * 2;
      p.vel.y += (Math.random() - 0.5) * spread;
      p.vel.z += (Math.random() - 0.5) * spread * 2;
      p.mesh.geometry = o.chip ? this.chipGeo : this.puffGeo;
      p.mat.color.set(o.color);
      p.mat.opacity = p.fade;
      p.mesh.position.copy(pos);
      p.mesh.position.x += (Math.random() - 0.5) * spread;
      p.mesh.position.z += (Math.random() - 0.5) * spread;
      p.mesh.scale.setScalar(p.size);
      p.mesh.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.alive = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - 0.9 * dt);
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0) p.mesh.position.y = 0;
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      p.mesh.scale.setScalar(p.size * (1 + (p.grow - 1) * t));
      p.mat.opacity = p.fade * (1 - t * t);
    }
  }
}

export const DUST = '#c9b48f';
export const SMOKE = '#5c5f63';
export const SAWDUST = '#e3c48d';
export const LEAF = '#4fae3a';
