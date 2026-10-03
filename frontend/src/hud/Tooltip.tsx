import type { FoundAnomalyPoint, GlobePoint } from "@/api/generated/model";
import { ANOMALY, eventSeconds, WILDFIRE } from "@/data/events";
import { formatAge, formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";

export function Tooltip({ event }: { event: GlobePoint }) {
	return (
		<div className="ml-4 -translate-y-1/2 border border-border bg-panel px-2.5 py-1.5 whitespace-nowrap">
			<div className="label-caps" style={{ color: toneVar(WILDFIRE.tone) }}>
				{WILDFIRE.label}
			</div>
			<div className="font-mono text-xs text-muted-foreground">
				{formatAge(eventSeconds(event), Date.now())} ·{" "}
				{formatDistance(event.radius)}
			</div>
		</div>
	);
}

/**
 * A found anomaly: who found it, its leaderboard place if it has one, then
 * when, its radius, intensity and confidence.
 */
export function AnomalyTooltip({ anomaly }: { anomaly: FoundAnomalyPoint }) {
	const mine = useGlobeStore((s) => anomaly.id in s.claims);
	const finder = anomaly.name ?? (mine ? "Found by you" : "Unnamed finder");
	return (
		<div className="ml-4 flex -translate-y-1/2 flex-col gap-0.5 border border-border bg-panel px-2.5 py-1.5 whitespace-nowrap">
			<div className="label-caps" style={{ color: toneVar(ANOMALY.tone) }}>
				{ANOMALY.label}
				{anomaly.rank !== null && ` · No. ${anomaly.rank}`}
			</div>
			<div
				className={cn(
					"text-sm",
					!anomaly.name && "italic text-muted-foreground",
				)}
			>
				{finder}
			</div>
			<div className="font-mono text-xs text-muted-foreground">
				{formatAge(eventSeconds(anomaly), Date.now())} ·{" "}
				{formatDistance(anomaly.radius)}
			</div>
			<div className="font-mono text-xs text-muted-foreground">
				{Math.round(anomaly.intensity)} K ·{" "}
				{Math.round(anomaly.confidence * 100)}% confidence
			</div>
		</div>
	);
}
