import { env } from '$env/dynamic/public';
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
import { DEFAULT_BENCHMARK_NAME } from './defaults';

// Mock-data modules are dynamic-imported below so prod bundles (which run with
// `PUBLIC_API_URL` set + `USE_MOCK=0`) never ship the ~800-line fixture set.
type MockModule = typeof import('./mockBenchmarks');
type MockSummaryModule = typeof import('./mockSummary');
let _mockMod: Promise<MockModule> | null = null;
let _mockSumMod: Promise<MockSummaryModule> | null = null;
const loadMockBenchmarks = () => (_mockMod ??= import('./mockBenchmarks'));
const loadMockSummaryMod = () => (_mockSumMod ??= import('./mockSummary'));

// `$env/dynamic/public` is read at request time so the build doesn't fail when
// either env var is unset.
const API = env.PUBLIC_API_URL?.trim() ?? '';

// Mock data is opt-in: set ``PUBLIC_USE_MOCK=1`` to fall through to the
// deterministic mocks under ``$lib/data/mock*`` when there's no live API.
// Without this flag, every loader either talks to ``PUBLIC_API_URL`` or
// throws — preventing the production site from silently shipping mock data
// when an env var is missed.
const USE_MOCK = (env.PUBLIC_USE_MOCK ?? '').trim() === '1';

function noApiError(scope: string): Error {
	return new Error(
		`${scope}: PUBLIC_API_URL is not set. Configure a backend URL, or set ` +
			`PUBLIC_USE_MOCK=1 to use the offline mock data.`
	);
}

// All app loaders go through the versioned `/v1/` API surface.
// Infra paths the backend keeps at root (`/icon/...`, `/health`,
// `/metrics`) aren't routed through here, so the prefix is safe.
const API_BASE = `${API}/v1`;

async function http<T>(path: string): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`);
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

async function cachedHttp<T>(path: string): Promise<T> {
	if (responseCache.has(path)) {
		// Touch to refresh LRU position.
		const v = responseCache.get(path) as T;
		cacheTouch(path, v);
		return v;
	}
	const existing = inflight.get(path);
	if (existing) return existing as Promise<T>;
	const p = http<T>(path)
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
	// Sort once at the boundary so SummaryTable / PerTaskTab consumers can
	// pass `summary.taskTypes` / `summary.tasks` through without a per-render
	// `[...arr].sort()` copy in their derived blocks.
	s.taskTypes = [...s.taskTypes].sort((a, b) => a.localeCompare(b));
	s.tasks = [...s.tasks].sort((a, b) => a.localeCompare(b));
	_enrichedSummaries.add(s);
	return s;
}

function enrichTaskScores(s: TaskScores): TaskScores {
	for (const row of s.rows) fillOrgAndDisplay(row.model);
	return s;
}

function enrichModelScores(s: ModelScores): ModelScores {
	fillOrgAndDisplay(s.model);
	return s;
}

export async function loadBenchmarkMenu(): Promise<MenuEntry[]> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadBenchmarkMenu');
		return (await loadMockBenchmarks()).BENCHMARK_MENU;
	}
	return cachedHttp<MenuEntry[]>('/benchmarks/menu');
}

/** Flat list of every benchmark. `includeHidden=true` also returns
 *  off-menu benchmarks (`display_on_leaderboard=False`) so the
 *  /benchmarks catalogue can render them with the "newer version
 *  available" hint. */
export async function loadBenchmarks(includeHidden = false): Promise<Benchmark[]> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadBenchmarks');
		const { BENCHMARK_INDEX } = await loadMockBenchmarks();
		return Object.values(BENCHMARK_INDEX);
	}
	const qs = includeHidden ? '?include_hidden=true' : '';
	return cachedHttp<Benchmark[]>(`/benchmarks${qs}`);
}

export async function loadBenchmark(name: string): Promise<Benchmark> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadBenchmark');
		const { BENCHMARK_INDEX } = await loadMockBenchmarks();
		const benchmark = BENCHMARK_INDEX[name];
		if (!benchmark) throw new Error(`Unknown benchmark: ${name}`);
		return benchmark;
	}
	return cachedHttp<Benchmark>(`/benchmarks/${encodeURIComponent(name)}`);
}

export async function loadSummary(
	benchmarkName: string,
	languages?: ReadonlyArray<string>
): Promise<BenchmarkSummary> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadSummary');
		const { buildMockSummary } = await loadMockSummaryMod();
		return buildMockSummary(benchmarkName);
	}
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
			`/benchmarks/${encodeURIComponent(benchmarkName)}/scores${qs}`
		)
	);
}

/**
 * Per-(model, language) mean main_score for a benchmark. Lazy-loaded by
 * PerLanguageTab — replaces the synthetic placeholder formula. Returns
 * an empty rows list when the backend has no per-language data (e.g.
 * a benchmark with no `language` column in its long frame).
 */
export async function loadPerLanguage(benchmarkName: string): Promise<BenchmarkPerLanguage> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadPerLanguage');
		return { benchmarkName, rows: [] };
	}
	return cachedHttp<BenchmarkPerLanguage>(
		`/benchmarks/${encodeURIComponent(benchmarkName)}/per-language`
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
 *
 * Falls back to building leaders client-side from the mock summary
 * when `PUBLIC_USE_MOCK=1` and the API is unset — keeps the home
 * page working offline without a separate mock for this endpoint.
 */
export async function loadLeaders(
	benchmarkName: string,
	buckets: ReadonlyArray<readonly [number, number | null]>
): Promise<BenchmarkLeaders> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadLeaders');
		const summary = await loadSummary(benchmarkName);
		return {
			benchmarkName: summary.benchmarkName,
			buckets: buckets.map(([lo, hi]) => {
				const candidates = summary.rows.filter(
					(r) => r.totalParamsB > 0 && r.totalParamsB >= lo && (hi == null || r.totalParamsB < hi)
				);
				candidates.sort((a, b) => (b.meanTask ?? -1) - (a.meanTask ?? -1));
				const top = candidates[0];
				return {
					min: lo,
					max: hi,
					leader: top
						? {
								rank: top.rank,
								model: {
									name: top.model.name,
									modelType: top.model.modelType
								},
								meanTask: top.meanTask,
								totalParamsB: top.totalParamsB
							}
						: null
				};
			})
		};
	}
	// Wire format is a JSON-encoded array of [min, max] tuples — the
	// backend parses it as `?buckets=[[0,0.5],...,[5,null]]`. Single
	// query param keeps the URL cacheable by the shared cachedHttp
	// keyed-by-URL store while letting us express the structured
	// shape the user wanted.
	const buf: Array<[number, number | null]> = buckets.map(([lo, hi]) => [lo, hi]);
	const qs = `buckets=${encodeURIComponent(JSON.stringify(buf))}`;
	return cachedHttp<BenchmarkLeaders>(
		`/benchmarks/${encodeURIComponent(benchmarkName)}/leaders?${qs}`
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

export async function loadTasks(filters: TaskFilters = {}): Promise<TaskMeta[]> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadTasks');
		const { buildMockSummary } = await loadMockSummaryMod();
		return buildMockSummary(DEFAULT_BENCHMARK_NAME).tasksMeta;
	}
	return cachedHttp<TaskMeta[]>(`/tasks${buildQuery(filters as Record<string, unknown>)}`);
}

export async function loadTask(name: string): Promise<TaskMeta> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadTask');
		const { buildMockSummary } = await loadMockSummaryMod();
		const meta = buildMockSummary(DEFAULT_BENCHMARK_NAME).tasksMeta.find((t) => t.name === name);
		if (!meta) throw new Error(`Unknown task: ${name}`);
		return meta;
	}
	return cachedHttp<TaskMeta>(`/tasks/${encodeURIComponent(name)}`);
}

export async function loadTaskScores(name: string): Promise<TaskScores> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadTaskScores');
		const { buildMockSummary } = await loadMockSummaryMod();
		const summary = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		const meta = summary.tasksMeta.find((t) => t.name === name);
		if (!meta) throw new Error(`Unknown task: ${name}`);
		const rows = summary.rows
			.map((r) => ({
				rank: 0,
				model: r.model,
				score: r.scoresByTask[name] ?? 0,
				subsetScores: {},
				benchmarks: [summary.benchmarkName]
			}))
			.filter((r) => r.score > 0)
			.sort((a, b) => b.score - a.score);
		rows.forEach((r, i) => (r.rank = i + 1));
		return { task: meta, benchmarks: [summary.benchmarkName], subsets: [], rows };
	}
	return enrichTaskScores(
		await cachedHttp<TaskScores>(`/tasks/${encodeURIComponent(name)}/scores`)
	);
}

export async function loadModels(filters: ModelFilters = {}): Promise<ModelMeta[]> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadModels');
		const { buildMockSummary } = await loadMockSummaryMod();
		return buildMockSummary(DEFAULT_BENCHMARK_NAME).rows.map((r) => r.model);
	}
	const out = await cachedHttp<ModelMeta[]>(
		`/models${buildQuery(filters as Record<string, unknown>)}`
	);
	for (const m of out) fillOrgAndDisplay(m);
	return out;
}

export async function loadModel(name: string): Promise<ModelMeta> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadModel');
		const { buildMockSummary } = await loadMockSummaryMod();
		const meta = buildMockSummary(DEFAULT_BENCHMARK_NAME).rows.find(
			(r) => r.model.name === name
		)?.model;
		if (!meta) throw new Error(`Unknown model: ${name}`);
		return meta;
	}
	return fillOrgAndDisplay(
		await cachedHttp<ModelMeta>(`/models/${encodeURIComponent(name)}`)
	) as ModelMeta;
}

export async function loadModelScores(name: string): Promise<ModelScores> {
	if (!API) {
		const { buildMockSummary } = await loadMockSummaryMod();
		const summary = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		const row = summary.rows.find((r) => r.model.name === name);
		if (!row) throw new Error(`Unknown model: ${name}`);
		return {
			model: row.model,
			rows: [
				{
					benchmarkName: summary.benchmarkName,
					benchmarkDisplayName: summary.benchmarkName,
					rank: row.rank,
					totalModels: summary.rows.length,
					meanTask: row.meanTask,
					meanTaskType: row.meanTaskType,
					zeroShotPct: row.zeroShotPct,
					taskTypes: summary.taskTypes,
					scoresByTaskType: row.scoresByTaskType
				}
			]
		};
	}
	return enrichModelScores(
		await cachedHttp<ModelScores>(`/models/${encodeURIComponent(name)}/scores`)
	);
}
