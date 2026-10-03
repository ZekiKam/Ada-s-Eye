# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ada's Eye frontend (AdaHack 2026): a React SPA served by a Cloudflare Worker. One full-viewport stylised globe with a HUD, showing CompSoc's Anomaly Watch. Package manager is **bun**. `../docs/PRD.md` sections 6 and 7 are the spec.

## Commands

- `bun run dev`: Vite dev server. Runs the Worker in the local `workerd` runtime alongside the frontend
- `bun run build`: `tsc -b` typecheck across all three tsconfig projects, then `vite build`
- `bun run lint`: Biome lint + format check (not ESLint/Prettier)
- `bun run format`: apply Biome formatting, safe lint fixes, and import sorting
- `bun run deploy`: build and `wrangler deploy`
- `bun run cf-typegen`: regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`
- `bun run sync`: export the OpenAPI spec from `../backend-compsoc` (imports its FastAPI app with its existing `.venv`, writing nothing there) to `openapi.json`, then generate the Orval client into `src/api/generated/`. Both are committed, so building never needs Python. Rerun after any backend route or schema change.

There is no test runner set up.

## Architecture

**One deployable, two runtimes.** `@cloudflare/vite-plugin` builds the browser app (`src/`) and the Worker (`worker/index.ts`) together. Wrangler serves static assets first. `assets.not_found_handling: "single-page-application"` sends unknown paths to `index.html` so client-side routes resolve. `run_worker_first: ["/api/*"]` sends all API traffic to the Worker, even for browser navigations.

**Proxy.** The Worker does not implement the API. `worker/index.ts` forwards `/api/*`, path and query unchanged, to `BACKEND_URL` (`backend-compsoc`, on a team member's PC behind a named Cloudflare Tunnel). If `BACKEND_SECRET` is set, it is sent as `X-Backend-Secret`. The Worker's own errors are JSON `{ "error": "..." }`: 500 for a missing `BACKEND_URL`, 502 when unreachable, 504 after 8 seconds. In production `BACKEND_URL` comes from `vars` in `wrangler.jsonc` and `BACKEND_SECRET` is a Wrangler secret. Locally both come from `.dev.vars` (gitignored, copy from `.dev.vars.example`). Rerun `bun run cf-typegen` after changing them.

**Data.** Types and fetch functions come from the Orval client in `src/api/generated/` (react-query hooks, every call through `customFetch` in `src/api/fetcher.ts`, which throws `ApiError` with the Worker's `error` or FastAPI's `detail` as the message). Never edit the generated files; change the backend and rerun `bun run sync`. `GET /api/get_all_points` returns every `GlobePoint` (`longitude`, `latitude`, `event_time` as an ISO 8601 string, `radius` in metres): past wildfires. `main.tsx` prefetches it on page load with `allPointsQuery` (never stale, fetched once per session), and `useEvents(year)` in `src/data/useEvents.ts` filters it to one UTC calendar year. With no data, nothing is drawn. `POST /api/request_anomaly` takes a `RequestAnomaly` (`longitude`, `latitude`, `event_time`) and returns an `Anomaly` (`longitude`, `latitude`, `confidence`, `radius`); the backend stub answers 501 for now. Points have no id field, so `eventKey()` in `src/data/events.ts` derives one. Every point is drawn as `WILDFIRE` (label and tone) from the same file.

**State.** The `?year=` search param (`FIRST_YEAR`–`LAST_YEAR` in `src/config.ts`, default the last) is validated in `src/routes/index.tsx` and driven by the `Timeline` scrubber. The zustand store (`src/state/store.ts`) holds the selected point (and its key), the hovered key, and fly-to requests.

**Selection.** Double-click a marker, or long-press it on touch (`LONG_PRESS_MS`, `globe/useLongPress.ts`; moving the finger cancels), to select it and fly to it. A single click on a marker does nothing. Clicking empty globe or space, changing year, or Escape clears the selection. While a point is selected, `hud/AnomalyQuery` shows a button above the timeline that sends a `RequestAnomaly` for it and shows the pending, error or result state.

**Globe (`src/globe/`).** Plain three.js through `@react-three/fiber` and drei (no `r3f-globe`). `GlobeSurface` is one `ShaderMaterial` (`shaders/surface.ts`): land mask, toon bands, halftone, ink rim, grain. `geo.ts` fetches Natural Earth 50 m TopoJSON from `world-atlas` (as `?url` assets), rasterises a 4096×2048 land mask with d3-geo, and builds coastline/border/graticule segments drawn by `GeoLines` as screen-width `LineSegments2`. `lonLatToVector3` matches `SphereGeometry` UVs. `layers/PointsLayer` draws a constant-screen-size marker plus a true-scale footprint ring per event, pulses events under 15 minutes old, and shows a drei `<Html>` tooltip on hover (on touch, for the selected point). `CameraRig` wraps `OrbitControls` (no pan, zoom 1.15–4 radii), idle auto-rotation after 10 s, and `flyTo`. `prefers-reduced-motion` disables pulses, rotation and flight animation.

**Theme.** No colour, font or shader constant lives in a component. `src/index.css` holds interface tokens and the nine `--tone-*` colours (hex, so three.js can read them via `theme/tones.ts`). `theme/globe-style.ts` holds the globe presets: change `ACTIVE_PRESET` between `engraving` and `plain` to restyle the globe. Custom utilities: `label-caps`, `focus-ring`, `engraved` (the globe's halftone and grain for a HUD surface). Fonts: Antonio (display), Geist Mono (labels), Geist (body), all via Fontsource.

**TypeScript project references.** `tsconfig.json` references three separate projects with different globals:
- `tsconfig.app.json` covers `src/` (DOM + `vite/client`)
- `tsconfig.worker.json` covers `worker/` (Cloudflare types from `worker-configuration.d.ts`, no DOM)
- `tsconfig.node.json` covers `vite.config.ts`, `orval.config.ts` and `scripts/`

Code in `src/` cannot import Worker types and vice versa. Shared types would need a location included by both.

**Routing (TanStack Router, file-based).** `@tanstack/router-plugin` in `vite.config.ts` must stay before `react()`. It watches `src/routes/` and regenerates `src/routeTree.gen.ts`, which is generated and must not be hand-edited. `src/routes/__root.tsx` is the layout shell and renders `<Outlet />`. Each other file exports `Route = createFileRoute('<path>')(...)`. `autoCodeSplitting` is on, so route components are lazy-loaded per route. `src/App.tsx` creates the router and registers its type for type-safe links.

**Styling.** Tailwind CSS v4 via `@tailwindcss/vite`. There is no `tailwind.config.js`. The only stylesheet is `src/index.css`, mapped to Tailwind utilities in `@theme inline`. There is one theme (no dark variant).

**UI components (shadcn/ui).** Config is in `components.json`: the `radix-nova` style, the Radix UI base (the single `radix-ui` package), Lucide icons. Add components with `bunx shadcn@latest add <name>`, which copies the source into `src/components/ui/`. Those files are ours to edit. Run `bun run format` after adding components. Merge class names with `cn()` from `@/lib/utils`. Use `@/` imports for anything under `src/`.

**Lint/format config.** `biome.json` uses Biome defaults (tabs, double quotes, recommended rules), has Tailwind CSS directive parsing enabled, and excludes generated files (`src/routeTree.gen.ts`, `worker-configuration.d.ts`, `src/api/generated`, `openapi.json`). `a11y/noStaticElementInteractions` is off for `src/globe/**`, because it misfires on three.js elements.
