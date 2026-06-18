import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const MAX_PICKED = 4;
const MAX_BENCHMARKS = 6;

async function waitForCompareReady(page: Page) {
	// Two chips = the page auto-seeded the top 2 models from the primary summary.
	await expect(page.locator('main .picker-bar .pick-chip')).toHaveCount(2, { timeout: 20_000 });
}

// `page.url()` stays stale after `replaceState`; read through `window.location`.
async function currentUrl(page: Page): Promise<URL> {
	const href = await page.evaluate(() => window.location.href);
	return new URL(href);
}

function modelChips(page: Page): Locator {
	return page.locator('main .picker-bar .pick-chip');
}
function modelChipNames(page: Page): Locator {
	return modelChips(page).locator('.pick-name');
}
function benchChips(page: Page): Locator {
	return page.locator('.bench-picker .pick-chip.bench-chip');
}
function benchChipNames(page: Page): Locator {
	return benchChips(page).locator('.pick-name');
}
function taskChips(page: Page): Locator {
	return page.locator('.bench-picker .pick-chip.task-chip');
}

// Chips show `org/displayName`; URL state needs the unique `name` which
// lives in the chip's `title` attr.
async function chipModelNames(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>('main .picker-bar .pick-chip .pick-name')
		).map((el) => el.getAttribute('title') ?? el.textContent ?? '')
	);
}

test.describe('/compare URL roundtrip (regression guard for repeated-key form)', () => {
	test('two seeded models serialise as repeated `?model=` and survive reload', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);
		await expect(page).toHaveURL(/[?&]model=/);

		const initialNames = await modelChipNames(page).allTextContents();
		expect(initialNames).toHaveLength(2);

		// Repeated-key form — must NOT be `?model=a%2Cb`.
		const url = await currentUrl(page);
		expect(url.searchParams.getAll('model')).toHaveLength(2);
		expect(url.search).not.toMatch(/model=[^&]*%2C/);

		await page.goto(url.toString());
		await waitForCompareReady(page);
		await expect(modelChipNames(page)).toHaveText(initialNames);
	});

	test('benchmark name with comma round-trips without double-encoding', async ({ page }) => {
		// Default `MTEB(Multilingual, v2)` carries a literal comma — the old
		// writer double-encoded it to `%252C` and the catalog couldn't resolve.
		await page.goto('/compare');
		await waitForCompareReady(page);
		await expect(page).toHaveURL(/[?&]benchmark=/);

		const url = await currentUrl(page);
		expect(url.searchParams.getAll('benchmark')).toEqual(['MTEB(Multilingual, v2)']);
		expect(url.search).not.toContain('%25');

		await page.goto(url.toString());
		await waitForCompareReady(page);
		await expect(benchChipNames(page).first()).toHaveText('MTEB(Multilingual, v2)');
	});

	test('adding a second benchmark writes two repeated `?benchmark=` pairs', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		await page.getByRole('button', { name: /Add benchmark/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Pick benchmark' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: /MTEB\(eng, v2\)/ }).click();

		await expect(benchChips(page)).toHaveCount(2);
		await expect
			.poll(async () => (await currentUrl(page)).searchParams.getAll('benchmark').length)
			.toBe(2);

		const url = await currentUrl(page);
		expect(url.searchParams.getAll('benchmark')).toEqual([
			'MTEB(Multilingual, v2)',
			'MTEB(eng, v2)'
		]);

		await page.goto(url.toString());
		await waitForCompareReady(page);
		await expect(benchChips(page)).toHaveCount(2);
		await expect(benchChipNames(page).nth(0)).toHaveText('MTEB(Multilingual, v2)');
		await expect(benchChipNames(page).nth(1)).toHaveText('MTEB(eng, v2)');
	});

	test('legacy comma-joined share links still hydrate (back-compat)', async ({ page }) => {
		// Pre-fix share links use `?model=a%2Cb`; the raw-search fallback in
		// `readMultiParam` keeps them working.
		await page.goto('/compare');
		await waitForCompareReady(page);
		const seededNames = await chipModelNames(page);
		const seededDisplay = await modelChipNames(page).allTextContents();

		const legacy =
			'/compare?model=' +
			seededNames.map((n) => encodeURIComponent(n)).join('%2C') +
			'&benchmark=' +
			encodeURIComponent('MTEB(Multilingual, v2)');

		await page.goto(legacy);
		await waitForCompareReady(page);
		await expect(modelChipNames(page)).toHaveText(seededDisplay);
	});
});

test.describe('/compare model picker', () => {
	test('add → remove → URL stays in sync', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);
		const initial = await modelChipNames(page).allTextContents();

		await page
			.locator('main .picker-bar')
			.getByRole('button', { name: /Add model/ })
			.click();
		const dialog = page.getByRole('dialog', { name: 'Pick model' });
		await expect(dialog).toBeVisible();
		await dialog.getByPlaceholder(/Search models/).fill('Linq');
		await dialog.getByRole('button', { name: /Linq-Embed-Mistral/ }).click();

		await expect(modelChips(page)).toHaveCount(3);
		await expect
			.poll(async () => (await currentUrl(page)).searchParams.getAll('model').length)
			.toBe(3);
		const after = await modelChipNames(page).allTextContents();
		expect(after.slice(0, 2)).toEqual(initial);
		expect(after[2]).toBe('Linq-Embed-Mistral');

		await page.keyboard.press('Escape');
		const third = modelChips(page).nth(2);
		await third.getByRole('button', { name: /Remove from comparison/ }).click();
		await expect(modelChips(page)).toHaveCount(2);
		await expect
			.poll(async () => (await currentUrl(page)).searchParams.getAll('model').length)
			.toBe(2);
	});

	test('Clear button empties picks and shows the empty state', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		await page.getByRole('button', { name: /^Clear$/ }).click();
		await expect(modelChips(page)).toHaveCount(0);
		await expect(page.locator('section.empty')).toContainText(/Pick at least one model/);
		await expect(page.locator('section.grid')).toHaveCount(0);
		await expect(page.locator('section.radar-card')).toHaveCount(0);
		await expect.poll(async () => (await currentUrl(page)).searchParams.has('model')).toBe(false);
	});

	test('picker search filters the candidate list', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		await page
			.locator('main .picker-bar')
			.getByRole('button', { name: /Add model/ })
			.click();
		const dialog = page.getByRole('dialog', { name: 'Pick model' });
		await expect(dialog).toBeVisible();

		const before = await dialog.locator('.picker-row').count();
		expect(before).toBeGreaterThan(2);

		await dialog.getByPlaceholder(/Search models/).fill('Qwen');
		// Three Qwen fixtures: 8B / 4B / 0.6B.
		await expect(dialog.locator('.picker-row')).toHaveCount(3);

		await dialog.getByPlaceholder(/Search models/).fill('xyzzy-not-a-real-model');
		await expect(dialog.locator('.picker-empty')).toBeVisible();
		await expect(dialog.locator('.picker-row')).toHaveCount(0);
	});

	test('once `MAX_PICKED` models are picked, the +Add button disappears', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		const addBtn = () =>
			page.locator('main .picker-bar').getByRole('button', { name: /Add model/ });
		for (let i = 2; i < MAX_PICKED; i++) {
			await addBtn().click();
			const dialog = page.getByRole('dialog', { name: 'Pick model' });
			await dialog.locator('.picker-row:not(.on)').first().click();
			await expect(modelChips(page)).toHaveCount(i + 1);
			await page.keyboard.press('Escape');
		}
		await expect(addBtn()).toHaveCount(0);
		await expect(modelChips(page)).toHaveCount(MAX_PICKED);
	});
});

test.describe('/compare benchmark picker', () => {
	test('removing the second benchmark hides the × from the lone remaining chip', async ({
		page
	}) => {
		// "At least one benchmark" is a UI invariant — × is hidden when count = 1.
		await page.goto('/compare');
		await waitForCompareReady(page);

		await page.getByRole('button', { name: /Add benchmark/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Pick benchmark' });
		await dialog.getByRole('button', { name: /MTEB\(eng, v2\)/ }).click();
		await page.keyboard.press('Escape');
		await expect(benchChips(page)).toHaveCount(2);
		await expect(
			benchChips(page)
				.nth(0)
				.getByRole('button', { name: /Remove benchmark/ })
		).toBeVisible();

		await benchChips(page)
			.nth(1)
			.getByRole('button', { name: /Remove benchmark/ })
			.click();
		await expect(benchChips(page)).toHaveCount(1);
		await expect(benchChips(page).first().locator('.pick-x')).toHaveCount(0);
	});

	test('+Add disappears at MAX_BENCHMARKS', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		const addBtn = () => page.getByRole('button', { name: /Add benchmark/ });
		for (let i = 1; i < MAX_BENCHMARKS; i++) {
			await addBtn().click();
			const dialog = page.getByRole('dialog', { name: 'Pick benchmark' });
			await dialog.locator('.picker-row:not(.on):not([disabled])').first().click();
			await expect(benchChips(page)).toHaveCount(i + 1);
			await page.keyboard.press('Escape');
		}
		await expect(addBtn()).toHaveCount(0);
	});
});

test.describe('/compare task picker', () => {
	test('adding a task creates a chip and appears in `?task=`', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		await page.getByRole('button', { name: /Add task/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Pick task' });
		await expect(dialog).toBeVisible();
		// Fixtures expose `Task_1..Task_132`; trailing space narrows the match.
		await dialog.getByPlaceholder(/Search tasks/).fill('Task_1 ');
		await dialog
			.getByRole('button', { name: /^Task_1\b/ })
			.first()
			.click();

		await expect(taskChips(page)).toHaveCount(1);
		await expect
			.poll(async () => (await currentUrl(page)).searchParams.getAll('task'))
			.toEqual(['Task_1']);

		const url = await currentUrl(page);
		await page.goto(url.toString());
		await waitForCompareReady(page);
		await expect(taskChips(page)).toHaveCount(1);
	});
});

test.describe('/compare deep-link seeding', () => {
	test('?model=X seeds that exact pick without auto-replacing it', async ({ page }) => {
		// No `?benchmark=` is passed — the back-compat effect derives one from
		// /models/X/scores. The seeded pick must not get clobbered.
		await page.goto('/compare?model=' + encodeURIComponent('qwen3-embedding-4b'));
		await expect(modelChips(page)).toHaveCount(1, { timeout: 20_000 });
		await expect(modelChipNames(page).first()).toHaveText('Qwen3-Embedding-4B');
		await expect
			.poll(async () => (await currentUrl(page)).searchParams.getAll('model'))
			.toEqual(['qwen3-embedding-4b']);
	});
});

test.describe('/compare grid + radar rendering', () => {
	test('score grid renders one bench-cell per (benchmark × model)', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);

		// 1 benchmark × 2 models.
		await expect(page.locator('section.grid .bench-cell')).toHaveCount(2);
		const scores = page.locator('section.grid .bench-cell .score');
		await expect(scores).toHaveCount(2);
		for (const text of await scores.allTextContents()) {
			expect(text).toMatch(/^(\d+\.\d{2}|—)$/);
		}
	});

	test('radar renders for single-benchmark + multi-model state', async ({ page }) => {
		await page.goto('/compare');
		await waitForCompareReady(page);
		await expect(page.locator('section.radar-card')).toBeVisible({ timeout: 15_000 });
		await expect(page.locator('section.radar-card svg').first()).toBeVisible({ timeout: 15_000 });
	});

	test('radar disappears when a second benchmark is added', async ({ page }) => {
		// Radar is gated on `pickedBenchmarks.length === 1`.
		await page.goto('/compare');
		await waitForCompareReady(page);
		await expect(page.locator('section.radar-card')).toBeVisible({ timeout: 15_000 });

		await page.getByRole('button', { name: /Add benchmark/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Pick benchmark' });
		await dialog.getByRole('button', { name: /MTEB\(eng, v2\)/ }).click();
		await page.keyboard.press('Escape');
		await expect(benchChips(page)).toHaveCount(2);
		await expect(page.locator('section.radar-card')).toHaveCount(0);
		// 2 benches × 2 models.
		await expect(page.locator('section.grid .bench-cell')).toHaveCount(4);
	});
});
