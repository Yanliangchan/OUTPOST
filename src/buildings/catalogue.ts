import { HQ } from './hq';
import { BUNK } from './bunk';
import { COOKHOUSE } from './cookhouse';
import type { BuildingDef } from './types';

/**
 * Building catalogue. Each building lives in its own file with 20 designed
 * levels (10 at release, 11–15 planned, 16–20 reserve). See docs/BUILDINGS_PLAN.md.
 */
export const BUILDINGS: BuildingDef[] = [HQ, BUNK, COOKHOUSE];
