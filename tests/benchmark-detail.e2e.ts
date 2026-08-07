import { test, expect } from '@playwright/test';

// Benchmark detail page hero + tab switching. Uses the deterministic
// mock benchmark (MTEB(eng, v2)) so the assertions don't depend on a
// live backend.

const BENCH = 'MTEB(eng, v2)';
const SLUG = encodeURIComponent(BENCH);
const ALIAS = 'MTEB(eng)';
const ALIAS_SLUG = encodeURIComponent(ALIAS);
// MTEB(eng, v2) has no language_view, so its perf_language tab is
// hidden — use the multilingual mock for that deep-link test.
const MULTI_SLUG = encodeURIComponent('MTEB(Multilingual, v2)');

test('benchmark detail page loads the hero and the summary tab by default', async ({ page }) => {
	await page.goto(`/benchmark/${SLUG}/`);
	// Hero shows the benchmark name as the page title.
	await expect(page.getByRole('heading', { name: BENCH }).first()).toBeVisible();
	// Summary tab is active by default; SummaryTable has a Model column header.
	await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('table thead').first()).toBeVisible();
});

test('tab switching activates the selected tab and updates the URL', async ({ page }) => {
	await page.goto(`/benchmark/${SLUG}/`);

	const perTask = page.getByRole('tab', { name: 'Performance per task' });
	await perTask.click();
	await expect(perTask).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL(/[?&]tab=perf_task/);

	// Summary tab is implicit (omitted from URL) — clicking it removes ?tab=.
	await page.getByRole('tab', { name: 'Summary' }).click();
	await expect(page).not.toHaveURL(/[?&]tab=/);
});

test('the URL ?tab= param rehydrates the active tab on load', async ({ page }) => {
	await page.goto(`/benchmark/${MULTI_SLUG}/?tab=perf_language`);
	await expect(page.getByRole('tab', { name: 'Performance per language' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
});

test('benchmark alias route fetches summary with the canonical benchmark name', async ({
	page
}) => {
	const scorePaths: string[] = [];
	page.on('request', (request) => {
		const path = decodeURIComponent(new URL(request.url()).pathname);
		if (path.includes('/scores')) scorePaths.push(path);
	});

	await page.goto(`/benchmark/${ALIAS_SLUG}/`);

	await expect(page.getByRole('heading', { name: BENCH }).first()).toBeVisible();
	await expect(page.locator('table thead').first()).toBeVisible();
	expect(scorePaths).toContain(`/v1/benchmarks/${BENCH}/scores`);
	expect(scorePaths).not.toContain(`/v1/benchmarks/${ALIAS}/scores`);
});
