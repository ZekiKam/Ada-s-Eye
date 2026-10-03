import type { ExampleEvent } from "../example";

type Project = Omit<ExampleEvent, "seconds_ago">;

/** Example carbon-credit projects. Not time-bound. */
const PROJECTS: readonly Project[] = [
	{ event_type: "forestry", longitude: -60.0, latitude: -3.1, range: 48_000 },
	{ event_type: "forestry", longitude: 23.6, latitude: -1.2, range: 36_000 },
	{ event_type: "forestry", longitude: 113.9, latitude: -0.8, range: 30_000 },
	{ event_type: "forestry", longitude: -84.1, latitude: 9.9, range: 12_000 },
	{ event_type: "renewable", longitude: 72.9, latitude: 23.0, range: 6_000 },
	{ event_type: "renewable", longitude: -2.6, latitude: 57.5, range: 9_000 },
	{ event_type: "renewable", longitude: 18.4, latitude: -33.9, range: 5_000 },
	{ event_type: "renewable", longitude: -70.6, latitude: -23.6, range: 7_500 },
	{ event_type: "cookstoves", longitude: 36.8, latitude: -1.3, range: 20_000 },
	{ event_type: "cookstoves", longitude: 32.6, latitude: 0.3, range: 18_000 },
	{ event_type: "cookstoves", longitude: -1.6, latitude: 6.7, range: 15_000 },
	{ event_type: "methane", longitude: -95.4, latitude: 29.8, range: 3_000 },
	{ event_type: "methane", longitude: 104.1, latitude: 30.7, range: 4_000 },
	{ event_type: "methane", longitude: -47.9, latitude: -15.8, range: 3_500 },
];

export const OPTIVER_EXAMPLE: readonly ExampleEvent[] = PROJECTS.map(
	(p, i) => ({ ...p, seconds_ago: 30 * 86400 + i * 3600 }),
);
