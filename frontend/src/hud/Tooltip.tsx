import type { GlobeEvent } from "@/api/schema";
import { formatAge, formatDistance } from "@/lib/format";
import { toneVar } from "@/theme/tones";
import type { Category } from "@/views/types";

export function Tooltip({
	event,
	category,
}: {
	event: GlobeEvent;
	category: Category;
}) {
	return (
		<div className="ml-4 -translate-y-1/2 border border-border bg-panel px-2.5 py-1.5 whitespace-nowrap">
			<div className="label-caps" style={{ color: toneVar(category.tone) }}>
				{category.label}
			</div>
			<div className="font-mono text-xs text-muted-foreground">
				{formatAge(event.event_time, Date.now())} ·{" "}
				{formatDistance(event.range)}
			</div>
		</div>
	);
}
