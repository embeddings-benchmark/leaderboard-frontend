import { test, expect } from '@playwright/test';

test('redesigned filters: chips, segmented, switch, pills all behave', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
	});

	await page.goto('/');
	await page.waitForTimeout(800);

	// No active chips at first load (everything default).
	const chip = page.locator('.active-chip').first();
	await expect(chip).toHaveCount(0);

	// Open by default: Model filters block. Click "Open" in Availability segmented.
	const openSeg = page.getByRole('radio', { name: 'Open' });
	await openSeg.click();
	await expect(openSeg).toHaveAttribute('aria-checked', 'true');

	// An active chip should appear.
	await expect(page.locator('.active-chip')).toContainText('Open only');

	// Sentence-Transformers switch.
	const stSwitch = page.locator('label.switch');
	await stSwitch.click();
	await expect(page.locator('.active-chip', { hasText: 'ST compatible' })).toBeVisible();

	// Reset all clears chips.
	await page.getByRole('button', { name: 'Reset all' }).click();
	await expect(page.locator('.active-chip')).toHaveCount(0);

	// Tabs still work (regression for the earlier effect loop).
	const perfTime = page.getByRole('tab', { name: 'Performance over Time' });
	await perfTime.click();
	await expect(perfTime).toHaveClass(/active/);

	expect(errors.filter((e) => e.includes('effect_update_depth')).length).toBe(0);
});
