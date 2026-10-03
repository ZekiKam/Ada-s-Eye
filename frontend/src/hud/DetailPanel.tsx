import { Crosshair, X } from "lucide-react";
import type { GlobeEvent } from "@/api/schema";
import { categoryOf } from "@/data/categories";
import {
	formatAge,
	formatCoordinates,
	formatDistance,
	formatUtc,
} from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";

/** Facts of the selected event. Closes with the button or Escape. */
export function DetailPanel({ event }: { event: GlobeEvent }) {
	const now = useNow();
	const select = useGlobeStore((s) => s.select);
	const flyTo = useGlobeStore((s) => s.flyTo);
	const category = categoryOf(event.event_type);

	const facts: [string, string][] = [
		["Time", formatUtc(event.event_time)],
		["Age", formatAge(event.event_time, now)],
		["Position", formatCoordinates(event.longitude, event.latitude)],
		["Footprint radius", formatDistance(event.range)],
		["Type key", event.event_type],
	];

	return (
		<section
			aria-label="Selected feature"
			className="pointer-events-auto border border-border bg-panel"
		>
			<header className="flex items-start gap-3 border-b border-border px-3 py-2">
				<span
					aria-hidden
					className="swatch mt-2"
					style={{ background: toneVar(category.tone) }}
				/>
				<div className="flex-1">
					<p className="label-caps text-muted-foreground">Selected</p>
					<h2 className="font-display text-2xl leading-tight uppercase">
						{category.label}
					</h2>
				</div>
				<button
					type="button"
					aria-label="Centre on globe"
					onClick={() => flyTo(event.longitude, event.latitude)}
					className="focus-ring p-1 hover:bg-foreground/10"
				>
					<Crosshair className="size-4" />
				</button>
				<button
					type="button"
					aria-label="Close"
					onClick={() => select(null)}
					className="focus-ring p-1 hover:bg-foreground/10"
				>
					<X className="size-4" />
				</button>
			</header>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-3 py-3">
				{facts.map(([label, value]) => (
					<div key={label} className="contents">
						<dt className="label-caps self-center text-muted-foreground">
							{label}
						</dt>
						<dd className="text-right font-mono text-sm">{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
