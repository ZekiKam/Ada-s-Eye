import type { ComponentType } from "react";
import type { GlobeEvent, Query } from "@/api/schema";
import type { Tone } from "@/theme/tones";

export type ViewId = "compsoc" | "optiver" | "gresearch";

/** How one `event_type` value is labelled and coloured. */
export interface Category {
	key: string;
	label: string;
	tone: Tone;
}

export interface ViewDefinition {
	id: ViewId;
	/** Tab label, e.g. "Anomaly watch". */
	label: string;
	/** Sponsor challenge the view answers. */
	challenge: string;
	/** Whether the time-window control applies to this view. */
	hasTimeWindow: boolean;
	/** True while `fetchEvents` serves example data. Shows the MOCK tag. */
	isMock: boolean;
	/** Known `event_type` values, in legend order. Unknown ones render neutral. */
	categories: Category[];
	/** Fetches the events for a time range. Called on every poll. */
	fetchEvents(query: Query, signal?: AbortSignal): Promise<GlobeEvent[]>;
	/** Bespoke per-view panel slot. Unset in this build. */
	Panel?: ComponentType<{ events: GlobeEvent[] }>;
}
