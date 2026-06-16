<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import type { Benchmark } from '$lib/types';
	import { apiUrl, fmtCompact, isIconUrl, slug, sortModalities } from '$lib/format';
	import CopyableId from './CopyableId.svelte';
	import MarkdownText from './MarkdownText.svelte';
	import ModalityIcon from './ModalityIcon.svelte';

	interface Props {
		b: Benchmark;
	}
	let { b }: Props = $props();
	// Card accent follows the canonical modality priority
	// (`video → audio → image → text`) — the same order the badge row
	// uses below. Previously took `modalities[0]` from the API's
	// alphabetical sort, which meant MVEB (video + audio + image) tinted
	// as audio when video is the more distinctive medium.
	let accentModality = $derived(sortModalities(b.modalities)[0] ?? 'text');
</script>

<a
	class="card card-link card-link-vis accent-rail"
	href={resolve('/benchmark/[name]', { name: slug(b.name) })}
	data-modality={accentModality}
>
	<div class="card-head">
		{#if b.icon}
			{#if isIconUrl(b.icon)}
				<img
					class="card-icon icon-tile"
					src={apiUrl(b.icon)}
					alt="{b.displayName} icon"
					width="28"
					height="28"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
					crossorigin="anonymous"
				/>
			{:else}
				<span class="card-icon icon-tile icon-tile-text" aria-hidden="true">{b.icon}</span>
			{/if}
		{/if}
		<div class="card-titles">
			<span class="title card-title" title={b.displayName}>{b.displayName}</span>
			<CopyableId value={b.name} ariaLabel="Copy benchmark id" />
		</div>
	</div>
	<p class="card-desc"><MarkdownText text={b.description} /></p>
	<dl class="card-stats">
		<div>
			<dt>Models</dt>
			<dd>{fmtCompact(b.numModels ?? 0)}</dd>
		</div>
		<div>
			<dt>Tasks</dt>
			<dd>{fmtCompact(b.tasks.length)}</dd>
		</div>
		<div>
			<dt>Languages</dt>
			<dd>{fmtCompact(b.languages.length)}</dd>
		</div>
		<div>
			<dt>Task types</dt>
			<dd>{fmtCompact(b.taskTypes.length)}</dd>
		</div>
	</dl>
	{#if b.newVersion && b.newVersion.length > 0}
		<!-- Outer card is an <a>, so the inline link uses <button> + stopPropagation. -->
		<button
			type="button"
			class="newer-note"
			title="Open {b.newVersion[0]}"
			onclick={(e) => {
				e.stopPropagation();
				e.preventDefault();
				goto(resolve('/benchmark/[name]', { name: slug(b.newVersion![0]) }));
			}}
		>
			<span class="newer-label">Newer version</span>
			{#each b.newVersion as nv (nv)}
				<code class="newer-link">{nv}</code>
			{/each}
		</button>
	{/if}
	{#if b.modalities && b.modalities.length > 0}
		<div class="chip-row">
			{#each sortModalities(b.modalities) as mod (mod)}
				<span class="badge modality-tint" data-modality={mod} title={mod}>
					<ModalityIcon modality={mod} size={12} />
					<span>{mod}</span>
				</span>
			{/each}
		</div>
	{/if}
</a>

<style>
	.card {
		--card-intrinsic: 240px;
	}
	.card[data-modality] {
		--card-accent: var(--modality-tint-fg);
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	/* 1 px nudge so the icon's optical centre aligns with the title. */
	.card-icon {
		--icon-size: 28px;
		margin-top: 1px;
	}
	.card-titles {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	/* Ghost the CopyableId pill until hover so it doesn't compete with
	   the title. */
	.card-titles {
		--copyable-bg: transparent;
		--copyable-border: transparent;
		--copyable-text: var(--text-subtle);
		--copyable-bg-hover: var(--surface-muted);
		--copyable-border-hover: var(--border);
		--copyable-text-hover: var(--text);
	}
	.newer-note {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		padding: 5px 9px;
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
		border-radius: 8px;
		font-size: 11px;
		color: var(--primary-strong);
		align-self: flex-start;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.newer-note:hover {
		background: color-mix(in srgb, var(--primary) 18%, var(--surface));
		border-color: var(--primary);
	}
	.newer-note:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.newer-label {
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		font-size: 10px;
	}
	.newer-link {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 1px 6px;
		background: var(--surface);
		border-radius: 4px;
		color: var(--primary-strong);
	}
</style>
