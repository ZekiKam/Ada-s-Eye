import type { ReactNode } from "react";

/** Flat, square, hairline-bordered HUD panel with a mono caps heading. */
export function Panel({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="pointer-events-auto flex min-h-0 flex-col border border-border bg-panel">
			<header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
				<h2 className="label-caps">{title}</h2>
			</header>
			{children}
		</section>
	);
}
