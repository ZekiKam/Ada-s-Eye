import { Hand, MousePointer2 } from "lucide-react";
import { useCoarsePointer } from "@/lib/hooks";
import { HudPanel } from "./HudPanel";

type Control = readonly [gesture: string, action: string];

const MOUSE: readonly Control[] = [
	["Drag", "Spin the globe"],
	["Scroll", "Zoom"],
	["Hover", "Details of a fire or find"],
	["Double-click", "Pick a spot to search"],
	["Esc", "Clear the spot"],
	["Timeline", "Drag, scroll or ←/→ to change year"],
];

const TOUCH: readonly Control[] = [
	["Drag", "Spin the globe"],
	["Pinch", "Zoom"],
	["Hold", "Pick a spot to search"],
	["Tap", "Clear the spot"],
	["Timeline", "Drag or tap to change year"],
];

/** How to drive the globe, for a mouse or a finger. */
export function Controls() {
	const touch = useCoarsePointer();
	const controls = touch ? TOUCH : MOUSE;
	return (
		<HudPanel
			icon={touch ? Hand : MousePointer2}
			title="Controls"
			subtitle={touch ? "Touch" : "Mouse & keyboard"}
		>
			<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5">
				{controls.map(([gesture, action]) => (
					<div key={gesture} className="contents">
						<dt className="label-caps">{gesture}</dt>
						<dd className="text-sm text-muted-foreground">{action}</dd>
					</div>
				))}
			</dl>
		</HudPanel>
	);
}
