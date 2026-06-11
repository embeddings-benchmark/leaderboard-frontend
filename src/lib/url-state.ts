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

/**
 * Patch URL params; ``null``/``''``/``undefined`` deletes.
 *
 * We hold a long-lived URL instance and just mutate its `searchParams` so we
 * don't pay the URL parse cost on every filter-store sync. The href can drift
 * if other code calls `pushState`/popstate; we resync from `window.location`
 * whenever the path changes between calls.
 */
let _url: URL | null = null;
let _lastPath = '';
export function updateUrl(updates: Record<string, string | null | undefined>): void {
	if (typeof window === 'undefined') return;
	const path = window.location.pathname + window.location.search + window.location.hash;
	if (!_url || _lastPath !== path) {
		_url = new URL(window.location.href);
		_lastPath = path;
	}
	const url = _url;
	let changed = false;
	for (const [k, v] of Object.entries(updates)) {
		const existing = url.searchParams.get(k);
		// `null` / `undefined` = "delete the param".
		// Empty string `''` is preserved as `?k=` — distinct from "no param".
		// Filter-set encoders use this so an empty pick set
		// (`?mods=`) round-trips through a deep link as "user deselected
		// everything", separate from "no narrowing applied" (no param).
		// The filter *logic* still treats an empty pick set as "no
		// narrowing" (so the page isn't blanked); the URL just records
		// the user's actual checkbox state.
		if (v == null) {
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
		_lastPath = url.pathname + url.search + url.hash;
	}
}

/**
 * Encode a set of names into a comma-joined param (URL-safe components).
 *
 * Returns `''` (empty string) for an empty input — paired with
 * `updateUrl`'s empty-string handling, this serialises an empty pick
 * set as `?key=` (param present, value empty). Distinct from "no param
 * at all" — the empty-value form preserves the user's deselect-all
 * gesture across a deep link. The filter *logic* (see `isFullSet` in
 * `filters.svelte.ts`) treats both states as "no narrowing applied"
 * so the page isn't blanked, but the URL keeps the checkbox state
 * faithful.
 */
export function encodeSet(values: Iterable<string>): string {
	// Single-pass build instead of [...values].filter().map().join() (3 allocs).
	let out = '';
	for (const v of values) {
		if (!v) continue;
		if (out) out += ',';
		out += encodeURIComponent(v);
	}
	return out;
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
