import { test, expect } from '@playwright/test';

test('classic page tab click', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			errors.push(`[console.${msg.type()}] ${msg.text()}`);
		}
	});

	await page.goto('/');
	await page.waitForTimeout(800);

	console.log('--- errors after load ---');
	for (const e of errors) console.log(e);
	const before = errors.length;

	const perfTime = page.getByRole('tab', { name: 'Performance over Time' });
	await perfTime.click();
	await page.waitForTimeout(800);

	console.log('--- errors after click ---');
	for (const e of errors.slice(before)) console.log(e);

	await expect(perfTime).toHaveClass(/active/);
});
