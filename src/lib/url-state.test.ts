import { describe, expect, it } from 'vitest';
import { applyParamUpdates, decodeSet, encodeSet } from './url-state';

describe('encodeSet / decodeSet', () => {
	it('round-trips a plain set of names', () => {
		const names = ['alpha', 'beta', 'gamma'];
		const encoded = encodeSet(names);
		expect(encoded).toBe('alpha,beta,gamma');
		expect(decodeSet(encoded)).toEqual(names);
	});

	it('encodes characters that would conflict with the comma separator', () => {
		const encoded = encodeSet(['MTEB(eng, v2)', 'BEIR']);
		// Commas inside values must be URL-encoded so they don't split on decode.
		expect(encoded).toContain('MTEB(eng%2C%20v2)');
		expect(decodeSet(encoded)).toEqual(['MTEB(eng, v2)', 'BEIR']);
	});

	it('empty / falsy values produce an empty string, not null', () => {
		// Empty input serialises as `''` (not `null`) so it round-trips
		// through the URL as `?key=` — a "user deselected everything"
		// gesture distinct from "no param at all" (= no narrowing).
		// `updateUrl`'s null-vs-empty-string handling consumes this
		// distinction; see url-state.ts.
		expect(encodeSet([])).toBe('');
		expect(encodeSet(['', '', ''])).toBe('');
		expect(encodeSet(['a', '', 'b'])).toBe('a,b');
	});

	it('decode handles missing / blank input as empty array', () => {
		expect(decodeSet(null)).toEqual([]);
		expect(decodeSet('')).toEqual([]);
		expect(decodeSet('   ')).toEqual([]);
	});

	it('decode tolerates extra whitespace and empty trailing slots', () => {
		expect(decodeSet(' a , b , c ,')).toEqual(['a', 'b', 'c']);
	});

	it('accepts any iterable input (Set, generator, etc.)', () => {
		const set = new Set(['x', 'y', 'x']); // dup is collapsed by Set itself
		expect(encodeSet(set)).toBe('x,y');
	});
});

describe('applyParamUpdates', () => {
	it('writes an array as repeated-key pairs (no comma separator)', () => {
		const url = new URL('http://x/compare');
		const changed = applyParamUpdates(url, { model: ['a', 'b'] });
		expect(changed).toBe(true);
		expect(url.search).toBe('?model=a&model=b');
		expect(url.searchParams.getAll('model')).toEqual(['a', 'b']);
	});

	it('preserves `/` and `,` in repeated array values across a write/read round-trip', () => {
		// The OLD comma-join + `searchParams.set` path double-encoded `%2F`
		// → `%252F` and turned the literal separator into `%2C`.
		const url = new URL('http://x/compare');
		const models = ['intfloat/e5-small', 'BAAI/bge-base'];
		const benchmarks = ['MTEB(Multilingual, v2)', 'BEIR'];
		applyParamUpdates(url, { model: models, benchmark: benchmarks });

		expect(url.search).toBe(
			'?model=intfloat%2Fe5-small&model=BAAI%2Fbge-base' +
				'&benchmark=MTEB%28Multilingual%2C+v2%29&benchmark=BEIR'
		);
		expect(url.searchParams.getAll('model')).toEqual(models);
		expect(url.searchParams.getAll('benchmark')).toEqual(benchmarks);
	});

	it('empty array deletes the param; null also deletes', () => {
		const url = new URL('http://x/compare?model=a&model=b&keep=1');
		applyParamUpdates(url, { model: [], other: null });
		expect(url.searchParams.has('model')).toBe(false);
		expect(url.search).toBe('?keep=1');
	});

	it('empty string is preserved as `?k=` (distinct from delete)', () => {
		const url = new URL('http://x/');
		applyParamUpdates(url, { mtypes: '' });
		expect(url.search).toBe('?mtypes=');
	});

	it('no-op when array contents match; reorder is a change', () => {
		const url = new URL('http://x/?model=a&model=b');
		expect(applyParamUpdates(url, { model: ['a', 'b'] })).toBe(false);
		expect(applyParamUpdates(url, { model: ['b', 'a'] })).toBe(true);
		expect(url.searchParams.getAll('model')).toEqual(['b', 'a']);
	});

	it('mixes string and array values in one call', () => {
		const url = new URL('http://x/');
		applyParamUpdates(url, { tab: 'summary', model: ['a', 'b'] });
		expect(url.searchParams.get('tab')).toBe('summary');
		expect(url.searchParams.getAll('model')).toEqual(['a', 'b']);
	});
});
