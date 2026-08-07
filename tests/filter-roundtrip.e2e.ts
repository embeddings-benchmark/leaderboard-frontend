import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Filter ⇄ chip ⇄ URL ⇄ Reset all roundtrip coverage.

function activeStrip(page: Page): Locator {
	return page.locator('.active-strip');
}
function activeChips(page: Page): Locator {
	return page.locator('.active-strip .active-chip');
}
function resetAll(page: Page): Locator {
	return page.locator('.active-strip .reset-all');
}
function modalityCheckbox(page: Page, modality: string): Locator {
	return page.locator(`aside.sidebar label.pill[data-modality="${modality}"] input[type=checkbox]`);
}
function sidebarCheckbox(page: Page, label: string): Locator {
	// Exact span match (e.g. "Web" doesn't match "Webex"); pills intercept
	// pointer events so callers force-click the underlying checkbox.
	return page
		.locator('aside.sidebar label.pill')
		.filter({ has: page.locator(`span:text-is("${label}")`) })
		.locator('input[type=checkbox]');
}
async function togglePill(locator: Locator) {
	await locator.click({ force: true });
}

// Stub `navigator.clipboard.writeText` so we can read back what the share
// button copied without requesting browser clipboard permission.
async function installClipboardSpy(page: Page) {
	await page.evaluate(() => {
		(window as unknown as { __copied: string | null }).__copied = null;
		navigator.clipboard.writeText = async (t: string) => {
			(window as unknown as { __copied: string }).__copied = t;
		};
	});
}
// Click the ShareUrlButton and assert it copied the live `page.url()` — i.e.
// the address bar reflects the active filters. Regression guard for the
// `$app/navigation.replaceState` quirk where `page.url` stays stale after
// shallow URL updates.
async function expectShareCopiesCurrentUrl(page: Page) {
	await page.locator('button.share-btn').click();
	const copied = await page.evaluate(
		() => (window as unknown as { __copied: string | null }).__copied ?? ''
	);
	expect(copied).toBe(page.url());
}

async function waitForCatalogue(page: Page) {
	// Wait until at least one real card paints so `filtersSeeded` has flipped.
	await expect(page.locator('a[href*="/benchmark/"]').first()).toBeVisible({ timeout: 15_000 });
}

async function cardCount(page: Page): Promise<number> {
	return page.locator('a[href*="/benchmark/"]').count();
}

test.describe('/benchmarks filter URL roundtrip', () => {
	test('modality toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		await installClipboardSpy(page);
		const baseline = await cardCount(page);
		expect(baseline).toBeGreaterThan(0);
		await expect(activeStrip(page)).toHaveCount(0);

		await togglePill(modalityCheckbox(page, 'text'));
		await expect(page).toHaveURL(/[?&]mods=/);
		await expect(activeChips(page)).toContainText('Modality');
		await expect(resetAll(page)).toBeVisible();
		// ShareUrlButton must serialise the active filters — `page.url` stays
		// stale after `replaceState`, so reading it would drop ?mods=.
		await expectShareCopiesCurrentUrl(page);

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(modalityCheckbox(page, 'text')).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Modality');
		await expect(page).toHaveURL(/[?&]mods=/);

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(modalityCheckbox(page, 'text')).toBeChecked();
		await expect.poll(() => cardCount(page)).toBe(baseline);
	});

	test('domain toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		const baseline = await cardCount(page);

		await togglePill(sidebarCheckbox(page, 'Academic'));
		await expect(page).toHaveURL(/[?&]doms=/);
		await expect(activeChips(page)).toContainText('Domain');

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(sidebarCheckbox(page, 'Academic')).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Domain');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(sidebarCheckbox(page, 'Academic')).toBeChecked();
		await expect.poll(() => cardCount(page)).toBe(baseline);
	});

	test('language toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		const baseline = await cardCount(page);

		await togglePill(sidebarCheckbox(page, 'eng-Latn'));
		await expect(page).toHaveURL(/[?&]langs=/);
		await expect(activeChips(page)).toContainText('Lang');

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(sidebarCheckbox(page, 'eng-Latn')).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Lang');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(sidebarCheckbox(page, 'eng-Latn')).toBeChecked();
		await expect.poll(() => cardCount(page)).toBe(baseline);
	});

	test('name query: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		const baseline = await cardCount(page);

		const search = page.getByPlaceholder(/search/i).first();
		await search.fill('MIEB');
		await expect(page).toHaveURL(/[?&]q=MIEB/);
		await expect(activeChips(page)).toContainText('Name');
		await expect.poll(() => cardCount(page)).toBeLessThan(baseline);

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('MIEB');
		await expect(activeChips(page)).toContainText('Name');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('');
		await expect.poll(() => cardCount(page)).toBe(baseline);
	});

	test('deselecting every modality persists "all off" via ?mods=', async ({ page }) => {
		// Empty pick set must serialise as `?mods=` (distinct from "no param").
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		await togglePill(modalityCheckbox(page, 'audio'));
		await togglePill(modalityCheckbox(page, 'image'));
		await togglePill(modalityCheckbox(page, 'text'));
		await expect(page).toHaveURL(/[?&]mods=(&|$)/);
		await expect(activeChips(page).filter({ hasText: 'Modality' })).toBeVisible();

		const emptyUrl = page.url();
		await page.goto(emptyUrl);
		await expect(modalityCheckbox(page, 'audio')).not.toBeChecked();
		await expect(modalityCheckbox(page, 'image')).not.toBeChecked();
		await expect(modalityCheckbox(page, 'text')).not.toBeChecked();
		await expect(activeChips(page).filter({ hasText: 'Modality' })).toBeVisible();

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(modalityCheckbox(page, 'audio')).toBeChecked();
		await expect(modalityCheckbox(page, 'image')).toBeChecked();
		await expect(modalityCheckbox(page, 'text')).toBeChecked();
	});

	test('multiple chips stack; Reset all clears them in one click', async ({ page }) => {
		await page.goto('/benchmarks');
		await waitForCatalogue(page);
		const baseline = await cardCount(page);

		await togglePill(modalityCheckbox(page, 'text'));
		await togglePill(sidebarCheckbox(page, 'Academic'));
		await page
			.getByPlaceholder(/search/i)
			.first()
			.fill('MTEB');

		await expect(activeChips(page)).toHaveCount(3);
		await expect(page).toHaveURL(/[?&]mods=/);
		await expect(page).toHaveURL(/[?&]doms=/);
		await expect(page).toHaveURL(/[?&]q=MTEB/);

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/benchmarks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(modalityCheckbox(page, 'text')).toBeChecked();
		await expect(sidebarCheckbox(page, 'Academic')).toBeChecked();
		await expect.poll(() => cardCount(page)).toBe(baseline);
	});
});

test.describe('/tasks filter URL roundtrip', () => {
	test('type toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/tasks');
		await expect(page.locator('a[href*="/tasks/"]').first()).toBeVisible({ timeout: 15_000 });

		const retrievalPill = page.locator('aside.sidebar label.type-pill[data-stype="retrieval"]');
		const retrievalCb = retrievalPill.locator('input[type=checkbox]');
		await expect(retrievalCb).toBeChecked();
		await retrievalPill.locator('input[type=checkbox]').click({ force: true });

		await expect(page).toHaveURL(/[?&]types=/);
		await expect(activeChips(page)).toContainText('Type');
		await expect(resetAll(page)).toBeVisible();

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(
			page.locator('aside.sidebar label.type-pill[data-stype="retrieval"] input[type=checkbox]')
		).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Type');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/tasks\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(
			page.locator('aside.sidebar label.type-pill[data-stype="retrieval"] input[type=checkbox]')
		).toBeChecked();
	});
});

test.describe('/models filter URL roundtrip', () => {
	async function waitForModels(page: Page) {
		await expect(page.locator('a[href*="/models/"]').first()).toBeVisible({ timeout: 15_000 });
	}

	test('model type toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/models');
		await waitForModels(page);
		await expect(activeStrip(page)).toHaveCount(0);

		const densePill = page.locator(
			'aside.sidebar label.model-type-pill[data-type="dense"] input[type=checkbox]'
		);
		await expect(densePill).toBeChecked();
		await densePill.click({ force: true });

		await expect(page).toHaveURL(/[?&]mtypes=/);
		await expect(activeChips(page)).toContainText('Type');
		await expect(resetAll(page)).toBeVisible();

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(
			page.locator('aside.sidebar label.model-type-pill[data-type="dense"] input[type=checkbox]')
		).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Type');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/models\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(
			page.locator('aside.sidebar label.model-type-pill[data-type="dense"] input[type=checkbox]')
		).toBeChecked();
	});

	test('availability toggle: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/models');
		await waitForModels(page);

		const openRadio = page.getByRole('radio', { name: 'Open', exact: true }).first();
		await expect(openRadio).toBeVisible();
		await openRadio.click();

		await expect(page).toHaveURL(/[?&]avail=open/);
		await expect(activeChips(page)).toContainText('Open only');
		await expect(resetAll(page)).toBeVisible();

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(page).toHaveURL(/[?&]avail=open/);
		await expect(activeChips(page)).toContainText('Open only');
		await expect(page.getByRole('radio', { name: 'Open', exact: true }).first()).toBeChecked();

		await resetAll(page).click();
		await expect(page).not.toHaveURL(/[?&]avail=/);
		await expect(page.getByRole('radio', { name: 'Both', exact: true }).first()).toBeChecked();
	});

	test('language toggle (page-local): chip + URL + deep-link restore + Reset all', async ({
		page
	}) => {
		await page.goto('/models');
		await waitForModels(page);

		await togglePill(sidebarCheckbox(page, 'English'));
		await expect(page).toHaveURL(/[?&]langs=/);
		await expect(activeChips(page)).toContainText('Lang');
		await expect(resetAll(page)).toBeVisible();

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(sidebarCheckbox(page, 'English')).not.toBeChecked();
		await expect(activeChips(page)).toContainText('Lang');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/models\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(sidebarCheckbox(page, 'English')).toBeChecked();
	});

	test('name query: chip + URL + deep-link restore + Reset all', async ({ page }) => {
		await page.goto('/models');
		await waitForModels(page);

		const search = page.getByPlaceholder(/search/i).first();
		await search.fill('cross');
		await expect(page).toHaveURL(/[?&]q=cross/);
		await expect(activeChips(page)).toContainText('Name');

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('cross');
		await expect(activeChips(page)).toContainText('Name');

		await resetAll(page).click();
		await expect(page).toHaveURL(/\/models\/?$/);
		await expect(activeStrip(page)).toHaveCount(0);
		await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('');
	});
});

test.describe('/benchmark/[name] filter URL roundtrip (shared store path)', () => {
	test('availability toggle: chip + URL + restore + Reset all', async ({ page }) => {
		const url = '/benchmark/' + encodeURIComponent('MTEB(eng, v2)');
		await page.goto(url);
		const openRadio = page.getByRole('radio', { name: 'Open', exact: true }).first();
		await expect(openRadio).toBeVisible({ timeout: 20_000 });
		await installClipboardSpy(page);

		await openRadio.click();
		await expect(page).toHaveURL(/[?&]avail=open/);
		await expect(activeChips(page)).toContainText('Open only');
		await expect(resetAll(page)).toBeVisible();
		await expectShareCopiesCurrentUrl(page);

		const filteredUrl = page.url();
		await page.goto(filteredUrl);
		await expect(page).toHaveURL(/[?&]avail=open/);
		await expect(activeChips(page)).toContainText('Open only');

		await resetAll(page).click();
		await expect(page).not.toHaveURL(/[?&]avail=/);
		await expect(activeChips(page).filter({ hasText: 'Open only' })).toHaveCount(0);
	});
});

test.describe('/benchmark/[name] empty pick set drops every row', () => {
	const url = '/benchmark/' + encodeURIComponent('MTEB(eng, v2)');

	async function waitForTable(page: Page) {
		await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 });
	}
	async function openScope(page: Page) {
		const scopeToggle = page.getByRole('button', { name: /Benchmark scope/ });
		if ((await scopeToggle.getAttribute('aria-expanded')) !== 'true') await scopeToggle.click();
	}
	function scopeGroup(page: Page, label: RegExp): Locator {
		return page
			.locator('aside.sidebar .group')
			.filter({ has: page.locator('.group-label', { hasText: label }) });
	}

	test('deselecting every domain drops every row', async ({ page }) => {
		await page.goto(url);
		await waitForTable(page);
		await openScope(page);

		await scopeGroup(page, /^Domain/)
			.getByRole('button', { name: /^Clear$/ })
			.click();
		await expect(page).toHaveURL(/[?&]doms=(&|$)/);
		await expect(activeChips(page).filter({ hasText: 'Domain' })).toBeVisible();
		await expect.poll(() => page.locator('table tbody tr').count()).toBe(0);

		await resetAll(page).click();
		await expect(page).not.toHaveURL(/[?&]doms=/);
		await expect(page.locator('table tbody tr').first()).toBeVisible();
	});

	test('deselecting every modality drops every row (single-option universe)', async ({ page }) => {
		// Single-option universe is still subject to the "deselect-all drops" rule.
		await page.goto(url);
		await waitForTable(page);
		await openScope(page);

		const scopeBlock = page
			.locator('aside.sidebar section.block')
			.filter({ has: page.getByRole('button', { name: /Benchmark scope/ }) });
		const modPill = scopeBlock.locator('label.pill[data-modality="text"] input[type=checkbox]');
		await expect(modPill).toBeChecked();
		await modPill.evaluate((cb: HTMLInputElement) => {
			cb.scrollIntoView({ block: 'center' });
			cb.click();
		});

		await expect(page).toHaveURL(/[?&]mods=(&|$)/);
		await expect(activeChips(page).filter({ hasText: 'Modality' })).toBeVisible();
		await expect.poll(() => page.locator('table tbody tr').count()).toBe(0);

		await resetAll(page).click();
		await expect(page).not.toHaveURL(/[?&]mods=/);
		await expect(modPill).toBeChecked();
	});

	test('deselecting every language drops every row', async ({ page }) => {
		// Language is server-scoped — empty pick set needs an explicit client drop.
		await page.goto(url);
		await waitForTable(page);
		await openScope(page);

		await scopeGroup(page, /^Languages/)
			.getByRole('button', { name: /^Clear$/ })
			.click();
		await expect(page).toHaveURL(/[?&]langs=(&|$)/);
		await expect(activeChips(page).filter({ hasText: 'Lang' })).toBeVisible();
		await expect.poll(() => page.locator('table tbody tr').count()).toBe(0);

		await resetAll(page).click();
		await expect(page).not.toHaveURL(/[?&]langs=/);
		await expect(page.locator('table tbody tr').first()).toBeVisible();
	});
});

test('active chip layout: label + × indicator', async ({ page }) => {
	await page.goto('/benchmarks');
	await waitForCatalogue(page);
	await togglePill(modalityCheckbox(page, 'text'));
	const chip = activeChips(page).first();
	await expect(chip).toContainText('Modality');
	await expect(chip.locator('.x')).toContainText('×');
});
