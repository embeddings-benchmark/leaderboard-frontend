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
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import { slug, sortModalities } from '$lib/format';
	import { clampTooltipX } from '$lib/cell-hover';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import SkeletonTable from '$lib/components/SkeletonTable.svelte';
	import { flattenMenu, type Benchmark, type TaskMeta, type TaskScores } from '$lib/types';

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
			allBenchmarks = flattenMenu(menu);
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
	// Pre-index task membership so we don't re-scan every benchmark's tasks
	// array (~100 benchmarks × ~100 tasks worth of compares on every nav).
	let benchTasksSets = $derived(allBenchmarks.map((b) => new Set(b.tasks)));
	let benchmarks = $derived.by(() => {
		if (!taskName || allBenchmarks.length === 0) return [];
		const out: { name: string; display: string }[] = [];
		for (let i = 0; i < allBenchmarks.length; i++) {
			if (benchTasksSets[i].has(taskName)) {
				const b = allBenchmarks[i];
				out.push({ name: b.name, display: b.displayName });
			}
		}
		return out;
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

	// Real per-hf_subset scores come straight from /tasks/{name}/scores.
	// For single-subset tasks (most retrieval benchmarks) the per-subset
	// breakdown adds nothing — the Mean column already shows the value.
	// Drop the subset list when there's only one (regardless of whether
	// it's the literal `default` name or some other singleton) so the
	// table renders without the redundant subset column.
	let subsets = $derived<string[]>(
		(scoresPayload?.subsets ?? []).length > 1 ? (scoresPayload?.subsets ?? []) : []
	);

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

	// Instant tooltip for the `info-dot` (?) buttons in the spec list.
	// Same fixed-portal pattern as SummaryTable's column tips and
	// PerTaskTab's trained-on warnings — appears the moment the cursor
	// enters, no browser `title` delay, no CSS transition. Hides on a
	// 200 ms debounce that the tip's own pointerenter cancels.
	//
	// Each info-dot keys into ``INFO_TIPS`` via ``data-tip-key`` rather
	// than carrying a free-form text blob. That lets us render the tip
	// body as a real definition list (with bolded terms) instead of
	// the previous prose-with-backticks string.
	type InfoTip = {
		title: string;
		items: ReadonlyArray<readonly [term: string, definition: string]>;
	};
	const INFO_TIPS: Record<string, InfoTip> = {
		annotations: {
			title: 'Who produced the labels',
			items: [
				['expert-annotated', 'domain experts'],
				['human-annotated', 'e.g. crowd workers'],
				['derived', 'labels extracted from existing structure'],
				['LM-generated', 'labels produced by a language model']
			]
		},
		'sample-creation': {
			title: 'How the text samples were produced',
			items: [
				['found', 'harvested from existing sources'],
				['created', 'written specifically for the dataset'],
				['machine-translated', 'automatically translated (optionally “and verified” by humans)'],
				['LM-generated', 'synthesised by a model']
			]
		}
	};

	const INFO_TIP_MAX_WIDTH = 360;
	type InfoTipState = { visible: boolean; tip: InfoTip | null; x: number; y: number };
	let infoTip = $state<InfoTipState>({ visible: false, tip: null, x: 0, y: 0 });
	let infoTipHideTimer: ReturnType<typeof setTimeout> | null = null;
	const clampInfoX = (x: number) => clampTooltipX(x, INFO_TIP_MAX_WIDTH);
	function cancelInfoTipHide() {
		if (infoTipHideTimer !== null) {
			clearTimeout(infoTipHideTimer);
			infoTipHideTimer = null;
		}
	}
	function showInfoTip(e: PointerEvent | FocusEvent) {
		cancelInfoTipHide();
		const el = e.currentTarget as HTMLElement;
		const tip = INFO_TIPS[el.dataset.tipKey ?? ''] ?? null;
		if (!tip) return;
		const r = el.getBoundingClientRect();
		infoTip = {
			visible: true,
			tip,
			x: clampInfoX(r.left + r.width / 2),
			y: r.bottom
		};
	}
	function hideInfoTip() {
		cancelInfoTipHide();
		infoTipHideTimer = setTimeout(() => {
			infoTip = { ...infoTip, visible: false };
			infoTipHideTimer = null;
		}, 200);
	}

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

<ShareMeta
	title={taskName}
	description={task?.meta?.description
		? `${task.meta.type} task · ${task.meta.languages.length} languages · ${task.meta.domains.length} domains — ${task.meta.description}`
		: `${taskName} on the MTEB Leaderboard.`}
	entity={{ kind: 'task', name: taskName }}
/>

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
		<section class="hero card" data-stype={task.meta.simplifiedType}>
			<div class="hero-left">
				<div class="kicker">
					<!-- Hero badge mirrors the task-group chip on the index card:
					     simplified type name (e.g. "retrieval") with the matching
					     per-group tint. The raw `type` value lives in the
					     spec-list row below. -->
					<span class="type-badge" data-stype={task.meta.simplifiedType}>
						{task.meta.simplifiedType || task.meta.type}
					</span>
					{#each sortModalities(task.meta.modalities) as m (m)}
						<span class="badge modality-tint" data-modality={m} title={m}>
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
					{#if task.meta.type}
						<div class="row">
							<dt>Task type</dt>
							<dd>{task.meta.type}</dd>
						</div>
					{/if}
					{#if task.meta.mainScore}
						<div class="row">
							<dt>Main metric</dt>
							<dd><code>{task.meta.mainScore}</code></dd>
						</div>
					{/if}
					<div class="row">
						<dt>Reference</dt>
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
									data-tip-key="annotations"
									onpointerenter={showInfoTip}
									onpointerleave={hideInfoTip}
									onfocusin={showInfoTip}
									onfocusout={hideInfoTip}>?</button
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
									data-tip-key="sample-creation"
									onpointerenter={showInfoTip}
									onpointerleave={hideInfoTip}
									onfocusin={showInfoTip}
									onfocusout={hideInfoTip}>?</button
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
				<SkeletonTable rows={8} cols={6} />
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

{#if infoTip.visible && infoTip.tip}
	<div
		class="info-tip"
		role="tooltip"
		style:left="{infoTip.x}px"
		style:top="{infoTip.y}px"
		onpointerenter={cancelInfoTipHide}
		onpointerleave={hideInfoTip}
	>
		<p class="info-tip-title">{infoTip.tip.title}</p>
		<dl class="info-tip-list">
			{#each infoTip.tip.items as [term, defn] (term)}
				<dt><code>{term}</code></dt>
				<dd>{defn}</dd>
			{/each}
		</dl>
	</div>
{/if}

<ScrollToTopButton />
<ShareUrlButton />

<style>
	/* `.page` (1280 px centred, 18/28/56 padding) and `.breadcrumb`
	   family live in src/app.css. */

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgb(var(--shadow-tint) / 0.04);
	}

	/* Hero ----------------------------------------------------------------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 28px;
		padding: 26px 28px 26px 32px;
		margin-bottom: 18px;
		position: relative;
		overflow: hidden;
	}
	/* Left-edge accent strip — mapping mirrors the group-chip palette. */
	.hero::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 3px;
		background: var(--accent, var(--border));
	}
	.hero[data-stype='classification'] {
		--accent: var(--tint-blue-fg);
	}
	.hero[data-stype='clustering'] {
		--accent: var(--tint-orange-fg);
	}
	.hero[data-stype='pair-classification'] {
		--accent: var(--tint-green-fg);
	}
	.hero[data-stype='reranking'] {
		--accent: var(--tint-amber-fg);
	}
	.hero[data-stype='retrieval'] {
		--accent: var(--tint-purple-fg);
	}
	.hero[data-stype='semantic-similarity'] {
		--accent: var(--tint-pink-fg);
	}
	.hero[data-stype='bitext-mining'] {
		--accent: var(--tint-azure-fg);
	}
	.hero[data-stype='instruction-reranking'] {
		--accent: var(--tint-orange-fg);
	}
	.hero[data-stype='summarization'] {
		--accent: var(--tint-teal-fg);
	}
	@media (max-width: 640px) {
		.hero {
			padding: 18px 16px;
			gap: 16px;
			margin-bottom: 12px;
		}
		.kpis {
			gap: 8px;
		}
		.kpi {
			padding: 8px 10px;
		}
		.kpi-value {
			font-size: 17px;
		}
		.spec-list {
			grid-template-columns: 110px minmax(0, 1fr);
			column-gap: 12px;
			row-gap: 8px;
		}
		.spec-list .chip {
			overflow-wrap: anywhere;
		}
		.spec-list dd {
			overflow-wrap: anywhere;
		}
	}
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
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
		/* `currentColor` is the per-stype foreground tint set below, so
		   one rule covers every variant — no need to repeat per-stype. */
		border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
	}
	/* Per-task-group tints, matching the TaskCard `.group-chip` mapping
	   and the parent card's `data-stype` accent. */
	.type-badge[data-stype='classification'] {
		background: var(--tint-blue);
		color: var(--tint-blue-fg);
	}
	.type-badge[data-stype='clustering'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
	}
	.type-badge[data-stype='pair-classification'] {
		background: var(--tint-green);
		color: var(--tint-green-fg);
	}
	.type-badge[data-stype='reranking'] {
		background: var(--tint-amber);
		color: var(--tint-amber-fg);
	}
	.type-badge[data-stype='retrieval'] {
		background: var(--tint-purple);
		color: var(--tint-purple-fg);
	}
	.type-badge[data-stype='semantic-similarity'] {
		background: var(--tint-pink);
		color: var(--tint-pink-fg);
	}
	.type-badge[data-stype='bitext-mining'] {
		background: var(--tint-azure);
		color: var(--tint-azure-fg);
	}
	.type-badge[data-stype='instruction-reranking'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
	}
	.type-badge[data-stype='summarization'] {
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
		/* Modality badges set their colour via `.modality-tint`, so the
		   currentColor border picks up that same tint automatically. */
		border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
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
	/* Tiny inline (?) hint button. Hover surfaces the explanation in
	   the fixed-positioned `.info-tip` portal below — same pattern as
	   SummaryTable's column tips, so the bubble appears instantly
	   without the browser-native `title` attribute's ~700 ms delay. */
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
	/* Portal tip body — fixed position so it escapes any ancestor
	   overflow / stacking context. Pointer-events: auto + the
	   matching `cancelInfoTipHide` on enter lets the user mouse onto
	   the bubble (e.g. to select text) without it vanishing. Body is
	   structured as a definition list: each row is a `<code>` term
	   followed by its plain-prose explanation. */
	.info-tip {
		position: fixed;
		transform: translate(-50%, 6px);
		max-width: 360px;
		padding: 10px 14px;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.45;
		color: var(--tip-fg);
		background: var(--tip-bg);
		border-radius: 6px;
		box-shadow: 0 8px 18px rgb(var(--shadow-tint) / 0.22);
		text-align: left;
		white-space: normal;
		z-index: 1000;
		pointer-events: auto;
	}
	.info-tip-title {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--primary);
	}
	/* Two-column grid: term pills (sized to their longest content) on
	   the left, definitions filling the remaining track on the right.
	   Definitions wrap inside their own column, so a long entry like
	   "machine-translated …" can flow over several lines without
	   pushing the term to a separate row above it. */
	.info-tip-list {
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: 10px;
		row-gap: 6px;
		margin: 0;
		padding: 0;
	}
	.info-tip-list dt {
		margin: 0;
	}
	.info-tip-list dt code {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 1px 6px;
		background: rgb(255, 255, 255, 0.08);
		border-radius: 4px;
		color: var(--tip-fg);
		white-space: nowrap;
	}
	.info-tip-list dd {
		margin: 0;
		min-width: 0;
		color: #c4cad2;
		overflow-wrap: anywhere;
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
