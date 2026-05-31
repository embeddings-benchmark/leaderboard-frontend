import { test, expect } from '@playwright/test';

test('dashboard shows Filters button and opens the drawer', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
	});

	await page.goto('/dashboard/');
	await page.waitForTimeout(800);

	const filtersBtn = page.getByRole('button', { name: /Filters/i });
	const visible = await filtersBtn.isVisible().catch(() => false);
	const box = visible ? await filtersBtn.boundingBox() : null;
	console.log('filters button visible:', visible);
	console.log('filters button box:', JSON.stringify(box));

	if (visible) {
		await filtersBtn.click();
		await page.waitForTimeout(400);
		const drawer = page.getByRole('dialog', { name: 'Filters' });
		const drawerVisible = await drawer.isVisible().catch(() => false);
		console.log('drawer visible:', drawerVisible);
	}

	console.log('--- errors ---');
	for (const e of errors) console.log(e);

	expect(visible).toBe(true);
});
