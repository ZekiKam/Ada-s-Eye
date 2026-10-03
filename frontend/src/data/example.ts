import type { GlobePoint, Query } from "@/api/schema";

/**
 * An example point. Recent ones are timed relative to page load so they age
 * realistically; older ones carry a fixed UTC date ("2011-03-11").
 */
export type ExampleEvent = Omit<GlobePoint, "event_time"> &
	({ seconds_ago: number } | { date: string });

const LATENCY_MS = 120;

/**
 * Builds a `fetchEvents` that serves a constant list, filtered by the query's
 * time range the way a backend would. Stand-in until the Orval client exists.
 */
export function exampleSource(items: readonly ExampleEvent[]) {
	const anchor = Math.floor(Date.now() / 1000);
	const events: GlobePoint[] = items.map((item) => {
		const { longitude, latitude, range, event_type } = item;
		const event_time =
			"date" in item
				? Date.parse(`${item.date}T12:00:00Z`) / 1000
				: anchor - item.seconds_ago;
		return { longitude, latitude, range, event_type, event_time };
	});

	return async (query: Query, signal?: AbortSignal): Promise<GlobePoint[]> => {
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
