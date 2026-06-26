import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAnalyticsIds, resetAnalyticsIdsForTest } from './ids';

function storage() {
	const data = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => data.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => data.set(key, value)),
		removeItem: vi.fn((key: string) => data.delete(key)),
		clear: vi.fn(() => data.clear())
	};
}

describe('analytics ids', () => {
	beforeEach(() => {
		resetAnalyticsIdsForTest();
		vi.stubGlobal('crypto', {
			randomUUID: vi
				.fn()
				.mockReturnValueOnce('visitor-uuid')
				.mockReturnValueOnce('session-uuid')
				.mockReturnValueOnce('next-session')
		});
		vi.stubGlobal('localStorage', storage());
		vi.stubGlobal('sessionStorage', storage());
	});

	it('creates and persists anonymous visitor and session ids', () => {
		const ids = getAnalyticsIds();

		expect(ids).toEqual({ visitorId: 'visitor-uuid', sessionId: 'session-uuid' });
		expect(localStorage.setItem).toHaveBeenCalledWith('mteb_analytics_visitor_id', 'visitor-uuid');
		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			'mteb_analytics_session_id',
			'session-uuid'
		);
	});

	it('reuses visitor id across sessions while creating a new session id', () => {
		localStorage.setItem('mteb_analytics_visitor_id', 'returning-visitor');
		resetAnalyticsIdsForTest();

		const ids = getAnalyticsIds();

		expect(ids).toEqual({ visitorId: 'returning-visitor', sessionId: 'visitor-uuid' });
		expect(localStorage.setItem).not.toHaveBeenCalledWith(
			'mteb_analytics_visitor_id',
			'extra-visitor'
		);
	});
});
