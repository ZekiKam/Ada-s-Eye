import type { FeedStatus } from "@/data/useViewEvents";
import { formatAge } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { Tone } from "@/theme/tones";
import { toneVar } from "@/theme/tones";

interface StatusBarProps {
	status: FeedStatus;
	updatedAt: number;
	isMock: boolean;
}

const STATUS: Record<FeedStatus, { label: string; tone: Tone }> = {
	loading: { label: "Connecting", tone: "neutral" },
	live: { label: "Live", tone: "positive" },
	stale: { label: "Stale", tone: "warning" },
	offline: { label: "No data", tone: "danger" },
};

/** Status tags are never hidden. MOCK shows in every status. */
export function StatusBar({ status, updatedAt, isMock }: StatusBarProps) {
	const now = useNow(5_000);
	const { label, tone } = STATUS[status];

	let detail: string | null = null;
	if (updatedAt > 0) {
		const age = formatAge(updatedAt / 1000, now);
		detail = status === "stale" ? `data ${age}` : `updated ${age}`;
	}

	return (
		<output
			aria-live="polite"
			className="pointer-events-auto flex items-stretch border border-border bg-panel"
		>
			<Tag tone={tone} pulse={status === "live"}>
				{label}
			</Tag>
			{isMock && <Tag tone="accent1">Mock</Tag>}
			{detail && (
				<span className="label-caps flex items-center px-3 text-muted-foreground">
					{detail}
				</span>
			)}
		</output>
	);
}

function Tag({
	tone,
	pulse = false,
	children,
}: {
	tone: Tone;
	pulse?: boolean;
	children: string;
}) {
	return (
		<span
			className="label-caps flex items-center gap-2 border-r border-border px-3 py-2"
			style={{ color: toneVar(tone) }}
		>
			<span
				aria-hidden
				className={pulse ? "status-dot animate-pulse" : "status-dot"}
				style={{ background: toneVar(tone) }}
			/>
			{children}
		</span>
	);
}
