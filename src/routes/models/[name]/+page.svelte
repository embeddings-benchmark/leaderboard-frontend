<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { loadModel, loadModelScores, loadTasks } from '$lib/data/service';
	import type { ModelMeta, ModelScores } from '$lib/types';
	import BenchScoreTable, { type BenchScore } from '$lib/components/BenchScoreTable.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ModelTypeIcon from '$lib/components/ModelTypeIcon.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import { sanitizeFilename, type CsvCell } from '$lib/csv';
	import { fmtInt, fmtParamsUnit, fmtParamsValue, slug } from '$lib/format';

	let modelName = $derived(decodeURIComponent(page.params.name ?? ''));

	// Card metadata loads on its own — fast (single MODEL_REGISTRY lookup).
	// Scores load separately because they walk every benchmark summary, which
	// can take minutes when the per-benchmark caches are cold.
	let model = $state<ModelMeta | null>(null);
	let metaError = $state<string | null>(null);
	let payload = $state<ModelScores | null>(null);
	let loadingScores = $state(true);
	let scoresError = $state<string | null>(null);

	$effect(() => {
		const name = modelName;
		if (!name) return;
		model = null;
		metaError = null;
		loadModel(name)
			.then((m) => {
				model = m;
			})
			.catch((e) => {
				console.error('loadModel', e);
				metaError = e instanceof Error ? e.message : String(e);
			});
	});

	$effect(() => {
		const name = modelName;
		if (!name) return;
		payload = null;
		scoresError = null;
		loadingScores = true;
		loadModelScores(name)
			.then((p) => {
				payload = p;
				// Score payload also includes the freshest model meta — keep it
				// in sync so the card reflects any zero-shot %, etc. that needs
				// summary context.
				if (p?.model) model = p.model;
			})
			.catch((e) => {
				console.error('loadModelScores', e);
				scoresError = e instanceof Error ? e.message : String(e);
			})
			.finally(() => {
				loadingScores = false;
			});
	});

	let rawRows = $derived.by<BenchScore[]>(() => {
		if (!payload) return [];
		return payload.rows.map((r) => ({
			benchmarkName: r.benchmarkName,
			benchmarkDisplay: r.benchmarkDisplayName,
			rank: r.rank,
			meanTask: r.meanTask,
			meanTaskType: r.meanTaskType,
			zeroShotPct: r.zeroShotPct,
			totalModels: r.totalModels
		}));
	});

	// `bestBenchmark` keeps the API's rank-1 entry regardless of user-applied
	// sort. No longer surfaced as a KPI, but still drives the default
	// benchmark for the "Compare with another model" link.
	let bestBenchmark = $derived(rawRows[0] ?? null);

	// Which trainingDatasets entries map onto real mteb tasks (so we can
	// render them as links rather than plain chips). Fetched lazily once per
	// session — the /tasks endpoint is large; we only pay for it if this
	// model actually has training_datasets set.
	let mtebTaskNames = $state<Set<string>>(new Set());
	$effect(() => {
		const ds = model?.trainingDatasets;
		if (!ds || ds.length === 0 || mtebTaskNames.size > 0) return;
		loadTasks()
			.then((tasks) => {
				mtebTaskNames = new Set(tasks.map((t) => t.name));
			})
			.catch(() => {
				/* leave empty — chips render as plain text on failure */
			});
	});

	function fmtMemoryMb(mb: number | null | undefined): string {
		if (mb == null || mb <= 0) return '—';
		// Use GB once we cross 1024 MB so the number stays short.
		if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
		return `${Math.round(mb)} MB`;
	}
	function compareHref(modelName: string, seed: BenchScore | null): string {
		// Local URL builder, not held by $state — plain URLSearchParams is correct.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams({ model: modelName });
		if (seed) params.set('benchmark', seed.benchmarkName);
		return `${resolve('/compare')}?${params.toString()}`;
	}
	function buildCsv() {
		const headers = [
			'Benchmark',
			'Rank',
			'Total Models',
			'Mean (Task)',
			'Mean (TaskType)',
			'Zero-shot'
		];
		const pct = (v: number | null | undefined) => (v == null ? null : (v * 100).toFixed(2));
		const rows: CsvCell[][] = rawRows.map((s) => [
			s.benchmarkName,
			s.rank,
			s.totalModels,
			pct(s.meanTask),
			pct(s.meanTaskType),
			s.zeroShotPct === -1 ? 'NA' : s.zeroShotPct
		]);
		return { headers, rows };
	}
</script>

<div class="page">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={resolve('/')}>Home</a>
		<span class="sep">/</span>
		<a href={resolve('/models')}>Models</a>
		<span class="sep">/</span>
		<span class="current">{model?.displayName ?? modelName}</span>
	</nav>

	{#if !model && !metaError}
		<p class="muted">Loading model…</p>
	{:else if !model}
		<section class="empty card">
			<h1>Unknown model</h1>
			<p>{metaError ?? `No model named “${modelName}” found.`}</p>
			<a class="back" href={resolve('/models')}>← All models</a>
		</section>
	{:else}
		<section class="hero card" data-type={model.modelType}>
			<div class="hero-left">
				<div class="kicker">
					<span class="type-badge" data-type={model.modelType}>
						<ModelTypeIcon type={model.modelType} size={12} />
						<span>{model.modelType}</span>
					</span>
					<span class="badge" class:open={model.openWeights}>
						{model.openWeights ? 'Open weights' : 'Proprietary'}
					</span>
					{#if model.instructionTuned}
						<span class="badge soft">Instruction-tuned</span>
					{/if}
					{#if model.sentenceTransformersCompatible}
						<span class="badge soft">ST compatible</span>
					{/if}
					{#each model.modalities ?? [] as mod (mod)}
						<span class="badge modality-tint" data-modality={mod} title={mod}>
							<ModalityIcon modality={mod} size={12} />
							<span>{mod}</span>
						</span>
					{/each}
				</div>
				<h1>
					<span class="org">{model.org}</span><span class="sl">/</span>{model.displayName}
				</h1>
				<div class="links">
					<!-- href returned by compareHref(), which uses resolve('/compare') internally -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="ref muted" href={compareHref(model.name, bestBenchmark)}>
						Compare with another model →
					</a>
				</div>
				<dl class="spec-list">
					<div class="row">
						<dt>Model page</dt>
						<dd>
							{#if model.url}
								<!-- External model URL (HuggingFace etc.) -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={model.url} target="_blank" rel="noreferrer">{model.url}</a>
							{:else}
								<span class="muted-dd">—</span>
							{/if}
						</dd>
					</div>
					{#if model.license}
						<div class="row">
							<dt>License</dt>
							<dd>{model.license}</dd>
						</div>
					{/if}
					{#if model.publicTrainingCode}
						<div class="row">
							<dt>Training code</dt>
							<dd>
								{#if /^https?:\/\//.test(model.publicTrainingCode)}
									<!-- External training-code URL -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={model.publicTrainingCode} target="_blank" rel="noreferrer"
										>{model.publicTrainingCode}</a
									>
								{:else}
									{model.publicTrainingCode}
								{/if}
							</dd>
						</div>
					{/if}
					{#if model.publicTrainingData}
						<div class="row">
							<dt>Training data</dt>
							<dd>
								{#if /^https?:\/\//.test(model.publicTrainingData)}
									<!-- External training-data URL -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={model.publicTrainingData} target="_blank" rel="noreferrer"
										>{model.publicTrainingData}</a
									>
								{:else}
									{model.publicTrainingData}
								{/if}
							</dd>
						</div>
					{/if}
					{#if model.adaptedFrom}
						<div class="row">
							<dt>Adapted from</dt>
							<dd>
								<a
									class="model-link"
									href={resolve('/models/[name]', { name: slug(model.adaptedFrom) })}
									>{model.adaptedFrom}</a
								>
							</dd>
						</div>
					{/if}
					{#if model.supersededBy}
						<div class="row">
							<dt>Superseded by</dt>
							<dd>
								<a
									class="model-link"
									href={resolve('/models/[name]', { name: slug(model.supersededBy) })}
									>{model.supersededBy}</a
								>
							</dd>
						</div>
					{/if}
					{#if model.extraRequirementsGroups && model.extraRequirementsGroups.length > 0}
						<div class="row">
							<dt>Extras</dt>
							<dd>
								<span class="chips">
									{#each model.extraRequirementsGroups as group (group)}
										<code class="chip">{group}</code>
									{/each}
								</span>
							</dd>
						</div>
					{/if}
					{#if model.trainingDatasets && model.trainingDatasets.length > 0}
						{@const PREVIEW = 8}
						{@const datasets = model.trainingDatasets}
						{@const previewed = datasets.slice(0, PREVIEW)}
						{@const hidden = datasets.length - previewed.length}
						<div class="row">
							<dt>Trained on</dt>
							<dd>
								{#if hidden <= 0}
									<span class="chips">
										{#each datasets as ds (ds)}
											{#if mtebTaskNames.has(ds)}
												<a
													class="chip chip-link"
													href={resolve('/tasks/[name]', { name: slug(ds) })}>{ds}</a
												>
											{:else}
												<span class="chip">{ds}</span>
											{/if}
										{/each}
									</span>
								{:else}
									<!-- Long lists fold into a <details>. Closed state shows the
									     first N chips with a "+M more" pill so the reader still
									     sees a representative sample; opening flips that pill to
									     "Show fewer" and renders the full set. -->
									<details class="trained-on">
										<summary>
											<span class="chips">
												{#each previewed as ds (ds)}
													{#if mtebTaskNames.has(ds)}
														<a
															class="chip chip-link"
															href={resolve('/tasks/[name]', { name: slug(ds) })}
															onclick={(e) => e.stopPropagation()}
														>
															{ds}
														</a>
													{:else}
														<span class="chip">{ds}</span>
													{/if}
												{/each}
												<span class="chip more-toggle more-collapsed">+{hidden} more</span>
												<span class="chip more-toggle more-expanded">Show fewer</span>
											</span>
										</summary>
										<span class="chips chips-rest">
											{#each datasets.slice(PREVIEW) as ds (ds)}
												{#if mtebTaskNames.has(ds)}
													<a
														class="chip chip-link"
														href={resolve('/tasks/[name]', { name: slug(ds) })}>{ds}</a
													>
												{:else}
													<span class="chip">{ds}</span>
												{/if}
											{/each}
										</span>
									</details>
								{/if}
							</dd>
						</div>
					{/if}
				</dl>
				<CiteBlock kind="model" citation={model.citation} />
			</div>
			<div class="kpis">
				<div class="kpi">
					<span class="kpi-label">Total params</span>
					<span class="kpi-value"
						>{fmtParamsValue(model.totalParamsB)}{#if fmtParamsUnit(model.totalParamsB)}<span
								class="unit">{fmtParamsUnit(model.totalParamsB)}</span
							>{/if}</span
					>
				</div>
				<div class="kpi">
					<span class="kpi-label">Active params</span>
					<span class="kpi-value"
						>{fmtParamsValue(model.activeParamsB)}{#if fmtParamsUnit(model.activeParamsB)}<span
								class="unit">{fmtParamsUnit(model.activeParamsB)}</span
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
					<span class="kpi-label">Memory</span>
					<span class="kpi-value">{fmtMemoryMb(model.memoryUsageMb)}</span>
				</div>
				<div class="kpi">
					<span class="kpi-label">Released</span>
					<span class="kpi-value date">{model.releaseDate ?? '—'}</span>
				</div>
			</div>
		</section>

		<section class="scores">
			<header class="scores-head">
				<h2>Benchmark scores</h2>
				<span class="muted">
					{#if loadingScores}Loading…
					{:else}{rawRows.length} benchmark{rawRows.length === 1 ? '' : 's'}{/if}
				</span>
				{#if rawRows.length > 0}
					<DownloadButton filename="{sanitizeFilename(model.name)}_benchmarks" build={buildCsv} />
				{/if}
			</header>
			{#if loadingScores}
				<p class="muted">
					Walking every benchmark for this model — first hit can take a while on cold cache…
				</p>
			{:else if scoresError}
				<p class="muted">Failed to load scores: {scoresError}</p>
			{:else if rawRows.length === 0}
				<p class="muted">This model has no scores yet.</p>
			{:else}
				<BenchScoreTable rows={rawRows} />
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
	.hero-left :global(.cite) {
		margin-top: 10px;
	}
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
	/* Each model-type swap exposes both the accent foreground and the tint
	   background as CSS vars; the gradient + badge then read those tokens so
	   the dark-mode variants kick in automatically. */
	.hero[data-type='dense'] {
		--accent: var(--tint-blue-fg);
		--hero-tint: var(--tint-blue);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--hero-tint) 55%, var(--surface)) 0%,
			var(--surface) 200px
		);
	}
	.hero[data-type='cross-encoder'] {
		--accent: var(--tint-orange-fg);
		--hero-tint: var(--tint-orange);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--hero-tint) 55%, var(--surface)) 0%,
			var(--surface) 200px
		);
	}
	.hero[data-type='late-interaction'] {
		--accent: var(--tint-green-fg);
		--hero-tint: var(--tint-green);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--hero-tint) 55%, var(--surface)) 0%,
			var(--surface) 200px
		);
	}
	.hero[data-type='sparse'] {
		--accent: var(--tint-amber-fg);
		--hero-tint: var(--tint-amber);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--hero-tint) 55%, var(--surface)) 0%,
			var(--surface) 200px
		);
	}
	.hero[data-type='router'] {
		--accent: var(--tint-purple-fg);
		--hero-tint: var(--tint-purple);
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
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 999px;
	}
	.type-badge[data-type='dense'] {
		background: var(--tint-blue);
		color: var(--tint-blue-fg);
	}
	.type-badge[data-type='cross-encoder'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
	}
	.type-badge[data-type='late-interaction'] {
		background: var(--tint-green);
		color: var(--tint-green-fg);
	}
	.type-badge[data-type='sparse'] {
		background: var(--tint-amber);
		color: var(--tint-amber-fg);
	}
	.type-badge[data-type='router'] {
		background: var(--tint-purple);
		color: var(--tint-purple-fg);
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
	.badge.open {
		background: #def7e9;
		color: #1c7a4c;
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	/* `.modality-tint[data-modality='…']` is defined in src/app.css and
	   shared with the /models index card. Local class kept geometry-only. */

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

	/* Spec list — extended metadata rendered inline in the hero card. */
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
		text-decoration: none;
	}
	.spec-list .chip-link {
		color: var(--link);
		border-color: color-mix(in srgb, var(--link) 30%, var(--border));
	}
	.spec-list .chip-link:hover {
		background: color-mix(in srgb, var(--link) 10%, var(--surface));
	}
	/* Trained-on fold-out: <summary> carries the preview chips + a
	   pill-styled "+N more" toggle; the matching "Show fewer" pill
	   becomes visible only while the <details> is open. The native
	   disclosure triangle is suppressed so the chip row reads as a
	   single visual unit. */
	.trained-on summary {
		list-style: none;
		cursor: pointer;
	}
	.trained-on summary::-webkit-details-marker {
		display: none;
	}
	.trained-on summary:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: 4px;
	}
	.trained-on .more-toggle {
		font-family: var(--font-sans);
		color: var(--link);
		border-color: color-mix(in srgb, var(--link) 40%, var(--border));
		background: color-mix(in srgb, var(--link) 8%, var(--surface));
		cursor: pointer;
		user-select: none;
	}
	.trained-on .more-expanded {
		display: none;
	}
	.trained-on[open] .more-collapsed {
		display: none;
	}
	.trained-on[open] .more-expanded {
		display: inline-block;
	}
	.trained-on .chips-rest {
		margin-top: 4px;
	}
	.spec-list .model-link {
		font-family: var(--font-mono);
		font-size: 12px;
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
	/* Table-specific styles live in src/lib/components/BenchScoreTable.svelte. */

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
