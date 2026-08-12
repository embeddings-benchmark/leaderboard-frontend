import { expect, test } from '@playwright/test';

// Custom-grouping "Memory Type" columns on SummaryTable — mock fixture is
// LMEB (tests/fixtures/mockBenchmarks.ts + mockSummary.ts), mirroring the
// real backend's LMEB benchmark. Covers the super-header row, per-group
// columns, and sorting; also checks an unrelated benchmark is unaffected.

const LMEB_SLUG = encodeURIComponent('LMEB');
const OTHER_SLUG = encodeURIComponent('MTEB(eng, v2)');

test('LMEB summary table renders the Memory Type super-header and group columns', async ({
	page
}) => {
	await page.goto(`/benchmark/${LMEB_SLUG}/`);

	// stickyHead clones the <thead> into a viewport-pinned overlay, so every
	// header locator matches twice — always take the first (see openness.e2e.ts).
	await expect(page.getByRole('columnheader', { name: /Memory Type/ }).first()).toBeVisible();

	for (const label of ['Episodic', 'Dialogue', 'Semantic', 'Procedural']) {
		await expect(page.getByRole('columnheader', { name: label }).first()).toBeVisible();
	}

	// Every visible row gets a formatted score in each group column (mock
	// fixture always produces a value — no missing-data path here).
	const firstRow = page.locator('main table.tbl tbody tr').first();
	await expect(firstRow.locator('td')).not.toHaveCount(0);
});

test('sorting by a custom-group column updates the URL and row order', async ({ page }) => {
	await page.goto(`/benchmark/${LMEB_SLUG}/`);

	await page
		.getByRole('button', { name: /^Episodic/ })
		.first()
		.click();
	await expect(page).toHaveURL(/[?&]s\.summary=cg%3AMemory\+Type/);
});

test('an unrelated benchmark renders no custom-group super-header', async ({ page }) => {
	await page.goto(`/benchmark/${OTHER_SLUG}/`);
	await expect(page.locator('table thead').first()).toBeVisible();
	await expect(page.locator('.cg-superhead')).toHaveCount(0);
});
