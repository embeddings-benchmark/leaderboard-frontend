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
// (a deliberate deselect-all gesture, distinct from "no param").
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

/** URL patch value for comma-separated set params; `null` removes the param. */
export function encodeUrlSetParam(values: Iterable<string>): string | null {
	const encoded = encodeSet(values);
	return encoded ? encoded : null;
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
