import type { Kit } from './kit';

/** Per-level balance data. All costs in Supplies; times in seconds. */
export interface LevelStats {
  level: number;
  /** Display name for this tier, e.g. "Command Tent". */
  title: string;
  supplies: number;
  /** Reputation the player must have earned to start this upgrade. */
  reputation: number;
  buildTime: number;
  /** Structure hit points (used by raids from Phase 7). */
  hp: number;
  /** Building-specific stats (capacity, output, etc.). */
  stats: Record<string, number>;
  /** What reaching this level unlocks (human-readable). */
  unlocks: string[];
}

export interface BuildingDef {
  id: string;
  name: string;
  /** One-line role shown in the catalogue. */
  role: string;
  /** Footprint in tiles: [width along x, depth along z]. Constant across levels. */
  footprint: [number, number];
  /** HQ level that unlocks the first one. */
  unlockHq: number;
  /** Balance data for levels 1..MAX_DESIGNED_LEVEL (index = level - 1). */
  levels: LevelStats[];
  /** Highest level that currently has a visual design (grows as art is built). */
  designedLevels: number;
  build(level: number): Kit;
}

export const MIN = 60;
export const HOUR = 3600;
export const DAY = 86400;
