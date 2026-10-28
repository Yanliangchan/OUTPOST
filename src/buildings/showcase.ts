import * as THREE from 'three';
import { BUILDINGS } from './catalogue';
import type { Particles } from '../fx/particles';

function label(text: string) {
  const c = document.createElement('canvas');
  const font = '900 34px Nunito, system-ui, sans-serif';
  const probe = c.getContext('2d')!;
  probe.font = font;
  c.width = Math.ceil(probe.measureText(text).width) + 48;
  c.height = 72;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,252,0.95)';
  g.beginPath();
  g.roundRect(4, 4, c.width - 8, 64, 18);
  g.fill();
  g.fillStyle = '#26332a';
  g.font = font;
  g.textAlign = 'center';
  g.fillText(text, c.width / 2, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((c.width / 72) * 0.79, 0.79, 1);
  s.renderOrder = 30;
  return s;
}

/**
 * Phase 2 review scene: every building at each upgrade level, in rows,
 * laid out in the starting clearing.
 */
export function createShowcase(groundY: number, fx: Particles) {
  const group = new THREE.Group();
  group.name = 'showcase';
  const emitters: { pos: THREE.Vector3; kind: 'steam' | 'smoke' }[] = [];
  const rowZ = [-6.2, 0.2, 6.4];
  BUILDINGS.forEach((def, row) => {
    for (let lv = 1; lv <= def.maxLevel; lv++) {
      const kit = def.build(lv);
      const x = (lv - 2) * 7.2;
      kit.group.position.set(x, groundY, rowZ[row]);
      group.add(kit.group);
      const tag = label(`${def.name} · Lv ${lv}`);
      tag.position.set(x, groundY + 4.4, rowZ[row]);
      group.add(tag);
      for (const e of kit.emitters) emitters.push({ pos: e.pos.clone().add(kit.group.position), kind: e.kind });
    }
  });
  let acc = 0;
  return {
    group,
    update(dt: number) {
      acc += dt;
      if (acc < 0.12) return;
      acc = 0;
      for (const e of emitters) {
        if (e.kind === 'steam') fx.emit(e.pos, { color: '#f4f4f0', size: 0.14, life: 2.2, spread: 0.05, vel: new THREE.Vector3(0.1, 0.7, 0), opacity: 0.55, grow: 3 });
        else if (Math.random() < 0.5) fx.emit(e.pos, { color: '#8d8f91', size: 0.12, life: 2.0, spread: 0.05, vel: new THREE.Vector3(0.1, 0.6, 0), opacity: 0.45, grow: 3 });
      }
    },
  };
}
