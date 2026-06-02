/**
 * Tiny URL ↔ state plumbing for shareable leaderboard links.
 *
 * Design:
 * - **Read** once, on the client, at component init via ``readParams()``. We
 *   pull from ``window.location`` rather than SvelteKit's reactive
 *   ``page.url`` because we update the URL with ``history.replaceState`` to
 *   avoid triggering load functions — and ``page.url`` doesn't always
 *   observe those updates.
 * - **Write** via ``updateUrl({...})`` which patches only the keys provided.
 *   ``null`` / ``''`` removes a param. Net no-op when nothing changes.
 *
 * Param naming: short and namespaced (``q``, ``mtypes``, ``s.summary``).
 * Multi-value sets are comma-joined; consumers split as needed.
 *
 * Loop-safety: the read/write phases are separate effects. The write effect
 * only mutates ``window.history`` (no SvelteKit reactivity), so the read
 * effect (which fires only once) never re-runs.
 */

export function readParams(): URLSearchParams {
	if (typeof window === 'undefined') return new URLSearchParams();
	return new URL(window.location.href).searchParams;
}

export function getParam(name: string): string | null {
	return readParams().get(name);
}

/** Patch URL params; ``null``/``''``/``undefined`` deletes. */
export function updateUrl(updates: Record<string, string | null | undefined>): void {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	let changed = false;
	for (const [k, v] of Object.entries(updates)) {
		const existing = url.searchParams.get(k);
		if (v == null || v === '') {
			if (existing !== null) {
				url.searchParams.delete(k);
				changed = true;
			}
		} else if (existing !== v) {
			url.searchParams.set(k, v);
			changed = true;
		}
	}
	if (changed) {
		window.history.replaceState(window.history.state, '', url.toString());
	}
}

/** Encode a set of names into a comma-joined param (URL-safe components). */
export function encodeSet(values: Iterable<string>): string | null {
	const arr = [...values].filter(Boolean).map(encodeURIComponent);
	return arr.length ? arr.join(',') : null;
}

/** Inverse of ``encodeSet`` — returns ``[]`` for missing / empty values. */
export function decodeSet(raw: string | null): string[] {
	if (!raw) return [];
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.map(decodeURIComponent);
}
