import { PUBLIC_API_URL } from '$env/static/public';
import type {
	Benchmark,
	BenchmarkLeaders,
	BenchmarkPerLanguage,
	BenchmarkSummary,
	MenuEntry,
	ModelFilters,
	ModelMeta,
	ModelScores,
	TaskFilters,
	TaskMeta,
	TaskScores
} from '$lib/types';

// MUST use `$env/static/public` — `$env/dynamic/public` reads from a
// SvelteKit runtime object that adapter-static + nginx never populate,
// so any import that touches it throws → every page stays stuck on
// "Loading…". Static values are inlined at `vite build` time from the
// build env (Docker build-args / .env.local in dev).
const API = PUBLIC_API_URL?.trim() ?? '';

function noApiError(scope: string): Error {
	return new Error(`${scope}: PUBLIC_API_URL is not set. Configure a backend URL.`);
}

// All app loaders go through the versioned `/v1/` API surface.
// Infra paths the backend keeps at root (`/icon/...`, `/health`,
// `/metrics`) aren't routed through here, so the prefix is safe.
const API_BASE = `${API}/v1`;

// Loader callers should pass SvelteKit's `event.fetch` so the prerender
// response is inlined into the rendered HTML/data and hydration reads
// from the inlined cache instead of re-fetching. Non-loader callers
// (stores, $effects) omit it and get the global `fetch`, which is what
// they want.
type FetchFn = typeof globalThis.fetch;

async function http<T>(path: string, fetchFn: FetchFn = globalThis.fetch): Promise<T> {
	const res = await fetchFn(`${API_BASE}${path}`);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
	return (await res.json()) as T;
}

// Session-scoped LRU cache. Re-opening /tasks, /models, or any already-seen
// benchmark page becomes a synchronous cache hit — no network, no JSON parse.
// In-flight requests are deduped so a quick double-trigger doesn't fire two
// parallel fetches. Bounded so a long-lived tab that visits many benchmarks
// can't grow the cache without bound (each summary can be MB-sized).
const RESPONSE_CACHE_MAX = 64;
const responseCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function cacheTouch(path: string, value: unknown) {
	// Map preserves insertion order; re-inserting moves to most-recent.
	if (responseCache.has(path)) responseCache.delete(path);
	responseCache.set(path, value);
	while (responseCache.size > RESPONSE_CACHE_MAX) {
		const oldest = responseCache.keys().next().value;
		if (oldest === undefined) break;
		responseCache.delete(oldest);
	}
}

async function cachedHttp<T>(path: string, fetchFn?: FetchFn): Promise<T> {
	if (responseCache.has(path)) {
		// Touch to refresh LRU position.
		const v = responseCache.get(path) as T;
		cacheTouch(path, v);
		return v;
	}
	const existing = inflight.get(path);
	if (existing) return existing as Promise<T>;
	const p = http<T>(path, fetchFn)
		.then((v) => {
			cacheTouch(path, v);
			inflight.delete(path);
			return v;
		})
		.catch((e) => {
			inflight.delete(path);
			throw e;
		});
	inflight.set(path, p as Promise<unknown>);
	return p;
}

// ----------------------------------------------------------------------------
// ModelMeta org/displayName enrichment
//
// The API ships only `name` (the canonical HuggingFace identifier, e.g.
// "Qwen/Qwen3-Embedding-8B"). Org and display name are derived client-side
// so the backend isn't in the business of deciding what's a "display name".
// We mutate in place after fetch so every existing consumer of `m.org` /
// `m.displayName` keeps working without further changes.
// ----------------------------------------------------------------------------

function fillOrgAndDisplay(m: ModelMeta | null | undefined): ModelMeta | null | undefined {
	if (!m || !m.name) return m;
	if (m.org !== undefined && m.displayName !== undefined) return m;
	const i = m.name.indexOf('/');
	if (i >= 0) {
		m.org = m.org ?? m.name.slice(0, i);
		m.displayName = m.displayName ?? m.name.slice(i + 1);
	} else {
		m.org = m.org ?? '';
		m.displayName = m.displayName ?? m.name;
	}
	return m;
}

// Cache: enrichment is a one-way mutation, so the second call on a cached
// summary is wasted work iterating every row. WeakSet membership marks
// already-touched payloads so we skip cleanly.
const _enrichedSummaries = new WeakSet<BenchmarkSummary>();
function enrichSummary(s: BenchmarkSummary): BenchmarkSummary {
	if (_enrichedSummaries.has(s)) return s;
	for (const row of s.rows) fillOrgAndDisplay(row.model);
	// Sort + dedupe once at the boundary so SummaryTable / PerTaskTab
	// consumers can pass `summary.taskTypes` / `summary.tasks` through
	// without a per-render `[...arr].sort()` copy in their derived blocks.
	// Dedup matters: at least one benchmark (MTEB(cmn, v1)) ships the same
	// task twice in its registry list, which crashes keyed `{#each}` blocks
	// on the task list facet downstream.
	s.taskTypes = [...new Set(s.taskTypes)].sort((a, b) => a.localeCompare(b));
	s.tasks = [...new Set(s.tasks)].sort((a, b) => a.localeCompare(b));
	_enrichedSummaries.add(s);
	return s;
}

function enrichTaskScores(s: TaskScores): TaskScores {
	for (const row of s.rows) fillOrgAndDisplay(row.model);
	return s;
}

// Older / sparser task records ship some array fields as `null`, but the
// TS type optimistically declares them as `string[]`. Coerce to empty
// arrays at the boundary so every downstream consumer can call `.length`
// / `.some()` without a guard.
function normalizeTaskMeta(t: TaskMeta): TaskMeta {
	t.languages ??= [];
	t.domains ??= [];
	t.modalities ??= [];
	return t;
}

function enrichModelScores(s: ModelScores): ModelScores {
	fillOrgAndDisplay(s.model);
	return s;
}

export async function loadBenchmarkMenu(fetchFn?: FetchFn): Promise<MenuEntry[]> {
	if (!API) throw noApiError('loadBenchmarkMenu');
	return cachedHttp<MenuEntry[]>('/benchmarks/menu', fetchFn);
}

/** Flat list of every benchmark — including off-menu (`display_on_leaderboard=False`)
 *  entries so the /benchmarks catalogue can render them with the
 *  "newer version available" hint. The backend's `/benchmarks` returns
 *  the full set unconditionally now; there used to be an
 *  `?include_hidden=true` toggle, but the visible-only variant has no
 *  remaining consumer. */
export async function loadBenchmarks(fetchFn?: FetchFn): Promise<Benchmark[]> {
	if (!API) throw noApiError('loadBenchmarks');
	const out = await cachedHttp<Benchmark[]>(`/benchmarks`, fetchFn);
	// The bulk `/benchmarks` endpoint returns the same per-benchmark
	// shape as `/benchmarks/{name}`, so prime each entry's per-name
	// cache slot. The benchmark-detail prerender (`+page.ts` entries
	// generator) already pays for this bulk fetch to enumerate routes;
	// without priming, each per-route `load()` would re-fetch the same
	// data from the per-name endpoint — turning a cold prerender into
	// 1 + N network calls. Priming collapses that to 1.
	for (const b of out) cacheTouch(`/benchmarks/${encodeURIComponent(b.name)}`, b);
	return out;
}

export async function loadBenchmark(name: string, fetchFn?: FetchFn): Promise<Benchmark> {
	if (!API) throw noApiError('loadBenchmark');
	return cachedHttp<Benchmark>(`/benchmarks/${encodeURIComponent(name)}`, fetchFn);
}

// Pre-populate `cachedHttp` from a value the page received via SvelteKit's
// `+page.ts` data prop. Used by `/benchmark/[name]` to seed the cache from
// the loader's return value (prefetched on hover via
// `data-sveltekit-preload-data`), so the leaderboard store's subsequent
// `loadBenchmark(name)` call hits sync instead of going to the network.
//
// Build-time prerender populates the build process's cache, which doesn't
// reach the user's browser — this is the bridge that gets the prefetched
// data into the runtime cache the store actually reads from.
export function primeBenchmarkCache(name: string, value: Benchmark): void {
	cacheTouch(`/benchmarks/${encodeURIComponent(name)}`, value);
}

export async function loadSummary(
	benchmarkName: string,
	languages?: ReadonlyArray<string>,
	fetchFn?: FetchFn
): Promise<BenchmarkSummary> {
	if (!API) throw noApiError('loadSummary');
	// Path is `/scores` (consistent with /tasks/{name}/scores and
	// /models/{name}/scores). The backend keeps `/summary` as a
	// deprecated alias for one frontend deploy window. When `languages`
	// is set, the server recomputes `meanTask` / `meanTaskType` /
	// `scoresByTask` over only the subsets matching the picks; the
	// cache key includes the sorted-languages string so toggling the
	// language filter doesn't invalidate the canonical summary slot.
	let qs = '';
	if (languages && languages.length) {
		const unique = Array.from(new Set(languages)).sort();
		qs = `?languages=${unique.map(encodeURIComponent).join(',')}`;
	}
	return enrichSummary(
		await cachedHttp<BenchmarkSummary>(
			`/benchmarks/${encodeURIComponent(benchmarkName)}/scores${qs}`,
			fetchFn
		)
	);
}

/**
 * Per-(model, language) mean main_score for a benchmark. Lazy-loaded by
 * PerLanguageTab — replaces the synthetic placeholder formula. Returns
 * an empty rows list when the backend has no per-language data (e.g.
 * a benchmark with no `language` column in its long frame).
 */
export async function loadPerLanguage(
	benchmarkName: string,
	fetchFn?: FetchFn
): Promise<BenchmarkPerLanguage> {
	if (!API) throw noApiError('loadPerLanguage');
	return cachedHttp<BenchmarkPerLanguage>(
		`/benchmarks/${encodeURIComponent(benchmarkName)}/per-language`,
		fetchFn
	);
}

/**
 * Slim per-size-bucket leaders for a benchmark.
 *
 * Used by the home page to render top-by-size mini-tables without
 * pulling the full `/scores` payload (several MB on multilingual
 * benchmarks). Each bucket is a `[min, max]` tuple in billions of
 * parameters; pass `null` as `max` for the open-ended top bucket
 * (encoded on the wire as bare `min`).
 */
export async function loadLeaders(
	benchmarkName: string,
	buckets: ReadonlyArray<readonly [number, number | null]>,
	fetchFn?: FetchFn
): Promise<BenchmarkLeaders> {
	if (!API) throw noApiError('loadLeaders');
	// Wire format is a JSON-encoded array of [min, max] tuples — the
	// backend parses it as `?buckets=[[0,0.5],...,[5,null]]`. Single
	// query param keeps the URL cacheable by the shared cachedHttp
	// keyed-by-URL store while letting us express the structured
	// shape the user wanted.
	const buf: Array<[number, number | null]> = buckets.map(([lo, hi]) => [lo, hi]);
	const qs = `buckets=${encodeURIComponent(JSON.stringify(buf))}`;
	return cachedHttp<BenchmarkLeaders>(
		`/benchmarks/${encodeURIComponent(benchmarkName)}/leaders?${qs}`,
		fetchFn
	);
}

function toSnake(s: string): string {
	return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

function buildQuery(params: Record<string, unknown>): string {
	const sp = new URLSearchParams();
	for (const [rawKey, v] of Object.entries(params)) {
		if (v === undefined || v === null) continue;
		const k = toSnake(rawKey);
		if (Array.isArray(v)) {
			if (v.length === 0) continue;
			for (const item of v) sp.append(k, String(item));
		} else if (typeof v === 'boolean') {
			sp.append(k, v ? 'true' : 'false');
		} else {
			sp.append(k, String(v));
		}
	}
	const q = sp.toString();
	return q ? `?${q}` : '';
}

export async function loadTasks(filters: TaskFilters = {}, fetchFn?: FetchFn): Promise<TaskMeta[]> {
	if (!API) throw noApiError('loadTasks');
	const out = await cachedHttp<TaskMeta[]>(
		`/tasks${buildQuery(filters as Record<string, unknown>)}`,
		fetchFn
	);
	for (const t of out) normalizeTaskMeta(t);
	return out;
}

export async function loadTask(name: string, fetchFn?: FetchFn): Promise<TaskMeta> {
	if (!API) throw noApiError('loadTask');
	return normalizeTaskMeta(
		await cachedHttp<TaskMeta>(`/tasks/${encodeURIComponent(name)}`, fetchFn)
	);
}

export async function loadTaskScores(name: string, fetchFn?: FetchFn): Promise<TaskScores> {
	if (!API) throw noApiError('loadTaskScores');
	return enrichTaskScores(
		await cachedHttp<TaskScores>(`/tasks/${encodeURIComponent(name)}/scores`, fetchFn)
	);
}

export async function loadModels(
	filters: ModelFilters = {},
	fetchFn?: FetchFn
): Promise<ModelMeta[]> {
	if (!API) throw noApiError('loadModels');
	const out = await cachedHttp<ModelMeta[]>(
		`/models${buildQuery(filters as Record<string, unknown>)}`,
		fetchFn
	);
	for (const m of out) fillOrgAndDisplay(m);
	return out;
}

export async function loadModel(name: string, fetchFn?: FetchFn): Promise<ModelMeta> {
	if (!API) throw noApiError('loadModel');
	return fillOrgAndDisplay(
		await cachedHttp<ModelMeta>(`/models/${encodeURIComponent(name)}`, fetchFn)
	) as ModelMeta;
}

export async function loadModelScores(name: string, fetchFn?: FetchFn): Promise<ModelScores> {
	if (!API) throw noApiError('loadModelScores');
	return enrichModelScores(
		await cachedHttp<ModelScores>(`/models/${encodeURIComponent(name)}/scores`, fetchFn)
	);
}
