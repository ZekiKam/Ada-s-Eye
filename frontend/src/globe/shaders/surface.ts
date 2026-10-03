/**
 * Globe surface: land mask, per-country colour, toon bands from a light fixed in view space,
 * halftone in the shadow band, an ink rim at the silhouette, then grain.
 * Every constant is a uniform fed from theme/globe-style.ts.
 */

export const surfaceVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vViewPosition;

void main() {
	vUv = uv;
	vViewNormal = normalize(normalMatrix * normal);
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	vViewPosition = mvPosition.xyz;
	gl_Position = projectionMatrix * mvPosition;
}
`;

export const surfaceFragmentShader = /* glsl */ `
uniform sampler2D uLandMask;
uniform sampler2D uCountryMap;
uniform vec3 uOcean;
uniform vec3 uOceanShade;
uniform vec3 uLand;
uniform vec3 uLandShade;
uniform vec3 uInk;
uniform vec3 uLightDirection;
uniform float uBands;
uniform float uAmbient;
uniform float uHalftoneScale;
uniform float uHalftoneStrength;
uniform float uOceanDotStrength;
uniform float uRimWidth;
uniform float uRimStrength;
uniform float uGrain;
uniform float uPixelRatio;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vViewPosition;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
	float mask = texture2D(uLandMask, vUv).r;
	// uReveal fades land in over the ocean once the atlas arrives.
	float land = smoothstep(0.35, 0.65, mask) * uReveal;

	vec3 n = normalize(vViewNormal);
	float diffuse = max(dot(n, normalize(uLightDirection)), 0.0);
	float light = clamp(uAmbient + (1.0 - uAmbient) * diffuse, 0.0, 1.0);

	// Toon bands. With one band the surface is flat.
	float band = 1.0;
	if (uBands > 1.0) {
		band = clamp(floor(light * uBands) / (uBands - 1.0), 0.0, 1.0);
	}
	// Each country's colour, darkened in shadow by the land shade ratio.
	vec3 country = texture2D(uCountryMap, vUv).rgb;
	vec3 countryShade = country * (uLandShade / max(uLand, vec3(1e-4)));
	vec3 lit = mix(uOcean, country, land);
	vec3 shade = mix(uOceanShade, countryShade, land);
	vec3 color = mix(shade, lit, band);

	// Halftone: dots in screen space, growing as light falls in the shadow band.
	if (uHalftoneStrength > 0.0) {
		float shadowEdge = 1.0 / max(uBands, 1.0);
		float darkness = clamp(1.0 - light / shadowEdge, 0.0, 1.0);
		vec2 p = gl_FragCoord.xy / (uHalftoneScale * uPixelRatio);
		p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
		float d = length(fract(p) - 0.5);
		float radius = sqrt(darkness) * 0.62;
		float aa = fwidth(d);
		float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, d);
		float strength = uHalftoneStrength * mix(uOceanDotStrength, 1.0, land);
		color = mix(color, uInk, dotMask * strength);
	}

	// Ink rim at the silhouette.
	if (uRimWidth > 0.0) {
		float facing = dot(n, normalize(-vViewPosition));
		float rim = 1.0 - smoothstep(uRimWidth * 0.7, uRimWidth, facing);
		color = mix(color, uInk, rim * uRimStrength);
	}

	// Static paper grain.
	if (uGrain > 0.0) {
		color += (hash(floor(gl_FragCoord.xy / uPixelRatio)) - 0.5) * uGrain;
	}

	gl_FragColor = vec4(color, 1.0);
	#include <colorspace_fragment>
}
`;
