/**
 * `bun run sync`: generate the typed API clients from the backends.
 *
 * 1. Checks every backend has committed its openapi.json, naming any missing.
 * 2. Runs Orval (orval.config.ts) into src/api/generated/.
 * 3. Copies each backend's fixtures/snapshot.json, when present, into
 *    src/fixtures/generated/<view>.json for offline fallback.
 *
 * Not yet chained into `dev` or `build`: the backend schemas are still
 * changing. Chain it in package.json once they settle.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIEWS = ["compsoc", "optiver", "gresearch"] as const;

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(frontend, "..");

const missing = VIEWS.filter(
	(view) => !existsSync(join(repo, `backend-${view}`, "openapi.json")),
);
if (missing.length > 0) {
	console.error(
		`sync: missing openapi.json for ${missing.map((v) => `backend-${v}`).join(", ")}.\n` +
			"Run `uv run python -m app.export` in each and commit the result.",
	);
	process.exit(1);
}

const orval = spawnSync("bunx", ["orval", "--config", "orval.config.ts"], {
	cwd: frontend,
	stdio: "inherit",
	shell: process.platform === "win32",
});
if (orval.status !== 0) process.exit(orval.status ?? 1);

const fixtures = join(frontend, "src", "fixtures", "generated");
mkdirSync(fixtures, { recursive: true });
for (const view of VIEWS) {
	const source = join(repo, `backend-${view}`, "fixtures", "snapshot.json");
	if (existsSync(source)) {
		copyFileSync(source, join(fixtures, `${view}.json`));
	} else {
		console.warn(`sync: no fixture for backend-${view}, skipping`);
	}
}

console.log("sync: clients generated");
