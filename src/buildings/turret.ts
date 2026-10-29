import * as THREE from 'three';

/**
 * Combat rig shared by every defence.
 *
 * A defence's model is built with its weapon split into pivots:
 *   yaw    → turns about Y to face the target (weapon built pointing along local +x)
 *   pitch  → optional, child of yaw; turns about its local Z to elevate the barrel
 *   muzzles→ empty objects at the barrel tips (shots leave along their local +x)
 *   recoil → optional parts that kick back along local -x when firing
 *
 * With no target the turret runs its `idle` behaviour (scanning sweeps, a
 * sentry looking round). Give it a world-space `target` (the Raids phase does
 * this; `?showcase=<id>&combat` fakes it) and it slews round at `turnRate`,
 * elevates, and fires every `1 / rate` seconds once it's on target. Each shot
 * flashes the muzzles, kicks the recoil parts and calls `onFire` listeners so
 * the combat layer can spawn projectiles and apply damage.
 */

export type Weapon = 'rifle' | 'mortar' | 'light' | 'howitzer' | 'flak';
export type Targets = 'ground' | 'air' | 'both';

export interface TurretSpec {
  yaw: THREE.Object3D;
  pitch?: THREE.Object3D;
  muzzles: THREE.Object3D[];
  recoil?: THREE.Object3D[];
  weapon: Weapon;
  targets: Targets;
  /** Shots per second. */
  rate: number;
  /** Radians per second the yaw (and pitch) can slew. */
  turnRate?: number;
  /** Lobbing weapons (mortar, howitzer) hold this elevation instead of pointing straight at the target. */
  lob?: number;
  /** How far recoil parts kick back. */
  kick?: number;
  /** Idle behaviour (no target): set yaw/pitch rotations for a scanning sweep. */
  idle(t: number): void;
}

export interface Shot {
  turret: Turret;
  weapon: Weapon;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Turret {
  /** World-space aim point; null = idle. */
  target: THREE.Vector3 | null = null;
  readonly onFire: ((s: Shot) => void)[] = [];
  private last = 0;
  private cooldown = 0;
  private flashT = 1;
  private muzzleIdx = 0;
  private readonly flashes: THREE.Mesh[] = [];
  private readonly rest: number[];

  constructor(readonly spec: TurretSpec) {
    for (const m of spec.muzzles) {
      const f = new THREE.Mesh(
        new THREE.IcosahedronGeometry(spec.weapon === 'light' ? 0.001 : spec.weapon === 'rifle' ? 0.06 : 0.12, 0),
        new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95 }),
      );
      f.scale.set(1.6, 1, 1);
      f.visible = false;
      m.add(f);
      this.flashes.push(f);
    }
    this.rest = (spec.recoil ?? []).map((r) => r.position.x);
  }

  /** True when the weapon points within a small angle of the target. */
  get onTarget() {
    return this.target !== null && this.aimError() < 0.08;
  }

  /** Called every frame from the kit's animation loop with local time t. */
  update(t: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    const s = this.spec;
    if (!this.target) {
      s.idle(t);
    } else {
      const turn = (s.turnRate ?? 2.5) * dt;
      const [yaw, pitch] = this.solve();
      s.yaw.rotation.y += THREE.MathUtils.clamp(wrap(yaw - s.yaw.rotation.y), -turn, turn);
      if (s.pitch) s.pitch.rotation.z += THREE.MathUtils.clamp(pitch - s.pitch.rotation.z, -turn, turn);
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this.onTarget) {
        this.cooldown = 1 / s.rate;
        this.fire();
      }
    }
    // Muzzle flash and recoil decay
    this.flashT += dt;
    for (const f of this.flashes) f.visible = false;
    if (this.flashT < 0.07 && this.flashes.length) this.flashes[this.muzzleIdx].visible = true;
    const k = Math.max(0, 1 - this.flashT / 0.25);
    (s.recoil ?? []).forEach((r, i) => (r.position.x = this.rest[i] - (s.kick ?? 0.08) * k * k));
  }

  /** Fire one shot now (also usable by the combat layer directly). */
  fire() {
    const s = this.spec;
    this.flashT = 0;
    this.muzzleIdx = (this.muzzleIdx + 1) % Math.max(1, s.muzzles.length);
    const m = s.muzzles[this.muzzleIdx];
    if (!m || !this.target) return;
    const from = m.getWorldPosition(new THREE.Vector3());
    const shot: Shot = { turret: this, weapon: s.weapon, from, to: this.target.clone() };
    for (const cb of this.onFire) cb(shot);
  }

  /** Desired yaw (parent space of the yaw pivot) and pitch to hit the target. */
  private solve(): [number, number] {
    const s = this.spec;
    const parent = s.yaw.parent!;
    parent.updateWorldMatrix(true, false);
    tmp.copy(this.target!);
    parent.worldToLocal(tmp);
    const dx = tmp.x - s.yaw.position.x, dz = tmp.z - s.yaw.position.z;
    const yaw = Math.atan2(-dz, dx);
    if (s.lob !== undefined) return [yaw, s.lob];
    const piv = (s.pitch ?? s.yaw).getWorldPosition(tmp2);
    const h = this.target!.y - piv.y;
    return [yaw, Math.atan2(h, Math.hypot(this.target!.x - piv.x, this.target!.z - piv.z))];
  }

  private aimError() {
    const s = this.spec;
    const [yaw, pitch] = this.solve();
    return Math.abs(wrap(yaw - s.yaw.rotation.y)) + (s.pitch ? Math.abs(pitch - s.pitch.rotation.z) : 0);
  }
}
