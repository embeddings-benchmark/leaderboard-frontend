<script lang="ts">
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { BENCHMARK_MENU } from '$lib/data/mockBenchmarks';
	import BenchmarkPicker from '$lib/components/BenchmarkPicker.svelte';
	import PlotlyChart from '$lib/components/PlotlyChart.svelte';
	import { radarPlot } from '$lib/charts/figures';
	import type { Data, Layout } from 'plotly.js';
	import type { SummaryRow } from '$lib/types';
	import { untrack } from 'svelte';

	const MAX_PICKED = 4;
	const RADAR_COLORS = ['#EE4266', '#00a6ed', '#ECA72C', '#3CBBB1'];

	$effect(() => {
		if (!leaderboard.benchmark && !leaderboard.loading) {
			leaderboard.select(leaderboard.selected);
		}
	});

	let summary = $derived(leaderboard.summary);

	// Pre-seed picks with the top two models once a summary becomes available.
	let picked = $state<string[]>([]);
	let lastBenchmark = $state('');
	$effect(() => {
		const s = summary;
		const bench = leaderboard.selected;
		untrack(() => {
			if (!s) return;
			if (bench === lastBenchmark && picked.length > 0) return;
			lastBenchmark = bench;
			picked = s.rows.slice(0, 2).map((r) => r.model.name);
		});
	});

	let pickedRows = $derived.by(() => {
		if (!summary) return [];
		return picked
			.map((name) => summary!.rows.find((r) => r.model.name === name))
			.filter((r): r is SummaryRow => r !== undefined);
	});

	let pickerOpen = $state(false);
	let pickerQuery = $state('');
	let pickerRoot: HTMLDivElement | undefined = $state();

	function onDocClick(e: MouseEvent) {
		if (!pickerOpen || !pickerRoot) return;
		if (!pickerRoot.contains(e.target as Node)) pickerOpen = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && pickerOpen) pickerOpen = false;
	}

	function togglePick(name: string) {
		if (picked.includes(name)) {
			picked = picked.filter((n) => n !== name);
		} else if (picked.length < MAX_PICKED) {
			picked = [...picked, name];
		}
	}

	let pickerCandidates = $derived.by(() => {
		if (!summary) return [];
		const q = pickerQuery.trim().toLowerCase();
		return summary.rows.filter((r) => {
			if (q && !r.model.name.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	// Per-metric winners: which model has the best value.
	type Metric = {
		key: string;
		label: string;
		dir: 'max' | 'min';
		valueOf: (r: SummaryRow) => number | null;
		format: (r: SummaryRow) => string;
	};
	const metrics: Metric[] = [
		{
			key: 'rank',
			label: 'Rank',
			dir: 'min',
			valueOf: (r) => r.rank,
			format: (r) => `#${r.rank}`
		},
		{
			key: 'meanTask',
			label: 'Mean(Task)',
			dir: 'max',
			valueOf: (r) => r.meanTask,
			format: (r) => (r.meanTask * 100).toFixed(2)
		},
		{
			key: 'meanTaskType',
			label: 'Mean(TaskType)',
			dir: 'max',
			valueOf: (r) => r.meanTaskType,
			format: (r) => (r.meanTaskType * 100).toFixed(2)
		},
		{
			key: 'zero',
			label: 'Zero-shot %',
			dir: 'max',
			valueOf: (r) => (r.zeroShotPct === -1 ? null : r.zeroShotPct),
			format: (r) => (r.zeroShotPct === -1 ? '—' : `${r.zeroShotPct}%`)
		},
		{
			key: 'params',
			label: 'Total params (B)',
			dir: 'min',
			valueOf: (r) => (r.totalParamsB === 0 ? null : r.totalParamsB),
			format: (r) =>
				r.totalParamsB === 0 ? '—' : r.totalParamsB >= 1 ? r.totalParamsB.toFixed(1) : r.totalParamsB.toFixed(3)
		},
		{
			key: 'embed',
			label: 'Embedding dim',
			dir: 'max',
			valueOf: (r) => r.embeddingDim || null,
			format: (r) => (r.embeddingDim ? r.embeddingDim.toLocaleString() : '—')
		},
		{
			key: 'tokens',
			label: 'Max tokens',
			dir: 'max',
			valueOf: (r) => r.maxTokens || null,
			format: (r) => (r.maxTokens ? r.maxTokens.toLocaleString() : '—')
		}
	];

	function winnersForRow(values: (number | null)[], dir: 'max' | 'min'): boolean[] {
		const valid = values.filter((v): v is number => v !== null);
		if (valid.length === 0) return values.map(() => false);
		const best = dir === 'max' ? Math.max(...valid) : Math.min(...valid);
		return values.map((v) => v === best);
	}

	function bestTaskTypeValue(taskType: string): number {
		let m = -Infinity;
		for (const r of pickedRows) {
			const v = r.scoresByTaskType[taskType];
			if (v !== undefined && v > m) m = v;
		}
		return m;
	}

	// Radar plot for picked models across task types (reuses radarPlot but with custom subset).
	let radarSpec = $derived.by<{ data: Data[]; layout: Partial<Layout> } | null>(() => {
		if (!summary || pickedRows.length < 1 || summary.taskTypes.length < 2) return null;
		const theta = [...summary.taskTypes, summary.taskTypes[0]];
		const traces: Data[] = pickedRows.map((row, i) => {
			const r = summary!.taskTypes.map((tt) => (row.scoresByTaskType[tt] ?? 0) * 100);
			return {
				type: 'scatterpolar',
				mode: 'lines',
				name: row.model.displayName,
				r: [...r, r[0]],
				theta,
				line: { color: RADAR_COLORS[i % RADAR_COLORS.length], width: 2 },
				fill: 'toself',
				fillcolor: 'rgba(0,0,0,0)'
			};
		});
		const layout: Partial<Layout> = {
			polar: {
				radialaxis: {
					visible: true,
					showticklabels: false,
					ticks: '',
					gridcolor: '#cdd0d6',
					linecolor: 'rgba(0,0,0,0)'
				},
				angularaxis: {
					gridcolor: '#cdd0d6',
					linecolor: 'rgba(0,0,0,0)'
				}
			},
			showlegend: true,
			legend: { orientation: 'h', y: -0.15, yanchor: 'top', x: 0.5, xanchor: 'center' },
			margin: { l: 30, r: 30, t: 20, b: 20 }
		};
		return { data: traces, layout };
	});

	function modelColor(index: number): string {
		return RADAR_COLORS[index % RADAR_COLORS.length];
	}

	function fmtType(t: string) {
		return t;
	}
</script>

<svelte:window onclick={onDocClick} onkeydown={onKey} />

<div class="app">
	<header class="bar">
		<div class="brand">
			<span class="dot"></span>
			<span class="brand-name">mteb&nbsp;leaderboard</span>
			<span class="tag">Compare</span>
		</div>
		<BenchmarkPicker menu={BENCHMARK_MENU} />
	</header>

	<main class="page">
		{#if !summary}
			<p class="loading">Loading…</p>
		{:else}
			<section class="picker-bar">
				<div class="picks">
					{#each pickedRows as r, i (r.model.name)}
						<span class="pick-chip" style:--c={modelColor(i)}>
							<span class="pick-dot"></span>
							<span class="pick-name" title={r.model.name}>{r.model.displayName}</span>
							<button
								type="button"
								class="pick-x"
								onclick={() => togglePick(r.model.name)}
								aria-label="Remove from comparison"
							>
								×
							</button>
						</span>
					{/each}

					{#if picked.length < MAX_PICKED}
						<div class="picker" bind:this={pickerRoot}>
							<button
								type="button"
								class="add-btn"
								onclick={() => (pickerOpen = !pickerOpen)}
								aria-expanded={pickerOpen}
							>
								+ Add model
							</button>
							{#if pickerOpen}
								<div class="picker-panel" role="dialog" aria-label="Pick model">
									<input
										type="search"
										class="picker-search"
										placeholder="Search models…"
										bind:value={pickerQuery}
									/>
									<div class="picker-list">
										{#each pickerCandidates as r (r.model.name)}
											{@const isOn = picked.includes(r.model.name)}
											<button
												type="button"
												class="picker-row"
												class:on={isOn}
												disabled={!isOn && picked.length >= MAX_PICKED}
												onclick={() => togglePick(r.model.name)}
											>
												<span class="picker-rank">#{r.rank}</span>
												<span class="picker-name">{r.model.displayName}</span>
												<span class="picker-score">{(r.meanTask * 100).toFixed(2)}</span>
												<span class="picker-check">{isOn ? '✓' : ''}</span>
											</button>
										{/each}
										{#if pickerCandidates.length === 0}
											<p class="picker-empty">No matches.</p>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div class="meta">
					<span>{picked.length} / {MAX_PICKED}</span>
					{#if picked.length > 0}
						<button type="button" class="clear-all" onclick={() => (picked = [])}>
							Clear
						</button>
					{/if}
				</div>
			</section>

			{#if pickedRows.length === 0}
				<section class="empty">
					<h2>Pick at least one model to compare.</h2>
					<p>Use the "+ Add model" button above. You can compare up to four at a time.</p>
				</section>
			{:else}
				<section
					class="grid"
					style:grid-template-columns="200px repeat({pickedRows.length}, minmax(220px, 1fr))"
				>
					<!-- Header row: model identity strip -->
					<div class="cell head sticky"></div>
					{#each pickedRows as r, i (r.model.name)}
						<div class="cell head model-head" style:--c={modelColor(i)}>
							<div class="model-rank">#{r.rank}</div>
							{#if r.model.url}
								<a class="model-name" href={r.model.url} target="_blank" rel="noreferrer">
									{r.model.displayName}
								</a>
							{:else}
								<span class="model-name">{r.model.displayName}</span>
							{/if}
							<div class="model-meta">
								<span class="chip type">{fmtType(r.model.modelType)}</span>
								{#if r.model.openWeights}
									<span class="chip open">Open</span>
								{:else}
									<span class="chip closed">Proprietary</span>
								{/if}
								{#if r.model.instructionTuned}
									<span class="chip soft">Instruct</span>
								{/if}
							</div>
						</div>
					{/each}

					{#each metrics as m (m.key)}
						{@const values = pickedRows.map((r) => m.valueOf(r))}
						{@const winners = winnersForRow(values, m.dir)}
						<div class="cell metric-head sticky">{m.label}</div>
						{#each pickedRows as r, i (r.model.name)}
							<div class="cell metric-val" class:winner={winners[i]} style:--c={modelColor(i)}>
								{m.format(r)}
								{#if winners[i] && values.filter((v) => v !== null).length > 1}
									<span class="trophy" title="Best of selection">★</span>
								{/if}
							</div>
						{/each}
					{/each}

					<div class="cell metric-head section-head sticky">Per task type</div>
					{#each pickedRows as r, i (r.model.name)}
						<div class="cell section-head" style:--c={modelColor(i)}></div>
					{/each}

					{#each summary.taskTypes as tt (tt)}
						{@const best = bestTaskTypeValue(tt)}
						<div class="cell metric-head sticky">{tt}</div>
						{#each pickedRows as r, i (r.model.name)}
							{@const v = r.scoresByTaskType[tt]}
							{@const isWin = v !== undefined && v === best && pickedRows.length > 1}
							<div class="cell metric-val" class:winner={isWin} style:--c={modelColor(i)}>
								{v !== undefined ? (v * 100).toFixed(2) : '—'}
								{#if isWin}<span class="trophy">★</span>{/if}
							</div>
						{/each}
					{/each}
				</section>

				{#if radarSpec && pickedRows.length >= 1 && summary.taskTypes.length >= 2}
					<section class="radar-card">
						<h3>Strengths at a glance</h3>
						<PlotlyChart data={radarSpec.data} layout={radarSpec.layout} height={400} />
					</section>
				{/if}
			{/if}
		{/if}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		background: #fafafb;
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 24px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 0 4px var(--primary-soft);
	}
	.brand-name {
		font-weight: 700;
		font-size: 14px;
	}
	.tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		background: var(--primary-soft);
		padding: 3px 8px;
		border-radius: 999px;
	}

	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 24px 28px 56px;
	}
	.loading {
		color: var(--text-muted);
	}

	/* Picker bar ------------------------------------------------------------- */
	.picker-bar {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		margin-bottom: 20px;
	}
	.picks {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		flex: 1;
		min-width: 0;
	}
	.pick-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px 4px 10px;
		background: var(--surface);
		border: 1px solid var(--c);
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
	}
	.pick-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--c);
	}
	.pick-name {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pick-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border: none;
		background: var(--surface-muted);
		color: var(--text-muted);
		border-radius: 50%;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		padding: 0;
	}
	.pick-x:hover {
		background: var(--c);
		color: #fff;
	}

	.picker {
		position: relative;
	}
	.add-btn {
		padding: 5px 12px;
		background: var(--surface-muted);
		border: 1px dashed var(--border-strong);
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
	}
	.add-btn:hover {
		border-style: solid;
		color: var(--text);
		background: var(--surface);
	}
	.picker-panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		width: 360px;
		max-height: 420px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
		z-index: 30;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.picker-search {
		margin: 10px 12px;
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 12.5px;
		font-family: inherit;
		background: var(--surface);
	}
	.picker-search:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	.picker-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px;
	}
	.picker-row {
		display: grid;
		grid-template-columns: 36px 1fr auto 16px;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 6px 10px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12.5px;
		color: var(--text);
		text-align: left;
		border-radius: 6px;
	}
	.picker-row:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.picker-row:hover:not(:disabled) {
		background: var(--surface-muted);
	}
	.picker-row.on {
		background: var(--primary-soft);
		color: var(--primary-strong);
		font-weight: 600;
	}
	.picker-rank {
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}
	.picker-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.picker-score {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}
	.picker-check {
		color: var(--primary);
		font-weight: 700;
		text-align: center;
	}
	.picker-empty {
		padding: 12px;
		color: var(--text-muted);
		font-size: 12px;
		margin: 0;
	}
	.meta {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 12px;
		color: var(--text-subtle);
	}
	.clear-all {
		background: none;
		border: none;
		font-size: 12px;
		color: var(--link);
		font-weight: 600;
		cursor: pointer;
	}
	.clear-all:hover {
		text-decoration: underline;
	}

	/* Empty state ------------------------------------------------------------ */
	.empty {
		background: var(--surface);
		border: 1px dashed var(--border-strong);
		border-radius: 14px;
		padding: 48px 24px;
		text-align: center;
		color: var(--text-muted);
	}
	.empty h2 {
		font-size: 18px;
		color: var(--text);
		margin: 0 0 6px;
	}

	/* Compare grid ----------------------------------------------------------- */
	.grid {
		display: grid;
		gap: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}
	.cell {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		min-width: 0;
	}
	.cell.sticky {
		position: sticky;
		left: 0;
		background: var(--surface-muted);
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-weight: 700;
		z-index: 1;
		border-right: 1px solid var(--border);
	}
	.head {
		border-bottom: 2px solid var(--border);
	}
	.head.sticky {
		background: var(--surface-muted);
	}
	.model-head {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px 18px;
		border-top: 3px solid var(--c);
		background: color-mix(in srgb, var(--c) 6%, var(--surface));
	}
	.model-rank {
		font-size: 11px;
		font-weight: 700;
		color: var(--c);
		letter-spacing: 0.04em;
	}
	.model-name {
		font-size: 15px;
		font-weight: 800;
		color: var(--text);
		text-decoration: none;
		letter-spacing: -0.005em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.model-name:hover {
		color: var(--c);
	}
	.model-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		display: inline-block;
		padding: 2px 7px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 4px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.chip.type {
		background: color-mix(in srgb, var(--c) 18%, white);
		color: var(--c);
	}
	.chip.open {
		background: #def7e9;
		color: #1c7a4c;
	}
	.chip.closed {
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.chip.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
	}

	.metric-head {
		font-size: 11px;
		font-weight: 600;
	}
	.metric-val {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.metric-val.winner {
		color: var(--c);
		font-weight: 800;
		background: color-mix(in srgb, var(--c) 8%, transparent);
	}
	.trophy {
		font-size: 11px;
		color: var(--c);
	}
	.section-head {
		background: var(--surface-muted);
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 700;
		padding: 8px 16px;
		border-top: 1px solid var(--border);
	}

	.radar-card {
		margin-top: 20px;
		padding: 18px 20px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: var(--shadow-sm);
	}
	.radar-card h3 {
		font-size: 14px;
		margin: 0 0 6px;
		letter-spacing: -0.005em;
	}
</style>
