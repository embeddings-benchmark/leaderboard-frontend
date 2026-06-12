import { building } from '$app/environment';
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

// Must use `$env/static/public` — `$env/dynamic/public` requires a runtime
// the adapter-static build doesn't have.
const API = PUBLIC_API_URL?.trim() ?? '';

function noApiError(scope: string): Error {
	return new Error(`${scope}: PUBLIC_API_URL is not set. Configure a backend URL.`);
}

const API_BASE = `${API}/v1`;

// Loaders accept SvelteKit's `event.fetch` so prerender responses are inlined
// into the HTML/data payload.
type FetchFn = typeof globalThis.fetch;

// Typed so loaders can distinguish 404s from transient backend failures and
// throw `error(404, ...)` for the former without false-positiving on 5xx /
// network errors.
export class HttpError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		public path: string
	) {
		super(`${status} ${statusText} — ${path}`);
		this.name = 'HttpError';
	}
}

async function http<T>(path: string, fetchFn: FetchFn = globalThis.fetch): Promise<T> {
	const res = await fetchFn(`${API_BASE}${path}`);
	if (!res.ok) throw new HttpError(res.status, res.statusText, path);
	return (await res.json()) as T;
}

// Session-scoped LRU + in-flight dedupe. Bounded so a long-lived tab
// visiting many benchmarks (each summary MB-sized) doesn't grow unbounded.
// Raised during prerender so `loadBenchmarks() / loadTasks() / loadModels()`
// can prime every per-name slot (~500 each) without evicting them before
// the per-page loaders run — every detail-route load becomes a sync cache
// hit instead of a fresh HTTP round-trip.
const RESPONSE_CACHE_MAX = building ? 10_000 : 64;
const responseCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function cacheTouch(path: string, value: unknown) {
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

// API ships only `name` ("org/displayName" HF identifier); derive the split
// client-side and mutate in place.
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

// WeakSet marks already-enriched payloads — a second call on a cached summary
// would iterate every row for no effect.
const _enrichedSummaries = new WeakSet<BenchmarkSummary>();
function enrichSummary(s: BenchmarkSummary): BenchmarkSummary {
	if (_enrichedSummaries.has(s)) return s;
	for (const row of s.rows) fillOrgAndDisplay(row.model);
	// Dedupe required: MTEB(cmn, v1) ships duplicate task names, which crash
	// keyed `{#each}` blocks downstream.
	s.taskTypes = [...new Set(s.taskTypes)].sort((a, b) => a.localeCompare(b));
	s.tasks = [...new Set(s.tasks)].sort((a, b) => a.localeCompare(b));
	_enrichedSummaries.add(s);
	return s;
}

function enrichTaskScores(s: TaskScores): TaskScores {
	for (const row of s.rows) fillOrgAndDisplay(row.model);
	return s;
}

// Older task records ship null arrays; coerce so downstream `.length` / `.some()`
// calls don't need guards.
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

/** Flat list of every benchmark, including off-menu and hidden entries. */
export async function loadBenchmarks(fetchFn?: FetchFn): Promise<Benchmark[]> {
	if (!API) throw noApiError('loadBenchmarks');
	const out = await cachedHttp<Benchmark[]>(`/benchmarks?include_hidden=true`, fetchFn);
	// Prime per-name slots so the prerender enumerator's `loadBenchmark` calls
	// hit cache instead of issuing 1+N requests.
	for (const b of out) cacheTouch(`/benchmarks/${encodeURIComponent(b.name)}`, b);
	return out;
}

export async function loadBenchmark(name: string, fetchFn?: FetchFn): Promise<Benchmark> {
	if (!API) throw noApiError('loadBenchmark');
	return cachedHttp<Benchmark>(`/benchmarks/${encodeURIComponent(name)}`, fetchFn);
}

// Bridge a `+page.ts` data value into the runtime cache so a subsequent
// `loadBenchmark(name)` call resolves synchronously.
export function primeBenchmarkCache(name: string, value: Benchmark): void {
	cacheTouch(`/benchmarks/${encodeURIComponent(name)}`, value);
}

export async function loadSummary(
	benchmarkName: string,
	languages?: ReadonlyArray<string>,
	fetchFn?: FetchFn
): Promise<BenchmarkSummary> {
	if (!API) throw noApiError('loadSummary');
	// Sort languages so the cache key is stable across pick order.
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

/** Per-(model, language) mean main_score; empty rows when no per-language data exists. */
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

/** Slim per-size-bucket leaders; `null` max = open-ended top bucket. */
export async function loadLeaders(
	benchmarkName: string,
	buckets: ReadonlyArray<readonly [number, number | null]>,
	fetchFn?: FetchFn
): Promise<BenchmarkLeaders> {
	if (!API) throw noApiError('loadLeaders');
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
	// Mirror the benchmarks priming: warm per-name slots so each detail
	// route's `loadTask(name)` is a sync cache hit during prerender. Only
	// safe to prime when the catalog isn't narrowed — a filtered list
	// doesn't represent the per-name resource.
	const prime = Object.keys(filters).length === 0;
	for (const t of out) {
		normalizeTaskMeta(t);
		if (prime) cacheTouch(`/tasks/${encodeURIComponent(t.name)}`, t);
	}
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
	const prime = Object.keys(filters).length === 0;
	for (const m of out) {
		fillOrgAndDisplay(m);
		if (prime) cacheTouch(`/models/${encodeURIComponent(m.name)}`, m);
	}
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
