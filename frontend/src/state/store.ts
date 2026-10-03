import { create } from "zustand";

interface Flight {
	longitude: number;
	latitude: number;
	/** Increments per request, so flying to the same spot twice still fires. */
	id: number;
}

interface GlobeState {
	selectedKey: string | null;
	hoveredKey: string | null;
	flight: Flight | null;
	select(key: string | null): void;
	hover(key: string | null): void;
	flyTo(longitude: number, latitude: number): void;
}

export const useGlobeStore = create<GlobeState>()((set) => ({
	selectedKey: null,
	hoveredKey: null,
	flight: null,

	select: (selectedKey) => set({ selectedKey }),

	hover: (hoveredKey) => set({ hoveredKey }),

	flyTo: (longitude, latitude) =>
		set((s) => ({
			flight: { longitude, latitude, id: (s.flight?.id ?? 0) + 1 },
		})),
}));
