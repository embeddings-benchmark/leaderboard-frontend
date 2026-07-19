import type { ModelMeta } from './types';

// "OSAI index"-style openness dimensions, in canonical display order. The API
// ships `openness` as a `Record<string, boolean>`; we never rely on JS object
// key order, so this list is the single source of truth for order + labels
// across every surface (model card, filters, benchmark table, compare).
//
// - `id`   short, stable token used in URL state and as a set key.
// - `key`  matches the API dict keys exactly.
// - `label` display text.
//
// `model card` is always satisfied (documenting one is required to add a
// model), so the practical score range is 1–6.
export const OPENNESS_DIMENSIONS = [
	{
		id: 'weights',
		key: 'open weights',
		label: 'Open weights',
		desc: "The model's weights are publicly available."
	},
	{
		id: 'license',
		key: 'open license',
		label: 'Open license',
		desc: 'Released under a recognized open license.'
	},
	{
		id: 'code',
		key: 'open training code',
		label: 'Training code',
		desc: 'The code used to train the model is public.'
	},
	{
		id: 'data',
		key: 'open training data',
		label: 'Training data',
		desc: 'The data the model was trained on is public.'
	},
	{ id: 'paper', key: 'paper', label: 'Paper', desc: 'A paper describes the model.' },
	{ id: 'card', key: 'model card', label: 'Model card', desc: 'A model card documents the model.' }
] as const;

export const OPENNESS_MAX = OPENNESS_DIMENSIONS.length; // 6

// Dimensions offered as filter requirements — everything except `model card`,
// which is always true and so would never narrow anything.
export const OPENNESS_FILTERABLE = OPENNESS_DIMENSIONS.filter((d) => d.id !== 'card');

const DIM_BY_ID = new Map<string, (typeof OPENNESS_DIMENSIONS)[number]>(
	OPENNESS_DIMENSIONS.map((d) => [d.id, d])
);

// Per-dimension breakdown in canonical order. Tolerant of a missing/partial
// `openness` dict — an absent key reads as `false`.
export function opennessDimensions(m: ModelMeta): { label: string; open: boolean }[] {
	const o = m.openness ?? {};
	return OPENNESS_DIMENSIONS.map((d) => ({ label: d.label, open: o[d.key] === true }));
}

// The 0–6 score. Prefers the API's `opennessScore`; falls back to summing the
// dict. Returns `null` when the model carries no openness data at all, which
// callers use to hide the widget entirely (rather than render a bogus 0/6).
export function opennessScore(m: ModelMeta): number | null {
	if (typeof m.opennessScore === 'number') return m.opennessScore;
	const o = m.openness;
	if (o && Object.keys(o).length > 0) {
		return Object.values(o).reduce((n, v) => n + (v ? 1 : 0), 0);
	}
	return null;
}

// Whether the model satisfies *every* required openness dimension (AND). A
// model with no openness data fails as soon as any requirement is set, since
// we can't verify it. Unknown ids are ignored.
export function opennessMeets(m: ModelMeta, requiredIds: Iterable<string>): boolean {
	const o = m.openness ?? {};
	for (const id of requiredIds) {
		const dim = DIM_BY_ID.get(id);
		if (!dim) continue;
		if (o[dim.key] !== true) return false;
	}
	return true;
}
