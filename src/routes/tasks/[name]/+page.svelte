<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu, loadTask, loadTaskScores } from '$lib/data/service';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import { sanitizeFilename, type CsvCell } from '$lib/csv';
	import { languageLabel } from '$lib/data/languages';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import ModelScoreTable, { type ModelScore } from '$lib/components/ModelScoreTable.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import { slug } from '$lib/format';
	import {
		isBenchmark,
		type Benchmark,
		type MenuEntry,
		type TaskMeta,
		type TaskScores
	} from '$lib/types';

	let taskName = $derived(decodeURIComponent(page.params.name ?? ''));

	interface TaskWithBenchmark {
		meta: TaskMeta;
		benchmarkName: string;
		benchmarkDisplay: string;
	}

	// Three independent fetches — the card renders as soon as taskMeta and
	// menu land (both sub-ms), while the (potentially slow) scores call
	// streams in behind a skeleton.
	let allBenchmarks = $state<Benchmark[]>([]);
	let taskMeta = $state<TaskMeta | null>(null);
	let metaError = $state<string | null>(null);
	let scoresPayload = $state<TaskScores | null>(null);
	let loadingScores = $state(true);
	let scoresError = $state<string | null>(null);

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
		})();
	});

	// Card metadata: /tasks/{name} — fast endpoint that just returns the
	// TaskMeta. Cleared and re-fetched whenever the URL param changes.
	$effect(() => {
		const name = taskName;
		if (!name) return;
		taskMeta = null;
		metaError = null;
		loadTask(name)
			.then((t) => {
				taskMeta = t;
			})
			.catch((e) => {
				console.error('loadTask', e);
				metaError = e instanceof Error ? e.message : String(e);
			});
	});

	// Scores table: /tasks/{name}/scores — slower (cold builds iterate every
	// per-task result). Lives in its own state with its own loading flag so
	// the card stays visible while we wait.
	$effect(() => {
		const name = taskName;
		if (!name) return;
		scoresPayload = null;
		scoresError = null;
		loadingScores = true;
		loadTaskScores(name)
			.then((s) => {
				scoresPayload = s;
			})
			.catch((e) => {
				console.error('loadTaskScores', e);
				scoresError = e instanceof Error ? e.message : String(e);
			})
			.finally(() => {
				loadingScores = false;
			});
	});

	// Hosting benchmarks come from the menu (cheap) — we don't need the
	// scores payload to render the "In benchmarks: …" strip on the card.
	let benchmarks = $derived.by(() => {
		if (!taskName || allBenchmarks.length === 0) return [];
		return allBenchmarks
			.filter((b) => b.tasks.includes(taskName))
			.map((b) => ({ name: b.name, display: b.displayName }));
	});

	let task = $derived.by<TaskWithBenchmark | null>(() => {
		if (!taskMeta) return null;
		const first = benchmarks[0];
		return {
			meta: taskMeta,
			benchmarkName: first?.name ?? '',
			benchmarkDisplay: first?.display ?? ''
		};
	});

	// Real per-hf_subset scores come straight from /tasks/{name}/scores. For
	// single-subset tasks (most retrieval benchmarks) the list is just one
	// column — we don't try to fabricate extra ones.
	let subsets = $derived<string[]>(scoresPayload?.subsets ?? []);

	let scores = $derived.by<ModelScore[]>(() => {
		if (!scoresPayload) return [];
		return scoresPayload.rows.map((r) => ({
			model: r.model,
			score: r.score,
			rank: r.rank,
			benchmarkName: r.benchmarks[0] ?? '',
			subsetScores: r.subsetScores
		}));
	});

	let multipleBenchmarks = $derived(benchmarks.length > 1);

	function buildCsv() {
		const headers = ['Rank', 'Model', 'Mean scores', ...subsets];
		const pct = (v: number | null | undefined) => (v == null ? null : (v * 100).toFixed(2));
		const rows: CsvCell[][] = scores.map((s) => [
			s.rank,
			s.model.name,
			pct(s.score),
			...subsets.map((sub) => pct(s.subsetScores[sub]))
		]);
		return { headers, rows };
	}
</script>

<div class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={resolve('/')}>Home</a>
		<span class="sep">/</span>
		<a href={resolve('/tasks')}>Tasks</a>
		<span class="sep">/</span>
		<span class="current">{taskName}</span>
	</nav>

	{#if !task && !metaError}
		<p class="muted">Loading task…</p>
	{:else if !task}
		<section class="empty card">
			<h1>Unknown task</h1>
			<p>{metaError ?? `No task named “${taskName}” found.`}</p>
			<a class="back" href={resolve('/tasks')}>← All tasks</a>
		</section>
	{:else}
		<section class="hero card" data-type={task.meta.type}>
			<div class="hero-left">
				<div class="kicker">
					<span class="type-badge" data-type={task.meta.type}>{task.meta.type}</span>
					{#each task.meta.modalities ?? [] as m (m)}
						<span class="badge soft">
							<ModalityIcon modality={m} size={12} />
							<span>{m}</span>
						</span>
					{/each}
				</div>
				<h1>{taskName}</h1>
				<p class="desc"><MarkdownText text={task.meta.description} /></p>
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
						<a class="bench-chip" href={resolve('/benchmark/[name]', { name: slug(b.name) })}
							>{b.display}</a
						>
					{/each}
				</div>
				<dl class="spec-list">
					<div class="row">
						<dt>Reference paper</dt>
						<dd>
							{#if task.meta.reference}
								<!-- External paper URL -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={task.meta.reference} target="_blank" rel="noreferrer">
									{task.meta.reference}
								</a>
							{:else}
								<span class="muted-dd">—</span>
							{/if}
						</dd>
					</div>
					{#if task.meta.sourceDataset}
						<div class="row">
							<dt>Source dataset</dt>
							<dd>
								<a
									href="https://huggingface.co/datasets/{task.meta.sourceDataset}"
									target="_blank"
									rel="noreferrer"
									class="ds-link"
								>
									{task.meta.sourceDataset}
								</a>
							</dd>
						</div>
					{/if}
					{#if task.meta.license}
						<div class="row">
							<dt>License</dt>
							<dd>{task.meta.license}</dd>
						</div>
					{/if}
					{#if task.meta.dateFrom || task.meta.dateTo}
						<div class="row">
							<dt>Dates</dt>
							<dd>
								{task.meta.dateFrom ?? '?'} → {task.meta.dateTo ?? '?'}
							</dd>
						</div>
					{/if}
					{#if task.meta.annotationsCreators}
						<div class="row">
							<dt>
								Annotations
								<button
									type="button"
									class="info-dot"
									aria-label="What does this mean?"
									title="Who produced the labels. `expert-annotated` = domain experts; `human-annotated` = e.g. crowd workers; `derived` = labels extracted from existing structure; `LM-generated` = labels produced by a language model."
									>?</button
								>
							</dt>
							<dd>{task.meta.annotationsCreators}</dd>
						</div>
					{/if}
					{#if task.meta.dialect && task.meta.dialect.length > 0}
						<div class="row">
							<dt>Dialect</dt>
							<dd>
								<span class="chips">
									{#each task.meta.dialect as d (d)}
										<span class="chip">{d}</span>
									{/each}
								</span>
							</dd>
						</div>
					{/if}
					{#if task.meta.sampleCreation}
						<div class="row">
							<dt>
								Sample creation
								<button
									type="button"
									class="info-dot"
									aria-label="What does this mean?"
									title="How the text samples were produced. `found` = harvested from existing sources; `created` = written specifically for the dataset; `machine-translated` = automatically translated (optionally `and verified` by humans); `LM-generated` = synthesised by a model."
									>?</button
								>
							</dt>
							<dd>{task.meta.sampleCreation}</dd>
						</div>
					{/if}
				</dl>
				<CiteBlock kind="task" citation={task.meta.citation} />
			</div>
			<div class="kpis">
				<div class="kpi">
					<span class="kpi-label">Models scored</span>
					<span class="kpi-value">
						{#if loadingScores}<span class="loading-dot" aria-label="Loading">…</span
							>{:else}{scores.length}{/if}
					</span>
				</div>
			</div>
		</section>

		{#if task.meta.isPublic !== false && task.meta.sourceDataset}
			<!-- Embedded HuggingFace dataset viewer in a collapsible section
			     so the (heavy) iframe doesn't push the scores below the
			     fold for users who only came to see the leaderboard.
			     Closed by default; `loading="lazy"` further defers the
			     embed fetch until the section is opened and scrolled into
			     view. Only shown for public datasets — RTEB private
			     hold-outs and similar are skipped so we don't surface a
			     404'ing iframe. -->
			<details class="dataset-preview">
				<summary>
					<span class="preview-title">Dataset preview</span>
					<span class="preview-source">{task.meta.sourceDataset}</span>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a
						class="ext-link"
						href="https://huggingface.co/datasets/{task.meta.sourceDataset}"
						target="_blank"
						rel="noreferrer"
						onclick={(e) => e.stopPropagation()}
					>
						Open on HuggingFace →
					</a>
				</summary>
				<iframe
					src="https://huggingface.co/datasets/{task.meta.sourceDataset}/embed/viewer/default/test"
					title="HuggingFace dataset viewer for {task.meta.sourceDataset}"
					loading="lazy"
					frameborder="0"
					width="100%"
					height="560"
				></iframe>
			</details>
		{/if}

		<section class="scores">
			<header class="scores-head">
				<h2>Model scores</h2>
				<span class="muted">
					{#if loadingScores}Loading…
					{:else}{scores.length} {scores.length === 1 ? 'entry' : 'entries'}{/if}
				</span>
				{#if scores.length > 0}
					<DownloadButton filename="{sanitizeFilename(taskName)}_models" build={buildCsv} />
				{/if}
			</header>
			{#if loadingScores}
				<p class="muted">Fetching scores — this can take a few seconds on cold cache…</p>
			{:else if scoresError}
				<p class="muted">Failed to load scores: {scoresError}</p>
			{:else if scores.length === 0}
				<p class="muted">No model has been scored on this task yet.</p>
			{:else}
				<ModelScoreTable rows={scores} {subsets} />
			{/if}
		</section>
	{/if}
</div>

<ShareUrlButton />

<style>
	/* `.page` (1280 px centred, 18/28/56 padding) and `.breadcrumb`
	   family live in src/app.css. */

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgb(15, 23, 42, 0.04);
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
	/* Hero gradient pulls its tint from the shared --tint-* palette so the
	   dark-mode variants drop in automatically — no more white→dark wash. */
	.hero[data-type='Classification'] {
		--accent: var(--tint-blue-fg);
		--hero-tint: var(--tint-blue);
	}
	.hero[data-type='Clustering'] {
		--accent: var(--tint-orange-fg);
		--hero-tint: var(--tint-orange);
	}
	.hero[data-type='PairClassification'],
	.hero[data-type='MultilabelClassification'] {
		--accent: var(--tint-green-fg);
		--hero-tint: var(--tint-green);
	}
	.hero[data-type='Reranking'] {
		--accent: var(--tint-amber-fg);
		--hero-tint: var(--tint-amber);
	}
	.hero[data-type='Retrieval'] {
		--accent: var(--tint-purple-fg);
		--hero-tint: var(--tint-purple);
	}
	.hero[data-type='STS'] {
		--accent: var(--tint-pink-fg);
		--hero-tint: var(--tint-pink);
	}
	.hero[data-type='BitextMining'] {
		--accent: var(--tint-azure-fg);
		--hero-tint: var(--tint-azure);
	}
	.hero[data-type='InstructionReranking'] {
		--accent: var(--tint-orange-fg);
		--hero-tint: var(--tint-orange);
	}
	.hero[data-type='Summarization'] {
		--accent: var(--tint-teal-fg);
		--hero-tint: var(--tint-teal);
	}
	.hero[data-type] {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--hero-tint) 55%, var(--surface)) 0%,
			var(--surface) 200px
		);
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
		background: var(--tint-blue);
		color: var(--tint-blue-fg);
	}
	.type-badge[data-type='Clustering'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
	}
	.type-badge[data-type='PairClassification'],
	.type-badge[data-type='MultilabelClassification'] {
		background: var(--tint-green);
		color: var(--tint-green-fg);
	}
	.type-badge[data-type='Reranking'] {
		background: var(--tint-amber);
		color: var(--tint-amber-fg);
	}
	.type-badge[data-type='Retrieval'] {
		background: var(--tint-purple);
		color: var(--tint-purple-fg);
	}
	.type-badge[data-type='STS'] {
		background: var(--tint-pink);
		color: var(--tint-pink-fg);
	}
	.type-badge[data-type='BitextMining'] {
		background: var(--tint-azure);
		color: var(--tint-azure-fg);
	}
	.type-badge[data-type='InstructionReranking'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
	}
	.type-badge[data-type='Summarization'] {
		background: var(--tint-teal);
		color: var(--tint-teal-fg);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
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
	.hero-left :global(.cite) {
		margin-top: 10px;
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

	/* Dataset spec — definition list rendered inline in the hero card. */
	.spec-list {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		row-gap: 6px;
		column-gap: 14px;
		margin: 12px 0 0;
	}
	.spec-list .row {
		display: contents;
	}
	.spec-list dt {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-subtle);
		letter-spacing: 0.02em;
		padding-top: 3px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.spec-list dd {
		font-size: 13px;
		color: var(--text);
		margin: 0;
		min-width: 0;
		word-break: break-word;
	}
	.spec-list dd a {
		color: var(--link);
	}
	.spec-list .muted-dd {
		color: var(--text-subtle);
	}
	.spec-list .ds-link {
		font-family: var(--font-mono);
		font-size: 12.5px;
	}
	.spec-list .chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.spec-list .chip {
		font-family: var(--font-mono);
		font-size: 11.5px;
		padding: 2px 8px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
	}
	/* Tiny inline (?) hint button that surfaces the explanation via the
	   browser-native title tooltip — universal support, no JS / portals. */
	.info-dot {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		font-size: 9px;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--text-subtle);
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 50%;
		cursor: help;
	}
	.info-dot:hover,
	.info-dot:focus-visible {
		color: var(--ink-strong, var(--text));
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 30%, transparent);
	}
	@media (max-width: 720px) {
		.spec-list {
			grid-template-columns: 1fr;
			row-gap: 12px;
		}
		.spec-list dt {
			padding-top: 0;
		}
	}

	/* Scores section ------------------------------------------------------- */
	/* Collapsible HF dataset viewer. Closed state = single pill-ish
	   summary; open state reveals the iframe. The custom chevron sits
	   in front of the title and rotates on `[open]`, replacing the
	   native disclosure marker. */
	.dataset-preview {
		margin-top: 18px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}
	.dataset-preview > summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		cursor: pointer;
		list-style: none;
		user-select: none;
		font-size: 14px;
	}
	.dataset-preview > summary::-webkit-details-marker {
		display: none;
	}
	.dataset-preview > summary::before {
		content: '';
		width: 0;
		height: 0;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-left: 6px solid var(--text-muted);
		transition: transform 0.16s cubic-bezier(0.6, 0.1, 0.2, 1);
		transform-origin: 25% 50%;
	}
	.dataset-preview[open] > summary::before {
		transform: rotate(90deg);
	}
	.dataset-preview > summary:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
		border-radius: 12px;
	}
	.preview-title {
		font-weight: 700;
		color: var(--ink-strong);
	}
	.preview-source {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ext-link {
		font-size: 12px;
		font-weight: 600;
		color: var(--link);
		text-decoration: none;
	}
	.ext-link:hover {
		text-decoration: underline;
	}
	.dataset-preview iframe {
		display: block;
		border: 0;
		border-top: 1px solid var(--border);
	}

	.scores {
		margin-top: 24px;
	}
	.scores-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}
	.scores-head .muted {
		flex: 1;
	}
	.scores h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		font-size: 13px;
	}
	.loading-dot {
		display: inline-block;
		min-width: 28px;
		color: var(--text-subtle);
		letter-spacing: 0.1em;
		font-weight: 500;
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
