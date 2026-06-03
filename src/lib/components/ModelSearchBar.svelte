<!-- Filter-store-bound `SearchInput` + match/total count. -->
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
	/* `flex: 1 1 240px` triggers `.toolbar`'s flex-wrap on mobile so the
	   sort widget drops to its own row instead of bleeding under the search. */
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1 1 240px;
		min-width: 0;
	}
	.count {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
