<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import { performanceOverTimePlot } from '$lib/charts/figures';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();
	let spec = $derived(performanceOverTimePlot(summary, pinnedModels.value));
</script>

<div class="wrap">
	<p class="muted">
		Each marker is a model at its release date; the step line traces the running best Mean(Task)
		score over time.
	</p>
	<PlotlyChart data={spec.data} layout={spec.layout} height={480} />
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
