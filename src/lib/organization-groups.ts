import type { SummaryRow } from './types';
import { rowId } from './format';

export interface OrganizationGroup {
	key: string;
	label: string;
	representative: SummaryRow;
	rows: SummaryRow[];
}

/** Group already-filtered rows without changing scores, ranks, or input order.
 * The API maps the benchmark's primary metric to meanTask. Selection is
 * independent of display sorting and pins; ties use the stable row identity
 * (including experiment variants). Missing scores sort after finite scores.
 */
export function groupByOrganization(
	rows: readonly SummaryRow[],
	scoreOf: (row: SummaryRow) => number | null = (row) => row.meanTask
): OrganizationGroup[] {
	const groups = new Map<string, OrganizationGroup>();
	for (const row of rows) {
		const org = row.model.org.trim();
		// Missing organizations must not combine unrelated models. Prefix the
		// key so a fallback model name cannot collide with a real organization.
		const key = org ? `org:${org}` : `model:${row.model.name}`;
		const existing = groups.get(key);
		if (!existing) {
			groups.set(key, { key, label: org || row.model.name, representative: row, rows: [row] });
			continue;
		}
		existing.rows.push(row);
		const score = finiteScore(scoreOf(row));
		const best = finiteScore(scoreOf(existing.representative));
		if (score > best || (score === best && rowId(row) < rowId(existing.representative))) {
			existing.representative = row;
		}
	}
	return [...groups.values()];
}

function finiteScore(score: number | null): number {
	return score != null && Number.isFinite(score) ? score : -Infinity;
}
