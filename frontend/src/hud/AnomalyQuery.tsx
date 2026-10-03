import { useQueryClient } from "@tanstack/react-query";
import { Radar, Trophy } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { getGetLeaderboardQueryKey, useRequestAnomaly } from "@/api/generated";
import type { Anomaly, LeaderboardClaim } from "@/api/generated/model";
import { ANOMALY } from "@/data/events";
import { ClaimName } from "@/hud/Leaderboard";
import { formatDistance, formatLonLat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Selection, useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";

/**
 * Asks the backend for the largest anomaly around the selected spot in the
 * selected year, and shows the answer below the button. Nothing is sent
 * until the button is pressed; pressing again re-runs the query. Mount it
 * keyed by the selection so a new one starts fresh. `SpotMarker` draws the
 * same answer on the globe. An anomaly that makes the leaderboard can be
 * named here.
 */
export function AnomalyQuery({ selection }: { selection: Selection }) {
	const [asked, setAsked] = useState(false);
	// customFetch throws ApiError for HTTP errors; network failures are plain Errors.
	const query = useRequestAnomaly<Anomaly, Error>(selection, {
		query: {
			enabled: asked,
			staleTime: Number.POSITIVE_INFINITY,
			retry: false,
		},
	});
	const { longitude, latitude, year } = selection;

	// The token only comes once, with the find (asking again returns none),
	// so keep it here and for the rest of the session.
	const claim = useGlobeStore((s) => s.claim);
	const queryClient = useQueryClient();
	const [placed, setPlaced] = useState<LeaderboardClaim | null>(null);
	const found = query.data?.claim;
	useEffect(() => {
		if (!found) return;
		setPlaced(found);
		claim(found.id, found.token);
		void queryClient.invalidateQueries({
			queryKey: getGetLeaderboardQueryKey(),
		});
	}, [found, claim, queryClient]);

	let result: ReactNode = null;
	if (query.isFetching)
		result = <p className="label-caps text-muted-foreground">Querying…</p>;
	else if (query.isError)
		result = (
			<p className="label-caps text-tone-danger">{query.error.message}</p>
		);
	else if (query.data)
		result = <AnomalyResult anomaly={query.data} year={year} placed={placed} />;

	return (
		<div className="pointer-events-auto engraved flex min-w-60 animate-in flex-col border border-border bg-panel fade-in whitespace-nowrap transition-colors duration-150 has-[button:enabled:hover]:border-foreground motion-reduce:animate-none">
			<button
				type="button"
				disabled={query.isFetching}
				onClick={() => (asked ? void query.refetch() : setAsked(true))}
				className="focus-ring flex items-center gap-3 py-2 pr-4 pl-3 text-left disabled:cursor-progress"
			>
				<Radar
					aria-hidden
					className={cn(
						"size-5 shrink-0",
						query.isFetching && "animate-pulse motion-reduce:animate-none",
					)}
				/>
				<span className="flex flex-col gap-1">
					<span className="font-display text-xl leading-none uppercase">
						Query anomaly
					</span>
					<span className="label-caps text-muted-foreground">
						{year} · {formatLonLat(longitude, latitude)}
					</span>
				</span>
			</button>
			<div
				aria-live="polite"
				className={cn(result && "border-t border-border py-2.5 pr-4 pl-3")}
			>
				{result}
			</div>
		</div>
	);
}

/**
 * The anomaly's radius as a large figure, and how far from the spot its
 * middle is. Below, the leaderboard place it took, if any.
 */
function AnomalyResult({
	anomaly,
	year,
	placed,
}: {
	anomaly: Anomaly;
	year: number;
	placed: LeaderboardClaim | null;
}) {
	const found = anomaly.confidence > 0;
	const tone = toneVar(found ? ANOMALY.tone : "neutral");

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-end justify-between gap-6">
				<div className="flex flex-col gap-1">
					<span className="label-caps" style={{ color: tone }}>
						{found ? ANOMALY.label : `No ${ANOMALY.label}`}
					</span>
					<span className="font-mono text-xs text-muted-foreground">
						{found
							? `${formatDistance(anomaly.distance)} away`
							: `None within ${formatDistance(anomaly.radius)}`}{" "}
						in {year}
					</span>
				</div>
				{found && (
					<span className="flex flex-col items-end">
						<span
							className="font-display text-3xl leading-none tabular-nums"
							style={{ color: tone }}
						>
							{formatDistance(anomaly.radius)}
						</span>
						<span className="label-caps text-muted-foreground">Radius</span>
					</span>
				)}
			</div>
			{placed && (
				<div className="flex flex-col gap-1.5 pt-1">
					<span
						className="label-caps flex items-center gap-2"
						style={{ color: tone }}
					>
						<Trophy aria-hidden className="size-3.5" />
						New No. {placed.rank} on the leaderboard
					</span>
					<ClaimName entryId={placed.id} />
				</div>
			)}
		</div>
	);
}
