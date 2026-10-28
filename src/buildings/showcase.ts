import * as THREE from 'three';
import { BUILDINGS } from './catalogue';
import type { EmitterKind } from './kit';
import { PLANNED_MAX_LEVEL, RELEASE_MAX_LEVEL } from '../config/release';
import type { Particles } from '../fx/particles';

function label(text: string, sub = '', subColor = '#5d6b60') {
  const font = '900 34px Nunito, system-ui, sans-serif';
  const subFont = '800 22px Nunito, system-ui, sans-serif';
  const c = document.createElement('canvas');
  const probe = c.getContext('2d')!;
  probe.font = font;
  let w = probe.measureText(text).width;
  probe.font = subFont;
  w = Math.max(w, probe.measureText(sub).width);
  c.width = Math.ceil(w) + 48;
  c.height = sub ? 100 : 72;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,252,0.95)';
  g.beginPath();
  g.roundRect(4, 4, c.width - 8, c.height - 8, 18);
  g.fill();
  g.textAlign = 'center';
  g.fillStyle = '#26332a';
  g.font = font;
  g.fillText(text, c.width / 2, 46);
  if (sub) {
    g.fillStyle = subColor;
    g.font = subFont;
    g.fillText(sub, c.width / 2, 80);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = 0.011;
  s.scale.set(c.width * k, c.height * k, 1);
  s.renderOrder = 30;
  return s;
}

type Emitter = { pos: THREE.Vector3; kind: EmitterKind };

/**
 * Review scene laid out on the cleared plateau.
 *   ?showcase        → every building, each designed level, one row per building
 *   ?showcase=<id>   → one building, all its designed levels in a 5-wide grid
 */
export function createShowcase(groundY: number, fx: Particles, only: string | null) {
  const group = new THREE.Group();
  group.name = 'showcase';
  const emitters: Emitter[] = [];
  const place = (defIdx: number, level: number, x: number, z: number) => {
    const def = BUILDINGS[defIdx];
    const kit = def.build(level);
    kit.group.position.set(x, groundY, z);
    group.add(kit.group);
    const stats = def.levels[level - 1];
    const tier = level > PLANNED_MAX_LEVEL ? ' · reserve' : level > RELEASE_MAX_LEVEL ? ' · post-release' : '';
    const color = level > PLANNED_MAX_LEVEL ? '#d9822b' : level > RELEASE_MAX_LEVEL ? '#8a5cd6' : '#5d6b60';
    const tag = label(`${def.name} · Lv ${level}`, stats ? `${stats.title}${tier}` : '', color);
    const top = new THREE.Box3().setFromObject(kit.group).max.y;
    tag.position.set(x, top + 0.9, z);
    group.add(tag);
    for (const e of kit.emitters) emitters.push({ pos: e.pos.clone().add(kit.group.position), kind: e.kind });
  };

  const idx = only ? BUILDINGS.findIndex((b) => b.id === only) : -1;
  const range = only?.match(/^(\d+)-(\d+)$/);
  if (range) {
    // Compare view: one column per building, one row per level.
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    const n = hi - lo + 1;
    BUILDINGS.forEach((def, col) => {
      for (let lv = lo; lv <= hi; lv++) {
        if (lv > def.designedLevels) continue;
        place(col, lv, (col - (BUILDINGS.length - 1) / 2) * 8.5, (lv - lo - (n - 1) / 2) * 7.5);
      }
    });
  } else if (idx >= 0) {
    const def = BUILDINGS[idx];
    const step = Math.max(def.footprint[0], def.footprint[1]) + 2.2;
    for (let lv = 1; lv <= def.designedLevels; lv++) {
      const col = (lv - 1) % 5;
      const row = Math.floor((lv - 1) / 5);
      place(idx, lv, (col - 2) * step, (row - 1.5) * step);
    }
  } else {
    const rowZ = [-7, 0.5, 7.5];
    BUILDINGS.forEach((def, row) => {
      for (let lv = 1; lv <= Math.min(3, def.designedLevels); lv++) place(row, lv, (lv - 2) * 7.6, rowZ[row]);
    });
  }

  let acc = 0;
  return {
    group,
    update(dt: number) {
      acc += dt;
      if (acc < 0.12) return;
      acc = 0;
      for (const e of emitters) {
        if (e.kind === 'steam') fx.emit(e.pos, { color: '#f4f4f0', size: 0.14, life: 2.2, spread: 0.05, vel: new THREE.Vector3(0.1, 0.7, 0), opacity: 0.55, grow: 3 });
        else if (e.kind === 'smoke' && Math.random() < 0.5) fx.emit(e.pos, { color: '#8d8f91', size: 0.12, life: 2.0, spread: 0.05, vel: new THREE.Vector3(0.1, 0.6, 0), opacity: 0.45, grow: 3 });
        else if (e.kind === 'sparks' && Math.random() < 0.6) fx.emit(e.pos, { color: Math.random() < 0.5 ? '#ffd23f' : '#ff8a1f', size: 0.035, life: 0.45, spread: 0.35, chip: true, gravity: 4, vel: new THREE.Vector3(0, 1.0, 0), opacity: 1, grow: 1 }, 3);
        else if (e.kind === 'spray') fx.emit(e.pos, { color: '#d9f6fa', size: 0.05, life: 0.7, spread: 0.25, chip: true, gravity: 3, vel: new THREE.Vector3(0, 1.4, 0), opacity: 0.8, grow: 1 });
      }
    },
  };
}
