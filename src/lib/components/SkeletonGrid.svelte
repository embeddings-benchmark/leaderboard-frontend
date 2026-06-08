<script lang="ts">
	// Wrap a SkeletonCard grid that matches the real `.grid` layout used by
	// /models, /tasks, /benchmarks, and the home page. `count` defaults to a
	// sensible "above-the-fold" amount — about 4 columns × 3 rows on a
	// 1280px viewport.
	import SkeletonCard from './SkeletonCard.svelte';
	interface Props {
		count?: number;
	}
	let { count = 12 }: Props = $props();
	const placeholders = $derived(Array.from({ length: count }, (_, i) => i));
</script>

<div class="card-grid" aria-busy="true" aria-label="Loading">
	{#each placeholders as i (i)}
		<SkeletonCard />
	{/each}
</div>
