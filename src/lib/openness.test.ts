import { describe, expect, it } from 'vitest';

import type { ModelMeta } from './types';
import { opennessDimensions, opennessScore, OPENNESS_DIMENSIONS, OPENNESS_MAX } from './openness';

function model(overrides: Partial<ModelMeta>): ModelMeta {
	return { name: 'test/model', ...overrides } as ModelMeta;
}

const FULL = {
	'open weights': true,
	'open license': true,
	'open training code': true,
	'open training data': true,
	paper: true,
	'model card': true
};

describe('opennessScore', () => {
	it('prefers the API-provided score', () => {
		expect(opennessScore(model({ opennessScore: 4, openness: FULL }))).toBe(4);
	});

	it('falls back to summing the dict when score is absent', () => {
		const openness = { ...FULL, 'open training code': false, 'open training data': false };
		expect(opennessScore(model({ openness }))).toBe(4);
	});

	it('returns null when the model carries no openness data', () => {
		expect(opennessScore(model({}))).toBeNull();
		expect(opennessScore(model({ openness: null }))).toBeNull();
		expect(opennessScore(model({ openness: {} }))).toBeNull();
	});

	it('honors an explicit score of 0 even with an empty dict', () => {
		expect(opennessScore(model({ opennessScore: 0 }))).toBe(0);
	});
});

describe('opennessDimensions', () => {
	it('returns all dimensions in canonical order', () => {
		const dims = opennessDimensions(model({ openness: FULL }));
		expect(dims).toHaveLength(OPENNESS_MAX);
		expect(dims.map((d) => d.label)).toEqual(OPENNESS_DIMENSIONS.map((d) => d.label));
		expect(dims.every((d) => d.open)).toBe(true);
	});

	it('treats missing keys as closed', () => {
		const dims = opennessDimensions(model({ openness: { 'open weights': true } }));
		expect(dims.find((d) => d.label === 'Open weights')?.open).toBe(true);
		expect(dims.find((d) => d.label === 'Training data')?.open).toBe(false);
	});
});
