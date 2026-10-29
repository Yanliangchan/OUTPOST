import { C, Kit } from './kit';
import { HOUR, type BuildingDef, type LevelStats } from './types';

/* PLACEHOLDER: replaced by the full 20-level design. */

const LEVELS: LevelStats[] = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1, title: 'Placeholder', supplies: 1000 * (i + 1), reputation: 100 * (i + 1), buildTime: HOUR, hp: 1000 + i * 100, stats: {}, unlocks: [],
}));

function build(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  k.block(2, 2, 1 + (level > 10 ? 1 : 0), 0, y, 0, C.wall);
  return k;
}

export const ARMOURY: BuildingDef = {
  id: 'armoury', name: 'Armoury', role: '(placeholder)', footprint: [3, 3], unlockHq: 9, levels: LEVELS, designedLevels: 20, build,
};
