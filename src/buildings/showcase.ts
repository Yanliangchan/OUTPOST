import * as THREE from 'three';
import { BUILDINGS } from './catalogue';
import { Kit, type EmitterKind } from './kit';
import type { Shot } from './turret';
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
export function createShowcase(groundY: number, fx: Particles, only: string | null, subset: string[] | null = null, combat = false) {
  const group = new THREE.Group();
  group.name = 'showcase';
  const emitters: Emitter[] = [];
  const kits: Kit[] = [];
  let time = 0;
  let frozen: number | null = null;
  const place = (defIdx: number, level: number, x: number, z: number) => {
    const def = BUILDINGS[defIdx];
    let kit: Kit;
    if (def.connect) {
      // Tile-joined pieces (walls): show a short run with a corner at each end.
      const cells = [[-1, -1], [-1, 0], [0, 0], [1, 0], [1, 1]];
      const has = (cx: number, cz: number) => cells.some(([a, b]) => a === cx && b === cz);
      kit = new Kit();
      for (const [cx, cz] of cells) {
        const piece = def.connect(level, { e: has(cx + 1, cz), w: has(cx - 1, cz), n: has(cx, cz - 1), s: has(cx, cz + 1) });
        piece.group.position.set(cx, 0, cz);
        kit.add(piece.group);
      }
    } else kit = def.build(level);
    kits.push(kit);
    kit.group.position.set(x, groundY, z);
    group.add(kit.group);
    if (combat && kit.turrets.length) arm(kit, def.footprint);
    const stats = def.levels[level - 1];
    const tier = level > PLANNED_MAX_LEVEL ? ' · reserve' : level > RELEASE_MAX_LEVEL ? ' · post-release' : '';
    const color = level > PLANNED_MAX_LEVEL ? '#d9822b' : level > RELEASE_MAX_LEVEL ? '#8a5cd6' : '#5d6b60';
    const tag = label(`${def.name} · Lv ${level}`, stats ? `${stats.title}${tier}` : '', color);
    const top = new THREE.Box3().setFromObject(kit.group).max.y;
    tag.position.set(x, top + 0.9, z);
    group.add(tag);
    for (const e of kit.emitters) emitters.push({ pos: e.pos.clone().add(kit.group.position), kind: e.kind });
  };

  // ---------------- Combat preview (?showcase=<id>&combat) ----------------
  // A raider on foot and a drone circle each defence; its turrets lock on and fire.
  type Raider = { obj: THREE.Object3D; cx: number; cz: number; r: number; seed: number; air: boolean };
  type Proj = { mesh: THREE.Mesh; shot: Shot; t: number; dur: number; arc: number };
  const raiders: Raider[] = [];
  const projs: Proj[] = [];
  const raiderMat = new THREE.MeshStandardMaterial({ color: '#d8342c', flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2b2d', flatShading: true });
  function raider(air: boolean) {
    const g = new THREE.Group();
    if (air) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), dark);
      g.add(body);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.03), raiderMat);
        p.position.set(dx * 0.2, 0.06, dz * 0.2);
        g.add(p);
      }
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 2, 6), raiderMat);
      body.position.y = 0.2;
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), dark);
      head.position.y = 0.4;
      g.add(body, head);
    }
    group.add(g);
    return g;
  }
  function arm(kit: Kit, fp: [number, number]) {
    const r = Math.max(fp[0], fp[1]) / 2 + 2.2;
    const pos = kit.group.position;
    const wants = new Set(kit.turrets.map((t) => t.spec.targets));
    const ground = wants.has('ground') || wants.has('both');
    const air = wants.has('air') || wants.has('both');
    const g = ground ? { obj: raider(false), cx: pos.x, cz: pos.z, r, seed: Math.random() * 6, air: false } : null;
    const a = air ? { obj: raider(true), cx: pos.x, cz: pos.z, r: r + 0.4, seed: Math.random() * 6, air: true } : null;
    if (g) raiders.push(g);
    if (a) raiders.push(a);
    kit.turrets.forEach((t, i) => {
      const prey = t.spec.targets === 'air' ? a! : t.spec.targets === 'ground' ? g! : i % 2 && a ? a : (g ?? a)!;
      t.target = new THREE.Vector3();
      const aimAt = () => t.target!.copy(prey.obj.position).add(new THREE.Vector3(0, prey.air ? 0 : 0.25, 0));
      kit.anims.unshift(aimAt);
      t.onFire.push((shot) => {
        const heavy = shot.weapon === 'mortar' || shot.weapon === 'howitzer';
        if (shot.weapon === 'light') return;
        const mesh = new THREE.Mesh(
          heavy ? new THREE.IcosahedronGeometry(0.07, 0) : new THREE.BoxGeometry(0.16, 0.025, 0.025),
          heavy ? dark : new THREE.MeshBasicMaterial({ color: '#ffe27a' }),
        );
        group.add(mesh);
        const dist = shot.from.distanceTo(shot.to);
        projs.push({ mesh, shot, t: 0, dur: heavy ? 0.6 + dist * 0.12 : 0.05 + dist * 0.03, arc: shot.weapon === 'mortar' ? 2.6 : shot.weapon === 'howitzer' ? 1.2 : 0 });
        fx.emit(shot.from, { color: '#cfcac0', size: heavy ? 0.16 : 0.06, life: 0.8, spread: 0.05, vel: new THREE.Vector3(0, 0.4, 0), opacity: 0.6, grow: 2.5 }, heavy ? 3 : 1);
      });
    });
  }
  function stepCombat(dt: number) {
    for (const r of raiders) {
      const a = time * 0.35 + r.seed;
      r.obj.position.set(r.cx + Math.cos(a) * r.r, groundY + (r.air ? 2.6 + Math.sin(time * 1.3 + r.seed) * 0.2 : 0.08), r.cz + Math.sin(a) * r.r);
      r.obj.rotation.y = -a;
      if (r.air) r.obj.children.forEach((c, i) => i && (c.rotation.y = time * 30));
    }
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.t += dt / p.dur;
      const u = Math.min(1, p.t);
      p.mesh.position.lerpVectors(p.shot.from, p.shot.to, u);
      p.mesh.position.y += Math.sin(u * Math.PI) * p.arc;
      if (!p.arc) p.mesh.lookAt(p.shot.to), p.mesh.rotateY(Math.PI / 2);
      if (u >= 1) {
        const w = p.shot.weapon;
        if (w === 'mortar' || w === 'howitzer') {
          fx.emit(p.shot.to, { color: '#ff8a1f', size: 0.18, life: 0.35, spread: 0.2, vel: new THREE.Vector3(0, 1, 0), opacity: 1, grow: 2 }, 4);
          fx.emit(p.shot.to, { color: '#5c5f63', size: 0.22, life: 1.6, spread: 0.3, vel: new THREE.Vector3(0, 0.6, 0), opacity: 0.6, grow: 3 }, 5);
        } else if (w === 'flak') {
          fx.emit(p.shot.to, { color: '#2a2b2d', size: 0.2, life: 1.0, spread: 0.25, vel: new THREE.Vector3(0, 0.2, 0), opacity: 0.8, grow: 2.5 }, 4);
          fx.emit(p.shot.to, { color: '#ffd23f', size: 0.08, life: 0.25, spread: 0.2, chip: true, opacity: 1, grow: 1 }, 3);
        } else fx.emit(p.shot.to, { color: '#ffd23f', size: 0.04, life: 0.3, spread: 0.1, chip: true, gravity: 3, vel: new THREE.Vector3(0, 0.8, 0), opacity: 1, grow: 1 }, 2);
        group.remove(p.mesh);
        p.mesh.geometry.dispose();
        projs.splice(i, 1);
      }
    }
  }

  const idx = only ? BUILDINGS.findIndex((b) => b.id === only) : -1;
  const range = only?.match(/^(\d+)-(\d+)$/);
  if (range) {
    // Compare view: one column per building, one row per level.
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    const n = hi - lo + 1;
    // Columns packed by footprint width so a subset fits on the plateau.
    const cols = BUILDINGS.map((def, i) => ({ def, i })).filter(({ def }) => !subset || subset.includes(def.id));
    const widths = cols.map(({ def }) => def.footprint[0] + 1.6);
    const total = widths.reduce((a, b) => a + b, 0);
    const rowStep = Math.max(...cols.map(({ def }) => def.footprint[1])) + 1.9;
    let cx = -total / 2;
    cols.forEach(({ def, i }, c) => {
      const x = cx + widths[c] / 2;
      cx += widths[c];
      for (let lv = lo; lv <= hi; lv++) {
        if (lv > def.designedLevels) continue;
        place(i, lv, x, (lv - lo - (n - 1) / 2) * rowStep);
      }
    });
  } else if (idx >= 0) {
    const def = BUILDINGS[idx];
    const step = def.connect ? 4.2 : Math.max(def.footprint[0], def.footprint[1]) + 2.2;
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
    kits,
    /** Review tooling: hold animations at a fixed time (null resumes). */
    freeze(t: number | null) {
      frozen = t;
    },
    update(dt: number) {
      time = frozen ?? time + dt;
      if (combat) stepCombat(frozen === null ? dt : 0.05);
      for (const k of kits) k.animate(time);
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
