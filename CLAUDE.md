# CLAUDE.md

SvelteKit + TypeScript + Svelte 5 (runes mode) port of the MTEB Gradio leaderboard. Deployed as a static site to a Hugging Face Space (via `Dockerfile` + nginx) and GitHub Pages. Runtime data source is the **mteb FastAPI service** (`embeddings-benchmark/mteb`, branch `api`). `PUBLIC_API_URL` is required — no mock fallback.

## Commands

`Makefile` wraps the npm scripts.

```sh
make dev              # vite dev on http://localhost:5173
make build            # vite build
make deploy-build     # BASE_PATH=/leaderboardv2 vite build (matches CI)
make preview          # serve build/ on http://localhost:4173
make check            # svelte-kit sync && svelte-check
make lint             # prettier --check . && eslint .
make format           # prettier --write .
make test             # build + Playwright e2e
make kill-ports       # free 5173/5174/4173
```

Single test: `npx playwright test tests/tab-switch.e2e.ts`. Playwright `reuseExistingServer: true` so iterating against a running preview works.

### Env vars

Read via `$env/static/public` (build-time inlined):

- `PUBLIC_API_URL` — **required**, base URL of FastAPI. Loaders throw if unset.
- `PUBLIC_SITE_URL` — canonical origin for `prerender.origin` and OG / canonical URLs.
- `BASE_PATH` — build-time path prefix (empty for Space, `/leaderboardv2` for Pages).
- `BUILD_NO_PRERENDER=1` — skips prerender locally (read by `+layout.ts` + detail `+page.ts`). Inlined via Vite `define` in `vite.config.ts`.

## Routes

`/explorer` prefix is gone — every route is at the site root.

| Route                           | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `/`                             | Three featured `PrimaryLeaderTile`s + `MenuSection`s                             |
| `/benchmarks`                   | Catalog + sidebar filters (Modality / Task type / Domain)                        |
| `/benchmark/[name]`             | Hero + tabs (Summary / Perf×Size / Perf×Time / Per task / Per language / Info)   |
| `/models` + `/models/[...name]` | Index + detail. Rest-param accepts `org/name` (validated by `params/modelName.ts`) |
| `/tasks` + `/tasks/[name]`      | Index + detail, sidebar mirrors `/benchmarks`                                    |
| `/compare`                      | Up to 4 models side-by-side with radar                                           |

Components live under `src/lib/components/` — read them before adding new ones. Shared toolbar widgets (`SearchInput`, `SortDirIcon`, `DownloadButton`, `SortHeader`) and floating actions (`ShareUrlButton` bottom-right, `ScrollToTopButton` bottom-left) appear on every overview / detail page.

## Data flow

```
FastAPI (PUBLIC_API_URL + /v1)
   ↓
src/lib/data/service.ts   ← only place that calls fetch()
                            + cachedHttp (LRU 64 / 10_000 during build) + inflight dedupe
                            + normalization (enrichSummary, normalizeTaskMeta, …)
   ↓
src/lib/stores/*.svelte.ts   ← leaderboard, filters, pinned, sort
```

- `service.ts` is the **only** branch point for HTTP. Format helpers (`apiUrl()` in `format.ts`, OG URL in `ShareMeta`) only build URLs, they don't fetch.
- **Catalog-driven cache priming**: `loadBenchmarks()` / `loadTasks()` / `loadModels()` iterate the full catalog and `cacheTouch()` every per-name slot — eliminates the 1+N round-trip during prerender. Only happens when called without filters.
- `enrichSummary` dedupes `taskTypes` / `tasks` because at least one benchmark (`MTEB(cmn, v1)`) ships duplicates and crashed keyed `{#each}` blocks.

## Stores (runes singletons)

All four under `src/lib/stores/*.svelte.ts` use the same factory-with-closure pattern. **Read these before adding new state.** Notable gotchas:

- `leaderboard.select(name)` uses an `inflight` counter to discard stale async results.
- `filters.initFor(summary)` is **write-only** — never read `state.*` from the effect that calls it, or you'll hit `effect_update_depth_exceeded`.
- `pinnedModels` is a single shared `Set<string>` across every table. Each model-row table sorts pinned rows to top via its own `sortedRows = $derived.by(...)`.
- `sort.svelte.ts` exports `createSortState<K>()` per-table; state syncs to URL via `replaceState()`.

## Svelte 5 conventions

- Runes mode is enforced for project files. Stores use `$state(...)`, never legacy `writable`/`readable`.
- `$derived(expr)` for values, `$derived.by(() => { ... })` for blocks. `$derived(() => fn())` stores the function — bug.
- `let foo = $state(prop)` triggers "captures initial value"; wrap with `untrack(() => prop ?? default)` for one-shot prop snapshots (see `RangeSlider`, `FilterContent`).
- **`$state.raw` for large reassigned objects.** If a field is only ever `field = newValue` (no deep mutation), use `$state.raw`. Heavy payloads (`benchmark`, `summary`, `availableTasks`, the `available*` lists in `filters.svelte.ts`) all do.
- **`$effect` is not a data fetcher.** Don't write `$effect(() => { someAsync().then(v => state = v) })`. Use a `+page.ts` `load` instead.
- `{#each}` keys must be content-derived (`name` / `id` / composite), not array indices.

## SvelteKit load / data flow

Default shape: typed `+page.ts` loader that **streams** data via unresolved promises — direct visits get fully-resolved HTML, client-side nav paints shell + skeleton then fills in. Pages consume the promise in a `$effect` with a stale-guard. Use `cachedHttp` so warm-cache navs resolve synchronously.

- **Two loader shapes**:
  1. Single streamed promise (`/tasks`, `/benchmarks` index): loader returns `{ tasks: derivePromise() }`; page reads via `$effect` + `data.tasks === p` stale-guard.
  2. Eager metadata + client-side scores (`/tasks/[name]`, `/models/[...name]`, `/`): `await` cheap metadata in `load()`; heavy `/scores` fetched in a client-only `$effect` directly. Streaming `/scores` during prerender added ~1000 round-trips and bloated HTML; this keeps the hero prerendered while scores hydrate client-side. Stale-guard via `taskName === name` inside the effect.
- **Streamed promises must never reject during prerender** — wrap potentially-failing fetches in a discriminated union: `Promise<{ ok: true; data: T } | { ok: false; error: string }>` (see `ScoresResult`).
- **Prefetch via `data-sveltekit-preload-data="hover"`** (set globally in `app.html`). Detail loaders must **return** the prefetched value, not just call `loadFoo()` (side-effect calls only warm the build process's cache). Pair with a service-level `primeFooCache(name, value)` that calls `cacheTouch` from the page's `$effect`. See `/benchmark/[name]`.
- **Thread `event.fetch` from every `+page.ts`** into `loadFoo(name, fetch)` — SvelteKit inlines the response into prerendered HTML/data so hydration reads from the inlined cache. Non-loader callers omit it.
- `PageLoad` annotation is mandatory on every `export const load`. `EntryGenerator` for `entries()`. `let { data }: { data: PageData } = $props()`.
- **Reactive deps via `$derived`, not initial-value capture.** `const x = data.foo` triggers the warning on re-runnable loaders; use `let x = $derived(data.foo)`.
- **Filter set seeding is one-shot** — guard with `let filtersSeeded = false` to avoid clobbering user picks on `invalidate()` re-runs.
- **Filter locally before adding a refetch.** Full registries are small; predicate-filter in `buildPasses()` rather than threading a new param into the API call.
- `redirect()` / `error()` from `@sveltejs/kit` are **throws** — never wrap in `try/catch`. Detail loaders use `.catch((e) => { if (e instanceof HttpError && e.status === 404) error(404, ...); throw e })`.

## Charts

`src/lib/components/PlotlyChart.svelte` is the only Plotly import site, via `await import('plotly.js-dist-min')` in `onMount` — keeps Plotly out of SSR and initial JS. Figure specs in `src/lib/charts/figures.ts` return `{ data, layout }` without colors. Theme handling is in the wrapper: resolve `--ink-strong` / `--text` / `--border` / `--surface` via a probe element (`getPropertyValue` returns the unresolved `light-dark()` expression), and re-render on `MutationObserver(data-theme)` + `prefers-color-scheme` change.

## Theme + style system

- `src/app.css` declares per-token light/dark pairs and exposes live tokens via `light-dark(...)`. `ThemeToggle` pins `<html data-theme="light"|"dark">`; an inline `app.html` script reads `localStorage` pre-paint to avoid FOUC.
- **`--tint-*` palette** (blue / purple / green / orange / amber / pink / azure / teal, each with `-fg`) is the canonical category color set. Always use `--tint-X` instead of hardcoded hex; dark variants are pre-tuned. Per-category mappings:
  - **Model type** — dense=blue, cross-encoder=orange, late-interaction=green, sparse=amber, router=purple
  - **Task type** — Classification=blue, Clustering=orange, Pair/Multilabel=green, Reranking=amber/orange, Retrieval=purple, STS=pink, BitextMining=azure, Summarization=teal
  - **Modality** — text=teal, image=blue, audio=amber, video=purple
- **Heat-shading** on score cells uses the shared `heat(score, min, max)` in `src/lib/format.ts` (returns `color-mix(in srgb, var(--heat) <pct>%, transparent)`). Bounds via `minOf` / `maxOf`. Don't duplicate.
- Best-in-column is **bold only**, not orange — the cell already wears its heat color.

## Cards + sticky shelves

Overview cards (`/`, `/benchmarks`, `/tasks`, `/models`) share the **accent-rail** shape:

- `.card` is `var(--surface)` with neutral border, `16px 16px 16px 18px` padding (extra left for the rail), 12px gap. **No** top stripe, **no** gradient band.
- Rail is the shared `.accent-rail` utility (4px wide `::before` reading `--card-accent`). Per-category attribute blocks (`[data-modality]` / `[data-stype]` / `[data-type]`) set `--card-accent` + `--card-tint`. Don't reintroduce per-component `::before` copies.
- Badges read `--modality-tint` from their **own** `data-modality`, not from the card's `--card-accent` — text/image/audio/video render distinct colors.
- Layout order: `.card-head` → `.desc` (2-line clamp) → `.stats` (2×2 dl grid) → optional `.newer-note` → `.badges` (`margin-top: auto`).
- Hover: `translateY(-1px)`, border tinted by `--card-accent`, `.title` color → `--card-accent`.

Sticky toolbars dock at `top: var(--header-offset, 56px)`, `z-index: 5`, `backdrop-filter: blur(14px) saturate(140%)`. `/benchmark/[name]`'s toolbar is **not** sticky — would collide with `SummaryTable`'s sticky thead.

## Tooltip portal pattern

The `SummaryTable` column-header tooltip is **not** a child of the `<th>`. It's mounted at the `.summary` root, sibling to `.scroll`, positioned via `position: fixed` from `getBoundingClientRect()`. Why: `.scroll` has `overflow: auto` (would clip) and `<th>` is `position: sticky` with its own stacking context (the neighboring sticky Model column would paint over a fixed descendant). Mirror this pattern if a new table needs hover tips.

## Filter "all-on = filter off"

`/tasks` and `/benchmarks` seed each sidebar filter set with every available value at load. Treat `filter.size === ALL.length` as "no filter" and **skip** the `.some()` check entirely — without this, rows with empty facet arrays silently drop out (since `[].some(...)` is false). See `modalityOff` / `taskTypeOff` / `domainOff` short-circuits.

## URL state

Anything shareable / reloadable lives in the URL. `sort.svelte.ts`, `filters.svelte.ts` (microtask-debounced via `doSync()`), and `pinned.svelte.ts` (`?pin=`) all sync via `replaceState()` from `$app/navigation` — never `pushState` (filter toggles don't deserve back-history). `ShareUrlButton` just reads `page.url.href`.

## Static adapter

- `adapter-static` with `fallback: '404.html'`. `paths.base` from `BASE_PATH`. `paths.relative: false` (relative `_app/...` URLs break under HF Spaces reverse proxy).
- `kit.version.name` is the git short SHA, polled every 60s. Root layout watches `updated.current` and forces reload on next nav so deploys land without cache-clear.
- `kit.prerender.handleMissingId: 'warn'` — some in-page anchors only exist post-hydration.
- HF nginx fallback: `$uri $uri.html $uri/ /404.html`, `port_in_redirect off`, `absolute_redirect off`.

## Icons (lucide)

- **Subpath imports only**: `import Activity from 'lucide-svelte/icons/activity'`. Never the barrel import — it walks thousands of `.svelte` modules through Vite's dep optimizer.
- Wrappers (`ModalityIcon`, `ModelTypeIcon`, `SortDirIcon`) map domain → glyph in one place; other call sites import directly.
- GitHub icons stay inline `<svg>` (Lucide doesn't ship one).
- `vite.config.ts` carries `ssr.noExternal: ['lucide-svelte']` — required because the package re-imports raw `.svelte` files. Any other Svelte-component package shipping raw `.svelte` needs the same treatment.
- Lucide ships legacy Svelte 4 components; `compilerOptions.runes` opts node_modules out of runes mode so they mount fine.

## Data shape

Types in `src/lib/types.ts` match FastAPI schemas one-to-one (pydantic camelCase aliases).

- `ModelMeta`: `name`, `displayName`, `org`, `modelType`, params, embedding dim, max tokens, zero-shot %, `modalities`. Display is `org/displayName`; search matches all three.
- Benchmark: `taskTypes`, `tasks`, `languages`, `domains`, `modalities`, `numModels`.
- `TaskMeta`: `type`, `simplifiedType`, `languages`, `domains`, `modalities`, `description`, dataset metadata, `numModels`.
- Summary: adds `tasksMeta: TaskMeta[]` and per-row `trainedOnTasks: string[]` (drives ⚠️ warning in `PerTaskTab`).

## Accessibility

- Icon-only buttons need `aria-label` — `title` isn't reliably announced.
- Unique per-route `<svelte:head><title>…</title>` is what SvelteKit's live-region announces on client-side nav.
- Composite widgets (`Tabs` role=tablist, `Segmented` role=radiogroup) implement the WAI-ARIA APG pattern: roving `tabindex`, keydown handlers on the wrapper, `queueMicrotask(() => buttons[next]?.focus())`. Mirror this for new tabsets.
- Post-nav focus lands on `<body>` — use `afterNavigate` + `.focus()` to land it elsewhere. Never `autofocus` (fires only on initial mount).
