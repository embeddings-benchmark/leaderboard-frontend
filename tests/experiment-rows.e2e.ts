import { expect, test } from '@playwright/test';
import type { BenchmarkSummary, ModelScores } from '../src/lib/types';

test('compare keeps the default and multivector runs selected across reload', async ({ page }) => {
	await page.route('**/v1/benchmarks/*/scores', async (route) => {
		const response = await route.fetch();
		const summary: BenchmarkSummary = await response.json();
		const base = { ...summary.rows[0], experiments: null };
		const variant = { ...base, experiments: { vector_type: 'multi_vector' } };
		await route.fulfill({ response, json: { ...summary, rows: [base, variant] } });
	});
	await page.goto('/compare');
	const chips = page.locator('.picker-bar .pick-chip .pick-name');
	await expect(chips).toHaveCount(2);
	await expect(chips.nth(1)).toContainText('vector_type=multi_vector');
	await expect(page).toHaveURL(/vector_type_multi_vector/);
	await page.reload();
	await expect(chips).toHaveCount(2);
	await expect(chips.first()).not.toContainText('vector_type');
	await expect(chips.nth(1)).toContainText('vector_type=multi_vector');
});

test('model detail renders both runs for the same benchmark', async ({ page }) => {
	await page.route('**/v1/models/*/scores', async (route) => {
		const response = await route.fetch();
		const payload: ModelScores = await response.json();
		const base = {
			benchmarkName: 'MTEB(eng, v2)',
			benchmarkDisplayName: 'MTEB English',
			rank: 2,
			totalModels: 2,
			meanTask: 0.2,
			meanTaskType: 0.2,
			zeroShotPct: 100,
			taskTypes: [],
			scoresByTaskType: {}
		};
		await route.fulfill({
			response,
			json: {
				...payload,
				rows: [
					{ ...base, rank: 1, meanTask: 0.8, experiments: { vector_type: 'multi_vector' } },
					base
				]
			}
		});
	});
	await page.goto('/models/mock-org/mock-model/');
	const rows = page.locator('table tbody tr').filter({ hasText: 'MTEB English' });
	await expect(rows).toHaveCount(2);
	await expect(rows.filter({ hasText: 'vector_type=multi_vector' })).toContainText('80');
	await expect(page.getByRole('link', { name: /compare with another model/i })).toHaveAttribute(
		'href',
		/vector_type_multi_vector/
	);
});
