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
	class="card"
	href={resolve('/benchmark/[name]', { name: slug(b.name) })}
	data-modality={accentModality}
>
	<div class="card-head">
		{#if b.icon}
			{#if isIconUrl(b.icon)}
				<img
					class="card-icon"
					src={apiUrl(b.icon)}
					alt="{b.displayName} icon"
					width="28"
					height="28"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
			{:else}
				<span class="card-icon card-icon-text" aria-hidden="true">{b.icon}</span>
			{/if}
		{/if}
		<div class="card-titles">
			<span class="title" title={b.displayName}>{b.displayName}</span>
			<CopyableId value={b.name} ariaLabel="Copy benchmark id" />
		</div>
	</div>
	<p class="desc"><MarkdownText text={b.description} /></p>
	<dl class="stats">
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
		<div class="badges">
			{#each sortModalities(b.modalities) as mod (mod)}
				<span class="badge" data-modality={mod} title={mod}>
					<ModalityIcon modality={mod} size={12} />
					<span>{mod}</span>
				</span>
			{/each}
		</div>
	{/if}
</a>

<style>
	/* Accent-rail design (no top stripe, no gradient band). Category colour
	   lives in three places: the inset rail on the left edge (`::before`,
	   coloured by `--card-accent` = the primary modality), the filled
	   per-modality badges, and the hover state. The per-modality blocks
	   below set `--card-accent` (rail + hover) and `--card-tint`. */
	.card {
		position: relative;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		/* Extra left padding clears the rail. */
		padding: 16px 16px 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	/* Inset rounded marker rail — grows toward the card edges on hover. */
	.card::before {
		content: '';
		position: absolute;
		left: 0;
		top: 16px;
		bottom: 16px;
		width: 4px;
		border-radius: 0 4px 4px 0;
		background: var(--card-accent, var(--border-strong));
		transition:
			top 0.15s ease,
			bottom 0.15s ease;
	}
	.card:hover::before {
		top: 11px;
		bottom: 11px;
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgb(var(--shadow-tint) / 0.07);
		border-color: color-mix(in srgb, var(--card-accent, var(--primary)) 45%, var(--border));
	}
	.card:hover .title {
		color: var(--card-accent, var(--primary-strong));
	}
	.card:focus-visible {
		outline: 2px solid var(--card-accent, var(--primary));
		outline-offset: 2px;
	}
	.card[data-modality='text'] {
		--card-tint: var(--tint-teal);
		--card-accent: var(--tint-teal-fg);
	}
	.card[data-modality='image'] {
		--card-tint: var(--tint-blue);
		--card-accent: var(--tint-blue-fg);
	}
	.card[data-modality='audio'] {
		--card-tint: var(--tint-amber);
		--card-accent: var(--tint-amber-fg);
	}
	.card[data-modality='video'] {
		--card-tint: var(--tint-purple);
		--card-accent: var(--tint-purple-fg);
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.card-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface-muted);
		margin-top: 1px;
	}
	.card-icon-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		line-height: 1;
	}
	.card-titles {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		overflow-wrap: anywhere;
		word-break: normal;
		line-height: 1.3;
	}
	/* Tame the copy-id pill on the card only (it stays a full chip on the
	   benchmark detail hero): ghost at rest so it doesn't compete with the
	   title, resolving into a bordered chip on hover/focus. Scoped to the
	   card via the `.card-titles` prefix — the `:global()` just reaches the
	   child component's root. */
	.card-titles :global(.copyable-id) {
		background: transparent;
		border-color: transparent;
		color: var(--text-subtle);
	}
	.card-titles :global(.copyable-id .copy-btn) {
		border-left-color: transparent;
	}
	.card-titles :global(.copyable-id:hover) {
		background: var(--surface-muted);
		border-color: var(--border);
		color: var(--text);
	}
	.card-titles :global(.copyable-id:hover .copy-btn) {
		border-left-color: var(--border);
	}
	.desc {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-muted);
		overflow: hidden;
		/* Standard CSS Overflow 4 shorthand: clamps without the deprecated
		   `-webkit-box-orient`. Chromium 124+, Safari 18.2+, Firefox 136+. */
		line-clamp: 2;
	}
	/* Fallback for browsers that haven't shipped the standard `line-clamp`
	   yet — they get the legacy WebKit triplet (with `-webkit-box-orient`
	   only inside this branch, so the deprecation warning doesn't fire
	   for browsers that don't need it). */
	@supports not (line-clamp: 2) {
		.desc {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
		}
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px 14px;
		margin: 0;
	}
	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.stats dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.stats dd {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: auto;
	}
	/* Filled per-modality chip: each badge carries its own `data-modality`,
	   so `--modality-tint` / `--modality-tint-fg` (set by the global
	   `[data-modality]` rules in app.css) colour it by ITS modality — text,
	   image, audio and video each read as a distinct colour. */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		padding: 3px 9px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.01em;
		background: var(--modality-tint, var(--surface-muted));
		border: 1px solid transparent;
		color: var(--modality-tint-fg, var(--text-muted));
		text-transform: lowercase;
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
