import { useEffect, useMemo } from "react";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineStyle } from "@/theme/globe-style";
import { useReveal } from "./useReveal";

interface GeoLinesProps {
	segments: Float32Array;
	style: LineStyle;
	/** Fade-in on mount. */
	revealMs: number;
}

/**
 * Screen-space-width line segments (coastlines, borders, graticule). Lines
 * are geometry, not texture, so they stay crisp at any zoom.
 */
export function GeoLines({ segments, style, revealMs }: GeoLinesProps) {
	const line = useMemo(() => {
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(segments);
		const material = new LineMaterial({
			color: style.color,
			linewidth: style.width,
			opacity: 0,
			transparent: true,
			depthWrite: style.opacity >= 1,
		});
		return new LineSegments2(geometry, material);
	}, [segments, style]);

	useEffect(
		() => () => {
			line.geometry.dispose();
			line.material.dispose();
		},
		[line],
	);

	useReveal(revealMs, (t) => {
		// Blending only applies to transparent materials, so stay transparent
		// until the fade ends.
		line.material.opacity = style.opacity * t;
		line.material.transparent = t < 1 || style.opacity < 1;
	});

	return <primitive object={line} />;
}
