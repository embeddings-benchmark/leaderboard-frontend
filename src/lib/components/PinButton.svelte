<script lang="ts">
	// Shared pin-toggle button for leaderboard rows. The `<td>` wrapper
	// stays in each consumer because the cell position varies — Summary
	// pairs it with the rank pill in a flex container, while PerTask /
	// PerLanguage put it in a dedicated 32 px sticky column.
	//
	// Reads the pinned set directly from the singleton store so the
	// button stays in sync with state changes from any other table.

	import { pinnedModels } from '$lib/stores/pinned.svelte';

	interface Props {
		name: string;
	}
	let { name }: Props = $props();
	let on = $derived(pinnedModels.has(name));
	let label = $derived(on ? 'Unpin row' : 'Pin row');
</script>

<button
	type="button"
	class="tbl-pin-btn"
	class:on
	onclick={() => pinnedModels.toggle(name)}
	aria-label={label}
	title={label}
>
	<svg
		viewBox="0 0 24 24"
		width="12"
		height="12"
		fill="none"
		stroke="currentColor"
		stroke-width="2.4"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M12 17v5" />
		<path d="M9 10.76V6h6v4.76l3 2.59V17H6v-3.65l3-2.59z" />
	</svg>
</button>
