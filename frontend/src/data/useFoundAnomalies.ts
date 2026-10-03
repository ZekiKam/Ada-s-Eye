import { useMemo } from "react";
import { useGetFoundAnomalies } from "@/api/generated";
import type { FoundAnomalyPoint } from "@/api/generated/model";
import { eventSeconds } from "./events";

/** Picks up other visitors' finds. */
const REFRESH_MS = 15_000;

const NONE: FoundAnomalyPoint[] = [];

/**
 * The anomalies anyone has found, detected inside one calendar year (UTC).
 * The backend holds them in memory and hands each out only once, so this is
 * how everyone else sees a find. Empty until the fetch succeeds.
 */
export function useFoundAnomalies(year: number): FoundAnomalyPoint[] {
	const { data } = useGetFoundAnomalies<FoundAnomalyPoint[], Error>({
		query: { refetchInterval: REFRESH_MS },
	});
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
