import { useQuery } from "@tanstack/react-query";
import type { GlobeEvent } from "@/api/schema";
import { POLL_INTERVAL_MS } from "@/config";
import type { ViewDefinition } from "@/views/types";

/**
 * - `loading`: first fetch for this view is in flight.
 * - `live`: the last fetch succeeded.
 * - `stale`: a fetch succeeded earlier, the latest failed. Old data stays up.
 * - `offline`: nothing has succeeded for this view yet. Nothing is drawn.
 */
export type FeedStatus = "loading" | "live" | "stale" | "offline";

export interface ViewEvents {
	events: GlobeEvent[];
	status: FeedStatus;
	/** Milliseconds since epoch of the data on screen, or 0 if none. */
	updatedAt: number;
	error: Error | null;
}

const NO_EVENTS: GlobeEvent[] = [];

/**
 * Polls the active view. The key holds the window length, not absolute
 * times, so it stays stable across polls and the globe never blanks: the
 * absolute range is computed at fetch time. Results stay in the query cache,
 * so switching back to a view shows its last data immediately.
 */
export function useViewEvents(
	view: ViewDefinition,
	windowSeconds: number,
): ViewEvents {
	const windowKey = view.hasTimeWindow ? windowSeconds : null;

	const query = useQuery({
		queryKey: ["events", view.id, windowKey],
		queryFn: ({ signal }) => {
			const end = Math.floor(Date.now() / 1000);
			return view.fetchEvents(
				{ time_range_start: end - windowSeconds, time_range_end: end },
				signal,
			);
		},
		refetchInterval: POLL_INTERVAL_MS,
		refetchIntervalInBackground: false,
		staleTime: POLL_INTERVAL_MS,
		retry: 1,
		// Keep the previous window's events while a new window loads, but never
		// show one view's events under another view's name.
		placeholderData: (previous, previousQuery) =>
			previousQuery?.queryKey[1] === view.id ? previous : undefined,
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
