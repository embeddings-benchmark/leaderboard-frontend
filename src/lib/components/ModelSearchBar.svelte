<!-- Filter-store-bound `SearchInput` + match/total count. -->
<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { filters } from '$lib/stores/filters.svelte';

	interface Props {
		matchCount?: number;
		totalCount?: number;
	}
	let { matchCount, totalCount }: Props = $props();

	// Local mirror of `filters.nameQuery` so typing doesn't re-fire the
	// `applyFilters` chain on every keystroke. Flushes to the store after
	// a 120 ms idle window — fast enough to feel live, slow enough that
	// a burst of typing only triggers one full filter recompute.
	let typed = $state(untrack(() => filters.nameQuery));
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const next = typed;
		if (flushTimer) clearTimeout(flushTimer);
		flushTimer = setTimeout(() => {
			if (filters.nameQuery !== next) filters.nameQuery = next;
			flushTimer = null;
		}, 120);
	});
	// Pick up external resets (clearAll, URL hydration) without bouncing.
	$effect(() => {
		const stored = filters.nameQuery;
		if (stored !== untrack(() => typed)) typed = stored;
	});
	onDestroy(() => {
		if (flushTimer) clearTimeout(flushTimer);
	});
</script>

<div class="bar">
	<SearchInput bind:value={typed} placeholder="Search models by name…" ariaLabel="Search models" />
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
