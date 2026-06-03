import { test, expect } from '@playwright/test';

// Root / route: benchmark category cards from the mock menu.
// The menu loads via an async loader after mount, so we wait for cards.

test('home page renders the brand and at least one benchmark card', async ({ page }) => {
	const consoleErrors: string[] = [];
	page.on('pageerror', (err) => consoleErrors.push(err.message));
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text());
	});

	await page.goto('/');
	await expect(page.getByRole('link', { name: /MTEB/, exact: false }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: /Pick a benchmark to explore/i })).toBeVisible();
	// Top nav.
	await expect(page.getByRole('link', { name: 'Models', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Tasks', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Compare', exact: true })).toBeVisible();
	// Benchmark cards render after the async menu loader resolves on mount.
	await expect(page.locator('a[href*="/benchmark/"]').first()).toBeVisible({ timeout: 10_000 });
	// No pageerror / console.error.
	expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('top nav links route to the matching index pages', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('link', { name: 'Models', exact: true }).click();
	await expect(page).toHaveURL(/\/models\/?(?:\?|$)/);
	await expect(page.getByRole('heading', { name: /Models/i }).first()).toBeVisible();

	await page.getByRole('link', { name: 'Tasks', exact: true }).click();
	await expect(page).toHaveURL(/\/tasks\/?(?:\?|$)/);

	await page.getByRole('link', { name: 'Compare', exact: true }).click();
	// /compare auto-syncs ?benchmark= from the leaderboard store, so we just
	// assert the pathname and don't pin the query string.
	await expect(page).toHaveURL(/\/compare\/?(?:\?|$)/);

	// Back home via brand.
	await page.getByRole('link', { name: /MTEB/, exact: false }).first().click();
	await expect(page).toHaveURL(/\/(?:\?.*)?$/);
});
