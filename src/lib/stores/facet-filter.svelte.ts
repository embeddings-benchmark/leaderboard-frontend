import { SvelteSet } from 'svelte/reactivity';

import type { Chip } from '$lib/components/ActiveFilterStrip.svelte';
import { decodeSet, encodeSet, getParam } from '$lib/url-state';

// Single-facet URL-backed filter — picked SvelteSet + seed/chip/reset/urlValue
// in one bag, plus toggle helpers so a facet instance plugs straight into
// `<FilterFacet>` without per-page wrappers.
export interface FacetFilter {
	readonly urlParam: string;
	readonly picked: SvelteSet<string>;
	readonly allSelected: boolean;
	/** Seed `picked` from `?urlParam` if present, else from the full universe. */
	seed(): void;
	/** Chip describing the narrowing, or `null` when full universe or empty universe. */
	chip(): Chip | null;
	/** Flip a single value in/out of the pick set. */
	toggle(item: string): void;
	/** Smart toggle-all: if every value is currently picked, clear; otherwise
	 *  restore to the full universe. Matches the "All / Clear" link behavior. */
	toggleAll(): void;
	/** Restore `picked` to the full universe. */
	reset(): void;
	/** Drop picks that are no longer in the current universe (used on
	 *  same-resource refetches that shrink the universe). */
	prune(): void;
	/** Encoded value for `updateUrl`; `null` when no narrowing. */
	urlValue(): string | null;
}

export interface FacetFilterOptions {
	readonly urlParam: string;
	readonly chipKey?: string;
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
		urlParam: opts.urlParam,
		picked,
		get allSelected() {
			return picked.size === opts.universe().length;
		},
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
				key: opts.chipKey ?? opts.urlParam,
				label: `${opts.chipLabel} · ${picked.size}/${u.length}`,
				clear: () => facet.reset()
			};
		},
		toggle(item) {
			if (picked.has(item)) picked.delete(item);
			else picked.add(item);
		},
		toggleAll() {
			if (facet.allSelected) picked.clear();
			else facet.reset();
		},
		reset() {
			picked.clear();
			for (const v of opts.universe()) picked.add(v);
		},
		prune() {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const present = new Set(opts.universe());
			for (const v of picked) if (!present.has(v)) picked.delete(v);
		},
		urlValue() {
			if (isOff()) return null;
			return encodeSet(picked);
		}
	};
	return facet;
}

// ---------------------------------------------------------------------------
// FacetGroup — multiple facets sharing the same seed/URL-sync/chip lifecycle.
// Eliminates the `filtersSeeded` flag, the per-facet `updateUrl({...})`
// object, the chip-loop, and the bulk-reset that every catalog route hand-
// rolls.
// ---------------------------------------------------------------------------

export interface FacetGroup {
	readonly seeded: boolean;
	/** Seed every facet once, idempotent. Returns `true` if seeding happened
	 *  this call (lets callers gate dependent effects on the flip). */
	seed(): boolean;
	/** `{ [urlParam]: urlValue }` patch ready to spread into `updateUrl`. */
	urlPatch(): Record<string, string | null>;
	/** Non-null chips across all facets, in declaration order. */
	chips(): Chip[];
	/** Reset every facet to its full universe. */
	resetAll(): void;
}

export function createFacetGroup(facets: readonly FacetFilter[]): FacetGroup {
	// $state so the seeded flag is reactive — consumers that gate effects on
	// `if (group.seeded)` re-run when it flips.
	let seeded = $state(false);
	return {
		get seeded() {
			return seeded;
		},
		seed() {
			if (seeded) return false;
			seeded = true;
			for (const f of facets) f.seed();
			return true;
		},
		urlPatch() {
			const patch: Record<string, string | null> = {};
			for (const f of facets) patch[f.urlParam] = f.urlValue();
			return patch;
		},
		chips() {
			const out: Chip[] = [];
			for (const f of facets) {
				const c = f.chip();
				if (c) out.push(c);
			}
			return out;
		},
		resetAll() {
			for (const f of facets) f.reset();
		}
	};
}
