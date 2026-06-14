<script lang="ts">
	// Lucide glyph for each task / model modality.
	//
	//   text   → text-align-justify
	//   image  → file-image
	//   audio  → activity (waveform)
	//   video  → video (camera + tape)
	import TextAlignJustify from 'lucide-svelte/icons/text-align-justify';
	import FileImage from 'lucide-svelte/icons/file-image';
	import Activity from 'lucide-svelte/icons/activity';
	import Video from 'lucide-svelte/icons/video';

	interface Props {
		modality: string | null | undefined;
		size?: number;
	}
	let { modality, size = 14 }: Props = $props();
</script>

{#if modality === 'text'}
	<TextAlignJustify class="mod-icon mod-text" {size} aria-hidden="true" />
{:else if modality === 'image'}
	<FileImage class="mod-icon mod-image" {size} aria-hidden="true" />
{:else if modality === 'audio'}
	<Activity class="mod-icon mod-audio" {size} aria-hidden="true" />
{:else if modality === 'video'}
	<Video class="mod-icon mod-video" {size} aria-hidden="true" />
{/if}
