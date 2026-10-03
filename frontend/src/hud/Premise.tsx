import { Info } from "lucide-react";
import { ANOMALY, WILDFIRE } from "@/data/events";
import { type Tone, toneVar } from "@/theme/tones";
import { HudPanel } from "./HudPanel";

/** What the game is: hunt for fires the satellites saw but nobody recorded. */
export function Premise() {
	return (
		<HudPanel icon={Info} title="The Hunt" subtitle="Unrecorded fires" align="right">
			<div className="flex flex-col gap-2 text-sm text-muted-foreground">
				<p>
					<Swatch tone={WILDFIRE.tone} label="Wildfires" /> are fires someone
					recorded. NASA satellites see more: heat that no record explains.
				</p>
				<p>
					Pick a spot away from the recorded fires and search it. Bright,
					confident detections nearby make an{" "}
					<Swatch tone={ANOMALY.tone} label="anomaly" />, marked for everyone
					to see.
				</p>
				<p>The largest finds make the leaderboard. Name yours.</p>
				<p className="label-caps pt-0.5">
					Synthetic data, modelled on real NASA FIRMS records
				</p>
			</div>
		</HudPanel>
	);
}

function Swatch({ tone, label }: { tone: Tone; label: string }) {
	const color = toneVar(tone);
	return (
		<span className="whitespace-nowrap text-foreground">
			<span
				aria-hidden
				className="mr-1 inline-block size-2 rounded-full align-middle"
				style={{ backgroundColor: color }}
			/>
			{label}
		</span>
	);
}
