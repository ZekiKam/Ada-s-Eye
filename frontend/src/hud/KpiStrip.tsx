import type { GlobeEvent } from "@/api/schema";
import { formatAge, formatDistance } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { ViewDefinition } from "@/views/types";

/** Headline numbers, computed from the events on screen. */
export function KpiStrip({
	view,
	events,
}: {
	view: ViewDefinition;
	events: readonly GlobeEvent[];
}) {
	const now = useNow();
	const newest = events.reduce(
		(max, e) => Math.max(max, e.event_time),
		Number.NEGATIVE_INFINITY,
	);
	const largest = events.reduce((max, e) => Math.max(max, e.range), 0);
	const types = new Set(events.map((e) => e.event_type)).size;

	const kpis: [string, string][] = [
		[view.hasTimeWindow ? "In window" : "Plotted", String(events.length)],
		["Types", String(types)],
		["Largest footprint", events.length ? formatDistance(largest) : "—"],
	];
	if (view.hasTimeWindow) {
		kpis.push(["Newest", events.length ? formatAge(newest, now) : "—"]);
	}

	return (
		<dl className="pointer-events-auto flex border border-border bg-panel">
			{kpis.map(([label, value]) => (
				<div
					key={label}
					className="flex flex-col gap-1 border-border px-4 py-2 not-last:border-r"
				>
					<dt className="label-caps text-muted-foreground">{label}</dt>
					<dd className="font-display text-3xl leading-none tabular-nums uppercase">
						{value}
					</dd>
				</div>
			))}
		</dl>
	);
}
