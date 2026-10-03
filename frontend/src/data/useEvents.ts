import { useQuery } from "@tanstack/react-query";
import type { GlobePoint } from "@/api/schema";
import { POLL_INTERVAL_MS } from "@/config";
import { exampleSource } from "./example";
import { EXAMPLE_EVENTS } from "./example-events";

// Swap for the Orval client once the backend schema settles, e.g.
// const fetchEvents = (query: Query, signal?: AbortSignal) =>
// 	getAllPoints(query, { signal });
const fetchEvents = exampleSource(EXAMPLE_EVENTS);

/**
 * - `loading`: the first fetch is in flight.
 * - `live`: the last fetch succeeded.
 * - `stale`: a fetch succeeded earlier, the latest failed. Old data stays up.
 * - `offline`: nothing has succeeded yet. Nothing is drawn.
 */
export type FeedStatus = "loading" | "live" | "stale" | "offline";

export interface Events {
	events: GlobePoint[];
	status: FeedStatus;
	/** Milliseconds since epoch of the data on screen, or 0 if none. */
	updatedAt: number;
	error: Error | null;
}

const NO_EVENTS: GlobePoint[] = [];

/** First and last second of a calendar year, UTC, as UNIX timestamps. */
export function yearRange(year: number): { start: number; end: number } {
	return {
		start: Date.UTC(year, 0, 1) / 1000,
		end: Date.UTC(year + 1, 0, 1) / 1000 - 1,
	};
}

/**
 * Fetches the points inside one calendar year. Only the year still under way
 * is polled: earlier years are settled, so they are fetched once and stay in
 * the query cache, and stepping back to one shows it immediately.
 */
export function useEvents(year: number): Events {
	const { start, end } = yearRange(year);
	const ongoing = Date.now() / 1000 <= end;
	const query = useQuery({
		queryKey: ["events", year],
		queryFn: ({ signal }) =>
			fetchEvents({ time_range_start: start, time_range_end: end }, signal),
		refetchInterval: ongoing ? POLL_INTERVAL_MS : false,
		refetchIntervalInBackground: false,
		staleTime: ongoing ? POLL_INTERVAL_MS : Number.POSITIVE_INFINITY,
		retry: 1,
	});

	let status: FeedStatus;
	if (query.data === undefined) {
		status = query.isError ? "offline" : "loading";
	} else {
		status = query.isError ? "stale" : "live";
	}

	return {
		events: query.data ?? NO_EVENTS,
		status,
		updatedAt: query.data === undefined ? 0 : query.dataUpdatedAt,
		error: query.error,
	};
}
