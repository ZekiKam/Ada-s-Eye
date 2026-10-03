/**
 * `bun run sync`: generate the typed API client from the backend.
 *
 * 1. Checks the backend has committed its openapi.json.
 * 2. Runs Orval (orval.config.ts) into src/api/generated/.
 * 3. Copies the backend's fixtures/snapshot.json, when present, into
 *    src/fixtures/generated/snapshot.json for offline fallback.
 *
 * Not yet chained into `dev` or `build`: the backend schema is still
 * changing. Chain it in package.json once it settles.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(frontend, "..", "backend-compsoc");

if (!existsSync(join(backend, "openapi.json"))) {
	console.error(
		"sync: missing backend-compsoc/openapi.json.\n" +
			"Run `uv run python -m app.export` there and commit the result.",
	);
	process.exit(1);
}

const orval = spawnSync("bunx", ["orval", "--config", "orval.config.ts"], {
	cwd: frontend,
	stdio: "inherit",
	shell: process.platform === "win32",
});
if (orval.status !== 0) process.exit(orval.status ?? 1);

const source = join(backend, "fixtures", "snapshot.json");
if (existsSync(source)) {
	const fixtures = join(frontend, "src", "fixtures", "generated");
	mkdirSync(fixtures, { recursive: true });
	copyFileSync(source, join(fixtures, "snapshot.json"));
} else {
	console.warn("sync: no fixture in backend-compsoc, skipping");
}

console.log("sync: client generated");
