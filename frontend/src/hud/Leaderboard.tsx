import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Trophy } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import {
	getGetLeaderboardQueryKey,
	useGetLeaderboard,
	useNameLeaderboardEntry,
} from "@/api/generated";
import type { LeaderboardEntry } from "@/api/generated/model";
import { ANOMALY } from "@/data/events";
import { formatDate, formatDistance, formatLonLat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGlobeStore } from "@/state/store";
import { toneVar } from "@/theme/tones";

/** Picks up other visitors' finds. */
const REFRESH_MS = 15_000;
/** Matches `max_length` on the backend's `NameEntry`. */
const MAX_NAME_LENGTH = 24;
/** Open from the start on screens wide enough to fit it beside the wordmark. */
const OPEN_FROM = "(min-width: 40rem)";

/** The largest anomalies found so far, largest first. */
export function useLeaderboard() {
	// customFetch throws ApiError for HTTP errors; network failures are plain Errors.
	return useGetLeaderboard<LeaderboardEntry[], Error>({
		query: { refetchInterval: REFRESH_MS },
	});
}

interface LeaderboardProps {
	/** Flies to the anomaly and selects its spot in its year. */
	onPick(entry: LeaderboardEntry): void;
}

/**
 * The five largest anomalies anyone has found with the anomaly query, by
 * radius. The backend holds them in memory, so the board
 * empties when it restarts. A visitor can name the entries they found.
 */
export function Leaderboard({ onPick }: LeaderboardProps) {
	const query = useLeaderboard();
	const claims = useGlobeStore((s) => s.claims);
	const [open, setOpen] = useState(() => window.matchMedia(OPEN_FROM).matches);

	let body: ReactNode;
	if (query.isPending)
		body = <p className="label-caps text-muted-foreground">Loading…</p>;
	else if (query.isError)
		body = <p className="label-caps text-tone-danger">{query.error.message}</p>;
	else if (query.data.length === 0)
		body = (
			<p className="font-mono text-xs text-muted-foreground whitespace-normal">
				Nothing found yet. Double-click the globe and query a spot.
			</p>
		);
	else
		body = (
			<ol className="flex flex-col">
				{query.data.map((entry) => (
					<li
						key={entry.id}
						className="border-t border-border first:border-t-0"
					>
						<EntryRow
							entry={entry}
							mine={entry.id in claims}
							onPick={() => onPick(entry)}
						/>
					</li>
				))}
			</ol>
		);

	return (
		// Closed, it shrinks to its title, to sit beside the wordmark on a phone.
		<section
			className={cn(
				"pointer-events-auto engraved ml-auto flex max-w-full flex-col border border-border bg-panel transition-colors duration-150 has-[>button:hover]:border-foreground",
				open ? "w-80" : "w-fit",
			)}
		>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className="focus-ring flex items-center gap-3 py-2 pr-3 pl-3 text-left"
			>
				<Trophy aria-hidden className="size-5 shrink-0" />
				<span className="flex flex-1 flex-col gap-1">
					<span className="font-display text-xl leading-none uppercase">
						Leaderboard
					</span>
					{open && (
						<span className="label-caps text-muted-foreground">
							Largest anomalies · Radius
						</span>
					)}
				</span>
				<ChevronDown
					aria-hidden
					className={cn(
						"size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<div aria-live="polite" className="border-t border-border px-3 py-1.5">
					{body}
				</div>
			)}
		</section>
	);
}

function EntryRow({
	entry,
	mine,
	onPick,
}: {
	entry: LeaderboardEntry;
	mine: boolean;
	onPick(): void;
}) {
	const tone = toneVar(ANOMALY.tone);
	return (
		<div className="flex flex-col gap-1.5 py-1.5">
			<button
				type="button"
				onClick={onPick}
				title="Show on the globe"
				className="focus-ring group flex items-center gap-3 text-left"
			>
				<span className="w-5 shrink-0 font-display text-2xl leading-none tabular-nums">
					{entry.rank}
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="flex items-baseline justify-between gap-3">
						<span
							className={cn(
								"truncate text-sm group-hover:underline",
								!entry.name && "text-muted-foreground italic",
							)}
						>
							{entry.name ?? (mine ? "Found by you" : "Unnamed")}
						</span>
						<span
							className="shrink-0 font-mono text-sm tabular-nums"
							style={{ color: tone }}
						>
							{formatDistance(entry.radius)}
						</span>
					</span>
					<span className="truncate font-mono text-[11px] text-muted-foreground">
						{formatDate(entry.event_time)} ·{" "}
						{formatLonLat(entry.longitude, entry.latitude)}
					</span>
				</span>
			</button>
			{mine && !entry.name && (
				<div className="pl-8">
					<ClaimName entryId={entry.id} />
				</div>
			)}
		</div>
	);
}

/**
 * Lets the finder of a leaderboard entry name it, once. Shows nothing for an
 * entry this visitor did not find; says so once it is named or has been
 * pushed off the board.
 */
export function ClaimName({ entryId }: { entryId: string }) {
	const token = useGlobeStore((s) => s.claims[entryId]);
	const board = useLeaderboard();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const mutation = useNameLeaderboardEntry<Error>({
		mutation: {
			onSuccess: (named) => {
				queryClient.setQueryData<LeaderboardEntry[]>(
					getGetLeaderboardQueryKey(),
					(entries) => entries?.map((e) => (e.id === named.id ? named : e)),
				);
			},
		},
	});

	const entry = board.data?.find((e) => e.id === entryId);
	if (!token) return null;
	if (board.data && !entry)
		return (
			<p className="label-caps text-muted-foreground">
				Pushed off the leaderboard
			</p>
		);
	if (entry?.name)
		return (
			<p className="label-caps text-muted-foreground">
				On the board as {entry.name}
			</p>
		);

	const trimmed = name.trim();
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (trimmed) mutation.mutate({ entryId, data: { token, name: trimmed } });
	};

	return (
		<form onSubmit={submit} className="flex flex-col gap-1">
			<div className="flex border border-input has-[input:focus-visible]:border-foreground">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={MAX_NAME_LENGTH}
					placeholder="Add your name"
					aria-label="Your name for the leaderboard"
					className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
				/>
				<button
					type="submit"
					disabled={!trimmed || mutation.isPending}
					aria-label="Save name"
					className="focus-ring border-l border-input px-2 disabled:opacity-40 enabled:hover:bg-accent"
				>
					<Check aria-hidden className="size-4" />
				</button>
			</div>
			{mutation.isError && (
				<p className="label-caps text-tone-danger whitespace-normal">
					{mutation.error.message}
				</p>
			)}
		</form>
	);
}
