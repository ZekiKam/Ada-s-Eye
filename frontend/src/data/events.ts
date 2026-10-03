import type { GlobeEvent } from "@/api/schema";

/**
 * Stable identity for an event. The schema has no id field, so it is derived
 * from the fields that do not change between polls. Swap for the backend's
 * id once it sends one.
 */
export function eventKey(e: GlobeEvent): string {
	return `${e.event_type}|${e.event_time}|${e.longitude.toFixed(4)}|${e.latitude.toFixed(4)}`;
}

/** Newest first. */
export function byNewest(a: GlobeEvent, b: GlobeEvent): number {
	return b.event_time - a.event_time;
}
