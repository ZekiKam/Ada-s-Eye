/**
 * Every number and colour the globe uses. Components and shaders read only
 * from the active preset, so changing ACTIVE_PRESET (or one value below)
 * restyles the globe with no other code change.
 */
export interface GlobeStyle {
	/** Ocean in light, and in the shadow band. */
	ocean: string;
	oceanShade: string;
	/** Land in light, and in the shadow band. */
	land: string;
	landShade: string;
	/** Coastlines, rim and halftone dots. */
	ink: string;
	/** View-space direction the light comes from. Normalised in the shader. */
	lightDirection: readonly [number, number, number];
	/** Number of toon bands. 1 means flat colour. */
	bands: number;
	/** Light floor, 0 to 1. */
	ambient: number;
	/** Halftone cell size in CSS pixels. */
	halftoneScale: number;
	/** 0 turns halftone off. Dot ink on the ocean is scaled by `oceanDotStrength`. */
	halftoneStrength: number;
	oceanDotStrength: number;
	/** Width of the ink rim, in units of cos(view angle). 0 turns it off. */
	rimWidth: number;
	rimStrength: number;
	/** Screen-space grain amplitude. 0 turns it off. */
	grain: number;
	coastline: LineStyle;
	borders: LineStyle;
	graticule: LineStyle;
	marker: MarkerStyle;
}

export interface LineStyle {
	color: string;
	/** CSS pixels. */
	width: number;
	opacity: number;
}

export interface MarkerStyle {
	/** Marker radius in CSS pixels, kept constant at every zoom. */
	sizePx: number;
	/** Multiplier while hovered or selected. */
	emphasis: number;
	/** Ink outline radius as a multiple of the marker radius. */
	outline: number;
	/** Pointer hit area as a multiple of the marker radius. */
	hitArea: number;
	/** Selection ring in the category tone, over a wider ink halo, as multiples of the marker radius. */
	selectionRing: readonly [inner: number, outer: number];
	selectionHalo: readonly [inner: number, outer: number];
	/** True-scale footprint ring. */
	footprintWidth: number;
	footprintOpacity: number;
	/** Seconds per pulse for new events. */
	pulsePeriod: number;
	/** How far a pulse grows, as a multiple of the marker radius. */
	pulseReach: number;
	/** Fade-in time for markers that appear between polls. */
	appearMs: number;
}

const INK = "#0b1046";
const BONE = "#efe7d2";

const engraving: GlobeStyle = {
	ocean: "#1b2bab",
	oceanShade: "#14207f",
	land: BONE,
	landShade: "#d8cdb0",
	ink: INK,
	lightDirection: [-0.55, 0.55, 0.63],
	bands: 3,
	ambient: 0.12,
	halftoneScale: 4.5,
	halftoneStrength: 1,
	oceanDotStrength: 0.55,
	rimWidth: 0.11,
	rimStrength: 1,
	grain: 0.045,
	coastline: { color: INK, width: 1.1, opacity: 1 },
	borders: { color: INK, width: 0.6, opacity: 0.45 },
	graticule: { color: BONE, width: 0.6, opacity: 0.16 },
	marker: {
		sizePx: 5,
		emphasis: 1.45,
		outline: 1.45,
		hitArea: 2.6,
		selectionRing: [2.15, 2.6],
		selectionHalo: [1.9, 2.85],
		footprintWidth: 1.4,
		footprintOpacity: 0.9,
		pulsePeriod: 1.6,
		pulseReach: 5,
		appearMs: 220,
	},
};

/** Flat colours, no halftone or grain. Also the low-power fallback. */
const plain: GlobeStyle = {
	...engraving,
	ocean: "#1e30b8",
	oceanShade: "#1e30b8",
	landShade: BONE,
	bands: 1,
	ambient: 1,
	halftoneStrength: 0,
	rimWidth: 0.05,
	rimStrength: 0.8,
	grain: 0,
	graticule: { color: BONE, width: 0.5, opacity: 0.1 },
};

export const PRESETS = { engraving, plain } as const;

export type PresetName = keyof typeof PRESETS;

export const ACTIVE_PRESET: PresetName = "engraving";

export const globeStyle: GlobeStyle = PRESETS[ACTIVE_PRESET];
