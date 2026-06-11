import { SvelteSet } from 'svelte/reactivity';

import type { Chip } from '$lib/components/ActiveFilterStrip.svelte';
import { decodeSet, encodeSet, getParam } from '$lib/url-state';

// Single-facet URL-backed filter — picked SvelteSet + seed/chip/reset/urlValue
// in one bag.
export interface FacetFilter {
	readonly picked: SvelteSet<string>;
	/** Seed `picked` from `?urlParam` if present, else from the full universe. */
	seed(): void;
	/** Chip describing the narrowing, or `null` when full universe or empty universe. */
	chip(): Chip | null;
	/** Restore `picked` to the full universe. */
	reset(): void;
	/** Encoded value for `updateUrl`; `null` when no narrowing. */
	urlValue(): string | null;
}

export interface FacetFilterOptions {
	readonly urlParam: string;
	readonly chipKey: string;
	/** Chip label prefix; rendered as `${chipLabel} · ${size}/${total}`. */
	readonly chipLabel: string;
	/** Reactive accessor — passed as a function so callers in `$derived` track
	 *  the universe via Svelte's dependency mechanism. */
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
