export default {
	fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname.startsWith("/api/")) {
			return proxyToBackend(request, env);
		}
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// Forwards the request, path and query unchanged, to the backend reached via
// Cloudflare Tunnel (BACKEND_URL). BACKEND_SECRET, when set, is sent as a
// header so the backend can reject requests that bypass the Worker.
async function proxyToBackend(request: Request, env: Env) {
	if (!env.BACKEND_URL) {
		return Response.json(
			{ error: "BACKEND_URL is not configured" },
			{ status: 500 },
		);
	}

	const { pathname, search } = new URL(request.url);
	const target = new URL(pathname + search, env.BACKEND_URL);

	const proxied = new Request(target, request);
	if (env.BACKEND_SECRET) {
		proxied.headers.set("X-Backend-Secret", env.BACKEND_SECRET);
	}

	try {
		return await fetch(proxied);
	} catch {
		return Response.json({ error: "Backend unreachable" }, { status: 502 });
	}
}
