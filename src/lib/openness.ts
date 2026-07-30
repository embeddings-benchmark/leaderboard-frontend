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
// Scores run 0–6. In practice `model card` is always satisfied (documenting
// one is required to add a model), so most models land in 1–6 — but the API
// can ship an explicit `opennessScore` of 0, so nothing downstream may assume
// a floor of 1.
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

// The 0–6 score. Prefers the API's `opennessScore`; falls back to counting the
// canonical dimensions. Returns `null` when the model carries no openness data
// at all, which callers use to hide the widget entirely (rather than render a
// bogus 0/6).
//
// The fallback deliberately counts only `OPENNESS_DIMENSIONS` keys rather than
// every key in the dict — `openness` is a `Record<string, boolean>`, so an
// extra/legacy key from the API would otherwise push the score out of step with
// the 6-row breakdown `opennessDimensions` renders (e.g. "7/6").
//
// For the same reason the fallback requires at least one *canonical* key to be
// present: a dict of nothing but unrecognized keys carries no openness data we
// can read, and scoring it 0 would render as "fully closed" rather than the
// "unknown" it actually is.
export function opennessScore(m: ModelMeta): number | null {
	if (typeof m.opennessScore === 'number') return m.opennessScore;
	const o = m.openness;
	if (o && OPENNESS_DIMENSIONS.some((d) => d.key in o)) {
		return OPENNESS_DIMENSIONS.reduce((n, d) => n + (o[d.key] === true ? 1 : 0), 0);
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
