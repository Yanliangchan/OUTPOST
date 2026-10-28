import * as THREE from 'three';
import { Terrain } from './terrain';
import { ZONES, zoneTiles, type Zone } from './zones';
import type { ClearanceSystem, ZoneState } from '../clearance/clearanceSystem';
import { formatDuration, gameClock } from '../core/gameClock';

export const STATE_COLORS: Record<ZoneState, string> = {
  open: '#3fd16b',
  cleared: '#3fd16b',
  available: '#ffc93c',
  locked: '#9aa0a3',
  clearing: '#2bb3a3',
  hidden: '#b07bff',
};

const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`);

function drawLabel(canvas: HTMLCanvasElement, text: string, sub: string, color: string) {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = 'rgba(255,255,252,0.95)';
  g.beginPath();
  g.roundRect(8, 8, 304, 104, 24);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(8, 8, 20, 104, [24, 0, 0, 24]);
  g.fill();
  g.fillStyle = '#26332a';
  g.textAlign = 'center';
  g.font = '900 42px Nunito, system-ui, sans-serif';
  g.fillText(text, 168, 58);
  g.fillStyle = '#5d6b60';
  g.font = '800 26px Nunito, system-ui, sans-serif';
  g.fillText(sub, 168, 94);
}

interface ZoneVisual { zone: Zone; fill: THREE.Mesh; border: THREE.LineLoop; tag: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string }

/**
 * The land plan (P): every buildable zone coloured by its state, with cost/time
 * labels. Hidden late-game sites appear only in dev mode or once revealed.
 */
export class PlanOverlay {
  readonly group = new THREE.Group();
  private visuals: ZoneVisual[] = [];

  constructor(
    private readonly system: ClearanceSystem,
    private readonly dev: boolean,
  ) {
    this.group.name = 'planOverlay';
    this.group.visible = false;
    for (const z of ZONES) this.visuals.push(this.build(z));
    this.refresh();
  }

  private build(z: Zone): ZoneVisual {
    const y = Terrain.levelHeight(z.level) + 0.08;
    const w = z.maxX - z.minX;
    const d = z.maxZ - z.minZ;
    const cx = (z.minX + z.maxX) / 2;
    const cz = (z.minZ + z.maxZ) / 2;
    const inset = 0.18;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w - inset * 2, d - inset * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
    );
    fill.position.set(cx, y, cz);
    fill.renderOrder = 10;
    const pts = [
      [z.minX + inset, z.minZ + inset], [z.maxX - inset, z.minZ + inset],
      [z.maxX - inset, z.maxZ - inset], [z.minX + inset, z.maxZ - inset],
    ].map(([x, zz]) => new THREE.Vector3(x, y + 0.01, zz));
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ depthTest: false, transparent: true }));
    border.renderOrder = 11;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 120;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    tag.scale.set(6.4, 2.4, 1);
    tag.position.set(cx, y + 1.2, cz);
    tag.renderOrder = 20;
    this.group.add(fill, border, tag);
    return { zone: z, fill, border, tag, canvas, tex, key: '' };
  }

  /** Recolour and relabel every zone (cheap; skips zones whose label hasn't changed). */
  refresh() {
    for (const v of this.visuals) {
      const z = v.zone;
      const state = this.system.state(z);
      const visible = state !== 'hidden' || this.dev;
      v.fill.visible = v.border.visible = v.tag.visible = visible;
      if (!visible) continue;
      const color = STATE_COLORS[state];
      (v.fill.material as THREE.MeshBasicMaterial).color.set(color);
      (v.fill.material as THREE.MeshBasicMaterial).opacity = state === 'open' || state === 'cleared' ? 0.2 : 0.32;
      (v.border.material as THREE.LineBasicMaterial).color.set(color);
      const w = z.maxX - z.minX;
      const d = z.maxZ - z.minZ;
      let sub = '';
      if (state === 'open') sub = `${w}×${d} · open`;
      else if (state === 'cleared') sub = 'cleared';
      else if (state === 'locked') sub = 'locked';
      else if (state === 'hidden') sub = 'secret · late game';
      else if (state === 'clearing') {
        const job = this.system.jobs.get(z.id)!;
        sub = `${Math.floor(job.progress(gameClock.time) * 100)}% · ${formatDuration(job.startTime + job.duration - gameClock.time)}`;
      } else {
        const step = this.system.stepFor(z);
        sub = `${step.hours}h · ${fmtK(step.supplies)} supplies`;
      }
      const key = `${z.label}|${sub}|${color}`;
      if (key !== v.key) {
        drawLabel(v.canvas, z.label, sub, color);
        v.tex.needsUpdate = true;
        v.key = key;
      }
    }
  }
}

/** Summary numbers for the legend. */
export function planSummary() {
  const sum = (k: Zone['kind']) => ZONES.filter((z) => z.kind === k).reduce((a, z) => a + zoneTiles(z), 0);
  const count = (k: Zone['kind']) => ZONES.filter((z) => z.kind === k).length;
  return {
    starter: sum('starter'),
    jungle: sum('jungle'),
    jungleZones: count('jungle'),
    hidden: sum('hidden'),
    hiddenZones: count('hidden'),
    total: sum('starter') + sum('jungle') + sum('hidden'),
  };
}
