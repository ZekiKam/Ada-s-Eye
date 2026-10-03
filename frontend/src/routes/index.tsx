import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_WINDOW_S, WINDOW_OPTIONS, type WindowSeconds } from "@/config";
import { eventKey } from "@/data/events";
import { useViewEvents } from "@/data/useViewEvents";
import { GlobeCanvas } from "@/globe/GlobeCanvas";
import { DetailPanel } from "@/hud/DetailPanel";
import { Feed } from "@/hud/Feed";
import { KpiStrip } from "@/hud/KpiStrip";
import { Legend } from "@/hud/Legend";
import { StatusBar } from "@/hud/StatusBar";
import { TimeWindow } from "@/hud/TimeWindow";
import { ViewSwitcher } from "@/hud/ViewSwitcher";
import { Wordmark } from "@/hud/Wordmark";
import { useGlobeStore, useHiddenCategories } from "@/state/store";
import { DEFAULT_VIEW, getView, isViewId } from "@/views/registry";
import type { ViewId } from "@/views/types";

interface IndexSearch {
	view?: ViewId;
	window?: WindowSeconds;
}

function parseWindow(value: unknown): WindowSeconds | undefined {
	return WINDOW_OPTIONS.find((o) => o.seconds === Number(value))?.seconds;
}

export const Route = createFileRoute("/")({
	// Both params are optional and fall back to defaults, so a bare "/" works
	// and a refresh or a shared link keeps the view and window.
	validateSearch: (search: Record<string, unknown>): IndexSearch => ({
		view: isViewId(search.view) ? search.view : undefined,
		window: parseWindow(search.window),
	}),
	component: HomePage,
});

function HomePage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const view = getView(search.view ?? DEFAULT_VIEW);
	const windowSeconds = search.window ?? DEFAULT_WINDOW_S;

	const { events, status, updatedAt } = useViewEvents(view, windowSeconds);
	const hidden = useHiddenCategories(view.id);
	const visibleEvents = useMemo(
		() => events.filter((e) => !hidden.includes(e.event_type)),
		[events, hidden],
	);

	const selectedKey = useGlobeStore((s) => s.selectedKey);
	const select = useGlobeStore((s) => s.select);
	const clearFocus = useGlobeStore((s) => s.clearFocus);
	const selected = selectedKey
		? events.find((e) => eventKey(e) === selectedKey)
		: undefined;

	const setView = useCallback(
		(id: ViewId) => {
			if (id === view.id) return;
			clearFocus();
			navigate({ search: (prev) => ({ ...prev, view: id }) });
		},
		[view.id, clearFocus, navigate],
	);

	const setWindow = (seconds: WindowSeconds) =>
		navigate({ search: (prev) => ({ ...prev, window: seconds }) });

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") select(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [select]);

	const emptyText =
		status === "loading"
			? "Loading…"
			: status === "offline"
				? "No data from this backend yet"
				: view.hasTimeWindow
					? "No events in this window"
					: "Nothing to show";

	return (
		<main className="relative h-dvh w-full overflow-hidden">
			<GlobeCanvas view={view} events={visibleEvents} />

			<div className="pointer-events-none absolute inset-0 p-4">
				<div className="absolute top-4 left-4 flex w-max flex-col items-start gap-3">
					<Wordmark />
					<ViewSwitcher active={view.id} onChange={setView} />
					{view.hasTimeWindow && (
						<TimeWindow value={windowSeconds} onChange={setWindow} />
					)}
					<div className="flex w-64 flex-col gap-2">
						<Legend view={view} events={events} />
						<p className="label-caps border border-border bg-panel px-3 py-2 text-muted-foreground">
							Drag rotates · Scroll zooms
							<br />
							1–3 view · Esc deselect
						</p>
					</div>
					{view.Panel && <view.Panel events={events} />}
				</div>

				<div className="absolute top-4 right-4">
					<StatusBar
						status={status}
						updatedAt={updatedAt}
						isMock={view.isMock}
					/>
				</div>

				<div className="absolute top-20 right-4 bottom-4 flex w-80 flex-col gap-3">
					{selected && <DetailPanel view={view} event={selected} />}
					<Feed view={view} events={visibleEvents} emptyText={emptyText} />
				</div>

				<div className="absolute bottom-4 left-4">
					<KpiStrip view={view} events={visibleEvents} />
				</div>
			</div>
		</main>
	);
}
