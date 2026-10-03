import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import type { GlobePoint } from "@/api/generated/model";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useGlobeStore } from "@/state/store";
import { globeStyle } from "@/theme/globe-style";
import { CameraRig, FOV } from "./CameraRig";
import { GeoLines } from "./GeoLines";
import { GlobeSurface } from "./GlobeSurface";
import { type Atlas, loadAtlas, lonLatToVector3, paintCountries } from "./geo";
import { CountryLabels } from "./layers/CountryLabels";
import { PointsLayer } from "./layers/PointsLayer";
import { Stars } from "./Stars";

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
	/** Events to draw, already filtered to the visible categories. */
	events: readonly GlobePoint[];
}

export function GlobeCanvas({ events }: GlobeCanvasProps) {
	const [webgl] = useState(hasWebGL);
	const [atlas, setAtlas] = useState<Atlas | null>(null);
	const reducedMotion = usePrefersReducedMotion();
	const select = useGlobeStore((s) => s.select);
	const style = globeStyle;
	const countryMap = useMemo(
		() => (atlas ? paintCountries(atlas.countries, style.countryColors) : null),
		[atlas],
	);

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
					This browser cannot draw the globe (WebGL is unavailable).
				</p>
			</div>
		);
	}

	return (
		<Canvas
			// The page fades the globe in; land and lines then fade in once the atlas loads.
			// No text selection or iOS callout when a finger long-presses a point.
			className="absolute! inset-0 select-none [-webkit-touch-callout:none]"
			flat
			dpr={[1, 2]}
			gl={{ antialias: true, alpha: true }}
			camera={{ fov: FOV, near: 0.01, far: 50, position: INITIAL_CAMERA }}
			// A tap on space clears the selection, as a tap on the globe does.
			onPointerMissed={() => select(null)}
		>
			<CameraRig reducedMotion={reducedMotion} />
			<Stars style={style.stars} reducedMotion={reducedMotion} />
			<GlobeSurface
				style={style}
				landMask={atlas?.landMask ?? null}
				countryMap={countryMap}
				onClickEmpty={() => select(null)}
			/>
			{atlas && (
				<>
					<GeoLines
						segments={atlas.graticule}
						style={style.graticule}
						revealMs={style.revealMs}
					/>
					<GeoLines
						segments={atlas.borders}
						style={style.borders}
						revealMs={style.revealMs}
					/>
					<GeoLines
						segments={atlas.coastlines}
						style={style.coastline}
						revealMs={style.revealMs}
					/>
					<CountryLabels
						labels={atlas.labels}
						style={style.labels}
						revealMs={style.revealMs}
					/>
				</>
			)}
			<PointsLayer
				events={events}
				style={style}
				reducedMotion={reducedMotion}
			/>
		</Canvas>
	);
}
