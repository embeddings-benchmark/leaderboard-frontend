<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';
	import { pinnedModels } from '$lib/stores/pinned.svelte';

	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import CopyableId from '$lib/components/CopyableId.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
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

	let benchmarkName = $derived(decodeURIComponent(page.params.name ?? ''));
	let benchmark = $derived(
		leaderboard.benchmark?.name === benchmarkName ? leaderboard.benchmark : null
	);

	type TabId = 'summary' | 'perf_size' | 'perf_time' | 'perf_task' | 'perf_language' | 'task_info';
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
	const visited = new SvelteSet<TabId>();
	$effect(() => {
		if (!visited.has(activeTab)) visited.add(activeTab);
	});

	// Bound to the live PerLanguageTab instance so the page-level toolbar
	// can call its `buildCsv()` for the Download CSV button — keeps the
	// download next to the search bar like the other tabs, instead of
	// PerLanguageTab rendering its own button on a separate row.
	let perLanguageTab = $state<{ buildCsv: () => ReturnType<typeof buildPerTaskCsv> } | null>(null);

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

	// Pinned models are scoped to the current benchmark — pinning persists
	// across tab switches (Summary ↔ Per task ↔ Per language) but a
	// navigation to a different benchmark resets the set so stale pins
	// don't shadow rows in a list that may not even contain them. First
	// mount keeps whatever the `?pin=` URL hydrated; we only clear when
	// the benchmark name actually changes.
	let prevBenchmarkForPins: string | null = null;
	$effect(() => {
		const current = benchmarkName;
		if (prevBenchmarkForPins !== null && prevBenchmarkForPins !== current) {
			pinnedModels.clear();
		}
		prevBenchmarkForPins = current;
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
		const publicNames = new Set(s.tasksMeta.filter((t) => t.isPublic !== false).map((t) => t.name));
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
			...(showPP ? [pct(meanOver(row, publicNames)), pct(meanOver(row, privateNames))] : []),
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
			<a href={resolve('/')}>Home</a>
			<span class="sep">/</span>
			<span class="current">{benchmark?.displayName ?? benchmarkName}</span>
		</nav>

		{#if leaderboard.loading && !benchmark}
			<p class="muted">Loading benchmark…</p>
		{:else if leaderboard.error}
			<section class="empty card">
				<h1>Couldn't load benchmark</h1>
				<p>{leaderboard.error}</p>
				<a class="back" href={resolve('/')}>← Back home</a>
			</section>
		{:else if !benchmark}
			<section class="empty card">
				<h1>Unknown benchmark</h1>
				<p>No benchmark named “{benchmarkName}”.</p>
				<a class="back" href={resolve('/')}>← Back home</a>
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
						<div class="title-text">
							<h1>{benchmark.displayName}</h1>
							<CopyableId value={benchmark.name} ariaLabel="Copy benchmark id" />
						</div>
					</div>
					<p class="desc"><MarkdownText text={benchmark.description} /></p>
					{#if benchmark.reference}
						<!-- External paper URL -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
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
					{:else if activeTab === 'perf_language' && filteredSummary && perLanguageTab}
						<DownloadButton
							filename="{sanitizeFilename(benchmark.name)}_per_language"
							build={() => perLanguageTab!.buildCsv()}
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
							<PerLanguageTab summary={filteredSummary} bind:this={perLanguageTab} />
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

<ShareUrlButton />

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
		/* Fill all the slack between the page edge and the filter
		   sidebar — no max-width cap so the table can stretch full
		   width on ultrawide displays. 12 px right padding gives a
		   small gap to the sidebar (or the overlay toggle button
		   when the sidebar is collapsed). */
		padding: 18px 12px 40px 28px;
	}
	/* `.breadcrumb`, `.breadcrumb a`, `.breadcrumb .sep`,
	   `.breadcrumb .current` live in src/app.css. */

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgb(15, 23, 42, 0.04);
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
			/* `minmax(0, 1fr)` (not bare `1fr`) lets the column shrink
			   below its intrinsic content width — without it, the
			   CiteBlock's <pre> claims its full bibtex width and
			   blows the card past the viewport on mobile. */
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.title-block {
		display: flex;
		/* Top-align so the hero icon sits next to the h1's row, not
		   vertically centred between the h1 and the id pill below it. */
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 8px;
	}
	/* Stack the display name and the id pill vertically so the pill
	   sits *under* the name instead of being centred beside it. */
	.title-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
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
	@media (max-width: 640px) {
		/* 4 KPIs on a 375 px row leaves ~80 px each, which makes the
		   value (e.g. 380 models) burst out of the chip. A 2×2 grid
		   gives each ~150 px and stacks the value under the label
		   so big numbers always fit inside their tile. */
		.kpis {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 6px;
		}
		.kpi {
			flex-direction: column;
			align-items: flex-start;
			gap: 2px;
		}
		.kpi-value {
			font-size: 18px;
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
	/* `.muted` (color + margin: 0) lives in src/app.css. */

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
