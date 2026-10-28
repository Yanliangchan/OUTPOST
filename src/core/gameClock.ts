/**
 * Game time in seconds. Timers (construction, clearance) run on game time so
 * they can later be persisted and caught up after the game was closed.
 * `scale` exists for previewing long timers during development.
 */
export class GameClock {
  time = 0;
  scale = 1;
  /** Advance by real seconds; returns elapsed game seconds. */
  tick(realDt: number) {
    const dt = realDt * this.scale;
    this.time += dt;
    return dt;
  }
}

export const gameClock = new GameClock();

export function formatDuration(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
