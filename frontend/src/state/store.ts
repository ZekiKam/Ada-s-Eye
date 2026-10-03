import { create } from "zustand";
import type { RequestAnomalyParams } from "@/api/generated/model";

/** A spot picked on the globe, and the timeline year to query it for. */
export type Selection = RequestAnomalyParams;

interface Flight {
	longitude: number;
	latitude: number;
	/** Increments per request, so flying to the same spot twice still fires. */
	id: number;
}

interface GlobeState {
	selected: Selection | null;
	hoveredKey: string | null;
	flight: Flight | null;
	/**
	 * Tokens for anomalies this visitor found, by entry id. Only the finder
	 * gets one, and it is needed to name the find. Lost on reload.
	 */
	claims: Record<string, string>;
	/** Selecting also flies the camera there. */
	select(selection: Selection | null): void;
	hover(key: string | null): void;
	claim(id: string, token: string): void;
}

export const useGlobeStore = create<GlobeState>()((set) => ({
	selected: null,
	hoveredKey: null,
	flight: null,
	claims: {},

	select: (selected) =>
		set((s) =>
			selected
				? {
						selected,
						flight: {
							longitude: selected.longitude,
							latitude: selected.latitude,
							id: (s.flight?.id ?? 0) + 1,
						},
					}
				: { selected },
		),

	hover: (hoveredKey) => set({ hoveredKey }),

	claim: (id, token) => set((s) => ({ claims: { ...s.claims, [id]: token } })),
}));
