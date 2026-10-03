const UPSTREAM_TIMEOUT_MS = 8_000;

/** Path prefix to the Worker variable holding that view's backend URL. */
const UPSTREAMS = {
	compsoc: "BACKEND_COMPSOC_URL",
	optiver: "BACKEND_OPTIVER_URL",
	gresearch: "BACKEND_GRESEARCH_URL",
} as const satisfies Record<string, keyof Env>;

type ViewId = keyof typeof UPSTREAMS;

export default {
	fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname.startsWith("/api/")) {
			return proxyToBackend(request, env);
		}
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;

function isViewId(value: string): value is ViewId {
	return Object.hasOwn(UPSTREAMS, value);
}

// Forwards /api/<view>/* to that view's backend (reached via Cloudflare
// Tunnel), with path and query unchanged. BACKEND_SECRET, when set, is sent
// as a header so backends can reject requests that bypass the Worker.
async function proxyToBackend(request: Request, env: Env) {
	const { pathname, search } = new URL(request.url);
	const view = pathname.split("/")[2] ?? "";
	if (!isViewId(view)) {
		return Response.json({ error: `Unknown view: ${view}` }, { status: 404 });
	}

	const variable = UPSTREAMS[view];
	const base = env[variable];
	if (!base) {
		return Response.json(
			{ error: `${variable} is not configured` },
			{ status: 500 },
		);
	}

	const proxied = new Request(new URL(pathname + search, base), request);
	if (env.BACKEND_SECRET) {
		proxied.headers.set("X-Backend-Secret", env.BACKEND_SECRET);
	}

	try {
		return await fetch(proxied, {
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === "TimeoutError") {
			return Response.json(
				{ error: `Backend ${view} timed out` },
				{ status: 504 },
			);
		}
		return Response.json(
			{ error: `Backend ${view} unreachable` },
			{ status: 502 },
		);
	}
}
