import type { ExampleEvent } from "../example";

type Site = Omit<ExampleEvent, "seconds_ago">;

/** Example sites of one fictional company. Not time-bound. */
const SITES: readonly Site[] = [
	{ event_type: "office", longitude: -3.19, latitude: 55.95, range: 800 },
	{ event_type: "office", longitude: -0.09, latitude: 51.51, range: 600 },
	{
		event_type: "data_centre",
		longitude: -6.26,
		latitude: 53.35,
		range: 1_500,
	},
	{ event_type: "data_centre", longitude: 8.68, latitude: 50.11, range: 1_800 },
	{ event_type: "factory", longitude: -1.47, latitude: 53.38, range: 2_500 },
	{ event_type: "factory", longitude: 120.3, latitude: 31.5, range: 3_000 },
	{ event_type: "warehouse", longitude: 4.4, latitude: 51.9, range: 2_000 },
	{ event_type: "warehouse", longitude: -2.98, latitude: 53.41, range: 1_700 },
];

export const GRESEARCH_EXAMPLE: readonly ExampleEvent[] = SITES.map((s, i) => ({
	...s,
	seconds_ago: 90 * 86400 + i * 3600,
}));
