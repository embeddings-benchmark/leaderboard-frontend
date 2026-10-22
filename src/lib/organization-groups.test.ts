import { describe, expect, it } from 'vitest';
import { buildMockSummary } from '../../tests/fixtures/mockSummary';
import type { SummaryRow } from './types';
import { groupByOrganization } from './organization-groups';

const base = buildMockSummary('MTEB(eng, v2)').rows[0];
function row(name: string, score: number | null, org = 'Organization'): SummaryRow {
	return { ...base, model: { ...base.model, name, org }, meanTask: score };
}

describe('groupByOrganization', () => {
	it('can select using the current displayed primary metric after task filters', () => {
		const a = { ...row('a', 0.9), meanTaskType: 0.6 };
		const b = { ...row('b', 0.8), meanTaskType: 0.7 };
		expect(groupByOrganization([a, b], (r) => r.meanTaskType)[0].representative).toBe(b);
	});
	it('selects one complete row by primary score, not rank or column maxima', () => {
		const best = { ...row('best', 0.9), rank: 3, meanTaskType: 0.5 };
		const first = { ...row('first', 0.7), rank: 1, meanTaskType: 1 };
		const input = [first, best];
		const [group] = groupByOrganization(input);
		expect(group.representative).toBe(best);
		expect(group.representative.meanTaskType).toBe(0.5);
		expect(group.rows).toEqual(input);
		expect(input).toEqual([first, best]);
	});

	it('does not depend on the input display order', () => {
		const best = row('best', 0.9);
		const other = row('other', 0.8);
		expect(groupByOrganization([best, other])[0].representative).toBe(best);
		expect(groupByOrganization([other, best])[0].representative).toBe(best);
	});

	it('breaks equal and all-missing scores by stable row identity', () => {
		for (const score of [0.8, null, NaN]) {
			const a = row('a', score);
			const z = row('z', score);
			expect(groupByOrganization([z, a])[0].representative).toBe(a);
		}
	});

	it('prefers a finite score, including zero, over missing/nonfinite scores', () => {
		const zero = row('zero', 0);
		expect(
			groupByOrganization([row('a', null), row('b', NaN), row('c', Infinity), zero])[0]
				.representative
		).toBe(zero);
	});

	it('keeps experiment rows distinct, including when the variant is best', () => {
		const canonical = row('model', 0.8);
		const variant = { ...row('model', 0.9), experiments: { embedding_dim: 256 } };
		const [group] = groupByOrganization([canonical, variant]);
		expect(group.rows).toHaveLength(2);
		expect(group.representative).toBe(variant);
		expect(groupByOrganization([canonical])[0].representative).toBe(canonical);
	});

	it('uses organization metadata rather than parsing the model name', () => {
		const rows = [row('namespace/a', 0.9, 'Publisher'), row('another/b', 0.8, 'Publisher')];
		expect(groupByOrganization(rows)).toHaveLength(1);
		expect(groupByOrganization(rows)[0].label).toBe('Publisher');
	});

	it('does not group unrelated missing organizations or collide with fallbacks', () => {
		const groups = groupByOrganization([row('a', 0.9, ''), row('b', 0.8, ' '), row('c', 0.7, 'a')]);
		expect(groups).toHaveLength(3);
		expect(new Set(groups.map((g) => g.key)).size).toBe(3);
	});

	it('recomputes from only the supplied filtered rows and handles empty input', () => {
		const a = row('a', 0.9);
		const b = row('b', 0.8);
		expect(groupByOrganization([a, b])[0].representative).toBe(a);
		expect(groupByOrganization([b])[0].representative).toBe(b);
		expect(groupByOrganization([])).toEqual([]);
	});
});
