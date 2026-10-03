/** Years the timeline covers, inclusive. It opens on the last. */
export const FIRST_YEAR = 2010;
export const LAST_YEAR = 2026;

/** Events younger than this pulse on the globe. */
export const NEW_EVENT_AGE_S = 15 * 60;

/** How long a finger must rest on a point to select it. */
export const LONG_PRESS_MS = 500;

/** Globe rotates on its own after this long without interaction. */
export const IDLE_ROTATE_AFTER_MS = 10_000;

/** Mean Earth radius, for converting footprint radii to angles. */
export const EARTH_RADIUS_M = 6_371_000;
