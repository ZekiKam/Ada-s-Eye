import type { GlobeEvent, Query } from "@/api/schema";

/** An example event, timed relative to page load so it ages realistically. */
export type ExampleEvent = Omit<GlobeEvent, "event_time"> & {
	seconds_ago: number;
};

const LATENCY_MS = 120;

/**
 * Builds a `fetchEvents` that serves a constant list, filtered by the query's
 * time range the way a backend would. Stand-in until the Orval client exists.
 */
export function exampleSource(items: readonly ExampleEvent[]) {
	const anchor = Math.floor(Date.now() / 1000);
	const events: GlobeEvent[] = items.map(({ seconds_ago, ...rest }) => ({
		...rest,
		event_time: anchor - seconds_ago,
	}));

	return async (query: Query, signal?: AbortSignal): Promise<GlobeEvent[]> => {
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(resolve, LATENCY_MS);
			signal?.addEventListener("abort", () => {
				clearTimeout(timer);
				reject(signal.reason);
			});
		});
		const end = query.time_range_end ?? Math.floor(Date.now() / 1000);
		const start = query.time_range_start ?? end - 86400;
		return events.filter((e) => e.event_time >= start && e.event_time <= end);
	};
}
