<!--
  Sort-direction glyph used by every `.dir-btn` toggle on the overview
  pages. Uses the lucide arrow-up-narrow-wide / arrow-down-wide-narrow
  pair so the visual makes the sort order obvious: bars grow downward
  for descending, upward for ascending.
-->
<script lang="ts">
	interface Props {
		dir: 'asc' | 'desc';
		size?: number;
	}
	let { dir, size = 14 }: Props = $props();
</script>

{#if dir === 'asc'}
	<svg
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
		<path d="m3 8 4-4 4 4" />
		<path d="M7 4v16" />
		<path d="M11 12h4" />
		<path d="M11 16h7" />
		<path d="M11 20h10" />
	</svg>
{:else}
	<svg
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
		<path d="m3 16 4 4 4-4" />
		<path d="M7 20V4" />
		<path d="M11 4h10" />
		<path d="M11 8h7" />
		<path d="M11 12h4" />
	</svg>
{/if}
