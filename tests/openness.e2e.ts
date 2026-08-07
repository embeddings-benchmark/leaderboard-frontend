import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Openness column + filter coverage across the two tables that render it:
// ModelsTable (/models?view=table) and SummaryTable (/benchmark/[name]).
//
// Fixture contract (tests/mock-api.ts) — the assertions below depend on it:
//   mock-model             all six dimensions   → 6/6
//   mock-cross-encoder     paper + model card   → 2/6
//   mock-unknown-openness  no openness data     → empty cell, fails every filter

const BENCH_SLUG = encodeURIComponent('MTEB(eng, v2)');

function rows(page: Page): Locator {
	return page.locator('main table.tbl tbody tr');
}
// `stickyHead` clones the <thead> into a viewport-pinned overlay, so every
// header locator matches twice — always take the first.
function header(page: Page, name: RegExp): Locator {
	return page.getByRole('columnheader', { name }).first();
}
function opennessMeter(row: Locator): Locator {
	return row.locator('.openness-cell [role="img"]');
}
// FilterFacet renders each option as `label.pill` wrapping a checkbox; pills
// intercept pointer events so the checkbox is force-clicked (same as
// filter-roundtrip.e2e.ts).
function facetCheckbox(page: Page, label: string): Locator {
	return page
		.locator('aside.sidebar label.pill')
		.filter({ has: page.locator(`span:text-is("${label}")`) })
		.locator('input[type=checkbox]');
}

async function gotoModelsTable(page: Page) {
	await page.goto('/models?view=table');
	await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
}

test.describe('/models Openness column', () => {
	test('renders a per-model meter, and leaves the cell empty when data is absent', async ({
		page
	}) => {
		await gotoModelsTable(page);

		await expect(header(page, /Openness/)).toBeVisible();

		const full = rows(page).filter({ hasText: 'mock-model' }).first();
		await expect(opennessMeter(full)).toHaveAttribute(
			'aria-label',
			'Openness score: 6 of 6 dimensions'
		);

		const partial = rows(page).filter({ hasText: 'mock-cross-encoder' }).first();
		await expect(opennessMeter(partial)).toHaveAttribute(
			'aria-label',
			'Openness score: 2 of 6 dimensions'
		);

		// No openness data → the cell renders, but with no meter inside it.
		const unknown = rows(page).filter({ hasText: 'mock-unknown-openness' }).first();
		await expect(unknown.locator('.openness-cell')).toHaveCount(1);
		await expect(opennessMeter(unknown)).toHaveCount(0);
	});

	test('sorting by Openness orders by score, missing data last', async ({ page }) => {
		await gotoModelsTable(page);

		await page
			.getByRole('button', { name: /^Openness/ })
			.first()
			.click();
		await expect(page).toHaveURL(/[?&]s\.models=openness/);

		// Natural direction is desc — highest score first, unknown at the bottom.
		await expect
			.poll(async () =>
				rows(page).evaluateAll((rs) =>
					rs.map((r) => r.querySelector('.openness-cell [role="img"]')?.getAttribute('aria-label'))
				)
			)
			.toEqual([
				'Openness score: 6 of 6 dimensions',
				'Openness score: 2 of 6 dimensions',
				undefined // mock-unknown-openness — no meter in the cell
			]);
	});

	test('hovering a cell opens the per-dimension breakdown', async ({ page }) => {
		await gotoModelsTable(page);

		await expect(page.locator('.hover-portal')).toHaveCount(0);
		// The row-link's full-row `::after` overlay used to swallow this hover —
		// `.openness-cell` is lifted above it in leaderboard-table.css.
		await rows(page).filter({ hasText: 'mock-model' }).first().locator('.openness-cell').hover();

		const portal = page.locator('.hover-portal');
		await expect(portal).toBeVisible();
		await expect(portal).toContainText('Open weights');
		await expect(portal).toContainText('Training data');
		await expect(portal).toContainText('6/6');
	});
});

test.describe('/models cards view', () => {
	// The cards are the default view, so the openness filter needs visible
	// feedback here too — the score sits in the 2×2 stat grid, in the slot the
	// release date vacated when it moved up to a byline under the title.
	test('each card carries an Openness stat and a release-date byline', async ({ page }) => {
		await page.goto('/models');
		await expect(page.locator('a.card').first()).toBeVisible({ timeout: 15_000 });

		const card = (name: string) => page.locator('a.card').filter({ hasText: name }).first();

		const labels = await card('mock-model')
			.locator('.card-stats dt')
			.evaluateAll((ds) => ds.map((d) => d.textContent?.trim()));
		expect(labels).toEqual(['Parameters', 'Embed dim', 'Max tokens', 'Openness']);

		await expect(card('mock-model').locator('.openness-stat')).toContainText('6/6');
		await expect(card('mock-model').locator('.title-date')).toContainText('Released');

		// No openness data → an em dash, so the grid stays aligned.
		await expect(card('mock-unknown-openness').locator('.openness-stat')).toHaveText('—');
	});
});

test.describe('/models Openness filter', () => {
	test('a requirement narrows the list and round-trips through ?openreq=', async ({ page }) => {
		await gotoModelsTable(page);
		await expect(rows(page)).toHaveCount(3);

		await facetCheckbox(page, 'Training data').click({ force: true });

		await expect(page).toHaveURL(/[?&]openreq=data/);
		await expect(rows(page)).toHaveCount(1);
		await expect(rows(page).first()).toContainText('mock-model');

		// Deep-link restore.
		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
		await expect(facetCheckbox(page, 'Training data')).toBeChecked();
		await expect(rows(page)).toHaveCount(1);
	});

	test('checks are ANDed — each one only ever narrows', async ({ page }) => {
		await gotoModelsTable(page);

		// `paper` alone admits both models that carry openness data.
		await facetCheckbox(page, 'Paper').click({ force: true });
		await expect(page).toHaveURL(/[?&]openreq=paper/);
		await expect(rows(page)).toHaveCount(2);

		// Adding `open weights` must narrow, not widen — the cross-encoder has a
		// paper but no open weights. Guards the facet's AND semantics, which are
		// inverted relative to every other (OR) facet in the sidebar.
		await facetCheckbox(page, 'Open weights').click({ force: true });
		await expect(page).toHaveURL(/[?&]openreq=weights%2Cpaper/);
		await expect(rows(page)).toHaveCount(1);
		await expect(rows(page).first()).toContainText('mock-model');
	});
});

test.describe('Openness on the benchmark summary table', () => {
	test('the column renders with per-model meters', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}`);
		await expect(page.locator('.tab-pane.active table tbody tr').first()).toBeVisible({
			timeout: 20_000
		});

		await expect(header(page, /Openness/)).toBeVisible();
		await expect(
			page.locator('.tab-pane.active .openness-cell [role="img"]').first()
		).toHaveAttribute('aria-label', /Openness score: \d of 6 dimensions/);
	});
});

// The two tables share `COLUMN_INFO` (src/lib/column-info.ts) precisely so a
// user who reads a column tooltip on one page gets the same text on the other.
test.describe('shared column tooltip copy', () => {
	async function headerTip(page: Page, scope: string, name: RegExp): Promise<string> {
		await page.locator(`${scope} th`).filter({ hasText: name }).first().hover();
		const portal = page.locator('.hover-portal');
		await expect(portal).toBeVisible();
		return (await portal.innerText()).trim();
	}

	test('Parameters and Openness read identically on /models and /benchmark', async ({ page }) => {
		await gotoModelsTable(page);
		const modelsParams = await headerTip(page, 'main table.tbl thead', /Parameters/);
		await page.mouse.move(0, 0);
		const modelsOpenness = await headerTip(page, 'main table.tbl thead', /Openness/);

		await page.goto(`/benchmark/${BENCH_SLUG}`);
		await expect(page.locator('.tab-pane.active table tbody tr').first()).toBeVisible({
			timeout: 20_000
		});
		const benchParams = await headerTip(page, '.tab-pane.active thead', /Parameters/);
		await page.mouse.move(0, 0);
		const benchOpenness = await headerTip(page, '.tab-pane.active thead', /Openness/);

		expect(modelsParams).toBe(benchParams);
		expect(modelsOpenness).toBe(benchOpenness);
		expect(modelsParams).toContain('Total parameter count');
	});
});
