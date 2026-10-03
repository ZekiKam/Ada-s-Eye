import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useRef } from "react";
import { type PerspectiveCamera, Quaternion, type Vector3 } from "three";
import { IDLE_ROTATE_AFTER_MS } from "@/config";
import { useCoarsePointer } from "@/lib/hooks";
import { useGlobeStore } from "@/state/store";
import { lonLatToVector3 } from "./geo";

/**
 * Field of view in degrees across the narrower side of the screen, so a
 * portrait phone frames the globe the way a landscape screen does.
 */
export const FOV = 38;
export const MIN_DISTANCE = 1.15;
export const MAX_DISTANCE = 4;
/** How far the globe sits above the screen centre, as a share of its height. */
const LIFT = 0.05;
/** Distance a flight zooms in to, if the camera is further out. */
const FLIGHT_DISTANCE = 2.4;
const MAX_FLIGHT_S = 1.2;

interface Flight {
	from: Vector3;
	rotation: Quaternion;
	fromDistance: number;
	toDistance: number;
	startedAt: number;
	duration: number;
}

const easeInOutCubic = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * Orbit controls (rotate and zoom, no pan), idle auto-rotation, and
 * `flyTo` requests from the store.
 */
export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
	const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const touch = useCoarsePointer();
	const request = useGlobeStore((s) => s.flight);
	const flight = useRef<Flight | null>(null);
	const lastInteraction = useRef(performance.now());
	const identity = useRef(new Quaternion());

	// three.js fixes the vertical field of view. In portrait, widen it so the
	// horizontal one is FOV instead. Runs after R3F updates the aspect.
	// The view offset then shifts the frame down, lifting the globe clear of
	// the timeline without moving the orbit pivot.
	useEffect(() => {
		const perspective = camera as PerspectiveCamera;
		const { width, height } = size;
		const aspect = width / height;
		const halfFov = (FOV * Math.PI) / 360;
		perspective.fov =
			aspect >= 1
				? FOV
				: (360 / Math.PI) * Math.atan(Math.tan(halfFov) / aspect);
		perspective.setViewOffset(width, height, 0, height * LIFT, width, height);
		perspective.updateProjectionMatrix();
	}, [camera, size]);

	useEffect(() => {
		if (!request) return;
		const from = camera.position.clone().normalize();
		const to = lonLatToVector3(request.longitude, request.latitude);
		const angle = from.angleTo(to);
		const fromDistance = camera.position.length();
		flight.current = {
			from,
			rotation: new Quaternion().setFromUnitVectors(from, to),
			fromDistance,
			toDistance: Math.min(fromDistance, FLIGHT_DISTANCE),
			startedAt: performance.now(),
			duration: reducedMotion
				? 0
				: Math.min(MAX_FLIGHT_S, 0.35 + (angle / Math.PI) * 0.85) * 1000,
		};
	}, [request, camera, reducedMotion]);

	useFrame(() => {
		const c = controls.current;
		if (!c) return;
		const now = performance.now();

		const f = flight.current;
		if (f) {
			const t =
				f.duration === 0 ? 1 : Math.min(1, (now - f.startedAt) / f.duration);
			const k = easeInOutCubic(t);
			const step = identity.current.clone().slerp(f.rotation, k);
			const distance = f.fromDistance + (f.toDistance - f.fromDistance) * k;
			camera.position
				.copy(f.from)
				.applyQuaternion(step)
				.multiplyScalar(distance);
			camera.lookAt(0, 0, 0);
			if (t >= 1) {
				flight.current = null;
				lastInteraction.current = now;
			}
		}

		// Slower rotation when zoomed in, so the surface tracks the pointer.
		// OrbitControls scales drags by the screen height, but the globe is sized
		// by the narrower side, so portrait screens need a boost to keep up.
		const distance = camera.position.length();
		c.rotateSpeed =
			(0.12 +
				(0.5 * (distance - MIN_DISTANCE)) / (MAX_DISTANCE - MIN_DISTANCE)) *
			Math.max(1, size.height / size.width);

		const idle = now - lastInteraction.current > IDLE_ROTATE_AFTER_MS;
		const hasSelection = useGlobeStore.getState().selectedKey !== null;
		c.autoRotate = !reducedMotion && !hasSelection && !flight.current && idle;
	});

	const onStart = () => {
		lastInteraction.current = performance.now();
		flight.current = null;
	};
	const onEnd = () => {
		lastInteraction.current = performance.now();
	};

	return (
		<OrbitControls
			ref={controls}
			makeDefault
			enablePan={false}
			enableDamping
			dampingFactor={0.08}
			minDistance={MIN_DISTANCE}
			maxDistance={MAX_DISTANCE}
			// Gentle wheel steps; a pinch follows the fingers.
			zoomSpeed={touch ? 1 : 0.6}
			autoRotateSpeed={0.35}
			onStart={onStart}
			onEnd={onEnd}
		/>
	);
}
