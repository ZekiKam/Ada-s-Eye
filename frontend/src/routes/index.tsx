import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { DEFAULT_WINDOW_S, WINDOW_OPTIONS, type WindowSeconds } from "@/config";
import { useEvents } from "@/data/useEvents";
import { GlobeCanvas } from "@/globe/GlobeCanvas";
import { Legend } from "@/hud/Legend";
import { Wordmark } from "@/hud/Wordmark";
import { useGlobeStore } from "@/state/store";

interface IndexSearch {
  window?: WindowSeconds;
}

function parseWindow(value: unknown): WindowSeconds | undefined {
  return WINDOW_OPTIONS.find((o) => o.seconds === Number(value))?.seconds;
}

export const Route = createFileRoute("/")({
  // Optional and falls back to the default, so a bare "/" works and a
  // refresh or a shared link keeps the window.
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    window: parseWindow(search.window),
  }),
  component: HomePage,
});

function HomePage() {
  const search = Route.useSearch();
  const windowSeconds = search.window ?? DEFAULT_WINDOW_S;

  const { events } = useEvents(windowSeconds);
  const hidden = useGlobeStore((s) => s.hidden);
  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden.includes(e.event_type)),
    [events, hidden],
  );

  const select = useGlobeStore((s) => s.select);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GlobeCanvas events={visibleEvents} />

      <div className="pointer-events-none absolute inset-0 p-4">
        <div className="absolute top-4 left-4">
          <Wordmark />
        </div>
        <div className="absolute bottom-4 left-4 flex w-64 flex-col gap-2">
          <Legend events={events} />
        </div>
      </div>
    </main>
  );
}
