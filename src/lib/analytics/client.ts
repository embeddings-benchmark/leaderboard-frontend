import { PUBLIC_ANALYTICS_ENABLED, PUBLIC_ANALYTICS_URL } from '$env/static/public';
import { getAnalyticsIds, type AnalyticsIds } from './ids';
import type { AnalyticsEvent, AnalyticsEventName, AnalyticsPayloads, PageContext } from './events';

type Fetcher = typeof globalThis.fetch;

interface AnalyticsConfig {
	enabled: boolean;
	endpoint: string;
	fetcher: Fetcher;
	ids: () => AnalyticsIds;
}

interface TestConfig {
	enabled?: boolean;
	endpoint?: string;
	fetcher?: Fetcher;
	ids?: AnalyticsIds | (() => AnalyticsIds);
}

const FLUSH_SIZE = 10;
const FLUSH_DELAY_MS = 5000;
const MAX_QUEUE = 100;

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let configuredForTest: Partial<AnalyticsConfig> | null = null;
let listenersInstalled = false;

function envEnabled(): boolean {
	if (!analyticsEndpoint().trim()) return false;
	if (analyticsEnabledFlag().trim().toLowerCase() === 'false') return false;
	return true;
}

function analyticsEndpoint(): string {
	return PUBLIC_ANALYTICS_URL;
}

function analyticsEnabledFlag(): string {
	return PUBLIC_ANALYTICS_ENABLED;
}

function config(): AnalyticsConfig {
	return {
		enabled: configuredForTest?.enabled ?? envEnabled(),
		endpoint: (configuredForTest?.endpoint ?? analyticsEndpoint()).replace(/\/+$/, ''),
		fetcher: configuredForTest?.fetcher ?? globalThis.fetch.bind(globalThis),
		ids: configuredForTest?.ids ?? getAnalyticsIds
	};
}

function batchUrl(endpoint: string): string {
	return `${endpoint}/v1/events/batch`;
}

function queryKeys(): string[] {
	try {
		return Array.from(new URL(globalThis.location.href).searchParams.keys()).sort();
	} catch {
		return [];
	}
}

function pageContext(): PageContext {
	return {
		path: globalThis.location?.pathname ?? '',
		queryKeys: queryKeys()
	};
}

function eventId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random()}`;
}

function payload(events: AnalyticsEvent[], ids: AnalyticsIds): string {
	return JSON.stringify({
		visitorId: ids.visitorId,
		sessionId: ids.sessionId,
		events
	});
}

function scheduleFlush(): void {
	if (flushTimer || typeof window === 'undefined') return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		void flushAnalytics();
	}, FLUSH_DELAY_MS);
}

export function track<N extends AnalyticsEventName>(
	eventName: N,
	eventPayload: AnalyticsPayloads[N]
): AnalyticsEvent<N> {
	const event: AnalyticsEvent<N> = {
		eventName,
		id: eventId(),
		page: pageContext(),
		payload: eventPayload,
		sentAt: new Date().toISOString()
	};
	const cfg = config();
	if (!cfg.enabled || !cfg.endpoint) return event;
	queue.push(event as AnalyticsEvent);
	if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
	if (queue.length >= FLUSH_SIZE) void flushAnalytics();
	else scheduleFlush();
	return event;
}

export async function flushAnalytics(opts: { beacon?: boolean } = {}): Promise<void> {
	const cfg = config();
	if (!cfg.enabled || !cfg.endpoint || queue.length === 0 || flushing) return;
	const ids = cfg.ids();
	const events = queue.splice(0, FLUSH_SIZE);
	const body = payload(events, ids);

	if (opts.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
		const blob = new Blob([body], { type: 'application/json' });
		if (navigator.sendBeacon(batchUrl(cfg.endpoint), blob)) return;
		queue = [...events, ...queue];
		return;
	}

	flushing = true;
	try {
		const res = await cfg.fetcher(batchUrl(cfg.endpoint), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			keepalive: true
		});
		if (!res.ok) queue = [...events, ...queue];
	} catch {
		queue = [...events, ...queue];
	} finally {
		flushing = false;
	}
}

export function trackPageView(): void {
	if (!globalThis.location) return;
	track('page_view', {
		path: globalThis.location.pathname,
		queryKeys: queryKeys(),
		title: globalThis.document?.title || undefined,
		referrer: globalThis.document?.referrer || undefined
	});
}

export function installAnalyticsLifecycle(): void {
	if (listenersInstalled || typeof document === 'undefined' || typeof window === 'undefined')
		return;
	listenersInstalled = true;
	const flushWithBeacon = () => {
		void flushAnalytics({ beacon: true });
	};
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushWithBeacon();
	});
	window.addEventListener('pagehide', flushWithBeacon);
}

export function configureAnalyticsForTest(opts: TestConfig): void {
	configuredForTest = {
		...opts,
		ids:
			typeof opts.ids === 'function'
				? opts.ids
				: opts.ids
					? () => opts.ids as AnalyticsIds
					: undefined
	};
}

export function resetAnalyticsForTest(): void {
	queue = [];
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = null;
	flushing = false;
	configuredForTest = null;
	listenersInstalled = false;
}
