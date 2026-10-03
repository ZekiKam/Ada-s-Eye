import { geoCircle, geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import type { MultiLineString } from "geojson";
import { Vector3 } from "three";
import { feature, mesh, neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesUrl from "world-atlas/countries-50m.json?url";
import landUrl from "world-atlas/land-50m.json?url";
import { EARTH_RADIUS_M } from "@/config";

const DEG = Math.PI / 180;

/** Altitudes above the unit sphere, so overlays never z-fight the surface. */
export const ALTITUDE = {
	graticule: 1.0012,
	borders: 1.0014,
	coastline: 1.0016,
	footprint: 1.0018,
	marker: 1.002,
} as const;

/**
 * WGS84 degrees to a point on a sphere. Matches SphereGeometry's UVs, so an
 * equirectangular texture (180°W at the left, 90°N at the top) lines up.
 */
export function lonLatToVector3(
	longitude: number,
	latitude: number,
	radius = 1,
	target = new Vector3(),
): Vector3 {
	const phi = latitude * DEG;
	const lambda = longitude * DEG;
	return target
		.set(
			Math.cos(phi) * Math.cos(lambda),
			Math.sin(phi),
			-Math.cos(phi) * Math.sin(lambda),
		)
		.multiplyScalar(radius);
}

/** Flattens polylines into segment pairs for LineSegmentsGeometry. */
export function linesToSegments(
	lines: readonly (readonly number[])[][],
	radius: number,
): Float32Array {
	let count = 0;
	for (const line of lines) count += Math.max(0, line.length - 1);
	const out = new Float32Array(count * 6);
	const a = new Vector3();
	const b = new Vector3();
	let i = 0;
	for (const line of lines) {
		for (let j = 0; j < line.length - 1; j++) {
			lonLatToVector3(line[j][0], line[j][1], radius, a);
			lonLatToVector3(line[j + 1][0], line[j + 1][1], radius, b);
			out.set([a.x, a.y, a.z, b.x, b.y, b.z], i);
			i += 6;
		}
	}
	return out;
}

/** A true-scale circle of `radiusM` metres around a point, as a closed loop. */
export function footprintLoop(
	longitude: number,
	latitude: number,
	radiusM: number,
	altitude: number,
): Vector3[] {
	const degrees = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
	const ring = geoCircle()
		.center([longitude, latitude])
		.radius(degrees)
		.precision(4)().coordinates[0];
	return ring.map(([lon, lat]) => lonLatToVector3(lon, lat, altitude));
}

/** A country outline and the palette slot it is painted with. */
export interface CountryShape {
	feature: GeoJSON.Feature;
	/** Neighbouring countries never share a slot. */
	slot: number;
}

export interface Atlas {
	/** Land as white on black, equirectangular, 2:1. */
	landMask: HTMLCanvasElement;
	countries: CountryShape[];
	coastlines: Float32Array;
	borders: Float32Array;
	graticule: Float32Array;
}

type WorldTopology = Topology<{
	land?: GeometryCollection;
	countries?: GeometryCollection;
}>;

async function fetchTopology(url: string): Promise<WorldTopology> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Atlas fetch failed: ${url}`);
	return (await response.json()) as WorldTopology;
}

/** An equirectangular 2:1 canvas and a d3 path that draws onto it. */
function equirectangularCanvas(width: number, background: string) {
	const height = width / 2;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2D canvas unavailable");
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	const projection = geoEquirectangular()
		.scale(width / (2 * Math.PI))
		.translate([width / 2, height / 2])
		.precision(0.1);
	return { canvas, ctx, path: geoPath(projection, ctx) };
}

function rasterizeLand(
	land: GeoJSON.Feature | GeoJSON.FeatureCollection,
	width: number,
): HTMLCanvasElement {
	const { canvas, ctx, path } = equirectangularCanvas(width, "#000");
	ctx.beginPath();
	path(land);
	ctx.fillStyle = "#fff";
	ctx.fill();
	return canvas;
}

/**
 * Greedy graph colouring: countries in descending order of neighbour count
 * take the lowest slot no neighbour has. Five slots are always enough for
 * the world map in practice.
 */
function colourSlots(adjacency: number[][]): number[] {
	const slots = new Array<number>(adjacency.length).fill(-1);
	const order = adjacency
		.map((_, i) => i)
		.sort((a, b) => adjacency[b].length - adjacency[a].length);
	for (const i of order) {
		const taken = new Set(adjacency[i].map((j) => slots[j]));
		let slot = 0;
		while (taken.has(slot)) slot++;
		slots[i] = slot;
	}
	return slots;
}

/**
 * Paints each country in its palette slot (wrapping if the palette is
 * short). Land that belongs to no country gets the first colour. Sampled
 * only where the land mask says land, so the ocean colour here is irrelevant.
 */
export function paintCountries(
	countries: readonly CountryShape[],
	palette: readonly string[],
	width = 4096,
): HTMLCanvasElement {
	const { canvas, ctx, path } = equirectangularCanvas(width, palette[0]);
	for (const { feature: country, slot } of countries) {
		ctx.beginPath();
		path(country);
		ctx.fillStyle = palette[slot % palette.length];
		ctx.fill();
	}
	return canvas;
}

let atlasPromise: Promise<Atlas> | null = null;

/** Natural Earth 50 m outlines, fetched once and shared. */
export function loadAtlas(maskWidth = 4096): Promise<Atlas> {
	atlasPromise ??= (async () => {
		const [landTopo, countriesTopo] = await Promise.all([
			fetchTopology(landUrl),
			fetchTopology(countriesUrl),
		]);
		const landObject = landTopo.objects.land;
		const countriesObject = countriesTopo.objects.countries;
		if (!landObject || !countriesObject) {
			throw new Error("Unexpected world-atlas layout");
		}

		const coast: MultiLineString = mesh(landTopo, landObject);
		const borders: MultiLineString = mesh(
			countriesTopo,
			countriesObject,
			(a, b) => a !== b,
		);

		const slots = colourSlots(neighbors(countriesObject.geometries));
		const countries = feature(countriesTopo, countriesObject).features.map(
			(country, i) => ({ feature: country, slot: slots[i] }),
		);

		return {
			landMask: rasterizeLand(feature(landTopo, landObject), maskWidth),
			countries,
			coastlines: linesToSegments(coast.coordinates, ALTITUDE.coastline),
			borders: linesToSegments(borders.coordinates, ALTITUDE.borders),
			graticule: linesToSegments(
				geoGraticule10().coordinates,
				ALTITUDE.graticule,
			),
		};
	})();
	atlasPromise.catch(() => {
		atlasPromise = null;
	});
	return atlasPromise;
}
