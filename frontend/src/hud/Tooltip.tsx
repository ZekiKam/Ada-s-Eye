import type { GlobePoint } from "@/api/generated/model";
import { eventSeconds, WILDFIRE } from "@/data/events";
import { formatAge, formatDistance } from "@/lib/format";
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
