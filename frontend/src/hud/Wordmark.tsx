import { useId } from "react";

const EYE_OUTLINE = "M1 10C6 2.5 26 2.5 31 10C26 17.5 6 17.5 1 10Z";

/** Lids open from the eye's centre (viewBox units). */
const LID = "origin-[16px_10px] animate-eye-open motion-reduce:animate-none";

export function Wordmark() {
	const clipId = useId();
	return (
		<h1 className="pointer-events-auto flex flex-col items-center font-display text-4xl leading-none tracking-wide uppercase">
			<svg
				aria-hidden
				viewBox="0 0 32 20"
				className="h-9 w-auto"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			>
				<defs>
					{/* Opens with the lids, so the iris shows through as they part. */}
					<clipPath id={clipId}>
						<path d={EYE_OUTLINE} className={LID} />
					</clipPath>
				</defs>
				<path d={EYE_OUTLINE} className={LID} />
				<g clipPath={`url(#${clipId})`}>
					<circle cx="16" cy="10" r="5" />
					<circle cx="16" cy="10" r="1.8" fill="currentColor" />
				</g>
			</svg>
			Ada's Eye
		</h1>
	);
}
