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

<a
	class="card card-link card-link-vis accent-rail"
	href={resolve('/tasks/[name]', { name: slug(name) })}
	data-stype={simplifiedType}
>
	<div class="card-head">
		<span class="title" title={name}>{name}</span>
	</div>
	{#if description}
		<p class="desc"><MarkdownText text={description} /></p>
	{/if}
	{#if stats.length > 0}
		<dl class="card-stats">
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
				<span class="badge modality-tint" data-modality={mod} title={mod}>
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
	.card {
		--card-intrinsic: 280px;
	}
	.card[data-stype] {
		--card-accent: var(--category-tint-fg);
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
	.card-stats dd.metric {
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
	.card-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	/* Chip surfaces the task group (e.g. "retrieval"). Base shell stays
	   neutral; the `data-stype` attribute on each chip pulls the per-
	   group tint pair from the global `[data-stype]` map in app.css
	   (`--category-tint` / `--category-tint-fg`). When a category is set the
	   border tints from currentColor; the no-stype fallback keeps the
	   neutral border so empty / unknown groups read as plain. */
	.group-chip {
		display: inline-block;
		padding: 3px 9px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 999px;
		background: var(--category-tint, var(--surface-muted));
		color: var(--category-tint-fg, var(--text-muted));
		border: 1px solid var(--border);
	}
	.group-chip[data-stype]:not([data-stype='']) {
		border-color: color-mix(in srgb, currentColor 35%, transparent);
	}
</style>
