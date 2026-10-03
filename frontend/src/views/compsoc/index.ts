import { exampleSource } from "../example";
import type { ViewDefinition } from "../types";
import { COMPSOC_EXAMPLE } from "./example";

export const compsoc: ViewDefinition = {
	id: "compsoc",
	label: "Anomaly watch",
	challenge: "CompSoc",
	hasTimeWindow: true,
	isMock: true,
	categories: [
		{ key: "earthquake", label: "Earthquake", tone: "danger" },
		{ key: "flood", label: "Flood", tone: "info" },
		{ key: "air_quality", label: "Air quality", tone: "warning" },
		{ key: "heat", label: "Heat", tone: "accent1" },
	],
	// Swap for the Orval client once the backend schema settles, e.g.
	// fetchEvents: (query, signal) => getAllPoints(query, { signal }),
	// and set isMock to false.
	fetchEvents: exampleSource(COMPSOC_EXAMPLE),
};
