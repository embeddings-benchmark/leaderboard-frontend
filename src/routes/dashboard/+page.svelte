<script lang="ts">
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';
	import { BENCHMARK_MENU } from '$lib/data/mockBenchmarks';

	import BenchmarkPicker from '$lib/components/BenchmarkPicker.svelte';
	import FilterDrawer from '$lib/components/FilterDrawer.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import SummaryTable from '$lib/components/SummaryTable.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import PerfSizeTab from '$lib/components/PerfSizeTab.svelte';
	import PerfTimeTab from '$lib/components/PerfTimeTab.svelte';
	import RadarTab from '$lib/components/RadarTab.svelte';
	import PerTaskTab from '$lib/components/PerTaskTab.svelte';
	import PerLanguageTab from '$lib/components/PerLanguageTab.svelte';
	import TaskInfoTab from '$lib/components/TaskInfoTab.svelte';
	import FAQ from '$lib/components/FAQ.svelte';

	type TabId =
		| 'summary'
		| 'perf_size'
		| 'perf_time'
		| 'perf_task_type'
		| 'perf_task'
		| 'perf_language'
		| 'task_info';
	const TABS: { id: TabId; label: string }[] = [
		{ id: 'summary', label: 'Summary' },
		{ id: 'perf_size', label: 'Performance per Model Size' },
		{ id: 'perf_time', label: 'Performance over Time' },
		{ id: 'perf_task_type', label: 'Performance per Task Type' },
		{ id: 'perf_task', label: 'Performance per task' },
		{ id: 'perf_language', label: 'Performance per language' },
		{ id: 'task_info', label: 'Task information' }
	];
	let activeTab = $state<TabId>('summary');
	let drawerOpen = $state(false);

	$effect(() => {
		if (!leaderboard.benchmark && !leaderboard.loading) {
			leaderboard.select(leaderboard.selected);
		}
	});
	$effect(() => {
		filters.initFor(leaderboard.summary);
	});

	let filteredSummary = $derived(
		leaderboard.summary ? applyFilters(leaderboard.summary) : null
	);

	let topModel = $derived(filteredSummary?.rows[0]?.model.displayName ?? '—');
	let openModelsPct = $derived.by(() => {
		if (!filteredSummary || filteredSummary.rows.length === 0) return 0;
		const open = filteredSummary.rows.filter((r) => r.model.openWeights).length;
		return Math.round((open / filteredSummary.rows.length) * 100);
	});

	let activeFilterCount = $derived.by(() => {
		let n = 0;
		if (filters.nameQuery.trim()) n++;
		if (filters.availability !== 'both') n++;
		if (filters.instructions !== 'both') n++;
		if (filters.zeroShot !== 'allow_all') n++;
		if (filters.sentenceTransformersOnly) n++;
		if (filters.modelTypes.size !== 5) n++;
		// size slider: count if not at full extents
		if (filters.minModelSizeM > 1 || filters.maxModelSizeM < 1_000_000) n++;
		// customize
		if (
			filters.availableTaskTypes.length > 0 &&
			filters.taskTypes.size !== filters.availableTaskTypes.length
		)
			n++;
		if (
			filters.availableDomains.length > 0 &&
			filters.domains.size !== filters.availableDomains.length
		)
			n++;
		if (
			filters.availableLanguages.length > 0 &&
			filters.languages.size !== filters.availableLanguages.length
		)
			n++;
		if (
			filters.availableTasks.length > 0 &&
			filters.tasks.size !== filters.availableTasks.length
		)
			n++;
		return n;
	});
</script>

<div class="app">
	<header class="topbar">
		<div class="brand">
			<span class="brand-dot"></span>
			<span class="brand-name">mteb&nbsp;leaderboard</span>
			<span class="brand-tag">Dashboard</span>
		</div>
		<div class="topbar-right">
			<BenchmarkPicker menu={BENCHMARK_MENU} />
			<button type="button" class="filter-btn" onclick={() => (drawerOpen = true)}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
				</svg>
				Filters
				{#if activeFilterCount > 0}
					<span class="badge">{activeFilterCount}</span>
				{/if}
			</button>
		</div>
	</header>

	<main class="page">
		{#if !leaderboard.benchmark || !filteredSummary}
			<p class="muted">Loading…</p>
		{:else}
			<section class="hero card">
				<div class="hero-left">
					<h1>{leaderboard.benchmark.displayName}</h1>
					<p class="desc">{leaderboard.benchmark.description}</p>
					{#if leaderboard.benchmark.reference}
						<a
							class="ref"
							href={leaderboard.benchmark.reference}
							target="_blank"
							rel="noreferrer"
						>
							Reference paper →
						</a>
					{/if}
				</div>
				<div class="kpis">
					<div class="kpi">
						<span class="kpi-label">Languages</span>
						<span class="kpi-value">{leaderboard.benchmark.languages.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Tasks</span>
						<span class="kpi-value">{filteredSummary.tasks.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Task Types</span>
						<span class="kpi-value">{filteredSummary.taskTypes.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Models</span>
						<span class="kpi-value">{filteredSummary.rows.length}</span>
					</div>
					<div class="kpi wide">
						<span class="kpi-label">Top model</span>
						<span class="kpi-value top">{topModel}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Open-weight</span>
						<span class="kpi-value">{openModelsPct}%</span>
					</div>
				</div>
			</section>

			<section class="results card">
				<div class="results-head">
					<Tabs tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id)} />
				</div>

				<div class="results-toolbar">
					<ModelSearchBar
						matchCount={filteredSummary.rows.length}
						totalCount={leaderboard.summary?.rows.length}
					/>
				</div>

				<div class="results-body">
					{#if filteredSummary.rows.length === 0}
						<p class="muted">No models match the current filters.</p>
					{:else if activeTab === 'summary'}
						<SummaryTable summary={filteredSummary} />
						<div class="actions">
							<DownloadButton summary={filteredSummary} />
						</div>
						<FAQ />
					{:else if activeTab === 'perf_size'}
						<PerfSizeTab summary={filteredSummary} />
					{:else if activeTab === 'perf_time'}
						<PerfTimeTab summary={filteredSummary} />
					{:else if activeTab === 'perf_task_type'}
						<RadarTab summary={filteredSummary} />
					{:else if activeTab === 'perf_task'}
						<PerTaskTab summary={filteredSummary} />
					{:else if activeTab === 'perf_language'}
						<PerLanguageTab summary={filteredSummary} />
					{:else if activeTab === 'task_info'}
						<TaskInfoTab benchmark={leaderboard.benchmark} />
					{/if}
				</div>
			</section>
		{/if}
	</main>

	<FilterDrawer open={drawerOpen} onClose={() => (drawerOpen = false)} />
</div>

<style>
	.app {
		min-height: 100vh;
		background: linear-gradient(180deg, #fbfbfc 0%, var(--bg) 240px);
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 28px;
		background: rgba(255, 255, 255, 0.86);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.brand-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 0 4px var(--primary-soft);
	}
	.brand-name {
		font-weight: 700;
		font-size: 14px;
		color: var(--text);
	}
	.brand-tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		background: var(--primary-soft);
		padding: 3px 8px;
		border-radius: 999px;
	}
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--primary);
		border: 1px solid var(--primary-strong);
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(232, 90, 42, 0.25);
		transition:
			background 0.12s,
			box-shadow 0.12s,
			transform 0.06s ease;
	}
	.filter-btn:hover {
		background: var(--primary-strong);
		box-shadow: 0 2px 6px rgba(232, 90, 42, 0.35);
	}
	.filter-btn:active {
		transform: translateY(1px);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: #fff;
		color: var(--primary-strong);
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
	}

	.page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px 28px 56px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 28px;
		padding: 26px 28px;
	}
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
	.hero-left h1 {
		font-size: 26px;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.desc {
		color: var(--text-muted);
		margin: 0 0 12px;
		max-width: 60ch;
	}
	.ref {
		font-size: 13px;
		font-weight: 600;
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		align-content: start;
	}
	.kpi {
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kpi.wide {
		grid-column: span 2;
	}
	.kpi-label {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.kpi-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.kpi-value.top {
		font-size: 14px;
		font-weight: 600;
		color: var(--primary-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.results {
		padding: 0;
		overflow: hidden;
	}
	.results-head {
		padding: 0 20px;
		border-bottom: 1px solid var(--border);
	}
	.results-toolbar {
		padding: 10px 20px 4px;
	}
	.results-body {
		padding: 6px 20px 24px;
	}
	.actions {
		display: flex;
		justify-content: center;
		padding-top: 12px;
	}

	.muted {
		color: var(--text-muted);
	}
</style>
