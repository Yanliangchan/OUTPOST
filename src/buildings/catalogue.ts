import { HQ } from './hq';
import { BUNK } from './bunk';
import { COOKHOUSE } from './cookhouse';
import { QM_STORE } from './qmstore';
import { WORKSHOP } from './workshop';
import { UTILITIES } from './utilities';
import { MAMA_SHOP } from './mamashop';
import type { BuildingDef } from './types';

/**
 * Building catalogue. Each building lives in its own file with 20 designed
 * levels (10 at release, 11–15 planned, 16–20 reserve). See docs/BUILDINGS_PLAN.md.
 */
export const BUILDINGS: BuildingDef[] = [HQ, BUNK, COOKHOUSE, QM_STORE, WORKSHOP, UTILITIES, MAMA_SHOP];
