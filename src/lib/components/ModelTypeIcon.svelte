<script lang="ts">
	// Lucide-flavoured glyph for each model architecture. One `<svg>` shell
	// with conditional `<path>` content per variant — avoids redeclaring
	// the same 9 attributes 5 times and keeps the DOM footprint small on
	// 200-row tables where this mounts once per row.
	//
	//   dense              → share-2  (one source fanning out into rich vectors)
	//   sparse             → grip     (sparse grid of points)
	//   cross-encoder      → merge    (query + doc collapse into a single signal)
	//   late-interaction   → shuffle  (token-level streams crossing paths)
	//   router             → split    (one input dispatched across paths)

	import type { ModelType } from '$lib/types';

	interface Props {
		type: ModelType | string | null | undefined;
		size?: number;
	}
	let { type, size = 14 }: Props = $props();
	let known = $derived(
		type === 'dense' ||
			type === 'sparse' ||
			type === 'cross-encoder' ||
			type === 'late-interaction' ||
			type === 'router'
	);
</script>

{#if known}
	<svg
		class="mt-icon mt-{type}"
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if type === 'dense'}
			<!-- lucide/share-2 -->
			<circle cx="18" cy="5" r="3" />
			<circle cx="6" cy="12" r="3" />
			<circle cx="18" cy="19" r="3" />
			<line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
			<line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
		{:else if type === 'sparse'}
			<!-- lucide/grip -->
			<circle cx="12" cy="5" r="1" />
			<circle cx="19" cy="5" r="1" />
			<circle cx="5" cy="5" r="1" />
			<circle cx="12" cy="12" r="1" />
			<circle cx="19" cy="12" r="1" />
			<circle cx="5" cy="12" r="1" />
			<circle cx="12" cy="19" r="1" />
			<circle cx="19" cy="19" r="1" />
			<circle cx="5" cy="19" r="1" />
		{:else if type === 'cross-encoder'}
			<!-- lucide/merge -->
			<path d="m8 6 4-4 4 4" />
			<path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" />
			<path d="m20 22-5-5" />
		{:else if type === 'late-interaction'}
			<!-- lucide/shuffle -->
			<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
			<path d="m18 2 4 4-4 4" />
			<path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
			<path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
			<path d="m18 14 4 4-4 4" />
		{:else if type === 'router'}
			<!-- lucide/split -->
			<path d="M16 3h5v5" />
			<path d="M8 3H3v5" />
			<path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
			<path d="m15 9 6-6" />
		{/if}
	</svg>
{/if}
