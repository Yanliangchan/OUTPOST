import * as THREE from 'three';
import { C, Kit } from './kit';
import { HOUR, type BuildingDef, type LevelStats } from './types';

/* PLACEHOLDER: replaced by the full 20-level design. */

const LEVELS: LevelStats[] = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1, title: 'Placeholder', supplies: 1000 * (i + 1), reputation: 100 * (i + 1), buildTime: HOUR, hp: 1000 + i * 100, stats: {}, unlocks: [],
}));

function build(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  k.box(0.8, 0.5, 0.8, C.wall, 0, y, 0);
  const yaw = new THREE.Group();
  yaw.position.set(0, y + 0.6, 0);
  const pitch = new THREE.Group();
  yaw.add(pitch);
  k.box(0.4, 0.2, 0.3, C.trim, 0, 0, 0, yaw);
  k.box(0.5, 0.06, 0.06, C.dark, 0.3, 0, 0, pitch);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.56, 0.03, 0);
  pitch.add(muzzle);
  k.add(yaw);
  k.turret({ yaw, pitch, muzzles: [muzzle], weapon: 'flak', targets: 'air', rate: 1, idle: (t) => (yaw.rotation.y = Math.sin(t * 0.4 + level) * 1.2) });
  return k;
}

export const AIR_DEFENCE: BuildingDef = {
  id: 'airdefence', name: 'Air Defence', role: 'Defence (placeholder).', footprint: [3, 3], unlockHq: 13, levels: LEVELS, designedLevels: 20, build,
};
