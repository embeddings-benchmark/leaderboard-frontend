import { SvelteSet } from 'svelte/reactivity';

import type { Chip } from '$lib/components/ActiveFilterStrip.svelte';
import { decodeSet, encodeSet, getParam } from '$lib/url-state';

// Single-facet URL-backed filter — picked SvelteSet + seed/chip/reset/
// URL-value helpers in one bag. Consolidates the duplicated facet logic
// previously open-coded on /benchmarks and /tasks (and the model-language
// filter on /models, where the pattern also applies).
//
// What the page still owns:
//   - The `filtersSeeded` $state flag (set once on first resolve, gates
//     the URL-write effect so it doesn't clobber deep-link params before
//     `seed()` reads them).
//   - The `urlHydrated` flag and the URL-write `$effect` itself — the
//     factory just supplies the per-facet key/value pair the effect
//     dispatches to `updateUrl`.
//   - The `chips` `$derived.by` that aggregates per-facet chips into the
//     active-strip array.
//   - The `query` text filter and `view` / `sort` state (not facet-shaped).
export interface FacetFilter {
	readonly picked: SvelteSet<string>;
	/** Seed `picked` from `?urlParam` if the param is present (empty
	 *  string included — that's a deliberate `?key=` deselect-all gesture),
	 *  otherwise from the full universe. Call once after the loader's
	 *  data has resolved; the per-page `filtersSeeded` flag guards
	 *  against re-seeding (which would clobber subsequent user picks). */
	seed(): void;
	/** A chip describing the narrowing, or `null` when the pick set is
	 *  "off" (== full universe or empty universe). Empty pick set on a
	 *  populated universe is treated as a narrowing (the user deselected
	 *  everything) and gets a chip. */
	chip(): Chip | null;
	/** Restore `picked` to the full universe. Bound as the chip's `clear`
	 *  handler and used by the page's `resetAll`. */
	reset(): void;
	/** Value to pass to `updateUrl` for this facet's `urlParam` key.
	 *  Returns `null` when the pick set is "off" so `updateUrl` deletes
	 *  the param; returns the encoded string (possibly `''` for an
	 *  empty pick set) otherwise. */
	urlValue(): string | null;
}

export interface FacetFilterOptions {
	/** `?<urlParam>=` key on the address bar. */
	readonly urlParam: string;
	/** Unique key on the chip (used for keyed `{#each}`). */
	readonly chipKey: string;
	/** Human-facing chip label, e.g. `'Modality'`. The factory renders
	 *  `${chipLabel} · ${size}/${total}` so don't include the dot. */
	readonly chipLabel: string;
	/** Reactive accessor — passed as a function so the factory reads the
	 *  page's `$derived` universe array lazily. Calling the accessor from
	 *  inside a `$derived` block (e.g. `chip()`) makes that derived
	 *  track the universe via Svelte's standard dependency mechanism. */
	readonly universe: () => readonly string[];
}

export function createFacetFilter(opts: FacetFilterOptions): FacetFilter {
	const picked = new SvelteSet<string>();
	const isOff = () => {
		const u = opts.universe();
		return u.length === 0 || picked.size === u.length;
	};
	const facet: FacetFilter = {
		picked,
		seed() {
			const raw = getParam(opts.urlParam);
			if (raw !== null) {
				// Local accumulator — used only inside this function for an
				// O(1) `has` check while iterating the decoded URL list.
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const present = new Set(opts.universe());
				for (const v of decodeSet(raw)) if (present.has(v)) picked.add(v);
			} else {
				for (const v of opts.universe()) picked.add(v);
			}
		},
		chip() {
			if (isOff()) return null;
			const u = opts.universe();
			return {
				key: opts.chipKey,
				label: `${opts.chipLabel} · ${picked.size}/${u.length}`,
				clear: () => facet.reset()
			};
		},
		reset() {
			picked.clear();
			for (const v of opts.universe()) picked.add(v);
		},
		urlValue() {
			if (isOff()) return null;
			return encodeSet(picked);
		}
	};
	return facet;
}
