/**
 * Release gating. Every building is designed and balanced to MAX_DESIGNED_LEVEL;
 * players can only reach RELEASE_MAX_LEVEL until later content updates raise it.
 */
export const MAX_DESIGNED_LEVEL = 15;
export const RELEASE_MAX_LEVEL = 10;

export const isReleased = (level: number) => level <= RELEASE_MAX_LEVEL;
