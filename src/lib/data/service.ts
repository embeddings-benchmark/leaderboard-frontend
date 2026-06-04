import { env } from '$env/dynamic/public';
import type {
	Benchmark,
	BenchmarkLeaders,
	BenchmarkSummary,
	MenuEntry,
	ModelFilters,
	ModelMeta,
	ModelScores,
	TaskFilters,
	TaskMeta,
	TaskScores
} from '$lib/types';
import { BENCHMARK_INDEX, BENCHMARK_MENU, DEFAULT_BENCHMARK_NAME } from './mockBenchmarks';
import { buildMockSummary } from './mockSummary';

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

async function http<T>(path: string): Promise<T> {
	const res = await fetch(`${API}${path}`);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
	return (await res.json()) as T;
}

// Session-scoped in-memory cache. Re-opening /tasks, /models, or any
// already-seen benchmark page becomes a synchronous cache hit — no network,
// no JSON parse. We dedupe in-flight requests so a quick double-trigger (e.g.
// effect re-fire from a filter change) doesn't fire two parallel fetches.
const responseCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

async function cachedHttp<T>(path: string): Promise<T> {
	if (responseCache.has(path)) return responseCache.get(path) as T;
	const existing = inflight.get(path);
	if (existing) return existing as Promise<T>;
	const p = http<T>(path)
		.then((v) => {
			responseCache.set(path, v);
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

function enrichSummary(s: BenchmarkSummary): BenchmarkSummary {
	for (const row of s.rows) fillOrgAndDisplay(row.model);
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
		return BENCHMARK_MENU;
	}
	return cachedHttp<MenuEntry[]>('/benchmarks/menu');
}

export async function loadBenchmark(name: string): Promise<Benchmark> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadBenchmark');
		const benchmark = BENCHMARK_INDEX[name];
		if (!benchmark) throw new Error(`Unknown benchmark: ${name}`);
		return benchmark;
	}
	return cachedHttp<Benchmark>(`/benchmarks/${encodeURIComponent(name)}`);
}

export async function loadSummary(benchmarkName: string): Promise<BenchmarkSummary> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadSummary');
		return buildMockSummary(benchmarkName);
	}
	// Path is `/scores` (consistent with /tasks/{name}/scores and
	// /models/{name}/scores). The backend keeps `/summary` as a
	// deprecated alias for one frontend deploy window.
	return enrichSummary(
		await cachedHttp<BenchmarkSummary>(`/benchmarks/${encodeURIComponent(benchmarkName)}/scores`)
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
									displayName: top.model.displayName,
									org: top.model.org,
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
		return buildMockSummary(DEFAULT_BENCHMARK_NAME).tasksMeta;
	}
	return cachedHttp<TaskMeta[]>(`/tasks${buildQuery(filters as Record<string, unknown>)}`);
}

export async function loadTask(name: string): Promise<TaskMeta> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadTask');
		const meta = buildMockSummary(DEFAULT_BENCHMARK_NAME).tasksMeta.find((t) => t.name === name);
		if (!meta) throw new Error(`Unknown task: ${name}`);
		return meta;
	}
	return cachedHttp<TaskMeta>(`/tasks/${encodeURIComponent(name)}`);
}

export async function loadTaskScores(name: string): Promise<TaskScores> {
	if (!API) {
		if (!USE_MOCK) throw noApiError('loadTaskScores');
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

export { DEFAULT_BENCHMARK_NAME };
