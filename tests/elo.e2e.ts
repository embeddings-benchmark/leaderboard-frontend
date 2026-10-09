import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// ELO column + explainer coverage on /benchmark/[name].
//
// Fixture contract (tests/fixtures/mockSummary.ts): every row carries an
// `elo` that is monotone in `meanTask`, with a ±12 interval, so sorting by ELO
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

test.describe('Summary ELO column', () => {
	test('renders a rating with its interval, sortable by header', async ({ page }) => {
		await gotoSummary(page);
		await expect(header(page, /^ELO/)).toBeVisible();
		// ELO leads the aggregation columns, ahead of Mean (Task).
		const names = await page
			.locator('main table.tbl thead')
			.first()
			.getByRole('columnheader')
			.allInnerTexts();
		const idx = (re: RegExp) => names.findIndex((n) => re.test(n.trim()));
		expect(idx(/^ELO/)).toBeGreaterThan(-1);
		expect(idx(/^ELO/)).toBeLessThan(idx(/^Mean \(Task\)/));

		const first = rows(page).first();
		await expect(first.locator('.elo-ci')).toHaveText(/^±12$/);

		await page.getByRole('button', { name: /^ELO/ }).first().click();
		await expect(header(page, /^ELO/)).toHaveAttribute('aria-sort', /ascending|descending/);

		const readElos = () =>
			rows(page).evaluateAll((trs) =>
				trs.map((tr) => parseInt(tr.querySelector('.elo-ci')?.parentElement?.textContent ?? '', 10))
			);
		await expect
			.poll(async () => {
				const elos = (await readElos()).filter((v) => !Number.isNaN(v));
				return elos.length > 1 && elos.every((v, i) => i === 0 || v <= elos[i - 1]);
			})
			.toBe(true);
	});

	test('sort state round-trips through the URL', async ({ page }) => {
		await gotoSummary(page, '?s.summary=elo');
		await expect(header(page, /^ELO/)).toHaveAttribute('aria-sort', /ascending|descending/);
	});
});

test.describe('ELO explanation', () => {
	test('Task information tab explains the method', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=task_info`);
		const details = page.locator('details.elo-explainer');
		await expect(details).toBeVisible();
		await details.locator('summary').click();
		await expect(details).toContainText('Missing = loss');
	});
});

test.describe('ELO ratings tab', () => {
	test('renders the interval plot and switches how many models it shows', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=elo`);
		await expect(page.getByRole('tab', { name: 'ELO ratings' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const plot = page.locator('.js-plotly-plot');
		await expect(plot).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/ELO rating of the top \d+ models/)).toBeVisible();

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
		await page.goto(`/benchmark/${BENCH_SLUG}?tab=elo`);
		await page.getByRole('button', { name: 'How is it computed?' }).click();
		await expect(page.locator('details.elo-explainer')).toBeVisible();
	});
});
