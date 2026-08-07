// URL state plumbing for shareable links. Reads from `window.location`;
// writes go through `replaceState` so load functions don't re-fire.

import { replaceState } from '$app/navigation';

export function readParams(): URLSearchParams {
	if (typeof window === 'undefined') return new URLSearchParams();
	return new URL(window.location.href).searchParams;
}

export function getParam(name: string): string | null {
	return readParams().get(name);
}

// Patch URL params. `null`/`undefined` deletes; `''` preserved as `?k=`
// (a deliberate deselect-all gesture, distinct from "no param"). Arrays
// write repeated-key form (`?k=a&k=b`) — comma-joining set params would
// re-encode `%` and the separator `,` through `URLSearchParams.set`,
// breaking any raw-search splitter on the read side.
/** Mutate `url.searchParams` per `updates`; return `true` if anything changed. */
export function applyParamUpdates(
	url: URL,
	updates: Record<string, string | readonly string[] | null | undefined>
): boolean {
	let changed = false;
	for (const [k, v] of Object.entries(updates)) {
		if (v == null || (Array.isArray(v) && v.length === 0)) {
			if (url.searchParams.has(k)) {
				url.searchParams.delete(k);
				changed = true;
			}
		} else if (Array.isArray(v)) {
			const existing = url.searchParams.getAll(k);
			if (existing.length !== v.length || existing.some((e, i) => e !== v[i])) {
				url.searchParams.delete(k);
				for (const item of v) url.searchParams.append(k, item);
				changed = true;
			}
		} else if (url.searchParams.get(k) !== v) {
			url.searchParams.set(k, v as string);
			changed = true;
		}
	}
	return changed;
}

let _url: URL | null = null;
let _lastPath = '';
export function updateUrl(
	updates: Record<string, string | readonly string[] | null | undefined>
): void {
	if (typeof window === 'undefined') return;
	const path = window.location.pathname + window.location.search + window.location.hash;
	if (!_url || _lastPath !== path) {
		_url = new URL(window.location.href);
		_lastPath = path;
	}
	const url = _url;
	if (applyParamUpdates(url, updates)) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(url, {});
		_lastPath = url.pathname + url.search + url.hash;
	}
}

/** Encode names as a comma-joined URL-safe param; returns `''` for empty input. */
export function encodeSet(values: Iterable<string>): string {
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
