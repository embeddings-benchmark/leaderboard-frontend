<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadModels } from '$lib/data/service';
	import { safeIdle } from '$lib/idle';
	import { filters, MODEL_MODALITIES } from '$lib/stores/filters.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SkeletonGrid from '$lib/components/SkeletonGrid.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import type { ModelMeta } from '$lib/types';
	import {
		COLLATOR,
		fmtInt,
		fmtParamsCompact,
		modelPath,
		modelSearchKey,
		sortModalities
	} from '$lib/format';
	import { getParam, updateUrl } from '$lib/url-state';

	let ALL_MODELS = $state<ModelMeta[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	// Local language filter state. Lives in the page (not the shared
	// `filters` store) because /models is the only place that uses it.
	// Same "all on = filter off" semantic as the shared store:
	// `languagesPicked.size === LANGUAGES.length` ⇒ no narrowing.
	// The UI (search input, cap-and-expand, pills) is rendered inside
	// the shared FilterSidebar — we just pass the data and handlers in.
	let LANGUAGES = $state<string[]>([]);
	const languagesPicked = new SvelteSet<string>();

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
				// Compute available languages from the loaded models.
				// `ModelMeta.languages` may be missing (older backends, models
				// with no declared language scope) — those rows pass the
				// filter trivially via the "everything checked" default.
				// Count per language so the filter pills sort by popularity.
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const langCount = new Map<string, number>();
				for (const x of m)
					for (const l of x.languages ?? []) langCount.set(l, (langCount.get(l) ?? 0) + 1);
				LANGUAGES = [...langCount.entries()]
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
					.map(([l]) => l);
				languagesPicked.clear();
				for (const l of LANGUAGES) languagesPicked.add(l);
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
	// Default sort: newest release first. Surfaces just-shipped models at
	// the top so visitors see what's current without scrolling. State is
	// URL-backed (`?s.models=…&d.models=…`) so navigating to a model detail
	// page and back via the browser restores the user's sort choice.
	const SORT_IDS = new Set(SORTS.map((s) => s.id));
	const DEFAULT_SORT: SortId = 'released';
	const _urlSort = getParam('s.models');
	const _urlDir = getParam('d.models');
	const initialSort: SortId = SORT_IDS.has(_urlSort as SortId)
		? (_urlSort as SortId)
		: DEFAULT_SORT;
	let sort = $state<SortId>(initialSort);
	let sortDir = $state<SortDir>(
		_urlDir === 'asc' || _urlDir === 'desc' ? _urlDir : NATURAL_DIR[initialSort]
	);
	$effect(() => {
		// Omit defaults from the URL so the canonical "fresh visit" link is clean.
		const isDefault = sort === DEFAULT_SORT && sortDir === NATURAL_DIR[DEFAULT_SORT];
		updateUrl({
			's.models': isDefault ? null : sort,
			'd.models': isDefault ? null : sortDir
		});
	});

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
	function buildPasses(): (m: ModelMeta) => boolean {
		// All cross-row inputs read once at the top so the per-row predicate
		// doesn't re-read them 800x per keystroke.
		const q = filters.nameQuery.trim().toLowerCase();
		const availability = filters.availability;
		const instructions = filters.instructions;
		const stOnly = filters.sentenceTransformersOnly;
		const modelTypes = filters.modelTypes;
		const modelTypesSize = modelTypes.size;
		const sizeMin = filters.minModelSizeM;
		const sizeMax = filters.maxModelSizeM;
		const langPicked = languagesPicked;
		const langCount = LANGUAGES.length;
		const langActive = langCount > 0 && langPicked.size !== langCount;
		return (m: ModelMeta) => {
			if (q && !modelSearchKey(m).includes(q)) return false;
			if (availability === 'open' && !m.openWeights) return false;
			if (availability === 'proprietary' && m.openWeights) return false;
			if (instructions === 'only_instruction' && !m.instructionTuned) return false;
			if (instructions === 'only_non_instruction' && m.instructionTuned) return false;
			if (stOnly && !m.sentenceTransformersCompatible) return false;
			// Empty pick set = "deselect everything" → nothing matches.
			if (modelTypesSize === 0 || !modelTypes.has(m.modelType)) return false;
			if (m.totalParamsB > 0) {
				const paramsM = m.totalParamsB * 1000;
				if (paramsM < sizeMin) return false;
				if (paramsM > sizeMax) return false;
			}
			// Language predicate: "all on" = filter off; otherwise require
			// at least one declared language to be in the picked set.
			// Models with no declared languages (`undefined`/`[]`) get a
			// pass — language metadata is optional upstream and we don't
			// want to silently drop pre-tagged models.
			if (langActive) {
				const mlangs = m.languages;
				if (mlangs && mlangs.length > 0 && !mlangs.some((l) => langPicked.has(l))) return false;
			}
			return true;
		};
	}

	function toggleLanguage(l: string) {
		if (languagesPicked.has(l)) languagesPicked.delete(l);
		else languagesPicked.add(l);
	}
	function toggleAllLanguages() {
		if (languagesPicked.size === LANGUAGES.length) languagesPicked.clear();
		else for (const l of LANGUAGES) languagesPicked.add(l);
	}

	// Split filter / sort so name-query keystrokes (which only narrow rows)
	// don't trigger a full re-sort. The sort only re-runs when its inputs
	// (`sort`, `sortDir`, or the filtered list identity) change.
	let matched = $derived.by(() => ALL_MODELS.filter(buildPasses()));
	let filtered = $derived.by(() => {
		const list = [...matched];
		list.sort((a, b) => {
			let cmp: number;
			if (sort === 'name') {
				cmp = COLLATOR.compare(a.name, b.name);
			} else if (sort === 'params') {
				const aP = a.totalParamsB || -1;
				const bP = b.totalParamsB || -1;
				cmp = aP - bP;
			} else if (sort === 'released') {
				cmp = COLLATOR.compare(a.releaseDate ?? '', b.releaseDate ?? '');
			} else {
				cmp = 0;
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return list;
	});

	// Progressive render — same pattern as /tasks. Debounce the grow
	// kick-off so the storm of filter-set seeding during data load
	// doesn't permanently reset visibleCount to the initial chunk.
	const INITIAL_CHUNK = 60;
	const CHUNK_STEP = 200;
	let visibleCount = $state(INITIAL_CHUNK);
	let growVersion = 0;
	let lastFilteredSignature = '';
	let kickoffTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const total = filtered.length;
		// Signature catches real filter changes; lets our own visibleCount
		// writes re-fire the effect harmlessly (bail on same signature).
		const signature = `${total}|${filtered[0]?.name ?? ''}|${filtered[total - 1]?.name ?? ''}`;
		if (signature === lastFilteredSignature) return;
		lastFilteredSignature = signature;
		const myVersion = ++growVersion;
		visibleCount = Math.min(INITIAL_CHUNK, total);
		if (visibleCount >= total) return;
		if (kickoffTimer) clearTimeout(kickoffTimer);
		kickoffTimer = setTimeout(() => {
			kickoffTimer = null;
			if (myVersion !== growVersion) return;
			const grow = () => {
				if (myVersion !== growVersion) return;
				visibleCount = Math.min(visibleCount + CHUNK_STEP, total);
				if (visibleCount < total) safeIdle(grow);
			};
			safeIdle(grow);
		}, 80);
	});
	let visibleModels = $derived(filtered.slice(0, visibleCount));
</script>

<ShareMeta
	title="Models"
	description={`Every embedding model on the MTEB Leaderboard — ${ALL_MODELS.length || '700+'} models with architecture type, parameter count, embedding dimension, context length, release date, and supported languages.`}
/>

<div class="layout-sidebar">
	<main id="main-content" tabindex="-1" class="layout-main">
		<header class="hero index-hero">
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
			<SkeletonGrid />
		{:else if loadError}
			<p class="empty">Failed to load models: {loadError}</p>
		{:else if filtered.length === 0}
			<p class="empty">No models match those filters.</p>
		{:else}
			<div class="grid card-grid">
				{#each visibleModels as m (m.name)}
					<a
						class="card card-link card-link-vis accent-rail"
						href={resolve('/models/[...name]', { name: modelPath(m.name) })}
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
								<span>{m.modelType}</span>
							</span>
						</div>
						<dl class="card-stats">
							<div>
								<dt>Params</dt>
								<dd>{fmtParamsCompact(m.totalParamsB)}</dd>
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
							<div class="chip-row modality-row" aria-label="Supported modalities">
								{#each sortModalities(m.modalities) as mod (mod)}
									<span class="badge modality-tint" data-modality={mod} title={mod}>
										<ModalityIcon modality={mod} size={12} />
										<span>{mod}</span>
									</span>
								{/each}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</main>

	<FilterSidebar
		hideScope
		flatModel
		hideZeroShot
		languageOptions={LANGUAGES}
		languagesPicked={languagesPicked as unknown as Set<string>}
		onToggleLanguage={toggleLanguage}
		onToggleAllLanguages={toggleAllLanguages}
	/>
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
	/* `min-height` gives `.modality-row { margin-top: auto }` slack
	   to push the modalities to the card bottom — without it the
	   column collapses to content and the auto margin resolves to 0. */
	.card {
		--card-intrinsic: 220px;
		min-height: 220px;
	}
	.card[data-type] {
		--card-tint: var(--category-tint);
		--card-accent: var(--category-tint-fg);
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
	.modality-row {
		gap: 6px;
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
	@media (max-width: 640px) {
		.card-stats {
			gap: 6px 12px;
		}
		.card-stats dt {
			font-size: 9px;
		}
		.card-stats dd {
			font-size: 13px;
		}
		.card {
			min-height: 0;
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
		gap: 5px;
	}
	/* Outline-only on the card (overrides the global filled defaults). */
	.badge.open,
	.badge.soft {
		background: transparent;
	}
	.badge.open {
		color: var(--tint-green-fg);
	}
</style>
