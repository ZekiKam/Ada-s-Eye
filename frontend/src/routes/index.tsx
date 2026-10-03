import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/api/generated/model";
import { FIRST_YEAR, LAST_YEAR } from "@/config";
import { useEvents } from "@/data/useEvents";
import { useFoundAnomalies } from "@/data/useFoundAnomalies";
import { GlobeCanvas } from "@/globe/GlobeCanvas";
import { Controls } from "@/hud/Controls";
import { Leaderboard } from "@/hud/Leaderboard";
import { Premise } from "@/hud/Premise";
import { Timeline } from "@/hud/Timeline";
import { Wordmark } from "@/hud/Wordmark";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useGlobeStore } from "@/state/store";

/**
 * How long the wordmark holds centre stage: it fades in and the eye opens
 * (`--animate-eye-open` in index.css). Then it moves to the corner and the
 * globe fades in.
 */
const INTRO_MS = 1100;

/** Intro offset from the wordmark's corner position (`--hud-*` in index.css) to the viewport centre. */
const INTRO_TRANSFORM = {
	translate:
		"calc(50vw - 50% - var(--hud-left)) calc(50dvh - 50% - var(--hud-top))",
	scale: "2",
};
const SETTLED_TRANSFORM = { translate: "0 0", scale: "1" };

interface IndexSearch {
	year?: number;
}

function parseYear(value: unknown): number | undefined {
	const year = Number(value);
	return Number.isInteger(year) && year >= FIRST_YEAR && year <= LAST_YEAR
		? year
		: undefined;
}

export const Route = createFileRoute("/")({
	// Optional and falls back to the latest year, so a bare "/" works and a
	// refresh or a shared link keeps the year.
	validateSearch: (search: Record<string, unknown>): IndexSearch => ({
		year: parseYear(search.year),
	}),
	component: HomePage,
});

function HomePage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const year = search.year ?? LAST_YEAR;

	const events = useEvents(year);
	const anomalies = useFoundAnomalies(year);
	const select = useGlobeStore((s) => s.select);

	// Four decimals is about 11 m, finer than any click can aim.
	const round = (degrees: number) => Math.round(degrees * 1e4) / 1e4;
	const selectSpot = (longitude: number, latitude: number) =>
		select({ longitude: round(longitude), latitude: round(latitude), year });

	// Replace, not push: scrubbing would otherwise fill the back button.
	const changeYear = (next: number) => {
		select(null);
		navigate({ search: { year: next }, replace: true });
	};

	// The anomaly's own spot, in the (UTC) year it was detected.
	const pickEntry = (entry: LeaderboardEntry) => {
		const entryYear = new Date(entry.event_time).getUTCFullYear();
		navigate({ search: { year: entryYear }, replace: true });
		select({
			longitude: round(entry.longitude),
			latitude: round(entry.latitude),
			year: entryYear,
		});
	};

	const reducedMotion = usePrefersReducedMotion();
	const [introDone, setIntroDone] = useState(false);
	const settled = introDone || reducedMotion;

	useEffect(() => {
		const id = window.setTimeout(() => setIntroDone(true), INTRO_MS);
		return () => window.clearTimeout(id);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") select(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [select]);

	return (
		<main className="relative h-dvh w-full overflow-hidden">
			{/*
			 * Mounted from the start but hidden, so WebGL is already drawing by the
			 * time the globe and stars fade in as the wordmark moves aside.
			 */}
			<div
				className={cn(
					"absolute inset-0 transition-opacity duration-700",
					!settled && "pointer-events-none opacity-0",
				)}
			>
				<GlobeCanvas
					events={events}
					anomalies={anomalies}
					onSelectSpot={selectSpot}
				/>
			</div>

			<div className="pointer-events-none absolute inset-0">
				{/* Translate and scale only, so the move stays smooth while WebGL starts up. */}
				<div
					className="absolute top-(--hud-top) left-(--hud-left) transition-[translate,scale] duration-700 ease-in-out"
					style={settled ? SETTLED_TRANSFORM : INTRO_TRANSFORM}
				>
					<div className="animate-in fade-in fill-mode-both duration-500">
						<Wordmark />
					</div>
				</div>

				{/* Arrives with the globe, as does the timeline. */}
				<div
					className={cn(
						"absolute top-(--hud-top) right-(--hud-right) max-w-[calc(100vw-var(--hud-left)-var(--hud-right))] transition-opacity duration-700",
						!settled && "invisible opacity-0",
					)}
				>
					<Leaderboard onPick={pickEntry} />
				</div>

				{/*
				 * Controls bottom left, premise bottom right. Beside the timeline from
				 * `xl`; below that they sit above it, wrapping onto two rows on a phone.
				 */}
				<div
					className={cn(
						"absolute right-(--hud-right) bottom-(--hud-bottom) left-(--hud-left) flex flex-wrap items-end gap-2 transition-opacity duration-700 xl:flex-nowrap",
						!settled && "invisible opacity-0",
					)}
				>
					<div className="max-w-full xl:w-80 xl:shrink-0">
						<Controls />
					</div>
					<div className="order-last mx-auto w-full max-w-5xl xl:order-0 xl:min-w-0 xl:flex-1">
						<Timeline year={year} onChange={changeYear} />
					</div>
					<div className="ml-auto flex max-w-full justify-end xl:w-80 xl:shrink-0">
						<Premise />
					</div>
				</div>
			</div>
		</main>
	);
}
