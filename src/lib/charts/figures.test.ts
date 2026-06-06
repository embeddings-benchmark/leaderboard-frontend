import { describe, expect, it } from 'vitest';
import type { BenchmarkSummary, ModelMeta, SummaryRow, TaskMeta } from '$lib/types';
import { performanceOverTimePlot, performanceSizePlot, radarPlot } from './figures';

function model(name: string, overrides: Partial<ModelMeta> = {}): ModelMeta {
	return {
		name,
		displayName: name,
		org: '',
		zeroShotPct: 100,
		activeParamsB: 1,
		totalParamsB: 1,
		embeddingDim: 768,
		maxTokens: 512,
		modelType: 'dense',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: true,
		releaseDate: '2024-01-01',
		...overrides
	};
}

function row(rank: number, m: ModelMeta, mean: number | null, byType = {}): SummaryRow {
	return {
		rank,
		model: m,
		zeroShotPct: m.zeroShotPct,
		activeParamsB: m.activeParamsB,
		totalParamsB: m.totalParamsB,
		embeddingDim: m.embeddingDim,
		maxTokens: m.maxTokens,
		meanTask: mean,
		meanTaskType: mean,
		scoresByTask: {},
		scoresByTaskType: byType
	};
}

function task(name: string, type: string): TaskMeta {
	return {
		name,
		type,
		simplifiedType: type.toLowerCase(),
		languages: ['eng-Latn'],
		domains: ['general'],
		modalities: ['text'],
		description: ''
	};
}

function summary(rows: SummaryRow[], taskTypes: string[] = []): BenchmarkSummary {
	return {
		benchmarkName: 'TestBench',
		taskTypes,
		tasks: [],
		tasksMeta: taskTypes.map((t, i) => task(`T${i}`, t)),
		rows,
		aggregations: ['mean_task']
	};
}

describe('performanceSizePlot', () => {
	it('drops rows with no active params or null meanTask', () => {
		const a = row(1, model('a', { activeParamsB: 1 }), 0.7);
		const b = row(2, model('b', { activeParamsB: 0 }), 0.5); // dropped: no params
		const c = row(3, model('c', { activeParamsB: 2 }), null); // dropped: null mean
		const spec = performanceSizePlot(summary([a, b, c]));
		const trace = spec.data[0] as { x: number[]; y: number[] };
		expect(trace.x).toEqual([1e9]);
		expect(trace.y).toEqual([70]);
	});

	it('highlights pinned rows with a thicker marker outline', () => {
		const a = row(1, model('a', { activeParamsB: 1 }), 0.7);
		const b = row(2, model('b', { activeParamsB: 1 }), 0.6);
		const spec = performanceSizePlot(summary([a, b]), new Set(['b']));
		const trace = spec.data[0] as { marker: { line: { width: number[] } } };
		// Order matches the filtered rows: a (not pinned), b (pinned).
		expect(trace.marker.line.width).toEqual([0.5, 3]);
	});

	it('uses a log-scale x-axis', () => {
		const spec = performanceSizePlot(summary([row(1, model('a'), 0.5)]));
		// xaxis.type = 'log' is the load-bearing assertion for the param-vs-perf
		// plot — spans many orders of magnitude across small SBERT vs 70B LLMs.
		const xaxis = (spec.layout.xaxis ?? {}) as { type?: string };
		expect(xaxis.type).toBe('log');
	});
});

describe('performanceOverTimePlot', () => {
	it('always emits the (frontier, scatter) trace pair', () => {
		const a = row(1, model('a', { releaseDate: '2024-01-01' }), 0.6);
		const spec = performanceOverTimePlot(summary([a]));
		expect(spec.data).toHaveLength(2);
		expect((spec.layout.xaxis as { type?: string }).type).toBe('date');
	});

	it('drops rows missing a release date or meanTask before plotting', () => {
		const dated = row(1, model('a', { releaseDate: '2024-01-01' }), 0.6);
		const undated = row(2, model('b', { releaseDate: undefined }), 0.7);
		const nullMean = row(3, model('c', { releaseDate: '2025-01-01' }), null);
		const spec = performanceOverTimePlot(summary([dated, undated, nullMean]));
		const scatter = spec.data[1] as { x: string[]; y: number[] };
		expect(scatter.x).toEqual(['2024-01-01']);
		expect(scatter.y).toEqual([60]);
	});

	it('sorts points chronologically and builds a monotone Pareto frontier', () => {
		// Out of order on purpose; should sort by date asc and never regress the frontier.
		const a = row(1, model('a', { releaseDate: '2025-06-15' }), 0.85);
		const b = row(2, model('b', { releaseDate: '2024-01-01' }), 0.6);
		const c = row(3, model('c', { releaseDate: '2024-12-01' }), 0.7);
		const d = row(4, model('d', { releaseDate: '2026-03-01' }), 0.55); // weaker, after peak
		const spec = performanceOverTimePlot(summary([a, b, c, d]));
		const frontier = (spec.data[0] as { y: number[] }).y;
		// Cumulative max in chronological order: 60, 70, 85, 85.
		expect(frontier).toEqual([60, 70, 85, 85]);
	});
});

describe('radarPlot', () => {
	it('returns an empty spec when fewer than 2 task types', () => {
		const a = row(1, model('a'), 0.7, { OnlyOne: 0.7 });
		expect(radarPlot(summary([a], ['OnlyOne'])).data).toEqual([]);
	});

	it('returns an empty spec when there are no rows', () => {
		expect(radarPlot(summary([], ['A', 'B'])).data).toEqual([]);
	});

	it('emits one trace per top-5 model, closed back to the first axis', () => {
		const rows = Array.from({ length: 7 }, (_, i) =>
			row(i + 1, model(`m${i}`), 0.5, { A: 0.5, B: 0.6, C: 0.7 })
		);
		const spec = radarPlot(summary(rows, ['A', 'B', 'C']));
		// Top-5 cap.
		expect(spec.data).toHaveLength(5);
		// Each trace closes back to the first axis: theta has 4 entries (3 types + repeat).
		for (const trace of spec.data as { theta: string[]; r: number[] }[]) {
			expect(trace.theta).toEqual(['A', 'B', 'C', 'A']);
			expect(trace.r).toHaveLength(4);
			expect(trace.r[0]).toBe(trace.r[trace.r.length - 1]);
		}
	});
});
