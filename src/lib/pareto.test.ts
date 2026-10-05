import { describe, expect, it } from 'vitest';
import type { ModelMeta, SummaryRow } from '$lib/types';
import {
	datedRows,
	fmtParetoRange,
	paretoFrontier,
	paretoRanges,
	paretoStatus,
	recordSetters
} from './pareto';

function row(name: string, activeParamsB: number | null, meanTask: number | null): SummaryRow {
	const model: ModelMeta = {
		name,
		displayName: name,
		org: '',
		zeroShotPct: 100,
		activeParamsB,
		totalParamsB: activeParamsB,
		embeddingDim: 768,
		maxTokens: 512,
		modelType: 'dense',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: true
	};
	return {
		rank: 1,
		model,
		zeroShotPct: 100,
		activeParamsB,
		totalParamsB: activeParamsB,
		embeddingDim: 768,
		maxTokens: 512,
		meanTask,
		meanTaskType: meanTask,
		scoresByTask: {},
		scoresByTaskType: {}
	};
}

const sorted = (s: Set<string>) => [...s].sort();

describe('paretoFrontier', () => {
	it('keeps models no smaller model outscores', () => {
		const rows = [
			row('small', 0.1, 0.5),
			row('mid-better', 0.5, 0.6),
			row('mid-worse', 0.4, 0.45), // bigger than `small`, scores lower
			row('big-best', 7, 0.7),
			row('big-worse', 8, 0.65) // `big-best` is smaller and scores higher
		];
		expect(sorted(paretoFrontier(rows))).toEqual(['big-best', 'mid-better', 'small']);
	});

	it('drops the lower scorer among equal-sized models', () => {
		const rows = [row('a', 1, 0.6), row('b', 1, 0.5)];
		expect(sorted(paretoFrontier(rows))).toEqual(['a']);
	});

	it('drops a larger model that only matches a smaller one', () => {
		const rows = [row('small', 1, 0.6), row('big', 2, 0.6)];
		expect(sorted(paretoFrontier(rows))).toEqual(['small']);
	});

	it('keeps every model in an exact tie on both axes', () => {
		const rows = [row('a', 1, 0.6), row('b', 1, 0.6), row('c', 0.5, 0.4)];
		expect(sorted(paretoFrontier(rows))).toEqual(['a', 'b', 'c']);
	});

	it('ignores rows missing active params or Mean (Task)', () => {
		// Neither unplaceable row may land on, or knock anything off, the frontier.
		const rows = [row('known', 1, 0.5), row('no-params', null, 0.9), row('no-mean', 0.1, null)];
		expect(sorted(paretoFrontier(rows))).toEqual(['known']);
	});

	it('places 0-active-param static models at the small end', () => {
		const rows = [row('static', 0, 0.4), row('dense', 0.1, 0.5), row('worse-dense', 0.1, 0.3)];
		expect(sorted(paretoFrontier(rows))).toEqual(['dense', 'static']);
	});

	it('judges experiment variants of one model separately, keyed by rowId', () => {
		// Same model.name and size; only the variant is on the frontier, so the
		// base row must not inherit its tag (or vice versa).
		const base = row('org/m', 1, 0.5);
		const variant = { ...row('org/m', 1, 0.6), experiments: { colbert: true } };
		const frontier = paretoFrontier([base, variant]);
		expect([...frontier]).toEqual(['org/m::colbert_true']);
		expect(paretoStatus(base, frontier)).toBe(false);
		expect(paretoStatus(variant, frontier)).toBe(true);
	});

	it('returns an empty set for no rows', () => {
		expect(paretoFrontier([]).size).toBe(0);
	});
});

describe('paretoStatus', () => {
	it('is null when the row cannot be placed or there is no frontier', () => {
		const frontier = new Set(['a']);
		expect(paretoStatus(row('a', null, 0.5), frontier)).toBeNull();
		expect(paretoStatus(row('a', 1, null), frontier)).toBeNull();
		expect(paretoStatus(row('a', 1, 0.5), undefined)).toBeNull();
	});

	it('reports membership for placeable rows', () => {
		const frontier = new Set(['a']);
		expect(paretoStatus(row('a', 1, 0.5), frontier)).toBe(true);
		expect(paretoStatus(row('b', 1, 0.4), frontier)).toBe(false);
	});
});

describe('datedRows + recordSetters', () => {
	const dated = (name: string, releaseDate: string | undefined, meanTask: number | null) => {
		const r = row(name, 1, meanTask);
		return { ...r, model: { ...r.model, releaseDate } };
	};

	it('keeps rows with a date and a mean, oldest first', () => {
		const rows = [
			dated('late', '2025-01-01', 0.7),
			dated('undated', undefined, 0.9),
			dated('partial', '2024-06-01', null),
			dated('early', '2024-01-01', 0.6)
		];
		expect(datedRows(rows).map((r) => r.model.name)).toEqual(['early', 'late']);
	});

	it('returns only the models that beat every earlier release', () => {
		const rows = datedRows([
			dated('a', '2024-01-01', 0.6),
			dated('weaker', '2024-03-01', 0.5),
			dated('tie', '2024-06-01', 0.6), // matches, doesn't beat
			dated('b', '2025-01-01', 0.7)
		]);
		expect(recordSetters(rows).map((r) => r.model.name)).toEqual(['a', 'b']);
	});
});

describe('paretoRanges + fmtParetoRange', () => {
	it('spans each frontier model up to the next larger one, open-ended at the top', () => {
		const rows = [
			row('static', 0, 0.4),
			row('small', 0.1, 0.5),
			row('dominated', 0.5, 0.45), // not on the frontier: no range
			row('big', 7, 0.7)
		];
		const ranges = paretoRanges(rows, paretoFrontier(rows));
		expect(Object.fromEntries(ranges)).toEqual({
			static: { fromB: 0, toB: 0.1 },
			small: { fromB: 0.1, toB: 7 },
			big: { fromB: 7, toB: null }
		});
	});

	it('gives equal-size frontier models the same range', () => {
		const rows = [row('a', 1, 0.6), row('b', 1, 0.6), row('c', 2, 0.7)];
		const ranges = paretoRanges(rows, paretoFrontier(rows));
		expect(ranges.get('a')).toEqual({ fromB: 1, toB: 2 });
		expect(ranges.get('b')).toEqual({ fromB: 1, toB: 2 });
	});

	it('formats bounded, open-ended and zero-param ranges', () => {
		expect(fmtParetoRange({ fromB: 3.634, toB: 6.946 })).toBe('3.6 B–6.9 B');
		expect(fmtParetoRange({ fromB: 25.6, toB: null })).toBe('25.6 B+');
		expect(fmtParetoRange({ fromB: 0, toB: 0.006 })).toBe('0 M–6 M');
	});
});
