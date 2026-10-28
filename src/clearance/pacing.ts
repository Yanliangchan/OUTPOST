/**
 * Long-term pacing for land clearance.
 * Cost and time scale with HOW MANY zones the player has cleared (not which
 * zone), so players choose the direction their outpost grows in.
 * HQ requirements are listed now and enforced once the HQ exists (Phase 6).
 */
export interface ClearanceStep {
  hours: number;
  supplies: number;
  hq: number;
}

/** The nth jungle zone cleared uses JUNGLE_PACING[n]. 12 zones in total. */
export const JUNGLE_PACING: ClearanceStep[] = [
  { hours: 2, supplies: 1_500, hq: 2 },
  { hours: 4, supplies: 4_000, hq: 2 },
  { hours: 8, supplies: 9_000, hq: 3 },
  { hours: 12, supplies: 16_000, hq: 3 },
  { hours: 16, supplies: 28_000, hq: 4 },
  { hours: 24, supplies: 45_000, hq: 4 },
  { hours: 30, supplies: 70_000, hq: 5 },
  { hours: 36, supplies: 100_000, hq: 5 },
  { hours: 48, supplies: 150_000, hq: 6 },
  { hours: 60, supplies: 200_000, hq: 6 },
  { hours: 72, supplies: 260_000, hq: 7 },
  { hours: 84, supplies: 330_000, hq: 7 },
];

/** Hidden late-game sites (revealed by a later unlock). */
export const HIDDEN_PACING: Record<string, ClearanceStep> = {
  cove: { hours: 96, supplies: 400_000, hq: 8 },
  lakeside: { hours: 120, supplies: 500_000, hq: 8 },
  ridge: { hours: 144, supplies: 650_000, hq: 9 },
};

/** Number of contractor crews (one clearance job at a time). */
export const CLEARANCE_CREWS = 1;

/**
 * How the visible work trails the felling front, in tiles:
 * logs are hauled HAUL_LAG tiles behind, ground graded GRADE_LAG tiles behind.
 */
export const HAUL_LAG = 4;
export const GRADE_LAG = 13;
/** Grass regrows over the bare ground for this fraction of the job's time after completion. */
export const REGROW_FRACTION = 0.2;
