# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AdaHack 2026 hackathon submission: a React SPA served by a Cloudflare Worker. Package manager is **bun**.

## Commands

- `bun run dev` — Vite dev server; runs the Worker in the local `workerd` runtime alongside the frontend
- `bun run build` — `tsc -b` typecheck across all three tsconfig projects, then `vite build`
- `bun run lint` — Biome lint + format check (not ESLint/Prettier)
- `bun run format` — apply Biome formatting, safe lint fixes, and import sorting
- `bun run deploy` — build and `wrangler deploy`
- `bun run cf-typegen` — regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`

There is no test runner set up.

## Architecture

**One deployable, two runtimes.** `@cloudflare/vite-plugin` builds the browser app (`src/`) and the Worker (`worker/index.ts`) together. Wrangler serves static assets first. `assets.not_found_handling: "single-page-application"` sends unknown paths to `index.html` so client-side routes resolve. `run_worker_first: ["/api/*"]` sends all API traffic to the Worker, even for browser navigations.

**Backend lives off-Cloudflare.** The Worker does not implement the API. `worker/index.ts` proxies `/api/*` unchanged (the `/api` prefix is kept) to `BACKEND_URL`, which is a separate backend running on a team member's PC and exposed through a named Cloudflare Tunnel (`cloudflared`). If `BACKEND_SECRET` is set, it is sent as an `X-Backend-Secret` header so the backend can reject requests that skip the Worker. When the backend can't be reached, the Worker returns 502. In production `BACKEND_URL` comes from `vars` in `wrangler.jsonc` and `BACKEND_SECRET` is a Wrangler secret. Locally both come from `.dev.vars` (gitignored; copy from `.dev.vars.example`). Rerun `bun run cf-typegen` after changing either.

**TypeScript project references.** `tsconfig.json` references three separate projects with different globals:
- `tsconfig.app.json` covers `src/` (DOM + `vite/client`)
- `tsconfig.worker.json` covers `worker/` (Cloudflare types from `worker-configuration.d.ts`, no DOM)
- `tsconfig.node.json` covers `vite.config.ts`

Code in `src/` cannot import Worker types and vice versa. Shared types would need a location included by both.

**Routing (TanStack Router, file-based).** `@tanstack/router-plugin` in `vite.config.ts` must stay before `react()`. It watches `src/routes/` and regenerates `src/routeTree.gen.ts`, which is generated and must not be hand-edited. `src/routes/__root.tsx` is the layout shell and renders `<Outlet />`. Each other file exports `Route = createFileRoute('<path>')(...)`. `autoCodeSplitting` is on, so route components are lazy-loaded per route. `src/App.tsx` creates the router and registers its type for type-safe links.

**Styling.** Tailwind CSS v4 via `@tailwindcss/vite`. There is no `tailwind.config.js`. The only stylesheet is `src/index.css`, which holds the theme as CSS variables (`:root` for light, `.dark` for dark), mapped to Tailwind utilities in `@theme inline`. Change colors, radius and fonts there instead of hard-coding values in components.

**UI components (shadcn/ui).** Config is in `components.json`: the `radix-nova` style, the Radix UI base (the single `radix-ui` package), Lucide icons and the Geist font. Add components with `bunx shadcn@latest add <name>`, which copies the source into `src/components/ui/`. Those files are ours to edit. Run `bun run format` after adding components, because the CLI writes them in its own style. Merge class names with `cn()` from `@/lib/utils` (re-exported from the `cn` package, shadcn's replacement for clsx + tailwind-merge). Use `@/` imports for anything under `src/` (aliased in both tsconfig and `vite.config.ts`).

**Lint/format config.** `biome.json` uses Biome defaults (tabs, double quotes, recommended rules), has Tailwind CSS directive parsing enabled, and excludes generated files (`src/routeTree.gen.ts`, `worker-configuration.d.ts`).
