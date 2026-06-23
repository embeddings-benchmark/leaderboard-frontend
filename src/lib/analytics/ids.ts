const VISITOR_KEY = 'mteb_analytics_visitor_id';
const SESSION_KEY = 'mteb_analytics_session_id';

export interface AnalyticsIds {
	visitorId: string;
	sessionId: string;
}

let memo: AnalyticsIds | null = null;

function fallbackId(): string {
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function newId(): string {
	return globalThis.crypto?.randomUUID?.() ?? fallbackId();
}

function readStored(storage: Storage | undefined, key: string): string | null {
	try {
		return storage?.getItem(key) || null;
	} catch {
		return null;
	}
}

function writeStored(storage: Storage | undefined, key: string, value: string): void {
	try {
		storage?.setItem(key, value);
	} catch {
		// Storage can be disabled in private browsing or sandboxed iframes.
	}
}

export function getAnalyticsIds(): AnalyticsIds {
	if (memo) return memo;
	const local = globalThis.localStorage;
	const session = globalThis.sessionStorage;
	if (!local || !session) {
		memo = { visitorId: newId(), sessionId: newId() };
		return memo;
	}

	const visitorId = readStored(local, VISITOR_KEY) ?? newId();
	const sessionId = readStored(session, SESSION_KEY) ?? newId();
	writeStored(local, VISITOR_KEY, visitorId);
	writeStored(session, SESSION_KEY, sessionId);
	memo = { visitorId, sessionId };
	return memo;
}

export function resetAnalyticsIdsForTest(): void {
	memo = null;
}
