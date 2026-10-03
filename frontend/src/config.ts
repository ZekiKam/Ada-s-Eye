/** How often events are re-fetched. One request per interval per open tab. */
export const POLL_INTERVAL_MS =
	Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 10_000;

/** Time windows offered by the time-window control, in seconds. */
export const WINDOW_OPTIONS = [
	{ seconds: 3600, label: "1 h" },
	{ seconds: 21600, label: "6 h" },
	{ seconds: 86400, label: "24 h" },
	{ seconds: 604800, label: "7 d" },
] as const;

export type WindowSeconds = (typeof WINDOW_OPTIONS)[number]["seconds"];

export const DEFAULT_WINDOW_S: WindowSeconds = 86400;

/** Events younger than this pulse on the globe. */
export const NEW_EVENT_AGE_S = 15 * 60;

/** Globe rotates on its own after this long without interaction. */
export const IDLE_ROTATE_AFTER_MS = 10_000;

/** Mean Earth radius, for converting footprint radii to angles. */
export const EARTH_RADIUS_M = 6_371_000;
