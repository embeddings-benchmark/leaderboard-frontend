<script lang="ts">
	// Lucide-flavoured glyph for each task / model modality. One `<svg>`
	// shell with conditional `<path>` content avoids redeclaring the same
	// 9 attributes per variant — important on tables that mount this per
	// row.
	//
	//   text   → text-align-justify
	//   image  → file-image
	//   audio  → activity (waveform)
	//   video  → video (camera + tape)

	interface Props {
		modality: string | null | undefined;
		size?: number;
	}
	let { modality, size = 14 }: Props = $props();
	let known = $derived(
		modality === 'text' || modality === 'image' || modality === 'audio' || modality === 'video'
	);
</script>

{#if known}
	<svg
		class="mod-icon mod-{modality}"
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
		{#if modality === 'text'}
			<!-- lucide/text-align-justify -->
			<path d="M3 5h18" />
			<path d="M3 12h18" />
			<path d="M3 19h18" />
		{:else if modality === 'image'}
			<!-- lucide/file-image -->
			<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
			<path d="M14 2v4a2 2 0 0 0 2 2h4" />
			<circle cx="10" cy="13" r="2" />
			<path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22" />
		{:else if modality === 'audio'}
			<!-- lucide/activity -->
			<path
				d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.96 0L9.68 3.18a.5.5 0 0 0-.96 0l-2.35 8.36A2 2 0 0 1 4.44 13H2"
			/>
		{:else if modality === 'video'}
			<!-- lucide/video -->
			<path d="m22 8-6 4 6 4V8Z" />
			<rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
		{/if}
	</svg>
{/if}
