import { describe, expect, it } from 'vitest';
import {
	ariaSort,
	bestPerColumn,
	buildSlugIndex,
	defaultDirFor,
	encodeUrlPart,
	fmtInt,
	fmtParamsUnit,
	fmtParamsValue,
	fmtPct,
	hasValue,
	heat,
	humanizeType,
	isIconUrl,
	maxOf,
	minOf,
	modelPath,
	nextSort,
	resolveSlugParam,
	rowId,
	serializeExperimentValue,
	shareSafeUrl,
	slug,
	sortIcon,
	summarizeModelLanguages,
	worstPerColumn
} from './format';

describe('summarizeModelLanguages', () => {
	it('returns null when language metadata is missing', () => {
		expect(summarizeModelLanguages(undefined)).toBeNull();
		expect(summarizeModelLanguages([])).toBeNull();
	});

	it('shows a compact label and full tooltip for a monolingual model', () => {
		expect(summarizeModelLanguages(['German'])).toEqual({
			label: 'Monolingual',
			title: 'German',
			ariaLabel: 'Supported language: German'
		});
	});

	it('shows a compact label and full tooltip for a multilingual model', () => {
		expect(summarizeModelLanguages(['German', 'English', 'German', ''])).toEqual({
			label: 'Multilingual',
			title: 'English, German',
			ariaLabel: 'Supported languages: English, German'
		});
	});
});

describe('humanizeType', () => {
	it('splits CamelCase task identifiers on capital boundaries', () => {
		expect(humanizeType('BitextMining')).toBe('Bitext Mining');
		expect(humanizeType('InstructionReranking')).toBe('Instruction Reranking');
		expect(humanizeType('PairClassification')).toBe('Pair Classification');
	});

	it('leaves all-caps and single-word strings alone', () => {
		expect(humanizeType('STS')).toBe('STS');
		expect(humanizeType('Classification')).toBe('Classification');
		expect(humanizeType('')).toBe('');
	});
});

describe('isIconUrl', () => {
	it('treats /-prefixed, http(s):, and data: as URLs', () => {
		expect(isIconUrl('/icon/foo.svg')).toBe(true);
		expect(isIconUrl('https://example.com/x.png')).toBe(true);
		expect(isIconUrl('http://example.com/x.png')).toBe(true);
		expect(isIconUrl('data:image/png;base64,abc')).toBe(true);
	});

	it('treats text/emoji as non-URL', () => {
		expect(isIconUrl('🌍')).toBe(false);
		expect(isIconUrl('eng')).toBe(false);
	});

	it('handles falsy', () => {
		expect(isIconUrl(null)).toBe(false);
		expect(isIconUrl(undefined)).toBe(false);
		expect(isIconUrl('')).toBe(false);
	});
});

describe('slug', () => {
	it('turns punctuation into readable dashes', () => {
		expect(slug('MTEB(eng, v2)')).toBe('MTEB-eng-v2');
		expect(slug('HUME(v1)')).toBe('HUME-v1');
		expect(slug('MAEB(v1, audio-only)')).toBe('MAEB-v1-audio-only');
	});

	it('leaves URL-safe names unchanged', () => {
		expect(slug('ArguAna')).toBe('ArguAna');
		expect(slug('STS22.v2')).toBe('STS22.v2');
	});

	it('never ends a benchmark link with ")" (LinkedIn drops it)', () => {
		expect(slug('MTEB(Multilingual, v2)').endsWith(')')).toBe(false);
	});

	it('falls back to percent-encoding when nothing readable is left', () => {
		expect(slug('()')).toBe('%28%29');
	});
});

describe('modelPath', () => {
	it('keeps "/" between segments and slugs each segment', () => {
		expect(modelPath('openai/text-embedding-3-large (embed_dim=512)')).toBe(
			'openai/text-embedding-3-large-embed_dim-512'
		);
		expect(modelPath('/org/name/')).toBe('org/name');
		expect(modelPath('intfloat/e5-large-v2')).toBe('intfloat/e5-large-v2');
	});
});

describe('buildSlugIndex', () => {
	it('only lists names whose slug differs', () => {
		expect(buildSlugIndex(['MTEB(eng, v2)', 'BEIR'], slug)).toEqual({
			'MTEB-eng-v2': 'MTEB(eng, v2)'
		});
	});

	it('throws when two names share a slug', () => {
		expect(() => buildSlugIndex(['MTEB(eng, v2)', 'MTEB-eng-v2'], slug)).toThrow(/collision/);
		expect(() => buildSlugIndex(['A (x)', 'A(x)'], slug)).toThrow(/collision/);
	});
});

describe('resolveSlugParam', () => {
	const index = buildSlugIndex(['MTEB(eng, v2)', 'BEIR'], slug);

	it('maps a slug back to the real name', () => {
		expect(resolveSlugParam('MTEB-eng-v2', index, slug)).toEqual({ name: 'MTEB(eng, v2)' });
	});

	it('redirects an old raw-name link to its slug', () => {
		expect(resolveSlugParam('MTEB(eng, v2)', index, slug)).toEqual({
			name: 'MTEB(eng, v2)',
			redirect: 'MTEB-eng-v2'
		});
	});

	it('passes safe names and unknown aliases through', () => {
		expect(resolveSlugParam('BEIR', index, slug)).toEqual({ name: 'BEIR' });
		expect(resolveSlugParam('MTEB(eng)', index, slug)).toEqual({ name: 'MTEB(eng)' });
	});
});

describe('encodeUrlPart', () => {
	it('encodes the characters encodeURIComponent leaves alone', () => {
		expect(encodeUrlPart("!'()*")).toBe('%21%27%28%29%2A');
		expect(encodeUrlPart('a-b_c.d~e')).toBe('a-b_c.d~e');
	});
});

describe('shareSafeUrl', () => {
	it('encodes raw parens left in a page URL', () => {
		expect(shareSafeUrl('https://leaderboard.mteb.org/benchmark/MTEB(eng,%20v2)')).toBe(
			'https://leaderboard.mteb.org/benchmark/MTEB%28eng,%20v2%29'
		);
	});

	it('leaves already-encoded URLs and query strings unchanged', () => {
		const url = 'https://leaderboard.mteb.org/benchmark/MTEB%28eng%2C%20v2%29?tab=perf_task#x';
		expect(shareSafeUrl(url)).toBe(url);
	});

	it('points to the same page after decoding', () => {
		const raw = 'https://leaderboard.mteb.org/benchmark/MTEB(eng,%20v2)';
		expect(decodeURIComponent(new URL(shareSafeUrl(raw)).pathname)).toBe(
			decodeURIComponent(new URL(raw).pathname)
		);
	});
});

describe('fmtInt', () => {
	it('formats with locale grouping for positive numbers', () => {
		expect(fmtInt(1234)).toBe((1234).toLocaleString());
		expect(fmtInt(1_000_000)).toBe((1_000_000).toLocaleString());
	});

	it('falsy → em-dash', () => {
		expect(fmtInt(0)).toBe('—');
		expect(fmtInt(null)).toBe('—');
		expect(fmtInt(undefined)).toBe('—');
	});
});

describe('fmtParamsValue / fmtParamsUnit', () => {
	it('zero ⇒ em-dash, no unit', () => {
		expect(fmtParamsValue(0)).toBe('—');
		expect(fmtParamsUnit(0)).toBe('');
	});

	it('< 1 B switches to millions', () => {
		expect(fmtParamsValue(0.5)).toBe('500');
		expect(fmtParamsUnit(0.5)).toBe('M');
		expect(fmtParamsValue(0.125)).toBe('125');
		expect(fmtParamsUnit(0.125)).toBe('M');
	});

	it('≥ 1 B keeps billions with one decimal', () => {
		expect(fmtParamsValue(1)).toBe('1.0');
		expect(fmtParamsUnit(1)).toBe('B');
		expect(fmtParamsValue(7.5)).toBe('7.5');
		expect(fmtParamsUnit(7.5)).toBe('B');
	});
});

describe('sortIcon', () => {
	it('inactive column gets the default placeholder glyph', () => {
		expect(sortIcon('rank', null, 'asc')).toBe('↕');
		expect(sortIcon('rank', 'model', 'asc')).toBe('↕');
	});

	it('active column gets the direction arrow', () => {
		expect(sortIcon('rank', 'rank', 'asc')).toBe('↑');
		expect(sortIcon('rank', 'rank', 'desc')).toBe('↓');
	});

	it('respects a custom inactive glyph (SummaryTable uses an empty string)', () => {
		expect(sortIcon('rank', null, 'asc', '')).toBe('');
		expect(sortIcon('rank', 'rank', 'asc', '')).toBe('↑');
	});
});

describe('ariaSort', () => {
	it('inactive ⇒ none, active ⇒ ascending/descending', () => {
		expect(ariaSort('rank', null, 'asc')).toBe('none');
		expect(ariaSort('rank', 'rank', 'asc')).toBe('ascending');
		expect(ariaSort('rank', 'rank', 'desc')).toBe('descending');
	});
});

describe('fmtPct', () => {
	it('multiplies by 100 and rounds to 2 decimals', () => {
		expect(fmtPct(0.7613)).toBe('76.13');
		expect(fmtPct(0.5)).toBe('50.00');
		expect(fmtPct(1)).toBe('100.00');
	});

	it('missing value ⇒ em-dash', () => {
		expect(fmtPct(null)).toBe('—');
		expect(fmtPct(undefined)).toBe('—');
	});
});

describe('hasValue', () => {
	it('only em-dash and NA placeholders count as missing', () => {
		expect(hasValue('76.13')).toBe(true);
		expect(hasValue('0')).toBe(true);
		expect(hasValue('—')).toBe(false);
		expect(hasValue('⚠️ NA')).toBe(false);
	});
});

describe('heat', () => {
	it('cell at the column max hits the heat-55 class', () => {
		expect(heat(0.8, 0.5, 0.8)).toBe('heat-55');
	});

	it('cell at the column min renders un-tinted', () => {
		expect(heat(0.5, 0.5, 0.8)).toBe('');
	});

	it('halfway between min and max → heat-28', () => {
		// (0.65 - 0.5) / (0.8 - 0.5) = 0.5 → 0.5 * 55 = 27.5 → 28
		expect(heat(0.65, 0.5, 0.8)).toBe('heat-28');
	});

	it('null score, non-finite bounds, or degenerate range ⇒ empty', () => {
		expect(heat(null, 0.5, 0.8)).toBe('');
		expect(heat(undefined, 0.5, 0.8)).toBe('');
		expect(heat(0.7, 0.8, 0.8)).toBe(''); // min == max
		expect(heat(0.7, 0.9, 0.8)).toBe(''); // min > max
		expect(heat(0.7, NaN, 0.8)).toBe('');
		expect(heat(0.7, 0.5, NaN)).toBe('');
	});

	it('clamps scores above the column max to heat-55', () => {
		expect(heat(2, 0, 1)).toBe('heat-55');
	});

	it('clamps scores below the column min to empty', () => {
		expect(heat(-1, 0, 1)).toBe('');
	});
});

describe('defaultDirFor', () => {
	const ASC: readonly ('rank' | 'model' | 'score')[] = ['rank', 'model'];

	it('keys in the asc-list default to ascending', () => {
		expect(defaultDirFor('rank', ASC)).toBe('asc');
		expect(defaultDirFor('model', ASC)).toBe('asc');
	});

	it('every other key defaults to descending (numeric columns)', () => {
		expect(defaultDirFor('score', ASC)).toBe('desc');
	});
});

describe('maxOf', () => {
	it('returns the largest number, ignoring null/undefined', () => {
		expect(maxOf([0.1, 0.9, null, 0.4, undefined])).toBe(0.9);
	});

	it('returns 0 when no numbers are present', () => {
		expect(maxOf([])).toBe(0);
		expect(maxOf([null, undefined])).toBe(0);
	});
});

describe('minOf', () => {
	it('returns the smallest number, ignoring null/undefined', () => {
		expect(minOf([0.1, 0.9, null, 0.4, undefined])).toBe(0.1);
	});

	it('returns 0 when no numbers are present', () => {
		expect(minOf([])).toBe(0);
		expect(minOf([null, undefined])).toBe(0);
	});
});

describe('bestPerColumn', () => {
	it('finds the column max per key across rows', () => {
		const rows = [
			{ scores: { a: 0.7, b: 0.5 } },
			{ scores: { a: 0.4, b: 0.9 } },
			{ scores: { a: 0.6 } } // b missing
		];
		const best = bestPerColumn(['a', 'b'] as const, rows, (r, k) => r.scores[k]);
		expect(best.a).toBe(0.7);
		expect(best.b).toBe(0.9);
	});

	it('empty column ⇒ -Infinity (so heat() short-circuits via degenerate range)', () => {
		const rows = [{ scores: {} as Record<string, number> }];
		const best = bestPerColumn(['x'] as const, rows, (r, k) => r.scores[k]);
		expect(best.x).toBe(-Infinity);
	});
});

describe('worstPerColumn', () => {
	it('finds the column min per key across rows', () => {
		const rows = [
			{ scores: { a: 0.7, b: 0.5 } },
			{ scores: { a: 0.4, b: 0.9 } },
			{ scores: { a: 0.6 } } // b missing
		];
		const worst = worstPerColumn(['a', 'b'] as const, rows, (r, k) => r.scores[k]);
		expect(worst.a).toBe(0.4);
		expect(worst.b).toBe(0.5);
	});

	it('empty column ⇒ +Infinity', () => {
		const rows = [{ scores: {} as Record<string, number> }];
		const worst = worstPerColumn(['x'] as const, rows, (r, k) => r.scores[k]);
		expect(worst.x).toBe(Infinity);
	});
});

describe('nextSort', () => {
	const ascKeys: readonly ('rank' | 'model' | 'score')[] = ['rank', 'model'];
	const defaultDir = (k: 'rank' | 'model' | 'score') => defaultDirFor(k, ascKeys);

	it('first click on a numeric column ⇒ activate descending', () => {
		expect(nextSort('score', null, 'asc', defaultDir)).toEqual({ key: 'score', dir: 'desc' });
	});

	it('first click on an ascending-default column ⇒ activate ascending', () => {
		expect(nextSort('model', null, 'desc', defaultDir)).toEqual({ key: 'model', dir: 'asc' });
	});

	it('second click on the same column ⇒ flip direction', () => {
		expect(nextSort('score', 'score', 'desc', defaultDir)).toEqual({ key: 'score', dir: 'asc' });
		expect(nextSort('model', 'model', 'asc', defaultDir)).toEqual({ key: 'model', dir: 'desc' });
	});

	it('third click on the same column ⇒ clear the active column (key=null)', () => {
		// model is asc-default; second click flipped to desc; third click clears
		expect(nextSort('model', 'model', 'desc', defaultDir)).toEqual({ key: null, dir: 'desc' });
		// score is desc-default; second click flipped to asc; third click clears
		expect(nextSort('score', 'score', 'asc', defaultDir)).toEqual({ key: null, dir: 'asc' });
	});

	it('switching to a different column ⇒ activate it at its own default', () => {
		expect(nextSort('rank', 'score', 'asc', defaultDir)).toEqual({ key: 'rank', dir: 'asc' });
		expect(nextSort('score', 'rank', 'asc', defaultDir)).toEqual({ key: 'score', dir: 'desc' });
	});
});

describe('serializeExperimentValue', () => {
	it('renders primitives as plain strings', () => {
		expect(serializeExperimentValue(true)).toBe('true');
		expect(serializeExperimentValue(42)).toBe('42');
		expect(serializeExperimentValue('multi_vector')).toBe('multi_vector');
		expect(serializeExperimentValue(null)).toBe('null');
	});

	it('renders an empty nested object as "{}", not "[object Object]"', () => {
		// Matches `results/.../experiments/model_kwargs_{}/` on disk —
		// `experiment_kwargs: { model_kwargs: {} }`.
		expect(serializeExperimentValue({})).toBe('{}');
	});

	it('renders a non-empty nested object with sorted keys, recursively', () => {
		expect(serializeExperimentValue({ b: 2, a: { c: 3 } })).toBe('{a:{c:3},b:2}');
	});

	it('renders arrays element-wise', () => {
		expect(serializeExperimentValue([1, 'x', {}])).toBe('[1,x,{}]');
	});
});

describe('rowId', () => {
	it('returns the bare model name when there are no experiment kwargs', () => {
		expect(rowId({ model: { name: 'org/model' } })).toBe('org/model');
		expect(rowId({ model: { name: 'org/model' }, experiments: null })).toBe('org/model');
		expect(rowId({ model: { name: 'org/model' }, experiments: {} })).toBe('org/model');
	});

	it('appends a deterministic serialization for experiment variants', () => {
		expect(
			rowId({ model: { name: 'org/model' }, experiments: { vector_type: 'multi_vector' } })
		).toBe('org/model::vector_type_multi_vector');
	});

	it('gives two different nested-kwargs variants distinct ids (no [object Object] collision)', () => {
		const idA = rowId({
			model: { name: 'org/model' },
			experiments: { model_kwargs: { a: 1 } }
		});
		const idB = rowId({
			model: { name: 'org/model' },
			experiments: { model_kwargs: { b: 2 } }
		});
		expect(idA).not.toBe(idB);
		expect(idA).not.toContain('[object Object]');
		expect(idB).not.toContain('[object Object]');
	});
});
