import type { SummaryRow } from '$lib/types';
import { fmtParamsCompact, rowId } from '$lib/format';

/**
 * Pareto frontier over (active parameters ↓, Mean (Task) ↑) — the same two
 * axes as the "Performance per Model Size" chart. A model is on the frontier
 * when no other model scores higher with the same or fewer active parameters,
 * or scores the same with fewer. Exact ties on both axes keep every tied row.
 *
 * Rows missing either value (proprietary models without a param count,
 * partial-coverage rows with a `null` mean) can't be placed, so they are
 * neither on the frontier nor able to dominate anything.
 *
 * Returns the frontier rows' `rowId`s — the same key `pinnedModels` uses —
 * so each experiment variant is placed on its own, not merged with the base
 * model that shares its `model.name`.
 */
export function paretoFrontier(rows: readonly SummaryRow[]): Set<string> {
	const eligible = rows.filter(isParetoEligible);
	// Ascending size, best score first within a size, so the first row of each
	// equal-size group carries that group's max.
	eligible.sort((a, b) => a.activeParamsB - b.activeParamsB || b.meanTask - a.meanTask);

	const out = new Set<string>();
	// Best score among strictly smaller models.
	let bestSmaller = -Infinity;
	let i = 0;
	while (i < eligible.length) {
		const size = eligible[i].activeParamsB;
		const groupBest = eligible[i].meanTask;
		for (; i < eligible.length && eligible[i].activeParamsB === size; i++) {
			const r = eligible[i];
			if (r.meanTask === groupBest && r.meanTask > bestSmaller) out.add(rowId(r));
		}
		bestSmaller = Math.max(bestSmaller, groupBest);
	}
	return out;
}

type EligibleRow = SummaryRow & { activeParamsB: number; meanTask: number };

/**
 * The size budgets (active parameters, in billions) for which a frontier
 * model is the best pick: from its own size up to — not including — the next
 * larger frontier model's size. `toB` is `null` for the largest, whose range
 * is open-ended. Equal-size frontier models share a range.
 */
export interface ParetoRange {
	fromB: number;
	toB: number | null;
}

/** `paretoFrontier`'s rows (by `rowId`), each with its `ParetoRange`. */
export function paretoRanges(
	rows: readonly SummaryRow[],
	frontier: ReadonlySet<string>
): Map<string, ParetoRange> {
	const onFrontier = rows.filter(isParetoEligible).filter((r) => frontier.has(rowId(r)));
	const sizes = [...new Set(onFrontier.map((r) => r.activeParamsB))].sort((a, b) => a - b);
	const out = new Map<string, ParetoRange>();
	for (const r of onFrontier) {
		const next = sizes[sizes.indexOf(r.activeParamsB) + 1];
		out.set(rowId(r), { fromB: r.activeParamsB, toB: next ?? null });
	}
	return out;
}

/** Active-param count for display. `fmtParamsCompact` renders 0 as '—', but
 *  a static model's 0 active params is a real value here. */
export function fmtActiveParams(b: number): string {
	return b === 0 ? '0 M' : fmtParamsCompact(b, ' ');
}

/** "3.6 B–6.9 B" or, for the largest frontier model, "25.6 B+". */
export function fmtParetoRange(range: ParetoRange): string {
	const from = fmtActiveParams(range.fromB);
	return range.toB == null ? `${from}+` : `${from}–${fmtActiveParams(range.toB)}`;
}

export function isParetoEligible(row: SummaryRow): row is EligibleRow {
	return row.activeParamsB != null && row.meanTask != null;
}

export type DatedRow = SummaryRow & {
	meanTask: number;
	model: SummaryRow['model'] & { releaseDate: string };
};

/** Rows with both a release date and a Mean (Task), oldest first. */
export function datedRows(rows: readonly SummaryRow[]): DatedRow[] {
	return rows
		.filter((r): r is DatedRow => !!r.model.releaseDate && r.meanTask != null)
		.sort(
			(a, b) => new Date(a.model.releaseDate).getTime() - new Date(b.model.releaseDate).getTime()
		);
}

/**
 * The over-time frontier's corners: models that beat every earlier release on
 * Mean (Task) — the time-axis counterpart of `paretoFrontier`. Takes
 * `datedRows` output (oldest first).
 */
export function recordSetters(dated: readonly DatedRow[]): DatedRow[] {
	const out: DatedRow[] = [];
	let best = -Infinity;
	for (const r of dated) {
		if (r.meanTask > best) {
			out.push(r);
			best = r.meanTask;
		}
	}
	return out;
}

/** `null` when the row lacks the size or score needed to place it. */
export function paretoStatus(
	row: SummaryRow,
	frontier: ReadonlySet<string> | undefined
): boolean | null {
	if (!frontier || !isParetoEligible(row)) return null;
	return frontier.has(rowId(row));
}
