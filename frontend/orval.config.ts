import { defineConfig } from "orval";

/**
 * A typed react-query client generated from the backend's committed
 * openapi.json by `bun run sync`. Output is gitignored.
 *
 * No base URL is set: spec paths already start with /api, which is what the
 * browser requests and the Worker forwards unchanged.
 */
export default defineConfig({
	compsoc: {
		input: { target: "../backend-compsoc/openapi.json" },
		output: {
			target: "src/api/generated/index.ts",
			schemas: "src/api/generated/model",
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
});
