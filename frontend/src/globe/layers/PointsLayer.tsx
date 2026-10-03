import { Html, Line } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
	type Group,
	type Mesh,
	type MeshBasicMaterial,
	type PerspectiveCamera,
	Quaternion,
	Vector3,
} from "three";
import type { GlobeEvent } from "@/api/schema";
import { NEW_EVENT_AGE_S } from "@/config";
import { type Category, categoryOf } from "@/data/categories";
import { eventKey } from "@/data/events";
import { Tooltip } from "@/hud/Tooltip";
import { useGlobeStore } from "@/state/store";
import type { GlobeStyle } from "@/theme/globe-style";
import { toneColor } from "@/theme/tones";
import { ALTITUDE, footprintLoop, lonLatToVector3 } from "../geo";

interface PointsLayerProps {
	events: readonly GlobeEvent[];
	style: GlobeStyle;
	reducedMotion: boolean;
}

/** One marker and true-scale footprint per event, keyed by event identity. */
export function PointsLayer({
	events,
	style,
	reducedMotion,
}: PointsLayerProps) {
	return (
		<group>
			{events.map((event) => {
				const id = eventKey(event);
				return (
					<EventMarker
						key={id}
						id={id}
						event={event}
						category={categoryOf(event.event_type)}
						style={style}
						reducedMotion={reducedMotion}
					/>
				);
			})}
		</group>
	);
}

const OUTWARD = new Vector3(0, 0, 1);
const scratch = new Vector3();

interface EventMarkerProps {
	id: string;
	event: GlobeEvent;
	category: Category;
	style: GlobeStyle;
	reducedMotion: boolean;
}

function EventMarker({
	id,
	event,
	category,
	style,
	reducedMotion,
}: EventMarkerProps) {
	const { longitude, latitude, range } = event;
	const m = style.marker;
	const color = toneColor(category.tone);

	const selected = useGlobeStore((s) => s.selectedKey === id);
	const hovered = useGlobeStore((s) => s.hoveredKey === id);
	const select = useGlobeStore((s) => s.select);
	const hover = useGlobeStore((s) => s.hover);
	const flyTo = useGlobeStore((s) => s.flyTo);

	const position = useMemo(
		() => lonLatToVector3(longitude, latitude, ALTITUDE.marker),
		[longitude, latitude],
	);
	const quaternion = useMemo(
		() =>
			new Quaternion().setFromUnitVectors(
				OUTWARD,
				position.clone().normalize(),
			),
		[position],
	);
	const footprint = useMemo(
		() => footprintLoop(longitude, latitude, range, ALTITUDE.footprint),
		[longitude, latitude, range],
	);

	const scaled = useRef<Group>(null);
	const pulse = useRef<Mesh>(null);
	const pulseMaterial = useRef<MeshBasicMaterial>(null);
	const bornAt = useRef<number | null>(null);

	useFrame(({ camera, size, clock }) => {
		const group = scaled.current;
		if (!group) return;
		bornAt.current ??= clock.elapsedTime;

		// Keep the marker a constant size on screen at every zoom.
		group.getWorldPosition(scratch);
		const distance = camera.position.distanceTo(scratch);
		const fov = (camera as PerspectiveCamera).fov ?? 40;
		const worldPerPx =
			(2 * distance * Math.tan((fov * Math.PI) / 360)) / size.height;
		const appear = reducedMotion
			? 1
			: Math.min(1, ((clock.elapsedTime - bornAt.current) * 1000) / m.appearMs);
		const emphasis = selected || hovered ? m.emphasis : 1;
		group.scale.setScalar(
			m.sizePx * worldPerPx * emphasis * (1 - (1 - appear) ** 3),
		);

		const ring = pulse.current;
		const ringMaterial = pulseMaterial.current;
		if (ring && ringMaterial) {
			const age = Date.now() / 1000 - event.event_time;
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
		hover(id);
		document.body.style.cursor = "pointer";
	};
	const onOut = () => {
		if (useGlobeStore.getState().hoveredKey === id) hover(null);
		document.body.style.cursor = "";
	};
	const onClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		if (e.delta > 4) return;
		select(id);
		flyTo(longitude, latitude);
	};

	// Marker materials are `transparent` only so they sort after the country
	// labels (also transparent) by renderOrder and draw on top of them.
	return (
		<group>
			<Line
				points={footprint}
				color={color}
				lineWidth={m.footprintWidth}
				transparent
				opacity={m.footprintOpacity}
				depthWrite={false}
			/>
			<group position={position} quaternion={quaternion}>
				<group ref={scaled} scale={0}>
					<mesh
						onPointerOver={onOver}
						onPointerOut={onOut}
						onPointerMove={(e) => e.stopPropagation()}
						onClick={onClick}
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
					{selected && (
						<>
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
									color={color}
									transparent
									depthWrite={false}
								/>
							</mesh>
						</>
					)}
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
						<Tooltip event={event} category={category} />
					</Html>
				)}
			</group>
		</group>
	);
}
