import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: Outlet,
	notFoundComponent: NotFound,
});

function NotFound() {
	return (
		<main className="grid h-dvh place-items-center">
			<div className="flex flex-col items-center gap-4">
				<h1 className="font-display text-6xl uppercase">404</h1>
				<Link
					to="/"
					className="focus-ring label-caps border border-border px-3 py-2"
				>
					Back to the globe
				</Link>
			</div>
		</main>
	);
}
