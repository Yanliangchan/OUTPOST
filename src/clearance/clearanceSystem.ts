import * as THREE from 'three';
import { ZONES, type Zone } from '../world/zones';
import type { Vegetation } from '../world/vegetation';
import type { Particles } from '../fx/particles';
import { gameClock } from '../core/gameClock';
import { ClearanceJob, type Side } from './clearanceJob';
import { CLEARANCE_CREWS, HIDDEN_PACING, JUNGLE_PACING, type ClearanceStep } from './pacing';

export type ZoneState = 'open' | 'available' | 'locked' | 'clearing' | 'cleared' | 'hidden';

/** Tracks which land is open, which can be cleared next, and runs clearance jobs. */
export class ClearanceSystem {
  readonly group = new THREE.Group();
  private cleared = new Set<string>(['start']);
  private revealed = new Set<string>();
  readonly jobs = new Map<string, ClearanceJob>();
  private finishing: ClearanceJob[] = [];
  private listeners: (() => void)[] = [];

  constructor(
    private readonly vegetation: Vegetation,
    private readonly fx: Particles,
  ) {
    this.group.name = 'clearance';
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  /** Make a hidden late-game site visible and clearable (future unlock event). */
  reveal(id: string) {
    this.revealed.add(id);
    this.emit();
  }

  zone(id: string) {
    return ZONES.find((z) => z.id === id);
  }

  get clearedJungleCount() {
    return ZONES.filter((z) => z.kind === 'jungle' && this.cleared.has(z.id)).length;
  }

  /** The cost/time the next clearance would take for this zone. */
  stepFor(z: Zone): ClearanceStep {
    if (z.kind === 'hidden') return HIDDEN_PACING[z.id];
    const n = this.clearedJungleCount + [...this.jobs.values()].filter((j) => j.zone.kind === 'jungle').length;
    return JUNGLE_PACING[Math.min(n, JUNGLE_PACING.length - 1)];
  }

  /** The side of `z` that borders open land, preferring the starting clearing. */
  entranceSide(z: Zone): Side | null {
    const open = ZONES.filter((o) => this.cleared.has(o.id));
    const sides: [Side, (o: Zone) => boolean][] = [
      ['minX', (o) => o.maxX === z.minX && o.minZ < z.maxZ && o.maxZ > z.minZ],
      ['maxX', (o) => o.minX === z.maxX && o.minZ < z.maxZ && o.maxZ > z.minZ],
      ['minZ', (o) => o.maxZ === z.minZ && o.minX < z.maxX && o.maxX > z.minX],
      ['maxZ', (o) => o.minZ === z.maxZ && o.minX < z.maxX && o.maxX > z.minX],
    ];
    let best: Side | null = null;
    for (const [side, touches] of sides) {
      const hit = open.filter(touches);
      if (hit.some((o) => o.kind === 'starter')) return side;
      if (hit.length && !best) best = side;
    }
    return best;
  }

  state(z: Zone): ZoneState {
    if (z.kind === 'starter') return 'open';
    if (this.cleared.has(z.id)) return 'cleared';
    if (this.jobs.has(z.id)) return 'clearing';
    if (z.kind === 'hidden' && !this.revealed.has(z.id)) return 'hidden';
    if (z.kind === 'hidden') return 'available'; // access is by sea/track — handled when the unlock is designed
    return this.entranceSide(z) ? 'available' : 'locked';
  }

  get crewsBusy() {
    return this.jobs.size;
  }

  canStart(z: Zone) {
    return this.state(z) === 'available' && this.crewsBusy < CLEARANCE_CREWS && z.kind === 'jungle';
  }

  start(id: string): ClearanceJob | null {
    const z = this.zone(id);
    if (!z || !this.canStart(z)) return null;
    const side = this.entranceSide(z)!;
    const step = this.stepFor(z);
    const job = new ClearanceJob(z, this.vegetation.clearables[z.id], side, gameClock.time, step.hours * 3600, this.fx);
    this.group.add(job.group);
    this.jobs.set(z.id, job);
    this.emit();
    return job;
  }

  update(realDt: number) {
    for (const [id, job] of this.jobs) {
      job.update(gameClock.time, realDt);
      if (job.isComplete) {
        this.jobs.delete(id);
        this.cleared.add(id);
        this.finishing.push(job);
        this.emit();
      }
    }
    // Completed jobs keep running for the pack-up and grass regrowth.
    this.finishing = this.finishing.filter((job) => {
      job.update(gameClock.time, realDt);
      if (job.isDone) {
        job.dispose();
        return false;
      }
      return true;
    });
  }
}
