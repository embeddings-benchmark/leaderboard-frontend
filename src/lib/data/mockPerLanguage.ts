// Placeholder per-language score generator for PerLanguageTab. Lives in its
// own module + is dynamic-imported by the tab on mount so the synthetic
// formula doesn't ship in the always-loaded chunk — it'll disappear entirely
// once the backend exposes the real per-language breakdown.

import type { SummaryRow } from '$lib/types';

/**
 * Deterministic synthetic score for a (row, langIdx) pair.
 *
 * Returns ``null`` when the row has no overall mean (partial benchmark
 * coverage) so downstream renderers can show '—' instead of '0.00'.
 *
 * @param row      Summary row for one model.
 * @param langIdx  Column index (position in the language list).
 * @param firstTaskType  First task-type label from the summary, used to add
 *                       a small per-row delta so columns differ between models
 *                       with otherwise-identical means. Pass ``''`` when the
 *                       summary has no task types.
 */
export function fakeLangScore(
	row: SummaryRow,
	langIdx: number,
	firstTaskType: string
): number | null {
	if (row.meanTask == null) return null;
	const base = row.meanTask * 100;
	const shift = ((langIdx + row.rank) % 7) - 3;
	const delta = firstTaskType ? (row.scoresByTaskType[firstTaskType] ?? 0) * 5 : 0;
	return Math.max(0, Math.min(99, base + shift + delta - 4));
}
