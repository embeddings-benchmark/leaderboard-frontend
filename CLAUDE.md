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
     │                      + session-scoped LRU `cachedHttp` (64 entries in the browser, 10_000 during `building` so prerender can prime per-name slots) + inflight dedupe
     ↓
src/lib/stores/leaderboard.svelte.ts  ← reactive selected/benchmark/summary, with inflight cancellation
src/lib/stores/filters.svelte.ts      ← all filter state + applyFilters(summary)
src/lib/stores/pinned.svelte.ts       ← Set<string> of pinned model names, shared across every table
src/lib/stores/sort.svelte.ts         ← createSortState<K>() factory; URL-backed per-table sort
     ↓
filteredSummary = applyFilters(leaderboard.summary)
```

`service.ts` is the **only** place that calls `fetch()` — swap backends, change auth, change cache strategy here without touching anything downstream. All loaders hit `${API}/v1/...`. `loadSummary` hits `/benchmarks/{name}/scores`. Every response goes through `cachedHttp`, a bounded LRU keyed by URL with in-flight dedupe — re-opening a previously-visited page is a synchronous cache hit. Most route loaders are tiny pre-warmers that just call `loadFoo()` so the data is cached by the time the page renders; SvelteKit's `data-sveltekit-preload-data="hover"` hint pre-warms on link hover too. `PUBLIC_API_URL` is also read by `src/lib/format.ts` (`apiUrl()` for benchmark/task icon URLs) and `ShareMeta.svelte` (OG image URL), but neither fetches — both are URL builders, so the "only branch point" guarantee still holds.

**Catalog-driven cache priming**: `loadBenchmarks()`, `loadTasks()`, and `loadModels()` each iterate their full-catalog response and `cacheTouch()` every per-name slot (e.g. `/benchmarks/{name}`, `/tasks/{name}`, `/models/{name}`). During prerender, the `entries()` generator runs the catalog call once per route and every downstream `loadBenchmark(name)` / `loadTask(name)` / `loadModel(name)` in the per-page `load()` is a sync cache hit — eliminates the 1+N round-trip pattern. Tasks/models prime only when called without filters; a narrowed catalog wouldn't represent the per-name resource. `RESPONSE_CACHE_MAX` is `building ? 10_000 : 64` so the LRU doesn't evict primed entries mid-build.

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
- **`$state.raw` for large reassigned objects.** Heavy API payloads (`benchmark`, `summary`, `availableTasks`, the `available*` lists in `filters.svelte.ts`) are stored with `$state.raw` because they're replaced wholesale and never deep-mutated. Deep `$state` would walk every row + `scoresByTask` entry for nothing. Rule of thumb: if a field is only ever `field = newValue` (no `field.foo = …`, no `field.push(…)`), it belongs in `$state.raw`. SvelteSets and per-cell scalars stay in deep `$state`.
- **Treat `$effect` as an escape hatch, not a data fetcher.** Don't write `$effect(() => { someAsync().then((v) => (state = v)) })` or its `untrack`-wrapped cousins to start fetches from a reactive context — that's the pattern the home page used to have, and it's a Svelte anti-pattern (effects are for syncing external systems, not initializing state). Use a `+page.ts` `load` function instead; the data arrives as a `data` prop and the page reads it via `$props()`.

## SvelteKit load / data flow

The default for every route is a typed `+page.ts` loader that **streams** its data via unresolved promises — direct (prerendered) visits get fully-resolved data baked into HTML; client-side nav paints the shell + a skeleton immediately and fills in as each promise resolves. The page consumes that promise in a `$effect` with a stale-guard. Use `cachedHttp` (via the existing `loadFoo()` wrappers in `service.ts`) so warm-cache navs resolve synchronously.

- **Two loader shapes**:
  - _Single streamed promise_ (`/tasks`, `/benchmarks` index): loader awaits + derives everything inside a helper, returns `{ tasks: deriveTasksData() }` (the **promise** itself is the prop). Page: `let resolved = $state<TasksData | null>(null)` + `$effect(() => { const p = data.tasks; p.then((r) => { if (data.tasks === p) resolved = r; }) })`. Then `{#if !resolved && !loadError}<Skeleton />{:else if loadError}...{:else}...{/if}` in the template.
  - _Eager metadata + client-side heavy data_ (`/tasks/[name]`, `/models/[...name=modelName]`, `/`): `await` the cheap metadata fetches (menu, model meta, task meta) and return them from `load()`. The heavy `/scores` fetch is **NOT** in the loader — it runs in a client-only `$effect` in the page that calls `loadModelScores(name)` / `loadTaskScores(name)` directly. Why: streamed `/scores` promises were inlined during prerender, costing one `/scores` round-trip per detail page (~1000 calls) and bloating every prerendered HTML with embedded score data. Client-fetching keeps the hero card fully prerendered (good for crawlers and LCP) while the scores table loads on hydration. The page uses a `taskName === name` (or `modelName === name`) stale-guard inside the effect to discard a slow fetch from a previous slug on rapid nav.
- **Streamed promises must never reject during prerender.** A rejected stream crashes the build with an unhandled promise rejection. Wrap potentially-failing fetches in a discriminated-union result so the promise always resolves: `Promise<{ ok: true; data: T } | { ok: false; error: string }>` — see `ScoresResult` in `/tasks/[name]/+page.ts` and `/models/[...name]/+page.ts`. The page reads `.ok` to branch between "show data" and "show error".
- **Pre-warmer-only loads exist for pages we don't fully migrate.** `/models/+page.ts` is still a pure pre-warmer (`loadModels({}).catch(() => undefined)`) because the page does its own fetch in `$effect` to also compute the language-pill universe from the same payload. Pre-warmers must `.catch(() => undefined)` so a backend hiccup doesn't block client-side nav or blank prerender.
- **Prefetch heavy detail pages via `data-sveltekit-preload-data="hover"`.** The body in `app.html` opts in globally; pair it with a small `load` on the detail route that **returns the prefetched value** (don't rely on a side-effect call to `loadFoo()` — that only populates the build process's `cachedHttp`, which never reaches the user's browser). `/benchmark/[name]/+page.ts` returns `{ benchmark: await loadBenchmark(name, fetch).catch(() => null) }`, and the page's `$effect` calls `primeBenchmarkCache(name, data.benchmark)` to seed the runtime `cachedHttp` before the leaderboard store fires `loadBenchmark` from its own effect. End-to-end: hover → SvelteKit fetches the route's `.json` (now containing the benchmark) → click → page prime-$effect runs first → store's `loadBenchmark` is a sync cache hit → only the heavy `loadSummary` actually goes to the network. When a route's data is owned by a store rather than the page, mirror this pattern (return data from the loader + add a service-level `primeFooCache(name, value)` export that calls `cacheTouch`).
- **Thread `event.fetch` from every `+page.ts` into the `loadFoo()` call.** Every public loader in `service.ts` takes an optional `fetchFn` as its last param (e.g. `loadBenchmark(name, fetch)`). Pass `event.fetch` from the load function; non-loader callers (stores, `$effect`s) omit it and get the default `globalThis.fetch`. The reason: SvelteKit's `event.fetch` inlines the response into the prerendered HTML/data, so hydration reads from the inlined cache instead of re-fetching. There's no module-level way to access the per-request fetch — threading is the canonical SvelteKit pattern (and the only one that's concurrency-safe under streamed promises).
- **`PageLoad` annotations are mandatory.** Every `export const load` in a `+page.ts` should be typed with `PageLoad` from `./$types`. Entries generators use `EntryGenerator`. Same for the data prop: `let { data }: { data: PageData } = $props()`.
- **Filter set seeding is one-shot.** When the streamed promise lands, seed the page's `SvelteSet` filters (`modalityFilter`, `domainFilter`, …) once — guard with a `let filtersSeeded = false` flag inside the seeding `$effect`. Re-seeding on subsequent resolutions (e.g. an `invalidate()` triggered refetch) would clobber the user's picks.
- **Reactive deps go through `$derived`, not initial-value capture.** `const x = data.foo` triggers the "captures initial value" warning when the loader can re-run (any param-keyed route). Use `let x = $derived(data.foo)` so the value tracks `data` re-evaluation. The `payload?.model ?? data.model` chain on `/models/[...name]` is the canonical "prefer the fresher value once it lands, fall back to the loader's value" shape — no `$state` + sync-`$effect` needed.
- **Migrating off `$effect`-based fetch exposes latent data bugs.** When a page used to render with `data = null` during prerender (effect-based fetch), null fields in upstream records were never reached. The migration to a synchronous loader makes prerender render with real data — broken records (null arrays, edge-slashed names) crash the build instead of silently corrupting hydrated UI. Fix the data at the service boundary (`normalizeTaskMeta` in `service.ts`, `modelPath` stripping edge slashes in `format.ts`) rather than guarding every template access.
- **Filter locally before adding a refetch.** `/models` used to call `loadModels({ modalities })` on every modality-picker toggle. The full registry is small enough to filter in `buildPasses()` — one `loadModels({})` on mount, modality predicate applied client-side, zero refetches. Before threading a new filter into the API call, check whether the data is already fully loaded and could be narrowed in-process.
- **Service-layer caching + normalization is the load fast path.** `cachedHttp` in `service.ts` is keyed by URL with in-flight dedupe; route loaders that just call `loadFoo()` are already cache-coherent. Normalization (`enrichSummary`, `enrichTaskScores`, `enrichModelScores`, `fillOrgAndDisplay`, `normalizeTaskMeta`) lives at the same boundary so every downstream consumer reads well-formed shapes. `enrichSummary` also **dedupes** `summary.taskTypes` / `summary.tasks` via `new Set()` — at least one benchmark (`MTEB(cmn, v1)`) ships the same task twice in its registry, which used to crash keyed `{#each}` blocks on the task-list facet. Don't re-cache or re-normalize at the page layer.
- **`BUILD_NO_PRERENDER=1` skips prerender locally.** Read by `+layout.ts` + the three detail `+page.ts` files as `export const prerender = !process.env.BUILD_NO_PRERENDER`. The literal is inlined into the client bundle via Vite's `define` (`process.env.BUILD_NO_PRERENDER` → JSON-stringified value) in `vite.config.ts` — without that, the browser would hit `ReferenceError: process is not defined` at module load. CI never sets the flag, so production builds always prerender; the flag is for fast iteration against a slow or unreachable backend.

## Accessibility patterns to follow

- **`{#each}` keys must be content-derived, not array indices.** Use the row's `name` / `id` / a composite like `${seg.type}:${i}:${seg.text}` (see `MarkdownText.svelte`). Bare `(i)` keys defeat keyed-each surgical updates and break when the source list reorders.
- **Composite-widget keyboard nav.** `Tabs.svelte` (`role="tablist"`) and `Segmented.svelte` (`role="radiogroup"`) implement the WAI-ARIA APG pattern: roving `tabindex` (the active item is `0`, the rest are `-1`), `keydown` on the wrapper handles Arrow / Home / End, then `queueMicrotask(() => buttons[next]?.focus())` so focus re-lands after the re-render. The wrapper itself carries `tabindex="-1"` to satisfy Svelte's a11y lint for keydown-bearing interactive roles. Any new tabset / segmented control should mirror this pattern.
- **Icon-only buttons need `aria-label`.** `title` is not reliably announced by screen readers — `SearchInput`'s clear button, sort icons, pin buttons, share/scroll-to-top all carry an explicit `aria-label`. Don't rely on `title` alone.
- **Unique per-route `<title>`** is what SvelteKit's live-region announces after each client-side navigation. Every page that owns its data should set a `<svelte:head><title>…</title></svelte:head>` derived from the resource (e.g. `{model.displayName} — MTEB`), with a sensible fallback while the streamed promise is still in flight. A stale or shared title means screen-reader users can't tell that navigation happened.
- **Post-nav focus lands on `<body>` by default.** If a route should focus a specific element (e.g. the search input on `/models`), use `afterNavigate` from `$app/navigation` and explicitly `.focus()` the target. Don't reach for `autofocus` — it fires once on initial mount, not on subsequent navs.

## SvelteKit / Svelte 5 framework guidance

Synthesized from upstream docs (`svelte.dev/docs/kit/*`, `svelte.dev/docs/svelte/best-practices`). Only items that actually apply to this project (adapter-static, no server runtime, prerendered SPA, FastAPI backend over CORS) are listed — the "skip list" at the bottom names what we deliberately ignore.

### Link options worth reaching for

- `data-sveltekit-preload-data="hover"` is already enabled globally on `<body>` in `app.html`. It prefetches both code and the `+page.ts` data on hover; pair with the `primeFooCache` pattern (see the load-flow section above) so the runtime cache actually sees the prefetched payload.
- `data-sveltekit-preload-code="eager"` on specific high-value links preloads the route module without triggering the data load. Useful when a link is almost certain to be clicked but its data is too dynamic or too large to prefetch.
- `data-sveltekit-replacestate` on filter / sort / search links keeps intermediate states out of the back-history. If a future refactor moves filters from `filters.svelte.ts` into search params (via `goto(url, { replaceState: true })`), apply this so the back button skips past dozens of filter-toggle entries.
- `data-sveltekit-noscroll` on in-page links that only update search params (e.g. a filter chip routed through `goto`) prevents the viewport from snapping to top.
- `data-sveltekit-keepfocus` only belongs on form-like inputs the user is actively typing into (e.g. a search box that triggers a `goto`); never on plain anchor links.

### URL state, snapshots, and store state

- The upstream guidance: anything a user wants to **share, reload, or come back to** belongs in the URL. All three reactive stores already URL-sync via `replaceState()` from `$app/navigation`: `sort.svelte.ts` (sort key/dir), `filters.svelte.ts` (every facet — `q`, size range, modalities, tasks, langs, etc., microtask-debounced via `doSync()`), and `pinned.svelte.ts` (the `?pin=` set). `ShareUrlButton` only has to read `page.url.href` because the URL already carries everything. `replaceState` (not `pushState`) is the right choice — filter toggles don't deserve back-history entries.
- **Snapshots** (`export const snapshot = { capture, restore }` from a `+page.svelte`) are the right tool for ephemeral UI state that shouldn't go in the URL but should survive back/forward navigation — e.g. an expanded info-dot, a collapsed sidebar section, a scroll position within a long table. None used today; reach for this before promoting that kind of state into a singleton store.
- The "no shared user state on the server" rule from the docs doesn't bite us (we're fully prerendered / static), but the corollary **does**: never write to a global store from inside a `load` function. Loaders return data; pages or stores consume it. The streamed-promise pattern in this repo already follows that — keep it that way.

### Load function pitfalls

- `redirect(status, location)` and `error(status, message)` from `@sveltejs/kit` are **throws**, not return values. Never wrap them in a `try/catch` — you'll swallow the navigation. The three detail loaders (`/benchmark/[name]`, `/models/[...name=modelName]`, `/tasks/[name]`) demonstrate the pattern: `loadFoo(...).catch((e) => { if (e instanceof HttpError && e.status === 404) error(404, ...); throw e; })`. `HttpError` from `src/lib/data/service.ts` carries the status so loaders can distinguish a missing resource from a 5xx / network blip.
- `await parent()` in a child loader serializes that loader against the parent. If we ever add a parent load, run independent fetches **before** the `await parent()` so they overlap on the network. We don't use parent loads today.
- Explicit invalidation: `depends('app:foo')` inside a loader plus `invalidate('app:foo')` from a component triggers a targeted re-run. Always prefer this over `invalidateAll()`, which re-runs every active loader on the page. The `filtersSeeded` one-shot guard exists precisely because we anticipate `invalidate()` being added — keep the guard in place when you add it.
- **Matchers** (`src/params/<name>.ts`) validate dynamic params at the router level. `/models/[...name=modelName]` uses `src/params/modelName.ts` to require the HF `org/name` shape (exactly one `/`, no empty segments, no `..`). Malformed slugs fail at the router and hit the root 404; valid-shape-but-unknown slugs fall through to the loader's `error(404, ...)`. Any new dynamic param with a known shape should follow the same pattern.

### Performance posture

- SvelteKit already handles code-splitting, asset preloading, request coalescing, data inlining (via `event.fetch`), parallel loads, and conservative invalidation. We actively exercise: `event.fetch` threading (inlines responses into prerendered HTML), the hover preload (above), and per-route streamed promises (within-page parallelism). Don't fight the framework on these.
- We deliberately don't use `@sveltejs/enhanced-img` — the package optimizes **build-time** assets, and our icons are remote (`PUBLIC_API_URL`-served). For remote `<img>`s, set explicit `width` / `height` to prevent CLS, `loading="lazy"` for below-the-fold images, and `fetchpriority="high"` on hero / LCP images (e.g. the icon on `/models/[...name=modelName]`, `/benchmark/[name]`).
- Dynamic `import()` keeps non-critical code out of the initial bundle — `PlotlyChart` already does this for `plotly.js-dist-min`. If another heavy lib lands (markdown renderer with syntax highlighting, a graph layout engine), follow the same pattern: import inside `onMount`, not at module scope.
- For bundle size investigations, reach for `rollup-plugin-visualizer` rather than guessing.

### Icons

- Project uses **`lucide-svelte` via subpath imports only**: `import Activity from 'lucide-svelte/icons/activity'`. The wrapper components (`ModalityIcon`, `ModelTypeIcon`, `SortDirIcon`) map domain categories → lucide glyphs in one place; every other call site imports the icon directly at the consuming component. The two GitHub glyphs in `+layout.svelte` stay inline as `<svg>` because Lucide doesn't ship a GitHub icon (Microsoft trademark policy).
- **Never use the barrel import** (`import { Activity, Search } from 'lucide-svelte'`). That's the pattern the SvelteKit icon docs flag — it walks thousands of `.svelte` modules through Vite's dep optimizer and slows cold-start. Subpath imports tree-shake cleanly and only pull the icons we use.
- `lucide-svelte` ships legacy Svelte 4 component classes (`export let`, `<slot/>`, `$$props`). They mount fine from runes-mode components because `svelte.config.js` opts node_modules out of runes mode (`compilerOptions.runes`). Don't try to rewrite the icons against runes — the legacy mount is intentional.
- **`vite.config.ts` carries `ssr.noExternal: ['lucide-svelte']`.** Required: the package's `./icons/<name>.js` shim re-imports `../Icon.svelte` (a raw `.svelte` file). Without `noExternal`, Vite leaves the package external during SSR / prerender and Node hits the `.svelte` file directly, crashing with `ERR_UNKNOWN_FILE_EXTENSION`. If we add another Svelte-component package that ships raw `.svelte` files, it needs the same treatment.

### Hooks (none today, but relevant if we ever ship a server runtime)

- The static adapter doesn't run any of `handle` / `handleFetch` / `handleError` / `reroute`. If we ever switch to a node or edge adapter, the relevant hooks for this project are:
  - `handleFetch` to rewrite `PUBLIC_API_URL` to an internal hostname during SSR / prerender so the build hits the FastAPI backend over the loopback (no CORS hop).
  - `reroute` to map legacy paths (e.g. the old `/explorer/...` URLs) without a 301 redirect.
  - `transformPageChunk` inside `handle` to set `<html lang>` per request if we ever localize.

### Env vars

- `PUBLIC_API_URL` / `PUBLIC_SITE_URL` are read via `$env/static/public` and inlined at build time — exactly the pattern the docs recommend for values that need dead-code elimination. The build fails fast when they're unset (see the `service.ts` loader error), which matches the "validate at startup" guidance.
- Never put a secret behind a `PUBLIC_` prefix. There are no private env vars in this project; if one is ever needed (e.g. a build-time HF token), use `$env/static/private` and keep it out of any module reachable from a `+page.ts` or component.

### What we deliberately skip

- **Form actions / `use:enhance`** — require a server runtime; the static adapter has none.
- **Remote functions** (`query` / `command` / `form` / `prerender`) — experimental and server-side; not usable under adapter-static.
- **Observability / OpenTelemetry tracing** — server-only, opt-in flag, non-trivial overhead; we have no server to instrument.
- **`+server.js` endpoints** — same reason; the backend is a separate FastAPI service.
- **`$env/static/private` / `$app/env/private`** — no secrets in the build, no server runtime to read them at request time.

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
