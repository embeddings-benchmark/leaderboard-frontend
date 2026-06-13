<script lang="ts">
	import { onMount } from 'svelte';
	import { safeIdle } from '$lib/idle';
	import ActiveFilterStrip, { type Chip } from '$lib/components/ActiveFilterStrip.svelte';
	import FilterFacet from '$lib/components/FilterFacet.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import TaskCard from '$lib/components/TaskCard.svelte';
	import TasksTable from '$lib/components/TasksTable.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SkeletonGrid from '$lib/components/SkeletonGrid.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import ViewModeToggle, { type ViewMode } from '$lib/components/ViewModeToggle.svelte';
	import type { SortState } from '$lib/stores/sort.svelte';
	import { ariaSort, COLLATOR, sortIcon } from '$lib/format';
	import { createFacetFilter, createFacetGroup } from '$lib/stores/facet-filter.svelte';
	import { getParam, updateUrl } from '$lib/url-state';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import type { PageData } from './$types';
	import type { TasksData } from './+page';

	let { data }: { data: PageData } = $props();

	// Curated order — matches the `.type-pill[data-stype=…]` palette below.
	const SIMPLIFIED_TYPES = [
		'retrieval',
		'classification',
		'pair-classification',
		'clustering',
		'semantic-similarity'
	] as const;

	// Stale-guard via `data.tasks === p` on rapid nav.
	let resolved = $state<TasksData | null>(null);
	let loadError = $state<string | null>(null);
	$effect(() => {
		const p = data.tasks;
		loadError = null;
		p.then((r) => {
			if (data.tasks === p) resolved = r;
		}).catch((e) => {
			if (data.tasks === p) loadError = e instanceof Error ? e.message : String(e);
		});
	});

	// Defaults to empty so downstream derived blocks don't throw on undefined.
	let ALL_TASKS = $derived(resolved?.tasks ?? []);
	let SIMPLIFIED_PRESENT = $derived(resolved?.simplifiedPresent ?? []);
	let MODALITIES = $derived(resolved?.modalities ?? []);
	let DOMAINS = $derived(resolved?.domains ?? []);
	let LANGUAGES = $derived(resolved?.languages ?? []);

	const SORTS = [
		{ id: 'models', label: 'Model count' },
		{ id: 'name', label: 'Name' },
		{ id: 'type', label: 'Type' },
		{ id: 'benchmarks', label: 'Benchmark count' },
		{ id: 'languages', label: 'Language count' },
		{ id: 'metric', label: 'Main metric' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		models: 'desc',
		name: 'asc',
		type: 'asc',
		benchmarks: 'desc',
		languages: 'desc',
		metric: 'asc'
	};

	let query = $state('');
	const typeFacet = createFacetFilter({
		urlParam: 'types',
		chipLabel: 'Type',
		universe: () => SIMPLIFIED_PRESENT
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

	// Defaults seed first; onMount below syncs from URL to avoid hydration mismatch.
	const SORT_IDS = new Set(SORTS.map((s) => s.id));
	const DEFAULT_SORT: SortId = 'models';
	let sort = $state<SortId>(DEFAULT_SORT);
	let sortDir = $state<SortDir>(NATURAL_DIR[DEFAULT_SORT]);
	let urlHydrated = $state(false);
	$effect(() => {
		if (!urlHydrated) return;
		const isDefault = sort === DEFAULT_SORT && sortDir === NATURAL_DIR[DEFAULT_SORT];
		updateUrl({
			's.tasks': isDefault ? null : sort,
			'd.tasks': isDefault ? null : sortDir
		});
	});

	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	// View mode: card grid (default) vs sortable table.
	let view = $state<ViewMode>('cards');
	$effect(() => {
		if (!urlHydrated) return;
		updateUrl({ view: view === 'cards' ? null : view });
	});

	$effect(() => {
		if (!urlHydrated || !facetGroup.seeded) return;
		updateUrl(facetGroup.urlPatch());
	});

	onMount(() => {
		const us = getParam('s.tasks');
		const ud = getParam('d.tasks');
		const uv = getParam('view');
		if (us && SORT_IDS.has(us as SortId)) {
			sort = us as SortId;
			sortDir = ud === 'asc' || ud === 'desc' ? ud : NATURAL_DIR[us as SortId];
		} else if (ud === 'asc' || ud === 'desc') {
			sortDir = ud;
		}
		if (uv === 'table') view = 'table';
		urlHydrated = true;
	});

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

	let domainQuery = $state('');
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		if (!q) return DOMAINS;
		return DOMAINS.filter((d) => d.toLowerCase().includes(q));
	});

	let languageQuery = $state('');
	let filteredLanguages = $derived.by(() => {
		const q = languageQuery.trim().toLowerCase();
		if (!q) return LANGUAGES;
		return LANGUAGES.filter((l) => l.toLowerCase().includes(q));
	});

	const SIMPLIFIED_RANK: Record<string, number> = Object.fromEntries(
		SIMPLIFIED_TYPES.map((t, i) => [t, i])
	);
	function typeRank(t: string): number {
		return SIMPLIFIED_RANK[t] ?? SIMPLIFIED_TYPES.length;
	}

	// Split filter / sort so keystrokes don't trigger a re-sort.
	let matched = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// All on = filter off; empty pick set = nothing matches.
		const typeOff = typeFacet.allSelected;
		const modalityOff = modalityFacet.allSelected;
		const domainOff = domainFacet.allSelected;
		const languageOff = languageFacet.allSelected;
		const types = typeFacet.picked;
		const modalities = modalityFacet.picked;
		const domains = domainFacet.picked;
		const languages = languageFacet.picked;
		return ALL_TASKS.filter((t) => {
			if (q && !t.nameLower.includes(q)) return false;
			if (!typeOff && !types.has(t.simplifiedType)) return false;
			if (!modalityOff && !t.modalities.some((m) => modalities.has(m))) return false;
			if (!domainOff && !t.domains.some((d) => domains.has(d))) return false;
			if (!languageOff && !t.languages.some((l) => languages.has(l))) return false;
			return true;
		});
	});
	let filtered = $derived.by(() => {
		const list = [...matched];
		// Stable tie-break by name; sortDir flips ascending cmp at the end.
		list.sort((a, b) => {
			let cmp: number;
			if (sort === 'name') {
				cmp = COLLATOR.compare(a.name, b.name);
			} else if (sort === 'type') {
				const r = typeRank(a.simplifiedType) - typeRank(b.simplifiedType);
				cmp = r !== 0 ? r : COLLATOR.compare(a.simplifiedType, b.simplifiedType);
			} else if (sort === 'benchmarks') {
				cmp = a.benchmarks.length - b.benchmarks.length;
			} else if (sort === 'languages') {
				cmp = a.languages.length - b.languages.length;
			} else if (sort === 'models') {
				cmp = a.numModels - b.numModels;
			} else if (sort === 'metric') {
				cmp = COLLATOR.compare(a.mainScore, b.mainScore);
			} else {
				cmp = 0;
			}
			if (cmp === 0) return COLLATOR.compare(a.name, b.name);
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return list;
	});

	// Progressive render: paint the first chunk synchronously so the user
	// sees content within one frame, then push the rest in idle slots so
	// the heavy DOM creation never blocks the initial paint. The effect
	// fires on every `filtered.length` change — including the rapid burst
	// of filter-set seeding during data load. We coalesce restarts with a
	// 80 ms debounce so a storm of mutations doesn't permanently reset
	// the grow chain to its initial chunk.
	const INITIAL_CHUNK = 60;
	const CHUNK_STEP = 200;
	let visibleCount = $state(INITIAL_CHUNK);
	let growVersion = 0;
	let lastFilteredSignature = '';
	let kickoffTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const total = filtered.length;
		// Signature = length + first/last row name. Catches all real filter
		// changes (count change OR same count but different rows from sort)
		// while letting our own writes to `visibleCount` re-fire the effect
		// harmlessly (signature unchanged → bail, chain keeps growing).
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
	let visibleTasks = $derived(filtered.slice(0, visibleCount));
</script>

<ShareMeta
	title="Tasks"
	description={`Every task across every benchmark on the MTEB Leaderboard — ${ALL_TASKS.length || '1700+'} entries spanning retrieval, classification, clustering, pair classification, and semantic similarity.`}
/>

<div class="layout-sidebar">
	<main id="main-content" tabindex="-1" class="layout-main">
		<header class="hero index-hero">
			<h1>Tasks</h1>
			<p class="lead">
				Every task across every benchmark, deduped by name. Click a card to see how each model
				performs on that task.
			</p>
			<p class="contribute-note">
				To add your task, follow our
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_dataset/"
					target="_blank"
					rel="noreferrer">contributor guide</a
				>. Already have model scores? See the
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/submitting_results/"
					target="_blank"
					rel="noreferrer">submitting results guide</a
				>.
			</p>
		</header>

		<!-- Toolbar stays outside the loading branch so the search input +
		     sort widget are interactive immediately and the cards land in
		     the same position they'd be without the skeleton. The match
		     count hides while data loads to avoid the misleading "0/0". -->
		<div class="toolbar">
			<SearchInput
				bind:value={query}
				placeholder="Search tasks by name…"
				ariaLabel="Search tasks"
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
			{#if resolved && !loadError}
				<span class="count">{filtered.length} / {ALL_TASKS.length}</span>
			{/if}
		</div>

		{#if !resolved && !loadError}
			<SkeletonGrid />
		{:else if loadError}
			<p class="empty">Failed to load tasks: {loadError}</p>
		{:else if filtered.length === 0}
			<p class="empty">No tasks match those filters.</p>
		{:else if view === 'table'}
			<TasksTable rows={filtered} sort={sortAdapter} />
		{:else}
			<div class="grid card-grid" data-loaded>
				{#each visibleTasks as t (t.name)}
					<TaskCard
						name={t.name}
						type={t.type}
						simplifiedType={t.simplifiedType}
						description={t.description}
						modalities={t.modalities}
						stats={[
							{ label: 'Benchmarks', value: t.benchmarks.length },
							{ label: 'Languages', value: t.languages.length },
							{ label: 'Models', value: t.numModels },
							{ label: 'Main metric', value: t.mainScore || '—', variant: 'metric' }
						]}
					/>
				{/each}
			</div>
		{/if}
	</main>

	<FilterSidebar>
		<ActiveFilterStrip {chips} onResetAll={resetAll} />
		<!-- `data-stype` drives the per-stype checked-state tint
		     defined in this page's local CSS (Task group is the one
		     facet here that uses the per-category palette rather than
		     the shared primary tint). -->
		<FilterFacet
			label="Task group"
			items={SIMPLIFIED_PRESENT}
			picked={typeFacet.picked}
			onToggle={(t) => typeFacet.toggle(t)}
			onToggleAll={() => typeFacet.toggleAll()}
			allSelected={typeFacet.allSelected}
			pillClass="type-pill"
			pillAttrs={(t) => ({ 'data-stype': t })}
		/>
		<FilterFacet
			label="Modality"
			items={MODALITIES}
			picked={modalityFacet.picked}
			onToggle={(m) => modalityFacet.toggle(m)}
			onToggleAll={() => modalityFacet.toggleAll()}
			allSelected={modalityFacet.allSelected}
			pillClass="modality-fill"
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
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
