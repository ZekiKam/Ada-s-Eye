import { defineConfig } from "orval";

/**
 * One typed react-query client per backend, generated from each backend's
 * committed openapi.json by `bun run sync`. Output is gitignored.
 *
 * No base URL is set: spec paths already start with /api/<view>, which is
 * what the browser requests and the Worker forwards unchanged.
 */
const VIEWS = ["compsoc", "optiver", "gresearch"] as const;

export default defineConfig(
	Object.fromEntries(
		VIEWS.map((view) => [
			view,
			{
				input: { target: `../backend-${view}/openapi.json` },
				output: {
					target: `src/api/generated/${view}/index.ts`,
					schemas: `src/api/generated/${view}/model`,
					client: "react-query",
					httpClient: "fetch",
					mode: "split",
					clean: true,
					override: {
						mutator: { path: "src/api/fetcher.ts", name: "customFetch" },
						fetch: { includeHttpResponseReturnType: false },
					},
				},
			},
		]),
	),
);
