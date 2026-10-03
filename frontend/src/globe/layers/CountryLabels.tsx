import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import {
	type Group,
	Matrix4,
	type Mesh,
	type PerspectiveCamera,
	Quaternion,
	Vector3,
} from "three";
import type { LabelStyle } from "@/theme/globe-style";
import { ALTITUDE, type CountryLabel, lonLatToVector3 } from "../geo";
import { useReveal } from "../useReveal";

/** The parts of troika's Text mesh driven per frame. */
type TroikaText = Mesh & {
	fillOpacity: number;
	outlineOpacity: number;
	curveRadius: number;
	textRenderInfo?: { blockBounds: [number, number, number, number] } | null;
};

interface CountryLabelsProps {
	labels: readonly CountryLabel[];
	style: LabelStyle;
	/** Fade-in on mount. */
	revealMs: number;
}

const DEG = Math.PI / 180;
const NORTH_POLE = new Vector3(0, 1, 0);
const toCamera = new Vector3();
const projected = new Vector3();

/** Rotation laying text flat on the sphere at `normal`, reading east, north up. */
function tangentFrame(normal: Vector3): Quaternion {
	const east = new Vector3().crossVectors(NORTH_POLE, normal);
	if (east.lengthSq() < 1e-8) east.set(0, 0, -1);
	east.normalize();
	const north = new Vector3().crossVectors(normal, east);
	return new Quaternion().setFromRotationMatrix(
		new Matrix4().makeBasis(east, north, normal),
	);
}

const smoothstep = (lo: number, hi: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
	return t * t * (3 - 2 * t);
};

/**
 * Country names as SDF text lying on the globe, kept a constant size on
 * screen. A name shows when its country faces the camera, is big enough on
 * screen at the current zoom, and doesn't collide with a larger country's
 * name. Labels arrive largest first, so big countries win.
 */
export function CountryLabels({ labels, style, revealMs }: CountryLabelsProps) {
	const frames = useMemo(
		() =>
			labels.map((label) => {
				const normal = lonLatToVector3(label.longitude, label.latitude);
				return {
					normal,
					position: normal.clone().multiplyScalar(ALTITUDE.label),
					quaternion: tangentFrame(normal),
				};
			}),
		[labels],
	);
	const groups = useRef<(Group | null)[]>([]);
	const texts = useRef<(TroikaText | null)[]>([]);
	/** Collision fade per label, 0 to 1. */
	const shown = useRef<number[]>([]);
	const reveal = useRef(0);
	useReveal(revealMs, (t) => {
		reveal.current = t;
	});

	useFrame(({ camera, size }, delta) => {
		const fov = (camera as PerspectiveCamera).fov ?? 40;
		const tanHalfFov = Math.tan((fov * DEG) / 2);
		const [hidden, opaque] = style.horizon;
		const step = style.fadeMs > 0 ? (delta * 1000) / style.fadeMs : 1;
		const placed: number[] = [];

		for (let i = 0; i < labels.length; i++) {
			const group = groups.current[i];
			const text = texts.current[i];
			const bounds = text?.textRenderInfo?.blockBounds;
			if (!group || !text || !bounds) continue;

			const { normal, position } = frames[i];
			toCamera.subVectors(camera.position, position);
			const distance = toCamera.length();
			const facing = normal.dot(toCamera) / distance;
			const worldPerPx = (2 * distance * tanHalfFov) / size.height;

			let target = 0;
			const extentPx = Math.sqrt(labels[i].area) / worldPerPx;
			if (facing > hidden && extentPx >= style.minExtentPx) {
				projected.copy(position).project(camera);
				const x = ((projected.x + 1) / 2) * size.width;
				const y = ((1 - projected.y) / 2) * size.height;
				const halfW = ((bounds[2] - bounds[0]) * style.sizePx) / 2;
				const halfH = ((bounds[3] - bounds[1]) * style.sizePx) / 2;
				const left = x - halfW - style.gapPx;
				const top = y - halfH - style.gapPx;
				const right = x + halfW + style.gapPx;
				const bottom = y + halfH + style.gapPx;
				if (
					right > 0 &&
					left < size.width &&
					bottom > 0 &&
					top < size.height &&
					!overlaps(placed, left, top, right, bottom)
				) {
					placed.push(left, top, right, bottom);
					target = 1;
				}
			}

			const current = shown.current[i] ?? 0;
			shown.current[i] =
				target > current
					? Math.min(target, current + step)
					: Math.max(target, current - step);
			const opacity =
				reveal.current * shown.current[i] * smoothstep(hidden, opaque, facing);

			group.visible = opacity > 0;
			if (!group.visible) continue;
			const scale = style.sizePx * worldPerPx;
			group.scale.setScalar(scale);
			// Wrap the text around the sphere: its radius in the text's units.
			text.curveRadius = ALTITUDE.label / scale;
			text.fillOpacity = opacity;
			text.outlineOpacity = opacity;
		}
	});

	return (
		<Suspense fallback={null}>
			{labels.map((label, i) => (
				<group
					key={label.name}
					ref={(g) => {
						groups.current[i] = g;
					}}
					position={frames[i].position}
					quaternion={frames[i].quaternion}
					visible={false}
				>
					<Text
						ref={(t: TroikaText | null) => {
							texts.current[i] = t;
						}}
						font={style.font}
						fontSize={1}
						letterSpacing={style.letterSpacing}
						anchorX="center"
						anchorY="middle"
						color={style.color}
						outlineColor={style.halo}
						outlineWidth={style.haloWidth}
						outlineBlur={style.haloBlur}
						renderOrder={1}
					>
						{label.name.toUpperCase()}
					</Text>
				</group>
			))}
		</Suspense>
	);
}

/** `placed` holds rectangles flattened as [left, top, right, bottom, ...]. */
function overlaps(
	placed: readonly number[],
	left: number,
	top: number,
	right: number,
	bottom: number,
): boolean {
	for (let j = 0; j < placed.length; j += 4) {
		if (
			left < placed[j + 2] &&
			right > placed[j] &&
			top < placed[j + 3] &&
			bottom > placed[j + 1]
		) {
			return true;
		}
	}
	return false;
}
