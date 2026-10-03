import { useMemo } from "react";
import { useGetFoundAnomalies } from "@/api/generated";
import type { FoundAnomalyPoint } from "@/api/generated/model";
import { eventSeconds } from "./events";

/** Picks up other visitors' finds. */
const REFRESH_MS = 15_000;

const NONE: FoundAnomalyPoint[] = [];

/**
 * Every anomaly anyone has found, with who found it. The backend holds them
 * in memory and hands each out only once, so this is how everyone else sees
 * a find.
 */
export function useAllFoundAnomalies() {
	// customFetch throws ApiError for HTTP errors; network failures are plain Errors.
	return useGetFoundAnomalies<FoundAnomalyPoint[], Error>({
		query: { refetchInterval: REFRESH_MS },
	});
}

/** The finds detected inside one calendar year (UTC). Empty until fetched. */
export function useFoundAnomalies(year: number): FoundAnomalyPoint[] {
	const { data } = useAllFoundAnomalies();
	return useMemo(() => {
		if (!data) return NONE;
		const start = Date.UTC(year, 0, 1) / 1000;
		const end = Date.UTC(year + 1, 0, 1) / 1000;
		return data.filter((a) => {
			const t = eventSeconds(a);
			return t >= start && t < end;
		});
	}, [data, year]);
}
