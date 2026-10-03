import { exampleSource } from "../example";
import type { ViewDefinition } from "../types";
import { OPTIVER_EXAMPLE } from "./example";

export const optiver: ViewDefinition = {
	id: "optiver",
	label: "Carbon portfolio",
	challenge: "Optiver",
	hasTimeWindow: false,
	isMock: true,
	categories: [
		{ key: "forestry", label: "Forestry", tone: "positive" },
		{ key: "renewable", label: "Renewable", tone: "info" },
		{ key: "cookstoves", label: "Cookstoves", tone: "warning" },
		{ key: "methane", label: "Methane", tone: "accent4" },
	],
	// Swap for the Orval client once the backend schema settles.
	fetchEvents: exampleSource(OPTIVER_EXAMPLE, { ignoreTimeRange: true }),
};
