import type { Tone } from "@/theme/tones";

/** How one `event_type` value is labelled and coloured. */
export interface Category {
	key: string;
	label: string;
	tone: Tone;
}

/** Known `event_type` values, in legend order. Unknown ones render neutral. */
export const CATEGORIES: readonly Category[] = [
	{ key: "earthquake", label: "Earthquake", tone: "danger" },
	{ key: "flood", label: "Flood", tone: "info" },
	{ key: "air_quality", label: "Air quality", tone: "warning" },
	{ key: "heat", label: "Heat", tone: "accent1" },
];

/** The category for an `event_type`, falling back to a neutral one. */
export function categoryOf(key: string): Category {
	return (
		CATEGORIES.find((c) => c.key === key) ?? {
			key,
			label: key.replaceAll("_", " "),
			tone: "neutral",
		}
	);
}
