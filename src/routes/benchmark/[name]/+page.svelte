<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';

	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import { apiUrl, isIconUrl } from '$lib/format';
	import { sanitizeFilename, type CsvCell } from '$lib/csv';
	import { getParam, updateUrl } from '$lib/url-state';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import SummaryTable from '$lib/components/SummaryTable.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import PerfSizeTab from '$lib/components/PerfSizeTab.svelte';
	import PerfTimeTab from '$lib/components/PerfTimeTab.svelte';
	import PerTaskTab from '$lib/components/PerTaskTab.svelte';
	import PerLanguageTab from '$lib/components/PerLanguageTab.svelte';
	import TaskInfoTab from '$lib/components/TaskInfoTab.svelte';
	import FAQ from '$lib/components/FAQ.svelte';

	let benchmarkName = $derived(decodeURIComponent(page.params.name ?? ''));
	let benchmark = $derived(
		leaderboard.benchmark?.name === benchmarkName ? leaderboard.benchmark : null
	);

	type TabId =
		| 'summary'
		| 'perf_size'
		| 'perf_time'
		| 'perf_task'
		| 'perf_language'
		| 'task_info';
	const TABS: { id: TabId; label: string }[] = [
		{ id: 'summary', label: 'Summary' },
		{ id: 'perf_size', label: 'Performance per Model Size' },
		{ id: 'perf_time', label: 'Performance over Time' },
		{ id: 'perf_task', label: 'Performance per task' },
		{ id: 'perf_language', label: 'Performance per language' },
		{ id: 'task_info', label: 'Task information' }
	];
	// Hydrate active tab from `?tab=` for shareable deep links.
	const TAB_IDS = new Set(TABS.map((t) => t.id));
	const initialTab = getParam('tab');
	let activeTab = $state<TabId>(
		initialTab && TAB_IDS.has(initialTab as TabId) ? (initialTab as TabId) : 'summary'
	);
	$effect(() => {
		// Default tab is implicit — omit from URL so the canonical share link
		// for the default view stays clean.
		updateUrl({ tab: activeTab === 'summary' ? null : activeTab });
	});

	// Mount-and-keep: once a tab body has been rendered, leave it in the DOM
	// and just hide it on switch. The big tables (PerTaskTab in particular —
	// 308 rows × dozens of task columns) take ~400ms to mount cold; flipping
	// CSS display is ~1ms, so this trades a one-time cost per tab for near-
	// instant switches forever after.
	let visited = $state<Set<TabId>>(new Set());
	$effect(() => {
		if (!visited.has(activeTab)) {
			visited = new Set(visited).add(activeTab);
		}
	});

	$effect(() => {
		if (!benchmarkName) return;
		// Trigger load both when the URL benchmark differs from the store's
		// current selection AND when it matches but the summary hasn't loaded yet
		// (cold visit where selected already defaulted to this benchmark name).
		const needsSwitch = leaderboard.selected !== benchmarkName;
		const needsInitialLoad = !leaderboard.summary && !leaderboard.loading;
		if (needsSwitch || needsInitialLoad) {
			leaderboard.select(benchmarkName);
		}
	});
	$effect(() => {
		filters.initFor(leaderboard.summary);
	});

	let filteredSummary = $derived(
		leaderboard.summary && leaderboard.selected === benchmarkName
			? applyFilters(leaderboard.summary)
			: null
	);

	// CSV builders for the three downloadable tabs. Wrapped as lazy closures
	// so DownloadButton only pays the serialisation cost on click.
	function buildSummaryCsv() {
		const s = filteredSummary!;
		const aggs = new Set(s.aggregations ?? []);
		const showTask = aggs.has('mean_task');
		const showType = aggs.has('mean_task_type');
		const showPP = aggs.has('public_private');
		const showTT = aggs.has('task_types');
		const publicNames = new Set(
			s.tasksMeta.filter((t) => t.isPublic !== false).map((t) => t.name)
		);
		const privateNames = new Set(
			s.tasksMeta.filter((t) => t.isPublic === false).map((t) => t.name)
		);
		const meanOver = (row: (typeof s.rows)[number], names: Set<string>): number | null => {
			if (names.size === 0) return null;
			let sum = 0;
			let n = 0;
			for (const name of names) {
				const v = row.scoresByTask[name];
				if (typeof v === 'number') {
					sum += v;
					n += 1;
				}
			}
			return n === names.size ? sum / n : null;
		};
		const headers = [
			'Rank',
			'Model',
			'Zero-shot',
			'Active Params (B)',
			'Total Params (B)',
			'Embedding Dim',
			'Max Tokens',
			...(showTask ? ['Mean (Task)'] : []),
			...(showType ? ['Mean (TaskType)'] : []),
			...(showPP ? ['Mean (Public)', 'Mean (Private)'] : []),
			...(showTT ? s.taskTypes : [])
		];
		const pct = (v: number | null | undefined) => (v == null ? null : (v * 100).toFixed(2));
		const rows: CsvCell[][] = s.rows.map((row) => [
			row.rank,
			row.model.name,
			row.zeroShotPct === -1 ? 'NA' : row.zeroShotPct,
			row.activeParamsB,
			row.totalParamsB,
			row.embeddingDim,
			row.maxTokens,
			...(showTask ? [pct(row.meanTask)] : []),
			...(showType ? [pct(row.meanTaskType)] : []),
			...(showPP
				? [pct(meanOver(row, publicNames)), pct(meanOver(row, privateNames))]
				: []),
			...(showTT ? s.taskTypes.map((tt) => pct(row.scoresByTaskType[tt])) : [])
		]);
		return { headers, rows };
	}

	function buildPerTaskCsv() {
		const s = filteredSummary!;
		const headers = ['Rank', 'Model', ...s.tasks];
		const pct = (v: number | null | undefined) => (v == null ? null : (v * 100).toFixed(2));
		const rows: CsvCell[][] = s.rows.map((row) => [
			row.rank,
			row.model.name,
			...s.tasks.map((t) => pct(row.scoresByTask[t]))
		]);
		return { headers, rows };
	}
</script>

<div class="app">
	<main class="main">
		<nav class="breadcrumb" aria-label="Breadcrumb">
			<a href="{base}/">Home</a>
			<span class="sep">/</span>
			<span class="current">{benchmark?.displayName ?? benchmarkName}</span>
		</nav>

		{#if leaderboard.loading && !benchmark}
			<p class="muted">Loading benchmark…</p>
		{:else if leaderboard.error}
			<section class="empty card">
				<h1>Couldn't load benchmark</h1>
				<p>{leaderboard.error}</p>
				<a class="back" href="{base}/">← Back home</a>
			</section>
		{:else if !benchmark}
			<section class="empty card">
				<h1>Unknown benchmark</h1>
				<p>No benchmark named “{benchmarkName}”.</p>
				<a class="back" href="{base}/">← Back home</a>
			</section>
		{:else}
			<section class="hero card">
				<div class="hero-left">
					<div class="title-block">
						{#if benchmark.icon}
							{#if isIconUrl(benchmark.icon)}
								<img class="hero-icon" src={apiUrl(benchmark.icon)} alt="" />
							{:else}
								<span class="hero-icon hero-icon-text" aria-hidden="true">{benchmark.icon}</span>
							{/if}
						{/if}
						<h1>{benchmark.displayName}</h1>
						{#if benchmark.name !== benchmark.displayName}
							<code class="benchmark-id" title={benchmark.name}>{benchmark.name}</code>
						{/if}
					</div>
					<p class="desc"><MarkdownText text={benchmark.description} /></p>
					{#if benchmark.reference}
						<a class="ref" href={benchmark.reference} target="_blank" rel="noreferrer">
							Reference paper →
						</a>
					{/if}
					<CiteBlock kind="benchmark" citation={benchmark.citation} />
				</div>
				<div class="kpis">
					<div class="kpi">
						<span class="kpi-label">Languages</span>
						<span class="kpi-value">{benchmark.languages.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Tasks</span>
						<span class="kpi-value">{filteredSummary?.tasks.length ?? benchmark.tasks.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Task Types</span>
						<span class="kpi-value"
							>{filteredSummary?.taskTypes.length ?? benchmark.taskTypes.length}</span
						>
					</div>
					<div class="kpi">
						<span class="kpi-label">Models</span>
						<span class="kpi-value">{filteredSummary?.rows.length ?? 0}</span>
					</div>
				</div>
			</section>

			<Tabs tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id)} />

			{#if activeTab === 'summary' || activeTab === 'perf_task' || activeTab === 'perf_language'}
				<div class="toolbar-row">
					<ModelSearchBar
						matchCount={filteredSummary?.rows.length}
						totalCount={leaderboard.summary?.rows.length}
					/>
					{#if activeTab === 'summary' && filteredSummary}
						<DownloadButton
							filename="{sanitizeFilename(benchmark.name)}_summary"
							build={buildSummaryCsv}
						/>
					{:else if activeTab === 'perf_task' && filteredSummary}
						<DownloadButton
							filename="{sanitizeFilename(benchmark.name)}_per_task"
							build={buildPerTaskCsv}
						/>
					{/if}
				</div>
			{/if}

			<section class="tab-body">
				{#if !filteredSummary}
					<p class="muted">Loading…</p>
				{:else if filteredSummary.rows.length === 0}
					<p class="muted">No models match the current filters.</p>
				{:else}
					{#if visited.has('summary')}
						<div class="tab-pane" class:active={activeTab === 'summary'}>
							<SummaryTable summary={filteredSummary} />
							<FAQ />
						</div>
					{/if}
					{#if visited.has('perf_size')}
						<div class="tab-pane" class:active={activeTab === 'perf_size'}>
							<PerfSizeTab summary={filteredSummary} />
						</div>
					{/if}
					{#if visited.has('perf_time')}
						<div class="tab-pane" class:active={activeTab === 'perf_time'}>
							<PerfTimeTab summary={filteredSummary} />
						</div>
					{/if}
					{#if visited.has('perf_task')}
						<div class="tab-pane" class:active={activeTab === 'perf_task'}>
							<PerTaskTab summary={filteredSummary} />
						</div>
					{/if}
					{#if visited.has('perf_language')}
						<div class="tab-pane" class:active={activeTab === 'perf_language'}>
							<PerLanguageTab summary={filteredSummary} />
						</div>
					{/if}
					{#if visited.has('task_info')}
						<div class="tab-pane" class:active={activeTab === 'task_info'}>
							<TaskInfoTab {benchmark} tasksMeta={filteredSummary.tasksMeta} />
						</div>
					{/if}
				{/if}
			</section>
		{/if}
	</main>

	<FilterSidebar />
</div>

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
		max-width: 1400px;
		margin: 0 auto;
		padding: 18px 28px 40px;
		padding-right: 28px;
	}
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.breadcrumb a {
		color: var(--text-muted);
	}
	.breadcrumb a:hover {
		color: var(--text);
	}
	.sep {
		color: var(--border-strong);
	}
	.current {
		color: var(--text);
		font-weight: 600;
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 28px;
		padding: 22px 26px;
		margin-bottom: 16px;
	}
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
	.title-block {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 8px;
	}
	.hero-icon {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 5px;
		object-fit: contain;
		background: var(--surface-muted);
	}
	.hero-icon-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		line-height: 1;
	}
	.hero-left h1 {
		font-size: 26px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.1;
		margin: 0;
		color: var(--ink-strong);
	}
	.benchmark-id {
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-weight: 500;
		color: var(--text-muted);
		padding: 3px 8px 2px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		letter-spacing: 0.01em;
	}
	.desc {
		color: var(--text-muted);
		margin: 0 0 12px;
	}
	.ref {
		font-size: 13px;
		font-weight: 600;
	}
	/* CiteBlock lives inside the hero card now; give it a little air above. */
	.hero-left :global(.cite) {
		margin-top: 14px;
	}
	.kpis {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: start;
	}
	.kpi {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		padding: 6px 12px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 8px;
		min-width: 150px;
	}
	.kpi-label {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.kpi-value {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 1000px) {
		.kpis {
			flex-direction: row;
			flex-wrap: wrap;
		}
		.kpi {
			min-width: 0;
			flex: 1;
		}
	}

	.tab-body {
		padding-top: 14px;
	}
	/* Inactive panes stay mounted but hidden — see the visited-set comment
	   above. Using `display: none` (instead of `hidden`) means the layout
	   collapses cleanly without stealing keyboard focus or scrollable space. */
	.tab-pane {
		display: none;
	}
	.tab-pane.active {
		display: block;
	}
	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.toolbar-row :global(.bar) {
		flex: 1;
		min-width: 0;
		margin: 8px 0;
	}
	.muted {
		color: var(--text-muted);
	}

	.empty {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 40px;
		text-align: center;
	}
	.empty h1 {
		font-size: 20px;
		margin: 0 0 6px;
	}
	.empty p {
		color: var(--text-muted);
	}
	.back {
		display: inline-block;
		margin-top: 12px;
		font-weight: 600;
	}
</style>
