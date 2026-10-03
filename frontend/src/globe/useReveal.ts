import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Fades something in once `active` turns true. Calls `apply` every frame
 * with an eased 0 to 1 until it reaches 1, then stops.
 */
export function useReveal(
	durationMs: number,
	apply: (t: number) => void,
	active = true,
) {
	const startedAt = useRef<number | null>(null);
	const done = useRef(false);

	useFrame(({ clock }) => {
		if (!active || done.current) return;
		startedAt.current ??= clock.elapsedTime;
		const elapsedMs = (clock.elapsedTime - startedAt.current) * 1000;
		const t = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 1;
		apply(easeOutCubic(t));
		if (t === 1) done.current = true;
	});
}
