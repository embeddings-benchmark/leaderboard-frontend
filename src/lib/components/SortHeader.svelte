<script lang="ts" generics="K extends string">
	// Shared `<th>` content: a sort button with the column label + the
	// sort indicator. The `<th>` wrapper stays in each consumer because
	// the per-column classes (tbl-num, tbl-sticky-col, …) and ARIA
	// state vary; this component only owns the button markup.
	//
	// Generic over the sort-key type so `sort.key === field` stays
	// type-checked.

	import type { SortState } from '$lib/stores/sort.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		sort: SortState<K>;
		field: K;
		label: string;
		align?: 'left' | 'right';
		/** Truncate the label with an ellipsis when it overflows. Used by
		 * PerTaskTab where task names like "AmazonReviewsClassification"
		 * would otherwise blow the column width. */
		ellipsis?: boolean;
		/** Optional content rendered before the label (e.g. an InfoDot).
		 * Sits inline at the same baseline as the column name. */
		info?: Snippet;
	}
	let { sort, field, label, align = 'right', ellipsis = false, info }: Props = $props();
</script>

<button
	type="button"
	class="tbl-sort"
	class:tbl-sort-left={align === 'left'}
	onclick={() => sort.click(field)}
>
	{@render info?.()}
	<span class:ellipsis>{label}</span>
	<span class="tbl-sort-ind" class:on={sort.key === field}>{sort.icon(field)}</span>
</button>

<style>
	.ellipsis {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}
</style>
