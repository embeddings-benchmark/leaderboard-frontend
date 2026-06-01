<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { DEFAULT_BENCHMARK_NAME, loadBenchmarkMenu, loadSummary } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type BenchmarkSummary, type MenuEntry } from '$lib/types';

	let modelName = $derived(decodeURIComponent(page.params.name ?? ''));

	let allBenchmarks = $state<Benchmark[]>([]);
	let summaries = $state<Map<string, BenchmarkSummary>>(new Map());
	let loadingData = $state(true);

	$effect(() => {
		(async () => {
			const menu = await loadBenchmarkMenu();
			const out: Benchmark[] = [];
			const walk = (m: MenuEntry) => {
				for (const c of m.children) {
					if (isBenchmark(c)) out.push(c);
					else walk(c);
				}
			};
			menu.forEach(walk);
			allBenchmarks = out;
			// Always load the default benchmark so we can resolve model metadata,
			// even if the model has no row in any other benchmark.
			if (!summaries.has(DEFAULT_BENCHMARK_NAME)) {
				const s = await loadSummary(DEFAULT_BENCHMARK_NAME);
				const next = new Map(summaries);
				next.set(DEFAULT_BENCHMARK_NAME, s);
				summaries = next;
			}
		})();
	});

	// Lazily load every benchmark summary so we can list this model's scores
	// everywhere it appears. Cancels nothing — first hit warms the lru_cache on
	// the backend and subsequent loads are immediate.
	$effect(() => {
		if (allBenchmarks.length === 0) return;
		const missing = allBenchmarks.filter((b) => !summaries.has(b.name));
		if (missing.length === 0) {
			loadingData = false;
			return;
		}
		let pending = missing.length;
		for (const b of missing) {
			loadSummary(b.name)
				.then((s) => {
					const next = new Map(summaries);
					next.set(b.name, s);
					summaries = next;
				})
				.catch(() => {})
				.finally(() => {
					if (--pending === 0) loadingData = false;
				});
		}
	});

	let model = $derived.by(() => {
		for (const [, s] of summaries) {
			const m = s.rows.find((r) => r.model.name === modelName)?.model;
			if (m) return m;
		}
		return null;
	});

	interface BenchScore {
		benchmarkName: string;
		benchmarkDisplay: string;
		rank: number;
		meanTask: number;
		meanTaskType: number;
		zeroShotPct: number;
		totalModels: number;
		taskTypeScores: Record<string, number>;
		taskTypes: string[];
	}

	let scoresByBenchmark = $derived.by<BenchScore[]>(() => {
		const result: BenchScore[] = [];
		for (const b of allBenchmarks) {
			const summary = summaries.get(b.name);
			if (!summary) continue;
			const row = summary.rows.find((r) => r.model.name === modelName);
			if (!row) continue;
			result.push({
				benchmarkName: b.name,
				benchmarkDisplay: b.displayName,
				rank: row.rank,
				meanTask: row.meanTask,
				meanTaskType: row.meanTaskType,
				zeroShotPct: row.zeroShotPct,
				totalModels: summary.rows.length,
				taskTypeScores: row.scoresByTaskType,
				taskTypes: summary.taskTypes
			});
		}
		result.sort((a, b) => a.rank - b.rank);
		return result;
	});

	let bestBenchmark = $derived(scoresByBenchmark[0] ?? null);

	function fmtParamsValue(b: number): string {
		if (b === 0) return '—';
		if (b >= 1) return b.toFixed(1);
		return (b * 1000).toFixed(0);
	}
	function fmtParamsUnit(b: number): string {
		if (b === 0) return '';
		return b >= 1 ? 'B' : 'M';
	}
	function fmtInt(n: number): string {
		return n ? n.toLocaleString() : '—';
	}
	function fmtPct(s: number): string {
		return (s * 100).toFixed(2);
	}
	function fmtZeroShot(p: number): string {
		return p === -1 ? '⚠️ NA' : `${p}%`;
	}
	function slug(name: string): string {
		return encodeURIComponent(name);
	}

	// Heat shade reused from the leaderboard tables.
	function heat(score: number | undefined): string {
		if (score === undefined) return '';
		const v = Math.max(0, Math.min(1, (score - 0.45) / 0.3));
		const pct = Math.round(v * 55);
		if (pct === 0) return '';
		return `background-color: color-mix(in srgb, var(--primary) ${pct}%, transparent);`;
	}
</script>

<div class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href="{base}/explorer">Explorer</a>
		<span class="sep">/</span>
		<a href="{base}/explorer/models">Models</a>
		<span class="sep">/</span>
		<span class="current">{model?.displayName ?? modelName}</span>
	</nav>

	{#if loadingData && !model}
		<p class="muted">Loading model…</p>
	{:else if !model}
		<section class="empty card">
			<h1>Unknown model</h1>
			<p>No model named “{modelName}” found.</p>
			<a class="back" href="{base}/explorer/models">← All models</a>
		</section>
	{:else}
		<section class="hero card" data-type={model.modelType}>
			<div class="hero-left">
				<div class="kicker">
					<span class="type-badge" data-type={model.modelType}>{model.modelType}</span>
					<span class="badge" class:open={model.openWeights}>
						{model.openWeights ? 'Open weights' : 'Proprietary'}
					</span>
					{#if model.instructionTuned}
						<span class="badge soft">Instruction-tuned</span>
					{/if}
					{#if model.sentenceTransformersCompatible}
						<span class="badge soft">ST compatible</span>
					{/if}
				</div>
				<h1>
					<span class="org">{model.org}</span><span class="sl">/</span>{model.displayName}
				</h1>
				<div class="links">
					{#if model.url}
						<a class="ref" href={model.url} target="_blank" rel="noreferrer">
							Model page →
						</a>
					{/if}
					<a
						class="ref muted"
						href="{base}/explorer/compare?model={encodeURIComponent(model.name)}"
					>
						Compare with another model →
					</a>
				</div>
			</div>
			<div class="kpis">
				<div class="kpi">
					<span class="kpi-label">Parameters</span>
					<span class="kpi-value"
						>{fmtParamsValue(model.totalParamsB)}{#if fmtParamsUnit(model.totalParamsB)}<span
								class="unit">{fmtParamsUnit(model.totalParamsB)}</span
							>{/if}</span
					>
				</div>
				<div class="kpi">
					<span class="kpi-label">Embedding dim</span>
					<span class="kpi-value">{fmtInt(model.embeddingDim)}</span>
				</div>
				<div class="kpi">
					<span class="kpi-label">Max tokens</span>
					<span class="kpi-value">{fmtInt(model.maxTokens)}</span>
				</div>
				<div class="kpi">
					<span class="kpi-label">Released</span>
					<span class="kpi-value date">{model.releaseDate ?? '—'}</span>
				</div>
				{#if bestBenchmark}
					<div class="kpi top">
						<span class="kpi-label">Best benchmark</span>
						<a class="kpi-value top-name" href="{base}/explorer/{slug(bestBenchmark.benchmarkName)}">
							#{bestBenchmark.rank} on {bestBenchmark.benchmarkDisplay}
						</a>
					</div>
				{/if}
			</div>
		</section>

		<section class="scores">
			<header class="scores-head">
				<h2>Benchmark scores</h2>
				<span class="muted">{scoresByBenchmark.length} benchmark{scoresByBenchmark.length === 1 ? '' : 's'}</span>
			</header>
			{#if scoresByBenchmark.length === 0}
				<p class="muted">This model has no scores yet.</p>
			{:else}
				<div class="scroll">
					<table>
						<thead>
							<tr>
								<th class="sticky">Benchmark</th>
								<th class="num">Rank</th>
								<th class="num">Mean (Task)</th>
								<th class="num">Mean (TaskType)</th>
								<th class="num">Zero-shot</th>
							</tr>
						</thead>
						<tbody>
							{#each scoresByBenchmark as s (s.benchmarkName)}
								<tr>
									<td class="sticky">
										<a class="bench-link" href="{base}/explorer/{slug(s.benchmarkName)}">
											{s.benchmarkDisplay}
										</a>
									</td>
									<td class="num">
										<span class="rank-pill" class:top={s.rank === 1}>
											#{s.rank}
										</span>
										<span class="rank-total">/ {s.totalModels}</span>
									</td>
									<td class="num" style={heat(s.meanTask)}>{fmtPct(s.meanTask)}</td>
									<td class="num" style={heat(s.meanTaskType)}>{fmtPct(s.meanTaskType)}</td>
									<td class="num">{fmtZeroShot(s.zeroShotPct)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 18px 28px 56px;
	}
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 14px;
	}
	.breadcrumb a {
		color: var(--text-muted);
		text-decoration: none;
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

	/* Hero ----------------------------------------------------------------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 28px;
		padding: 26px 28px;
		margin-bottom: 18px;
		position: relative;
		overflow: hidden;
	}
	.hero::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: var(--accent, var(--border));
	}
	.hero[data-type='dense'] {
		--accent: #2740b8;
		background: linear-gradient(180deg, color-mix(in srgb, #e8edff 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='cross-encoder'] {
		--accent: #c0432e;
		background: linear-gradient(180deg, color-mix(in srgb, #ffe6dc 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='late-interaction'] {
		--accent: #1c7a4c;
		background: linear-gradient(180deg, color-mix(in srgb, #def7e9 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='sparse'] {
		--accent: #a36100;
		background: linear-gradient(180deg, color-mix(in srgb, #fff1d4 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='router'] {
		--accent: #f2e7ff;
		background: linear-gradient(180deg, color-mix(in srgb, #f2e7ff 60%, white) 0%, var(--surface) 200px);
	}
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}

	.kicker {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}
	.type-badge {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 999px;
	}
	.type-badge[data-type='dense'] {
		background: #e8edff;
		color: #2740b8;
	}
	.type-badge[data-type='cross-encoder'] {
		background: #ffe6dc;
		color: #c0432e;
	}
	.type-badge[data-type='late-interaction'] {
		background: #def7e9;
		color: #1c7a4c;
	}
	.type-badge[data-type='sparse'] {
		background: #fff1d4;
		color: #a36100;
	}
	.type-badge[data-type='router'] {
		background: #f2e7ff;
		color: #6a32b1;
	}
	.badge {
		font-size: 10px;
		padding: 4px 9px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.badge.open {
		background: #def7e9;
		color: #1c7a4c;
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
	}

	.hero h1 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 14px;
		word-break: break-word;
	}
	.hero h1 .org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.hero h1 .sl {
		color: var(--border-strong);
		margin: 0 2px;
		font-weight: 400;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}
	.ref {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent, var(--primary-strong));
	}
	.ref.muted {
		color: var(--link);
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
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
	.kpi.top {
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
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.kpi-value .unit {
		font-size: 0.65em;
		font-weight: 500;
		color: var(--text-subtle);
		margin-left: 2px;
	}
	.kpi-value.date {
		font-size: 16px;
	}
	.kpi-value.top-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--accent, var(--primary-strong));
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kpi-value.top-name:hover {
		text-decoration: underline;
	}

	/* Scores section ------------------------------------------------------- */
	.scores {
		margin-top: 24px;
	}
	.scores-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 10px;
	}
	.scores h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.muted {
		color: var(--text-muted);
		font-size: 13px;
	}
	.scroll {
		overflow-x: auto;
		max-height: 70vh;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 13px;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		text-align: left;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 1;
		white-space: nowrap;
	}
	tbody td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:nth-child(even) td {
		background: var(--row-alt);
	}
	tbody tr:hover td {
		background: var(--row-hover);
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sticky {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		min-width: 240px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky {
		background: var(--row-hover);
	}
	.bench-link {
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	.bench-link:hover {
		color: var(--link);
	}
	.rank-pill {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 700;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.rank-pill.top {
		background: var(--primary-soft);
		color: var(--primary-strong);
	}
	.rank-total {
		color: var(--text-subtle);
		font-size: 11px;
		margin-left: 4px;
	}

	.empty {
		padding: 48px 28px;
		text-align: center;
	}
	.empty h1 {
		font-size: 22px;
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
