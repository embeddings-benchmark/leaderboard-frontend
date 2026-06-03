import { describe, expect, it } from 'vitest';
import { escapeCsv, sanitizeFilename, toCsv } from './csv';

describe('escapeCsv', () => {
	it('passes through plain text unchanged', () => {
		expect(escapeCsv('plain text')).toBe('plain text');
		expect(escapeCsv('')).toBe('');
	});

	it('quotes when the cell contains a comma, quote, or newline', () => {
		expect(escapeCsv('a, b')).toBe('"a, b"');
		expect(escapeCsv('she said "hi"')).toBe('"she said ""hi"""');
		expect(escapeCsv('two\nlines')).toBe('"two\nlines"');
	});
});

describe('toCsv', () => {
	it('emits a header line followed by one row per array', () => {
		const out = toCsv(
			['Model', 'Score'],
			[
				['a', 0.5],
				['b', 0.75]
			]
		);
		expect(out).toBe('Model,Score\na,0.5\nb,0.75');
	});

	it('null/undefined cells render as empty fields', () => {
		expect(toCsv(['x', 'y'], [[null, undefined]])).toBe('x,y\n,');
	});

	it('mixed numeric + escaped cells stay parseable', () => {
		const out = toCsv(['Name', 'Note'], [['Foo, Inc.', 'has "quotes"']]);
		expect(out).toBe('Name,Note\n"Foo, Inc.","has ""quotes"""');
	});
});

describe('sanitizeFilename', () => {
	it('collapses non-alphanumerics into single underscores', () => {
		expect(sanitizeFilename('MTEB(eng, v2)')).toBe('MTEB_eng_v2');
		expect(sanitizeFilename('hello   world!!!')).toBe('hello_world');
	});

	it('trims leading/trailing underscores', () => {
		expect(sanitizeFilename('___foo___')).toBe('foo');
	});

	it('empty / all-punctuation slug falls back', () => {
		expect(sanitizeFilename('')).toBe('export');
		expect(sanitizeFilename('!!!')).toBe('export');
		expect(sanitizeFilename('', 'fallback')).toBe('fallback');
	});
});
