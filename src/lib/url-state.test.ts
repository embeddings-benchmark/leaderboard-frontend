import { describe, expect, it } from 'vitest';
import { decodeSet, encodeSet, encodeUrlSetParam } from './url-state';

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

	it('formats URL patch values with literal commas between encoded items', () => {
		expect(encodeUrlSetParam(['model-a', 'model-b'])).toBe('model-a,model-b');
	});

	it('preserves commas inside values while keeping separator commas literal', () => {
		const encoded = encodeUrlSetParam(['MTEB(Multilingual, v2)', 'RTEB(beta)']);
		expect(encoded).toBe('MTEB(Multilingual%2C%20v2),RTEB(beta)');
		expect(decodeSet(encoded)).toEqual(['MTEB(Multilingual, v2)', 'RTEB(beta)']);
	});

	it('returns null for empty URL patch values', () => {
		expect(encodeUrlSetParam([])).toBeNull();
	});
});
