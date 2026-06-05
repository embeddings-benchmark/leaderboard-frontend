<script lang="ts">
	import FilterContent from './FilterContent.svelte';

	interface Props {
		hideScope?: boolean;
		flatModel?: boolean;
		// Optional inline Language facet — forwarded to FilterContent.
		// Only /models passes these; on every other page the block is
		// omitted because there's no language data to bind to.
		languageOptions?: string[];
		languagesPicked?: Set<string>;
		onToggleLanguage?: (l: string) => void;
		onToggleAllLanguages?: () => void;
	}
	let {
		hideScope = false,
		flatModel = false,
		languageOptions,
		languagesPicked,
		onToggleLanguage,
		onToggleAllLanguages
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
		<span class="chev" class:open={!collapsed}>‹</span>
		{#if !collapsed}
			<span class="toggle-label">Filters</span>
		{/if}
	</button>

	{#if !collapsed}
		<FilterContent
			{hideScope}
			{flatModel}
			{languageOptions}
			{languagesPicked}
			{onToggleLanguage}
			{onToggleAllLanguages}
		/>
	{/if}
</aside>

<!-- Shell + toggle styles live in $lib/styles/sidebar.css. -->
