import { describe, expect, it } from 'vitest';
import type { BenchmarkSummary, ModelMeta, SummaryRow, TaskMeta } from '$lib/types';
import {
	FRONTIER_RING_COLOR,
	eloPlot,
	eloPlotHeight,
	SIZE_FRONTIER_COLOR,
	performanceOverTimePlot,
	performanceSizePlot,
	radarPlot
} from './figures';

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
	it('drops rows with null active params or null meanTask', () => {
		const a = row(1, model('a', { activeParamsB: 1 }), 0.7);
		const b = row(2, model('b', { activeParamsB: null }), 0.5); // dropped: unknown params
		const c = row(3, model('c', { activeParamsB: 2 }), null); // dropped: null mean
		const spec = performanceSizePlot(summary([a, b, c]));
		const trace = spec.data[1] as { x: number[]; y: number[] };
		expect(trace.x).toEqual([1e9]);
		expect(trace.y).toEqual([70]);
	});

	it('clamps 0 active params to 1 instead of dropping the row', () => {
		// Static/model2vec models are entirely a lookup table, so their
		// active-parameter count (n_parameters - n_embedding_parameters) is
		// legitimately 0 — a log-scale axis can't place a point at 0, so we
		// clamp to 1 rather than dropping the model from the chart (#5079).
		const a = row(1, model('a', { activeParamsB: 0 }), 0.6);
		const spec = performanceSizePlot(summary([a]));
		const trace = spec.data[1] as { x: number[]; y: number[] };
		expect(trace.x).toEqual([1]);
		expect(trace.y).toEqual([60]);
	});

	it('includes known and unknown total parameters in hover data', () => {
		const known = row(1, model('known', { totalParamsB: 1.5 }), 0.7);
		const unknown = row(2, model('unknown', { totalParamsB: null }), 0.6);
		const spec = performanceSizePlot(summary([known, unknown]));
		const trace = spec.data[1] as {
			customdata: Array<Array<string | number>>;
			hovertemplate: string;
		};

		expect(trace.customdata[0][3]).toBe((1.5e9).toLocaleString());
		expect(trace.customdata[1][3]).toBe('—');
		expect(trace.hovertemplate).toContain('Total parameters: %{customdata[3]}');
		expect(trace.hovertemplate).toContain('Rank: %{customdata[4]}');
	});

	it('highlights pinned rows with a thicker marker outline', () => {
		const a = row(1, model('a', { activeParamsB: 1 }), 0.7);
		const b = row(2, model('b', { activeParamsB: 1 }), 0.6);
		const spec = performanceSizePlot(summary([a, b]), new Set(['b']));
		const trace = spec.data[1] as { marker: { line: { width: number[] } } };
		// Order matches the filtered rows: a (not pinned), b (pinned).
		expect(trace.marker.line.width).toEqual([0.5, 3]);
	});

	it('draws the Pareto frontier above the markers, sorted by size', () => {
		const big = row(1, model('big', { activeParamsB: 7 }), 0.7);
		const small = row(2, model('small', { activeParamsB: 0.1 }), 0.5);
		const off = row(3, model('off', { activeParamsB: 1 }), 0.4);
		const spec = performanceSizePlot({
			...summary([big, small, off]),
			paretoModels: new Set(['big', 'small'])
		});
		const frontier = spec.data[0] as {
			x: number[];
			y: number[];
			line: { color: string; width: number; shape: string };
			hoverinfo: string;
			zorder: number;
		};
		expect(spec.data).toHaveLength(2);
		expect(frontier.x).toEqual([0.1e9, 7e9]);
		expect(frontier.y).toEqual([50, 70]);
		// Plain step line, like the time chart's, in purple.
		expect(frontier.line).toEqual({ color: SIZE_FRONTIER_COLOR, width: 2, shape: 'hv' });
		expect(frontier.hoverinfo).toBe('skip');
		// Dense clusters would bury the line, so it sits over the markers (default zorder 0).
		expect(frontier.zorder).toBeGreaterThan(0);
	});

	it('colors bubbles by max tokens on a blue scale', () => {
		const spec = performanceSizePlot(summary([row(1, model('a'), 0.5)]));
		expect((spec.data[1] as { marker: { colorscale: string } }).marker.colorscale).toBe('Blues');
	});

	it('rings frontier markers in the frontier color, pinned rings winning', () => {
		const a = row(1, model('a'), 0.7);
		const b = row(2, model('b'), 0.6);
		const c = row(3, model('c'), 0.5);
		const spec = performanceSizePlot(
			{ ...summary([a, b, c]), paretoModels: new Set(['a', 'b']) },
			new Set(['b'])
		);
		const marker = (spec.data[1] as { marker: { line: { width: number[]; color: string[] } } })
			.marker;
		expect(marker.line.width).toEqual([2, 3, 0.5]);
		expect(marker.line.color[0]).toBe(FRONTIER_RING_COLOR);
		expect(marker.line.color[1]).toBe('#ff6f3c');
	});

	it('tags each bubble with its rowId so a side panel can find it', () => {
		const base = row(1, model('org/m'), 0.5);
		const variant = { ...row(2, model('org/m'), 0.6), experiments: { colbert: true } };
		const spec = performanceSizePlot(summary([base, variant]));
		expect((spec.data[1] as { ids: string[] }).ids).toEqual(['org/m', 'org/m::colbert_true']);
	});

	it('emits an empty frontier when the summary carries none', () => {
		const spec = performanceSizePlot(summary([row(1, model('a'), 0.5)]));
		expect((spec.data[0] as { x: number[] }).x).toEqual([]);
	});

	it('marks the best proprietary model with a dashed line, even without a size', () => {
		const open = row(1, model('open'), 0.8);
		// Closed models usually publish no param count — they still set the line.
		const best = row(2, model('closed-best', { openWeights: false, activeParamsB: null }), 0.75);
		const worse = row(3, model('closed-worse', { openWeights: false }), 0.6);
		const unscored = row(4, model('closed-partial', { openWeights: false }), null);
		const spec = performanceSizePlot(summary([open, best, worse, unscored]));
		const shapes = spec.layout.shapes as { y0: number; line: { dash: string } }[];
		const notes = spec.layout.annotations as { text: string }[];
		expect(shapes).toHaveLength(1);
		expect(shapes[0].y0).toBe(75);
		expect(shapes[0].line.dash).toBe('dash');
		expect(notes[0].text).toBe('Best proprietary: closed-best (75.00)');
	});

	it('omits the proprietary line when every model is open', () => {
		const spec = performanceSizePlot(summary([row(1, model('open'), 0.8)]));
		expect(spec.layout.shapes).toEqual([]);
		expect(spec.layout.annotations).toEqual([]);
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

	it('tags each marker with its rowId, oldest first', () => {
		const late = row(1, model('late', { releaseDate: '2025-01-01' }), 0.7);
		const early = row(2, model('early', { releaseDate: '2024-01-01' }), 0.6);
		const spec = performanceOverTimePlot(summary([late, early]));
		expect((spec.data[1] as { ids: string[] }).ids).toEqual(['early', 'late']);
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

describe('eloPlot', () => {
	const withElo = (r: SummaryRow, elo: number | null, low?: number, high?: number): SummaryRow => ({
		...r,
		elo,
		eloLow: low ?? null,
		eloHigh: high ?? null
	});

	it('orders best-first, caps at topN, and skips unrated rows', () => {
		const rows = [
			withElo(row(3, model('c'), 0.5), 1000, 990, 1010),
			withElo(row(1, model('a'), 0.5), 1200, 1180, 1225),
			withElo(row(2, model('b'), 0.5), 1100, 1090, 1112),
			withElo(row(4, model('d'), 0.5), null)
		];
		const spec = eloPlot(summary(rows), 2);
		const ys = spec.data.flatMap((t) => ((t as { text?: string[] }).text ?? []).map((x) => x));
		expect(ys.sort()).toEqual(['a', 'b']);
		const tick = (spec.layout.yaxis as { ticktext: string[] }).ticktext;
		expect(tick).toEqual(['a', 'b']);
	});

	it('draws asymmetric whiskers from the interval and one trace per model type', () => {
		const rows = [
			withElo(row(1, model('a', { modelType: 'dense' }), 0.5), 1200, 1180, 1225),
			withElo(row(2, model('b', { modelType: 'cross-encoder' }), 0.5), 1100, 1090, 1112)
		];
		const spec = eloPlot(summary(rows));
		expect(spec.data).toHaveLength(2);
		const dense = spec.data.find((t) => t.name === 'dense') as unknown as {
			error_x: { array: number[]; arrayminus: number[] };
		};
		expect(dense.error_x.array).toEqual([25]);
		expect(dense.error_x.arrayminus).toEqual([20]);
	});

	it('omits whiskers when no interval is available (filtered view)', () => {
		const spec = eloPlot(
			summary([withElo(row(1, model('a'), 0.5), 1200), withElo(row(2, model('b'), 0.5), 1100)])
		);
		expect((spec.data[0] as { error_x?: unknown }).error_x).toBeUndefined();
	});

	it('returns an empty spec with no ratings, and grows height with rows', () => {
		expect(eloPlot(summary([row(1, model('a'), 0.5)])).data).toEqual([]);
		expect(eloPlotHeight(100)).toBeGreaterThan(eloPlotHeight(10));
	});
});
