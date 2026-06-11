<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
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
	import { decodeSet, encodeSet, getParam, updateUrl } from '$lib/url-state';
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

	// Loader streams the derived data so the page can paint a skeleton on
	// client-side nav (direct/prerendered visits hydrate with `data.tasks`
	// already resolved). Sync the resolved value into a local state slot,
	// guarding against stale promises if the route re-navigates mid-flight.
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

	// Safe-empty defaults so downstream `$derived` blocks (sort, filter,
	// matched, filtered) keep evaluating to empty arrays while the promise
	// is pending instead of throwing on undefined.
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
	// Filter sets start empty and are seeded with the full universe once the
	// loader promise resolves — `size === universe.length` is the "no filter
	// applied" signal (see "all on = filter off" in CLAUDE.md). The seed
	// runs once on first resolution; subsequent reseeds would clobber the
	// user's picks.
	const typeFilter = new SvelteSet<string>();
	const modalityFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();
	const languageFilter = new SvelteSet<string>();
	// `$state` (not a plain `let`) so the URL-write effect below sees
	// `filtersSeeded` flip from false → true and re-runs to register the
	// SvelteSets as dependencies. Without reactivity here the write effect
	// stayed bailed in its initial gated branch and never tracked toggles.
	let filtersSeeded = $state(false);
	$effect(() => {
		if (!resolved || filtersSeeded) return;
		filtersSeeded = true;
		// Restore explicit picks from the URL when present; otherwise seed
		// with the full universe so "all on = filter off" stays the default.
		const seed = (set: SvelteSet<string>, universe: readonly string[], param: string) => {
			const raw = getParam(param);
			if (raw !== null) {
				const present = new Set(universe);
				for (const v of decodeSet(raw)) if (present.has(v)) set.add(v);
			} else {
				for (const v of universe) set.add(v);
			}
		};
		seed(typeFilter, resolved.simplifiedPresent, 'types');
		seed(modalityFilter, resolved.modalities, 'mods');
		seed(domainFilter, resolved.domains, 'doms');
		seed(languageFilter, resolved.languages, 'langs');
	});

	// URL-backed sort (`?s.tasks=…&d.tasks=…`) so navigating to a task detail
	// page and back via the browser restores the user's sort choice. Reading
	// the URL at script-top would diverge between prerender (no query) and
	// client hydration (real query) → hydration mismatch. Default first, sync
	// from URL in `onMount` below, and gate the URL-write effects with
	// `urlHydrated` so they don't nuke the real query before the sync runs.
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

	// Filter sets → URL. Each set is omitted from the URL when it equals
	// the full universe (the "all on = filter off" default) so a clean
	// catalog visit stays a clean URL. Reads `.size` and the universe
	// lengths reactively so toggles flow through.
	$effect(() => {
		if (!urlHydrated || !filtersSeeded) return;
		updateUrl({
			types: typeFilter.size === SIMPLIFIED_PRESENT.length ? null : encodeSet(typeFilter),
			mods: modalityFilter.size === MODALITIES.length ? null : encodeSet(modalityFilter),
			doms: domainFilter.size === DOMAINS.length ? null : encodeSet(domainFilter),
			langs: languageFilter.size === LANGUAGES.length ? null : encodeSet(languageFilter)
		});
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

	function toggleType(t: string) {
		if (typeFilter.has(t)) typeFilter.delete(t);
		else typeFilter.add(t);
	}
	function toggleModality(m: string) {
		if (modalityFilter.has(m)) modalityFilter.delete(m);
		else modalityFilter.add(m);
	}
	function toggleDomain(d: string) {
		if (domainFilter.has(d)) domainFilter.delete(d);
		else domainFilter.add(d);
	}
	function toggleLanguage(l: string) {
		if (languageFilter.has(l)) languageFilter.delete(l);
		else languageFilter.add(l);
	}
	function toggleAllTypes() {
		if (typeFilter.size === SIMPLIFIED_PRESENT.length) typeFilter.clear();
		else for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
	}
	function toggleAllDomains() {
		if (domainFilter.size === DOMAINS.length) domainFilter.clear();
		else for (const v of DOMAINS) domainFilter.add(v);
	}
	function toggleAllModalities() {
		if (modalityFilter.size === MODALITIES.length) modalityFilter.clear();
		else for (const v of MODALITIES) modalityFilter.add(v);
	}
	function toggleAllLanguages() {
		if (languageFilter.size === LANGUAGES.length) languageFilter.clear();
		else for (const v of LANGUAGES) languageFilter.add(v);
	}
	let allTypes = $derived(typeFilter.size === SIMPLIFIED_PRESENT.length);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);
	let allLanguages = $derived(languageFilter.size === LANGUAGES.length);

	let chips = $derived.by<Chip[]>(() => {
		const list: Chip[] = [];
		if (filtersSeeded) {
			if (!allTypes) {
				list.push({
					key: 'types',
					label: `Type · ${typeFilter.size}/${SIMPLIFIED_PRESENT.length}`,
					clear: () => {
						typeFilter.clear();
						for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
					}
				});
			}
			if (!allModalities) {
				list.push({
					key: 'mods',
					label: `Modality · ${modalityFilter.size}/${MODALITIES.length}`,
					clear: () => {
						modalityFilter.clear();
						for (const v of MODALITIES) modalityFilter.add(v);
					}
				});
			}
			if (!allDomains) {
				list.push({
					key: 'doms',
					label: `Domain · ${domainFilter.size}/${DOMAINS.length}`,
					clear: () => {
						domainFilter.clear();
						for (const v of DOMAINS) domainFilter.add(v);
					}
				});
			}
			if (!allLanguages) {
				list.push({
					key: 'langs',
					label: `Lang · ${languageFilter.size}/${LANGUAGES.length}`,
					clear: () => {
						languageFilter.clear();
						for (const v of LANGUAGES) languageFilter.add(v);
					}
				});
			}
		}
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
		typeFilter.clear();
		for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
		modalityFilter.clear();
		for (const v of MODALITIES) modalityFilter.add(v);
		domainFilter.clear();
		for (const v of DOMAINS) domainFilter.add(v);
		languageFilter.clear();
		for (const v of LANGUAGES) languageFilter.add(v);
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

	// Split filter / sort so name-query keystrokes only re-run the cheap
	// filter pass; the sort only re-runs when sort key/dir or the matched
	// set identity changes.
	let matched = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// "All on" = filter off (skip the empty-`.some()` problem on rows
		// with empty modality / domain / type lists). Partial = intersection
		// check. Empty = the user cleared the category deliberately, so
		// nothing matches.
		const typeOff = typeFilter.size === SIMPLIFIED_PRESENT.length;
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		const languageOff = languageFilter.size === LANGUAGES.length;
		return ALL_TASKS.filter((t) => {
			if (q && !t.nameLower.includes(q)) return false;
			if (!typeOff && !typeFilter.has(t.simplifiedType)) return false;
			if (!modalityOff && !t.modalities.some((m) => modalityFilter.has(m))) return false;
			if (!domainOff && !t.domains.some((d) => domainFilter.has(d))) return false;
			if (!languageOff && !t.languages.some((l) => languageFilter.has(l))) return false;
			return true;
		});
	});
	let filtered = $derived.by(() => {
		const list = [...matched];
		// Comparator computes ascending cmp; sortDir flips at the end. Name
		// tie-break stays stable so equal rows don't reshuffle on direction toggle.
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
			picked={typeFilter}
			onToggle={toggleType}
			onToggleAll={toggleAllTypes}
			allSelected={allTypes}
			pillClass="type-pill"
			pillAttrs={(t) => ({ 'data-stype': t })}
		/>
		<FilterFacet
			label="Modality"
			items={MODALITIES}
			picked={modalityFilter}
			onToggle={toggleModality}
			onToggleAll={toggleAllModalities}
			allSelected={allModalities}
			pillClass="modality-fill"
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
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
