import { exampleSource } from "../example";
import type { ViewDefinition } from "../types";
import { GRESEARCH_EXAMPLE } from "./example";

export const gresearch: ViewDefinition = {
	id: "gresearch",
	label: "Footprint vs profit",
	challenge: "G-Research",
	hasTimeWindow: false,
	isMock: true,
	categories: [
		{ key: "office", label: "Office", tone: "accent2" },
		{ key: "data_centre", label: "Data centre", tone: "info" },
		{ key: "factory", label: "Factory", tone: "danger" },
		{ key: "warehouse", label: "Warehouse", tone: "warning" },
	],
	// Swap for the Orval client once the backend schema settles.
	fetchEvents: exampleSource(GRESEARCH_EXAMPLE, { ignoreTimeRange: true }),
};
