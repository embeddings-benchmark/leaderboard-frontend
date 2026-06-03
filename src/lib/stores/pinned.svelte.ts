import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import { decodeSet, encodeSet, readParams, updateUrl } from '$lib/url-state';

// Shared "pinned models" set. Pinning in any table floats that model to the
// top of every table that shows it (Summary, PerTask, PerLanguage, Spreadsheet).
function createPinned() {
	// Hydrate from `?pin=name1,name2` if present, so shared links restore the
	// exact set the URL describes. Done eagerly at module init since the store
	// is a singleton — by the time any component imports it, the set is set.
	const initial = decodeSet(readParams().get('pin'));
	const value = new SvelteSet<string>(initial);

	return {
		get value() {
			return value;
		},
		get size() {
			return value.size;
		},
		has(name: string) {
			return value.has(name);
		},
		toggle(name: string) {
			if (value.has(name)) value.delete(name);
			else value.add(name);
			sync();
		},
		add(name: string) {
			if (value.has(name)) return;
			value.add(name);
			sync();
		},
		remove(name: string) {
			if (!value.has(name)) return;
			value.delete(name);
			sync();
		},
		clear() {
			if (value.size === 0) return;
			value.clear();
			sync();
		}
	};

	function sync() {
		// `untrack` so the `value` read doesn't bind to any reactive caller
		// (would otherwise cause runaway re-fires when pins change). See the
		// matching comment in filters.svelte.ts.
		untrack(() => updateUrl({ pin: encodeSet(value) }));
	}
}

export const pinnedModels = createPinned();
