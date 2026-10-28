import * as THREE from 'three';

/** Contractor machine palette: construction yellow, so it reads apart from olive camp vehicles. */
export const MACHINE = {
  yellow: '#f2b52a',
  yellowDark: '#d39a1c',
  dark: '#33383d',
  grey: '#7a8085',
  glass: '#3d5a6c',
  white: '#f3f0e8',
  stripe: '#ff7a1a',
  tyre: '#2a2b2d',
  beacon: '#ffb020',
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string) => {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.05 });
    mats.set(color, m);
  }
  return m;
};

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent: THREE.Object3D, r: number, len: number, color: string, x: number, y: number, z: number, sides = 8, axis: 'x' | 'y' | 'z' = 'z') {
  const g = new THREE.CylinderGeometry(r, r, len, sides);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Amber rotating beacon: blinks via emissive. */
function beacon(parent: THREE.Object3D, x: number, y: number, z: number) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: MACHINE.beacon, emissive: MACHINE.beacon, emissiveIntensity: 0.2, flatShading: true }),
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Tracked undercarriage shared by excavator and bulldozer. */
function tracks(parent: THREE.Object3D, length: number, width: number, gauge: number) {
  const wheels: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const z = (side * gauge) / 2;
    box(parent, length, 0.34, width, MACHINE.dark, 0, 0.2, z);
    box(parent, length - 0.3, 0.06, width + 0.02, MACHINE.grey, 0, 0.39, z);
    // Track pads for a bit of surface rhythm.
    for (let i = 0; i < 7; i++) box(parent, 0.06, 0.05, width + 0.03, '#25292d', -length / 2 + 0.2 + i * ((length - 0.4) / 6), 0.04, z);
    for (const x of [-length / 2 + 0.2, length / 2 - 0.2]) wheels.push(cyl(parent, 0.15, width + 0.04, MACHINE.grey, x, 0.2, z, 8));
  }
  return wheels;
}

export interface Excavator {
  root: THREE.Group;
  upper: THREE.Group;
  boom: THREE.Group;
  stick: THREE.Group;
  bucket: THREE.Group;
  beacon: THREE.Mesh;
  exhaust: THREE.Object3D;
  wheels: THREE.Mesh[];
}

/** Tracked excavator with a grapple bucket. Local +x is forward. */
export function createExcavator(): Excavator {
  const root = new THREE.Group();
  root.name = 'excavator';
  const wheels = tracks(root, 2.0, 0.42, 1.2);
  box(root, 0.6, 0.18, 0.6, MACHINE.dark, 0, 0.48, 0);

  const upper = new THREE.Group();
  upper.position.y = 0.57;
  root.add(upper);
  box(upper, 1.5, 0.5, 1.25, MACHINE.yellow, -0.15, 0.25, 0);
  box(upper, 0.5, 0.42, 1.27, MACHINE.yellowDark, -0.75, 0.24, 0); // counterweight
  box(upper, 0.02, 0.06, 1.28, MACHINE.dark, -0.62, 0.42, 0);
  // Cab (left side)
  box(upper, 0.62, 0.68, 0.55, MACHINE.yellow, 0.25, 0.84, -0.33);
  box(upper, 0.64, 0.42, 0.5, MACHINE.glass, 0.26, 0.92, -0.33);
  box(upper, 0.66, 0.05, 0.58, MACHINE.dark, 0.25, 1.2, -0.33);
  // Engine deck details
  box(upper, 0.5, 0.12, 0.5, MACHINE.grey, -0.4, 0.56, 0.25);
  const exhaust = cyl(upper, 0.04, 0.3, MACHINE.dark, -0.55, 0.75, 0.35, 6, 'y');
  const b = beacon(upper, 0.25, 1.28, -0.33);
  // Handrail
  box(upper, 0.9, 0.03, 0.03, MACHINE.dark, -0.4, 0.65, 0.6);

  // Boom → stick → bucket (each pivots on local z)
  const boom = new THREE.Group();
  boom.position.set(0.5, 0.45, 0.25);
  upper.add(boom);
  box(boom, 1.7, 0.24, 0.2, MACHINE.yellow, 0.85, 0, 0);
  box(boom, 0.9, 0.08, 0.08, MACHINE.grey, 0.6, -0.17, 0); // hydraulic ram
  const stick = new THREE.Group();
  stick.position.set(1.7, 0, 0);
  boom.add(stick);
  box(stick, 0.2, 1.25, 0.16, MACHINE.yellow, 0, -0.62, 0);
  box(stick, 0.06, 0.8, 0.06, MACHINE.grey, 0.14, -0.4, 0);
  const bucket = new THREE.Group();
  bucket.position.set(0, -1.25, 0);
  stick.add(bucket);
  box(bucket, 0.36, 0.28, 0.42, MACHINE.dark, 0.12, -0.12, 0);
  for (const z of [-0.15, 0, 0.15]) box(bucket, 0.08, 0.08, 0.05, MACHINE.grey, 0.32, -0.24, z);

  return { root, upper, boom, stick, bucket, beacon: b, exhaust, wheels };
}

export interface Bulldozer {
  root: THREE.Group;
  blade: THREE.Group;
  beacon: THREE.Mesh;
  exhaust: THREE.Object3D;
  wheels: THREE.Mesh[];
}

/** Crawler bulldozer with a push blade and rear ripper. Local +x is forward. */
export function createBulldozer(): Bulldozer {
  const root = new THREE.Group();
  root.name = 'bulldozer';
  const wheels = tracks(root, 1.7, 0.36, 1.05);
  box(root, 1.25, 0.42, 0.75, MACHINE.yellow, 0.15, 0.6, 0); // engine hood
  box(root, 1.27, 0.05, 0.77, MACHINE.dark, 0.15, 0.82, 0);
  for (let i = 0; i < 4; i++) box(root, 0.04, 0.3, 0.02, MACHINE.dark, 0.55 - i * 0.12, 0.6, 0.39); // grille slats
  box(root, 0.6, 0.7, 0.8, MACHINE.yellow, -0.5, 0.75, 0); // cab base
  box(root, 0.56, 0.42, 0.82, MACHINE.glass, -0.48, 1.0, 0);
  box(root, 0.66, 0.06, 0.88, MACHINE.yellow, -0.5, 1.23, 0);
  const exhaust = cyl(root, 0.04, 0.35, MACHINE.dark, 0.45, 1.0, 0.18, 6, 'y');
  const b = beacon(root, -0.5, 1.31, 0);
  // Blade on push arms
  const blade = new THREE.Group();
  blade.position.set(1.0, 0.35, 0);
  root.add(blade);
  for (const z of [-0.45, 0.45]) box(blade, 0.5, 0.08, 0.08, MACHINE.yellowDark, -0.15, 0, z);
  box(blade, 0.12, 0.55, 1.5, MACHINE.yellow, 0.12, 0.05, 0);
  box(blade, 0.14, 0.06, 1.52, MACHINE.grey, 0.15, -0.22, 0);
  // Ripper
  box(root, 0.1, 0.4, 0.1, MACHINE.dark, -1.0, 0.25, 0);
  box(root, 0.3, 0.08, 0.5, MACHINE.yellowDark, -0.92, 0.45, 0);
  return { root, blade, beacon: b, exhaust, wheels };
}

export interface LogTruck {
  root: THREE.Group;
  cargo: THREE.Mesh[];
  beacon: THREE.Mesh;
  exhaust: THREE.Object3D;
  wheels: THREE.Mesh[];
  body: THREE.Group;
}

/** Contractor flatbed lorry for hauling logs. Local +x is forward. */
export function createLogTruck(): LogTruck {
  const root = new THREE.Group();
  root.name = 'logTruck';
  const body = new THREE.Group();
  root.add(body);
  const wheels: THREE.Mesh[] = [];
  for (const x of [1.05, -0.45, -0.95]) {
    for (const z of [-0.5, 0.5]) wheels.push(cyl(root, 0.22, 0.2, MACHINE.tyre, x, 0.22, z, 10));
  }
  box(body, 3.0, 0.14, 0.9, MACHINE.dark, -0.05, 0.42, 0); // chassis
  // Cab
  box(body, 0.85, 0.75, 1.0, MACHINE.white, 1.05, 0.85, 0);
  box(body, 0.06, 0.38, 0.86, MACHINE.glass, 1.48, 0.98, 0);
  for (const z of [-0.51, 0.51]) box(body, 0.5, 0.3, 0.02, MACHINE.glass, 1.1, 1.0, z);
  box(body, 0.87, 0.08, 1.02, MACHINE.stripe, 1.05, 0.62, 0);
  box(body, 0.1, 0.16, 1.0, MACHINE.dark, 1.5, 0.48, 0); // bumper
  for (const z of [-0.36, 0.36]) box(body, 0.03, 0.08, 0.14, '#fff6c8', 1.51, 0.6, z); // headlights
  const exhaust = cyl(body, 0.035, 0.5, MACHINE.grey, 0.62, 1.15, 0.45, 6, 'y');
  const b = beacon(body, 1.05, 1.28, 0);
  // Flat bed with stanchions and headboard
  box(body, 2.05, 0.1, 1.0, MACHINE.grey, -0.42, 0.55, 0);
  box(body, 0.08, 0.6, 1.0, MACHINE.dark, 0.58, 0.88, 0);
  for (const x of [-1.35, -0.42]) for (const z of [-0.47, 0.47]) box(body, 0.05, 0.55, 0.05, MACHINE.dark, x, 0.86, z);
  // Log cargo, revealed as it is loaded
  const cargo: THREE.Mesh[] = [];
  const logMat = mat('#9c6b45');
  const rows = [[-0.25, 0.75], [0.25, 0.75], [0, 0.97], [-0.3, 1.0], [0.3, 1.0], [0, 1.18]];
  for (const [z, y] of rows) {
    const g = new THREE.CylinderGeometry(0.13, 0.13, 1.85, 7);
    g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, logMat);
    m.position.set(-0.45, y, z);
    m.castShadow = true;
    m.visible = false;
    body.add(m);
    cargo.push(m);
  }
  return { root, cargo, beacon: b, exhaust, wheels, body };
}

/**
 * Simple steering driver: turns toward a target, moves forward when facing it.
 * Local +x of the model is treated as forward.
 */
export class Driver {
  heading = 0;
  speed = 0;
  readonly pos: THREE.Vector3;

  constructor(
    readonly root: THREE.Object3D,
    private readonly maxSpeed = 2.2,
    private readonly turnRate = 1.6,
    private readonly accel = 1.6,
  ) {
    this.pos = root.position;
  }

  face(dir: THREE.Vector3) {
    this.heading = Math.atan2(-dir.z, dir.x);
    this.root.rotation.y = this.heading;
  }

  /** Drive toward target; returns true on arrival. `reverse` backs up instead. */
  driveTo(target: THREE.Vector3, dt: number, tolerance = 0.15, reverse = false): boolean {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < tolerance) {
      this.speed = 0;
      return true;
    }
    let want = Math.atan2(-dz, dx);
    if (reverse) want += Math.PI;
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = Math.sign(diff) * Math.min(Math.abs(diff), this.turnRate * dt);
    this.heading += turn;
    this.root.rotation.y = this.heading;
    const facing = Math.cos(diff);
    const targetSpeed = facing > 0.7 ? Math.min(this.maxSpeed, dist * 1.5 + 0.2) : 0.15;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), this.accel * dt);
    const step = Math.min(this.speed * dt, dist);
    const dir = reverse ? -1 : 1;
    this.pos.x += Math.cos(this.heading) * step * dir;
    this.pos.z -= Math.sin(this.heading) * step * dir;
    return false;
  }
}
