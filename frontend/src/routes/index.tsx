import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FIRST_YEAR, LAST_YEAR } from "@/config";
import { useEvents } from "@/data/useEvents";
import { GlobeCanvas } from "@/globe/GlobeCanvas";
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
	const select = useGlobeStore((s) => s.select);

	// Replace, not push: scrubbing would otherwise fill the back button.
	const changeYear = (next: number) => {
		select(null);
		navigate({ search: { year: next }, replace: true });
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
				<GlobeCanvas events={events} />
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

				{/* Arrives with the globe. */}
				<div
					className={cn(
						"absolute right-(--hud-right) bottom-(--hud-bottom) left-(--hud-left) mx-auto max-w-5xl transition-opacity duration-700",
						!settled && "invisible opacity-0",
					)}
				>
					<Timeline year={year} onChange={changeYear} />
				</div>
			</div>
		</main>
	);
}
