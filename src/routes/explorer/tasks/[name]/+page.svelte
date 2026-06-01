<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';
	import { buildMockSummary } from '$lib/data/mockSummary';
	import { languageLabel } from '$lib/data/languages';
	import type { TaskMeta, ModelMeta } from '$lib/types';

	let taskName = $derived(decodeURIComponent(page.params.name ?? ''));

	interface TaskWithBenchmark {
		meta: TaskMeta;
		benchmarkName: string;
		benchmarkDisplay: string;
	}

	// Find the first benchmark that contains this task and pull its task metadata.
	let task = $derived.by<TaskWithBenchmark | null>(() => {
		for (const bench of Object.values(BENCHMARK_INDEX)) {
			const summary = buildMockSummary(bench.name);
			const meta = summary.tasksMeta.find((m) => m.name === taskName);
			if (meta) return { meta, benchmarkName: bench.name, benchmarkDisplay: bench.displayName };
		}
		return null;
	});

	// All benchmarks that contain this task (typically just one in our mock data).
	let benchmarks = $derived.by(() => {
		const list: { name: string; display: string }[] = [];
		for (const bench of Object.values(BENCHMARK_INDEX)) {
			const summary = buildMockSummary(bench.name);
			if (summary.tasks.includes(taskName)) {
				list.push({ name: bench.name, display: bench.displayName });
			}
		}
		return list;
	});

	interface ModelScore {
		model: ModelMeta;
		score: number;
		rank: number;
		benchmarkName: string;
		subsetScores: number[];
	}

	// Deterministic per-task subsets. For multilingual tasks we use the task's
	// own language list (mapped to friendly names); otherwise we use a small
	// generic split set so the table always shows at least 2 splits.
	let subsets = $derived.by<string[]>(() => {
		if (!task) return [];
		const langs = task.meta.languages;
		if (langs.length >= 2) {
			return langs.slice(0, Math.min(4, langs.length)).map(languageLabel);
		}
		// Pick 2-3 generic splits based on the task name hash.
		const POOL = ['test', 'dev', 'validation', 'subset_a', 'subset_b'];
		const seed = hashStr(taskName);
		const count = 2 + (seed % 2); // 2 or 3
		return POOL.slice(0, count);
	});

	function hashStr(s: string): number {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = (h * 16777619) >>> 0;
		}
		return h;
	}

	// Deterministic per-(model, subset) score that hovers around the model's
	// reported task score. Mean of subsets is intentionally close to the
	// reported score (not exactly equal — splits in real data drift).
	function subsetScore(modelName: string, subset: string, base: number): number {
		const seed = hashStr(modelName + '|' + subset + '|' + taskName);
		const noise = ((seed % 1000) / 1000 - 0.5) * 0.08; // ±0.04
		return Math.max(0, Math.min(1, base + noise));
	}

	// Every (model × benchmark) pair where this task exists, with the model's
	// score on this task. Sorted by score desc, rank assigned within the result.
	let scores = $derived.by<ModelScore[]>(() => {
		const rows: ModelScore[] = [];
		for (const b of benchmarks) {
			const summary = buildMockSummary(b.name);
			for (const r of summary.rows) {
				const v = r.scoresByTask[taskName];
				if (v === undefined) continue;
				const subsetScores = subsets.map((s) => subsetScore(r.model.name, s, v));
				rows.push({
					model: r.model,
					score: v,
					rank: 0,
					benchmarkName: b.name,
					subsetScores
				});
			}
		}
		rows.sort((a, b) => b.score - a.score);
		rows.forEach((r, i) => (r.rank = i + 1));
		return rows;
	});

	let leader = $derived<ModelScore | null>(scores[0] ?? null);
	let multipleBenchmarks = $derived(benchmarks.length > 1);

	function fmtPct(s: number): string {
		return (s * 100).toFixed(2);
	}
	function slug(name: string): string {
		return encodeURIComponent(name);
	}
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
		<a href="{base}/explorer/tasks">Tasks</a>
		<span class="sep">/</span>
		<span class="current">{taskName}</span>
	</nav>

	{#if !task}
		<section class="empty card">
			<h1>Unknown task</h1>
			<p>No task named “{taskName}” exists in the mock data.</p>
			<a class="back" href="{base}/explorer/tasks">← All tasks</a>
		</section>
	{:else}
		<section class="hero card" data-type={task.meta.type}>
			<div class="hero-left">
				<div class="kicker">
					<span class="type-badge" data-type={task.meta.type}>{task.meta.type}</span>
					<span class="badge soft">{task.meta.modality}</span>
				</div>
				<h1>{taskName}</h1>
				<p class="desc">{task.meta.description}</p>
				{#if task.meta.domains.length > 0}
					<div class="domains">
						<span class="dim">Domains:</span>
						{#each task.meta.domains as d (d)}
							<span class="dom-chip">{d}</span>
						{/each}
					</div>
				{/if}
				{#if task.meta.languages.length > 0}
					<div class="langs">
						<span class="dim">Languages:</span>
						{#each task.meta.languages as l (l)}
							<span class="lang-chip" title={l}>{languageLabel(l)}</span>
						{/each}
					</div>
				{/if}
				<div class="bench-links">
					<span class="dim">In benchmark{multipleBenchmarks ? 's' : ''}:</span>
					{#each benchmarks as b (b.name)}
						<a class="bench-chip" href="{base}/explorer/{slug(b.name)}">{b.display}</a>
					{/each}
				</div>
			</div>
			<div class="kpis">
				<div class="kpi">
					<span class="kpi-label">Models scored</span>
					<span class="kpi-value">{scores.length}</span>
				</div>
				<div class="kpi">
					<span class="kpi-label">Best score</span>
					<span class="kpi-value">{leader ? fmtPct(leader.score) : '—'}</span>
				</div>
				{#if leader}
					<div class="kpi wide">
						<span class="kpi-label">Top model</span>
						<a class="kpi-value top-name" href="{base}/explorer/models/{slug(leader.model.name)}">
							{leader.model.org}/{leader.model.displayName}
						</a>
					</div>
				{/if}
			</div>
		</section>

		<section class="scores">
			<header class="scores-head">
				<h2>Model scores</h2>
				<span class="muted">{scores.length} {scores.length === 1 ? 'entry' : 'entries'}</span>
			</header>
			{#if scores.length === 0}
				<p class="muted">No model has been scored on this task yet.</p>
			{:else}
				<div class="scroll">
					<table>
						<thead>
							<tr>
								<th class="num">Rank</th>
								<th class="sticky">Model</th>
								{#if multipleBenchmarks}
									<th>Benchmark</th>
								{/if}
								<th class="num mean-head">Mean</th>
								{#each subsets as sub (sub)}
									<th class="num sub" title={sub}>{sub}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each scores as s (s.model.name + s.benchmarkName)}
								<tr>
									<td class="num">
										<span class="rank-pill" class:top={s.rank === 1}>#{s.rank}</span>
									</td>
									<td class="sticky">
										<a class="model-link" href="{base}/explorer/models/{slug(s.model.name)}">
											<span class="org">{s.model.org}</span><span class="sl">/</span>{s.model.displayName}
										</a>
									</td>
									{#if multipleBenchmarks}
										<td>
											<a class="bench-cell" href="{base}/explorer/{slug(s.benchmarkName)}">
												{s.benchmarkName}
											</a>
										</td>
									{/if}
									<td class="num mean-cell" style={heat(s.score)}>{fmtPct(s.score)}</td>
									{#each s.subsetScores as v, i (subsets[i])}
										<td class="num sub" style={heat(v)}>{fmtPct(v)}</td>
									{/each}
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
	.hero[data-type='Classification'] {
		--accent: #2740b8;
		background: linear-gradient(180deg, color-mix(in srgb, #e8edff 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='Clustering'] {
		--accent: #c0432e;
		background: linear-gradient(180deg, color-mix(in srgb, #ffe6dc 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='PairClassification'] {
		--accent: #1c7a4c;
		background: linear-gradient(180deg, color-mix(in srgb, #def7e9 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='Reranking'] {
		--accent: #a36100;
		background: linear-gradient(180deg, color-mix(in srgb, #fff1d4 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='Retrieval'] {
		--accent: #6a32b1;
		background: linear-gradient(180deg, color-mix(in srgb, #f2e7ff 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='STS'] {
		--accent: #b41868;
		background: linear-gradient(180deg, color-mix(in srgb, #ffdee9 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='BitextMining'] {
		--accent: #1e6cc3;
		background: linear-gradient(180deg, color-mix(in srgb, #dceefc 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='InstructionReranking'] {
		--accent: #a04500;
		background: linear-gradient(180deg, color-mix(in srgb, #fce4d6 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='MultilabelClassification'] {
		--accent: #2a7d4d;
		background: linear-gradient(180deg, color-mix(in srgb, #e0f5e9 60%, white) 0%, var(--surface) 200px);
	}
	.hero[data-type='Summarization'] {
		--accent: #1c5d7a;
		background: linear-gradient(180deg, color-mix(in srgb, #d8f3fe 60%, white) 0%, var(--surface) 200px);
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
	.type-badge[data-type='Classification'] {
		background: #e8edff;
		color: #2740b8;
	}
	.type-badge[data-type='Clustering'] {
		background: #ffe6dc;
		color: #c0432e;
	}
	.type-badge[data-type='PairClassification'] {
		background: #def7e9;
		color: #1c7a4c;
	}
	.type-badge[data-type='Reranking'] {
		background: #fff1d4;
		color: #a36100;
	}
	.type-badge[data-type='Retrieval'] {
		background: #f2e7ff;
		color: #6a32b1;
	}
	.type-badge[data-type='STS'] {
		background: #ffdee9;
		color: #b41868;
	}
	.type-badge[data-type='BitextMining'] {
		background: #dceefc;
		color: #1e6cc3;
	}
	.type-badge[data-type='InstructionReranking'] {
		background: #fce4d6;
		color: #a04500;
	}
	.type-badge[data-type='MultilabelClassification'] {
		background: #e0f5e9;
		color: #2a7d4d;
	}
	.type-badge[data-type='Summarization'] {
		background: #d8f3fe;
		color: #1c5d7a;
	}
	.badge {
		font-size: 10px;
		padding: 4px 9px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
	}

	.hero h1 {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.01em;
		margin: 0 0 8px;
		word-break: break-word;
	}
	.desc {
		margin: 0 0 14px;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.5;
		max-width: 56ch;
	}
	.dim {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--text-subtle);
		margin-right: 4px;
	}
	.domains,
	.langs,
	.bench-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-bottom: 8px;
	}
	.dom-chip,
	.lang-chip {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text);
		border: 1px solid var(--border);
	}
	.bench-chip {
		display: inline-block;
		padding: 3px 10px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		background: var(--surface);
		color: var(--accent, var(--primary-strong));
		border: 1px solid var(--border);
		text-decoration: none;
	}
	.bench-chip:hover {
		border-color: var(--accent, var(--primary));
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
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
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
	.model-link {
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	.model-link .org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.model-link .sl {
		color: var(--border-strong);
		margin: 0 1px;
		font-weight: 400;
	}
	.model-link:hover {
		color: var(--link);
	}
	.bench-cell {
		color: var(--text-muted);
		text-decoration: none;
	}
	.bench-cell:hover {
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
	thead th.sub {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-subtle);
	}
	tbody td.sub {
		color: var(--text-muted);
	}
	thead th.mean-head {
		color: var(--text);
		font-weight: 700;
		border-right: 1px solid var(--border);
	}
	tbody td.mean-cell {
		font-weight: 700;
		color: var(--text);
		border-right: 1px solid var(--border);
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
