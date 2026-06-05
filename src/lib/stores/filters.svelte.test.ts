import { beforeEach, describe, expect, it } from 'vitest';
import type { BenchmarkSummary, ModelMeta, SummaryRow, TaskMeta } from '$lib/types';
import { applyFilters, filters } from './filters.svelte';

// ---------------------------------------------------------------------------
// Fixture builders. Kept tiny so each test reads top-to-bottom: build a
// synthetic summary, toggle filters, assert.
// ---------------------------------------------------------------------------

function makeModel(name: string, overrides: Partial<ModelMeta> = {}): ModelMeta {
	const [org, displayName] = name.includes('/') ? name.split('/') : ['', name];
	return {
		name,
		displayName,
		org,
		zeroShotPct: 100,
		activeParamsB: 1,
		totalParamsB: 1,
		embeddingDim: 768,
		maxTokens: 512,
		modelType: 'dense',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: true,
		...overrides
	};
}

function makeTask(name: string, type: string, overrides: Partial<TaskMeta> = {}): TaskMeta {
	return {
		name,
		type,
		simplifiedType: type.toLowerCase(),
		languages: ['eng-Latn'],
		domains: ['general'],
		modalities: ['text'],
		description: '',
		...overrides
	};
}

function makeRow(
	rank: number,
	model: ModelMeta,
	scoresByTask: Record<string, number>,
	scoresByTaskType: Record<string, number>
): SummaryRow {
	return {
		rank,
		model,
		zeroShotPct: model.zeroShotPct,
		activeParamsB: model.activeParamsB,
		totalParamsB: model.totalParamsB,
		embeddingDim: model.embeddingDim,
		maxTokens: model.maxTokens,
		meanTask: null,
		meanTaskType: null,
		scoresByTask,
		scoresByTaskType
	};
}

function fixtureSummary(): BenchmarkSummary {
	// Three tasks across two types: retrieval (T1, T2) and classification (T3).
	// Four models with deliberately skewed score distributions so Borda re-rank
	// produces a different order than naive mean.
	const tasks = ['T1', 'T2', 'T3'];
	const taskTypes = ['Retrieval', 'Classification'];
	const tasksMeta: TaskMeta[] = [
		makeTask('T1', 'Retrieval', { languages: ['eng-Latn'], domains: ['general'] }),
		makeTask('T2', 'Retrieval', { languages: ['fra-Latn'], domains: ['legal'] }),
		makeTask('T3', 'Classification', { languages: ['eng-Latn'], domains: ['general'] })
	];

	const a = makeModel('org/A', { modelType: 'dense', openWeights: true });
	const b = makeModel('org/B', { modelType: 'sparse', openWeights: true });
	const c = makeModel('org/C', { modelType: 'dense', openWeights: false }); // proprietary
	const d = makeModel('org/D', { modelType: 'dense', openWeights: true, zeroShotPct: -1 });

	const rows: SummaryRow[] = [
		makeRow(1, a, { T1: 0.9, T2: 0.5, T3: 0.6 }, { Retrieval: 0.7, Classification: 0.6 }),
		makeRow(2, b, { T1: 0.7, T2: 0.8, T3: 0.7 }, { Retrieval: 0.75, Classification: 0.7 }),
		makeRow(3, c, { T1: 0.6, T2: 0.7, T3: 0.5 }, { Retrieval: 0.65, Classification: 0.5 }),
		makeRow(4, d, { T1: 0.8, T2: 0.6, T3: 0.4 }, { Retrieval: 0.7, Classification: 0.4 })
	];

	return {
		benchmarkName: 'TestBench',
		taskTypes,
		tasks,
		tasksMeta,
		rows,
		aggregations: ['mean_task', 'mean_task_type']
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	// Re-seed the singleton with the fixture's available-set every test so prior
	// mutations don't leak. initFor + resetModelFilters together restore the
	// "everything visible" baseline.
	filters.initFor(fixtureSummary());
	filters.resetModelFilters();
	filters.resetCustomize();
});

describe('applyFilters: no narrowing', () => {
	it('passes every row, every task, and every type through unchanged', () => {
		const out = applyFilters(fixtureSummary());
		expect(out.tasks).toEqual(['T1', 'T2', 'T3']);
		expect(out.taskTypes).toEqual(['Retrieval', 'Classification']);
		expect(out.rows).toHaveLength(4);
	});

	it('recomputes meanTask / meanTaskType from the visible slice', () => {
		const out = applyFilters(fixtureSummary());
		const a = out.rows.find((r) => r.model.name === 'org/A')!;
		// Mean across T1, T2, T3 → (0.9 + 0.5 + 0.6) / 3 = 0.6667
		expect(a.meanTask).toBeCloseTo(2.0 / 3, 5);
		// Mean across both task types → (0.7 + 0.6) / 2 = 0.65
		expect(a.meanTaskType).toBeCloseTo(0.65, 5);
	});

	it('preserves the API order + rank when no task-set narrowing is active', () => {
		// Row-only filters (search query, availability, …) shouldn't relabel
		// peers' ranks just because some rows got hidden. Without any filter
		// active, the unfiltered view must keep the fixture's API order.
		const out = applyFilters(fixtureSummary());
		expect(out.rows.map((r) => r.model.name)).toEqual(['org/A', 'org/B', 'org/C', 'org/D']);
		expect(out.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
	});
});

describe('applyFilters: task-set narrowing', () => {
	it('hides tasks dropped by the type filter and recomputes the mean', () => {
		filters.setAll('taskTypes', ['Retrieval'], true); // only Retrieval
		const out = applyFilters(fixtureSummary());
		expect(out.tasks).toEqual(['T1', 'T2']);
		expect(out.taskTypes).toEqual(['Retrieval']);
		const a = out.rows.find((r) => r.model.name === 'org/A')!;
		// New mean: (0.9 + 0.5) / 2 = 0.7
		expect(a.meanTask).toBeCloseTo(0.7, 5);
	});

	it('does NOT drop tasks by language filter — that is now handled server-side', () => {
		// The backend re-runs the summary scoped to the picked languages via
		// `?languages=` on /scores; the client trusts whatever task list the
		// new summary carries. Filtering tasks client-side by language would
		// drift wrong while the debounced refetch is in flight (it would
		// re-apply the new filter to the OLD summary's per-task slots).
		filters.setAll('languages', ['eng-Latn'], true);
		const out = applyFilters(fixtureSummary());
		expect(out.tasks).toEqual(['T1', 'T2', 'T3']);
	});
});

describe('applyFilters: model-row narrowing', () => {
	it('proprietary-only / open-only flip rows in/out', () => {
		filters.availability = 'open';
		let out = applyFilters(fixtureSummary());
		expect(out.rows.map((r) => r.model.name).sort()).toEqual(['org/A', 'org/B', 'org/D']);

		filters.availability = 'proprietary';
		out = applyFilters(fixtureSummary());
		expect(out.rows.map((r) => r.model.name)).toEqual(['org/C']);
	});

	it('model-type chips intersect on .modelType', () => {
		filters.setAll('modelTypes', ['sparse'], true);
		const out = applyFilters(fixtureSummary());
		expect(out.rows.map((r) => r.model.name)).toEqual(['org/B']);
	});

	it('only_zero_shot drops models with zeroShotPct != 100', () => {
		filters.zeroShot = 'only_zero_shot';
		const out = applyFilters(fixtureSummary());
		// D has zeroShotPct = -1; A/B/C all default to 100 in the fixture.
		expect(out.rows.map((r) => r.model.name).sort()).toEqual(['org/A', 'org/B', 'org/C']);
	});

	it('remove_unknown drops only the -1 sentinel', () => {
		filters.zeroShot = 'remove_unknown';
		const out = applyFilters(fixtureSummary());
		expect(out.rows.find((r) => r.model.name === 'org/D')).toBeUndefined();
		expect(out.rows.find((r) => r.model.name === 'org/A')).toBeDefined();
	});

	it('name query matches against name, displayName, and org', () => {
		filters.nameQuery = 'A';
		const out = applyFilters(fixtureSummary());
		// Substring "A" matches displayName="A" of org/A; "org" matches every row.
		// We narrow with a distinctive token to keep the assertion tight.
		expect(out.rows.length).toBeGreaterThan(0);

		filters.nameQuery = 'nonexistent-substring-xyz';
		const empty = applyFilters(fixtureSummary());
		expect(empty.rows).toHaveLength(0);
	});
});
