<script lang="ts">
	import { resolve } from '$app/paths';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import { sanitizeFilename, type CsvCell } from '$lib/csv';
	import { loadTaskDescriptiveStats, loadTaskScores } from '$lib/data/service';
	import { languageLabel } from '$lib/data/languages';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import DescriptiveStatsSection from '$lib/components/DescriptiveStatsSection.svelte';
	import InfoDot from '$lib/components/InfoDot.svelte';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import ModelScoreTable, { type ModelScore } from '$lib/components/ModelScoreTable.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import { slug, sortModalities } from '$lib/format';
	import { clampTooltipX } from '$lib/cell-hover';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import SkeletonTable from '$lib/components/SkeletonTable.svelte';
	import type { TaskDescriptiveStats, TaskMeta, TaskScores } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface TaskWithBenchmark {
		meta: TaskMeta;
		benchmarkName: string;
		benchmarkDisplay: string;
	}

	let taskName = $derived(data.taskName);
	let allBenchmarks = $derived(data.allBenchmarks);
	let taskMeta = $derived(data.taskMeta);

	// Scores aren't in the loader — fetched client-side here so prerender
	// only awaits the hero metadata. Stale-guard via `taskName === name`
	// on rapid task→task nav.
	let scoresPayload = $state<TaskScores | null>(null);
	let loadingScores = $state(true);
	let scoresError = $state<string | null>(null);
	$effect(() => {
		const name = taskName;
		scoresPayload = null;
		scoresError = null;
		loadingScores = true;
		loadTaskScores(name).then(
			(s) => {
				if (taskName !== name) return;
				scoresPayload = s;
				loadingScores = false;
			},
			(e) => {
				if (taskName !== name) return;
				scoresError = e instanceof Error ? e.message : String(e);
				loadingScores = false;
			}
		);
	});

	// Descriptive stats live behind a separate endpoint — same client-side
	// fetch pattern as scores so prerender doesn't pay for them. Failures
	// silently hide the section (vs. blocking the page) since stats are
	// supplementary metadata.
	let descriptiveStats = $state.raw<TaskDescriptiveStats | null>(null);
	let loadingStats = $state(true);
	$effect(() => {
		const name = taskName;
		descriptiveStats = null;
		loadingStats = true;
		loadTaskDescriptiveStats(name).then(
			(s) => {
				if (taskName !== name) return;
				descriptiveStats = s;
				loadingStats = false;
			},
			() => {
				if (taskName !== name) return;
				loadingStats = false;
			}
		);
	});
	let hasStats = $derived(descriptiveStats != null && Object.keys(descriptiveStats).length > 0);

	// Pre-index task membership for the "In benchmarks: …" strip.
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

	// Loader guarantees `taskMeta` (a miss throws error(404)).
	let task = $derived.by<TaskWithBenchmark>(() => {
		const first = benchmarks[0];
		return {
			meta: taskMeta,
			benchmarkName: first?.name ?? '',
			benchmarkDisplay: first?.display ?? ''
		};
	});

	// Single-subset tasks: the Mean column already shows the only value.
	let subsets = $derived<string[]>(
		(scoresPayload?.subsets ?? []).length > 1 ? (scoresPayload?.subsets ?? []) : []
	);

	type SplitMode = 'all' | (string & {});
	let availableSplits = $derived(scoresPayload?.splits ?? []);
	let splitMode = $state<SplitMode>('all');
	$effect(() => {
		void taskName;
		splitMode = 'all';
	});
	// Picker only renders for multi-split tasks; single-split tasks pin "all".
	let splitOptions = $derived(
		availableSplits.length > 1
			? [
					{ label: 'All splits', value: 'all' as SplitMode },
					...availableSplits.map((s) => ({ label: s, value: s as SplitMode }))
				]
			: []
	);

	// "all" mode: per-cell mean across every split the task offers; any missing
	// split nulls the cell so partial-coverage models aren't ranked against
	// fully-evaluated ones. Specific split: literal cell value, or undefined.
	function projectSubsetScores(
		nested: Record<string, Record<string, number>>,
		mode: SplitMode,
		allSplits: readonly string[]
	): Record<string, number> {
		const out: Record<string, number> = {};
		for (const [sub, perSplit] of Object.entries(nested)) {
			if (mode === 'all') {
				let sum = 0;
				let complete = true;
				for (const sp of allSplits) {
					const v = perSplit[sp];
					if (v === undefined) {
						complete = false;
						break;
					}
					sum += v;
				}
				if (complete && allSplits.length > 0) out[sub] = sum / allSplits.length;
			} else if (perSplit[mode] !== undefined) {
				out[sub] = perSplit[mode];
			}
		}
		return out;
	}

	let scores = $derived.by<ModelScore[]>(() => {
		if (!scoresPayload) return [];
		const subsetList = scoresPayload.subsets;
		const splitList = scoresPayload.splits;
		const projected = scoresPayload.rows.map((r) => {
			const flat = projectSubsetScores(r.subsetScores, splitMode, splitList);
			// Mean over subsets; null on any missing subset cell.
			let score: number | null = null;
			let sum = 0;
			let n = 0;
			let complete = true;
			for (const sub of subsetList) {
				const v = flat[sub];
				if (v === undefined) {
					complete = false;
					break;
				}
				sum += v;
				n++;
			}
			if (complete && n > 0) score = sum / n;
			return {
				model: r.model,
				score,
				benchmarkName: r.benchmarks[0] ?? '',
				subsetScores: flat,
				trainedOn: r.trainedOn
			};
		});
		// Re-rank per mode — the API's rank reflects its own rollup, not what
		// the user sees once a split is picked.
		const sorted = [...projected].sort((a, b) => {
			if (a.score === null && b.score === null) return a.model.name.localeCompare(b.model.name);
			if (a.score === null) return 1;
			if (b.score === null) return -1;
			if (a.score === b.score) return a.model.name.localeCompare(b.model.name);
			return b.score - a.score;
		});
		return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
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
	description={task.meta.description
		? `${task.meta.type} task · ${task.meta.languages.length} languages · ${task.meta.domains.length} domains — ${task.meta.description}`
		: `${taskName} on the MTEB Leaderboard.`}
	entity={{ kind: 'task', name: taskName }}
/>

<main id="main-content" tabindex="-1" class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={resolve('/')}>Home</a>
		<span class="sep">/</span>
		<a href={resolve('/tasks')}>Tasks</a>
		<span class="sep">/</span>
		<span class="current">{taskName}</span>
	</nav>

	<section class="hero panel hero-grid" data-stype={task.meta.simplifiedType}>
		<div class="hero-left">
			<div class="kicker">
				<!-- Hero badge mirrors the task-group chip on the index card:
					     simplified type name (e.g. "retrieval") with the matching
					     per-group tint. The raw `type` value lives in the
					     spec-list row below. -->
				<span class="category-badge" data-stype={task.meta.simplifiedType}>
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
					<span class="eyebrow dim">Domains:</span>
					{#each task.meta.domains as d (d)}
						<span class="chip-neutral">{d}</span>
					{/each}
				</div>
			{/if}
			{#if task.meta.languages.length > 0}
				<div class="langs">
					<span class="eyebrow dim">Languages:</span>
					{#each task.meta.languages as l (l)}
						<span class="chip-neutral" title={l}>{languageLabel(l)}</span>
					{/each}
				</div>
			{/if}
			<div class="bench-links">
				<span class="eyebrow dim">In benchmark{multipleBenchmarks ? 's' : ''}:</span>
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
							<InfoDot
								as="button"
								ariaLabel="What does this mean?"
								tipKey="annotations"
								onPointerEnter={showInfoTip}
								onPointerLeave={hideInfoTip}
								onFocusIn={showInfoTip}
								onFocusOut={hideInfoTip}
							/>
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
							<InfoDot
								as="button"
								ariaLabel="What does this mean?"
								tipKey="sample-creation"
								onPointerEnter={showInfoTip}
								onPointerLeave={hideInfoTip}
								onFocusIn={showInfoTip}
								onFocusOut={hideInfoTip}
							/>
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
		<details class="dataset-preview details-flat">
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

	{#if !loadingStats && hasStats && descriptiveStats}
		<DescriptiveStatsSection stats={descriptiveStats} />
	{/if}

	<section class="scores">
		<header class="scores-head">
			<h2>Model scores</h2>
			<span class="muted">
				{#if loadingScores}Loading…
				{:else}{scores.length} {scores.length === 1 ? 'entry' : 'entries'}{/if}
			</span>
			{#if splitOptions.length > 0}
				<div class="split-picker">
					<span class="picker-label">Split</span>
					<Segmented
						ariaLabel="Split"
						options={splitOptions}
						value={splitMode}
						onChange={(v) => (splitMode = v)}
					/>
				</div>
			{/if}
			{#if scores.length > 0}
				<DownloadButton
					filename="{sanitizeFilename(taskName)}_models{splitMode === 'all'
						? ''
						: '_' + sanitizeFilename(splitMode)}"
					build={buildCsv}
				/>
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
</main>

{#if infoTip.visible && infoTip.tip}
	<div
		class="info-tip tip-portal tip-portal-interactive"
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
	/* Left-edge accent strip — `data-stype` resolves
	   `--category-tint-fg` via the global mapping in app.css. */
	.hero::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 3px;
		background: var(--category-tint-fg, var(--border));
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
	.bench-chip {
		display: inline-block;
		padding: 3px 10px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		background: var(--surface);
		color: var(--category-tint-fg, var(--primary-strong));
		border: 1px solid var(--border);
		text-decoration: none;
	}
	.bench-chip:hover {
		border-color: var(--category-tint-fg, var(--primary));
	}

	/* `<dt>` wraps a label + inline (?) info-dot, so align them on a
	   baseline. */
	.spec-list dt {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.spec-list .ds-link {
		font-family: var(--font-mono);
		font-size: 12.5px;
	}
	/* Tip bubbles appear instantly without the browser-native `title`
	   attribute's ~700 ms delay. */
	/* Portal tip body — fixed position so it escapes any ancestor
	   overflow / stacking context. Pointer-events: auto + the
	   matching `cancelInfoTipHide` on enter lets the user mouse onto
	   the bubble (e.g. to select text) without it vanishing. Body is
	   structured as a definition list: each row is a `<code>` term
	   followed by its plain-prose explanation. */
	.info-tip {
		padding: 10px 14px;
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
		background: color-mix(in srgb, var(--tip-fg) 10%, transparent);
		border-radius: 4px;
		color: var(--tip-fg);
		white-space: nowrap;
	}
	.info-tip-list dd {
		margin: 0;
		min-width: 0;
		color: var(--tip-label);
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
		user-select: none;
		font-size: 14px;
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
	/* Split picker sits between the entry count and the download button,
	   only renders for tasks with >1 eval split (most tasks: just "test"). */
	.split-picker {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.picker-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
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
</style>
