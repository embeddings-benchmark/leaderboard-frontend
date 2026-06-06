<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import { performanceSizePlot } from '$lib/charts/figures';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();
	let spec = $derived(performanceSizePlot(summary, pinnedModels.value));
</script>

<div class="wrap">
	<p class="muted">
		Mean(Task) score vs. number of active parameters (log scale). Bubble size scales with embedding
		dimension; color shows max-token length. Hover a point for the model name.
	</p>
	<PlotlyChart data={spec.data} layout={spec.layout} height={520} />
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		margin: 0 0 12px;
	}
</style>
