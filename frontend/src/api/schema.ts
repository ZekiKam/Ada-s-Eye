/**
 * Hand-written stand-ins for the backend schema while it is still changing.
 *
 * Once a backend's openapi.json settles, `bun run sync` generates these types
 * (and the fetch functions) under `@/api/generated/<view>/`. At that point,
 * re-export the generated types from here, or import them directly and
 * delete this file. Nothing outside `src/views/` constructs these objects, so
 * the swap is confined to the view folders.
 */

/** Request query. Both bounds are optional UNIX timestamps in seconds. */
export interface Query {
	time_range_start?: number;
	time_range_end?: number;
}

/**
 * One item drawn on the globe. Field names follow the example event schema
 * in docs/PRD.md section 4 ("How the example schemas map").
 */
export interface GlobeEvent {
	/** WGS84 degrees, -180 to 180. */
	longitude: number;
	/** WGS84 degrees, -90 to 90. */
	latitude: number;
	/** Footprint radius in metres, at least 1. Drawn at true scale. */
	range: number;
	/** Category key. Each view maps its known keys to a label and tone. */
	event_type: string;
	/** UNIX timestamp in seconds, UTC. */
	event_time: number;
}

/** A backend response: the events inside the requested time range. */
export type EventsResponse = GlobeEvent[];
