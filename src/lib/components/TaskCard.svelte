<script lang="ts">
	// Shared task card: identical chrome (per-simplified-type accent, header
	// tint, modality badges, type chip in footer) used on both the `/tasks`
	// index and the "Task information" tab on `/benchmark/[name]`. Stats
	// shown in the grid are passed in by the caller — `/tasks` includes a
	// "Benchmarks" count, the benchmark-detail variant omits it because
	// the surrounding benchmark IS the count.

	import { resolve } from '$app/paths';
	import MarkdownText from './MarkdownText.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import { slug, sortModalities } from '$lib/format';

	interface Stat {
		label: string;
		value: string | number;
		// `metric` styles the value as condensed mono — used for long
		// non-numeric strings like `cosine_spearman`.
		variant?: 'default' | 'metric';
	}
	interface Props {
		name: string;
		type: string;
		simplifiedType?: string;
		description?: string;
		modalities?: string[];
		stats?: Stat[];
	}
	let {
		name,
		type,
		simplifiedType = '',
		description = '',
		modalities = [],
		stats = []
	}: Props = $props();
</script>

<a class="card" href={resolve('/tasks/[name]', { name: slug(name) })} data-stype={simplifiedType}>
	<div class="card-head">
		<span class="title" title={name}>{name}</span>
	</div>
	{#if description}
		<p class="desc"><MarkdownText text={description} /></p>
	{/if}
	{#if stats.length > 0}
		<dl class="stats">
			{#each stats as s (s.label)}
				<div>
					<dt>{s.label}</dt>
					<dd class:metric={s.variant === 'metric'}>{s.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	{#if modalities.length > 0}
		<div class="badges">
			{#each sortModalities(modalities) as mod (mod)}
				<span class="badge" data-modality={mod} title={mod}>
					<ModalityIcon modality={mod} size={12} />
					<span>{mod}</span>
				</span>
			{/each}
		</div>
	{/if}
	<div class="card-foot">
		<!-- Chip surfaces the task group (simplified type, e.g. "retrieval",
		     "classification"), not the raw `type` (e.g. "BitextMining"). The
		     full type still has a home on the task detail page's spec-list. -->
		<span class="group-chip" data-stype={simplifiedType} title={simplifiedType || type}>
			{simplifiedType || type}
		</span>
	</div>
</a>

<style>
	/* Accent-rail design (see BenchmarkCard for the rationale). Per-stype
	   blocks set `--card-accent`, which colours the inset left rail, the
	   hover border + title, and the footer group-chip. */
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		/* Extra left padding clears the rail. */
		padding: 16px 16px 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		/* `content-visibility: auto` lets the browser skip rendering off-screen
		   cards (1759 entries on the full registry). `contain-intrinsic-size`
		   reserves placeholder space so the scrollbar geometry stays stable. */
		content-visibility: auto;
		contain-intrinsic-size: 280px;
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
	/* Per-stype accent — mirrors the `.group-chip` colour map (CLAUDE.md).
	   All chip-coloured stypes set an accent so the rail matches the chip. */
	.card[data-stype='retrieval'] {
		--card-accent: var(--tint-purple-fg);
	}
	.card[data-stype='classification'] {
		--card-accent: var(--tint-blue-fg);
	}
	.card[data-stype='pair-classification'] {
		--card-accent: var(--tint-green-fg);
	}
	.card[data-stype='clustering'] {
		--card-accent: var(--tint-orange-fg);
	}
	.card[data-stype='semantic-similarity'] {
		--card-accent: var(--tint-pink-fg);
	}
	.card[data-stype='reranking'] {
		--card-accent: var(--tint-amber-fg);
	}
	.card[data-stype='instruction-reranking'] {
		--card-accent: var(--tint-orange-fg);
	}
	.card[data-stype='bitext-mining'] {
		--card-accent: var(--tint-azure-fg);
	}
	.card[data-stype='summarization'] {
		--card-accent: var(--tint-teal-fg);
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		/* Long unbroken task names (e.g. XM3600T2IRetrieval) need a break
		   point in mid-camel-case — anywhere lets the browser do it. */
		overflow-wrap: anywhere;
		word-break: normal;
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.desc {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-muted);
		overflow: hidden;
		/* Standard CSS Overflow 4 shorthand — drops the deprecated
		   `-webkit-box-orient`. Chromium 124+, Safari 18.2+, Firefox 136+. */
		line-clamp: 2;
	}
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
	.stats dd.metric {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--ink-strong);
		overflow-wrap: anywhere;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	/* Filled per-modality chip — coloured by each badge's own `data-modality`
	   (text / image / audio / video each distinct). Matches BenchmarkCard. */
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
	.card-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.group-chip {
		display: inline-block;
		padding: 3px 9px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	/* Per-task-group tints, mirroring the parent card's `data-stype`
	   accent. Mapping documented in CLAUDE.md (retrieval → purple,
	   classification → blue, pair-classification → green,
	   clustering → orange, semantic-similarity → pink, etc.). */
	.group-chip[data-stype='classification'] {
		background: var(--tint-blue);
		color: var(--tint-blue-fg);
		border-color: color-mix(in srgb, var(--tint-blue-fg) 35%, transparent);
	}
	.group-chip[data-stype='clustering'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
	}
	.group-chip[data-stype='pair-classification'] {
		background: var(--tint-green);
		color: var(--tint-green-fg);
		border-color: color-mix(in srgb, var(--tint-green-fg) 35%, transparent);
	}
	.group-chip[data-stype='reranking'] {
		background: var(--tint-amber);
		color: var(--tint-amber-fg);
		border-color: color-mix(in srgb, var(--tint-amber-fg) 35%, transparent);
	}
	.group-chip[data-stype='retrieval'] {
		background: var(--tint-purple);
		color: var(--tint-purple-fg);
		border-color: color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
	}
	.group-chip[data-stype='semantic-similarity'] {
		background: var(--tint-pink);
		color: var(--tint-pink-fg);
		border-color: color-mix(in srgb, var(--tint-pink-fg) 35%, transparent);
	}
	.group-chip[data-stype='bitext-mining'] {
		background: var(--tint-azure);
		color: var(--tint-azure-fg);
		border-color: color-mix(in srgb, var(--tint-azure-fg) 35%, transparent);
	}
	.group-chip[data-stype='instruction-reranking'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
	}
</style>
