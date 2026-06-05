<script lang="ts" module>
	import type { SummaryRow } from '$lib/types';

	function fmtZeroShot(pct: number): string {
		if (pct === -1) return '⚠️ NA';
		return `${pct.toFixed(0)}%`;
	}
	function fmtParams(b: number): string {
		if (!b) return '—';
		return b >= 1 ? `${b.toFixed(1)} B` : `${(b * 1000).toFixed(0)} M`;
	}
	function fmtInt(n: number): string {
		if (!n) return '—';
		return n.toLocaleString();
	}

	// Shared hover-row set for SummaryTable, PerTaskTab, PerLanguageTab.
	// Org goes in the title (`<org> / <displayName>`), not a separate row.
	export function rowsForModel(row: SummaryRow): { k: string; v: string }[] {
		const m = row.model;
		return [
			{ k: 'Type', v: m.modelType },
			{ k: 'Active params', v: fmtParams(row.activeParamsB) },
			{ k: 'Zero-shot', v: fmtZeroShot(row.zeroShotPct) },
			{ k: 'Embedding dim', v: row.embeddingDim ? fmtInt(row.embeddingDim) : '—' },
			{ k: 'Max tokens', v: row.maxTokens ? fmtInt(row.maxTokens) : '—' },
			{ k: 'Released', v: m.releaseDate ?? '—' }
		];
	}
</script>

<script lang="ts">
	import HoverPortal from './HoverPortal.svelte';

	type TipState = {
		visible: boolean;
		title: string;
		modelType: string;
		rows: { k: string; v: string }[];
		x: number;
		y: number;
	};
	let tip = $state<TipState>({
		visible: false,
		title: '',
		modelType: '',
		rows: [],
		x: 0,
		y: 0
	});

	export function showFor(target: HTMLElement, row: SummaryRow) {
		const r = target.getBoundingClientRect();
		tip = {
			visible: true,
			title: `${row.model.org} / ${row.model.displayName}`,
			modelType: row.model.modelType,
			rows: rowsForModel(row),
			x: r.left + r.width / 2,
			y: r.bottom
		};
	}
	export function hide() {
		tip = { ...tip, visible: false };
	}
</script>

<HoverPortal visible={tip.visible} title={tip.title} modelType={tip.modelType} x={tip.x} y={tip.y}>
	<dl>
		{#each tip.rows as r (r.k)}
			<div>
				<dt>{r.k}</dt>
				<dd class:type-value={r.k === 'Type'}>{r.v}</dd>
			</div>
		{/each}
	</dl>
</HoverPortal>

<style>
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 14px;
		margin: 0;
	}
	dl > div {
		display: contents;
	}
	dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--tip-label);
		font-weight: 600;
		align-self: center;
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		color: var(--tip-fg);
	}
	/* Per-model-type tint on the Type row's value (mirrors the
	   title tint owned by HoverPortal). */
	:global(.hover-portal[data-model-type='dense']) .type-value {
		color: var(--tint-blue-fg);
		font-weight: 700;
	}
	:global(.hover-portal[data-model-type='cross-encoder']) .type-value {
		color: var(--tint-orange-fg);
		font-weight: 700;
	}
	:global(.hover-portal[data-model-type='late-interaction']) .type-value {
		color: var(--tint-green-fg);
		font-weight: 700;
	}
	:global(.hover-portal[data-model-type='sparse']) .type-value {
		color: var(--tint-amber-fg);
		font-weight: 700;
	}
	:global(.hover-portal[data-model-type='router']) .type-value {
		color: var(--tint-purple-fg);
		font-weight: 700;
	}
</style>
