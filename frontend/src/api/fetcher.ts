/**
 * Orval mutator: every generated client call goes through `customFetch`.
 *
 * URLs are relative (`/api/...`), so requests stay same-origin and the
 * Worker proxies them to the backend. Times out after 9 seconds, one
 * more than the Worker allows for the upstream.
 */

const TIMEOUT_MS = 9_000;

export class ApiError extends Error {
	readonly status: number;
	readonly url: string;

	constructor(status: number, url: string, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.url = url;
	}
}

export async function customFetch<T>(
	url: string,
	options: RequestInit = {},
): Promise<T> {
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	const signal = options.signal
		? AbortSignal.any([options.signal, timeout])
		: timeout;

	const response = await fetch(url, { ...options, signal });
	if (!response.ok) {
		let message = `${response.status} ${response.statusText}`;
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) message = body.error;
		} catch {
			// Body was not JSON; keep the status line.
		}
		throw new ApiError(response.status, url, message);
	}

	if (response.status === 204) return undefined as T;
	const type = response.headers.get("content-type") ?? "";
	return (type.includes("json") ? response.json() : response.text()) as T;
}

export default customFetch;
