<script lang="ts">
	// Shared pin-toggle button for leaderboard rows. The `<td>` wrapper
	// stays in each consumer because the cell position varies — Summary
	// pairs it with the rank pill in a flex container, while PerTask /
	// PerLanguage put it in a dedicated 32 px sticky column.
	//
	// Reads the pinned set directly from the singleton store so the
	// button stays in sync with state changes from any other table.

	import Pin from 'lucide-svelte/icons/pin';
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
	<Pin size={12} strokeWidth={2.4} aria-hidden="true" />
</button>
