<script lang="ts">
	import { onMount } from 'svelte';
	import type { Benchmark } from '$lib/types';
	import ActiveFilterStrip, { type Chip } from '$lib/components/ActiveFilterStrip.svelte';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import BenchmarksTable from '$lib/components/BenchmarksTable.svelte';
	import FilterFacet from '$lib/components/FilterFacet.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import SkeletonGrid from '$lib/components/SkeletonGrid.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import ViewModeToggle, { type ViewMode } from '$lib/components/ViewModeToggle.svelte';
	import { ariaSort, sortIcon } from '$lib/format';
	import { createFacetFilter, createFacetGroup } from '$lib/stores/facet-filter.svelte';
	import type { SortState } from '$lib/stores/sort.svelte';
	import { getParam, updateUrl } from '$lib/url-state';
	import type { PageData } from './$types';
	import type { BenchmarksData } from './+page';

	let { data }: { data: PageData } = $props();

	// Stale-guard via `data.benchmarks === p` on rapid nav.
	let resolved = $state<BenchmarksData | null>(null);
	let loadError = $state<string | null>(null);
	$effect(() => {
		const p = data.benchmarks;
		loadError = null;
		p.then((r) => {
			if (data.benchmarks === p) resolved = r;
		}).catch((e) => {
			if (data.benchmarks === p) loadError = e instanceof Error ? e.message : String(e);
		});
	});

	let allBenchmarks = $derived<Benchmark[]>(resolved?.all ?? []);
	// Defaults seed first; onMount below syncs from URL to avoid hydration mismatch.
	let query = $state('');

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'tasks', label: 'Task count' },
		{ id: 'languages', label: 'Language count' },
		{ id: 'models', label: 'Model count' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		name: 'asc',
		tasks: 'desc',
		languages: 'desc',
		models: 'desc'
	};
	const SORT_IDS = SORTS.map((s) => s.id) as readonly SortId[];
	// "Model count" desc surfaces popular benchmarks first.
	const DEFAULT_SORT: SortId = 'models';
	let sort = $state<SortId>(DEFAULT_SORT);
	let sortDir = $state<SortDir>(NATURAL_DIR[DEFAULT_SORT]);
	let urlHydrated = $state(false);
	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	let view = $state<ViewMode>('cards');
	const sortAdapter: SortState<SortId> = {
		get key() {
			return sort;
		},
		get dir() {
			return sortDir;
		},
		click(k: SortId) {
			if (sort !== k) onSortKeyChange(k);
			else toggleSortDir();
		},
		icon(k: SortId) {
			return sortIcon(k, sort, sortDir, '↕');
		},
		aria(k: SortId) {
			return ariaSort(k, sort, sortDir);
		}
	};

	$effect(() => {
		// `facetGroup.seeded` gate prevents clobbering deep-link facet params
		// before seed.
		if (!urlHydrated || !facetGroup.seeded) return;
		updateUrl({
			q: query.trim() || null,
			sort: sort === DEFAULT_SORT ? null : sort,
			dir: sortDir === NATURAL_DIR[sort] ? null : sortDir,
			view: view === 'cards' ? null : view,
			...facetGroup.urlPatch()
		});
	});

	onMount(() => {
		const uq = getParam('q');
		const us = getParam('sort');
		const ud = getParam('dir');
		const uv = getParam('view');
		if (uq) query = uq;
		if (us && (SORT_IDS as readonly string[]).includes(us)) {
			sort = us as SortId;
			sortDir = ud === 'asc' || ud === 'desc' ? ud : NATURAL_DIR[us as SortId];
		} else if (ud === 'asc' || ud === 'desc') {
			sortDir = ud;
		}
		if (uv === 'table') view = 'table';
		urlHydrated = true;
	});

	// Universes — facets read these lazily via arrow-function accessors.
	let MODALITIES = $derived<string[]>(resolved?.modalities ?? []);
	let SIMPLIFIED_TYPES_PRESENT = $derived<string[]>(resolved?.simplifiedTypesPresent ?? []);
	let DOMAINS = $derived<string[]>(resolved?.domains ?? []);
	let LANGUAGES = $derived<string[]>(resolved?.languages ?? []);

	const typeFacet = createFacetFilter({
		urlParam: 'types',
		chipLabel: 'Type',
		universe: () => SIMPLIFIED_TYPES_PRESENT
	});
	const modalityFacet = createFacetFilter({
		urlParam: 'mods',
		chipLabel: 'Modality',
		universe: () => MODALITIES
	});
	const domainFacet = createFacetFilter({
		urlParam: 'doms',
		chipLabel: 'Domain',
		universe: () => DOMAINS
	});
	const languageFacet = createFacetFilter({
		urlParam: 'langs',
		chipLabel: 'Lang',
		universe: () => LANGUAGES
	});
	const facetGroup = createFacetGroup([typeFacet, modalityFacet, domainFacet, languageFacet]);

	$effect(() => {
		if (resolved) facetGroup.seed();
	});

	let domainQuery = $state('');
	let languageQuery = $state('');
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		return q ? DOMAINS.filter((d) => d.toLowerCase().includes(q)) : DOMAINS;
	});
	let filteredLanguages = $derived.by(() => {
		const q = languageQuery.trim().toLowerCase();
		return q ? LANGUAGES.filter((l) => l.toLowerCase().includes(q)) : LANGUAGES;
	});

	let chips = $derived.by<Chip[]>(() => {
		const list: Chip[] = facetGroup.seeded ? facetGroup.chips() : [];
		if (query.trim()) {
			list.push({
				key: 'q',
				label: `Name: "${query.trim()}"`,
				clear: () => (query = '')
			});
		}
		return list;
	});
	function resetAll() {
		facetGroup.resetAll();
		query = '';
	}

	let filteredAll = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// All on = filter off; empty pick set = nothing matches.
		const modalityOff = modalityFacet.allSelected;
		const simplifiedOff = typeFacet.allSelected;
		const domainOff = domainFacet.allSelected;
		const languageOff = languageFacet.allSelected;
		const modalities = modalityFacet.picked;
		const types = typeFacet.picked;
		const domains = domainFacet.picked;
		const languages = languageFacet.picked;
		const matches = (b: Benchmark) => {
			if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q))
				return false;
			if (!modalityOff && !(b.modalities ?? []).some((m) => modalities.has(m))) return false;
			if (!simplifiedOff && !(b.simplifiedTaskTypes ?? []).some((t) => types.has(t))) return false;
			if (!domainOff && !(b.domains ?? []).some((d) => domains.has(d))) return false;
			if (!languageOff && !(b.languages ?? []).some((l) => languages.has(l))) return false;
			return true;
		};
		const dir = sortDir === 'asc' ? 1 : -1;
		const cmp = (a: Benchmark, b: Benchmark) => {
			let c = 0;
			if (sort === 'name') c = a.displayName.localeCompare(b.displayName);
			else if (sort === 'tasks') c = a.tasks.length - b.tasks.length;
			else if (sort === 'languages') c = a.languages.length - b.languages.length;
			else if (sort === 'models') c = (a.numModels ?? 0) - (b.numModels ?? 0);
			if (c === 0) c = a.displayName.localeCompare(b.displayName);
			return dir * c;
		};
		const matched: Benchmark[] = [];
		for (const b of allBenchmarks) if (matches(b)) matched.push(b);
		matched.sort(cmp);
		return matched;
	});
</script>

<ShareMeta
	title="All benchmarks"
	description={`Every benchmark registered in MTEB — ${allBenchmarks.length || '100+'} suites spanning multilingual, multimodal, retrieval, classification, clustering, semantic similarity, and domain-specific evaluations.`}
/>

<div class="layout-sidebar">
	<main id="main-content" tabindex="-1" class="layout-main main">
		<header class="hero">
			<h1>All benchmarks</h1>
			<p class="lead">
				Every benchmark registered in mteb — including ones that aren't on the curated explorer
				menu. Use the search box to find a benchmark by name.
			</p>
			<p class="contribute-note">
				To add your benchmark, follow our
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_benchmark/"
					target="_blank"
					rel="noreferrer">contributor guide</a
				>.
			</p>
		</header>

		<div class="toolbar">
			<SearchInput
				bind:value={query}
				placeholder="Search benchmarks…"
				ariaLabel="Search benchmarks"
			/>
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
			<ViewModeToggle value={view} onChange={(v) => (view = v)} />
			<span class="count">
				{filteredAll.length} / {allBenchmarks.length}
			</span>
		</div>

		{#if !resolved && !loadError}
			<SkeletonGrid />
		{:else if loadError}
			<p class="muted">Failed to load: {loadError}</p>
		{:else if filteredAll.length === 0}
			<p class="muted">No benchmark matches that search.</p>
		{:else if view === 'table'}
			<BenchmarksTable rows={filteredAll} sort={sortAdapter} />
		{:else}
			<section class="block">
				<header class="block-head">
					<h2>Benchmarks</h2>
					<span class="count">{filteredAll.length}</span>
				</header>
				<div class="grid card-grid">
					{#each filteredAll as b (b.name)}
						<BenchmarkCard {b} />
					{/each}
				</div>
			</section>
		{/if}
	</main>

	<FilterSidebar>
		<ActiveFilterStrip {chips} onResetAll={resetAll} />
		<!-- `type-fill` paints checked chips in the shared primary tint
		     across every facet on this page, instead of the per-stype
		     colour /tasks uses for its Task group. -->
		<FilterFacet
			label="Task group"
			items={SIMPLIFIED_TYPES_PRESENT}
			picked={typeFacet.picked}
			onToggle={(t) => typeFacet.toggle(t)}
			onToggleAll={() => typeFacet.toggleAll()}
			allSelected={typeFacet.allSelected}
			pillClass="type-fill"
		/>
		<FilterFacet
			label="Modality"
			items={MODALITIES}
			picked={modalityFacet.picked}
			onToggle={(m) => modalityFacet.toggle(m)}
			onToggleAll={() => modalityFacet.toggleAll()}
			allSelected={modalityFacet.allSelected}
			pillClass="modality-fill"
			pillAttrs={(m) => ({ 'data-modality': m })}
		>
			{#snippet pillIcon(m)}<ModalityIcon modality={m} size={12} />{/snippet}
		</FilterFacet>
		<FilterFacet
			label="Domain"
			items={visibleDomains}
			picked={domainFacet.picked}
			onToggle={(d) => domainFacet.toggle(d)}
			onToggleAll={() => domainFacet.toggleAll()}
			allSelected={domainFacet.allSelected}
			pillClass="type-fill"
			searchPlaceholder="Search domains…"
			bind:searchValue={domainQuery}
			scrollable
			emptyMessage="No domains match."
		/>
		<FilterFacet
			label="Language"
			items={filteredLanguages}
			picked={languageFacet.picked}
			onToggle={(l) => languageFacet.toggle(l)}
			onToggleAll={() => languageFacet.toggleAll()}
			allSelected={languageFacet.allSelected}
			pillClass="type-fill"
			searchPlaceholder="Search languages…"
			bind:searchValue={languageQuery}
			scrollable
			grow
			emptyMessage="No languages match."
		/>
	</FilterSidebar>
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
	/* Tighter top padding than the shared `.layout-main` default so the
	   catalogue hero sits closer to the top bar. */
	.main {
		padding: 18px 28px 64px;
	}
	.hero {
		padding: 28px 0 18px;
	}
	h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.08;
		margin: 0 0 10px;
		color: var(--ink-strong);
	}
	.lead {
		font-size: 15px;
		line-height: 1.55;
	}

	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.block {
		margin: 22px 0;
	}
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.block-head h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	/* Slightly wider gap than `.card-grid`'s 12 px so the per-section
	   blocks breathe. */
	.grid {
		gap: 14px;
	}
	.muted {
		padding: 20px 0;
	}
</style>
