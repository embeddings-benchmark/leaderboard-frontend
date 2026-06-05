// Shared `requestIdleCallback` shim. Safari ships `requestIdleCallback` only
// behind an experimental flag, so consumers (progressive row renders in
// SummaryTable / PerTaskTab / tasks / models) used to inline the same
// fallback. Centralised so the polyfill bytes ship once.

export function safeIdle(cb: () => void, timeoutMs = 500): number {
	if (typeof window === 'undefined') return 0;
	if ('requestIdleCallback' in window) {
		return window.requestIdleCallback(cb, { timeout: timeoutMs });
	}
	return setTimeout(cb, 0) as unknown as number;
}

export function safeCancelIdle(id: number): void {
	if (typeof window === 'undefined' || !id) return;
	if ('cancelIdleCallback' in window) window.cancelIdleCallback(id);
	else clearTimeout(id);
}
