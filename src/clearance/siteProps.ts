import * as THREE from 'three';
import { logGeo } from '../world/vegetation';

const cache = new Map<string, THREE.MeshStandardMaterial>();
const mat = (c: string) => {
  let m = cache.get(c);
  if (!m) cache.set(c, (m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 })));
  return m;
};

function box(parent: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#2f5a3a';
  g.fillRect(0, 0, 256, 44);
  g.fillStyle = '#ffffff';
  g.font = '900 26px Nunito, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('SITE CLEARANCE', 128, 31);
  g.fillStyle = '#26332a';
  g.font = '800 22px Nunito, system-ui, sans-serif';
  g.fillText('WORK IN PROGRESS', 128, 82);
  g.fillStyle = '#ff8a1f';
  g.fillRect(16, 100, 224, 6);
  g.fillStyle = '#5d6b60';
  g.font = '700 18px Nunito, system-ui, sans-serif';
  g.fillText('Safety first · Hard hats on', 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SiteProps {
  group: THREE.Group;
  /** World-space spots used by the crew. */
  cabinDoor: THREE.Vector3;
  pileFront: THREE.Vector3;
  flagSpot: THREE.Vector3;
  truckPark: THREE.Vector3;
  setPileLogs(n: number): void;
  readonly pileCapacity: number;
}

/**
 * Temporary contractor site set up on the cleared side of a zone's entrance edge.
 * Local frame: +x runs along the edge, +z points away from the jungle.
 */
export function createSiteProps(gate: THREE.Vector3, inward: THREE.Vector3, edgeLength: number, openSide: THREE.Vector3): SiteProps {
  const group = new THREE.Group();
  group.name = 'clearanceSite';
  const up = new THREE.Vector3(0, 1, 0);
  const outward = inward.clone().negate();
  const along = new THREE.Vector3().crossVectors(up, outward);
  // Lay the cabin/pile out toward the open land; mirror the layout if needed.
  const mirror = along.dot(openSide.clone().sub(gate)) < 0 ? -1 : 1;
  along.multiplyScalar(mirror);
  group.matrixAutoUpdate = false;
  group.matrix.makeBasis(along, up, outward).setPosition(gate);
  const toWorld = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(group.matrix);

  // --- Barriers along the edge, leaving a gate gap ---
  const half = edgeLength / 2;
  for (let x = -half + 0.6; x <= half - 0.5; x += 1.05) {
    if (Math.abs(x) < 1.7) continue;
    const seg = new THREE.Group();
    seg.position.set(x, 0, 0.35);
    group.add(seg);
    for (let i = 0; i < 4; i++) box(seg, 0.24, 0.16, 0.05, i % 2 ? '#ffffff' : '#ff6a13', -0.36 + i * 0.24, 0.18, 0);
    for (const fx of [-0.42, 0.42]) {
      box(seg, 0.04, 0.34, 0.04, '#d8d8d2', fx, 0, 0);
      box(seg, 0.08, 0.04, 0.3, '#3a3a3a', fx, 0, 0);
    }
  }
  // --- Traffic cones at the gate ---
  for (const x of [-1.5, -1.0, 1.0, 1.5]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 7), mat('#ff6a13'));
    cone.position.set(x, 0.14, 0.45);
    cone.castShadow = true;
    group.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 7), mat('#ffffff'));
    band.position.set(x, 0.15, 0.45);
    group.add(band);
    box(group, 0.2, 0.03, 0.2, '#2a2a2a', x, 0, 0.45);
  }
  // --- Sign board ---
  const signGroup = new THREE.Group();
  signGroup.position.set(2.3, 0, 1.0);
  signGroup.scale.x = mirror; // keep the lettering readable when mirrored
  group.add(signGroup);
  for (const x of [-0.4, 0.4]) box(signGroup, 0.05, 0.8, 0.05, '#7a8085', x, 0, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.62, 0.04), [
    mat('#ffffff'), mat('#ffffff'), mat('#ffffff'), mat('#ffffff'),
    new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 }), mat('#ffffff'),
  ]);
  board.position.set(0, 0.95, 0.03);
  board.castShadow = true;
  signGroup.add(board);

  // --- Portacabin site office (with the obligatory aircon unit) ---
  const cabin = new THREE.Group();
  cabin.position.set(3.9, 0, 2.7);
  group.add(cabin);
  box(cabin, 2.2, 0.12, 1.0, '#6c6f72', 0, 0, 0);
  box(cabin, 2.2, 0.85, 1.0, '#f2efe6', 0, 0.12, 0);
  box(cabin, 2.26, 0.08, 1.06, '#2f5a3a', 0, 0.97, 0);
  box(cabin, 0.36, 0.62, 0.04, '#2f5a3a', -0.5, 0.15, -0.51); // door
  for (const x of [0.2, 0.75]) box(cabin, 0.4, 0.28, 0.04, '#3d5a6c', x, 0.5, -0.51); // windows
  box(cabin, 0.5, 0.1, 0.35, '#8a8d90', -0.5, 0, -0.68); // steps
  box(cabin, 0.32, 0.3, 0.18, '#e8e8e2', 1.27, 0.35, 0.1); // aircon unit
  box(cabin, 0.2, 0.2, 0.02, '#9a9a96', 1.27, 0.4, 0.0);
  // Portable toilet
  box(group, 0.42, 0.78, 0.42, '#2f7fd1', 5.45, 0, 2.6);
  box(group, 0.48, 0.06, 0.48, '#e8e8e2', 5.45, 0.78, 2.6);
  // Generator
  box(group, 0.7, 0.36, 0.42, '#f2b52a', 2.4, 0, 3.6);
  box(group, 0.72, 0.06, 0.44, '#33383d', 2.4, 0.36, 3.6);
  box(group, 0.04, 0.2, 0.04, '#33383d', 2.15, 0.42, 3.6);
  // Floodlight mast
  box(group, 0.08, 2.3, 0.08, '#8a8d90', 1.6, 0, 1.9);
  box(group, 0.5, 0.18, 0.1, '#33383d', 1.6, 2.3, 1.9);
  box(group, 0.44, 0.12, 0.02, '#fff6c8', 1.6, 2.33, 1.84);
  box(group, 0.4, 0.06, 0.4, '#33383d', 1.6, 0, 1.9);

  // --- Log pile (grows as the truck brings loads back) ---
  const capacity = 21;
  const logs = new THREE.InstancedMesh(logGeo(), mat('#9c6b45'), capacity);
  logs.castShadow = true;
  logs.count = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let idx = 0;
  // Pyramid: rows of 6,5,4,3,2,1
  for (let row = 0; row < 6; row++) {
    for (let k = 0; k < 6 - row; k++) {
      const x = 6.7 + (k - (5 - row) / 2) * 0.26;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (Math.random() - 0.5) * 0.08);
      m4.compose(new THREE.Vector3(x, row * 0.21, 2.6 + (Math.random() - 0.5) * 0.1), q, new THREE.Vector3(1.1, 1.05, 1.05));
      logs.setMatrixAt(idx++, m4);
    }
  }
  group.add(logs);
  // Timber chocks under the pile
  for (const z of [2.1, 3.1]) box(group, 1.8, 0.06, 0.12, '#7a5a3b', 6.7, 0, z);

  group.updateMatrixWorld(true);
  return {
    group,
    cabinDoor: toWorld(3.4, 1.9),
    pileFront: toWorld(6.7, 1.4),
    flagSpot: toWorld(-2.1, 0.9),
    truckPark: toWorld(-2.9, 2.8),
    pileCapacity: capacity,
    setPileLogs(n: number) {
      logs.count = Math.max(0, Math.min(capacity, n));
    },
  };
}
