import { describe, expect, it } from 'vitest';
import { languageLabel } from './languages';

describe('languageLabel', () => {
	it('translates known iso639-3 + script codes to human names', () => {
		expect(languageLabel('eng-Latn')).toBe('English');
		expect(languageLabel('zho-Hans')).toBe('Chinese (Simplified)');
		expect(languageLabel('zho-Hant')).toBe('Chinese (Traditional)');
		expect(languageLabel('jpn-Jpan')).toBe('Japanese');
	});

	it('falls back to the raw code for unknown values', () => {
		expect(languageLabel('xyz-Latn')).toBe('xyz-Latn');
		expect(languageLabel('')).toBe('');
	});
});
