<script lang="ts">
	import type { Snippet } from 'svelte';
	import FilterContent from './FilterContent.svelte';

	interface Props {
		hideScope?: boolean;
		flatModel?: boolean;
		/** Zero-shot is benchmark-scoped; /models hides it. */
		hideZeroShot?: boolean;
		/** Inline Language facet — only /models passes these. */
		languageOptions?: string[];
		languagesPicked?: Set<string>;
		onToggleLanguage?: (l: string) => void;
		onToggleAllLanguages?: () => void;
		onResetLanguages?: () => void;
		/** When provided, replaces FilterContent — used by /benchmarks. */
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
		onResetLanguages,
		children
	}: Props = $props();

	// Collapsed on narrow viewports; SSR stays expanded until hydration.
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
				{onResetLanguages}
			/>
		{/if}
	{/if}
</aside>
