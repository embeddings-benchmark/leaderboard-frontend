<!--
  Filter-store-bound wrapper around `SearchInput` for the global model
  name query. Adds the "matches / total" count next to the input so the
  user knows how aggressive their filter is. Used by /models and by the
  per-benchmark detail toolbar.
-->
<script lang="ts">
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { filters } from '$lib/stores/filters.svelte';

	interface Props {
		matchCount?: number;
		totalCount?: number;
	}
	let { matchCount, totalCount }: Props = $props();
</script>

<div class="bar">
	<SearchInput
		bind:value={filters.nameQuery}
		placeholder="Search models by name…"
		ariaLabel="Search models"
	/>
	{#if filters.nameQuery && matchCount !== undefined && totalCount !== undefined}
		<span class="count">{matchCount} / {totalCount} models</span>
	{/if}
</div>

<style>
	/* No outer margin — this component renders inside the page-level
	   sticky `.toolbar` strip which already owns padding and spacing.
	   The /benchmark/[name] detail page wraps this in `.toolbar-row`
	   which adds its own `margin: 8px 0` via a `:global(.bar)` rule. */
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}
	.count {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
