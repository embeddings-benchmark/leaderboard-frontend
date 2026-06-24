import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureAnalyticsForTest, flushAnalytics, resetAnalyticsForTest, track } from './client';
import type { AnalyticsEvent } from './events';

const ids = { visitorId: 'visitor-1', sessionId: 'session-1' };

describe('analytics client', () => {
	beforeEach(() => {
		resetAnalyticsForTest();
		vi.unstubAllEnvs();
		vi.useFakeTimers();
		vi.stubGlobal('document', {
			referrer: 'https://referrer.example/',
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

	it('does not enqueue events when analytics is disabled', async () => {
		const fetcher = vi.fn();
		configureAnalyticsForTest({ enabled: false, endpoint: 'https://events.example', fetcher, ids });

		track('page_view', { path: '/models', queryKeys: [] });
		await flushAnalytics();

		expect(fetcher).not.toHaveBeenCalled();
	});

	it('posts queued events as a batch payload', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });
		configureAnalyticsForTest({ enabled: true, endpoint: 'https://events.example', fetcher, ids });

		track('csv_downloaded', { filename: 'models.csv', rowCount: 5 });
		await flushAnalytics();

		expect(fetcher).toHaveBeenCalledWith(
			'https://events.example/v1/events/batch',
			expect.objectContaining({
				method: 'POST',
				keepalive: true,
				headers: { 'content-type': 'application/json' }
			})
		);
		const body = JSON.parse(fetcher.mock.calls[0][1].body);
		expect(body.visitorId).toBe('visitor-1');
		expect(body.sessionId).toBe('session-1');
		expect(body.events).toHaveLength(1);
		expect(body.events[0]).toMatchObject({
			eventName: 'csv_downloaded',
			payload: { filename: 'models.csv', rowCount: 5 },
			page: { path: '/models', queryKeys: ['q'] }
		});
	});

	it('keeps events queued when the collector rejects the batch', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: false });
		configureAnalyticsForTest({ enabled: true, endpoint: 'https://events.example', fetcher, ids });

		track('share_link_copied', { path: '/models' });
		await flushAnalytics();
		fetcher.mockResolvedValue({ ok: true });
		await flushAnalytics();

		expect(fetcher).toHaveBeenCalledTimes(2);
		const retryBody = JSON.parse(fetcher.mock.calls[1][1].body);
		expect(retryBody.events).toHaveLength(1);
		expect(retryBody.events[0].eventName).toBe('share_link_copied');
	});

	it('uses sendBeacon for unload flushes', () => {
		const sendBeacon = vi.fn().mockReturnValue(true);
		vi.stubGlobal('navigator', { sendBeacon });
		configureAnalyticsForTest({ enabled: true, endpoint: 'https://events.example', ids });

		track('model_pinned', { model: 'org/model' });
		flushAnalytics({ beacon: true });

		expect(sendBeacon).toHaveBeenCalledOnce();
		const [url, blob] = sendBeacon.mock.calls[0];
		expect(url).toBe('https://events.example/v1/events/batch');
		expect(blob).toBeInstanceOf(Blob);
	});

	it('stores only query keys for page view style events', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });
		configureAnalyticsForTest({ enabled: true, endpoint: 'https://events.example', fetcher, ids });

		const event: AnalyticsEvent = track('page_view', {
			path: '/models',
			queryKeys: ['q'],
			title: 'Models'
		});
		await flushAnalytics();

		expect(event.payload).toEqual({ path: '/models', queryKeys: ['q'], title: 'Models' });
		expect(JSON.stringify(event)).not.toContain('abc');
	});

	it('tracks page views without serializing query values', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });
		configureAnalyticsForTest({ enabled: true, endpoint: 'https://events.example', fetcher, ids });

		const { trackPageView } = await import('./client');
		trackPageView();
		await flushAnalytics();

		const body = JSON.parse(fetcher.mock.calls[0][1].body);
		expect(body.events[0]).toMatchObject({
			eventName: 'page_view',
			payload: {
				path: '/models',
				queryKeys: ['q'],
				referrer: 'https://referrer.example/'
			}
		});
		expect(JSON.stringify(body)).not.toContain('abc');
	});
});
