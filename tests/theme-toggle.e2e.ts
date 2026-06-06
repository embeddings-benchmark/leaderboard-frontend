import { test, expect } from '@playwright/test';

// Theme toggle: light / system / dark are radio buttons. Clicking should
// pin <html data-theme>, update the <meta name="color-scheme">, and
// (best-effort) persist to localStorage. The persist call may throw in
// sandboxed iframes (HF Spaces) but the DOM updates must land regardless —
// that's the bug we fixed by moving DOM mutations before the storage write.

test('theme toggle flips data-theme on <html> and the color-scheme meta', async ({ page }) => {
	await page.goto('/');

	const html = page.locator('html');
	const meta = page.locator('meta[name="color-scheme"]');

	// Default = system: no data-theme, meta says "light dark".
	await expect(html).not.toHaveAttribute('data-theme', /.+/);
	await expect(meta).toHaveAttribute('content', 'light dark');

	await page.getByRole('radio', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await expect(meta).toHaveAttribute('content', 'dark');

	await page.getByRole('radio', { name: 'Light' }).click();
	await expect(html).toHaveAttribute('data-theme', 'light');
	await expect(meta).toHaveAttribute('content', 'light');

	await page.getByRole('radio', { name: 'System' }).click();
	await expect(html).not.toHaveAttribute('data-theme', /.+/);
	await expect(meta).toHaveAttribute('content', 'light dark');
});

test('theme still flips even when localStorage throws (sandboxed iframe sim)', async ({ page }) => {
	// Simulate the HF Spaces sandbox: every localStorage call throws
	// SecurityError. Before our fix, the apply() try-block also wrapped the
	// DOM updates, so the throw skipped setAttribute('data-theme') and the
	// toggle silently did nothing. After the fix, DOM updates happen first.
	await page.addInitScript(() => {
		const broken = {
			getItem: () => {
				throw new DOMException('blocked', 'SecurityError');
			},
			setItem: () => {
				throw new DOMException('blocked', 'SecurityError');
			},
			removeItem: () => {
				throw new DOMException('blocked', 'SecurityError');
			},
			key: () => null,
			clear: () => undefined,
			length: 0
		};
		Object.defineProperty(window, 'localStorage', { configurable: true, get: () => broken });
	});

	await page.goto('/');
	const html = page.locator('html');

	await page.getByRole('radio', { name: 'Dark' }).click();
	await expect(html).toHaveAttribute('data-theme', 'dark');

	await page.getByRole('radio', { name: 'Light' }).click();
	await expect(html).toHaveAttribute('data-theme', 'light');
});
