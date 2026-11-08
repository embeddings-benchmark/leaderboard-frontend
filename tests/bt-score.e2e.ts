import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// BT Score column + explainer coverage on /benchmark/[name].
//
// Fixture contract (tests/fixtures/mockSummary.ts): every row carries an
// `btScore` that is monotone in `meanTask`, with a ±12 interval, so sorting by BT Score
// must agree with sorting by Mean (Task).

const BENCH_SLUG = encodeURIComponent('MTEB(eng, v2)');

function rows(page: Page): Locator {
	return page.locator('main table.tbl tbody tr');
}
// `stickyHead` clones the <thead>; take the first match.
function header(page: Page, name: RegExp): Locator {
	return page.getByRole('columnheader', { name }).first();
}

async function gotoSummary(page: Page, query = '') {
	await page.goto(`/benchmark/${BENCH_SLUG}${query}`);
	await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Summary BT Score column', () => {
	test('renders a rating with its interval, sortable by header', async ({ page }) => {
		await gotoSummary(page);
		await expect(header(page, /^BT Score/)).toBeVisible();
		// BT Score leads the aggregation columns, ahead of Mean (Task).
		const names = await page
			.locator('main table.tbl thead')
			.first()
			.getByRole('columnheader')
			.allInnerTexts();
		const idx = (re: RegExp) => names.findIndex((n) => re.test(n.trim()));
		expect(idx(/^BT Score/)).toBeGreaterThan(-1);
		expect(idx(/^BT Score/)).toBeLessThan(idx(/^Mean \(Task\)/));

		const first = rows(page).first();
		await expect(first.locator('.bt-score-ci')).toHaveText(/^±12$/);

		await page
			.getByRole('button', { name: /^BT Score/ })
			.first()
			.click();
		await expect(header(page, /^BT Score/)).toHaveAttribute('aria-sort', /ascending|descending/);

		const readBtScores = () =>
			rows(page).evaluateAll((trs) =>
				trs.map((tr) =>
					parseInt(tr.querySelector('.bt-score-ci')?.parentElement?.textContent ?? '', 10)
				)
			);
		await expect
			.poll(async () => {
				const btScores = (await readBtScores()).filter((v) => !Number.isNaN(v));
				return btScores.length > 1 && btScores.every((v, i) => i === 0 || v <= btScores[i - 1]);
			})
			.toBe(true);
	});

	test('sort state round-trips through the URL', async ({ page }) => {
		await gotoSummary(page, '?s.summary=btScore');
		await expect(header(page, /^BT Score/)).toHaveAttribute('aria-sort', /ascending|descending/);
	});
});

test.describe('BT score explanation', () => {
	test('Task information tab explains the method', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=task_info`);
		const details = page.locator('details.bt-score-explainer');
		await expect(details).toBeVisible();
		await details.locator('summary').click();
		await expect(details).toContainText('Missing = loss');
	});
});

test.describe('BT scores tab', () => {
	test('renders the interval plot and switches how many models it shows', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=bt_score`);
		await expect(page.getByRole('tab', { name: 'BT scores' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const plot = page.locator('.js-plotly-plot');
		await expect(plot).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/BT score of the top \d+ models/)).toBeVisible();

		await expect(page.getByRole('radio', { name: 'Top 20' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await page.getByRole('radio', { name: 'Top 50' }).click();
		await expect(page.getByRole('radio', { name: 'Top 50' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(plot).toBeVisible();
	});

	test('"How is it computed?" jumps to the explainer', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=bt_score`);
		await page.getByRole('button', { name: 'How is it computed?' }).click();
		await expect(page.locator('details.bt-score-explainer')).toBeVisible();
	});
});
