import { useCallback, useSyncExternalStore } from "react";

/** Live result of a CSS media query. False during server rendering. */
export function useMediaQuery(query: string): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const mq = window.matchMedia(query);
			mq.addEventListener("change", onChange);
			return () => mq.removeEventListener("change", onChange);
		},
		[query],
	);
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(query).matches,
		() => false,
	);
}

export function usePrefersReducedMotion(): boolean {
	return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** The primary pointer is a finger: bigger targets, no hover. */
export function useCoarsePointer(): boolean {
	return useMediaQuery("(pointer: coarse)");
}
