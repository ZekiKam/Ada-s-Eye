/**
 * `bun run sync`: regenerate the typed API client from the backend.
 *
 * 1. Imports the FastAPI app in backend-compsoc (using its existing .venv,
 *    without syncing it or writing bytecode, so the backend folder is left
 *    untouched) and writes its OpenAPI spec to frontend/openapi.json.
 * 2. Runs Orval (orval.config.ts) on that spec into src/api/generated/.
 *
 * Both outputs are committed, so building the frontend never needs Python.
 * Rerun this whenever the backend's routes or schemas change.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendSrc = join(frontend, "..", "backend-compsoc", "src");

const EXPORT_SPEC = [
	"import json, sys",
	"from main import app",
	"sys.stdout.write(json.dumps(app.openapi(), indent=2) + '\\n')",
].join("\n");

const spec = spawnSync(
	"uv",
	["run", "--no-sync", "python", "-B", "-c", EXPORT_SPEC],
	{ cwd: backendSrc, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (spec.status !== 0) {
	console.error(
		"sync: could not export the OpenAPI spec from backend-compsoc.\n" +
			"Check that `uv sync` has been run there and that src/main.py imports.",
	);
	process.exit(spec.status ?? 1);
}
writeFileSync(join(frontend, "openapi.json"), spec.stdout);

const orval = spawnSync("bunx", ["orval", "--config", "orval.config.ts"], {
	cwd: frontend,
	stdio: "inherit",
	shell: process.platform === "win32",
});
if (orval.status !== 0) process.exit(orval.status ?? 1);

console.log("sync: client generated");
