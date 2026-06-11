// Tiny mock backend for Playwright e2e — listens on $MOCK_API_PORT (8787
// by default) and serves the minimum subset of `/v1/...` endpoints needed
// by the test suite and the build's prerender `entries()` walks.
//
// Reuses the fixtures that used to live in `src/lib/data/` (recovered from
// git history at 2bd2b80^ and parked under `tests/fixtures/`) so the mock
// returns realistic shapes — MTEB(eng, v2), MTEB(Multilingual, v2) with
// a populated `languageView`, etc.

import { createServer } from 'node:http';
import { BENCHMARK_INDEX, BENCHMARK_MENU } from './fixtures/mockBenchmarks';
import { buildMockSummary } from './fixtures/mockSummary';
import type { TaskMeta, ModelMeta } from '../src/lib/types';

const PORT = parseInt(process.env.MOCK_API_PORT || '8787', 10);

// Cache summaries so repeated /scores calls don't redo the deterministic
// row generation. Build prerender alone hits each one many times.
const summaryCache = new Map<string, ReturnType<typeof buildMockSummary>>();
function getSummary(name: string) {
	let s = summaryCache.get(name);
	if (!s) {
		s = buildMockSummary(name);
		summaryCache.set(name, s);
	}
	return s;
}

// Minimal task/model stubs — at least one entry each so SvelteKit's
// prerender `entries()` for tasks/[name] and models/[...name] produce
// something (`handleUnseenRoutes` otherwise fails the build).
const MOCK_TASKS: TaskMeta[] = [
	{
		name: 'MockTask',
		type: 'Retrieval',
		simplifiedType: 'retrieval',
		languages: ['English'],
		domains: ['General'],
		modalities: ['text'],
		description: 'Mock retrieval task for e2e'
	},
	{
		// Distinct simplifiedType so the /tasks type-filter universe isn't a singleton.
		name: 'MockClassificationTask',
		type: 'Classification',
		simplifiedType: 'classification',
		languages: ['English'],
		domains: ['General'],
		modalities: ['text'],
		description: 'Mock classification task for e2e'
	}
];
const MOCK_MODELS: ModelMeta[] = [
	{
		name: 'mock-org/mock-model',
		displayName: 'mock-model',
		org: 'mock-org',
		zeroShotPct: 100,
		activeParamsB: 0.1,
		totalParamsB: 0.1,
		embeddingDim: 384,
		maxTokens: 512,
		modelType: 'dense',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: true,
		modalities: ['text'],
		// Multi-language universe for /models language URL-roundtrip test.
		languages: ['English', 'Spanish', 'French']
	},
	{
		// Distinct model type so /models model-type filter has a multi-option universe.
		name: 'mock-org/mock-cross-encoder',
		displayName: 'mock-cross-encoder',
		org: 'mock-org',
		zeroShotPct: 100,
		activeParamsB: 0.05,
		totalParamsB: 0.05,
		embeddingDim: 0,
		maxTokens: 512,
		modelType: 'cross-encoder',
		instructionTuned: false,
		openWeights: false,
		sentenceTransformersCompatible: false,
		modalities: ['text'],
		languages: ['English']
	}
];

function json(res: import('node:http').ServerResponse, body: unknown, status = 200) {
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*'
	});
	res.end(JSON.stringify(body));
}

createServer((req, res) => {
	const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
	const path = url.pathname;

	if (path === '/v1/benchmarks/menu') return json(res, BENCHMARK_MENU);
	if (path === '/v1/benchmarks') return json(res, Object.values(BENCHMARK_INDEX));

	if (path === '/v1/tasks') return json(res, MOCK_TASKS);
	if (path === '/v1/models') return json(res, MOCK_MODELS);

	if (path.startsWith('/v1/benchmarks/')) {
		const rest = path.slice('/v1/benchmarks/'.length);
		const slash = rest.indexOf('/');
		const encName = slash === -1 ? rest : rest.slice(0, slash);
		const sub = slash === -1 ? '' : rest.slice(slash + 1);
		const name = decodeURIComponent(encName);
		const bench = BENCHMARK_INDEX[name];
		if (!bench) return json(res, { error: 'not found', name }, 404);
		if (!sub) return json(res, bench);
		if (sub === 'scores') return json(res, getSummary(name));
		if (sub === 'leaders') return json(res, { benchmarkName: name, buckets: [] });
		if (sub === 'per-language') return json(res, { benchmarkName: name, rows: [] });
	}

	if (path.startsWith('/v1/tasks/')) {
		const sub = path.slice('/v1/tasks/'.length);
		if (sub.endsWith('/scores')) {
			const name = decodeURIComponent(sub.slice(0, -'/scores'.length));
			const task = MOCK_TASKS.find((t) => t.name === name) ?? MOCK_TASKS[0];
			return json(res, { task, benchmarks: [], subsets: [], rows: [] });
		}
		const task = MOCK_TASKS.find((t) => t.name === decodeURIComponent(sub)) ?? MOCK_TASKS[0];
		return json(res, task);
	}
	if (path.startsWith('/v1/models/')) {
		const sub = path.slice('/v1/models/'.length);
		if (sub.endsWith('/scores')) {
			const name = decodeURIComponent(sub.slice(0, -'/scores'.length));
			const model = MOCK_MODELS.find((m) => m.name === name) ?? MOCK_MODELS[0];
			return json(res, { model, taskTypes: [], rows: [] });
		}
		const model = MOCK_MODELS.find((m) => m.name === decodeURIComponent(sub)) ?? MOCK_MODELS[0];
		return json(res, model);
	}

	json(res, { error: 'not found', path }, 404);
}).listen(PORT, () => {
	console.log(`mock API listening on http://localhost:${PORT}`);
});
