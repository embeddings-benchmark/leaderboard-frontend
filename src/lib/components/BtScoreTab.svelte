<script lang="ts">
	import type { BenchmarkSummary } from '$lib/types';
	import { btScorePlot, btScorePlotHeight } from '$lib/charts/figures';
	import PlotlyChart from './PlotlyChart.svelte';
	import Segmented from './Segmented.svelte';

	interface Props {
		summary: BenchmarkSummary;
		// Jump to where the method is explained (the host owns tab state).
		onExplain?: () => void;
	}
	let { summary, onExplain }: Props = $props();

	const SIZES = ['20', '50', '100'] as const;
	type Size = (typeof SIZES)[number];
	let size = $state<Size>('20');
	let topN = $derived(Number(size));
	let spec = $derived(btScorePlot(summary, topN));
	let shown = $derived(
		spec.data.reduce((n, t) => n + ((t as { x?: unknown[] }).x?.length ?? 0), 0)
	);
	// Whiskers only exist for the API's full-view ratings — sidebar filters
	// refit the BT score client-side without the bootstrap (see `$lib/bt-score`).
	let hasInterval = $derived(
		summary.rows.some((r) => r.btScoreLow != null && r.btScoreHigh != null)
	);
</script>

<div class="wrap">
	<div class="intro">
		<p class="muted">
			BT score of the top {shown} models (best first); each dot is a model's score and the whisker is
			its 95% bootstrap interval over tasks. Models whose intervals overlap aren't reliably ordered.
			{#if !hasInterval}
				Intervals are hidden while task or model filters are active — the score is refit on the
				visible set without the bootstrap.
			{/if}
			{#if onExplain}<button type="button" class="link" onclick={onExplain}
					>How is it computed?</button
				>{/if}
		</p>
		<Segmented
			ariaLabel="Number of models"
			options={SIZES.map((s) => ({ label: `Top ${s}`, value: s }))}
			value={size}
			onChange={(next) => (size = next)}
		/>
	</div>
	{#if spec.data.length === 0}
		<p class="muted">No BT scores are available for this benchmark.</p>
	{:else}
		<PlotlyChart data={spec.data} layout={spec.layout} height={btScorePlotHeight(shown)} />
	{/if}
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	.intro {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		margin-bottom: 8px;
	}
	.link {
		all: unset;
		cursor: pointer;
		color: var(--link, var(--ink-strong));
		text-decoration: underline;
	}
	.link:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		margin: 0;
		max-width: 80ch;
	}
</style>
