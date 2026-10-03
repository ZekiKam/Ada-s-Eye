import { Html, Line } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useMemo, useRef } from "react";
import {
	type Camera,
	type Group,
	type Mesh,
	type MeshBasicMaterial,
	type Object3D,
	type PerspectiveCamera,
	Quaternion,
	Vector3,
} from "three";
import { useRequestAnomaly } from "@/api/generated";
import type {
	Anomaly,
	FoundAnomalyPoint,
	GlobePoint,
} from "@/api/generated/model";
import { EARTH_RADIUS_M, NEW_EVENT_AGE_S } from "@/config";
import { ANOMALY, eventKey, eventSeconds, WILDFIRE } from "@/data/events";
import { AnomalyQuery } from "@/hud/AnomalyQuery";
import { Tooltip } from "@/hud/Tooltip";
import { type Selection, useGlobeStore } from "@/state/store";
import type { GlobeStyle } from "@/theme/globe-style";
import { toneColor } from "@/theme/tones";
import { ALTITUDE, footprintLoop, lonLatToVector3 } from "../geo";

interface PointsLayerProps {
	events: readonly GlobePoint[];
	anomalies: readonly FoundAnomalyPoint[];
	style: GlobeStyle;
	reducedMotion: boolean;
}

/**
 * One marker and true-scale footprint per event, keyed by event identity,
 * the same for each anomaly anyone has found, plus a marker for the selected
 * spot.
 */
export function PointsLayer({
	events,
	anomalies,
	style,
	reducedMotion,
}: PointsLayerProps) {
	const spot = useGlobeStore((s) => s.selected);
	return (
		<group>
			{spot && (
				<SpotMarker spot={spot} style={style} reducedMotion={reducedMotion} />
			)}
			{events.map((event) => {
				const id = eventKey(event);
				return (
					<EventMarker
						key={id}
						id={id}
						event={event}
						style={style}
						reducedMotion={reducedMotion}
					/>
				);
			})}
			{anomalies.map((anomaly) => (
				<group key={eventKey(anomaly)}>
					<SizeRing
						longitude={anomaly.longitude}
						latitude={anomaly.latitude}
						radius={anomaly.radius}
						color={toneColor(ANOMALY.tone)}
						style={style}
					/>
					<FireDot
						longitude={anomaly.longitude}
						latitude={anomaly.latitude}
						color={toneColor(ANOMALY.tone)}
						style={style}
					/>
				</group>
			))}
		</group>
	);
}

const OUTWARD = new Vector3(0, 0, 1);
const scratch = new Vector3();

/** World units per CSS pixel at `object`, for constant-screen-size markers. */
function worldPerPixel(
	camera: Camera,
	viewportHeight: number,
	object: Object3D,
): number {
	object.getWorldPosition(scratch);
	const distance = camera.position.distanceTo(scratch);
	const fov = (camera as PerspectiveCamera).fov ?? 40;
	return (2 * distance * Math.tan((fov * Math.PI) / 360)) / viewportHeight;
}

/** Position and outward-facing orientation for a marker at a place. */
function useAnchor(
	longitude: number,
	latitude: number,
	altitude: number = ALTITUDE.marker,
) {
	return useMemo(() => {
		const position = lonLatToVector3(longitude, latitude, altitude);
		const quaternion = new Quaternion().setFromUnitVectors(
			OUTWARD,
			position.clone().normalize(),
		);
		return { position, quaternion };
	}, [longitude, latitude, altitude]);
}

/** A unit circle in the XY plane, for `SizeRing` to scale. */
const UNIT_CIRCLE = Array.from({ length: 65 }, (_, i) => {
	const a = (i / 64) * 2 * Math.PI;
	return [Math.cos(a), Math.sin(a), 0] as [number, number, number];
});

interface SizeRingProps {
	longitude: number;
	latitude: number;
	/** Metres. */
	radius: number;
	color: string;
	style: GlobeStyle;
}

/**
 * A ring around a fire showing its radius: true to scale once that is big
 * enough to see, and before then a symbol that grows with the radius
 * (`sizeRing` in the globe style), so fires still compare when zoomed out.
 * Never smaller than the fire.
 */
function SizeRing({
	longitude,
	latitude,
	radius,
	color,
	style,
}: SizeRingProps) {
	const m = style.marker;
	const { position, quaternion } = useAnchor(
		longitude,
		latitude,
		ALTITUDE.footprint,
	);
	const ring = useRef<Group>(null);
	// The globe has radius 1.
	const trueScale = radius / EARTH_RADIUS_M;
	const symbolPx =
		m.sizePx *
		(m.sizeRing.base + m.sizeRing.perSqrtKm * Math.sqrt(radius / 1000));

	useFrame(({ camera, size }) => {
		const group = ring.current;
		if (!group) return;
		group.scale.setScalar(
			Math.max(trueScale, symbolPx * worldPerPixel(camera, size.height, group)),
		);
	});

	return (
		<group ref={ring} position={position} quaternion={quaternion} scale={0}>
			<Line
				points={UNIT_CIRCLE}
				color={color}
				lineWidth={m.footprintWidth}
				transparent
				opacity={m.footprintOpacity}
				depthWrite={false}
			/>
		</group>
	);
}

/** Keeps the query button this far inside the screen edge. */
const SCREEN_MARGIN_PX = 16;
/** Spot facing below this (cos of the angle to the camera) hides the button. */
const MIN_FACING = 0.15;

const stop = (e: SyntheticEvent) => e.stopPropagation();

interface SpotMarkerProps {
	spot: Selection;
	style: GlobeStyle;
	reducedMotion: boolean;
}

/**
 * The selected spot: a small dot in a ring over an ink halo, and the
 * anomaly query button beside it. Once the query finds an anomaly the spot
 * takes the anomaly tone and pulses. The marker has no handlers, so R3F
 * never raycasts it and clicks reach the globe beneath.
 */
function SpotMarker({ spot, style, reducedMotion }: SpotMarkerProps) {
	const m = style.marker;
	const { position, quaternion } = useAnchor(spot.longitude, spot.latitude);
	const scaled = useRef<Group>(null);
	const panel = useRef<HTMLDivElement>(null);
	const pulse = useRef<Mesh>(null);
	const pulseMaterial = useRef<MeshBasicMaterial>(null);
	// Observes the answer AnomalyQuery fetches; never fetches itself.
	const { data: anomaly } = useRequestAnomaly<Anomaly, Error>(spot, {
		query: { enabled: false },
	});
	const found = anomaly !== undefined && anomaly.confidence > 0;
	const spotColor = found ? toneColor(ANOMALY.tone) : m.spotColor;
	// <Html> renders into its own React root, which doesn't inherit context.
	const queryClient = useQueryClient();
	// Clear of the selection halo's outer edge.
	const gapPx = m.sizePx * m.emphasis * m.selectionHalo[1] + 8;

	useFrame(({ camera, size, clock }) => {
		const group = scaled.current;
		if (!group) return;
		group.scale.setScalar(
			m.sizePx * m.emphasis * worldPerPixel(camera, size.height, group),
		);

		// Grows out from the halo's outer edge.
		const ring = pulse.current;
		const ringMaterial = pulseMaterial.current;
		if (ring && ringMaterial) {
			ring.visible = found && !reducedMotion;
			if (ring.visible) {
				const t = (clock.elapsedTime % m.pulsePeriod) / m.pulsePeriod;
				const from = m.selectionHalo[1];
				ring.scale.setScalar(from + t * (m.pulseReach - from));
				ringMaterial.opacity = (1 - t) * 0.9;
			}
		}

		// Beside the spot while it faces the camera: to the right, or below
		// when the right side lacks room (a phone, with the spot centred).
		const el = panel.current;
		if (!el) return;
		const facing =
			scratch.subVectors(camera.position, position).normalize().dot(position) /
			position.length();
		el.style.visibility = facing > MIN_FACING ? "" : "hidden";
		const x = ((scratch.copy(position).project(camera).x + 1) / 2) * size.width;
		const fitsRight =
			x + gapPx + el.offsetWidth <= size.width - SCREEN_MARGIN_PX;
		const transform = fitsRight
			? `translate(${gapPx}px, -50%)`
			: `translate(-50%, ${gapPx}px)`;
		if (el.style.transform !== transform) el.style.transform = transform;
	});

	return (
		<group>
			{anomaly && <AnomalyFootprint anomaly={anomaly} style={style} />}
			<group position={position} quaternion={quaternion}>
				<Html zIndexRange={[40, 30]}>
					{/*
					 * React stops these at <Html>'s root, before they reach R3F's
					 * listener on the canvas container: a click here would otherwise
					 * also clear the selection, and a double-click pick a new spot.
					 * Keys are left alone so Escape still reaches the window.
					 */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: not a control; it only stops mouse events reaching the globe */}
					<div
						ref={panel}
						className="flex-col flex"
						style={{ visibility: "hidden" }}
						onPointerDown={stop}
						onPointerUp={stop}
						onPointerMove={stop}
						onClick={stop}
						onDoubleClick={stop}
						onContextMenu={stop}
					>
						<QueryClientProvider client={queryClient}>
							<AnomalyQuery
								key={`${spot.longitude}|${spot.latitude}|${spot.year}`}
								selection={spot}
							/>
						</QueryClientProvider>
					</div>
				</Html>
				<group ref={scaled} scale={0}>
					<mesh renderOrder={2}>
						<circleGeometry args={[m.outline * 0.6, 32]} />
						<meshBasicMaterial
							color={style.ink}
							transparent
							depthWrite={false}
						/>
					</mesh>
					<mesh renderOrder={3}>
						<circleGeometry args={[0.6, 32]} />
						<meshBasicMaterial
							color={spotColor}
							transparent
							depthWrite={false}
						/>
					</mesh>
					<mesh renderOrder={2}>
						<ringGeometry args={[...m.selectionHalo, 48]} />
						<meshBasicMaterial
							color={style.ink}
							transparent
							depthWrite={false}
						/>
					</mesh>
					<mesh renderOrder={3}>
						<ringGeometry args={[...m.selectionRing, 48]} />
						<meshBasicMaterial
							color={spotColor}
							transparent
							depthWrite={false}
						/>
					</mesh>
					<mesh ref={pulse} renderOrder={1} visible={false}>
						<ringGeometry args={[1, 1.06, 48]} />
						<meshBasicMaterial
							ref={pulseMaterial}
							color={spotColor}
							transparent
							depthWrite={false}
						/>
					</mesh>
				</group>
			</group>
		</group>
	);
}

/**
 * The anomaly query's answer: the anomaly found, as a dot in a ring showing
 * its radius, or a dashed ring true to scale around the whole area searched
 * when none was.
 */
function AnomalyFootprint({
	anomaly,
	style,
}: {
	anomaly: Anomaly;
	style: GlobeStyle;
}) {
	if (anomaly.confidence === 0)
		return <SearchedArea anomaly={anomaly} style={style} />;
	const color = toneColor(ANOMALY.tone);
	return (
		<group>
			<SizeRing
				longitude={anomaly.longitude}
				latitude={anomaly.latitude}
				radius={anomaly.radius}
				color={color}
				style={style}
			/>
			<FireDot
				longitude={anomaly.longitude}
				latitude={anomaly.latitude}
				color={color}
				style={style}
			/>
		</group>
	);
}

function SearchedArea({
	anomaly,
	style,
}: {
	anomaly: Anomaly;
	style: GlobeStyle;
}) {
	const { longitude, latitude, radius } = anomaly;
	const m = style.marker;
	const points = useMemo(
		() => footprintLoop(longitude, latitude, radius, ALTITUDE.footprint),
		[longitude, latitude, radius],
	);
	// The globe has radius 1, so this splits the ring into equal dashes and gaps.
	const dash = (Math.PI * radius) / EARTH_RADIUS_M / m.clearDashes;

	return (
		<Line
			points={points}
			color={m.spotColor}
			lineWidth={m.footprintWidth}
			transparent
			opacity={m.footprintOpacity}
			depthWrite={false}
			dashed
			dashSize={dash}
			gapSize={dash}
		/>
	);
}

/** A marker-sized dot over an ink outline, constant on screen, with no handlers. */
function FireDot({
	longitude,
	latitude,
	color,
	style,
}: {
	longitude: number;
	latitude: number;
	color: string;
	style: GlobeStyle;
}) {
	const m = style.marker;
	const { position, quaternion } = useAnchor(longitude, latitude);
	const scaled = useRef<Group>(null);

	useFrame(({ camera, size }) => {
		const group = scaled.current;
		if (!group) return;
		group.scale.setScalar(m.sizePx * worldPerPixel(camera, size.height, group));
	});

	return (
		<group position={position} quaternion={quaternion}>
			<group ref={scaled} scale={0}>
				<mesh renderOrder={2}>
					<circleGeometry args={[m.outline, 32]} />
					<meshBasicMaterial color={style.ink} transparent depthWrite={false} />
				</mesh>
				<mesh renderOrder={3}>
					<circleGeometry args={[1, 32]} />
					<meshBasicMaterial color={color} transparent depthWrite={false} />
				</mesh>
			</group>
		</group>
	);
}

interface EventMarkerProps {
	id: string;
	event: GlobePoint;
	style: GlobeStyle;
	reducedMotion: boolean;
}

/**
 * A wildfire: marker, a ring showing its radius and a tooltip on hover. Clicks
 * pass through to the globe, so a double-click here queries the spot.
 */
function EventMarker({ id, event, style, reducedMotion }: EventMarkerProps) {
	const { longitude, latitude, radius } = event;
	const m = style.marker;
	const color = toneColor(WILDFIRE.tone);
	const seconds = useMemo(() => eventSeconds(event), [event]);

	const hovered = useGlobeStore((s) => s.hoveredKey === id);
	const hover = useGlobeStore((s) => s.hover);

	const { position, quaternion } = useAnchor(longitude, latitude);

	const scaled = useRef<Group>(null);
	const pulse = useRef<Mesh>(null);
	const pulseMaterial = useRef<MeshBasicMaterial>(null);
	const bornAt = useRef<number | null>(null);

	useFrame(({ camera, size, clock }) => {
		const group = scaled.current;
		if (!group) return;
		bornAt.current ??= clock.elapsedTime;

		// Keep the marker a constant size on screen at every zoom.
		const worldPerPx = worldPerPixel(camera, size.height, group);
		const appear = reducedMotion
			? 1
			: Math.min(1, ((clock.elapsedTime - bornAt.current) * 1000) / m.appearMs);
		const emphasis = hovered ? m.emphasis : 1;
		group.scale.setScalar(
			m.sizePx * worldPerPx * emphasis * (1 - (1 - appear) ** 3),
		);

		const ring = pulse.current;
		const ringMaterial = pulseMaterial.current;
		if (ring && ringMaterial) {
			const age = Date.now() / 1000 - seconds;
			ring.visible = !reducedMotion && age >= 0 && age < NEW_EVENT_AGE_S;
			if (ring.visible) {
				const t = (clock.elapsedTime % m.pulsePeriod) / m.pulsePeriod;
				ring.scale.setScalar(1 + t * (m.pulseReach - 1));
				ringMaterial.opacity = (1 - t) * 0.9;
			}
		}
	});

	const onOver = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		// A finger dragging the globe across a marker is not a hover.
		if (e.pointerType === "touch") return;
		hover(id);
	};
	const onOut = () => {
		if (useGlobeStore.getState().hoveredKey === id) hover(null);
	};

	// Marker materials are `transparent` only so they sort after the country
	// labels (also transparent) by renderOrder and draw on top of them.
	return (
		<group>
			<SizeRing
				longitude={longitude}
				latitude={latitude}
				radius={radius}
				color={color}
				style={style}
			/>
			<group position={position} quaternion={quaternion}>
				<group ref={scaled} scale={0}>
					<mesh
						onPointerOver={onOver}
						onPointerOut={onOut}
						onPointerMove={(e) => e.stopPropagation()}
					>
						<circleGeometry args={[m.hitArea, 16]} />
						<meshBasicMaterial visible={false} />
					</mesh>
					<mesh renderOrder={2}>
						<circleGeometry args={[m.outline, 32]} />
						<meshBasicMaterial
							color={style.ink}
							transparent
							depthWrite={false}
						/>
					</mesh>
					<mesh renderOrder={3}>
						<circleGeometry args={[1, 32]} />
						<meshBasicMaterial color={color} transparent depthWrite={false} />
					</mesh>
					<mesh ref={pulse} renderOrder={1} visible={false}>
						<ringGeometry args={[1, 1.18, 48]} />
						<meshBasicMaterial
							ref={pulseMaterial}
							color={color}
							transparent
							depthWrite={false}
						/>
					</mesh>
				</group>
				{hovered && (
					<Html zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
						<Tooltip event={event} />
					</Html>
				)}
			</group>
		</group>
	);
}
