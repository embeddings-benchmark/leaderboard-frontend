import { expect, test } from '@playwright/test';

// Screenshot baselines for the openness widgets, one per mock model, so a
// reviewer can see in the PR exactly how each state renders. Baselines live in
// `tests/__screenshots__/openness.visual.ts/`; regenerate them with
// `make update-visual` (Linux Docker image — see playwright.config.ts).
//
// Mock models (tests/mock-api.ts):
//   mock-model             all six dimensions open
//   mock-cross-encoder     paper + model card only
//   mock-unknown-openness  no openness data

const MODELS = ['mock-model', 'mock-cross-encoder', 'mock-unknown-openness'] as const;
// /compare only offers models present in the benchmark's summary, so it uses
// the summary fixture's models (tests/fixtures/mockSummary.ts) instead.
const COMPARE_MODELS = ['gemini-embedding-001', 'qwen3-embedding-8b', 'Linq-Embed-Mistral'];
const COMPARE_URL =
	'/compare?model=' +
	COMPARE_MODELS.map(encodeURIComponent).join(',') +
	`&benchmark=${encodeURIComponent('MTEB(eng, v2)')}`;

for (const theme of ['light', 'dark'] as const) {
	test.describe(`${theme} theme`, () => {
		test.use({ colorScheme: theme });

		for (const model of ['mock-model', 'mock-cross-encoder'] as const) {
			test(`model page openness block: ${model}`, async ({ page }) => {
				await page.goto(`/models/mock-org/${model}`);
				const block = page.locator('.openness-block');
				await expect(block).toBeVisible({ timeout: 15_000 });
				await expect(block).toHaveScreenshot(`model-page-${model}-${theme}.png`);
			});
		}

		test('/models cards', async ({ page }) => {
			await page.goto('/models');
			for (const model of MODELS) {
				const card = page.locator('a.card').filter({ hasText: model }).first();
				await expect(card).toBeVisible({ timeout: 15_000 });
				await expect(card).toHaveScreenshot(`models-card-${model}-${theme}.png`);
			}
		});

		test('/models table openness cells', async ({ page }) => {
			await page.goto('/models?view=table');
			const rows = page.locator('main table.tbl tbody tr');
			await expect(rows.first()).toBeVisible({ timeout: 15_000 });
			for (const model of MODELS) {
				const cell = rows.filter({ hasText: model }).first().locator('.openness-cell');
				await expect(cell).toHaveScreenshot(`models-table-cell-${model}-${theme}.png`);
			}
		});

		test('/models table openness hover', async ({ page }) => {
			await page.goto('/models?view=table');
			const row = page.locator('main table.tbl tbody tr').filter({ hasText: 'mock-cross-encoder' });
			await expect(row.first()).toBeVisible({ timeout: 15_000 });
			await row.first().locator('.openness-cell').hover();
			const portal = page.locator('.hover-portal');
			await expect(portal).toBeVisible();
			await expect(portal).toHaveScreenshot(`models-table-hover-mock-cross-encoder-${theme}.png`);
		});

		test('/compare openness section', async ({ page }) => {
			await page.goto(COMPARE_URL);
			const section = page.locator('section.cmp-section').filter({
				has: page.getByRole('heading', { name: 'Openness' })
			});
			await expect(section).toBeVisible({ timeout: 15_000 });
			await expect(section).toHaveScreenshot(`compare-openness-${theme}.png`);
		});
	});
}
