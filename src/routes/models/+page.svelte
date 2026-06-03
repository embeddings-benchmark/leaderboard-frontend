<script lang="ts">
	import { resolve } from '$app/paths';
	import { loadModels } from '$lib/data/service';
	import { filters, MODEL_MODALITIES } from '$lib/stores/filters.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import ModelTypeIcon from '$lib/components/ModelTypeIcon.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import type { ModelMeta } from '$lib/types';
	import { slug, fmtInt } from '$lib/format';

	let ALL_MODELS = $state<ModelMeta[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	$effect(() => {
		// Re-fetch whenever the modality picker (now in the FilterSidebar)
		// changes. When all modalities are selected we omit the param so the
		// server returns the full registry from its hot cache slot.
		const all = filters.modelModalities.size === MODEL_MODALITIES.length;
		const mods = all ? undefined : [...filters.modelModalities];
		loadingData = true;
		loadError = null;
		loadModels(mods ? { modalities: mods } : {})
			.then((m) => {
				ALL_MODELS = m;
				loadingData = false;
			})
			.catch((e) => {
				loadError = e instanceof Error ? e.message : String(e);
				loadingData = false;
			});
	});

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'params', label: 'Parameters' },
		{ id: 'released', label: 'Release date' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	// Each sort key has a "natural" direction (alphabetical → asc, numeric and
	// dates → desc/newest-first). When the user picks a new key we snap to
	// that default; the explicit toggle below lets them override.
	const NATURAL_DIR: Record<SortId, SortDir> = {
		name: 'asc',
		params: 'desc',
		released: 'desc'
	};
	let sort = $state<SortId>('params');
	let sortDir = $state<SortDir>(NATURAL_DIR.params);

	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	// Apply the shared leaderboard filter store's predicates to a flat model
	// list. Same logic as applyFilters() in filters.svelte.ts, just minus the
	// benchmark-scope / sort / re-rank parts that only make sense for a
	// summary's rows.
	function passes(m: ModelMeta): boolean {
		const q = filters.nameQuery.trim().toLowerCase();
		if (
			q &&
			!m.name.toLowerCase().includes(q) &&
			!m.displayName.toLowerCase().includes(q) &&
			!m.org.toLowerCase().includes(q)
		)
			return false;
		if (filters.availability === 'open' && !m.openWeights) return false;
		if (filters.availability === 'proprietary' && m.openWeights) return false;
		if (filters.instructions === 'only_instruction' && !m.instructionTuned) return false;
		if (filters.instructions === 'only_non_instruction' && m.instructionTuned) return false;
		if (filters.sentenceTransformersOnly && !m.sentenceTransformersCompatible) return false;
		if (filters.modelTypes.size > 0 && !filters.modelTypes.has(m.modelType)) return false;
		if (m.totalParamsB > 0) {
			const paramsM = m.totalParamsB * 1000;
			if (paramsM < filters.minModelSizeM) return false;
			if (paramsM > filters.maxModelSizeM) return false;
		}
		return true;
	}

	let filtered = $derived.by(() => {
		const list = ALL_MODELS.filter(passes);
		// Comparator always computes "ascending" raw cmp; sortDir flips at the
		// end so the direction toggle is a single point of control.
		list.sort((a, b) => {
			let cmp: number;
			if (sort === 'name') {
				cmp = a.name.localeCompare(b.name);
			} else if (sort === 'params') {
				const aP = a.totalParamsB || -1;
				const bP = b.totalParamsB || -1;
				cmp = aP - bP;
			} else if (sort === 'released') {
				cmp = (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '');
			} else {
				cmp = 0;
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return list;
	});

	function fmtParams(b: number): string {
		if (!b) return '—';
		return b >= 1 ? `${b.toFixed(1)}B` : `${(b * 1000).toFixed(0)}M`;
	}
</script>

<div class="app">
	<main class="main">
		<header class="hero">
			<h1>Models</h1>
			<p class="lead">
				Every model in the leaderboard with its architecture type, parameter count, embedding
				dimension, max context, and release date. Filters here share state with the leaderboard on
				every benchmark detail page.
			</p>
			<p class="contribute-note">
				To add your model, follow our
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_model/"
					target="_blank"
					rel="noreferrer">contributor guide</a
				>. Already have scores? Read the
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/submitting_results/"
					target="_blank"
					rel="noreferrer">submitting results guide</a
				>.
			</p>
		</header>

		<div class="toolbar">
			<ModelSearchBar matchCount={filtered.length} totalCount={ALL_MODELS.length} />
			<div class="sort">
				<label for="sort-select">Sort by</label>
				<select
					id="sort-select"
					value={sort}
					onchange={(e) => onSortKeyChange((e.currentTarget as HTMLSelectElement).value as SortId)}
				>
					{#each SORTS as s (s.id)}
						<option value={s.id}>{s.label}</option>
					{/each}
				</select>
				<button
					type="button"
					class="dir-btn"
					onclick={toggleSortDir}
					aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
					title={sortDir === 'asc'
						? 'Ascending (click for descending)'
						: 'Descending (click for ascending)'}
				>
					<SortDirIcon dir={sortDir} />
				</button>
			</div>
		</div>

		{#if loadingData}
			<p class="empty">Loading models…</p>
		{:else if loadError}
			<p class="empty">Failed to load models: {loadError}</p>
		{:else if filtered.length === 0}
			<p class="empty">No models match those filters.</p>
		{:else}
			<div class="grid">
				{#each filtered as m (m.name)}
					<a
						class="card"
						href={resolve('/models/[name]', { name: slug(m.name) })}
						data-type={m.modelType}
						title={m.modelType}
					>
						<div class="card-head">
							<div class="title-wrap">
								<span class="title">
									<span class="org">{m.org}</span><span class="sep">/</span>{m.displayName}
								</span>
							</div>
							<span class="type-chip" data-type={m.modelType}>
								<ModelTypeIcon type={m.modelType} size={12} />
								<span>{m.modelType}</span>
							</span>
						</div>
						<dl class="stats">
							<div>
								<dt>Params</dt>
								<dd>{fmtParams(m.totalParamsB)}</dd>
							</div>
							<div>
								<dt>Embed dim</dt>
								<dd>{fmtInt(m.embeddingDim)}</dd>
							</div>
							<div>
								<dt>Max tokens</dt>
								<dd>{fmtInt(m.maxTokens)}</dd>
							</div>
							<div>
								<dt>Released</dt>
								<dd>{m.releaseDate ?? '—'}</dd>
							</div>
						</dl>
						<div class="badges">
							<span class="badge" class:open={m.openWeights} class:closed={!m.openWeights}>
								{m.openWeights ? 'Open weights' : 'Proprietary'}
							</span>
							{#if m.instructionTuned}
								<span class="badge soft">Instruction-tuned</span>
							{/if}
							{#if m.sentenceTransformersCompatible}
								<span class="badge soft">ST compatible</span>
							{/if}
						</div>
						{#if m.modalities && m.modalities.length > 0}
							<div class="modality-row" aria-label="Supported modalities">
								{#each m.modalities as mod (mod)}
									<span class="mod-chip modality-tint" data-modality={mod} title={mod}>
										<ModalityIcon modality={mod} size={12} />
										<span class="mod-label">{mod}</span>
									</span>
								{/each}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</main>

	<FilterSidebar hideScope flatModel />
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 24px 0 16px;
	}
	.hero h1 {
		font-size: 32px;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	/* `.lead`, `.sort*`, `.dir-btn*` live in src/app.css — same
	   markup is on /tasks so the rules were exact duplicates. */
	/* Sticky shelf — matches /benchmarks and /tasks so the three
	   overview pages share one shelf treatment. */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin: 8px 0 18px;
		padding: 10px 12px;
		background: var(--bar-bg);
		backdrop-filter: blur(14px) saturate(140%);
		-webkit-backdrop-filter: blur(14px) saturate(140%);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: var(--shadow-sm);
		position: sticky;
		top: var(--header-offset, 56px);
		z-index: 5;
	}
	/* Cards ---------------------------------------------------------------- */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		/* Reserve room beneath the badges so the modality strip's
		   `margin-top: auto` actually has slack to push into. Without a
		   guaranteed minimum height the card collapses to content and
		   the auto margin resolves to 0, leaving modalities glued to
		   the badges row. 220 px matches the natural height of a card
		   with all three optional badges + a 2-modality row, so cards
		   with fewer badges or modalities just get more breathing
		   room above the modality strip. */
		min-height: 220px;
		position: relative;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.card:focus-visible {
		outline: 2px solid var(--card-accent, var(--primary));
		outline-offset: 2px;
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 22px rgb(15, 23, 42, 0.08);
	}
	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--card-accent, var(--border));
	}
	/* Per-type cards: a flat surface so dark mode reads cleanly, plus the
	   accent bar (.card::before) and a soft 40% tint at the very top via
	   the theme-aware --tint-* tokens. */
	.card[data-type='dense'] {
		--card-accent: var(--tint-blue-fg);
		--card-tint: var(--tint-blue);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-blue) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-type='cross-encoder'] {
		--card-accent: var(--tint-orange-fg);
		--card-tint: var(--tint-orange);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-orange) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-type='late-interaction'] {
		--card-accent: var(--tint-green-fg);
		--card-tint: var(--tint-green);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-green) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-type='sparse'] {
		--card-accent: var(--tint-amber-fg);
		--card-tint: var(--tint-amber);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-amber) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-type='router'] {
		--card-accent: var(--tint-purple-fg);
		--card-tint: var(--tint-purple);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-purple) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--card-accent) 50%, var(--border));
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.title-wrap {
		flex: 1;
		min-width: 0;
	}
	/* Bottom-of-card modality strip: small color-keyed chips that read
	   "the model can encode <icon> text / image / audio / video". Sits
	   below the open-weights / instruction-tuned badges so the card
	   reads top-to-bottom as identity → stats → capability → modality.
	   `margin-top: auto` pins the strip to the bottom edge of the flex
	   card so the row aligns across the grid no matter how many soft
	   badges (Instruction-tuned / ST compatible) the model carries. */
	.modality-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: auto;
	}
	/* Geometry only — per-modality tint comes from `.modality-tint` in
	   src/app.css, shared with the /models/[name] hero badges. */
	.mod-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.01em;
		border-radius: 999px;
	}
	.mod-label {
		text-transform: lowercase;
	}
	.title {
		display: block;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		word-break: break-word;
	}
	.card:hover .title {
		color: var(--card-accent, var(--primary-strong));
	}
	.title .org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.title .sep {
		color: var(--border-strong);
		margin: 0 1px;
		font-weight: 400;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px 14px;
		margin: 0;
	}
	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.stats dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.stats dd {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Mobile: the 2x2 KPI grid (params / embed dim / max tokens /
	   released) crowds each card; the same numbers are on the detail
	   page. Drop the grid and lean on the title + badges. */
	@media (max-width: 640px) {
		.stats {
			display: none;
		}
	}

	.type-chip {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
		padding: 3px 8px;
		border-radius: 999px;
		white-space: nowrap;
		text-transform: lowercase;
		background: var(--card-tint, var(--surface-muted));
		color: var(--card-accent, var(--text-muted));
		border: 1px solid color-mix(in srgb, var(--card-accent, var(--border)) 35%, transparent);
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.badge {
		font-size: 10px;
		padding: 3px 8px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	/* Reuse the shared `--tint-green` pair so dark mode picks up the
	   pre-tuned dark-green variant instead of a washed-out light bg.
	   Dark mode gets a slightly deeper green than the default
	   `--tint-green` so the pill reads as a distinct chip against the
	   `--surface` card body (which itself is in the same green family
	   territory under the gradient header band). */
	.badge.open {
		background: light-dark(var(--tint-green), #0d2a1c);
		color: var(--tint-green-fg);
	}
	.badge.closed {
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
	}

	/* `.empty` lives in src/app.css. */
</style>
