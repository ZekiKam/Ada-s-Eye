import type { GlobePoint } from "@/api/generated/model";
import type { Tone } from "@/theme/tones";

/** Every point is a past wildfire. */
export const WILDFIRE: { label: string; tone: Tone } = {
	label: "Wildfire",
	tone: "danger",
};

/** A hot satellite detection with no recorded wildfire to explain it. */
export const ANOMALY: { label: string; tone: Tone } = {
	label: "Anomaly",
	tone: "positive",
};

/**
 * Stable identity for a point. The backend treats (longitude, latitude) as
 * the id; the time is added so a place that burned twice stays two points.
 */
export function eventKey(e: GlobePoint): string {
	return `${e.longitude}|${e.latitude}|${e.event_time}`;
}

/** `event_time` (an ISO 8601 string) as a UNIX timestamp in seconds. */
export function eventSeconds(e: GlobePoint): number {
	return Date.parse(e.event_time) / 1000;
}
