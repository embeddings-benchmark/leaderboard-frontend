# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SvelteKit + TypeScript + Svelte 5 (runes mode) port of the MTEB Gradio leaderboard, deployed as a fully prerendered static site to GitHub Pages at `/leaderboardv2/`. There is **no backend yet** — all data comes from deterministic mock generators in `src/lib/data/`.

## Commands

A `Makefile` wraps the npm scripts; either works.

```sh
make dev              # vite dev on http://localhost:5173 (npm run dev)
make build            # vite build (no base path, for local serving)
make deploy-build     # BASE_PATH=/leaderboardv2 vite build (matches CI)
make preview          # serve build/ on http://localhost:4173
make check            # svelte-kit sync && svelte-check (TS + Svelte diagnostics)
make lint             # prettier --check . && eslint .
make format           # prettier --write .
make test             # build + npm run test:e2e (Playwright)
make test-ui          # interactive Playwright UI
make kill-ports       # free 5173/5174/4173 if a dev/preview server is lingering
make clean            # rm -rf node_modules build .svelte-kit test-results playwright-report
```

Run a single Playwright test:

```sh
npx playwright test tests/tab-switch.e2e.ts
```

Playwright's webServer in `playwright.config.ts` runs `npm run build && npm run preview -- --port 4173` and `reuseExistingServer: true`, so iterating on tests against an already-running preview is fine.

## High-level architecture

### Seven UI variants, one data layer

The leaderboard ships as seven different routes that all read the same store + mock data. The `ViewSwitcher` pill (centered top of every page, in the root `+layout.svelte`) jumps between them:

| Route | Purpose |
|---|---|
| `/` | Classic: left benchmark sidebar + tabs + right filter sidebar |
| `/dashboard` | Top bar + benchmark picker + KPI hero + filter drawer |
| `/explorer` | Multi-page: benchmarks grid → `/explorer/[benchmark]` detail, plus `/explorer/models` and `/explorer/tasks` directories under `explorer/+layout.svelte`'s sub-nav |
| `/compare` | Pick up to 4 models, side-by-side cards with per-metric winners + radar |
| `/bento` | At-a-glance mixed-size grid (leader hero, KPI tiles, Pareto chart) |
| `/spreadsheet` | Full-bleed data grid with sortable headers, pin column, heat-shaded cells, density toggle |
| `/story` | Long-scroll editorial with sticky TOC and serif body |

Reusable building blocks (`SummaryTable`, `PerTaskTab`, `PerLanguageTab`, `Tabs`, `FilterDrawer`, `BenchmarkPicker`, etc.) live in `src/lib/components/` and get composed differently in each variant. When adding a variant, copy the import pattern from `/bento` or `/dashboard` (both subscribe to the leaderboard store and call `filters.initFor(summary)` in an `$effect`).

### Data flow

```
src/lib/data/mockBenchmarks.ts   ← BENCHMARK_INDEX + BENCHMARK_MENU + COMMON_DOMAINS + MMTEB_LANGUAGES
src/lib/data/mockSummary.ts      ← MOCK_MODELS + buildMockSummary(name): BenchmarkSummary
src/lib/data/service.ts          ← thin async wrappers: loadBenchmark / loadSummary
       ↓
src/lib/stores/leaderboard.svelte.ts  ← reactive selected/benchmark/summary, with inflight cancellation
src/lib/stores/filters.svelte.ts      ← all filter state + applyFilters(summary)
src/lib/stores/pinned.svelte.ts       ← Set<string> of pinned model names, shared across every table
       ↓
filteredSummary = applyFilters(leaderboard.summary)
```

The service layer is intentionally an async indirection so swapping in a real backend later only touches `src/lib/data/service.ts`.

### Stores (Svelte 5 runes singletons)

All three stores under `src/lib/stores/*.svelte.ts` use the same pattern: a factory function that holds `$state(...)` inside a closure, returns an object with getters and mutators. **Read these before adding new state** — they're the canonical reference for the project's runes idioms. Notable shared-state behaviors:

- `leaderboard.select(name)` uses an `inflight` counter so quickly switching benchmarks discards stale async results.
- `filters.initFor(summary)` is **write-only** — it never reads from `state.*` inside the effect that calls it. This avoids a re-fire loop where Svelte's deep-loop guard fires `effect_update_depth_exceeded` and freezes reactivity. If you add fields to the filter state, keep `initFor` write-only.
- `pinnedModels` is shared — pinning in any table (Classic, PerTask, PerLanguage, Spreadsheet) reflects everywhere. Each model-row table sorts pinned rows to the top in its own `sortedRows = $derived.by(...)`.

### Charts

`src/lib/components/PlotlyChart.svelte` is the only place Plotly is imported, and it does so via `await import('plotly.js-dist-min')` inside `onMount` — keeps Plotly out of the SSR bundle and out of the initial JS. Figure-spec generators live in `src/lib/charts/figures.ts` and return plain `{ data, layout }` for the wrapper to render.

### Tooltip portal pattern (important)

The dark column-header tooltip in `SummaryTable` is NOT a child of the `<th>`. It's mounted at the root of the `.summary` wrapper, sibling to the `.scroll` container. Each `<th>` carries `data-tip-title` / `data-tip` attributes and `pointerenter`/`pointerleave`/`focusin`/`focusout` handlers that update a single `tipState` object; the portal element is positioned via `position: fixed` with JS-set `left`/`top` from the cell's `getBoundingClientRect()`.

This shape is deliberate. Reasons:
- The `.scroll` wrapper has `overflow: auto`, which would clip an absolutely-positioned tooltip on the leftmost columns.
- The `<th>` is `position: sticky` and establishes its own stacking context; a `position: fixed` descendant cannot escape it, so the neighboring sticky Model column with a higher `z-index` would paint over the left edge of any tip that crossed under it.

Don't move the tooltip back inside a `<th>`. If a new table needs the same behavior, mirror this pattern.

### Static-adapter deployment

- `svelte.config.js` uses `adapter-static` with `fallback: '404.html'` so deep links work as SPA on GitHub Pages.
- `paths.base` reads `BASE_PATH` at build time; the GitHub Actions workflow (`.github/workflows/deploy.yml`) sets it to `/${{ github.event.repository.name }}`.
- `kit.version.name` is the git short SHA (or `GITHUB_SHA` in CI), polled every 60s. The root layout watches `updated.current` from `$app/state` and forces a full reload on the next navigation (or when the tab is hidden) so a fresh deploy lands without users clearing cache.
- `kit.prerender.handleMissingId: 'warn'` — Story page's TOC anchors (`#lede`, …) only render after data loads on the client, so they're absent from prerendered HTML. The warn keeps the build from failing.

## Svelte 5 conventions in this codebase

- Runes mode is **enforced** for project files (see `svelte.config.js`'s `compilerOptions.runes`).
- Stores live in `*.svelte.ts` files. Inside, use `$state(...)` — do NOT use legacy `writable`/`readable`.
- Use `$derived(expr)` for values, `$derived.by(() => { ... })` for blocks. `$derived(() => fn())` is a bug — it stores the function as the value (don't use this form).
- `let foo = $state(prop)` produces the "captures initial value" warning; wrap with `untrack(() => prop ?? default)` when you really want a one-shot snapshot of a prop into local state. There are multiple examples (`RangeSlider`, `FilterContent`, `MenuGroup`).
- `$effect`s that batch state writes must not also read those same fields inside the same effect — see the `filters.initFor` note above.

## Style / interaction patterns to reuse

- **Per-model-type palette** (dense / cross-encoder / late-interaction / sparse / router) is repeated across the model-type filter pills, model-card chips, compare-page strips, and the Summary table's Model + Params column tints. When adding a new surface that shows model type, keep the same colors.
- **Heat-shading on score cells** is `color-mix(in srgb, var(--primary) <pct>%, transparent)` where `<pct>` maps the 0.45–0.75 score range onto 0–55%. The same `heat()` helper is duplicated in `SummaryTable`, `PerTaskTab`, `PerLanguageTab`, and `/spreadsheet`. If you change the curve, update all four.
- Best-in-column highlight is **bold only** (not orange) — the cell already wears its heat color.
- The Rank column in `SummaryTable` doubles as the pin cell: pin button + rank number share one `.rank-cell` flex container. Other model-row tables put the pin button in its own 32px sticky column to the left of Model.

## Mock data shape

- A model is a `ModelMeta` (in `src/lib/types.ts`) with `name`, `displayName`, `org`, `modelType`, params, embedding dim, max tokens, zero-shot %, etc. Display is `org/displayName` (HF style) — search matches against all three of `name`, `displayName`, `org`.
- A benchmark carries `taskTypes`, `tasks` (array of names), `languages`, `domains`, `modalities`. A summary additionally carries `tasksMeta: TaskMeta[]` (per-task type/languages/domains/modality), which the filter store uses to derive the available choices for the Customize section.
- `buildMockSummary(benchmarkName)` is deterministic per benchmark (seeded hash) — same input always produces the same scores. Useful when comparing across tabs.
