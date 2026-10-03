const UPSTREAM_TIMEOUT_MS = 8_000;

export default {
	fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname.startsWith("/api/")) {
			return proxyToBackend(request, env);
		}
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// Forwards /api/* to the backend (reached via Cloudflare Tunnel), with path
// and query unchanged. BACKEND_SECRET, when set, is sent as a header so the
// backend can reject requests that bypass the Worker.
async function proxyToBackend(request: Request, env: Env) {
	const { pathname, search } = new URL(request.url);
	if (!env.BACKEND_URL) {
		return Response.json(
			{ error: "BACKEND_URL is not configured" },
			{ status: 500 },
		);
	}

	const proxied = new Request(
		new URL(pathname + search, env.BACKEND_URL),
		request,
	);
	if (env.BACKEND_SECRET) {
		proxied.headers.set("X-Backend-Secret", env.BACKEND_SECRET);
	}

	try {
		return await fetch(proxied, {
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === "TimeoutError") {
			return Response.json({ error: "Backend timed out" }, { status: 504 });
		}
		return Response.json({ error: "Backend unreachable" }, { status: 502 });
	}
}
