<script lang="ts">
	import type { Snippet } from 'svelte';
	import FilterContent from './FilterContent.svelte';

	interface Props {
		hideScope?: boolean;
		flatModel?: boolean;
		// /models filters models by capability, not by per-benchmark
		// training overlap — the Zero-shot segmented control is
		// benchmark-scoped, so it's hidden there.
		hideZeroShot?: boolean;
		// Optional inline Language facet — forwarded to FilterContent.
		// Only /models passes these; on every other page the block is
		// omitted because there's no language data to bind to.
		languageOptions?: string[];
		languagesPicked?: Set<string>;
		onToggleLanguage?: (l: string) => void;
		onToggleAllLanguages?: () => void;
		// When provided, replaces the default FilterContent body — used
		// by the /benchmarks catalogue page which filters benchmarks
		// (not benchmark contents) and so has its own facet state
		// outside the global filters store.
		children?: Snippet;
	}
	let {
		hideScope = false,
		flatModel = false,
		hideZeroShot = false,
		languageOptions,
		languagesPicked,
		onToggleLanguage,
		onToggleAllLanguages,
		children
	}: Props = $props();

	// Collapsed on narrow viewports so the drawer doesn't overlap content;
	// SSR has no `window` so it stays expanded until hydration.
	let collapsed = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
	);
</script>

<aside class="sidebar" class:collapsed aria-label="Filters">
	<button
		type="button"
		class="sidebar-toggle"
		onclick={() => (collapsed = !collapsed)}
		aria-expanded={!collapsed}
		title={collapsed ? 'Expand filters' : 'Collapse filters'}
	>
		<svg
			class="chev"
			class:open={!collapsed}
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m15 18-6-6 6-6" />
		</svg>
		{#if !collapsed}
			<span class="toggle-label">Filters</span>
		{/if}
	</button>

	{#if !collapsed}
		{#if children}
			<div class="filters">{@render children()}</div>
		{:else}
			<FilterContent
				{hideScope}
				{flatModel}
				{hideZeroShot}
				{languageOptions}
				{languagesPicked}
				{onToggleLanguage}
				{onToggleAllLanguages}
			/>
		{/if}
	{/if}
</aside>
