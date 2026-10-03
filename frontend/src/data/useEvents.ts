import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getGetAllPointsQueryOptions } from "@/api/generated";
import type { GlobePoint } from "@/api/generated/model";
import { eventSeconds } from "./events";

/**
 * Every point, fetched once per session: they are past wildfires, so they
 * never go stale. `main.tsx` starts the request on page load.
 */
export const allPointsQuery = getGetAllPointsQueryOptions({
	query: { staleTime: Number.POSITIVE_INFINITY },
});

const NO_EVENTS: GlobePoint[] = [];

/** The points inside one calendar year (UTC). Empty until the fetch succeeds. */
export function useEvents(year: number): GlobePoint[] {
	const { data } = useQuery(allPointsQuery);
	return useMemo(() => {
		if (!data) return NO_EVENTS;
		const start = Date.UTC(year, 0, 1) / 1000;
		const end = Date.UTC(year + 1, 0, 1) / 1000;
		return data.filter((e) => {
			const t = eventSeconds(e);
			return t >= start && t < end;
		});
	}, [data, year]);
}
