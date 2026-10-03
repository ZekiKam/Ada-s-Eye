import { Radar } from "lucide-react";
import { useRequestAnomaly } from "@/api/generated";
import type { GlobePoint } from "@/api/generated/model";
import { eventSeconds } from "@/data/events";
import { formatDate, formatDistance, formatLonLat } from "@/lib/format";

/**
 * Sends an anomaly query about the selected point. Shown while a point is
 * selected; mount it keyed by the point so a new selection starts fresh.
 */
export function AnomalyQuery({ point }: { point: GlobePoint }) {
	// customFetch throws ApiError for HTTP errors; network failures are plain Errors.
	const query = useRequestAnomaly<Error>();
	const { longitude, latitude, event_time } = point;

	let status: string;
	if (query.isPending) status = "Querying…";
	else if (query.isError) status = query.error.message;
	else if (query.data) {
		const { confidence, radius } = query.data;
		status = `${Math.round(confidence * 100)}% confidence · ${formatDistance(radius)}`;
	} else {
		status = `${formatDate(eventSeconds(point))} · ${formatLonLat(longitude, latitude)}`;
	}

	return (
		<button
			type="button"
			disabled={query.isPending}
			onClick={() =>
				query.mutate({ data: { longitude, latitude, event_time } })
			}
			className="focus-ring pointer-events-auto engraved flex animate-in items-center gap-3 border border-border bg-panel py-2 pr-4 pl-3 text-left fade-in slide-in-from-bottom-1 transition-colors duration-150 hover:border-foreground disabled:cursor-progress motion-reduce:animate-none"
		>
			<Radar aria-hidden className="size-5 flex-none" />
			<span className="flex flex-col gap-1">
				<span className="font-display text-xl leading-none uppercase">
					Query anomaly
				</span>
				<span
					aria-live="polite"
					className={
						query.isError
							? "label-caps text-tone-danger"
							: "label-caps text-muted-foreground"
					}
				>
					{status}
				</span>
			</span>
		</button>
	);
}
