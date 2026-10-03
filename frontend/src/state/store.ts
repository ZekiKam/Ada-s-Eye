import { create } from "zustand";
import type { ViewId } from "@/views/types";

interface Flight {
	longitude: number;
	latitude: number;
	/** Increments per request, so flying to the same spot twice still fires. */
	id: number;
}

interface GlobeState {
	/** Hidden event types per view. Remembered for the session. */
	hidden: Partial<Record<ViewId, readonly string[]>>;
	selectedKey: string | null;
	hoveredKey: string | null;
	flight: Flight | null;
	toggleCategory(view: ViewId, key: string): void;
	select(key: string | null): void;
	hover(key: string | null): void;
	flyTo(longitude: number, latitude: number): void;
	/** Called on view switch. */
	clearFocus(): void;
}

export const useGlobeStore = create<GlobeState>()((set) => ({
	hidden: {},
	selectedKey: null,
	hoveredKey: null,
	flight: null,

	toggleCategory: (view, key) =>
		set((s) => {
			const current = s.hidden[view] ?? [];
			const next = current.includes(key)
				? current.filter((k) => k !== key)
				: [...current, key];
			return { hidden: { ...s.hidden, [view]: next } };
		}),

	select: (selectedKey) => set({ selectedKey }),

	hover: (hoveredKey) => set({ hoveredKey }),

	flyTo: (longitude, latitude) =>
		set((s) => ({
			flight: { longitude, latitude, id: (s.flight?.id ?? 0) + 1 },
		})),

	clearFocus: () => set({ selectedKey: null, hoveredKey: null }),
}));

const NONE: readonly string[] = [];

export function useHiddenCategories(view: ViewId): readonly string[] {
	return useGlobeStore((s) => s.hidden[view] ?? NONE);
}
