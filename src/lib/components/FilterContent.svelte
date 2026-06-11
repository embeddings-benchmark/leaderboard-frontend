<script lang="ts">
	import { untrack } from 'svelte';
	import {
		filters,
		MODEL_MODALITIES,
		MODEL_TYPES,
		SIZE_LOG_MIN,
		SIZE_LOG_MAX,
		type ZeroShotMode,
		type Availability,
		type InstructionMode
	} from '$lib/stores/filters.svelte';
	import ActiveFilterStrip from './ActiveFilterStrip.svelte';
	import FilterFacet from './FilterFacet.svelte';
	import HoverPortal from './HoverPortal.svelte';
	import InfoDot from './InfoDot.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import RangeSlider from './RangeSlider.svelte';
	import Segmented from './Segmented.svelte';
	import Switch from './Switch.svelte';
	import { clampTooltipX } from '$lib/cell-hover';
	import { humanizeType } from '$lib/format';

	// Size slider works in log10(M-of-params). Bounds are derived per benchmark
	// from filters.availableMin/MaxModelSizeM and clamp into the global
	// [SIZE_LOG_MIN, SIZE_LOG_MAX] window so the math stays well-defined when
	// no benchmark is loaded yet.
	let sizeLogMin = $derived(
		Math.max(SIZE_LOG_MIN, Math.log10(Math.max(filters.availableMinModelSizeM, 1)))
	);
	let sizeLogMax = $derived(
		Math.min(SIZE_LOG_MAX, Math.log10(Math.max(filters.availableMaxModelSizeM, 1)))
	);
	function paramsToLog(m: number): number {
		return Math.max(sizeLogMin, Math.min(sizeLogMax, Math.log10(Math.max(m, 1))));
	}
	function logToParams(v: number): number {
		return Math.pow(10, v);
	}
	function formatParams(mm: number): string {
		if (mm >= 1_000_000) {
			const t = mm / 1_000_000;
			return t >= 100 ? `${t.toFixed(0)}T` : `${t.toFixed(1)}T`;
		}
		if (mm >= 1_000) {
			const b = mm / 1_000;
			return b >= 100 ? `${b.toFixed(0)}B` : `${b.toFixed(1)}B`;
		}
		if (mm >= 1) {
			return mm >= 100 ? `${mm.toFixed(0)}M` : `${mm.toFixed(1)}M`;
		}
		return `${(mm * 1000).toFixed(0)}K`;
	}
	function formatLog(v: number): string {
		return formatParams(logToParams(v));
	}
	// Inverse of `formatParams` — accepts "500K", "5M", "1.2 B", "3T",
	// or a bare number (treated as millions, matching the underlying
	// `minModelSizeM` store unit). Returns log-space units so it slots
	// directly into the slider's value space. Returns null for
	// unparseable input so the slider snaps back to the previous value.
	function parseLog(s: string): number | null {
		const m = s.trim().match(/^([0-9]*\.?[0-9]+)\s*([KMBT]?)$/i);
		if (!m) return null;
		const n = parseFloat(m[1]);
		if (Number.isNaN(n)) return null;
		const unit = m[2].toUpperCase();
		const inMillions =
			unit === 'K' ? n / 1000 : unit === 'B' ? n * 1000 : unit === 'T' ? n * 1_000_000 : n; // bare or 'M' → already in millions
		return paramsToLog(inMillions);
	}

	// Distribute ~4 tick marks across the benchmark's log-size window. Both
	// endpoints are pinned so the rightmost tick aligns with the slider's
	// edge — otherwise spans that don't divide evenly into ``stepDecades``
	// leave a visible gap (e.g. 2.3 → 3.8 with step 0.5 stops at 6.3B even
	// though the slider's right edge is 10B).
	let sizeTicks = $derived.by(() => {
		const lo = sizeLogMin;
		const hi = sizeLogMax;
		if (hi <= lo) return [lo];
		const span = hi - lo;
		const stepDecades = span >= 3 ? 1 : span >= 1.5 ? 0.5 : span / 3;
		const ticks: number[] = [lo];
		// Half of a step is the threshold below which a tick visually collides
		// with the endpoint — skip intermediates that come too close to lo/hi.
		const minGap = stepDecades * 0.5;
		let v = Math.ceil((lo + 1e-6) / stepDecades) * stepDecades;
		while (v < hi - 1e-3) {
			if (v - lo >= minGap && hi - v >= minGap) ticks.push(v);
			v += stepDecades;
		}
		ticks.push(hi);
		return ticks.map((t) => Math.round(t * 100) / 100);
	});

	interface Props {
		defaultModelOpen?: boolean;
		defaultScopeOpen?: boolean;
		// On pages without a benchmark context (e.g. the Models directory) the
		// Customize / Benchmark scope section is irrelevant — hide it entirely.
		hideScope?: boolean;
		// On pages where the sidebar only ever shows model filters (Models
		// directory), drop the collapsible "Model filters" card chrome so the
		// controls read as the section itself instead of a card-in-a-sidebar.
		flatModel?: boolean;
		// /models is benchmark-agnostic, so the per-benchmark "Zero-shot"
		// segmented control doesn't apply there — hide it entirely.
		hideZeroShot?: boolean;
		// Optional inline "Language" facet shown inside the model-filters
		// block. Wired up only by /models, which holds the picked/available
		// state locally (it's the only page that filters models by language
		// — benchmark detail pages have their own language picker in the
		// benchmark scope section). When `languageOptions` is undefined or
		// empty the block is omitted entirely.
		languageOptions?: string[];
		languagesPicked?: Set<string>;
		onToggleLanguage?: (l: string) => void;
		onToggleAllLanguages?: () => void;
		// Reset the page-local language pick set back to "all selected".
		// Distinct from `onToggleAllLanguages` (which flips between empty
		// and full): `resetAll` always wants the full-selected state.
		onResetLanguages?: () => void;
	}
	let {
		defaultModelOpen = true,
		defaultScopeOpen = false,
		hideScope = false,
		flatModel = false,
		hideZeroShot = false,
		languageOptions,
		languagesPicked,
		onToggleLanguage,
		onToggleAllLanguages,
		onResetLanguages
	}: Props = $props();

	let modelLangQuery = $state('');
	let filteredModelLangs = $derived.by(() => {
		const all = languageOptions ?? [];
		const q = modelLangQuery.trim().toLowerCase();
		return q ? all.filter((l) => l.toLowerCase().includes(q)) : all;
	});
	let allModelLangsOn = $derived(
		!!languagesPicked && !!languageOptions && languagesPicked.size === languageOptions.length
	);

	let modelOpen = $state(untrack(() => defaultModelOpen));
	let scopeOpen = $state(untrack(() => defaultScopeOpen));
	let langQuery = $state('');
	let taskQuery = $state('');

	const AVAILABILITY_OPTS: { label: string; value: Availability }[] = [
		{ label: 'Both', value: 'both' },
		{ label: 'Open', value: 'open' },
		{ label: 'Proprietary', value: 'proprietary' }
	];
	const ZERO_SHOT_OPTS: { label: string; value: ZeroShotMode }[] = [
		{ label: 'Allow all', value: 'allow_all' },
		{ label: 'Remove unknown', value: 'remove_unknown' },
		{ label: 'Only zero-shot', value: 'only_zero_shot' }
	];
	const INSTRUCTION_OPTS: { label: string; value: InstructionMode }[] = [
		{ label: 'Both', value: 'both' },
		{ label: 'Instruction-tuned', value: 'only_instruction' },
		{ label: 'Non-instruction', value: 'only_non_instruction' }
	];

	// Active-filter chip strip: each non-default filter becomes a removable chip.
	interface Chip {
		key: string;
		label: string;
		clear: () => void;
	}
	// Split into per-section derived so toggling a model filter doesn't
	// invalidate the customize chips (and vice versa) — each section only
	// re-runs when its own inputs change.
	let modelChips = $derived.by(() => {
		const list: Chip[] = [];
		if (filters.nameQuery.trim()) {
			list.push({
				key: 'name',
				label: `Name: "${filters.nameQuery.trim()}"`,
				clear: () => (filters.nameQuery = '')
			});
		}
		if (filters.availability !== 'both') {
			list.push({
				key: 'avail',
				label: filters.availability === 'open' ? 'Open only' : 'Proprietary only',
				clear: () => (filters.availability = 'both')
			});
		}
		if (filters.zeroShot !== 'allow_all') {
			list.push({
				key: 'zs',
				label: filters.zeroShot === 'only_zero_shot' ? 'Only zero-shot' : 'Hide unknown zero-shot',
				clear: () => (filters.zeroShot = 'allow_all')
			});
		}
		if (filters.instructions !== 'both') {
			list.push({
				key: 'inst',
				label:
					filters.instructions === 'only_instruction' ? 'Instruction-tuned' : 'Non-instruction',
				clear: () => (filters.instructions = 'both')
			});
		}
		if (filters.sentenceTransformersOnly) {
			list.push({
				key: 'st',
				label: 'ST compatible',
				clear: () => (filters.sentenceTransformersOnly = false)
			});
		}
		if (
			filters.minModelSizeM > filters.availableMinModelSizeM ||
			filters.maxModelSizeM < filters.availableMaxModelSizeM
		) {
			list.push({
				key: 'size',
				label: `Size ${formatParams(filters.minModelSizeM)}–${formatParams(filters.maxModelSizeM)}`,
				clear: () => {
					filters.minModelSizeM = filters.availableMinModelSizeM;
					filters.maxModelSizeM = filters.availableMaxModelSizeM;
				}
			});
		}
		if (filters.modelTypes.size !== MODEL_TYPES.length) {
			list.push({
				key: 'mtype',
				label: `Type · ${filters.modelTypes.size}/${MODEL_TYPES.length}`,
				clear: () => filters.setAll('modelTypes', MODEL_TYPES, true)
			});
		}
		if (filters.modelModalities.size !== MODEL_MODALITIES.length) {
			list.push({
				key: 'mmod',
				label: `Modality · ${filters.modelModalities.size}/${MODEL_MODALITIES.length}`,
				clear: () => filters.setAll('modelModalities', MODEL_MODALITIES, true)
			});
		}
		// Page-local Language pick set — only present on /models (passed via
		// `languagesPicked` / `languageOptions` / `onResetLanguages`). Without
		// this chip the active strip stays empty when the user has only
		// narrowed languages, which also hides the "Reset all" button.
		if (
			languagesPicked &&
			languageOptions &&
			languageOptions.length > 0 &&
			languagesPicked.size !== languageOptions.length &&
			onResetLanguages
		) {
			list.push({
				key: 'mlang',
				label: `Lang · ${languagesPicked.size}/${languageOptions.length}`,
				clear: () => onResetLanguages()
			});
		}
		return list;
	});
	let customizeChips = $derived.by(() => {
		const list: Chip[] = [];
		const hasTT = filters.availableTaskTypes.length > 0;
		if (hasTT && filters.taskTypes.size !== filters.availableTaskTypes.length) {
			list.push({
				key: 'tt',
				label: `Task type · ${filters.taskTypes.size}/${filters.availableTaskTypes.length}`,
				clear: () => filters.setAll('taskTypes', filters.availableTaskTypes, true)
			});
		}
		const hasD = filters.availableDomains.length > 0;
		if (hasD && filters.domains.size !== filters.availableDomains.length) {
			list.push({
				key: 'dom',
				label: `Domain · ${filters.domains.size}/${filters.availableDomains.length}`,
				clear: () => filters.setAll('domains', filters.availableDomains, true)
			});
		}
		const hasM = filters.availableModalities.length > 0;
		if (hasM && filters.modalities.size !== filters.availableModalities.length) {
			list.push({
				key: 'mod',
				label: `Modality · ${filters.modalities.size}/${filters.availableModalities.length}`,
				clear: () => filters.setAll('modalities', filters.availableModalities, true)
			});
		}
		const hasL = filters.availableLanguages.length > 0;
		if (hasL && filters.languages.size !== filters.availableLanguages.length) {
			list.push({
				key: 'lang',
				label: `Lang · ${filters.languages.size}/${filters.availableLanguages.length}`,
				clear: () => filters.setAll('languages', filters.availableLanguages, true)
			});
		}
		const hasT = filters.availableTasks.length > 0;
		if (hasT && filters.tasks.size !== filters.availableTasks.length) {
			list.push({
				key: 'task',
				label: `Task · ${filters.tasks.size}/${filters.availableTasks.length}`,
				clear: () =>
					filters.setAll(
						'tasks',
						filters.availableTasks.map((t) => t.name),
						true
					)
			});
		}
		return list;
	});
	let chips = $derived([...modelChips, ...customizeChips]);

	let activeModelCount = $derived.by(() => {
		let n = 0;
		if (filters.availability !== 'both') n++;
		if (filters.zeroShot !== 'allow_all') n++;
		if (filters.instructions !== 'both') n++;
		if (filters.sentenceTransformersOnly) n++;
		if (
			filters.minModelSizeM > filters.availableMinModelSizeM ||
			filters.maxModelSizeM < filters.availableMaxModelSizeM
		)
			n++;
		if (filters.modelTypes.size !== MODEL_TYPES.length) n++;
		if (filters.modelModalities.size !== MODEL_MODALITIES.length) n++;
		return n;
	});
	let activeScopeCount = $derived.by(() => {
		let n = 0;
		if (
			filters.availableTaskTypes.length > 0 &&
			filters.taskTypes.size !== filters.availableTaskTypes.length
		)
			n++;
		if (
			filters.availableDomains.length > 0 &&
			filters.domains.size !== filters.availableDomains.length
		)
			n++;
		if (
			filters.availableModalities.length > 0 &&
			filters.modalities.size !== filters.availableModalities.length
		)
			n++;
		if (
			filters.availableLanguages.length > 0 &&
			filters.languages.size !== filters.availableLanguages.length
		)
			n++;
		if (filters.availableTasks.length > 0 && filters.tasks.size !== filters.availableTasks.length)
			n++;
		return n;
	});

	let filteredLanguages = $derived.by(() => {
		// Lowercase + trim the query ONCE; `.filter` callback then only
		// lowercases each candidate (was redoing both per language).
		const q = langQuery.trim().toLowerCase();
		if (!q) return filters.availableLanguages;
		return filters.availableLanguages.filter((l) => l.toLowerCase().includes(q));
	});
	// Pre-sorted full list — sort is invariant under the search query, so
	// running it inside the per-keystroke derived was pure waste.
	let allTaskNamesSorted = $derived(
		filters.availableTasks.map((t) => t.name).sort((a, b) => a.localeCompare(b))
	);
	let filteredTasks = $derived.by(() => {
		const q = taskQuery.trim().toLowerCase();
		if (!q) return allTaskNamesSorted;
		return allTaskNamesSorted.filter((n) => n.toLowerCase().includes(q));
	});

	function resetAll() {
		filters.resetCustomize();
		filters.resetModelFilters();
		filters.nameQuery = '';
		// /models holds its language picks page-locally — call its
		// reset-to-full callback so "Reset all" wipes the language
		// narrowing too. No-op on pages that don't pass the callback.
		onResetLanguages?.();
	}

	// Tip portal for filter group-labels (mirrors the SummaryTable pattern
	// so the bubble carries real styling instead of relying on the slow,
	// unstyled native `title=` lag). Trigger nodes set `data-tip-title` /
	// `data-tip` and wire up the pointer handlers below.
	let tipState = $state({ visible: false, title: '', text: '', x: 0, y: 0 });
	const TIP_MAX_WIDTH = 320;
	function showTip(e: PointerEvent | FocusEvent) {
		const el = e.currentTarget as HTMLElement;
		const title = el.dataset.tipTitle ?? '';
		const text = el.dataset.tip ?? '';
		if (!text) return;
		const r = el.getBoundingClientRect();
		tipState = {
			visible: true,
			title,
			text,
			x: clampTooltipX(r.left + r.width / 2, TIP_MAX_WIDTH),
			y: r.bottom
		};
	}
	function hideTip() {
		tipState = { ...tipState, visible: false };
	}
</script>

<div class="filter-content">
	<ActiveFilterStrip {chips} onResetAll={resetAll} />

	{#snippet modelGroups()}
		<div class="group">
			<div class="group-label">Availability</div>
			<Segmented
				ariaLabel="Availability"
				options={AVAILABILITY_OPTS}
				value={filters.availability}
				onChange={(v) => (filters.availability = v)}
			/>
		</div>

		{#if !hideZeroShot}
			<div class="group">
				<div class="group-label">
					Zero-shot
					<button
						type="button"
						class="tip-anchor"
						aria-label="Zero-shot info"
						data-tip-title="Zero-shot"
						data-tip="Zero-shot indicates the portion of the benchmark a model has not been trained on. 'Only zero-shot' keeps fully out-of-distribution models; 'Hide unknown zero-shot' drops models whose training overlap is unknown."
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
						onclick={(e) => e.stopPropagation()}
					>
						<InfoDot ariaLabel="Zero-shot info" />
					</button>
				</div>
				<Segmented
					ariaLabel="Zero-shot"
					options={ZERO_SHOT_OPTS}
					value={filters.zeroShot}
					onChange={(v) => (filters.zeroShot = v)}
				/>
			</div>
		{/if}

		<div class="group">
			<div class="group-label">
				Model size
				<span class="muted-inline">
					{formatParams(filters.minModelSizeM)} – {formatParams(filters.maxModelSizeM)}
				</span>
			</div>
			<RangeSlider
				min={sizeLogMin}
				max={sizeLogMax}
				step={0.05}
				valueMin={paramsToLog(filters.minModelSizeM)}
				valueMax={paramsToLog(filters.maxModelSizeM)}
				onMinChange={(v) => (filters.minModelSizeM = logToParams(v))}
				onMaxChange={(v) => (filters.maxModelSizeM = logToParams(v))}
				format={formatLog}
				parse={parseLog}
				ticks={sizeTicks}
			/>
		</div>

		<div class="group">
			<div class="group-label">Instructions</div>
			<Segmented
				ariaLabel="Instructions"
				options={INSTRUCTION_OPTS}
				value={filters.instructions}
				onChange={(v) => (filters.instructions = v)}
			/>
		</div>

		<div class="group">
			<Switch
				label="Sentence-Transformers compatible"
				checked={filters.sentenceTransformersOnly}
				onChange={(v) => (filters.sentenceTransformersOnly = v)}
			/>
		</div>

		<FilterFacet
			label="Model type"
			items={MODEL_TYPES}
			picked={filters.modelTypes}
			onToggle={(t) => filters.toggleInSet('modelTypes', t)}
			onToggleAll={() =>
				filters.setAll('modelTypes', MODEL_TYPES, filters.modelTypes.size !== MODEL_TYPES.length)}
			allSelected={filters.modelTypes.size === MODEL_TYPES.length}
			pillClass="model-type-pill type-fill"
			pillAttrs={(t) => ({ 'data-type': t })}
		/>

		<FilterFacet
			label="Modality"
			items={MODEL_MODALITIES}
			picked={filters.modelModalities}
			onToggle={(m) => filters.toggleInSet('modelModalities', m)}
			onToggleAll={() =>
				filters.setAll(
					'modelModalities',
					MODEL_MODALITIES,
					filters.modelModalities.size !== MODEL_MODALITIES.length
				)}
			allSelected={filters.modelModalities.size === MODEL_MODALITIES.length}
			pillClass="modality-fill"
			pillAttrs={(m) => ({ 'data-modality': m })}
		>
			{#snippet pillIcon(m)}<ModalityIcon modality={m} size={12} />{/snippet}
		</FilterFacet>

		{#if languageOptions && languageOptions.length > 0 && languagesPicked}
			<!-- Language facet, only rendered when the host page wires up
			     `languageOptions` (currently /models). State lives in the
			     parent so the sidebar stays generic. -->
			<FilterFacet
				label="Language"
				items={filteredModelLangs}
				picked={languagesPicked}
				onToggle={(l) => onToggleLanguage?.(l)}
				onToggleAll={() => onToggleAllLanguages?.()}
				allSelected={allModelLangsOn}
				pillClass="type-fill"
				searchPlaceholder="Search languages…"
				bind:searchValue={modelLangQuery}
				scrollable
				grow
				emptyMessage="No matches."
			/>
		{/if}
	{/snippet}

	{#if flatModel}
		<!-- Flat layout: model filters render inline. Used on /models
		     where the sidebar only ever shows these controls — no need to nest
		     them in a collapsible "Model filters" card-in-a-sidebar. -->
		<div class="flat-groups">
			{@render modelGroups()}
		</div>
	{:else}
		<section class="block">
			<button
				type="button"
				class="block-head"
				onclick={() => (modelOpen = !modelOpen)}
				aria-expanded={modelOpen}
			>
				<span class="block-title">Model filters</span>
				{#if activeModelCount > 0}
					<span class="count-pill">{activeModelCount}</span>
				{/if}
				<span class="chev" class:open={modelOpen}>›</span>
			</button>
			{#if modelOpen}
				<div class="block-body">
					{@render modelGroups()}
				</div>
			{/if}
		</section>
	{/if}

	{#if !hideScope}
		<section class="block">
			<button
				type="button"
				class="block-head"
				onclick={() => (scopeOpen = !scopeOpen)}
				aria-expanded={scopeOpen}
			>
				<span class="block-title">Benchmark scope</span>
				{#if activeScopeCount > 0}
					<span class="count-pill">{activeScopeCount}</span>
				{/if}
				<span class="chev" class:open={scopeOpen}>›</span>
			</button>

			{#if scopeOpen}
				<div class="block-body">
					<FilterFacet
						label="Task type"
						items={filters.availableTaskTypes}
						picked={filters.taskTypes}
						onToggle={(tt) => filters.toggleInSet('taskTypes', tt)}
						onToggleAll={() =>
							filters.setAll(
								'taskTypes',
								filters.availableTaskTypes,
								filters.taskTypes.size !== filters.availableTaskTypes.length
							)}
						allSelected={filters.taskTypes.size === filters.availableTaskTypes.length}
						count={`${filters.taskTypes.size}/${filters.availableTaskTypes.length}`}
						pillClass="type-fill"
						pillLabel={humanizeType}
					/>

					<FilterFacet
						label="Domain"
						items={filters.availableDomains}
						picked={filters.domains}
						onToggle={(d) => filters.toggleInSet('domains', d)}
						onToggleAll={() =>
							filters.setAll(
								'domains',
								filters.availableDomains,
								filters.domains.size !== filters.availableDomains.length
							)}
						allSelected={filters.domains.size === filters.availableDomains.length}
						count={`${filters.domains.size}/${filters.availableDomains.length}`}
						pillClass="type-fill"
					/>

					{#if filters.availableModalities.length > 0}
						<FilterFacet
							label="Modality"
							items={filters.availableModalities}
							picked={filters.modalities}
							onToggle={(m) => filters.toggleInSet('modalities', m)}
							onToggleAll={() =>
								filters.setAll(
									'modalities',
									filters.availableModalities,
									filters.modalities.size !== filters.availableModalities.length
								)}
							allSelected={filters.modalities.size === filters.availableModalities.length}
							count={`${filters.modalities.size}/${filters.availableModalities.length}`}
							pillClass="modality-fill"
							pillAttrs={(m) => ({ 'data-modality': m })}
						>
							{#snippet pillIcon(m)}<ModalityIcon modality={m} size={12} />{/snippet}
						</FilterFacet>
					{/if}

					<FilterFacet
						label="Languages"
						items={filteredLanguages}
						picked={filters.languages}
						onToggle={(l) => filters.toggleInSet('languages', l)}
						onToggleAll={() =>
							filters.setAll(
								'languages',
								filters.availableLanguages,
								filters.languages.size !== filters.availableLanguages.length
							)}
						allSelected={filters.languages.size === filters.availableLanguages.length}
						count={`${filters.languages.size}/${filters.availableLanguages.length}`}
						pillClass="type-fill"
						searchPlaceholder="Search languages…"
						bind:searchValue={langQuery}
						scrollable
						emptyMessage="No matches."
					/>

					<FilterFacet
						label="Tasks"
						items={filteredTasks}
						picked={filters.tasks}
						onToggle={(t) => filters.toggleInSet('tasks', t)}
						onToggleAll={() =>
							filters.setAll(
								'tasks',
								filters.availableTasks.map((t) => t.name),
								filters.tasks.size !== filters.availableTasks.length
							)}
						allSelected={filters.tasks.size === filters.availableTasks.length}
						count={`${filters.tasks.size}/${filters.availableTasks.length}`}
						pillClass="type-fill"
						pillTextClass="pill-label"
						pillTitle={(name) => name}
						searchPlaceholder="Search tasks…"
						bind:searchValue={taskQuery}
						scrollable
						emptyMessage="No matches."
					/>
				</div>
			{/if}
		</section>
	{/if}
</div>

<HoverPortal visible={tipState.visible} title={tipState.title} x={tipState.x} y={tipState.y}>
	{tipState.text}
</HoverPortal>

<style>
	.filter-content {
		padding: 12px 14px 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		/* Scroll container when total content overflows the sidebar; also
		   bounds `.flat-groups` so its last facet can `flex: 1`. */
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	/* Block sections ---------------------------------------------------------- */
	/* `flex-shrink: 0`: flex column siblings shrink by default, and our
	   `overflow: hidden` (for rounded corners) would clip the body
	   instead of letting `.filter-content` scroll. */
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		flex-shrink: 0;
	}
	.block-head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px 14px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		text-align: left;
	}
	.block-head:hover {
		background: var(--surface-muted);
	}
	.block-title {
		flex: 1;
		letter-spacing: -0.005em;
	}
	.count-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 6px;
		background: var(--primary);
		color: var(--surface);
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
	}
	.chev {
		font-size: 18px;
		line-height: 1;
		color: var(--text-subtle);
		transform: rotate(90deg);
		transition: transform 0.18s ease;
	}
	.chev.open {
		transform: rotate(270deg);
	}
	.block-body {
		padding: 4px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		border-top: 1px solid var(--border);
	}
	/* Sibling of `.block` used in flat mode — no card chrome, just the groups.
	   `flex: 1; min-height: 0` fills `.filter-content` so the last facet
	   absorbs leftover height. The `> .group:last-child` rule lives in
	   `$lib/styles/sidebar.css` (shared with `.filters`). */
	.flat-groups {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 0 2px;
		flex: 1;
		min-height: 0;
	}

	/* Local `.group` only — wraps the Segmented controls + the
	   sentence-transformers switch + the size slider. FilterFacet
	   instances render their own `.group` from sidebar.css. */
	.group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.group-label {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--text);
	}
	/* Inline trigger for the HoverPortal — wrapper button owns the
	   data-tip attrs + pointer/focus listeners, so the bubble can render
	   real markup (vs the slow, unstyled native `title=` lag). Keyboard
	   focus also fires the tip via onfocusin/onfocusout. */
	.tip-anchor {
		display: inline-flex;
		align-items: center;
		padding: 0;
		background: none;
		border: none;
		cursor: help;
	}
	.tip-anchor:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: 999px;
	}
	.muted-inline {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
