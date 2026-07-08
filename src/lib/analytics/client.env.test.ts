import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('analytics client environment configuration', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv('PUBLIC_ANALYTICS_URL', 'https://events.example/');
		vi.stubEnv('PUBLIC_ANALYTICS_ENABLED', 'true');
		vi.stubGlobal('document', {
			referrer: '',
			visibilityState: 'visible',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		});
		vi.stubGlobal('navigator', {});
		vi.stubGlobal('location', {
			href: 'https://leaderboard.example/models?q=abc',
			pathname: '/models',
			search: '?q=abc'
		});
	});

	it('posts batches to the endpoint from Vite public env', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetcher);

		const { flushAnalytics, track } = await import('./client');
		track('csv_downloaded', { filename: 'models.csv', rowCount: 5 });
		await flushAnalytics();

		expect(fetcher).toHaveBeenCalledWith(
			'https://events.example/v1/events/batch',
			expect.objectContaining({ method: 'POST' })
		);
	});
});
