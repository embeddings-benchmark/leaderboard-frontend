/**
 * Tiny URL ↔ state plumbing for shareable leaderboard links.
 *
 * Design:
 * - **Read** once, on the client, at component init via ``readParams()``. We
 *   pull from ``window.location`` rather than SvelteKit's reactive
 *   ``page.url`` because we update the URL with SvelteKit's ``replaceState``
 *   from ``$app/navigation`` to avoid triggering load functions.
 * - **Write** via ``updateUrl({...})`` which patches only the keys provided.
 *   ``null`` / ``''`` removes a param. Net no-op when nothing changes.
 *
 * Param naming: short and namespaced (``q``, ``mtypes``, ``s.summary``).
 * Multi-value sets are comma-joined; consumers split as needed.
 *
 * Loop-safety: the read/write phases are separate effects. ``replaceState``
 * doesn't trigger SvelteKit's load functions (per the docs), so the read
 * effect (which fires only once) never re-runs.
 */

import { replaceState } from '$app/navigation';

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
		// Use SvelteKit's wrapper instead of native `history.replaceState`
		// so the router stays in sync. Pass an empty PageState since we
		// don't use shallow-routing state — just need the URL update.
		// `resolve()` would re-add the base path, but `url` is already
		// derived from `window.location.href` which carries it — passing
		// the URL object directly preserves the current path verbatim
		// while only mutating its query string.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(url, {});
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
