# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SvelteKit + TypeScript + Svelte 5 (runes mode) port of the MTEB Gradio leaderboard. Deployed two ways:

- **Hugging Face Space** — `Dockerfile` at the repo root clones this branch, builds the static bundle, and serves it via nginx-unprivileged on port 7860. The bundle calls the mteb FastAPI backend (separate Space) over CORS.
- **GitHub Pages** — `make deploy-build` produces a prerendered static site under `/leaderboardv2/`.

The runtime data source is the **mteb FastAPI service** (`https://github.com/embeddings-benchmark/mteb`, branch `api`, source under `mteb/api/`). `PUBLIC_API_URL` is required — there is no mock fallback.

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

### Env

Two `PUBLIC_*` env vars are read at build time (statically inlined by SvelteKit):

- `PUBLIC_API_URL` — base URL of the mteb FastAPI service. **Required.** Read by `src/lib/data/service.ts` (loaders), `src/lib/format.ts` (icon URL helper), and `src/lib/components/ShareMeta.svelte` (OG image URL). Set in `.env.local` for dev (`http://localhost:8000`) and as a `Dockerfile` `ENV` for the Space build. Loaders throw a descriptive error when unset so misconfiguration surfaces immediately instead of silently rendering empty tables.
- `PUBLIC_SITE_URL` — canonical origin used by `svelte.config.js`'s `prerender.origin` and `ShareMeta` for canonical / OG URLs. Without it, prerendered HTML bakes in `http://sveltekit-prerender` origins. Baked into the Dockerfile and `deploy.yml`.

`BASE_PATH` is the build-time path prefix (empty for the Space, `/leaderboardv2` for GitHub Pages). Mock fixtures and `PUBLIC_USE_MOCK` are gone — backend is required.

## High-level architecture

### Routes

The `/explorer` prefix is gone — every route lives at the site root.

| Route                           | Purpose                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                             | Home: three featured `PrimaryLeaderTile`s (Multilingual / Retrieval / English) + flat `MenuSection`s of secondary benchmarks            |
| `/benchmarks`                   | Full benchmark catalog + right-side sticky sidebar (Modality / Task type / Domain filters)                                              |
| `/benchmark/[name]`             | Per-benchmark detail page: hero + tabs (Summary / Performance × Size / Performance × Time / Per task / Per language / Task information) |
| `/models` + `/models/[...name]` | Model index + detail. The rest-param accepts `org/name` (e.g. `Qwen/Qwen3-Embedding-8B`)                                                |
| `/tasks` + `/tasks/[name]`      | Task index + detail (same shape as models, sidebar mirrors `/benchmarks`)                                                               |
| `/compare`                      | Pick up to 4 models, side-by-side metric cards with per-metric winners + radar                                                          |

Reusable building blocks under `src/lib/components/`:

- **Tables / charts:** `SummaryTable`, `PerTaskTab`, `PerLanguageTab`, `ModelScoreTable`, `BenchScoreTable`, `PerfSizeTab`, `PerfTimeTab`, `PlotlyChart`, `TaskInfoTab`.
- **Filters / picking:** `FilterSidebar`, `FilterContent`, `ModelSearchBar`, `RangeSlider`.
- **Shared toolbar widgets** (used by every overview's `.toolbar`): `SearchInput` (icon + clear button), `SortDirIcon` (lucide `arrow-up-narrow-wide` / `arrow-down-wide-narrow`), and `DownloadButton`. `SortHeader` wraps a `<th>` with a sort button + ARIA, used by every model-row table.
- **Floating actions** (rendered once per page, fixed positioning): `ShareUrlButton` (bottom-right, primary-accent pill) copies `window.location.href` with every filter param baked in. `ScrollToTopButton` (bottom-left, same accent treatment) fades in once `window.scrollY > 320`. They bookend the viewport — don't introduce a third floating affordance on either edge.
- **Home tiles:** `PrimaryLeaderTile` (featured size-bucket leaderboards), `MenuSection` (secondary benchmark sections).
- **Hover portals / popovers:** `HoverPortal`, `ModelHoverPortal`, `InfoDot` (the canonical hover-info dot — `InfoTip` was removed).
- **Theming + misc:** `ThemeToggle`, `MarkdownText`, `CopyableId`, `ModalityIcon`, `ModelTypeIcon`, `Tabs`, `CiteBlock`.

The top bar (root `+layout.svelte`) is a 3-column grid: MTEB brand · Benchmarks/Models/Tasks/Compare nav · GitHub + Documentation + Leaderboard external links + `ThemeToggle`.

### Data flow

```
mteb FastAPI (PUBLIC_API_URL + /v1)
     │
     ↓
src/lib/data/service.ts   ← loadBenchmarkMenu / loadBenchmark(s) / loadSummary / loadPerLanguage
                            loadLeaders / loadTasks / loadTask / loadTaskScores
                            loadModels / loadModel / loadModelScores
     │                      + session-scoped LRU `cachedHttp` (64 entries) + inflight dedupe
     ↓
src/lib/stores/leaderboard.svelte.ts  ← reactive selected/benchmark/summary, with inflight cancellation
src/lib/stores/filters.svelte.ts      ← all filter state + applyFilters(summary)
src/lib/stores/pinned.svelte.ts       ← Set<string> of pinned model names, shared across every table
src/lib/stores/sort.svelte.ts         ← createSortState<K>() factory; URL-backed per-table sort
     ↓
filteredSummary = applyFilters(leaderboard.summary)
```

`service.ts` is the **only** place that calls `fetch()` — swap backends, change auth, change cache strategy here without touching anything downstream. All loaders hit `${API}/v1/...`. `loadSummary` hits `/benchmarks/{name}/scores`. Every response goes through `cachedHttp`, a bounded LRU keyed by URL with in-flight dedupe — re-opening a previously-visited page is a synchronous cache hit. Most route loaders are tiny pre-warmers that just call `loadFoo()` so the data is cached by the time the page renders; SvelteKit's `data-sveltekit-preload-data="hover"` hint pre-warms on link hover too. `PUBLIC_API_URL` is also read by `src/lib/format.ts` (`apiUrl()` for benchmark/task icon URLs) and `ShareMeta.svelte` (OG image URL), but neither fetches — both are URL builders, so the "only branch point" guarantee still holds.

### Stores (Svelte 5 runes singletons)

All four stores under `src/lib/stores/*.svelte.ts` use the same pattern: a factory function that holds `$state(...)` inside a closure, returns an object with getters and mutators. **Read these before adding new state** — they're the canonical reference for the project's runes idioms. Notable shared-state behaviors:

- `leaderboard.select(name)` uses an `inflight` counter so quickly switching benchmarks discards stale async results.
- `filters.initFor(summary)` is **write-only** — it never reads from `state.*` inside the effect that calls it. This avoids a re-fire loop where Svelte's deep-loop guard fires `effect_update_depth_exceeded` and freezes reactivity. If you add fields to the filter state, keep `initFor` write-only.
- `pinnedModels` is shared — pinning in any table (SummaryTable, PerTask, PerLanguage, ModelScoreTable, BenchScoreTable) reflects everywhere. Each model-row table sorts pinned rows to the top in its own `sortedRows = $derived.by(...)`.
- `sort.svelte.ts` exports `createSortState<K>()` — a per-table factory used by every sortable table. State syncs to the URL so sort survives reload + shared links.

### Theme system

- `src/app.css` declares per-token light/dark pairs (`--surface-light` / `--surface-dark`, `--text-light` / `--text-dark`, …) and exposes a single live token via `light-dark(var(--X-light), var(--X-dark))`. The browser resolves it based on `color-scheme`, which the `ThemeToggle` pins via `<html data-theme="light"|"dark">`. A short inline script in `app.html` reads `localStorage` before paint to avoid FOUC.
- The **`--tint-*` palette** (blue / purple / green / orange / amber / pink / azure / teal, each with a `-fg` companion) is the canonical color set for model-type and task-type chips, card top-accent gradients, filter pills, and SummaryTable model-column tints. Always reach for `--tint-X` + `--tint-X-fg` instead of hardcoding hex; the dark variants are pre-tuned for legibility. See app.css for the mapping per category.
- `@supports not (color: light-dark(white, black))` provides a fallback for Safari ≤17.4.

### Charts

`src/lib/components/PlotlyChart.svelte` is the only place Plotly is imported, and it does so via `await import('plotly.js-dist-min')` inside `onMount` — keeps Plotly out of the SSR bundle and out of the initial JS. Figure-spec generators live in `src/lib/charts/figures.ts` and return plain `{ data, layout }` for the wrapper to render.

**Theme handling is in the wrapper, not the figure**. `PlotlyChart` resolves `--ink-strong` / `--text` / `--border` / `--surface` via a probe element (because `getPropertyValue('--token')` returns the unresolved `light-dark(...)` expression, which Plotly can't parse), passes them as `font.color` / `tickfont.color` / `gridcolor` / `paper_bgcolor`, and re-renders on theme switch via a `MutationObserver` on `data-theme` plus a `prefers-color-scheme` media listener. Don't hardcode colors in `figures.ts` — leave the slot empty and the wrapper will fill it.

### Tooltip portal pattern (important)

The dark column-header tooltip in `SummaryTable` is NOT a child of the `<th>`. It's mounted at the root of the `.summary` wrapper, sibling to the `.scroll` container. Each `<th>` carries `data-tip-title` / `data-tip` attributes and `pointerenter`/`pointerleave`/`focusin`/`focusout` handlers that update a single `tipState` object; the portal element is positioned via `position: fixed` with JS-set `left`/`top` from the cell's `getBoundingClientRect()`.

This shape is deliberate. Reasons:

- The `.scroll` wrapper has `overflow: auto`, which would clip an absolutely-positioned tooltip on the leftmost columns.
- The `<th>` is `position: sticky` and establishes its own stacking context; a `position: fixed` descendant cannot escape it, so the neighboring sticky Model column with a higher `z-index` would paint over the left edge of any tip that crossed under it.

Don't move the tooltip back inside a `<th>`. If a new table needs the same behavior, mirror this pattern.

### Static-adapter deployment

- `svelte.config.js` uses `adapter-static` with `fallback: '404.html'` so deep links work as SPA on GitHub Pages.
- `paths.base` reads `BASE_PATH` at build time; the GitHub Actions workflow (`.github/workflows/deploy.yml`) sets it to `/${{ github.event.repository.name }}`. The Space `Dockerfile` leaves it empty (root-served).
- `paths.relative: false` is intentional — relative `_app/...` URLs break under the HF Spaces reverse proxy when a request hits a deep route (the relative path resolves against the wrong base and the bundle 404s with a wrong MIME type).
- `prerender.origin` reads `PUBLIC_SITE_URL` so OG / canonical URLs in the prerendered HTML use the real production origin instead of the SvelteKit placeholder.
- `kit.version.name` is the git short SHA (or `GITHUB_SHA` in CI), polled every 60s. The root layout watches `updated.current` from `$app/state` and forces a full reload on the next navigation (or when the tab is hidden) so a fresh deploy lands without users clearing cache.
- `kit.prerender.handleMissingId: 'warn'` — some pages render in-page anchors only after data loads on the client, so they're absent from prerendered HTML. The warn keeps the build from failing.
- HF Space nginx fallback chain (`$uri $uri.html $uri/ /404.html`, plus `port_in_redirect off` / `absolute_redirect off`) is what serves the prerendered `benchmark/<slug>.html` etc. behind the Spaces reverse proxy.

## Svelte 5 conventions in this codebase

- Runes mode is **enforced** for project files (see `svelte.config.js`'s `compilerOptions.runes`).
- Stores live in `*.svelte.ts` files. Inside, use `$state(...)` — do NOT use legacy `writable`/`readable`.
- Use `$derived(expr)` for values, `$derived.by(() => { ... })` for blocks. `$derived(() => fn())` is a bug — it stores the function as the value (don't use this form).
- `let foo = $state(prop)` produces the "captures initial value" warning; wrap with `untrack(() => prop ?? default)` when you really want a one-shot snapshot of a prop into local state. There are multiple examples (`RangeSlider`, `FilterContent`).
- `$effect`s that batch state writes must not also read those same fields inside the same effect — see the `filters.initFor` note above.

## Style / interaction patterns to reuse

- **`--tint-*` palette** is the single source of truth for category color (see Theme system above). Don't introduce parallel hex maps in new components — set `--card-tint` / `--card-accent` from the tint tokens on a parent and read those downstream.
- **Per-model-type tint** (dense → blue, cross-encoder → orange, late-interaction → green, sparse → amber, router → purple) is mirrored across the model-type filter pills (`FilterContent`), model-card chips, model detail hero, compare-page strips, and SummaryTable model + params column tints. Keep the mapping consistent.
- **Per-task-type tint** (Classification → blue, Clustering → orange, PairClassification/MultilabelClassification → green, Reranking/InstructionReranking → amber/orange, Retrieval → purple, STS → pink, BitextMining → azure, Summarization → teal) is mirrored across the task index pills + chips, task detail hero, and per-task-type displays. Keep the mapping consistent.
- **Per-modality tint** (text → teal, image → blue, audio → amber, video → purple) drives the modality filter pills on `/tasks` + `/benchmarks`, the modality badges on every overview card, and the card top-accent stripe + soft gradient header band on `/` and `/benchmarks` (where each card carries `data-modality={b.modalities[0] ?? 'text'}`). The shared `.modality-tint[data-modality=…]` utility in `app.css` is the single place that maps modality → tint pair.
- **Heat-shading on score cells** is generated by the shared `heat(score, min, max)` helper in `src/lib/format.ts`: it returns a `background:` style mixing `color-mix(in srgb, var(--heat) <pct>%, transparent)` where `<pct>` maps the score linearly across the per-column `[min, max]` range onto 0–55%. Use `minOf` / `maxOf` (also in `format.ts`) to compute the bounds per column. Don't reintroduce per-table copies of the helper.
- Best-in-column highlight is **bold only** (not orange) — the cell already wears its heat color.
- The Rank column in `SummaryTable` doubles as the pin cell: pin button + rank number share one `.rank-cell` flex container. Other model-row tables put the pin button in its own 32px sticky column to the left of Model.

### Overview cards (shared shell)

The benchmark cards on `/` and `/benchmarks`, the task cards on `/tasks`, and the model cards on `/models` all share one **accent-rail** visual shape — keep them in lockstep when changing any of them. Category color reads as a structured edge, not a wash.

- `.card` is a plain `var(--surface)` flex column with a 1 px neutral border, `16px 16px 16px 18px` padding (the extra left clears the rail) and `12px` gap. **No** top stripe, **no** gradient header band — those were removed (they read as "vibe-coded"). The per-category attribute blocks (`[data-modality]` on benchmarks, `[data-stype]` on tasks, `[data-type]` on models) set `--card-accent` (rail + hover) and `--card-tint` (the soft chip fill).
- **The rail** is the shared `.accent-rail` utility in `src/app.css` (`::before` pseudo: `left: 0; top/bottom: 16px; width: 4px; border-radius: 0 4px 4px 0; background: var(--card-accent)`; on hover `top/bottom: 11px`). Every consumer — the three card types, the PrimaryLeaderTile, and the `/benchmark/[name]` hero — adds `class="… accent-rail"` and supplies `--card-accent` via per-category attribute blocks. It falls back to `--border-strong` for categories with no accent mapping. This is the one consistent color moment shared across all of them; don't reintroduce per-component `::before` copies.
- **Badges are filled per-modality.** `.badge` (and the model card's `.mod-chip`) read `--modality-tint` / `--modality-tint-fg` from each badge's **own** `data-modality` (set by the global `[data-modality]` rules in app.css), so text/image/audio/video each render a distinct color — do **not** color them from the card's single `--card-accent`. The model card's `Open weights` badge is a separate capability badge (green outline, not modality).
- Category is **also** named by a soft-tint chip where useful: the model **type-chip** (top-right) and task **group-chip** (footer), both filled from `--card-tint` / `--card-accent`.
- Hover state (shared): `translateY(-1px)`, border → `color-mix(--card-accent 45%, --border)`, `.title` → `--card-accent`, soft neutral shadow, plus the rail growth above.
- Layout order is unchanged: `.card-head` → `.desc` (2-line clamped) → `.stats` (2×2 grid of `<dt>` label + `<dd>` value, `dd` weight 700) → optional `.newer-note` (benchmark only) → `.badges` (pinned to the bottom edge via `margin-top: auto`). On the benchmark card the `CopyableId` pill is ghosted (transparent until hover) via a scoped `.card-titles :global(.copyable-id)` override so it doesn't compete with the title — it stays a full chip on the `/benchmark/[name]` hero.
- When adding a new category accent, set `--card-accent` (and `--card-tint` if a chip needs it) on the attribute block — never reintroduce a stripe or gradient.

### Sticky shelves and floating actions

- Every `/benchmarks`, `/models`, `/tasks` toolbar is a `position: sticky` shelf docked at `top: var(--header-offset, 56px)` with `z-index: 5`, `background: var(--bar-bg)`, and a `backdrop-filter: blur(14px) saturate(140%)` — the same translucent treatment as the page header so the two strips read as one shelf. `/benchmark/[name]`'s `.toolbar-row` is intentionally **not** sticky because `SummaryTable`'s sticky thead docks at `top: 0` inside the same scroll context and would visually collide.
- Two floating actions live at the page edges: `ShareUrlButton` (bottom-right) copies the full URL with every filter param baked in, and `ScrollToTopButton` (bottom-left) fades in once `window.scrollY > 320`. Both use the same accent treatment (`1.5px solid var(--primary)` + soft halo, hover lift). Add them as the last children of any new long-scroll page — they don't need a wrapper.

### Filter "all-on = filter off"

`/tasks` and `/benchmarks` both seed every sidebar filter set (`modalityFilter`, `taskTypeFilter`, `domainFilter`, …) with every available value at load time, so the default state is "everything checked". When applying filters, treat `filter.size === ALL.length` as **no filter applied** and skip the `.some()` check entirely. Without this bypass, rows whose modality / domain / type list is empty silently drop out of the default view (because `[].some(...)` is always false). If you add a new sidebar facet, mirror this pattern — there's a `modalityOff` / `taskTypeOff` / `domainOff` short-circuit in each page's `filteredAll` derived.

## Data shape

Types in `src/lib/types.ts` match the FastAPI response schemas one-to-one (pydantic emits camelCase aliases on the backend so the TS types are unchanged).

- A model is a `ModelMeta`: `name`, `displayName`, `org`, `modelType`, params, embedding dim, max tokens, zero-shot %, `modalities`, etc. Display is `org/displayName` (HF style) — search matches against all three of `name`, `displayName`, `org`.
- A benchmark carries `taskTypes`, `tasks` (array of names), `languages`, `domains`, `modalities`, plus `numModels` (distinct model count, overlaid by the backend from the unified results frame — shown on the overview card "Models" stat).
- A `TaskMeta` carries `type`, `simplifiedType`, `languages`, `domains`, `modalities`, `description`, dataset metadata (`sourceDataset`, `license`, `dateFrom/To`, `annotationsCreators`, `dialect`, `sampleCreation`), and `numModels` (the same per-task distinct-model overlay — drives the "Models evaluated" stat + sort on `/tasks`).
- A summary additionally carries `tasksMeta: TaskMeta[]` and per-row `trainedOnTasks: string[]` (drives the ⚠️ trained-on warning in `PerTaskTab`).
- `buildMockSummary(benchmarkName)` is deterministic per benchmark (seeded hash) — same input always produces the same scores. Useful for offline UI work and as the basis for snapshot tests.
