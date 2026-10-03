import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	ShaderMaterial,
} from "three";
import type { StarStyle } from "@/theme/globe-style";

/** Well beyond the furthest zoom and inside the camera's far plane. */
const SKY_RADIUS = 20;
/** A flare star's sprite is this many times its dot, to leave room for the spikes. */
const FLARE_SPRITE = 5;

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aOpacity;
attribute float aPhase;
attribute float aFlare;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkle;
uniform float uTwinklePeriod;
varying float vOpacity;
varying float vFlare;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	float wave = 0.5 + 0.5 * sin(6.2831853 * (uTime / uTwinklePeriod + aPhase));
	vOpacity = aOpacity * (1.0 - uTwinkle * wave);
	vFlare = aFlare;
	gl_PointSize = aSize * uPixelRatio * mix(1.0, ${FLARE_SPRITE.toFixed(1)}, aFlare);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
varying float vOpacity;
varying float vFlare;

void main() {
	vec2 p = gl_PointCoord * 2.0 - 1.0;
	float r = length(p);
	float coreRadius = mix(0.9, 0.9 / ${FLARE_SPRITE.toFixed(1)}, vFlare);
	float core = 1.0 - smoothstep(coreRadius * 0.6, coreRadius, r);
	// Thin horizontal and vertical spikes that taper to the sprite edge.
	vec2 a = abs(p);
	float spikes = max(
		(1.0 - smoothstep(0.0, 0.06, a.y)) * (1.0 - a.x),
		(1.0 - smoothstep(0.0, 0.06, a.x)) * (1.0 - a.y)
	);
	float alpha = max(core, spikes * vFlare) * vOpacity;
	if (alpha < 0.01) discard;
	gl_FragColor = vec4(uColor, alpha);
	#include <colorspace_fragment>
}
`;

/** Deterministic, so the sky is the same on every load. */
function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function buildSky(style: StarStyle): BufferGeometry {
	const random = mulberry32(0x5eed);
	const { count } = style;
	const [minSize, maxSize] = style.sizePx;
	const [minOpacity, maxOpacity] = style.opacity;
	const flareFrom = 1 - style.flareShare;

	const positions = new Float32Array(count * 3);
	const sizes = new Float32Array(count);
	const opacities = new Float32Array(count);
	const phases = new Float32Array(count);
	const flares = new Float32Array(count);

	for (let i = 0; i < count; i++) {
		// Uniform on the sphere.
		const z = random() * 2 - 1;
		const theta = random() * Math.PI * 2;
		const s = Math.sqrt(1 - z * z);
		positions.set(
			[
				SKY_RADIUS * s * Math.cos(theta),
				SKY_RADIUS * z,
				SKY_RADIUS * s * Math.sin(theta),
			],
			i * 3,
		);
		// Skewed so most stars are small and faint, and a few are bright.
		const magnitude = random();
		const weight = magnitude ** 4;
		sizes[i] = minSize + (maxSize - minSize) * weight;
		opacities[i] = minOpacity + (maxOpacity - minOpacity) * magnitude ** 2;
		phases[i] = random();
		flares[i] = magnitude >= flareFrom ? 1 : 0;
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
	geometry.setAttribute("aOpacity", new Float32BufferAttribute(opacities, 1));
	geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
	geometry.setAttribute("aFlare", new Float32BufferAttribute(flares, 1));
	return geometry;
}

interface StarsProps {
	style: StarStyle;
	reducedMotion: boolean;
}

/**
 * A fixed star field on a large sphere around the globe. The camera orbits
 * inside it, so the sky turns with the view. The globe hides stars behind it.
 */
export function Stars({ style, reducedMotion }: StarsProps) {
	const pixelRatio = useThree((s) => s.viewport.dpr);
	const geometry = useMemo(() => buildSky(style), [style]);

	const material = useMemo(
		() =>
			new ShaderMaterial({
				vertexShader,
				fragmentShader,
				transparent: true,
				depthWrite: false,
				uniforms: {
					uColor: { value: new Color() },
					uPixelRatio: { value: 1 },
					uTime: { value: 0 },
					uTwinkle: { value: 0 },
					uTwinklePeriod: { value: 1 },
				},
			}),
		[],
	);

	useEffect(() => {
		const u = material.uniforms;
		u.uColor.value.set(style.color);
		u.uPixelRatio.value = pixelRatio;
		u.uTwinkle.value = reducedMotion ? 0 : style.twinkle;
		u.uTwinklePeriod.value = style.twinklePeriod;
	}, [material, style, pixelRatio, reducedMotion]);

	useFrame(({ clock }) => {
		if (!reducedMotion) material.uniforms.uTime.value = clock.elapsedTime;
	});

	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);

	if (style.count === 0) return null;

	return (
		<points
			geometry={geometry}
			material={material}
			// Never the target of a click or hover.
			raycast={() => null}
		/>
	);
}
