import { Radar } from "lucide-react";
import { useState } from "react";
import { useRequestAnomaly } from "@/api/generated";
import type { Anomaly } from "@/api/generated/model";
import { formatDistance, formatLonLat } from "@/lib/format";
import type { Selection } from "@/state/store";

/**
 * Asks the backend's prediction model how likely an anomaly is at the
 * selected spot in the selected year, and shows the answer. Nothing is sent
 * until the button is pressed; pressing again re-runs the query. Mount it
 * keyed by the selection so a new one starts fresh.
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

  let status: string;
  if (query.isFetching) status = "Querying…";
  else if (query.isError) status = query.error.message;
  else if (query.data) {
    const { confidence, radius } = query.data;
    status = `${Math.round(confidence * 100)}% confidence · ${formatDistance(radius)}`;
  } else status = `${year} · ${formatLonLat(longitude, latitude)}`;

  return (
    <button
      type="button"
      disabled={query.isFetching}
      onClick={() => (asked ? void query.refetch() : setAsked(true))}
      className="focus-ring pointer-events-auto engraved flex animate-in items-center gap-3 border border-border bg-panel py-2 pr-4 pl-3 text-left fade-in whitespace-nowrap transition-colors duration-150 hover:border-foreground disabled:cursor-progress motion-reduce:animate-none"
    >
      <span className="flex flex-col gap-1">
        <span className="font-display text-xl leading-none uppercase">
          Query anomaly
        </span>
        <span
          aria-live="polite"
          className={
            query.isError
              ? "label-caps text-tone-danger"
              : "label-caps text-muted-foreground"
          }
        >
          {status}
        </span>
      </span>
    </button>
  );
}
