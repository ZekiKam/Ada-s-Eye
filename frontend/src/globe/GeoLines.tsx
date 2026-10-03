import { useEffect, useMemo } from "react";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineStyle } from "@/theme/globe-style";

interface GeoLinesProps {
	segments: Float32Array;
	style: LineStyle;
}

/**
 * Screen-space-width line segments (coastlines, borders, graticule). Lines
 * are geometry, not texture, so they stay crisp at any zoom.
 */
export function GeoLines({ segments, style }: GeoLinesProps) {
	const line = useMemo(() => {
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(segments);
		const material = new LineMaterial({
			color: style.color,
			linewidth: style.width,
			opacity: style.opacity,
			transparent: style.opacity < 1,
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

	return <primitive object={line} />;
}
