import { expect, test } from '@playwright/test';
import { buildMockSummary } from './fixtures/mockSummary';

const URL = `/benchmark/${encodeURIComponent('MTEB(eng, v2)')}/`;
const ACTIVE = '.tab-pane.active';

for (const metric of ['mean_task_type', 'public_private'] as const) {
	test(`representative follows the displayed ${metric} score rather than a different mean`, async ({
		page
	}) => {
		const summary = buildMockSummary('MTEB(eng, v2)');
		summary.aggregations = [metric];
		summary.rows = summary.rows.filter(
			(r) => r.model.org === 'Qwen' && /[48]B$/.test(r.model.displayName)
		);
		summary.tasksMeta = summary.tasksMeta.slice(0, 2).map((t, i) => ({ ...t, isPublic: i === 0 }));
		summary.tasks = summary.tasksMeta.map((t) => t.name);
		for (const row of summary.rows) {
			const large = row.model.displayName.includes('8B');
			row.meanTask = large ? 0.9 : 0.6;
			row.meanTaskType = large ? 0.5 : 0.8;
			row.scoresByTask = { [summary.tasks[0]]: large ? 0.5 : 0.8, [summary.tasks[1]]: 0.7 };
		}
		await page.route('**/v1/benchmarks/*/scores*', (route) => route.fulfill({ json: summary }));
		await page.goto(`${URL}?tab=organizations`);
		await expect(page.locator(`${ACTIVE} tr.organization-row`)).toHaveCount(1);
		await expect(page.locator(`${ACTIVE} tr.organization-row`)).toContainText('Qwen3-Embedding-4B');
	});
}

test('grouping selects a whole row, expands with the keyboard and preserves sorting/pins', async ({
	page
}) => {
	await page.goto(URL);
	const rows = page.locator(`${ACTIVE} tbody tr`);
	const original = rows.filter({ hasText: 'Qwen3-Embedding-8B' }).first();
	await expect(original).toBeVisible();
	const scores = await original.locator('td').allTextContents();
	await expect(page.getByRole('checkbox', { name: 'Group by organization' })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Compare organizations', exact: true }).click();
	await expect(page).toHaveURL(/[?&]tab=organizations/);
	const group = page
		.locator(`${ACTIVE} tr.organization-row`)
		.filter({ hasText: 'Qwen3-Embedding-8B' });
	await expect(group).toHaveCount(1);
	expect(await group.locator('td').allTextContents()).toEqual(scores);
	const expand = group.getByRole('button', { name: /^Expand Qwen/ });
	await expand.focus();
	await page.keyboard.press('Enter');
	await expect(group.getByRole('button', { name: /^Collapse Qwen/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	const child = page
		.locator(`${ACTIVE} tr.organization-member`)
		.filter({ hasText: 'Qwen3-Embedding-4B' });
	await expect(child).toBeVisible();
	await expect(
		page.locator(`${ACTIVE} tr.organization-member`).filter({ hasText: 'Qwen3-Embedding-8B' })
	).toHaveCount(0);
	await child.getByRole('button', { name: 'Pin row', exact: true }).click();
	await expect(page.locator(`${ACTIVE} tr.organization-row`).first()).toContainText(
		'Qwen3-Embedding-8B'
	);
	await page
		.getByRole('button', { name: /^Parameters/ })
		.first()
		.click();
	await expect(group).toContainText('Qwen3-Embedding-8B');
	await expect(child.getByRole('button', { name: 'Unpin row', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/[?&]s.organizations=totalParams/);
	await expect(page).not.toHaveURL(/[?&]s.summary=/);
	await page.getByRole('tab', { name: 'Summary', exact: true }).click();
	await expect(page.locator(`${ACTIVE} tr.organization-row`)).toHaveCount(0);
	await expect(rows.first()).toContainText('Qwen3-Embedding-4B');
});

test('grouping survives reload and follows search, including no matches', async ({ page }) => {
	await page.goto(`${URL}?tab=organizations`);
	const tab = page.getByRole('tab', { name: 'Compare organizations', exact: true });
	await expect(tab).toHaveAttribute('aria-selected', 'true');
	await page.getByRole('button', { name: /^Expand Qwen/ }).click();
	const search = page.locator('.toolbar-row input[type=search]');
	await search.fill('Qwen3-Embedding-4B');
	const groups = page.locator(`${ACTIVE} tr.organization-row`);
	await expect(groups).toHaveCount(1);
	await expect(groups.first()).toContainText('Qwen3-Embedding-4B');
	await expect(groups.getByRole('button', { name: /^(Expand|Collapse) Qwen/ })).toHaveCount(0);
	await expect(page.locator(`${ACTIVE} tr.organization-member`)).toHaveCount(0);
	await search.fill('Qwen');
	await expect(page.getByRole('button', { name: /^Collapse Qwen/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await search.fill('Qwen3-Embedding-4B');
	await expect(groups.first()).toContainText('Qwen3-Embedding-4B');
	await expect(page).toHaveURL(/Qwen3-Embedding-4B/);
	await page.reload();
	await expect(tab).toHaveAttribute('aria-selected', 'true');
	await expect(groups).toHaveCount(1);
	await expect(groups.first()).toContainText('Qwen3-Embedding-4B');
	await search.fill('no-such-model-5407');
	await expect(groups).toHaveCount(0);
	await search.fill('Qwen');
	await expect(groups).toHaveCount(1);
	await expect(groups.first()).toContainText('Qwen3-Embedding-8B');
	await page.getByRole('tab', { name: 'Summary', exact: true }).click();
	await expect(page).not.toHaveURL(/[?&]tab=/);
});

test('grouping respects sidebar filters and remains usable in dark mobile layout', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${URL}?tab=organizations&maxSize=5000&minSize=1`);
	const groups = page.locator(`${ACTIVE} tr.organization-row`);
	await expect(groups.filter({ hasText: 'Qwen3-Embedding-4B' })).toHaveCount(1);
	await expect(groups.filter({ hasText: 'Qwen3-Embedding-8B' })).toHaveCount(0);
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
	const expand = page.getByRole('button', { name: /^Expand Qwen/ });
	await expand.click();
	await expect(page.getByRole('button', { name: /^Collapse Qwen/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(
		page.locator(`${ACTIVE} tr.organization-member`).filter({ hasText: 'Qwen3-Embedding-0.6B' })
	).toBeVisible();
});
