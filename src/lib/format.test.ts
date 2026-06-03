import { describe, expect, it } from 'vitest';
import {
	ariaSort,
	bestPerColumn,
	defaultDirFor,
	fmtInt,
	fmtParamsUnit,
	fmtParamsValue,
	fmtPct,
	hasValue,
	heat,
	humanizeType,
	isIconUrl,
	maxOf,
	nextSort,
	slug,
	sortIcon
} from './format';

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
	it('URL-encodes punctuation that breaks route segments', () => {
		expect(slug('MTEB(eng, v2)')).toBe('MTEB(eng%2C%20v2)'); // commas/spaces encoded; parens preserved by encodeURIComponent
		expect(slug('HUME(v1)')).toBe('HUME(v1)');
	});

	it('round-trips with decodeURIComponent', () => {
		const original = 'My Benchmark / with / slashes & stuff';
		expect(decodeURIComponent(slug(original))).toBe(original);
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
	it('strongest cell in a column hits ~55% tint', () => {
		const style = heat(0.8, 0.8);
		expect(style).toMatch(/55%/);
		expect(style).toContain('var(--primary)');
	});

	it('scales linearly toward 0% at zero', () => {
		// half the column max → ~27.5%, rounded to 28 (Math.round(0.5*55) = 28)
		expect(heat(0.4, 0.8)).toMatch(/28%/);
	});

	it('null score, non-positive max, or zero ratio ⇒ no style', () => {
		expect(heat(null, 0.8)).toBe('');
		expect(heat(undefined, 0.8)).toBe('');
		expect(heat(0.5, 0)).toBe('');
		expect(heat(0.5, NaN)).toBe('');
		expect(heat(0, 0.8)).toBe('');
	});

	it('clamps scores above the column max to the 55% ceiling', () => {
		expect(heat(2, 1)).toMatch(/55%/);
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

	it('empty column ⇒ -Infinity (so heat() short-circuits via non-positive max)', () => {
		const rows = [{ scores: {} as Record<string, number> }];
		const best = bestPerColumn(['x'] as const, rows, (r, k) => r.scores[k]);
		expect(best.x).toBe(-Infinity);
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
