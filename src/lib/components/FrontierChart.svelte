<script lang="ts" module>
	export interface LegendItem {
		label: string;
		kind: 'frontier' | 'reference';
	}
	export interface FrontierItem {
		/** `rowId` — unique per experiment variant; the `{#each}` key. */
		id: string;
		/** Canonical `org/name`: link target and hover title. */
		name: string;
		displayName: string;
		/** Experiment kwargs label for variant rows (`''` for base rows). */
		variant: string;
		modelType: string;
		/** Left-hand detail under the name (score). */
		detail: string;
		/** Right-hand detail under the name (size / release date). */
		meta: string;
	}
</script>

<script lang="ts">
	// Shared shell for the Performance per Model Size / over Time tabs: an
	// optional legend row for the frontier (+ reference) line, the chart, and
	// a side panel listing the models on the frontier. `color` is the chart's
	// frontier line colour, reused by the legend swatch and the panel dots.
	import type { PlotSpec } from '$lib/charts/figures';
	import { REFERENCE_COLOR } from '$lib/charts/figures';
	import { resolve } from '$app/paths';
	import { modelPath } from '$lib/format';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		spec: PlotSpec;
		height: number;
		color: string;
		legend?: LegendItem[];
		/** Optional caveat shown under the legend. */
		note?: string;
		title: string;
		items: FrontierItem[];
	}
	let { spec, height, color, legend = [], note = '', title, items }: Props = $props();
	// Both tabs stay mounted, so the heading id must be per-instance.
	const headingId = $props.id();
	// Hovering or focusing a panel entry shows its bubble's hover label on the
	// chart; clicking still follows the link to the model page.
	let chart = $state<{ hoverPoint: (id: string) => void; unhover: () => void }>();
</script>

<div class="frontier-chart" style:--frontier={color} style:--reference={REFERENCE_COLOR}>
	{#if legend.length > 0}
		<ul class="legend" aria-label="Chart lines">
			{#each legend as item (item.label)}
				<li>
					<span class="swatch {item.kind}" aria-hidden="true"></span>
					{item.label}
				</li>
			{/each}
		</ul>
	{/if}
	{#if note}
		<p class="note">{note}</p>
	{/if}
	<div class="layout">
		<div class="chart">
			<PlotlyChart bind:this={chart} data={spec.data} layout={spec.layout} {height} />
		</div>
		{#if items.length > 0}
			<aside class="panel" aria-labelledby={headingId} style:--panel-max="{height}px">
				<h3 id={headingId}>{title} <span class="count">{items.length}</span></h3>
				<ol>
					{#each items as item (item.id)}
						<li
							data-model-type={item.modelType}
							onpointerenter={() => chart?.hoverPoint(item.id)}
							onpointerleave={() => chart?.unhover()}
							onfocusin={() => chart?.hoverPoint(item.id)}
							onfocusout={() => chart?.unhover()}
						>
							<a
								class="name"
								href={resolve('/models/[...name=modelName]', { name: modelPath(item.name) })}
								title={item.name}
							>
								<span class="tbl-model-name">{item.displayName}</span>
							</a>
							{#if item.variant}
								<span class="variant">{item.variant}</span>
							{/if}
							<span class="detail">{item.detail}</span>
							<span class="meta">{item.meta}</span>
						</li>
					{/each}
				</ol>
			</aside>
		{/if}
	</div>
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
		font-size: 12px;
		color: var(--text-muted);
	}
	.note {
		margin: -4px 0 12px;
		font-size: 12px;
		color: var(--text-subtle);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.swatch {
		width: 22px;
	}
	.swatch.frontier {
		border-top: 2px solid var(--frontier);
	}
	.swatch.reference {
		border-top: 1.5px dashed var(--reference);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 240px;
		gap: 16px;
		align-items: start;
	}
	.chart {
		min-width: 0;
	}
	/* Capped to the chart's height; long lists scroll inside. */
	.panel {
		display: flex;
		max-height: var(--panel-max);
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		overflow: hidden;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 10px 12px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.count {
		padding: 0 7px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--ink-strong);
		font-variant-numeric: tabular-nums;
		line-height: 18px;
	}
	ol {
		margin: 0;
		padding: 0 6px 6px;
		list-style: none;
		overflow-y: auto;
	}
	/* Name on top (long names wrap rather than truncate), details beneath. */
	.panel li {
		display: grid;
		grid-template-columns: 6px minmax(0, 1fr) auto;
		grid-template-areas:
			'dot name name'
			'. variant variant'
			'. detail meta';
		column-gap: 8px;
		padding: 5px 6px;
		border-radius: 6px;
	}
	.panel li:hover {
		background: var(--row-hover);
	}
	/* Dot in the frontier line's color ties each entry to the chart. */
	.panel li::before {
		content: '';
		grid-area: dot;
		/* Pinned to the first line of the name, which may wrap. */
		align-self: start;
		margin-top: 6px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--frontier);
	}
	.name {
		grid-area: name;
		font-size: 13px;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
	/* Same purple as the variant chip under model names in the tables. */
	.variant {
		grid-area: variant;
		font-size: 11px;
		color: var(--tint-purple-fg);
		overflow-wrap: anywhere;
	}
	.detail,
	.meta {
		font-size: 11px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
	.detail {
		grid-area: detail;
	}
	.meta {
		grid-area: meta;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.panel {
			max-height: 320px;
		}
	}
</style>
