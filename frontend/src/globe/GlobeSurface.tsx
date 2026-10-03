import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
	CanvasTexture,
	Color,
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	NoColorSpace,
	ShaderMaterial,
	SRGBColorSpace,
	type Texture,
	Vector3,
} from "three";
import type { GlobeStyle } from "@/theme/globe-style";
import { surfaceFragmentShader, surfaceVertexShader } from "./shaders/surface";
import { useReveal } from "./useReveal";

/** One-pixel placeholder until the atlas arrives. Black mask is all ocean. */
function placeholder(): Texture {
	const texture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
	texture.needsUpdate = true;
	return texture;
}

/** The land mask is data; the country map holds sRGB colours. */
function canvasTexture(
	canvas: HTMLCanvasElement,
	colorSpace: typeof NoColorSpace | typeof SRGBColorSpace,
): Texture {
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = colorSpace;
	texture.minFilter = LinearMipmapLinearFilter;
	texture.magFilter = LinearFilter;
	texture.anisotropy = 8;
	return texture;
}

interface GlobeSurfaceProps {
	style: GlobeStyle;
	landMask: HTMLCanvasElement | null;
	countryMap: HTMLCanvasElement | null;
	onClickEmpty(): void;
}

export function GlobeSurface({
	style,
	landMask,
	countryMap,
	onClickEmpty,
}: GlobeSurfaceProps) {
	const pixelRatio = useThree((s) => s.viewport.dpr);

	const material = useMemo(
		() =>
			new ShaderMaterial({
				vertexShader: surfaceVertexShader,
				fragmentShader: surfaceFragmentShader,
				uniforms: {
					uLandMask: { value: placeholder() },
					uCountryMap: { value: placeholder() },
					uOcean: { value: new Color() },
					uOceanShade: { value: new Color() },
					uLand: { value: new Color() },
					uLandShade: { value: new Color() },
					uInk: { value: new Color() },
					uLightDirection: { value: new Vector3() },
					uBands: { value: 1 },
					uAmbient: { value: 0 },
					uHalftoneScale: { value: 1 },
					uHalftoneStrength: { value: 0 },
					uOceanDotStrength: { value: 0 },
					uRimWidth: { value: 0 },
					uRimStrength: { value: 0 },
					uGrain: { value: 0 },
					uPixelRatio: { value: 1 },
					uReveal: { value: 0 },
				},
			}),
		[],
	);

	useEffect(() => {
		const u = material.uniforms;
		u.uOcean.value.set(style.ocean);
		u.uOceanShade.value.set(style.oceanShade);
		u.uLand.value.set(style.land);
		u.uLandShade.value.set(style.landShade);
		u.uInk.value.set(style.ink);
		u.uLightDirection.value.set(...style.lightDirection).normalize();
		u.uBands.value = style.bands;
		u.uAmbient.value = style.ambient;
		u.uHalftoneScale.value = style.halftoneScale;
		u.uHalftoneStrength.value = style.halftoneStrength;
		u.uOceanDotStrength.value = style.oceanDotStrength;
		u.uRimWidth.value = style.rimWidth;
		u.uRimStrength.value = style.rimStrength;
		u.uGrain.value = style.grain;
		u.uPixelRatio.value = pixelRatio;
	}, [material, style, pixelRatio]);

	useCanvasUniform(material, "uLandMask", landMask, NoColorSpace);
	useCanvasUniform(material, "uCountryMap", countryMap, SRGBColorSpace);
	useReveal(
		style.revealMs,
		(t) => {
			material.uniforms.uReveal.value = t;
		},
		landMask !== null && countryMap !== null,
	);

	useEffect(() => () => material.dispose(), [material]);

	const handleClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		// A drag that ends on the globe is a rotation, not a click.
		if (e.delta <= 4) onClickEmpty();
	};

	return (
		<mesh
			material={material}
			onClick={handleClick}
			// Stops hover reaching markers on the far side of the globe.
			onPointerMove={(e) => e.stopPropagation()}
		>
			<sphereGeometry args={[1, 192, 96]} />
		</mesh>
	);
}

/** Uploads a canvas into a texture uniform, disposing the one it replaces. */
function useCanvasUniform(
	material: ShaderMaterial,
	uniform: string,
	canvas: HTMLCanvasElement | null,
	colorSpace: typeof NoColorSpace | typeof SRGBColorSpace,
) {
	useEffect(() => {
		if (!canvas) return;
		const texture = canvasTexture(canvas, colorSpace);
		const previous = material.uniforms[uniform].value as Texture;
		material.uniforms[uniform].value = texture;
		previous.dispose();
		return () => texture.dispose();
	}, [material, uniform, canvas, colorSpace]);
}
