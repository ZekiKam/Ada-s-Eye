import type { GlobeEvent } from "@/api/schema";
import { byNewest, eventKey } from "@/data/events";
import { formatAge, formatCoordinates, formatDistance } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";
import { categoryOf } from "@/views/registry";
import type { ViewDefinition } from "@/views/types";
import { Empty, Panel } from "./Panel";

const MAX_ITEMS = 50;

/** Newest first. A click flies to the event and selects it. */
export function Feed({
	view,
	events,
	emptyText,
}: {
	view: ViewDefinition;
	events: readonly GlobeEvent[];
	emptyText: string;
}) {
	const now = useNow();
	const selectedKey = useGlobeStore((s) => s.selectedKey);
	const select = useGlobeStore((s) => s.select);
	const flyTo = useGlobeStore((s) => s.flyTo);
	const hover = useGlobeStore((s) => s.hover);

	const items = [...events].sort(byNewest).slice(0, MAX_ITEMS);

	return (
		<Panel
			title="Feed"
			aside={
				<span className="font-mono text-xs tabular-nums text-muted-foreground">
					{events.length}
				</span>
			}
		>
			{items.length === 0 ? (
				<Empty>{emptyText}</Empty>
			) : (
				<ol className="min-h-0 flex-1 overflow-y-auto py-1">
					{items.map((event) => {
						const id = eventKey(event);
						const category = categoryOf(view, event.event_type);
						return (
							<li key={id}>
								<button
									type="button"
									aria-current={id === selectedKey}
									onClick={() => {
										select(id);
										flyTo(event.longitude, event.latitude);
									}}
									onPointerEnter={() => hover(id)}
									onPointerLeave={() => hover(null)}
									className={cn(
										"focus-ring grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-x-3 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-foreground/10",
										id === selectedKey && "bg-foreground/15",
									)}
								>
									<span
										aria-hidden
										className="swatch self-center"
										style={{ background: toneVar(category.tone) }}
									/>
									<span className="truncate text-sm">{category.label}</span>
									<span className="font-mono text-xs text-muted-foreground">
										{view.hasTimeWindow
											? formatAge(event.event_time, now)
											: formatDistance(event.range)}
									</span>
									<span />
									<span className="col-span-2 font-mono text-[11px] text-muted-foreground">
										{formatCoordinates(event.longitude, event.latitude)}
									</span>
								</button>
							</li>
						);
					})}
				</ol>
			)}
		</Panel>
	);
}
