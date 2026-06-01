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

	export function rowsForModel(row: SummaryRow): { k: string; v: string }[] {
		const m = row.model;
		return [
			{ k: 'Org', v: m.org },
			{ k: 'Type', v: m.modelType },
			{ k: 'Total params', v: fmtParams(row.totalParamsB) },
			{ k: 'Active params', v: fmtParams(row.activeParamsB) },
			{ k: 'Embed dim', v: row.embeddingDim ? `${fmtInt(row.embeddingDim)} d` : '—' },
			{ k: 'Max tokens', v: row.maxTokens ? `${fmtInt(row.maxTokens)} tok` : '—' },
			{ k: 'Zero-shot', v: fmtZeroShot(row.zeroShotPct) },
			{ k: 'Released', v: m.releaseDate ?? '—' }
		];
	}
</script>

<script lang="ts">
	type TipState = {
		visible: boolean;
		title: string;
		rows: { k: string; v: string }[];
		x: number;
		y: number;
	};
	let tip = $state<TipState>({ visible: false, title: '', rows: [], x: 0, y: 0 });

	export function showFor(target: HTMLElement, row: SummaryRow) {
		const r = target.getBoundingClientRect();
		tip = {
			visible: true,
			title: `${row.model.org} / ${row.model.displayName}`,
			rows: rowsForModel(row),
			x: r.left + r.width / 2,
			y: r.bottom
		};
	}
	export function hide() {
		tip = { ...tip, visible: false };
	}
</script>

{#if tip.visible}
	<div class="tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px">
		<strong class="title">{tip.title}</strong>
		<dl>
			{#each tip.rows as r (r.k)}
				<div>
					<dt>{r.k}</dt>
					<dd>{r.v}</dd>
				</div>
			{/each}
		</dl>
	</div>
{/if}

<style>
	.tip {
		position: fixed;
		transform: translate(-50%, 6px);
		min-width: 220px;
		max-width: 340px;
		padding: 10px 12px;
		background: #1f2329;
		color: #f1f3f5;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		font-family: var(--font-sans);
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.5;
		text-align: left;
		z-index: 1000;
		box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
		white-space: normal;
		pointer-events: none;
	}
	.tip::before {
		content: '';
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		width: 8px;
		height: 8px;
		background: #1f2329;
	}
	.title {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #ff9b6f;
		margin-bottom: 4px;
	}
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
		color: #9aa3ad;
		font-weight: 600;
		align-self: center;
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		color: #f1f3f5;
	}
</style>
