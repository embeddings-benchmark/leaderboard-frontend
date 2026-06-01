<script lang="ts">
	import { page } from '$app/state';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { loadBenchmarkMenu, loadSummary } from '$lib/data/service';
	import PlotlyChart from '$lib/components/PlotlyChart.svelte';
	import type { Data, Layout } from 'plotly.js';
	import type { Benchmark, BenchmarkSummary, MenuEntry, SummaryRow } from '$lib/types';
	import { isBenchmark } from '$lib/types';
	import { untrack } from 'svelte';

	const MAX_PICKED = 4;
	const MAX_BENCHMARKS = 6;
	const MAX_TASKS = 12;
	const RADAR_COLORS = ['#EE4266', '#00a6ed', '#ECA72C', '#3CBBB1'];

	let ALL_BENCHMARKS = $state<Benchmark[]>([]);
	let benchIndex = $derived(new Map(ALL_BENCHMARKS.map((b) => [b.name, b])));
	let summaryCache = $state<Map<string, BenchmarkSummary>>(new Map());

	$effect(() => {
		loadBenchmarkMenu().then((menu) => {
			const out: Benchmark[] = [];
			const walk = (m: MenuEntry) => {
				for (const c of m.children) {
					if (isBenchmark(c)) out.push(c);
					else walk(c);
				}
			};
			menu.forEach(walk);
			ALL_BENCHMARKS = out;
		});
	});

	let pickedBenchmarks = $state<string[]>([leaderboard.selected]);

	// Kick off summary loads for every picked benchmark not yet in the cache.
	$effect(() => {
		const missing = pickedBenchmarks.filter((n) => !summaryCache.has(n));
		if (missing.length === 0) return;
		untrack(() => {
			for (const name of missing) {
				loadSummary(name).then((s) => {
					const next = new Map(summaryCache);
					next.set(name, s);
					summaryCache = next;
				});
			}
		});
	});

	let benchSummaries = $derived<BenchmarkSummary[]>(
		pickedBenchmarks
			.map((name) => summaryCache.get(name))
			.filter((s): s is BenchmarkSummary => s !== undefined)
	);
	let primarySummary = $derived<BenchmarkSummary | null>(benchSummaries[0] ?? null);

	// Pre-seed picks with the top two models from the primary benchmark once
	// available. If the URL carries ?model=X (one or more), use those instead so
	// "Compare with another model" from a model detail page lands on the model.
	let picked = $state<string[]>([]);
	let lastSeed = $state('');
	$effect(() => {
		const s = primarySummary;
		const bench = pickedBenchmarks[0] ?? '';
		const requested = page.url.searchParams.getAll('model');
		untrack(() => {
			if (!s) return;
			if (bench === lastSeed && picked.length > 0) return;
			lastSeed = bench;
			const valid = new Set(s.rows.map((r) => r.model.name));
			const fromUrl = requested.filter((n) => valid.has(n)).slice(0, MAX_PICKED);
			picked = fromUrl.length > 0 ? fromUrl : s.rows.slice(0, 2).map((r) => r.model.name);
		});
	});

	let pickedRows = $derived.by(() => {
		if (!primarySummary) return [];
		return picked
			.map((name) => primarySummary!.rows.find((r) => r.model.name === name))
			.filter((r): r is SummaryRow => r !== undefined);
	});

	// Per-benchmark lookup: rows by model name for each picked benchmark.
	type BenchView = { name: string; summary: BenchmarkSummary; byModel: Map<string, SummaryRow> };
	let benchViews = $derived<BenchView[]>(
		benchSummaries.map((s) => ({
			name: s.benchmarkName,
			summary: s,
			byModel: new Map(s.rows.map((r) => [r.model.name, r]))
		}))
	);

	let pickerOpen = $state(false);
	let pickerQuery = $state('');
	let pickerRoot: HTMLDivElement | undefined = $state();

	let benchPickerOpen = $state(false);
	let benchPickerQuery = $state('');
	let benchPickerRoot: HTMLDivElement | undefined = $state();

	let pickedTasks = $state<string[]>([]);
	let taskPickerOpen = $state(false);
	let taskPickerQuery = $state('');
	let taskPickerRoot: HTMLDivElement | undefined = $state();

	function onDocClick(e: MouseEvent) {
		const target = e.target as Node;
		if (pickerOpen && pickerRoot && !pickerRoot.contains(target)) pickerOpen = false;
		if (benchPickerOpen && benchPickerRoot && !benchPickerRoot.contains(target))
			benchPickerOpen = false;
		if (taskPickerOpen && taskPickerRoot && !taskPickerRoot.contains(target))
			taskPickerOpen = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (pickerOpen) pickerOpen = false;
		if (benchPickerOpen) benchPickerOpen = false;
		if (taskPickerOpen) taskPickerOpen = false;
	}

	function togglePick(name: string) {
		if (picked.includes(name)) {
			picked = picked.filter((n) => n !== name);
		} else if (picked.length < MAX_PICKED) {
			picked = [...picked, name];
		}
	}

	function toggleBenchmark(name: string) {
		if (pickedBenchmarks.includes(name)) {
			if (pickedBenchmarks.length === 1) return; // keep at least one
			pickedBenchmarks = pickedBenchmarks.filter((n) => n !== name);
		} else if (pickedBenchmarks.length < MAX_BENCHMARKS) {
			pickedBenchmarks = [...pickedBenchmarks, name];
		}
	}

	function toggleTask(name: string) {
		if (pickedTasks.includes(name)) {
			pickedTasks = pickedTasks.filter((n) => n !== name);
		} else if (pickedTasks.length < MAX_TASKS) {
			pickedTasks = [...pickedTasks, name];
		}
	}

	// Union of tasks from picked benchmarks (deduped), each tagged with type +
	// the first benchmark that supplies its scores.
	type TaskCandidate = { name: string; type: string; benchmark: string };
	let availableTasks = $derived.by<TaskCandidate[]>(() => {
		const seen = new Map<string, TaskCandidate>();
		for (const s of benchSummaries) {
			for (const meta of s.tasksMeta) {
				if (!seen.has(meta.name))
					seen.set(meta.name, { name: meta.name, type: meta.type, benchmark: s.benchmarkName });
			}
		}
		return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	// Union of task types across picked benchmarks, preserving first-seen order.
	let unionTaskTypes = $derived.by<string[]>(() => {
		const seen = new Set<string>();
		const list: string[] = [];
		for (const s of benchSummaries) {
			for (const tt of s.taskTypes) {
				if (!seen.has(tt)) {
					seen.add(tt);
					list.push(tt);
				}
			}
		}
		return list;
	});

	// Drop tasks from the pick list once the benchmark supplying them is removed.
	$effect(() => {
		const valid = new Set(availableTasks.map((t) => t.name));
		const next = pickedTasks.filter((n) => valid.has(n));
		if (next.length !== pickedTasks.length) pickedTasks = next;
	});

	// For each picked task: find a benchmark summary that scored it, then per-
	// model score from that summary. Tasks are deduped, so we use the first hit.
	type TaskScoreView = {
		name: string;
		type: string;
		benchmark: string;
		scores: (number | undefined)[];
	};
	let taskScores = $derived.by<TaskScoreView[]>(() => {
		return pickedTasks
			.map((tn) => {
				for (const s of benchSummaries) {
					if (!(s.tasks ?? []).includes(tn)) continue;
					const meta = s.tasksMeta.find((m) => m.name === tn);
					const byModel = new Map(s.rows.map((r) => [r.model.name, r]));
					return {
						name: tn,
						type: meta?.type ?? '',
						benchmark: s.benchmarkName,
						scores: pickedRows.map((p) => byModel.get(p.model.name)?.scoresByTask[tn])
					};
				}
				return null;
			})
			.filter((x): x is TaskScoreView => x !== null);
	});

	// For each task type in the union: average per-model score across the
	// benchmarks that include that type. Returns undefined when no benchmark
	// provides it for that model.
	type TypeScoreView = { type: string; scores: (number | undefined)[] };
	let typeScores = $derived.by<TypeScoreView[]>(() => {
		return unionTaskTypes.map((tt) => {
			const scores = pickedRows.map((p) => {
				const vals: number[] = [];
				for (const s of benchSummaries) {
					if (!s.taskTypes.includes(tt)) continue;
					const row = s.rows.find((r) => r.model.name === p.model.name);
					const v = row?.scoresByTaskType[tt];
					if (v !== undefined) vals.push(v);
				}
				if (vals.length === 0) return undefined;
				return vals.reduce((a, b) => a + b, 0) / vals.length;
			});
			return { type: tt, scores };
		});
	});

	let pickerCandidates = $derived.by(() => {
		if (!primarySummary) return [];
		const q = pickerQuery.trim().toLowerCase();
		return primarySummary.rows.filter((r) => {
			if (q && !r.model.name.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	let benchCandidates = $derived.by(() => {
		const q = benchPickerQuery.trim().toLowerCase();
		return ALL_BENCHMARKS.filter((b) => {
			if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q))
				return false;
			return true;
		});
	});

	let taskCandidates = $derived.by<TaskCandidate[]>(() => {
		const q = taskPickerQuery.trim().toLowerCase();
		if (!q) return availableTasks;
		return availableTasks.filter(
			(t) => t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)
		);
	});

	// Per-metric winners: which model has the best value.
	type Metric = {
		key: string;
		label: string;
		dir: 'max' | 'min';
		valueOf: (r: SummaryRow) => number | null;
		format: (r: SummaryRow) => string;
	};
	// Model attributes — values that don't depend on the benchmark.
	const metrics: Metric[] = [
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

	// Radar plot uses the primary (first picked) benchmark's task types.
	let radarSpec = $derived.by<{ data: Data[]; layout: Partial<Layout> } | null>(() => {
		const summary = primarySummary;
		if (!summary || pickedRows.length < 1 || summary.taskTypes.length < 2) return null;
		const theta = [...summary.taskTypes, summary.taskTypes[0]];
		const traces: Data[] = pickedRows.map((row, i) => {
			const r = summary.taskTypes.map((tt) => (row.scoresByTaskType[tt] ?? 0) * 100);
			const color = RADAR_COLORS[i % RADAR_COLORS.length];
			return {
				type: 'scatterpolar',
				mode: 'lines',
				name: row.model.displayName,
				r: [...r, r[0]],
				theta,
				line: { color, width: 2 },
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
	<div class="bar">
		<div class="bench-picker" bind:this={benchPickerRoot}>
			<div class="picks bench-picks">
				{#each pickedBenchmarks as bn (bn)}
					{@const b = benchIndex.get(bn)}
					<span class="pick-chip bench-chip">
						<span class="pick-name" title={bn}>{b?.displayName ?? bn}</span>
						{#if pickedBenchmarks.length > 1}
							<button
								type="button"
								class="pick-x"
								onclick={() => toggleBenchmark(bn)}
								aria-label="Remove benchmark"
							>
								×
							</button>
						{/if}
					</span>
				{/each}
				{#if pickedBenchmarks.length < MAX_BENCHMARKS}
					<button
						type="button"
						class="add-btn"
						onclick={() => (benchPickerOpen = !benchPickerOpen)}
						aria-expanded={benchPickerOpen}
					>
						+ Add benchmark
					</button>
				{/if}
			</div>
			{#if benchPickerOpen}
				<div class="picker-panel bench-panel" role="dialog" aria-label="Pick benchmark">
					<input
						type="search"
						class="picker-search"
						placeholder="Search benchmarks…"
						bind:value={benchPickerQuery}
					/>
					<div class="picker-list">
						{#each benchCandidates as b (b.name)}
							{@const isOn = pickedBenchmarks.includes(b.name)}
							<button
								type="button"
								class="picker-row bench-row"
								class:on={isOn}
								disabled={!isOn && pickedBenchmarks.length >= MAX_BENCHMARKS}
								onclick={() => toggleBenchmark(b.name)}
							>
								<span class="picker-name">{b.displayName}</span>
								<span class="picker-score">{b.tasks.length} tasks</span>
								<span class="picker-check">{isOn ? '✓' : ''}</span>
							</button>
						{/each}
						{#if benchCandidates.length === 0}
							<p class="picker-empty">No matches.</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		<span class="bench-meta">{pickedBenchmarks.length} / {MAX_BENCHMARKS} benchmarks</span>
	</div>

	<div class="bar">
		<div class="bench-picker" bind:this={taskPickerRoot}>
			<div class="picks bench-picks">
				{#each pickedTasks as tn (tn)}
					<span class="pick-chip task-chip">
						<span class="pick-name" title={tn}>{tn}</span>
						<button
							type="button"
							class="pick-x"
							onclick={() => toggleTask(tn)}
							aria-label="Remove task"
						>
							×
						</button>
					</span>
				{/each}
				{#if pickedTasks.length < MAX_TASKS && availableTasks.length > 0}
					<button
						type="button"
						class="add-btn"
						onclick={() => (taskPickerOpen = !taskPickerOpen)}
						aria-expanded={taskPickerOpen}
					>
						+ Add task
					</button>
				{/if}
			</div>
			{#if taskPickerOpen}
				<div class="picker-panel bench-panel" role="dialog" aria-label="Pick task">
					<input
						type="search"
						class="picker-search"
						placeholder="Search tasks…"
						bind:value={taskPickerQuery}
					/>
					<div class="picker-list">
						{#each taskCandidates as t (t.name)}
							{@const isOn = pickedTasks.includes(t.name)}
							<button
								type="button"
								class="picker-row bench-row"
								class:on={isOn}
								disabled={!isOn && pickedTasks.length >= MAX_TASKS}
								onclick={() => toggleTask(t.name)}
							>
								<span class="picker-name">{t.name}</span>
								<span class="picker-score">{t.type}</span>
								<span class="picker-check">{isOn ? '✓' : ''}</span>
							</button>
						{/each}
						{#if taskCandidates.length === 0}
							<p class="picker-empty">No matches.</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		<span class="bench-meta">{pickedTasks.length} / {MAX_TASKS} tasks</span>
	</div>

	<main class="page">
		{#if !primarySummary}
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

					<div class="cell metric-head section-head sticky">Model attributes</div>
					{#each pickedRows as _r, i (_r.model.name)}
						<div class="cell section-head" style:--c={modelColor(i)}></div>
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

					<div class="cell metric-head section-head sticky">Score per benchmark</div>
					{#each pickedRows as _r, i (_r.model.name)}
						<div class="cell section-head" style:--c={modelColor(i)}></div>
					{/each}

					{#each benchViews as bv (bv.name)}
						{@const rows = pickedRows.map((p) => bv.byModel.get(p.model.name))}
						{@const meanValues = rows.map((r) => (r ? r.meanTask : null))}
						{@const meanWinners = winnersForRow(meanValues, 'max')}
						{@const rankValues = rows.map((r) => (r ? r.rank : null))}
						{@const rankWinners = winnersForRow(rankValues, 'min')}
						<div class="cell metric-head sticky bench-row-head">
							<span class="bench-label">{benchIndex.get(bv.name)?.displayName ?? bv.name}</span>
							<span class="bench-sub">Mean(Task) · Rank</span>
						</div>
						{#each pickedRows as p, i (p.model.name)}
							{@const r = rows[i]}
							<div
								class="cell metric-val bench-cell"
								class:winner={meanWinners[i]}
								style:--c={modelColor(i)}
							>
								{#if r}
									<span class="score">{(r.meanTask * 100).toFixed(2)}</span>
									<span class="rank-pill" class:best={rankWinners[i]}>#{r.rank}</span>
									{#if meanWinners[i] && meanValues.filter((v) => v !== null).length > 1}
										<span class="trophy" title="Best on this benchmark">★</span>
									{/if}
								{:else}
									—
								{/if}
							</div>
						{/each}
					{/each}

					{#if typeScores.length > 0}
						<div class="cell metric-head section-head sticky">
							Per task type
							{#if pickedBenchmarks.length > 1}<span class="sub-hint"
									>· averaged across picked benchmarks</span
								>{/if}
						</div>
						{#each pickedRows as _r, i (_r.model.name)}
							<div class="cell section-head" style:--c={modelColor(i)}></div>
						{/each}
						{#each typeScores as ts (ts.type)}
							{@const winners = winnersForRow(
								ts.scores.map((v) => (v === undefined ? null : v)),
								'max'
							)}
							<div class="cell metric-head sticky">{ts.type}</div>
							{#each ts.scores as v, i (pickedRows[i].model.name)}
								<div
									class="cell metric-val"
									class:winner={winners[i] && pickedRows.length > 1}
									style:--c={modelColor(i)}
								>
									{v !== undefined ? (v * 100).toFixed(2) : '—'}
									{#if winners[i] && pickedRows.length > 1 && v !== undefined}<span class="trophy"
											>★</span
										>{/if}
								</div>
							{/each}
						{/each}
					{/if}

					{#if taskScores.length > 0}
						<div class="cell metric-head section-head sticky">Per task</div>
						{#each pickedRows as _r, i (_r.model.name)}
							<div class="cell section-head" style:--c={modelColor(i)}></div>
						{/each}
						{#each taskScores as ts (ts.name)}
							{@const winners = winnersForRow(
								ts.scores.map((v) => (v === undefined ? null : v)),
								'max'
							)}
							<div class="cell metric-head sticky bench-row-head">
								<span class="bench-label">{ts.name}</span>
								<span class="bench-sub">{ts.type}</span>
							</div>
							{#each ts.scores as v, i (pickedRows[i].model.name)}
								<div
									class="cell metric-val"
									class:winner={winners[i] && pickedRows.length > 1}
									style:--c={modelColor(i)}
								>
									{v !== undefined ? (v * 100).toFixed(2) : '—'}
									{#if winners[i] && pickedRows.length > 1 && v !== undefined}<span class="trophy"
											>★</span
										>{/if}
								</div>
							{/each}
						{/each}
					{/if}
				</section>

				{#if pickedBenchmarks.length === 1 && radarSpec && pickedRows.length >= 1 && primarySummary && primarySummary.taskTypes.length >= 2}
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
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 28px 0;
		max-width: 1280px;
		margin: 0 auto;
	}

	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 24px 28px 56px;
	}
	.loading {
		color: var(--text-muted);
	}

	/* Benchmark picker bar -------------------------------------------------- */
	.bench-picker {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.bench-picks {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.bench-chip {
		--c: var(--primary);
		border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
		background: color-mix(in srgb, var(--primary-soft) 65%, var(--surface));
	}
	.task-chip {
		--c: var(--text-muted);
		border-color: var(--border-strong);
		background: var(--surface-muted);
	}
	.sub-hint {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
		color: var(--text-subtle);
		margin-left: 4px;
	}
	.picker-panel.bench-panel {
		left: 0;
		width: 420px;
	}
	.picker-row.bench-row {
		grid-template-columns: 1fr auto 16px;
	}
	.bench-meta {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
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

	.bench-row-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 10px;
		padding-bottom: 10px;
	}
	.bench-label {
		font-size: 12px;
		color: var(--text);
		font-weight: 700;
		text-transform: none;
		letter-spacing: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bench-sub {
		font-size: 10px;
		color: var(--text-subtle);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.bench-cell .score {
		font-size: 14px;
	}
	.bench-cell .rank-pill {
		display: inline-flex;
		align-items: center;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-subtle);
		font-size: 11px;
		font-weight: 700;
	}
	.bench-cell .rank-pill.best {
		background: color-mix(in srgb, var(--c) 15%, white);
		color: var(--c);
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
