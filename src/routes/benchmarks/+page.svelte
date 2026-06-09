<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarks } from '$lib/data/service';
	import type { Benchmark } from '$lib/types';
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
	import type { SortState } from '$lib/stores/sort.svelte';
	import { getParam, updateUrl } from '$lib/url-state';

	let allBenchmarks = $state<Benchmark[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state(getParam('q') ?? '');

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
	// Default to "Model count" desc — popularity is the most useful first
	// impression when browsing the benchmark catalogue.
	const DEFAULT_SORT: SortId = 'models';
	const initialSort = getParam('sort');
	const initialDir = getParam('dir');
	const seedSort: SortId =
		initialSort && (SORT_IDS as readonly string[]).includes(initialSort)
			? (initialSort as SortId)
			: DEFAULT_SORT;
	let sort = $state<SortId>(seedSort);
	let sortDir = $state<SortDir>(
		initialDir === 'asc' || initialDir === 'desc' ? initialDir : NATURAL_DIR[seedSort]
	);
	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	// URL-backed view mode (cards default) and a SortState adapter that
	// lets the table's `SortHeader` drive the same sort/sortDir as the
	// dropdown.
	const initialView = getParam('view');
	let view = $state<ViewMode>(initialView === 'table' ? 'table' : 'cards');
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
		updateUrl({
			q: query.trim() || null,
			sort: sort === DEFAULT_SORT ? null : sort,
			dir: sortDir === NATURAL_DIR[sort] ? null : sortDir,
			view: view === 'cards' ? null : view
		});
	});

	// Filter sets are seeded with every value so the default state is
	// "everything on"; `filteredAll` treats `size === ALL.length` as filter-off
	// so rows with empty modality / type / domain lists stay visible.
	let MODALITIES = $state<string[]>([]);
	let SIMPLIFIED_TYPES_PRESENT = $state<string[]>([]);
	let DOMAINS = $state<string[]>([]);
	let LANGUAGES = $state<string[]>([]);
	const modalityFilter = new SvelteSet<string>();
	const simplifiedTypeFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();
	const languageFilter = new SvelteSet<string>();
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

	function toggleModality(m: string) {
		if (modalityFilter.has(m)) modalityFilter.delete(m);
		else modalityFilter.add(m);
	}
	function toggleDomain(d: string) {
		if (domainFilter.has(d)) domainFilter.delete(d);
		else domainFilter.add(d);
	}
	function toggleAllModalities() {
		if (modalityFilter.size === MODALITIES.length) modalityFilter.clear();
		else for (const v of MODALITIES) modalityFilter.add(v);
	}
	function toggleAllDomains() {
		if (domainFilter.size === DOMAINS.length) domainFilter.clear();
		else for (const v of DOMAINS) domainFilter.add(v);
	}
	function toggleSimplifiedType(t: string) {
		if (simplifiedTypeFilter.has(t)) simplifiedTypeFilter.delete(t);
		else simplifiedTypeFilter.add(t);
	}
	function toggleAllSimplifiedTypes() {
		if (simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length) simplifiedTypeFilter.clear();
		else for (const v of SIMPLIFIED_TYPES_PRESENT) simplifiedTypeFilter.add(v);
	}
	function toggleLanguage(l: string) {
		if (languageFilter.has(l)) languageFilter.delete(l);
		else languageFilter.add(l);
	}
	function toggleAllLanguages() {
		if (languageFilter.size === LANGUAGES.length) languageFilter.clear();
		else for (const v of LANGUAGES) languageFilter.add(v);
	}
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);
	let allSimplifiedTypes = $derived(simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);
	let allLanguages = $derived(languageFilter.size === LANGUAGES.length);

	$effect(() => {
		loadBenchmarks(true)
			.then((list) => {
				allBenchmarks = list.sort((a, b) => a.displayName.localeCompare(b.displayName));
				// Single pass over the catalog to fill all 3 facet sets, instead of
				// three separate flatMap+Set traversals. Plain Set is correct
				// here — used as a local accumulator, never read reactively.
				/* eslint-disable svelte/prefer-svelte-reactivity */
				const mods = new Set<string>();
				const simpTypes = new Set<string>();
				const doms = new Set<string>();
				// Count per language so the filter pills sort by popularity.
				const langCount = new Map<string, number>();
				/* eslint-enable svelte/prefer-svelte-reactivity */
				for (const b of list) {
					if (b.modalities) for (const m of b.modalities) mods.add(m);
					if (b.simplifiedTaskTypes) for (const t of b.simplifiedTaskTypes) simpTypes.add(t);
					if (b.domains) for (const d of b.domains) doms.add(d);
					if (b.languages)
						for (const l of b.languages) langCount.set(l, (langCount.get(l) ?? 0) + 1);
				}
				MODALITIES = [...mods].sort();
				// Order the simplified buckets the same way /tasks does (curated
				// canonical first, then any extras) so users see the familiar
				// "retrieval / classification / …" sequence.
				const CURATED = [
					'retrieval',
					'classification',
					'pair-classification',
					'clustering',
					'semantic-similarity'
				];
				SIMPLIFIED_TYPES_PRESENT = [
					...CURATED.filter((t) => simpTypes.has(t)),
					...[...simpTypes].filter((t) => !CURATED.includes(t)).sort()
				];
				DOMAINS = [...doms].sort();
				// Descending by usage count, alphabetical tie-break.
				LANGUAGES = [...langCount.entries()]
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
					.map(([l]) => l);
				for (const v of MODALITIES) modalityFilter.add(v);
				for (const v of SIMPLIFIED_TYPES_PRESENT) simplifiedTypeFilter.add(v);
				for (const v of DOMAINS) domainFilter.add(v);
				for (const v of LANGUAGES) languageFilter.add(v);
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	// Off-menu benchmarks sort alongside the featured ones — the per-card
	// "newer version available" hint already distinguishes them.
	let filteredAll = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// "All on" = filter off; partial = intersection check; empty =
		// the user deliberately cleared the category, so nothing matches.
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const simplifiedOff = simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		const languageOff = languageFilter.size === LANGUAGES.length;
		const matches = (b: Benchmark) => {
			if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q))
				return false;
			if (!modalityOff && !(b.modalities ?? []).some((m) => modalityFilter.has(m))) return false;
			if (!simplifiedOff && !(b.simplifiedTaskTypes ?? []).some((t) => simplifiedTypeFilter.has(t)))
				return false;
			if (!domainOff && !(b.domains ?? []).some((d) => domainFilter.has(d))) return false;
			if (!languageOff && !(b.languages ?? []).some((l) => languageFilter.has(l))) return false;
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

		{#if loading}
			<SkeletonGrid />
		{:else if error}
			<p class="muted">Failed to load: {error}</p>
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
		<!-- `type-fill` paints checked chips in the shared primary tint
		     across every facet on this page, instead of the per-stype
		     colour /tasks uses for its Task group. -->
		<FilterFacet
			label="Task group"
			items={SIMPLIFIED_TYPES_PRESENT}
			picked={simplifiedTypeFilter}
			onToggle={toggleSimplifiedType}
			onToggleAll={toggleAllSimplifiedTypes}
			allSelected={allSimplifiedTypes}
			pillClass="type-fill"
		/>
		<FilterFacet
			label="Modality"
			items={MODALITIES}
			picked={modalityFilter}
			onToggle={toggleModality}
			onToggleAll={toggleAllModalities}
			allSelected={allModalities}
			pillClass="modality-fill"
			pillAttrs={(m) => ({ 'data-modality': m })}
		>
			{#snippet pillIcon(m)}<ModalityIcon modality={m} size={12} />{/snippet}
		</FilterFacet>
		<FilterFacet
			label="Domain"
			items={visibleDomains}
			picked={domainFilter}
			onToggle={toggleDomain}
			onToggleAll={toggleAllDomains}
			allSelected={allDomains}
			pillClass="type-fill"
			searchPlaceholder="Search domains…"
			bind:searchValue={domainQuery}
			scrollable
			emptyMessage="No domains match."
		/>
		<FilterFacet
			label="Language"
			items={filteredLanguages}
			picked={languageFilter}
			onToggle={toggleLanguage}
			onToggleAll={toggleAllLanguages}
			allSelected={allLanguages}
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
