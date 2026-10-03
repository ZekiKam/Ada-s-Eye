/**
 * Hand-written stand-ins for the backend schema while it is still changing.
 *
 * Once the backend's openapi.json settles, `bun run sync` generates these
 * types (and the fetch functions) under `@/api/generated/`. At that point,
 * re-export the generated types from here, or import them directly and
 * delete this file. Only `src/data/` constructs these objects, so the swap is
 * confined there.
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
export interface GlobePoint {
  /** WGS84 degrees, -180 to 180. */
  longitude: number;
  /** WGS84 degrees, -90 to 90. */
  latitude: number;
  /** Footprint radius in metres, at least 1. Drawn at true scale. */
  range: number;
  /** Category key. `data/categories.ts` maps known keys to a label and tone. */
  event_type: string;
  /** UNIX timestamp in seconds, UTC. */
  event_time: number;
}

/** A backend response: the points inside the requested time range. */
export type PointsResponse = GlobePoint[];
