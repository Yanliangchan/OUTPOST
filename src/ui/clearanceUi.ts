import * as THREE from 'three';
import type { ClearanceSystem } from '../clearance/clearanceSystem';
import { CLEARANCE_CREWS } from '../clearance/pacing';
import { formatDuration, gameClock } from '../core/gameClock';
import { Terrain } from '../world/terrain';
import type { Zone } from '../world/zones';

const fmt = (n: number) => n.toLocaleString('en-SG');

/**
 * Zone panel (click a jungle zone), the floating progress tag above active
 * sites, and the preview-speed control used to review long timers.
 */
export class ClearanceUi {
  private panel: HTMLDivElement;
  private selected: Zone | null = null;
  readonly tags = new THREE.Group();
  private tagMap = new Map<string, { sprite: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string }>();
  private acc = 0;

  constructor(
    private readonly system: ClearanceSystem,
    private readonly onStart: (z: Zone) => void,
  ) {
    this.panel = document.createElement('div');
    this.panel.className = 'chip zone-panel';
    this.panel.hidden = true;
    document.querySelector('.hud')!.appendChild(this.panel);

    const speed = document.createElement('div');
    speed.className = 'chip speed';
    speed.innerHTML = `<span>Preview speed</span>${[1, 60, 600, 3600].map((s) => `<button data-s="${s}" class="${s === 1 ? 'on' : ''}">${s}×</button>`).join('')}`;
    speed.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        gameClock.scale = Number(b.dataset.s);
        speed.querySelectorAll('button').forEach((o) => o.classList.toggle('on', o === b));
      }),
    );
    document.querySelector('.hud')!.appendChild(speed);
    system.onChange(() => this.render());
  }

  select(z: Zone | null) {
    this.selected = z;
    this.render();
  }

  private render() {
    const z = this.selected;
    if (!z || z.kind === 'starter' || this.system.state(z) === 'hidden') {
      this.panel.hidden = true;
      return;
    }
    this.panel.hidden = false;
    const state = this.system.state(z);
    const step = this.system.stepFor(z);
    const title = z.kind === 'hidden' ? z.label : `Jungle · Zone ${z.label}`;
    let body = '';
    if (state === 'available') {
      const busy = this.system.crewsBusy >= CLEARANCE_CREWS;
      const busyId = [...this.system.jobs.keys()][0];
      body = `
        <p>Bring in a contractor crew to clear this jungle for building.</p>
        <div class="row"><span>Cost</span><b>${fmt(step.supplies)} Supplies</b></div>
        <div class="row"><span>Time</span><b>${formatDuration(step.hours * 3600)}</b></div>
        <div class="row"><span>Requires</span><b>HQ level ${step.hq}</b></div>
        <div class="row"><span>Crew</span><b>${CLEARANCE_CREWS - this.system.crewsBusy}/${CLEARANCE_CREWS} available</b></div>
        <button class="primary" ${busy ? 'disabled' : ''}>${busy ? `Crew busy on ${busyId}` : 'Start clearing'}</button>
        <small>Supplies and HQ level are not enforced until the economy arrives (Phase 6).</small>`;
    } else if (state === 'locked') {
      body = `<p>Dense jungle. Clear a neighbouring zone first so the crew can get their machines in.</p>`;
    } else if (state === 'clearing') {
      body = `<p>Contractor crew on site: 5 workers, excavator, bulldozer and log truck.</p>
        <div class="bar"><i></i></div>
        <div class="row"><span>Progress</span><b class="pct"></b></div>
        <div class="row"><span>Time left</span><b class="left"></b></div>`;
    } else if (state === 'cleared') {
      body = `<p>Cleared land, ready to build on (construction arrives in Phase 4).</p>`;
    }
    this.panel.innerHTML = `<div class="head"><b>${title}</b><button class="x" title="Close">×</button></div>${body}`;
    this.panel.querySelector('.x')!.addEventListener('click', () => this.select(null));
    this.panel.querySelector('.primary')?.addEventListener('click', () => this.onStart(z));
    this.tick(0, true);
  }

  /** Per frame: refresh progress text and the floating tags (throttled). */
  tick(dt: number, force = false) {
    this.acc += dt;
    if (!force && this.acc < 0.25) return;
    this.acc = 0;
    const z = this.selected;
    if (z && this.system.state(z) === 'clearing') {
      const job = this.system.jobs.get(z.id)!;
      const p = job.progress(gameClock.time);
      const bar = this.panel.querySelector<HTMLElement>('.bar i');
      if (bar) bar.style.width = `${p * 100}%`;
      const pct = this.panel.querySelector('.pct');
      if (pct) pct.textContent = `${Math.floor(p * 100)}%`;
      const left = this.panel.querySelector('.left');
      if (left) left.textContent = formatDuration(job.startTime + job.duration - gameClock.time);
    }
    // Floating tags over active jobs
    for (const [id, job] of this.system.jobs) {
      let t = this.tagMap.get(id);
      if (!t) {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 96;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        sprite.scale.set(4.6, 1.47, 1);
        sprite.renderOrder = 30;
        const zn = job.zone;
        sprite.position.set((zn.minX + zn.maxX) / 2, Terrain.levelHeight(zn.level) + 4.2, (zn.minZ + zn.maxZ) / 2);
        this.tags.add(sprite);
        t = { sprite, canvas, tex, key: '' };
        this.tagMap.set(id, t);
      }
      const p = job.progress(gameClock.time);
      const key = `${Math.floor(p * 100)}|${formatDuration(job.startTime + job.duration - gameClock.time)}`;
      if (key !== t.key) {
        t.key = key;
        const g = t.canvas.getContext('2d')!;
        g.clearRect(0, 0, 300, 96);
        g.fillStyle = 'rgba(255,255,252,0.95)';
        g.beginPath();
        g.roundRect(6, 6, 288, 84, 20);
        g.fill();
        g.fillStyle = '#26332a';
        g.font = '900 26px Nunito, system-ui, sans-serif';
        g.fillText(`Clearing ${id}`, 22, 38);
        g.fillStyle = '#5d6b60';
        g.font = '800 22px Nunito, system-ui, sans-serif';
        g.textAlign = 'right';
        g.fillText(formatDuration(job.startTime + job.duration - gameClock.time), 278, 38);
        g.textAlign = 'left';
        g.fillStyle = 'rgba(38,51,42,0.12)';
        g.beginPath();
        g.roundRect(22, 54, 256, 18, 9);
        g.fill();
        g.fillStyle = '#2bb3a3';
        g.beginPath();
        g.roundRect(22, 54, Math.max(18, 256 * p), 18, 9);
        g.fill();
        t.tex.needsUpdate = true;
      }
    }
    for (const [id, t] of this.tagMap) {
      if (!this.system.jobs.has(id)) {
        t.sprite.removeFromParent();
        this.tagMap.delete(id);
      }
    }
  }
}
