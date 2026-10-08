<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import { TIME_FRONTIER_COLOR, performanceOverTimePlot } from '$lib/charts/figures';
	import { experimentLabel, fmtPct, rowId } from '$lib/format';
	import { datedRows, recordSetters } from '$lib/pareto';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import FrontierChart from './FrontierChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();
	let spec = $derived(performanceOverTimePlot(summary, pinnedModels.value));
	// The models where the step line goes up, oldest first — reads left to
	// right along the chart.
	let items = $derived(
		recordSetters(datedRows(summary.rows)).map((r) => ({
			id: rowId(r),
			name: r.model.name,
			displayName: r.model.displayName,
			variant: experimentLabel(r.experiments),
			modelType: r.model.modelType,
			detail: fmtPct(r.meanTask),
			meta: r.model.releaseDate
		}))
	);
</script>

<div class="wrap">
	<p class="muted">
		Each marker is a model at its release date; the step line traces the running best Mean(Task)
		score over time.
	</p>
	<FrontierChart
		{spec}
		height={480}
		color={TIME_FRONTIER_COLOR}
		title="New best at release"
		{items}
	/>
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
