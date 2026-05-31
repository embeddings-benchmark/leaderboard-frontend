import { test, expect } from '@playwright/test';

test('summary table column sort reorders rows', async ({ page }) => {
	await page.goto('/');
	await page.waitForTimeout(800);

	const firstCell = page.locator('table tbody tr').first().locator('td.sticky-model');
	const topByRank = (await firstCell.textContent())?.trim();
	expect(topByRank).toBeTruthy();

	// Scope queries to the table header so we don't match the "Model filters" sidebar block.
	const header = page.locator('table thead');

	await header.getByRole('button', { name: /^Model/ }).click();
	const topByName = (await firstCell.textContent())?.trim();
	expect(topByName).not.toBe(topByRank);

	await header.getByRole('button', { name: /^Model/ }).click();
	const topByNameDesc = (await firstCell.textContent())?.trim();
	expect(topByNameDesc).not.toBe(topByName);

	await header.getByRole('button', { name: /Max Tokens/ }).click();
	const topByTokens = await page
		.locator('table tbody tr')
		.first()
		.locator('td.num')
		.nth(5)
		.textContent();
	const secondByTokens = await page
		.locator('table tbody tr')
		.nth(1)
		.locator('td.num')
		.nth(5)
		.textContent();
	function parse(n: string | null): number {
		if (!n) return 0;
		return parseInt(n.replace(/[^0-9]/g, ''), 10) || 0;
	}
	expect(parse(topByTokens)).toBeGreaterThanOrEqual(parse(secondByTokens));
});
