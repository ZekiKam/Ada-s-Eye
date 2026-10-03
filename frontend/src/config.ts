/** How often events are re-fetched. One request per interval per open tab. */
export const POLL_INTERVAL_MS =
	Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 10_000;

/** Years the timeline covers, inclusive. It opens on the last. */
export const FIRST_YEAR = 2010;
export const LAST_YEAR = 2026;

/** Events younger than this pulse on the globe. */
export const NEW_EVENT_AGE_S = 15 * 60;

/** Globe rotates on its own after this long without interaction. */
export const IDLE_ROTATE_AFTER_MS = 10_000;

/** Mean Earth radius, for converting footprint radii to angles. */
export const EARTH_RADIUS_M = 6_371_000;
