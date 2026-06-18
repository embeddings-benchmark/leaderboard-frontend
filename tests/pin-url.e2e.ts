import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// `pinnedModels` round-trip through `?pin=`. Regression guard for the
// single remaining `string`-value caller of `updateUrl`.

const BENCH_SLUG = encodeURIComponent('MTEB(eng, v2)');

// Benchmark detail pre-mounts the per-task / per-language panes (`data-prepaint`)
// so first-tab-click is instant. All three tables key off the same pinned set,
// so unscoped selectors would count hidden duplicates.
const ACTIVE = '.tab-pane.active';

async function waitForRows(page: Page) {
	await expect(page.locator(`${ACTIVE} table tbody tr`).first()).toBeVisible({ timeout: 20_000 });
}

function pinButton(row: Locator): Locator {
	return row.locator('button.tbl-pin-btn');
}

// Canonical model `name` (URL state form), not the displayed `displayName`.
async function modelNameOfRow(row: Locator): Promise<string> {
	const href = await row.locator('th.sticky-model a').first().getAttribute('href');
	if (!href) throw new Error('row has no model link');
	const idx = href.indexOf('/models/');
	if (idx < 0) throw new Error('unexpected href: ' + href);
	return decodeURIComponent(href.slice(idx + '/models/'.length));
}

async function currentUrl(page: Page): Promise<URL> {
	return new URL(await page.evaluate(() => window.location.href));
}

test.describe('?pin= URL roundtrip on /benchmark/[name]', () => {
	test('pinning a row writes `?pin=<name>`; reload restores the pinned row', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}/`);
		await waitForRows(page);
		await expect(page).not.toHaveURL(/[?&]pin=/);

		const firstRow = page.locator(`${ACTIVE} table tbody tr`).first();
		const modelName = await modelNameOfRow(firstRow);
		expect(modelName).not.toBe('');

		await pinButton(firstRow).click();
		await expect(firstRow).toHaveClass(/\bpinned\b/);
		await expect(page).toHaveURL(/[?&]pin=/);

		const url = await currentUrl(page);
		const decoded = decodeURIComponent(url.searchParams.get('pin') ?? '');
		expect(decoded).toBe(modelName);

		await page.goto(url.toString());
		await waitForRows(page);
		const pinnedNow = page.locator(`${ACTIVE} table tbody tr.pinned`).first();
		await expect(pinnedNow).toBeVisible();
		expect(await modelNameOfRow(pinnedNow)).toBe(modelName);
		await expect(pinButton(pinnedNow)).toHaveAttribute('aria-label', 'Unpin row');
	});

	test('pinning two rows produces a comma-separated `?pin=`; both restore on reload', async ({
		page
	}) => {
		await page.goto(`/benchmark/${BENCH_SLUG}/`);
		await waitForRows(page);

		const row0 = page.locator(`${ACTIVE} table tbody tr`).nth(0);
		const row1 = page.locator(`${ACTIVE} table tbody tr`).nth(1);
		const name0 = await modelNameOfRow(row0);
		const name1 = await modelNameOfRow(row1);
		expect(name0).not.toBe(name1);
		await pinButton(row0).click();
		await pinButton(row1).click();
		await expect(page.locator(`${ACTIVE} table tbody tr.pinned`)).toHaveCount(2);

		const url = await currentUrl(page);
		// `encodeSet`+`URLSearchParams.set`+`.get` cancels out to "a,b".
		const raw = url.searchParams.get('pin') ?? '';
		expect(raw.split(',').sort()).toEqual([name0, name1].sort());

		await page.goto(url.toString());
		await waitForRows(page);
		await expect(page.locator(`${ACTIVE} table tbody tr.pinned`)).toHaveCount(2);
	});

	test('unpinning the last row leaves `?pin=` as an empty deselect-all gesture', async ({
		page
	}) => {
		// `?k=` (vs no param) is the convention for "user emptied the set".
		await page.goto(`/benchmark/${BENCH_SLUG}/`);
		await waitForRows(page);

		const row = page.locator(`${ACTIVE} table tbody tr`).first();
		await pinButton(row).click();
		await expect(row).toHaveClass(/\bpinned\b/);
		await expect(page).toHaveURL(/[?&]pin=[^&]/);

		await pinButton(row).click();
		await expect(row).not.toHaveClass(/\bpinned\b/);
		await expect(page).toHaveURL(/[?&]pin=(&|$)/);
	});

	test('deep-link with `?pin=<name>` hydrates the pinned set on first paint', async ({ page }) => {
		await page.goto(`/benchmark/${BENCH_SLUG}/`);
		await waitForRows(page);
		const targetName = await modelNameOfRow(page.locator(`${ACTIVE} table tbody tr`).nth(2));

		await page.goto(`/benchmark/${BENCH_SLUG}/?pin=${encodeURIComponent(targetName)}`);
		await waitForRows(page);
		const pinned = page.locator(`${ACTIVE} table tbody tr.pinned`);
		await expect(pinned).toHaveCount(1);
		expect(await modelNameOfRow(pinned.first())).toBe(targetName);
	});
});
