import { compsoc } from "./compsoc";
import { gresearch } from "./gresearch";
import { optiver } from "./optiver";
import type { Category, ViewDefinition, ViewId } from "./types";

/** Every view, in tab order. Keys 1, 2, 3 follow this order. */
export const VIEWS: readonly ViewDefinition[] = [compsoc, optiver, gresearch];

export const DEFAULT_VIEW: ViewId = "compsoc";

export function isViewId(value: unknown): value is ViewId {
	return VIEWS.some((v) => v.id === value);
}

export function getView(id: ViewId): ViewDefinition {
	return VIEWS.find((v) => v.id === id) ?? VIEWS[0];
}

/** The category for an `event_type`, falling back to a neutral one. */
export function categoryOf(view: ViewDefinition, key: string): Category {
	return (
		view.categories.find((c) => c.key === key) ?? {
			key,
			label: key.replaceAll("_", " "),
			tone: "neutral",
		}
	);
}
