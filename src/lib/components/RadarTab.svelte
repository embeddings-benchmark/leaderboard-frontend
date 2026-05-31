<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import { radarPlot } from '$lib/charts/figures';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();
	let spec = $derived(radarPlot(summary));
	let hasData = $derived(spec.data.length > 0);
</script>

<div class="wrap">
	{#if hasData}
		<p class="muted">
			Top 5 models compared across the benchmark's task types. Each axis is one task type;
			distance from center is the score (× 100).
		</p>
		<PlotlyChart data={spec.data} layout={spec.layout} height={560} />
	{:else}
		<p class="muted">This benchmark only has one task category; the radar chart is hidden.</p>
	{/if}
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	.muted {
		color: var(--text-muted);
		margin: 0 0 12px;
	}
</style>
