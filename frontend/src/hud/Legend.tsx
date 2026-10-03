import { Eye, EyeOff } from "lucide-react";
import type { GlobePoint } from "@/api/schema";
import { CATEGORIES, type Category, categoryOf } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";
import { Panel } from "./Panel";

/**
 * One toggle per category: swatch, label and count. Lists the known
 * categories first, then any unknown `event_type` the data contains.
 */
export function Legend({ events }: { events: readonly GlobePoint[] }) {
	const hidden = useGlobeStore((s) => s.hidden);
	const toggle = useGlobeStore((s) => s.toggleCategory);

	const counts = new Map<string, number>();
	for (const e of events) {
		counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
	}
	const extra: Category[] = [...counts.keys()]
		.filter((key) => !CATEGORIES.some((c) => c.key === key))
		.map(categoryOf);

	return (
		<Panel title="Layers">
			<ul className="py-1">
				{[...CATEGORIES, ...extra].map((category) => {
					const visible = !hidden.includes(category.key);
					const Icon = visible ? Eye : EyeOff;
					return (
						<li key={category.key}>
							<button
								type="button"
								aria-pressed={visible}
								onClick={() => toggle(category.key)}
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
