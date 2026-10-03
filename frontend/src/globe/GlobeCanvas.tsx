import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { GlobeEvent } from "@/api/schema";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useGlobeStore } from "@/state/store";
import { globeStyle } from "@/theme/globe-style";
import type { ViewDefinition } from "@/views/types";
import { CameraRig } from "./CameraRig";
import { GeoLines } from "./GeoLines";
import { GlobeSurface } from "./GlobeSurface";
import { type Atlas, loadAtlas, lonLatToVector3 } from "./geo";
import { PointsLayer } from "./layers/PointsLayer";

/** Opening view: Europe and Africa, slightly from the north. */
const INITIAL_CAMERA = lonLatToVector3(10, 28, 3.3).toArray();

function hasWebGL(): boolean {
	try {
		const canvas = document.createElement("canvas");
		return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
	} catch {
		return false;
	}
}

interface GlobeCanvasProps {
	view: ViewDefinition;
	/** Events to draw, already filtered to the visible categories. */
	events: readonly GlobeEvent[];
}

export function GlobeCanvas({ view, events }: GlobeCanvasProps) {
	const [webgl] = useState(hasWebGL);
	const [atlas, setAtlas] = useState<Atlas | null>(null);
	const reducedMotion = usePrefersReducedMotion();
	const select = useGlobeStore((s) => s.select);

	useEffect(() => {
		let cancelled = false;
		loadAtlas()
			.then((a) => {
				if (!cancelled) setAtlas(a);
			})
			.catch((err: unknown) => console.error("Atlas failed to load", err));
		return () => {
			cancelled = true;
		};
	}, []);

	if (!webgl) {
		return (
			<div className="absolute inset-0 grid place-items-center p-8">
				<p className="label-caps max-w-sm text-center text-muted-foreground">
					This browser cannot draw the globe (WebGL is unavailable). The feed
					and panels still work.
				</p>
			</div>
		);
	}

	const style = globeStyle;

	return (
		<Canvas
			className="absolute! inset-0"
			flat
			dpr={[1, 2]}
			gl={{ antialias: true, alpha: true }}
			camera={{ fov: 38, near: 0.01, far: 50, position: INITIAL_CAMERA }}
		>
			<CameraRig reducedMotion={reducedMotion} />
			<GlobeSurface
				style={style}
				landMask={atlas?.landMask ?? null}
				onClickEmpty={() => select(null)}
			/>
			{atlas && (
				<>
					<GeoLines segments={atlas.graticule} style={style.graticule} />
					<GeoLines segments={atlas.borders} style={style.borders} />
					<GeoLines segments={atlas.coastlines} style={style.coastline} />
				</>
			)}
			<PointsLayer
				view={view}
				events={events}
				style={style}
				reducedMotion={reducedMotion}
			/>
		</Canvas>
	);
}
