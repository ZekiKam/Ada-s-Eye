import { create } from "zustand";
import type { GlobePoint } from "@/api/generated/model";
import { eventKey } from "@/data/events";

interface Flight {
	longitude: number;
	latitude: number;
	/** Increments per request, so flying to the same spot twice still fires. */
	id: number;
}

interface GlobeState {
	selected: GlobePoint | null;
	/** `eventKey(selected)`, so markers can compare cheaply. */
	selectedKey: string | null;
	hoveredKey: string | null;
	flight: Flight | null;
	select(point: GlobePoint | null): void;
	hover(key: string | null): void;
	flyTo(longitude: number, latitude: number): void;
}

export const useGlobeStore = create<GlobeState>()((set) => ({
	selected: null,
	selectedKey: null,
	hoveredKey: null,
	flight: null,

	select: (selected) =>
		set({ selected, selectedKey: selected ? eventKey(selected) : null }),

	hover: (hoveredKey) => set({ hoveredKey }),

	flyTo: (longitude, latitude) =>
		set((s) => ({
			flight: { longitude, latitude, id: (s.flight?.id ?? 0) + 1 },
		})),
}));
