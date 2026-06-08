<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		items: readonly string[];
		picked: Set<string>;
		onToggle: (item: string) => void;
		onToggleAll: () => void;
		allSelected: boolean;
		// Optional fraction shown next to the label, e.g. `5/10`.
		count?: string;
		pillClass?: string;
		// Per-pill data attributes, e.g. `(m) => ({ 'data-modality': m })`
		// to drive the per-modality / per-stype tint CSS in app.css.
		pillAttrs?: (item: string) => Record<string, string>;
		// Optional icon rendered inside the pill before the label text.
		pillIcon?: Snippet<[string]>;
		// Override the displayed text — used when items are raw values
		// (e.g. `BitextMining`) that need humanising for display.
		pillLabel?: (item: string) => string;
		// Optional hover title; useful for long names that wrap to multiple
		// lines so users can still see the full string.
		pillTitle?: (item: string) => string;
		// Inner span wrapper class — pass `pill-label` to let long
		// unbroken names break mid-word.
		pillTextClass?: string;
		searchValue?: string;
		searchPlaceholder?: string;
		scrollable?: boolean;
		// Sized to absorb leftover sidebar height (used for the Language
		// facet — typically the longest list in a catalogue sidebar).
		grow?: boolean;
		emptyMessage?: string;
	}
	let {
		label,
		items,
		picked,
		onToggle,
		onToggleAll,
		allSelected,
		count,
		pillClass,
		pillAttrs,
		pillIcon,
		pillLabel,
		pillTitle,
		pillTextClass,
		searchValue = $bindable(''),
		searchPlaceholder,
		scrollable = false,
		grow = false,
		emptyMessage
	}: Props = $props();
</script>

<div class="group" class:grow>
	<div class="group-head">
		<span class="group-label">
			{label}
			{#if count}<span class="muted-inline">{count}</span>{/if}
		</span>
		<button type="button" class="link-btn" onclick={onToggleAll}>
			{allSelected ? 'Clear' : 'All'}
		</button>
	</div>
	{#if searchPlaceholder !== undefined}
		<input
			type="search"
			class="type-search input-text"
			placeholder={searchPlaceholder}
			bind:value={searchValue}
		/>
	{/if}
	<div class="pills" class:scroll={scrollable}>
		{#each items as item (item)}
			<label class={['pill', pillClass]} {...pillAttrs?.(item) ?? {}}>
				<input type="checkbox" checked={picked.has(item)} onchange={() => onToggle(item)} />
				{#if pillIcon}{@render pillIcon(item)}{/if}
				<span class={pillTextClass} title={pillTitle?.(item)}>{pillLabel?.(item) ?? item}</span>
			</label>
		{/each}
		{#if items.length === 0 && emptyMessage}
			<p class="muted no-match">{emptyMessage}</p>
		{/if}
	</div>
</div>
