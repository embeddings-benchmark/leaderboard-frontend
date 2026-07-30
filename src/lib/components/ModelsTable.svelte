<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ModelMeta } from '$lib/types';
	import {
		fmtInt,
		fmtParamsUnit,
		fmtParamsValue,
		modelPath,
		sortModalities,
		splitModelName
	} from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { clampTooltipX, isBoundaryCross } from '$lib/cell-hover';
	// Shared with SummaryTable so both tables describe these columns identically.
	import { COLUMN_INFO } from '$lib/column-info';
	import { opennessScore } from '$lib/openness';
	import type { SortState } from '$lib/stores/sort.svelte';
	import HoverPortal from './HoverPortal.svelte';
	import InfoDot from './InfoDot.svelte';
	import ModalityIcon from './ModalityIcon.svelte';
	import OpennessHoverPortal from './OpennessHoverPortal.svelte';
	import OpennessMeter from './OpennessMeter.svelte';
	import SortHeader from './SortHeader.svelte';

	type SortId = 'name' | 'params' | 'embedDim' | 'maxTokens' | 'released' | 'type' | 'openness';

	interface Props {
		rows: ModelMeta[];
		sort: SortState<SortId>;
	}
	let { rows, sort }: Props = $props();

	// Only surface the column when at least one row carries openness data —
	// mirrors SummaryTable, and keeps the column out of the way entirely on an
	// API build that doesn't ship openness yet.
	let showOpenness = $derived(rows.some((m) => opennessScore(m) !== null));

	// Lightweight column-header tooltip — same shape as ModelScoreTable's.
	const TIP_MAX_WIDTH = 320;
	let tipState = $state({ visible: false, title: '', text: '', x: 0, y: 0 });
	function showTip(e: PointerEvent | FocusEvent) {
		const el = e.currentTarget as HTMLElement;
		const text = el.dataset.tip ?? '';
		if (!text) return;
		const r = el.getBoundingClientRect();
		tipState = {
			visible: true,
			title: el.dataset.tipTitle ?? '',
			text,
			x: clampTooltipX(r.left + r.width / 2, TIP_MAX_WIDTH),
			y: r.bottom
		};
	}
	function hideTip() {
		tipState = { ...tipState, visible: false };
	}

	// Per-cell breakdown portal. `pointerover`/`pointerout` bubble (Svelte
	// delegates them), so `isBoundaryCross` filters out internal traversal.
	type OpennessTip = {
		showFor: (t: HTMLElement, model: ModelMeta) => void;
		hide: () => void;
	};
	let opennessTipPortal = $state<OpennessTip | undefined>(undefined);
	function showOpennessTip(e: PointerEvent | FocusEvent, m: ModelMeta) {
		if (e.type === 'pointerover' && !isBoundaryCross(e)) return;
		opennessTipPortal?.showFor(e.currentTarget as HTMLElement, m);
	}
	function hideOpennessTip(e?: PointerEvent | FocusEvent) {
		if (e && e.type === 'pointerout' && !isBoundaryCross(e)) return;
		opennessTipPortal?.hide();
	}
</script>

<div class="tbl-scroll tbl-overview">
	<table class="tbl" use:stickyHead>
		<thead>
			<tr>
				<th class="tbl-col-name" aria-sort={sort.aria('name')}>
					<SortHeader {sort} field="name" label="Model" align="left" />
				</th>
				<th class="tbl-col-type" aria-sort={sort.aria('type')}>
					<SortHeader {sort} field="type" label="Type" align="left" />
				</th>
				<th
					class="tbl-num tbl-col-num"
					data-tip-title={COLUMN_INFO.totalParams.title}
					data-tip={COLUMN_INFO.totalParams.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={sort.aria('params')}
				>
					<SortHeader {sort} field="params" label="Parameters" infoAfter>
						{#snippet info()}
							<InfoDot ariaLabel="What is {COLUMN_INFO.totalParams.title}?" />
						{/snippet}
					</SortHeader>
				</th>
				{#if showOpenness}
					<th
						scope="col"
						class="openness-head"
						data-tip-title={COLUMN_INFO.openness.title}
						data-tip={COLUMN_INFO.openness.text}
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
						aria-sort={sort.aria('openness')}
					>
						<SortHeader {sort} field="openness" label="Openness" align="left" infoAfter>
							{#snippet info()}
								<InfoDot ariaLabel="What is {COLUMN_INFO.openness.title}?" />
							{/snippet}
						</SortHeader>
					</th>
				{/if}
				<th
					class="tbl-num tbl-col-num"
					data-tip-title={COLUMN_INFO.embedding.title}
					data-tip={COLUMN_INFO.embedding.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={sort.aria('embedDim')}
				>
					<SortHeader {sort} field="embedDim" label="Embed dim" infoAfter>
						{#snippet info()}
							<InfoDot ariaLabel="What is {COLUMN_INFO.embedding.title}?" />
						{/snippet}
					</SortHeader>
				</th>
				<th
					class="tbl-num tbl-col-num"
					data-tip-title={COLUMN_INFO.maxTokens.title}
					data-tip={COLUMN_INFO.maxTokens.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={sort.aria('maxTokens')}
				>
					<SortHeader {sort} field="maxTokens" label="Max tokens" infoAfter>
						{#snippet info()}
							<InfoDot ariaLabel="What is {COLUMN_INFO.maxTokens.title}?" />
						{/snippet}
					</SortHeader>
				</th>
				<th class="tbl-num tbl-col-num" aria-sort={sort.aria('released')}>
					<SortHeader {sort} field="released" label="Released" />
				</th>
				<th class="tbl-col-chips">Modalities</th>
				<th class="tbl-col-avail">Availability</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as m (m.name)}
				{@const split = m.displayName && m.org ? null : splitModelName(m.name)}
				{@const org = m.org || split?.org || ''}
				{@const display = m.displayName || split?.displayName || m.name}
				<tr data-model-type={m.modelType}>
					<th class="tbl-col-name" scope="row">
						<a
							class="tbl-row-link"
							href={resolve('/models/[...name=modelName]', { name: modelPath(m.name) })}
						>
							<span class="tbl-model-link">
								{#if org}<span class="tbl-model-org">{org}</span><span class="tbl-model-sep">/</span
									>{/if}<span class="tbl-model-name">{display}</span>
							</span>
						</a>
					</th>
					<td class="tbl-col-type">
						<span class="tbl-type-chip" data-type={m.modelType}>{m.modelType}</span>
					</td>
					<td class="tbl-num tbl-col-num">
						{fmtParamsValue(m.totalParamsB)}{#if fmtParamsUnit(m.totalParamsB)}<span class="unit"
								>{fmtParamsUnit(m.totalParamsB)}</span
							>{/if}
					</td>
					{#if showOpenness}
						{@const hasOpenness = opennessScore(m) !== null}
						<td
							class="openness-cell"
							class:has-openness={hasOpenness}
							onpointerover={(e) => hasOpenness && showOpennessTip(e, m)}
							onpointerout={hideOpennessTip}
							onfocusin={(e) => hasOpenness && showOpennessTip(e, m)}
							onfocusout={hideOpennessTip}
						>
							{#if hasOpenness}
								<!-- A `<td>` isn't focusable, so a real button gives keyboard users a
								     tab stop into the breakdown; the cell's `onfocusin` shows the tip
								     and Escape dismisses it, per the ARIA tooltip pattern. The
								     accessible name comes from the meter's own `role="img"` label. -->
								<button
									type="button"
									class="openness-trigger"
									onkeydown={(e) => e.key === 'Escape' && hideOpennessTip()}
								>
									<OpennessMeter model={m} compact />
								</button>
							{/if}
						</td>
					{/if}
					<td class="tbl-num tbl-col-num">{fmtInt(m.embeddingDim)}</td>
					<td class="tbl-num tbl-col-num">{fmtInt(m.maxTokens)}</td>
					<td class="tbl-num tbl-col-num">{m.releaseDate ?? '—'}</td>
					<td class="tbl-col-chips">
						<div class="tbl-chips">
							{#each sortModalities(m.modalities ?? []) as mod (mod)}
								<span class="badge modality-tint" data-modality={mod} title={mod}>
									<ModalityIcon modality={mod} size={11} />
									<span>{mod}</span>
								</span>
							{/each}
						</div>
					</td>
					<td class="tbl-col-avail">
						<span class="badge avail" class:open={m.openWeights} class:closed={!m.openWeights}>
							{m.openWeights ? 'Open' : 'Proprietary'}
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Column-header tips — Parameters / Openness / Embed dim / Max tokens, each
     supplying its copy via `data-tip` from the shared `COLUMN_INFO`. -->
<HoverPortal visible={tipState.visible} title={tipState.title} x={tipState.x} y={tipState.y}>
	{tipState.text}
</HoverPortal>
<!-- Per-cell openness breakdown — same card-style meter + dimensions. -->
<OpennessHoverPortal bind:this={opennessTipPortal} />

<style>
	.badge.avail.open {
		color: var(--tint-green-fg);
		background: transparent;
	}
	.badge.avail.closed {
		color: var(--text-muted);
		background: transparent;
	}
	/* `.openness-cell` / `.openness-trigger` live in
	   src/lib/styles/leaderboard-table.css — shared with SummaryTable. Only the
	   header sizing is local: shrink-to-fit so the pip meter doesn't steal
	   width from the Model column. */
	.openness-head {
		width: 1%;
		white-space: nowrap;
	}
</style>
