import { useQuery } from "@tanstack/react-query";
import type { GlobePoint } from "@/api/schema";
import { POLL_INTERVAL_MS } from "@/config";
import { exampleSource } from "./example";
import { EXAMPLE_EVENTS } from "./example-events";

// Swap for the Orval client once the backend schema settles, e.g.
// const fetchEvents = (query: Query, signal?: AbortSignal) =>
// 	getAllPoints(query, { signal });
const fetchEvents = exampleSource(EXAMPLE_EVENTS);

const NO_EVENTS: GlobePoint[] = [];

/** First and last second of a calendar year, UTC, as UNIX timestamps. */
function yearRange(year: number): { start: number; end: number } {
	return {
		start: Date.UTC(year, 0, 1) / 1000,
		end: Date.UTC(year + 1, 0, 1) / 1000 - 1,
	};
}

/**
 * Fetches the points inside one calendar year. Only the year still under way
 * is polled: earlier years are settled, so they are fetched once and stay in
 * the query cache, and stepping back to one shows it immediately. Empty until
 * the first fetch succeeds; a failed refetch keeps the last data.
 */
export function useEvents(year: number): GlobePoint[] {
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
	return query.data ?? NO_EVENTS;
}
