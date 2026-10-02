<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import {
		SIZE_FRONTIER_COLOR,
		bestProprietaryRow,
		performanceSizePlot
	} from '$lib/charts/figures';
	import { experimentLabel, fmtParamsCompact, fmtPct, rowId } from '$lib/format';
	import { isParetoEligible } from '$lib/pareto';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import FrontierChart, { type LegendItem } from './FrontierChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();
	let spec = $derived(performanceSizePlot(summary, pinnedModels.value));
	let legend = $derived<LegendItem[]>([
		{
			kind: 'frontier',
			label: 'Pareto frontier (no model of equal or smaller size scores higher)'
		},
		...(bestProprietaryRow(summary)
			? [{ kind: 'reference' as const, label: 'Best proprietary model (most publish no size)' }]
			: [])
	]);
	// `fmtParamsCompact` renders 0 as '—', but a static model's 0 active
	// params is a real value here.
	const fmtActive = (b: number) => (b === 0 ? '0 M' : fmtParamsCompact(b, ' '));
	// One frontier spans every model type on the chart, but active parameters
	// don't capture per-document cost (late-interaction stores many vectors
	// per document; cross-encoders score every query–document pair). Say so
	// when the plotted models mix types, and point at the per-type filter.
	let note = $derived.by(() => {
		const types = [
			...new Set(summary.rows.filter(isParetoEligible).map((r) => r.model.modelType))
		].sort();
		if (types.length < 2) return '';
		const list = `${types.slice(0, -1).join(', ')} and ${types[types.length - 1]}`;
		return (
			`Mixes ${list} models. Active parameters don't capture ` +
			`per-document storage or scoring cost, so filter by model type in the sidebar ` +
			`for a like-for-like frontier.`
		);
	});
	// Same models the frontier line connects, smallest first — reads left to
	// right along the chart.
	let items = $derived(
		summary.rows
			.filter(isParetoEligible)
			.filter((r) => summary.paretoModels?.has(rowId(r)))
			.sort((a, b) => a.activeParamsB - b.activeParamsB || b.meanTask - a.meanTask)
			.map((r) => ({
				id: rowId(r),
				name: r.model.name,
				displayName: r.model.displayName,
				variant: experimentLabel(r.experiments),
				modelType: r.model.modelType,
				detail: fmtPct(r.meanTask),
				meta: fmtActive(r.activeParamsB)
			}))
	);
</script>

<div class="wrap">
	<p class="muted">
		Mean (Task) score vs. number of active parameters (log scale). Bubble size scales with embedding
		dimension; color shows max-token length. Hover a point for the model name.
	</p>
	<FrontierChart
		{spec}
		height={520}
		color={SIZE_FRONTIER_COLOR}
		{legend}
		{note}
		title="Pareto optimal"
		{items}
	/>
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		margin: 0 0 8px;
	}
</style>
