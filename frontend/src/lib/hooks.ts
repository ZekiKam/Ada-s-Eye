import { useEffect, useState, useSyncExternalStore } from "react";

/** Current time in ms, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 30_000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
	const mq = window.matchMedia(REDUCED_MOTION);
	mq.addEventListener("change", onChange);
	return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
	return useSyncExternalStore(
		subscribeReducedMotion,
		() => window.matchMedia(REDUCED_MOTION).matches,
		() => false,
	);
}
