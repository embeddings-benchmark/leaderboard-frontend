<!--
  Sort-direction glyph used by every `.dir-btn` toggle on the overview
  pages. Uses lucide's arrow-up-narrow-wide / arrow-down-wide-narrow
  pair so the visual makes the sort order obvious: bars grow downward
  for descending, upward for ascending.
-->
<script lang="ts">
	import ArrowUpNarrowWide from 'lucide-svelte/icons/arrow-up-narrow-wide';
	import ArrowDownWideNarrow from 'lucide-svelte/icons/arrow-down-wide-narrow';

	interface Props {
		dir: 'asc' | 'desc';
		size?: number;
	}
	let { dir, size = 14 }: Props = $props();
</script>

{#if dir === 'asc'}
	<ArrowUpNarrowWide {size} aria-hidden="true" />
{:else}
	<ArrowDownWideNarrow {size} aria-hidden="true" />
{/if}
