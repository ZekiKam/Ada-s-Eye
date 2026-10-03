# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Ada's Eye**, an AdaHack 2026 hackathon entry (submission deadline 18:15 on 3 Oct 2026). It is one interactive 3D globe with three switchable views. Each view answers a different sponsor challenge and gets its data from its own backend:

| View id | Challenge | Folder | Port | Path prefix | Worker variable |
| --- | --- | --- | --- | --- | --- |
| `compsoc` (primary) | Environmental disasters and anomalies | `backend-compsoc/` | 8001 | `/api/compsoc/*` | `BACKEND_COMPSOC_URL` |
| `optiver` | 100,000 tCO2e carbon-credit portfolio | `backend-optiver/` | 8002 | `/api/optiver/*` | `BACKEND_OPTIVER_URL` |
| `gresearch` | Financial performance vs environmental impact | `backend-gresearch/` | 8003 | `/api/gresearch/*` | `BACKEND_GRESEARCH_URL` |

[docs/PRD.md](docs/PRD.md) is the spec and is binding. Sections 3, 4 and 5 apply to every package. Sections 6 and 7 cover the frontend, and section 8 covers the backends. Read the sections for your package before building anything.

**Current state vs plan.** Only `frontend/` exists so far. It is a scaffold, and its Worker still proxies all of `/api/*` to a single `BACKEND_URL`. The `backend-*/` folders, the three-way Worker proxy, Orval client generation and the globe are all planned (PRD section 11 gives the build order). Check what is actually on disk before assuming any planned piece exists.

## Ownership rules (prevent merge conflicts between parallel sessions)

1. One owner per folder. A session edits files inside its own folder only.
2. Root files are changed only by agreement.
3. The frontend reads, and never writes, `backend-*/openapi.json` and `backend-*/fixtures/snapshot.json`.
4. Backends never import from each other. If one backend needs another's data, it calls that backend over HTTP.
5. Generated code is never committed (`frontend/src/api/generated/`, `frontend/src/fixtures/generated/`).
6. `app/contract.py` is byte-identical in all three backends, and `backend-compsoc/app/contract.py` is the canonical copy. To change it, get the owners' agreement, update all three copies in one commit, and bump `CONTRACT_VERSION`. Backend-specific models go in `app/models.py` and `app/routes.py`.
7. Commit small changes to `main` and run `git pull --rebase` before pushing.

Product rule from the judging criteria: no language models or other large models anywhere in the product. Backends stay light on dependencies and use classical methods.

## Commands

Every command must be a single line that works in PowerShell, bash and zsh. Development happens on Windows, so don't add bash-only scripts.

| What | Folder | Command |
| --- | --- | --- |
| Frontend dev (Vite + Worker in workerd) | `frontend/` | `bun install`, then `bun run dev` |
| Frontend typecheck + build / lint / format | `frontend/` | `bun run build` / `bun run lint` / `bun run format` |
| Backend dev | `backend-<view>/` | `uv sync`, then `uv run fastapi dev app/main.py --port <port>` |
| Backend tests | `backend-<view>/` | `uv run pytest` (one test: `uv run pytest tests/test_smoke.py::<name>`) |
| Export OpenAPI + fixture | `backend-<view>/` | `uv run python -m app.export` |
| Regenerate frontend clients (planned) | `frontend/` | `bun run sync` |

Before running `bun run dev`, copy `frontend/.dev.vars.example` to `frontend/.dev.vars`. The frontend has no test runner. More frontend commands are in [frontend/CLAUDE.md](frontend/CLAUDE.md).

## Architecture

```text
Browser (React SPA)  --GET /api/<view>/...  same origin, no CORS-->
Cloudflare Worker (frontend/worker/index.ts)  picks the upstream by prefix, adds X-Backend-Secret
  --> Cloudflare Tunnel --> laptop running three FastAPI apps on localhost:8001-8003
```

- **The Worker forwards path and query unchanged** and keeps the `/api/<view>` prefix. That's why every FastAPI app mounts its routes under `/api/<view>` and why its OpenAPI paths match browser paths. When `BACKEND_SECRET` is set, backends reject requests without a matching `X-Backend-Secret` (401).
- **Shared contract v1** (PRD section 4). Every backend exposes the same four endpoints: `get_health`, `get_snapshot`, `get_feature` and `get_field_png`. These function names are fixed because they become the generated client names. One `Snapshot` response (KPIs, layers, feed, sources, `is_mock`) carries everything a view draws. Layers form a discriminated union on `kind` (`points` / `arcs` / `regions` / `field`). Backends send semantic `tone` and `colormap` values, never colours.
- **Contract automation** (PRD section 5). Backends commit `openapi.json` and `fixtures/snapshot.json`, both produced by `app.export`. The frontend's `bun run sync` runs Orval on those files to generate typed react-query clients and copies the fixtures in as offline fallbacks. When a backend schema changes, the frontend sees it as a `tsc -b` error. After changing a route or model, re-export and commit both files in the same change.
- **Frontend internals:** see [frontend/CLAUDE.md](frontend/CLAUDE.md), which covers the Worker, TS project references, TanStack file routes, Tailwind v4 tokens, shadcn and Biome. Update that file when the frontend architecture changes, for example when the three-way proxy replaces `BACKEND_URL`.
