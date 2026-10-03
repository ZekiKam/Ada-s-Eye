import type { GlobePoint } from "@/api/schema";
import type { Category } from "@/data/categories";
import { formatAge, formatDistance } from "@/lib/format";
import { toneVar } from "@/theme/tones";

export function Tooltip({
	event,
	category,
}: {
	event: GlobePoint;
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
