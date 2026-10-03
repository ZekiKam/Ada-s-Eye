import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { LONG_PRESS_MS } from "@/config";

/** A finger that moves this far is dragging the globe, not pressing. */
const SLOP_PX = 10;

/**
 * Calls `onLongPress` when a finger rests on the object for `LONG_PRESS_MS`.
 * Lifting, moving, a second finger, or the browser taking over the gesture
 * cancels it. Mouse and pen presses are ignored. Returns the pointer-down
 * handler for the object.
 */
export function useLongPress(onLongPress: () => void) {
	const cancel = useRef<(() => void) | null>(null);
	const callback = useRef(onLongPress);
	callback.current = onLongPress;

	useEffect(() => () => cancel.current?.(), []);

	return (e: ThreeEvent<PointerEvent>) => {
		if (e.pointerType !== "touch") return;
		cancel.current?.();
		const { pointerId, clientX, clientY } = e.nativeEvent;

		const onMove = (m: PointerEvent) => {
			if (m.pointerId !== pointerId) return;
			if (Math.hypot(m.clientX - clientX, m.clientY - clientY) > SLOP_PX) {
				stop();
			}
		};
		const onDown = (d: PointerEvent) => {
			if (d.pointerId !== pointerId) stop();
		};
		const onEnd = (u: PointerEvent) => {
			if (u.pointerId === pointerId) stop();
		};
		const timer = window.setTimeout(() => {
			stop();
			callback.current();
		}, LONG_PRESS_MS);

		function stop() {
			window.clearTimeout(timer);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerdown", onDown);
			window.removeEventListener("pointerup", onEnd);
			window.removeEventListener("pointercancel", onEnd);
			cancel.current = null;
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointerup", onEnd);
		window.addEventListener("pointercancel", onEnd);
		cancel.current = stop;
	};
}
