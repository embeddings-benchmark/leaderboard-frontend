<script lang="ts">
	// Renders per-split descriptive statistics for a task.
	//
	// The /v1/tasks/{name}/descriptive-stats payload shape is one of ~10
	// per-task TypedDicts (see `mteb/types/statistics.py`), each carrying
	// `num_samples` plus a varying set of `*_statistics` nested blocks
	// (TextStatistics, ImageStatistics, AudioStatistics, VideoStatistics,
	// LabelStatistics, ScoreStatistics, RelevantDocsStatistics,
	// TopRankedStatistics). Multilingual datasets wrap each split in a
	// `hf_subset_descriptive_stats` map of the same shape.
	//
	// Rather than switching on TaskMeta.type and writing 10 renderers,
	// we walk the object structurally — for each split we surface known
	// scalar fields as KPI tiles and detect any *_statistics block by
	// key name. Forward-compatible: new task-type stats classes added on
	// the backend appear without a frontend change.
	import { hasSubsets } from '$lib/types';
	import type { TaskDescriptiveStats } from '$lib/types';

	let { stats }: { stats: TaskDescriptiveStats } = $props();

	// Scalar fields surfaced as KPI tiles at the top of each split card.
	// Order matches the backend TypedDict declaration order so retrieval's
	// num_queries / num_documents lead before number_of_characters etc.
	const SCALAR_LABELS: Record<string, string> = {
		num_samples: 'Samples',
		num_queries: 'Queries',
		num_documents: 'Documents',
		number_of_characters: 'Characters',
		unique_pairs: 'Unique pairs',
		samples_in_train: 'Samples in train'
	};

	// `*_statistics` blocks rendered as nested cards. Mapping → display label.
	// Keys not in this map are still rendered (with a humanised label), so
	// new stat blocks don't get dropped on the floor.
	const BLOCK_LABELS: Record<string, string> = {
		text_statistics: 'Text',
		text1_statistics: 'Text 1',
		text2_statistics: 'Text 2',
		sentence1_statistics: 'Sentence 1',
		sentence2_statistics: 'Sentence 2',
		image_statistics: 'Image',
		image1_statistics: 'Image 1',
		image2_statistics: 'Image 2',
		audio_statistics: 'Audio',
		audio1_statistics: 'Audio 1',
		audio2_statistics: 'Audio 2',
		video_statistics: 'Video',
		video1_statistics: 'Video 1',
		video2_statistics: 'Video 2',
		documents_text_statistics: 'Documents (text)',
		documents_image_statistics: 'Documents (image)',
		documents_audio_statistics: 'Documents (audio)',
		documents_video_statistics: 'Documents (video)',
		queries_text_statistics: 'Queries (text)',
		queries_image_statistics: 'Queries (image)',
		queries_audio_statistics: 'Queries (audio)',
		queries_video_statistics: 'Queries (video)',
		relevant_docs_statistics: 'Relevant documents',
		top_ranked_statistics: 'Top ranked',
		human_summaries_statistics: 'Human summaries',
		machine_summaries_statistics: 'Machine summaries',
		score_statistics: 'Scores',
		values_statistics: 'Values',
		label_statistics: 'Labels',
		labels_statistics: 'Labels',
		candidates_labels_text_statistics: 'Candidate labels (text)'
	};

	// Field labels used inside a `*_statistics` block. Anything not listed
	// falls back to a humanised version of the snake_case key.
	const FIELD_LABELS: Record<string, string> = {
		total_text_length: 'Total length',
		min_text_length: 'Min length',
		average_text_length: 'Avg length',
		max_text_length: 'Max length',
		unique_texts: 'Unique texts',
		min_image_width: 'Min width',
		average_image_width: 'Avg width',
		max_image_width: 'Max width',
		min_image_height: 'Min height',
		average_image_height: 'Avg height',
		max_image_height: 'Max height',
		unique_images: 'Unique images',
		total_duration_seconds: 'Total duration (s)',
		min_duration_seconds: 'Min duration (s)',
		average_duration_seconds: 'Avg duration (s)',
		max_duration_seconds: 'Max duration (s)',
		unique_audios: 'Unique clips',
		unique_videos: 'Unique clips',
		average_sampling_rate: 'Avg sampling rate',
		sampling_rates: 'Sampling rates',
		total_frames: 'Total frames',
		average_fps: 'Avg FPS',
		fps: 'FPS distribution',
		min_width: 'Min width',
		average_width: 'Avg width',
		max_width: 'Max width',
		min_height: 'Min height',
		average_height: 'Avg height',
		max_height: 'Max height',
		min_resolution: 'Min resolution',
		average_resolution: 'Avg resolution',
		max_resolution: 'Max resolution',
		resolutions: 'Resolutions',
		min_score: 'Min',
		avg_score: 'Average',
		max_score: 'Max',
		min_labels_per_text: 'Min labels / text',
		average_label_per_text: 'Avg labels / text',
		max_labels_per_text: 'Max labels / text',
		unique_labels: 'Unique labels',
		labels: 'Label counts',
		num_relevant_docs: 'Relevant docs (total)',
		min_relevant_docs_per_query: 'Min / query',
		average_relevant_docs_per_query: 'Avg / query',
		max_relevant_docs_per_query: 'Max / query',
		unique_relevant_docs: 'Unique relevant docs',
		num_top_ranked: 'Top-ranked (total)',
		min_top_ranked_per_query: 'Min / query',
		average_top_ranked_per_query: 'Avg / query',
		max_top_ranked_per_query: 'Max / query'
	};

	const humanise = (k: string) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

	// Number formatting: integers as locale-grouped ("174,637"), floats
	// rounded to 2 decimals once they're > 1, otherwise 4 (so small mean
	// scores like 0.0623 stay readable).
	function formatNumber(v: number): string {
		if (Number.isInteger(v)) return v.toLocaleString();
		const abs = Math.abs(v);
		const digits = abs >= 1 ? 2 : 4;
		return v.toLocaleString(undefined, { maximumFractionDigits: digits });
	}

	function formatValue(v: unknown): string {
		if (v === null || v === undefined) return '—';
		if (typeof v === 'number') return formatNumber(v);
		if (typeof v === 'string') return v;
		if (Array.isArray(v)) {
			// resolution tuples render as "W × H"
			if (v.length === 2 && v.every((x) => typeof x === 'number')) {
				return `${formatNumber(v[0])} × ${formatNumber(v[1])}`;
			}
			return v.map((x) => formatValue(x)).join(', ');
		}
		return JSON.stringify(v);
	}

	type FieldEntry =
		| { kind: 'scalar'; label: string; value: string }
		| { kind: 'dist'; label: string; entries: Array<[string, number]> };

	// Render a *_statistics block: flatten scalar fields, surface frequency
	// dicts (sampling_rates, fps, resolutions, labels) as compact bar lists.
	function blockEntries(block: Record<string, unknown>): FieldEntry[] {
		const out: FieldEntry[] = [];
		for (const [k, v] of Object.entries(block)) {
			const label = FIELD_LABELS[k] ?? humanise(k);
			if (v === null || v === undefined) {
				out.push({ kind: 'scalar', label, value: '—' });
				continue;
			}
			if (typeof v === 'number' || typeof v === 'string' || Array.isArray(v)) {
				out.push({ kind: 'scalar', label, value: formatValue(v) });
				continue;
			}
			if (typeof v === 'object') {
				// LabelStatistics.labels: { "<label>": { count: N } }
				// Frequency dicts: { "<key>": N }
				const entries = Object.entries(v as Record<string, unknown>);
				const flat: Array<[string, number]> = [];
				for (const [kk, vv] of entries) {
					if (typeof vv === 'number') flat.push([kk, vv]);
					else if (
						vv !== null &&
						typeof vv === 'object' &&
						'count' in (vv as Record<string, unknown>) &&
						typeof (vv as { count: unknown }).count === 'number'
					) {
						flat.push([kk, (vv as { count: number }).count]);
					}
				}
				if (flat.length > 0) {
					flat.sort((a, b) => b[1] - a[1]);
					out.push({ kind: 'dist', label, entries: flat });
				}
			}
		}
		return out;
	}

	// Distribution lists are capped — long label clouds (e.g. BlurbsClusteringP2P
	// has 100+ categories) would push everything else off-screen.
	const DIST_PREVIEW = 8;

	// Recognise a `*_statistics` block by key. Distinct from "labels" /
	// "sampling_rates" / "fps" / "resolutions" which are frequency dicts
	// inside a block, not separate blocks themselves.
	function isStatsBlock(k: string): boolean {
		return k.endsWith('_statistics');
	}

	type RenderedBlocks = {
		scalars: Array<[string, string]>; // KPI tiles
		blocks: Array<{ key: string; label: string; entries: FieldEntry[] }>;
	};
	type RenderedSplit = RenderedBlocks & {
		key: string; // split label (e.g. "test", "validation")
		// Per-subset breakdowns for multilingual datasets. Empty when the
		// task ships a single subset (the aggregate is the whole story).
		subsets: Array<{ key: string } & RenderedBlocks>;
	};

	function renderBlocks(split: Record<string, unknown>): RenderedBlocks {
		const scalars: Array<[string, string]> = [];
		const blocks: Array<{ key: string; label: string; entries: FieldEntry[] }> = [];
		for (const [k, v] of Object.entries(split)) {
			if (k === 'hf_subset_descriptive_stats') continue;
			if (isStatsBlock(k)) {
				if (v === null || typeof v !== 'object') continue;
				blocks.push({
					key: k,
					label: BLOCK_LABELS[k] ?? humanise(k.replace(/_statistics$/, '')),
					entries: blockEntries(v as Record<string, unknown>)
				});
				continue;
			}
			const label = SCALAR_LABELS[k] ?? humanise(k);
			scalars.push([label, formatValue(v)]);
		}
		return { scalars, blocks };
	}

	// Flatten the top-level Record<split, …>. For multilingual datasets
	// the wrapper carries the aggregated stats at the top level *and* a
	// `hf_subset_descriptive_stats` map — we render the aggregate as the
	// main panel and surface subsets as collapsible sub-cards beneath.
	let rendered = $derived.by<RenderedSplit[]>(() => {
		const out: RenderedSplit[] = [];
		for (const [split, value] of Object.entries(stats)) {
			const base = renderBlocks(value as unknown as Record<string, unknown>);
			const subsets: RenderedSplit['subsets'] = [];
			if (hasSubsets(value)) {
				for (const [subset, sub] of Object.entries(value.hf_subset_descriptive_stats)) {
					subsets.push({
						key: subset,
						...renderBlocks(sub as unknown as Record<string, unknown>)
					});
				}
			}
			out.push({ key: split, ...base, subsets });
		}
		return out;
	});

	// Open-state is delegated to the native `<details>` element — we set
	// the initial `open` attribute via `i === 0` (non-reactive) and never
	// touch it again. A controlled binding here would trigger a feedback
	// loop: Svelte mutating `details.open` fires the same `toggle` event
	// as user clicks, so reactive state derived from `toggle` would race
	// against the binding writing back. Keeping the DOM authoritative
	// dodges that entirely.
</script>

<section class="stats">
	<header class="stats-head">
		<h2>Dataset statistics</h2>
		<span class="muted">{rendered.length} split{rendered.length === 1 ? '' : 's'}</span>
	</header>

	{#snippet renderBody(body: RenderedBlocks)}
		{#if body.scalars.length > 0}
			<div class="kpi-grid">
				{#each body.scalars as [label, value] (label)}
					<div class="kpi">
						<span class="kpi-label">{label}</span>
						<span class="kpi-value">{value}</span>
					</div>
				{/each}
			</div>
		{/if}
		{#if body.blocks.length > 0}
			<div class="blocks">
				{#each body.blocks as block (block.key)}
					<div class="block">
						<h3 class="block-title">{block.label}</h3>
						<dl class="block-fields">
							{#each block.entries as entry (entry.label)}
								{#if entry.kind === 'scalar'}
									<div class="field">
										<dt>{entry.label}</dt>
										<dd>{entry.value}</dd>
									</div>
								{:else}
									{@const preview = entry.entries.slice(0, DIST_PREVIEW)}
									{@const rest = entry.entries.length - preview.length}
									{@const maxCount = preview[0]?.[1] ?? 1}
									<div class="field field-dist">
										<dt>{entry.label} <span class="count">({entry.entries.length})</span></dt>
										<dd>
											<ul class="dist">
												{#each preview as [k, v] (k)}
													<li>
														<span class="dist-key" title={k}>{k}</span>
														<span class="dist-bar" style:--w="{(v / maxCount) * 100}%"></span>
														<span class="dist-val">{formatNumber(v)}</span>
													</li>
												{/each}
											</ul>
											{#if rest > 0}
												<p class="dist-more">+{rest} more</p>
											{/if}
										</dd>
									</div>
								{/if}
							{/each}
						</dl>
					</div>
				{/each}
			</div>
		{/if}
	{/snippet}

	{#each rendered as split, i (split.key)}
		<details class="split panel" open={i === 0}>
			<summary>
				<span class="chev" aria-hidden="true"></span>
				<span class="split-name">{split.key}</span>
				<span class="split-summary">
					{#each split.scalars.slice(0, 3) as [label, value] (label)}
						<span class="pill"><strong>{value}</strong> {label.toLowerCase()}</span>
					{/each}
				</span>
			</summary>
			<div class="split-body">
				{@render renderBody(split)}
				{#if split.subsets.length > 0}
					<details class="subsets details-flat">
						<summary>
							<span class="chev" aria-hidden="true"></span>
							<span class="subsets-label"
								>Per subset <span class="count">({split.subsets.length})</span></span
							>
						</summary>
						<div class="subset-list">
							{#each split.subsets as subset (subset.key)}
								<div class="subset">
									<h3 class="subset-name">{subset.key}</h3>
									{@render renderBody(subset)}
								</div>
							{/each}
						</div>
					</details>
				{/if}
			</div>
		</details>
	{/each}
</section>

<style>
	.stats {
		margin-top: 24px;
	}
	.stats-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 10px;
	}
	.stats h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.muted {
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Each split is a collapsible panel — matches the dataset-preview
	   <details> styling on the same page so they stack visually. */
	.split + .split {
		margin-top: 10px;
	}
	.split {
		overflow: hidden;
	}
	.split > summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		cursor: pointer;
		user-select: none;
		font-size: 14px;
		list-style: none;
	}
	.split > summary::-webkit-details-marker {
		display: none;
	}
	.chev {
		width: 0;
		height: 0;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-left: 6px solid var(--text-muted);
		transition: transform 0.16s cubic-bezier(0.6, 0.1, 0.2, 1);
		transform-origin: 25% 50%;
		flex-shrink: 0;
	}
	.split[open] > summary .chev,
	.subsets[open] > summary .chev {
		transform: rotate(90deg);
	}
	.split-name {
		font-weight: 700;
		color: var(--ink-strong);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.split-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: 1;
	}
	.pill {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11.5px;
		color: var(--text-muted);
		background: var(--surface-muted);
		border-radius: 999px;
	}
	.pill strong {
		color: var(--ink-strong);
		font-weight: 700;
		margin-right: 4px;
	}

	.split-body {
		padding: 4px 16px 16px;
		border-top: 1px solid var(--border);
	}

	/* Multilingual subset list — nested <details> beneath the aggregate. */
	.subsets {
		margin-top: 12px;
		border-top: 1px dashed var(--border);
		padding-top: 8px;
	}
	.subsets > summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
		font-size: 13px;
		color: var(--text-muted);
		list-style: none;
		padding: 4px 0;
	}
	.subsets > summary::-webkit-details-marker {
		display: none;
	}
	.subsets-label {
		font-weight: 600;
		color: var(--ink-strong);
	}
	.subset-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 14px;
		margin-top: 10px;
	}
	.subset {
		border-left: 2px solid var(--border);
		padding-left: 14px;
	}
	.subset-name {
		margin: 0 0 6px;
		font-family: var(--font-mono);
		font-size: 12.5px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	/* Tighter spacing for the kpi/blocks inside a subset — there's already
	   a left rule giving the visual offset. */
	.subset :global(.kpi-grid) {
		margin: 6px 0 10px;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 10px;
		margin: 12px 0 16px;
	}
	.kpi {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		background: var(--surface-muted);
		border-radius: 10px;
	}
	.kpi-label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.kpi-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--ink-strong);
		font-variant-numeric: tabular-nums;
	}

	.blocks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}
	.block {
		background: var(--surface-muted);
		border-radius: 10px;
		padding: 12px 14px;
	}
	.block-title {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--primary);
	}
	.block-fields {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr;
		row-gap: 6px;
	}
	.field {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: 10px;
		align-items: baseline;
	}
	.field dt {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
	}
	.field dd {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-strong);
		font-variant-numeric: tabular-nums;
		text-align: right;
		word-break: break-word;
	}
	.field-dist {
		grid-template-columns: 1fr;
		row-gap: 4px;
	}
	.field-dist dt {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.count {
		color: var(--text-subtle);
		font-weight: 500;
	}
	.dist {
		list-style: none;
		padding: 0;
		margin: 4px 0 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: 3px;
	}
	.dist li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 60px auto;
		column-gap: 8px;
		align-items: center;
		font-size: 12px;
	}
	.dist-key {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
	}
	.dist-bar {
		position: relative;
		height: 6px;
		background: var(--surface);
		border-radius: 999px;
		overflow: hidden;
	}
	.dist-bar::before {
		content: '';
		position: absolute;
		inset: 0;
		width: var(--w);
		background: var(--primary);
		opacity: 0.6;
	}
	.dist-val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}
	.dist-more {
		margin: 4px 0 0;
		font-size: 11px;
		color: var(--text-subtle);
	}
</style>
