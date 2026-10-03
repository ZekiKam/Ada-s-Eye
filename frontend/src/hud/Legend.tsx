import { Eye, EyeOff } from "lucide-react";
import type { GlobeEvent } from "@/api/schema";
import { cn } from "@/lib/utils";
import { useGlobeStore, useHiddenCategories } from "@/state/store";
import { toneVar } from "@/theme/tones";
import { categoryOf } from "@/views/registry";
import type { Category, ViewDefinition } from "@/views/types";
import { Panel } from "./Panel";

/**
 * One toggle per category: swatch, label and count. Lists the view's known
 * categories first, then any unknown `event_type` the data contains.
 */
export function Legend({
	view,
	events,
}: {
	view: ViewDefinition;
	events: readonly GlobeEvent[];
}) {
	const hidden = useHiddenCategories(view.id);
	const toggle = useGlobeStore((s) => s.toggleCategory);

	const counts = new Map<string, number>();
	for (const e of events) {
		counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
	}
	const extra: Category[] = [...counts.keys()]
		.filter((key) => !view.categories.some((c) => c.key === key))
		.map((key) => categoryOf(view, key));

	return (
		<Panel title="Layers">
			<ul className="py-1">
				{[...view.categories, ...extra].map((category) => {
					const visible = !hidden.includes(category.key);
					const Icon = visible ? Eye : EyeOff;
					return (
						<li key={category.key}>
							<button
								type="button"
								aria-pressed={visible}
								onClick={() => toggle(view.id, category.key)}
								className={cn(
									"focus-ring flex w-full items-center gap-3 px-3 py-1.5 text-left transition-opacity duration-150 hover:bg-foreground/10",
									!visible && "opacity-45",
								)}
							>
								<span
									aria-hidden
									className="swatch"
									style={{ background: toneVar(category.tone) }}
								/>
								<span className="flex-1 text-sm">{category.label}</span>
								<span className="font-mono text-xs tabular-nums text-muted-foreground">
									{counts.get(category.key) ?? 0}
								</span>
								<Icon aria-hidden className="size-3.5 text-muted-foreground" />
							</button>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
