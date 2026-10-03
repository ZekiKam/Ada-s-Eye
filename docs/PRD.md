# Ada's Eye — MVP PRD

Oct 3, 2026 · @Rory

## 1. Summary and scope

Ada's Eye is one interactive globe with three switchable views, each fed by its own backend, built for AdaHack 2026. This build delivers a fully working frontend plus three backend skeletons that serve mock data through one shared contract.

| View id | Challenge | Priority | What the globe shows (mock data for now) |
| --- | --- | --- | --- |
| `compsoc` | CompSoc: identify environmental disasters and anomalies | Primary | Detected events as markers with true-scale footprints, over a temperature-anomaly field |
| `optiver` | Optiver: a 100,000 tCO2e carbon-credit portfolio that survives the unexpected | Secondary | Carbon-credit projects by country, with portfolio headline numbers |
| `gresearch` | G-Research: balance financial performance and environmental impact | Tertiary | Countries shaded by grid carbon intensity, with a company's sites on top |

The views share one idea: a detected event near a carbon project raises that project's failure risk. That link is computed inside `backend-optiver` later and is mocked in this build.

**In scope**

- Frontend MVP: stylised rotatable globe, view switcher, layer toggles, feed, detail panel, time window, 10-second polling, offline fallback.
- Worker change: route `/api/<view>/*` to three backends instead of one.
- Three FastAPI skeletons serving deterministic mock data through contract v1.
- OpenAPI export and Orval client generation, wired into dev and build.

**Out of scope (each owner defines these later)**

- Real data ingestion and detection logic. Candidates are documented in the appendix.
- Portfolio optimisation and footprint modelling.
- Bespoke per-view panels. A slot is reserved for each.
- Stacking layers from different backends. The contract allows it later.
- Phone layout, authentication beyond the shared secret, tests beyond smoke tests.

Priority tags used below: **P0** must ship for the MVP, **P1** should ship, **P2** only if time allows.

**Using this document.** Export it to `PRD.md` at the repo root. Every Claude Code session reads all of it and builds only its own package: sections 6 and 7 for the frontend, section 8 for a backend. Sections 3, 4 and 5 bind everyone.

## 2. Constraints

The build must be demo-ready by the 18:15 submission deadline on 3 October 2026, with judging from 18:30.

| Constraint | Detail | Consequence for this build |
| --- | --- | --- |
| Deadline | Submission 18:15, first judging round 18:30 | Follow the build order in section 11. Anything not P0 is cut first. |
| Judging (60 points) | Project quality 20. Teamwork, originality, theme and presentation 10 each. | The globe and the CompSoc view get polish first. Every owner must be able to explain how their part works. |
| AI rule | Judges may deduct points if they suspect reliance on AI. Use is discouraged, not banned. | No language models or other large models anywhere in the product. Modules stay small and readable. |
| CompSoc bonus | Small compute, classical methods, runs on a laptop or Raspberry Pi, results checked against a baseline | Backends stay light on dependencies. The contract carries method, evidence and baseline fields. |
| Workers Free plan | 100,000 requests per day, reset at midnight UTC ([Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/), read 3 Oct 2026) | One polled request per active view every 10 seconds. Polling stops while the tab is hidden. |
| Hosting | Frontend on Cloudflare Workers. Backends on one laptop behind a Cloudflare Tunnel. | The interface must survive a dropped tunnel (section 6, offline behaviour). |
| Mock data | Everything served in this build is fake | The interface shows a visible MOCK tag whenever a snapshot has `is_mock: true`. |

Request budget: one request every 10 seconds is 360 per hour per open tab, so the daily limit covers about 277 tab-hours. Only `/api/*` requests run Worker code. The interval lives in one config value (`VITE_POLL_INTERVAL_MS`, default `10000`).

## 3. Architecture and repo layout

The browser only talks to its own origin. The Worker forwards each `/api/<view>/*` request to that view's backend through a Cloudflare Tunnel.

```text
Browser (React SPA, served as static assets)
   |  GET /api/<view>/...        same origin, so no CORS anywhere
   v
Cloudflare Worker   frontend/worker/index.ts
   |  picks the upstream by path prefix, adds X-Backend-Secret
   v
Cloudflare Tunnel   one named tunnel, three hostnames
   v
Laptop              three FastAPI apps on localhost:8001, 8002, 8003
```

| Path prefix | Worker variable | Local value (`.dev.vars`) | Deployed value (placeholder) | Folder | Port |
| --- | --- | --- | --- | --- | --- |
| `/api/compsoc/*` | `BACKEND_COMPSOC_URL` | `http://localhost:8001` | `https://compsoc-api.YOUR-DOMAIN.com` | `backend-compsoc` | 8001 |
| `/api/optiver/*` | `BACKEND_OPTIVER_URL` | `http://localhost:8002` | `https://optiver-api.YOUR-DOMAIN.com` | `backend-optiver` | 8002 |
| `/api/gresearch/*` | `BACKEND_GRESEARCH_URL` | `http://localhost:8003` | `https://gresearch-api.YOUR-DOMAIN.com` | `backend-gresearch` | 8003 |

**Worker rules (P0).** These replace the current single `BACKEND_URL` proxy in `frontend/worker/index.ts`.

- Forward path and query unchanged. The `/api/<view>` prefix is kept, so every FastAPI app mounts its routes under `/api/<view>` and the OpenAPI paths equal the browser paths.
- Keep `BACKEND_SECRET`: when set, send it as `X-Backend-Secret`.
- Abort the upstream fetch after 8 seconds.
- Responses the Worker itself produces are JSON `{ "error": "..." }`: 404 for an unknown prefix, 500 for a missing variable, 502 when unreachable, 504 on timeout.
- Update `wrangler.jsonc` vars and `.dev.vars.example`, remove `BACKEND_URL`, run `bun run cf-typegen`, and update the proxy paragraph in `frontend/CLAUDE.md`.

```text
/
├── PRD.md                 this document, exported as Markdown
├── CLAUDE.md              root rules: ownership, contract, commands
├── README.md              how to run everything
├── .gitignore
├── frontend/              existing scaffold, extended by this PRD
├── backend-compsoc/       port 8001
├── backend-optiver/       port 8002
└── backend-gresearch/     port 8003
```

**Ownership rules.** These exist to prevent merge conflicts between four parallel sessions.

1. One owner per folder. A session edits files inside its own folder only.
2. Root files are written once by the frontend owner in the first commit, then changed only by agreement.
3. The frontend reads, and never writes, `backend-*/openapi.json` and `backend-*/fixtures/snapshot.json`.
4. Backends never import from each other. If one needs another's data later, it calls that backend over HTTP.
5. Generated code is never committed (section 5).
6. `app/contract.py` is byte-identical in all three backends. Nobody edits one copy alone (section 4).
7. Everyone commits small changes to `main` and runs `git pull --rebase` before pushing. Folders are disjoint, so rebases stay clean.

The root `CLAUDE.md` restates rules 1 to 7, the routing table and the commands in section 9. Each backend folder gets its own short `CLAUDE.md` naming its port, prefix and owner scope.

## 4. API contract v1

Every backend exposes the same four endpoints under its own prefix, and one `Snapshot` response carries everything a view draws.

**Conventions**

- JSON with snake\_case names.
- Times are UNIX timestamps in whole seconds, UTC.
- Coordinates are WGS84 decimal degrees: `longitude` from -180 to 180, `latitude` from -90 to 90.
- Distances are metres. Countries are ISO 3166-1 alpha-3 codes such as `GBR`.
- Feature and layer ids are strings, unique within a view and stable across polls. The interface relies on this to keep a selection and to animate only new items.
- Backends send meaning, never colours. `tone` and `colormap` are semantic slots that the frontend theme maps to colours.

**Endpoints (identical in every backend, under the prefix `/api/<view>`)**

| Method and path | Function name | Returns | Called |
| --- | --- | --- | --- |
| `GET /health` | `get_health` | `Health` | By hand, to debug the tunnel |
| `GET /snapshot` | `get_snapshot` | `Snapshot` | Polled every 10 seconds while the view is active |
| `GET /features/{feature_id}` | `get_feature` | `FeatureDetail`, or 404 | Once, when a feature is selected (P1 in the frontend) |
| `GET /fields/{field_id}.png` | `get_field_png` | `image/png` | When a field layer's `updated_at` changes. Excluded from the OpenAPI schema. |

Function names are fixed because they become the generated client names (`getSnapshot`, `getFeature`).

**Query, frontend to backend.** `GET /snapshot` takes `time_range_start` and `time_range_end`, both optional UNIX seconds. Missing values default to the last 24 hours ending now. A start after the end returns 422. The response echoes the range it applied. Views with no time dimension accept and ignore the range.

**Canonical contract.** Copy this file verbatim to `app/contract.py` in each backend. It has been syntax-checked but not executed. The first backend session to pass its smoke test confirms it, and any fix is copied to the other two.

```python
"""Ada's Eye shared API contract, version 1.

This file is byte-identical in backend-compsoc, backend-optiver and
backend-gresearch. The canonical copy is backend-compsoc/app/contract.py.
Never edit one copy alone: agree the change, update all three in one
commit, and bump CONTRACT_VERSION.
"""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field

CONTRACT_VERSION = "1.0"

MAX_POINTS_PER_LAYER = 500
MAX_ARCS_PER_LAYER = 200
MAX_FEED_ITEMS = 50

UnixSeconds = Annotated[
    int, Field(ge=0, description="UNIX timestamp in whole seconds, UTC")
]
Longitude = Annotated[float, Field(ge=-180, le=180, description="WGS84 degrees")]
Latitude = Annotated[float, Field(ge=-90, le=90, description="WGS84 degrees")]
Fraction = Annotated[float, Field(ge=0, le=1)]


class ViewId(StrEnum):
    compsoc = "compsoc"
    optiver = "optiver"
    gresearch = "gresearch"


class Tone(StrEnum):
    """Semantic colour slot. The frontend theme decides the actual colour."""

    neutral = "neutral"
    info = "info"
    positive = "positive"
    warning = "warning"
    danger = "danger"
    accent1 = "accent1"
    accent2 = "accent2"
    accent3 = "accent3"
    accent4 = "accent4"


class Colormap(StrEnum):
    sequential = "sequential"
    diverging = "diverging"
    turbo = "turbo"


class SourceState(StrEnum):
    ok = "ok"
    stale = "stale"
    down = "down"
    mock = "mock"


class Fact(BaseModel):
    """One label/value row in a detail panel. Values are pre-formatted."""

    label: str
    value: str


class LegendItem(BaseModel):
    key: str = Field(description="Matches the category of a feature")
    label: str
    tone: Tone = Tone.neutral


class Kpi(BaseModel):
    id: str
    label: str
    value: str = Field(description="Pre-formatted, e.g. '37' or '1.2m'")
    unit: str | None = None
    tone: Tone = Tone.neutral
    hint: str | None = None


class SourceStatus(BaseModel):
    id: str
    name: str
    state: SourceState
    updated_at: UnixSeconds | None = None
    url: str | None = None


class PointFeature(BaseModel):
    id: str = Field(description="Unique within the view, stable across polls")
    longitude: Longitude
    latitude: Latitude
    radius_m: float = Field(ge=1, description="Footprint radius in metres")
    category: str = Field(description="A LegendItem.key of the parent layer")
    time: UnixSeconds | None = Field(
        default=None, description="When it happened. Null for non-events."
    )
    title: str
    subtitle: str | None = None
    severity: Fraction = Field(default=0.5, description="0 = minor, 1 = extreme")
    value: float | None = None
    unit: str | None = None
    tags: list[str] = Field(default_factory=list)
    facts: list[Fact] = Field(default_factory=list)


class ArcFeature(BaseModel):
    id: str
    start_longitude: Longitude
    start_latitude: Latitude
    end_longitude: Longitude
    end_latitude: Latitude
    category: str
    title: str
    weight: Fraction = 0.5
    facts: list[Fact] = Field(default_factory=list)


class RegionFeature(BaseModel):
    id: str
    iso_a3: str = Field(pattern="^[A-Z]{3}$", description="ISO 3166-1 alpha-3")
    title: str
    value: float
    facts: list[Fact] = Field(default_factory=list)


class LayerBase(BaseModel):
    id: str = Field(description="Unique within the view, stable across polls")
    title: str
    description: str | None = None
    visible_by_default: bool = True
    attribution: str | None = None


class PointLayer(LayerBase):
    kind: Literal["points"] = "points"
    legend: list[LegendItem] = Field(default_factory=list)
    points: list[PointFeature] = Field(
        default_factory=list, max_length=MAX_POINTS_PER_LAYER
    )


class ArcLayer(LayerBase):
    kind: Literal["arcs"] = "arcs"
    legend: list[LegendItem] = Field(default_factory=list)
    arcs: list[ArcFeature] = Field(default_factory=list, max_length=MAX_ARCS_PER_LAYER)


class RegionLayer(LayerBase):
    kind: Literal["regions"] = "regions"
    value_min: float
    value_max: float
    unit: str | None = None
    colormap: Colormap = Colormap.sequential
    regions: list[RegionFeature] = Field(default_factory=list)


class FieldLayer(LayerBase):
    kind: Literal["field"] = "field"
    image_url: str = Field(description="Path of an equirectangular PNG, see PRD")
    value_min: float
    value_max: float
    unit: str | None = None
    colormap: Colormap = Colormap.sequential
    updated_at: UnixSeconds


Layer = Annotated[
    PointLayer | ArcLayer | RegionLayer | FieldLayer,
    Field(discriminator="kind"),
]


class FeedItem(BaseModel):
    id: str
    feature_id: str | None = None
    title: str
    subtitle: str | None = None
    time: UnixSeconds | None = None
    tone: Tone = Tone.neutral
    tag: str | None = None


class Snapshot(BaseModel):
    """Everything one view needs to draw. Polled every 10 seconds."""

    contract_version: str = CONTRACT_VERSION
    view: ViewId
    title: str
    generated_at: UnixSeconds
    time_range_start: UnixSeconds
    time_range_end: UnixSeconds
    is_mock: bool
    sources: list[SourceStatus] = Field(default_factory=list)
    kpis: list[Kpi] = Field(default_factory=list)
    layers: list[Layer] = Field(default_factory=list)
    feed: list[FeedItem] = Field(default_factory=list, max_length=MAX_FEED_ITEMS)


class SnapshotQuery(BaseModel):
    """Frontend to backend. Both optional: the default is the last 24 hours."""

    time_range_start: UnixSeconds | None = None
    time_range_end: UnixSeconds | None = None


class SeriesPoint(BaseModel):
    time: UnixSeconds
    value: float
    expected_low: float | None = None
    expected_high: float | None = None


class Series(BaseModel):
    id: str
    label: str
    unit: str | None = None
    threshold: float | None = None
    marker_time: UnixSeconds | None = None
    points: list[SeriesPoint] = Field(default_factory=list)


class Method(BaseModel):
    """How a feature was detected or calculated."""

    name: str
    description: str
    baseline: str | None = None
    score: float | None = None
    score_label: str | None = None


class Link(BaseModel):
    label: str
    url: str


class FeatureDetail(BaseModel):
    id: str
    title: str
    summary: str | None = None
    facts: list[Fact] = Field(default_factory=list)
    series: list[Series] = Field(default_factory=list)
    method: Method | None = None
    links: list[Link] = Field(default_factory=list)


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    view: ViewId
    contract_version: str = CONTRACT_VERSION
    is_mock: bool
    time: UnixSeconds
```

**How the example schemas map**

| Example field | Contract field | Note |
| --- | --- | --- |
| `longitude`, `latitude` | `PointFeature.longitude`, `.latitude` | Unchanged |
| `range` (radius in metres, minimum 1) | `PointFeature.radius_m` | Unit moved into the name |
| `event_type` (enum) | `PointFeature.category` | Each layer lists its allowed values in `legend`, so one model serves events, projects and sites |
| `event_time` (UNIX seconds) | `PointFeature.time` | Null for things that are not events |
| `time_range_start`, `time_range_end` | `SnapshotQuery` | Unchanged, sent as query parameters |

**Field notes**

- `radius_m` is drawn at true scale as a footprint ring. The frontend also draws a marker with a minimum on-screen size, so small events stay visible.
- `severity` is a 0 to 1 intensity that drives marker emphasis. `value` and `unit` are the human number, such as `4.6` and `M`.
- `tags` are short labels shown as chips, such as `UNREPORTED`. `facts` are the rows of the detail panel.
- `feed` is the side list, already sorted by the backend. `feature_id` links an item to a feature on the globe.
- `sources` says where data came from and whether it is fresh. Mock backends send one entry with state `mock`.
- A `regions` layer colours whole countries by `value` between `value_min` and `value_max`.
- A `field` layer points at a PNG: equirectangular, 2:1, top row at 90°N, left column at 180°W, mode LA. Luminance 0 to 255 maps linearly onto `value_min` to `value_max`. Alpha 0 means no data. The mock is 1440 by 720.
- With colormap `diverging`, the midpoint of `value_min` and `value_max` is neutral, so anomaly layers use symmetric limits.
- Lists are capped at 500 points and 200 arcs per layer and 50 feed items. Backends truncate before responding.

**Changing the contract.** A backend adds its own endpoints and models freely in `app/models.py` and `app/routes.py`. Changing anything in `contract.py` needs agreement from all four owners, one commit touching all three copies, and a `CONTRACT_VERSION` bump.

## 5. Contract automation

The frontend's API client is generated from each backend's committed `openapi.json`, so a backend change reaches the frontend as a type error, not a runtime surprise.

**Backend side (each backend)**

- `uv run python -m app.export` writes two files without starting a server.
  - `openapi.json`: `app.openapi()` dumped with sorted keys and two-space indent, so diffs stay stable.
  - `fixtures/snapshot.json`: the mock snapshot for the default range, used as the frontend's offline fallback.
- Run it whenever a route or model changes, and commit both files with that change.
- FastAPI settings in `app/main.py` that keep generated names clean:
  - `generate_unique_id_function=lambda route: route.name`, so operation ids are the function names.
  - Leave `separate_input_output_schemas` at its default, so response fields with defaults are marked required.
  - Serve docs at `/api/<view>/docs` and the schema at `/api/<view>/openapi.json`.
  - Read `X-Backend-Secret` with `include_in_schema=False`, so it never appears in generated signatures.
  - Give every route an explicit `response_model`.

**Frontend side**

- Add `orval` (dev dependency) and `@tanstack/react-query`.
- `frontend/orval.config.ts` defines three projects.

| Project | Input | Output folder |
| --- | --- | --- |
| `compsoc` | `../backend-compsoc/openapi.json` | `src/api/generated/compsoc/` |
| `optiver` | `../backend-optiver/openapi.json` | `src/api/generated/optiver/` |
| `gresearch` | `../backend-gresearch/openapi.json` | `src/api/generated/gresearch/` |

- Each project uses `client: "react-query"`, `httpClient: "fetch"`, `mode: "split"`, `clean: true` and the custom mutator `src/api/fetcher.ts`. No base URL is set, because the spec paths already start with `/api/<view>`.
- `src/api/fetcher.ts` is hand-written. It calls `fetch` with the relative URL, times out after 9 seconds (one more than the Worker allows), throws an `ApiError` carrying status and URL on any non-2xx, and resolves to the parsed body.
- Set `override.fetch.includeHttpResponseReturnType` to `false` so generated functions resolve to the body itself. If the installed Orval version lacks that option, unwrap `.data` in `src/views/<id>/index.ts` instead.
- Scripts in `frontend/package.json`:

```json
{
  "sync": "bun scripts/sync.ts",
  "dev": "bun run sync && vite",
  "build": "bun run sync && tsc -b && vite build"
}
```

- `scripts/sync.ts` does three things in order. It checks that all three `openapi.json` files exist and fails with a message naming any missing backend. It runs Orval. It copies each `../backend-<view>/fixtures/snapshot.json` to `src/fixtures/generated/<view>.json`.
- Add `src/api/generated` and `src/fixtures/generated` to `frontend/.gitignore` and to the Biome ignore list.
- Generated files must pass `tsc -b` with the existing strict flags. If a flag trips on generated code only, fix it through Orval config (a `// @ts-nocheck` header is acceptable), never by loosening `tsconfig`.

**Drift checks**

| Check | Where | What it catches |
| --- | --- | --- |
| `tsc -b` inside `bun run build` | Frontend | A backend changed a shared model, so the union type in `src/views/types.ts` no longer matches what the renderers read |
| No `?` on response fields in generated types | Frontend, checked once by eye | FastAPI schema settings are wrong |
| `switch (layer.kind)` narrows without casts | Frontend | The layer union was not generated as a discriminated union |
| `contract_version` compared at runtime | Frontend | A deployed frontend talking to an older backend. Show a CONTRACT MISMATCH tag and keep rendering. |
| `test_openapi_is_fresh` (P1) | Each backend | The committed `openapi.json` is stale |
| `test_contract_matches_canonical` (P1) | `backend-optiver`, `backend-gresearch` | A contract copy differs from `backend-compsoc/app/contract.py` |

**Adding an endpoint (recipe for backend owners)**

1. Add models to `app/models.py` and a route to `app/routes.py`, with an explicit `response_model` and a unique function name.
2. Run `uv run python -m app.export` and commit.
3. In the frontend, run `bun run sync` or restart `bun run dev`. The hook `use<FunctionName>` now exists under `@/api/generated/<view>/`.

## 6. Frontend work package

The frontend is one page: a full-viewport stylised globe with a thin HUD over it, driven entirely by the active view's `Snapshot`.

**Keep from the existing scaffold.** bun, Vite, React 19, TanStack Router file routes, Tailwind v4 tokens in `src/index.css`, shadcn components, Biome and the `@/` alias. Follow `frontend/CLAUDE.md` and update it as the architecture changes.

**Add**

| Purpose | Packages |
| --- | --- |
| 3D | `three`, `@react-three/fiber` v9, `@react-three/drei`, [`r3f-globe`](https://github.com/vasturiano/r3f-globe) |
| Data | `@tanstack/react-query`, `orval` (dev) |
| State | `zustand` |
| Geography | `world-atlas`, `topojson-client`, `d3-geo`, `i18n-iso-countries` |
| Type and tuning | Fontsource packages for the fonts in section 7, `leva` (P1) |

`r3f-globe` wraps `three-globe` and accepts a custom `globeMaterial`. If it conflicts with React 19 or fiber 9, use `three-globe` directly through `<primitive>`.

**Structure**

```text
frontend/
├── orval.config.ts
├── scripts/sync.ts
├── worker/index.ts              three-way proxy (section 3)
└── src/
    ├── config.ts                POLL_INTERVAL_MS, DEFAULT_WINDOW_S, NEW_EVENT_AGE_S
    ├── api/
    │   ├── fetcher.ts           hand-written mutator
    │   └── generated/           Orval output, gitignored
    ├── fixtures/generated/      copied snapshots, gitignored
    ├── views/
    │   ├── types.ts             AnySnapshot, AnyLayer, ViewDefinition
    │   ├── registry.ts          the list of views, in display order
    │   ├── compsoc/index.ts     wires generated functions and fixture
    │   ├── optiver/index.ts
    │   └── gresearch/index.ts
    ├── data/
    │   ├── useViewSnapshot.ts   polling, fallback, status
    │   └── useFeatureDetail.ts  P1
    ├── state/store.ts           layer visibility, selection, hover
    ├── globe/
    │   ├── GlobeCanvas.tsx      canvas, camera, controls, flyTo
    │   ├── GlobeSurface.tsx     the shader material
    │   ├── shaders/             GLSL as TypeScript strings
    │   ├── geo.ts               atlas loading, ISO lookup, land mask, hit-testing
    │   └── layers/              PointsLayer, ArcsLayer, RegionsLayer, FieldLayer, renderLayer
    ├── hud/                     ViewSwitcher, KpiStrip, LayerPanel, Legend, Feed,
    │                            DetailPanel, TimeWindow, StatusBar, Tooltip
    ├── theme/                   globe-style.ts, colormaps.ts, tones.ts
    └── routes/index.tsx         composes canvas and HUD, owns search params
```

**View registry (P0).** A view is one small object. Adding a fourth view is one folder and one line in `registry.ts`.

```ts
export interface ViewDefinition {
  id: "compsoc" | "optiver" | "gresearch";
  label: string; // "Anomaly watch"
  challenge: string; // "CompSoc"
  hasTimeWindow: boolean;
  fetchSnapshot(
    range: { time_range_start: number; time_range_end: number },
    signal?: AbortSignal,
  ): Promise<AnySnapshot>;
  fetchDetail(featureId: string, signal?: AbortSignal): Promise<AnyFeatureDetail>;
  loadFixture(): Promise<AnySnapshot>; // dynamic import of the copied snapshot
  Panel?: React.ComponentType<{ snapshot: AnySnapshot }>; // bespoke slot, unset in this build
}
```

`AnySnapshot` is the union of the three generated `Snapshot` types. Everything in `globe/` and `hud/` is typed against that union and knows nothing about a specific backend.

| View id | Label | Time window |
| --- | --- | --- |
| `compsoc` | Anomaly watch | Yes |
| `optiver` | Carbon portfolio | No |
| `gresearch` | Footprint vs profit | No |

**State (P0)**

- URL search params, validated in `routes/index.tsx`: `view` (default `compsoc`) and `window` in seconds (3600, 21600, 86400 or 604800, default 86400). A refresh or a shared link keeps both.
- The zustand store holds hidden layer ids per view, the selected feature id and the hovered feature id. Switching view clears selection and hover.
- Layer visibility starts from `visible_by_default` and is remembered per view for the session.

**Data flow (P0)**

- Only the active view is polled. `useViewSnapshot(view, windowSeconds)` wraps TanStack Query.
- The query key is `["snapshot", view.id, windowSeconds]`. Absolute timestamps are computed inside the query function at fetch time, so the key stays stable and the globe never blanks between polls.
- Options: `refetchInterval: POLL_INTERVAL_MS`, `refetchIntervalInBackground: false`, `placeholderData: keepPreviousData`, `retry: 1`.
- Call the generated fetch functions inside this hook. The generated hooks key on their params, which would start every poll from empty.
- The hook returns `{ snapshot, status }`.

| Status | Condition | What the user sees |
| --- | --- | --- |
| `live` | The last fetch succeeded | LIVE tag with the last update time |
| `stale` | A fetch succeeded earlier, the latest failed | STALE tag with the age of the data |
| `offline` | No fetch has succeeded this session | The bundled fixture, an OFFLINE SNAPSHOT tag and its `generated_at` |

- `is_mock: true` adds a MOCK tag in every status. Tags are never hidden.
- A snapshot whose `contract_version` major differs from the frontend's shows CONTRACT MISMATCH.

**Globe (P0 unless marked)**

- A full-viewport canvas sits behind the HUD. Drag rotates with damping. Wheel and pinch zoom between 1.15 and 4 globe radii. There is no panning.
- The globe rotates slowly after 10 idle seconds with nothing selected, and stops on any interaction.
- `flyTo(longitude, latitude)` eases the camera in at most 1.2 seconds. Feed clicks and selection use it.
- Hover shows a tooltip. Click selects. A click on empty globe, or Escape, clears the selection.
- High resolution: device pixel ratio up to 2, antialiasing on, a sphere of at least 128 by 64 segments, mask textures at 4096 by 2048, and 50 m Natural Earth geometry. Coastlines and borders are line geometry, not textures, so they stay crisp at full zoom.
- `prefers-reduced-motion` turns off idle rotation and pulses.
- Without WebGL, show a plain message and keep the feed and panels working.

The surface is one custom `ShaderMaterial` that composes these in order. Every number and colour in it is a uniform fed from `theme/globe-style.ts`.

1. Ocean and land tones, from a land mask rasterised once from the Natural Earth land polygons.
2. The visible `regions` layer, rasterised to a canvas texture whenever its values change.
3. The visible `field` layer. The PNG loads as a data texture with no colour-space conversion and linear filtering. A 256-pixel ramp texture built from the theme colormap turns value into colour, with optional banding.
4. Toon lighting from a light fixed in view space, quantised into bands, with halftone in the shadow band and an ink rim at the silhouette.
5. Grain.

**Layer renderers.** `renderLayer(layer)` switches on `layer.kind`. A kind with no renderer yet logs one warning and is left out of the layer list.

| Kind | Rendering | Interaction | Priority |
| --- | --- | --- | --- |
| `points` | Marker with a minimum on-screen size, coloured by the legend tone of its category. Footprint ring at true `radius_m`. Emphasis scales with `severity`. A feature whose `time` is under 15 minutes old pulses. | Hover tooltip, click to select | P0 |
| `regions` | Countries filled by value through the colormap. Countries with no value keep the base land tone. | Click to select, by ray hit then `d3.geoContains`. Hover tooltip is P1. | P0 |
| `field` | Raster over the surface, with a ramp legend showing `value_min`, `value_max` and `unit` | Value under the cursor is P2 | P0 |
| `arcs` | Great-circle arcs, height by distance, animated dash, width by `weight` | Hover tooltip | P1 |

- At most one `regions` layer and one `field` layer are visible at a time. Turning one on turns off the other of the same kind.
- `world-atlas` country ids are ISO numeric. Convert them to alpha-3 with `i18n-iso-countries`. Polygons with no match are drawn as no-data.
- A marker is keyed by its feature id. A poll that keeps an id keeps its marker, and only new ids animate in.
- Load the atlas with a dynamic import so it does not delay first paint.

**HUD (P0 unless marked)**

| Component | Behaviour |
| --- | --- |
| ViewSwitcher | Three tabs from the registry. Keys 1, 2 and 3 switch views. Switching updates `?view=`, clears the selection and starts polling the new view. |
| KpiStrip | `snapshot.kpis` as headline numbers, coloured by tone |
| LayerPanel | One toggle per layer, with title, description and attribution |
| Legend | Category swatches for visible point and arc layers. A ramp bar for the visible field or regions layer. |
| Feed | `snapshot.feed` in backend order, with relative time. A click flies to and selects `feature_id`. |
| DetailPanel | Title, tags, value, time, coordinates and `facts` of the selected feature. P1: fetch `FeatureDetail` and add summary, method, links and one line chart per series with expected band, threshold and marker. |
| TimeWindow | 1 h, 6 h, 24 h, 7 d. Shown only when the view has a time window. |
| StatusBar | LIVE, STALE, OFFLINE SNAPSHOT, MOCK and CONTRACT MISMATCH tags, plus each entry of `snapshot.sources` with state and update time |
| Bespoke slot | Renders `view.Panel` when defined. Empty in this build. |

- The layout targets 1280 by 720 and larger. Below that it must not break, and need not be optimised.
- The series chart is a small hand-written SVG component. Do not add a chart library.
- Empty states are explicit, such as "No events in this window". A panel is never blank.
- HUD controls are real buttons and tabs, reachable by keyboard, with visible focus.

## 7. Design direction

The default look is a two-colour engraving print: an ultramarine page, a bone-coloured globe drawn in ink, and hot signal colours reserved for data. It is a starting point, and every choice below lives in a theme file so the team can retune it without touching components.

**Where design lives (P0)**

| File | Holds |
| --- | --- |
| `src/index.css` | Interface tokens as CSS variables: surfaces, text, borders, the nine tones, radius and fonts. The existing shadcn variables are remapped here. |
| `src/theme/globe-style.ts` | Named presets of shader and marker parameters: ocean, land and ink colours, light direction, band count, halftone scale and strength, rim width, grain, line widths, marker sizes |
| `src/theme/colormaps.ts` | Gradient stops for `sequential`, `diverging` and `turbo` |
| `src/theme/tones.ts` | Reads the nine tone variables from CSS for the globe, so interface and globe never disagree |

- No colour, font or shader constant is written inside a component. Components read tokens.
- Changing the active preset, or one value in it, restyles the globe with no other code change.
- Ship two presets to prove that: `engraving` (default) and `plain` (flat colours, no halftone, no grain), which is also the low-power fallback.
- Everything is drawn from vector data and shaders. The default look uses no bitmap art, so it stays sharp on high-density screens and at full zoom.
- `?debug` opens a `leva` panel bound to the live preset, with a button that copies the current values as JSON (P1).

**Default preset: engraving**

| Element | Default | Reference it comes from |
| --- | --- | --- |
| Page | Flat ultramarine. No gradients, no glow. | Hermes page |
| Type | Condensed capitals for the name and headline numbers. Monospace capitals with wide tracking for labels. A plain sans for body text. | Hermes page |
| Panels | Flat and square-cornered, with hairline bone borders. No blur, no drop shadows. | Hermes page |
| Globe | Bone land with halftone in shadow, ocean one shade off the page colour, ink coastlines, a hard ink rim | Blender toon shader |
| Data fields | Banded colour ramps over the surface, with coastlines drawn on top | Temperature globe |
| Arcs and cards | Thin animated arcs, and small pop-up cards anchored to features | GitHub globe |
| Data colours | Vermilion for `danger`, amber for `warning`, then cyan, white and distinct accents. Nothing else on the page uses these hues. | New |
| Motion | Short and mechanical: 150 to 250 ms, no bounce | New |

Suggested fonts, bundled through Fontsource so the page makes no external requests: Antonio for display, Geist Mono for labels, and Geist (already installed) for body. Use the closest available family if a package is missing.

**The eye (P1, behind one flag).** The product name is literal: the globe is the iris. With `motif.eye` on (the default), an engraved almond outline with radiating hatch lines sits behind the globe as static SVG that never intercepts pointer events. Switching view plays a 300 ms blink: lids close, the data swaps, lids open. With the flag off, both disappear and a plain globe remains.

**Name.** The wordmark reads ADA'S EYE, top left. The page title is "Ada's Eye". The favicon is a simple eye glyph in SVG.

**Avoid.** These make the product look generic: purple-to-blue gradients, glass blur, bloom halos around the globe, rounded cards with soft shadows, a starfield, emoji as icons, and default shadcn greys.

## 8. Backend work packages

All three backends are the same small FastAPI skeleton. They differ only in view id, port and what `mock.py` generates.

**Shared skeleton**

```text
backend-<view>/
├── pyproject.toml            uv project, Python 3.12
├── uv.lock
├── .python-version
├── .env.example              BACKEND_SECRET=
├── README.md                 run, export, add an endpoint
├── CLAUDE.md                 port, prefix, ownership scope, the contract rule
├── openapi.json              generated, committed
├── fixtures/snapshot.json    generated, committed
├── app/
│   ├── __init__.py
│   ├── main.py               app and settings (section 5), router at /api/<view>
│   ├── contract.py           shared contract, verbatim from section 4
│   ├── models.py             this backend's own models, empty to start
│   ├── routes.py             the four contract endpoints
│   ├── mock.py               deterministic fake data
│   ├── sources/              one module per real data source, empty to start
│   └── export.py             writes openapi.json and fixtures/snapshot.json
└── tests/test_smoke.py
```

- Dependencies: `fastapi[standard]` 0.115 or newer (needed for query-parameter models) and `pydantic` 2. `backend-compsoc` adds `numpy` and `pillow` for the field PNG. Dev dependency: `pytest`.
- No database, no cache server, no background workers. State lives in memory.
- `routes.py` holds exactly the four endpoints from section 4, with those function names. `get_field_png` sets `include_in_schema=False`. A backend with no field layer returns 404 from it.
- The secret check is a router dependency. When `BACKEND_SECRET` is set in the environment, a request without a matching `X-Backend-Secret` gets 401. When unset, everything is allowed.
- No CORS middleware.
- Run with `uv run fastapi dev app/main.py --port <port>`. Test with `uv run pytest`.

**Smoke tests (P0, each backend)**

- `/health` returns 200.
- `/snapshot` returns 200 and validates as `Snapshot`. A start after the end returns 422.
- Every `feed.feature_id` exists in a layer. Every point's `category` is in its layer's `legend`.
- `get_feature` returns 200 for a known id and 404 for an unknown one.

**Mock data rules (all backends)**

- `is_mock` is `true`, and `sources` has one entry with state `mock`.
- Data is a pure function of time and a fixed seed. The same request in the same second returns the same response, and ids never change between polls.
- KPIs are computed from the mock items, never hard-coded, so the numbers on screen add up.
- Titles and facts use realistic wording and lengths, so the layout is tested against real-looking text.
- When an owner wires real data, they replace `mock.py` call by call. They set `is_mock` to `false` only once nothing fake remains, and report each upstream in `sources`.

### backend-compsoc (port 8001, primary)

| Part | Mock content |
| --- | --- |
| Layer `events` (points, on) | Each one-minute bucket seeds a random generator and yields zero or one event, so new events appear while a demo runs. The rate comes from the MOCK\_EVENTS\_PER\_HOUR setting: default 3, about 70 in 24 hours. Raise it to 60 to watch events arrive. Categories and tones: `earthquake` danger, `flood` info, `air_quality` warning, `heat` accent1. Positions jitter around a table of plausible anchors: plate boundaries, English river gauges, large cities. About a third carry the tag `UNREPORTED`. |
| Layer `temperature_anomaly` (field, on) | A 1440 by 720 PNG built with numpy from a latitude gradient, a few Gaussian blobs and smooth noise. Range -5 to 5 °C, colormap `diverging`. Regenerated every 10 minutes so `updated_at` changes. |
| KPIs | Events in window, unreported events, strongest event, sources reporting |
| Feed | The 30 most recent events, newest first, tone taken from the category |
| `get_feature` | Facts, a 48-point series with expected band, threshold and a marker at the event time, a `Method` naming a placeholder detector, and a link to the upstream's home page |

Real detectors are out of scope and are sketched in the appendix.

### backend-optiver (port 8002)

| Part | Mock content |
| --- | --- |
| Layer `projects` (points, on) | About 60 carbon-credit projects placed near country centroids. Categories: `forestry`, `renewable`, `cookstoves`, `methane`, `other`. `severity` is the failure probability. `value` is the price per tonne. Tags: `HELD` for projects in the portfolio, `AT RISK` for a few. |
| Layer `holdings` (regions, on) | Tonnes held per country, colormap `sequential` |
| Layer `delivery` (arcs, on) | One arc from each held project to the buyer in Edinburgh, `weight` by share of the portfolio |
| KPIs | Target (100,000 tCO2e), expected delivery, cost, budget used, chance of shortfall, projects held |
| Feed | Holdings sorted by tonnes, with failure probability as the tag and tone `warning` when at risk |
| `get_feature` | Project facts (registry, type, country, price, failure probability, tonnes held) and a `Method` naming a placeholder risk model. No series. |

The mock portfolio is a fixed set of about 12 holdings whose expected delivery lands just above the target. Later work, out of scope here: load the Optiver sheet, optimise under a budget, stress-test over the failure probabilities, and raise the risk of projects near events read from the compsoc backend over HTTP.

### backend-gresearch (port 8003)

| Part | Mock content |
| --- | --- |
| Layer `grid_intensity` (regions, on) | Grid carbon intensity for about 60 countries in gCO2/kWh, colormap `sequential`, with plausible relative values |
| Layer `sites` (points, on) | Eight sites of one fictional company, Thistle Freight Ltd. Categories: `office`, `data_centre`, `factory`, `warehouse`. `value` is annual tCO2e. `severity` is the site's share of the largest. |
| Layer `logistics` (arcs, on) | Routes between sites, `weight` by emissions |
| KPIs | Annual emissions, annual profit, emissions per pound of revenue, best available saving |
| Feed | Five alternative strategies ranked by emissions saved per pound of profit given up. Each links to the site it changes. |
| `get_feature` | Site facts, a 12-point monthly emissions series, and a `Method` naming a placeholder emission-factor calculation |

Both of these backends need a small hand-written table of about 60 countries with ISO alpha-3 code, name and approximate centroid. Each keeps its own copy. Later work, out of scope here: UK government conversion factors, live grid intensity, and a scenario endpoint.

## 9. Running and deploying

Local development needs no tunnel: the Worker runs in workerd beside Vite and proxies to three localhost ports.

**Local**

| What | Folder | Command |
| --- | --- | --- |
| Frontend | `frontend/` | `bun install`, then `bun run dev` |
| CompSoc backend | `backend-compsoc/` | `uv sync`, then `uv run fastapi dev app/main.py --port 8001` |
| Optiver backend | `backend-optiver/` | `uv sync`, then `uv run fastapi dev app/main.py --port 8002` |
| G-Research backend | `backend-gresearch/` | `uv sync`, then `uv run fastapi dev app/main.py --port 8003` |

- Copy `frontend/.dev.vars.example` to `.dev.vars`. It holds the three localhost URLs and an empty `BACKEND_SECRET`.
- The frontend owner can work with no backend running. Each view falls back to its fixture and shows the OFFLINE SNAPSHOT tag.
- A backend owner checks their view without touching frontend code: run their backend and the frontend, then open `/?view=<their view>`.
- Every command is a single line that works in PowerShell, bash and zsh. Do not add scripts that need bash, because the frontend base was built on Windows.

**Demo day (one laptop serves all three backends)**

1. Pull `main` and start the three backends without reload: `uv run fastapi run app/main.py --host 127.0.0.1 --port 8001`, and likewise for 8002 and 8003.
2. Run one named tunnel with `cloudflared`, using the ingress rules below. Hostnames are placeholders until the domain is chosen. Each hostname also needs `cloudflared tunnel route dns <tunnel> <hostname>` once.
3. Put the three hostnames into the `BACKEND_*_URL` vars in `frontend/wrangler.jsonc`.
4. Set the secret with `bunx wrangler secret put BACKEND_SECRET`, and set the same value as `BACKEND_SECRET` in the environment of each backend.
5. Run `bun run deploy` from `frontend/`.
6. Open `/api/compsoc/health`, `/api/optiver/health` and `/api/gresearch/health` on the deployed host. Then open the site and confirm each view shows LIVE.

```yaml
# cloudflared config.yml (placeholders)
tunnel: <TUNNEL-ID>
credentials-file: <PATH>/<TUNNEL-ID>.json
ingress:
  - hostname: compsoc-api.YOUR-DOMAIN.com
    service: http://localhost:8001
  - hostname: optiver-api.YOUR-DOMAIN.com
    service: http://localhost:8002
  - hostname: gresearch-api.YOUR-DOMAIN.com
    service: http://localhost:8003
  - service: http_status:404
```

Keep the laptop awake and on mains power through judging. If the tunnel drops, the site keeps working from stale data or fixtures and says so.

## 10. Definition of done

The MVP is done when every P0 box is ticked locally with the three mock backends running, and again on the deployed site once the tunnel hostnames exist.

**Repo and contract (P0)**

- [ ] `frontend/` and the three backend folders exist, with the root `CLAUDE.md`, `README.md` and `.gitignore`.
- [ ] `app/contract.py` is identical in all three backends.
- [ ] In each backend, `uv run pytest` passes and `uv run python -m app.export` writes `openapi.json` and `fixtures/snapshot.json`.
- [ ] `bun run sync` generates three clients, and `git status` stays clean afterwards.
- [ ] `bun run build` and `bun run lint` pass.

**Routing (P0)**

- [ ] `/api/compsoc/health`, `/api/optiver/health` and `/api/gresearch/health` return 200 through `bun run dev`.
- [ ] Stopping one backend gives a 502 or 504 JSON response for that prefix only.

**Globe (P0)**

- [ ] The globe rotates by drag, zooms within its limits and resumes idle rotation.
- [ ] Coastlines stay crisp at full zoom on a high-density display.
- [ ] Points, regions and field layers render from mock data, and each layer toggle shows and hides its layer.
- [ ] Hover shows a tooltip, click opens the detail panel, Escape clears it.
- [ ] A feed click flies to its feature and selects it.
- [ ] Changing the active preset from `engraving` to `plain` restyles the globe with a one-line change.

**Views and data (P0)**

- [ ] The three views switch by tab, by keys 1 to 3 and by `?view=`.
- [ ] The network panel shows one `/snapshot` request every 10 seconds, for the active view only, and none while the tab is hidden.
- [ ] The globe does not blank or flicker between polls.
- [ ] A new mock compsoc event appears with a pulse within one poll of being generated.
- [ ] Changing the time window changes the events shown.
- [ ] With a backend stopped mid-session the view shows STALE. With it stopped from page load the view shows OFFLINE SNAPSHOT. Restarting it returns the view to LIVE without a reload.
- [ ] MOCK is visible on every view.

**P1, in this order**

- [ ] Detail endpoint wired into the panel: summary, method, links and series chart.
- [ ] Arcs render for Optiver delivery and G-Research logistics.
- [ ] Eye motif and blink transition, behind `motif.eye`.
- [ ] `?debug` tuning panel.
- [ ] Freshness and contract-copy tests in the backends.
- [ ] Region hover tooltip.

## 11. Build order

Four sessions run in parallel from the first minute. The frontend needs nothing from a backend until its step 4.

**Frontend session**

1. Root `CLAUDE.md`, `README.md` and `.gitignore`, pushed as the first commit so the others can pull. About 10 minutes.
2. Worker three-way proxy, vars and typegen. About 15 minutes.
3. Globe surface: canvas, controls, land mask, coastlines, the `engraving` and `plain` presets. About 70 minutes.
4. Sync script, Orval, fetcher, view registry and `useViewSnapshot` with fixture fallback. About 40 minutes. This step needs the three `openapi.json` files on `main`.
5. Layer renderers: points, then field, then regions. About 70 minutes.
6. HUD: switcher, status bar, layer panel, feed, detail panel, KPIs, legend, time window. About 60 minutes.
7. Deploy and tunnel check. About 20 minutes.
8. P1 items in the order listed in section 10.

**Each backend session**

1. Skeleton, verbatim contract, `/health`, smoke test, export, commit and push. About 25 minutes. Push early, because the frontend's step 4 waits on `openapi.json`.
2. Mock snapshot as described in section 8, with the fixture exported. About 40 minutes.
3. Mock `get_feature` and, for compsoc, the field PNG. About 30 minutes.
4. Move on to real data in `sources/`, replacing `mock.py` call by call.

**Gates**

| Time | What must be true | If it is not |
| --- | --- | --- |
| 13:00 | All three `openapi.json` files and fixtures are on `main`. The frontend shows the styled globe with coastlines. | Backend owners finish the skeleton before any real-data work |
| 15:30 | All three views switch and render their layers from the running mock backends | Drop arcs, the eye motif and the debug panel |
| 17:15 | Feature freeze. The deployed site passes the P0 list. | Fixes, deploy checks and rehearsal only |
| 18:15 | Submission |  |

CompSoc is the primary challenge. If time runs short, the Optiver and G-Research views stay on mock data and the saved time goes to one real CompSoc detector.

## 12. Open items

Nothing here blocks the MVP. Each item has a placeholder or an assumption in place.

| Item | Placeholder or assumption now | Who settles it | Needed for |
| --- | --- | --- | --- |
| Domain and three tunnel hostnames | `*-api.YOUR-DOMAIN.com` | Frontend owner | Deploy |
| `BACKEND_SECRET` value | Empty, so the check is off | Frontend owner | Deploy |
| CompSoc detectors and their data sources | Mock events. Candidates are in the appendix. | CompSoc owner | Real data |
| API keys | None in the repo. OpenAQ needs a key and Copernicus needs an account. | CompSoc owner | Real data |
| Optiver dataset columns | The sheet linked in the brief has not been read. Mock projects stand in. | Optiver owner | Real portfolio |
| Optiver budget and unit | The brief gives neither. Assumed tonnes of CO2e, with the budget as a user input. | Optiver owner | Real portfolio |
| G-Research company model and strategies | One fictional company and five mock strategies | G-Research owner | Real model |
| Design tailoring | `engraving` preset with the eye motif on | Whole team | Polish |
| Entering one project for three challenges | Assumed allowed | Whole team, with the organisers | Submission |

## 13. Appendix: data sources and candidate detectors

None of this is built in the MVP. It records a starting point for the CompSoc owner and shows that the contract already carries what the CompSoc judges ask for.

**What CompSoc asks for, and where it shows**

| The brief asks for | Where it appears |
| --- | --- |
| What anomaly or event is detected | Event title, category and tags, plus `Method.description` in the detail panel |
| Which data sources were used | StatusBar sources, layer attribution, detail links |
| Methods and models, with technical specifics | The `Method` block: name, description, score |
| Results and outcomes | Series chart with expected band and threshold, and KPIs such as unreported events |
| Results verifiable against a baseline (bonus) | `Method.baseline` and the `UNREPORTED` tag |
| Small compute and classical methods (bonus) | Backends use statistics, clustering and signal processing only, on one laptop |
| A quick demo | The live globe |

**Sources named in the brief**

| Source | Gives | Coverage | Access | Freshness |
| --- | --- | --- | --- | --- |
| [USGS event service](https://earthquake.usgs.gov/fdsnws/event/1/) | Earthquake catalogue | Global for larger events, all sizes in the US | No key | Minutes |
| [EMSC SeismicPortal](https://www.seismicportal.eu/fdsn-wsevent.html) | Earthquake catalogue | Global, densest around Europe | No key | Minutes |
| [Environment Agency flood monitoring](https://environment.data.gov.uk/flood-monitoring/doc/reference) | River levels and flood warnings | England | No key | About every 15 minutes |
| [BGS sensors](https://sensors.bgs.ac.uk/) | Ground and groundwater sensor readings | UK sites | No key | Varies by sensor |
| [OpenAQ](https://openaq.org/) | Air-quality measurements | Global | API key in the `X-API-Key` header ([docs](https://docs.openaq.org/using-the-api/api-key)) | About hourly |
| [Copernicus CDS](https://cds.climate.copernicus.eu/) | Reanalysis and climate records | Global | Account, access token, queued requests | Not live: ERA5 runs about five days behind |
| [OpenStreetMap API](https://www.openstreetmap.org/about/api/) | Map editing | Global | Not needed, because the globe uses Natural Earth outlines | Not applicable |

Only the OpenAQ and Copernicus rows were checked on 3 Oct 2026. The other rows are from general knowledge and should be confirmed before coding. Copernicus suits a "what is normal" baseline, not a live layer.

**Candidate detectors (suggestions for the owner to accept, change or drop)**

| Detector | Sources | Classical method | Baseline to check against | Why it is easy to miss |
| --- | --- | --- | --- | --- |
| Quakes missing from one catalogue | USGS, EMSC | Match events across catalogues within time and distance windows, then cluster the unmatched with DBSCAN to find swarms | Agreement rate between the catalogues | Small events in remote regions reach one agency first, or only one |
| Abnormal river rise | Environment Agency readings | Robust z-score (median and MAD) per gauge against its own history, held over several readings | Official flood warnings: lead time, precision, recall | A gauge can rise abnormally before, or without, a warning being issued |
| Air-quality spike | OpenAQ | Per-station baseline by hour of week, then CUSUM or z-score, with agreement among neighbouring stations | Published air-quality index bands | A spike at one station rarely makes the news |
| Temperature anomaly field | Copernicus climatology plus a current analysis | Current value minus the climatological mean per grid cell | The climatology itself | It is context for the events, not an event |

Each detector reports through the existing contract: one `PointFeature` per event with `severity` from its score, and a `Method` and `Series` in the detail.

**Sources**

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), read 3 Oct 2026
- [r3f-globe](https://github.com/vasturiano/r3f-globe)
- [OpenAQ API key documentation](https://docs.openaq.org/using-the-api/api-key)
- [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view), the reference project: one module per layer, state in the URL, honest stale and fallback labels
- AdaHack 2026 slideshow, the CompSoc challenge sheet, and the Optiver and G-Research briefs
