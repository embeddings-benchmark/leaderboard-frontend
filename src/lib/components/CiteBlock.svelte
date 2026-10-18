<script lang="ts">
	import BadgeCheck from 'lucide-svelte/icons/badge-check';
	import Check from 'lucide-svelte/icons/check';
	import Copy from 'lucide-svelte/icons/copy';
	import Quote from 'lucide-svelte/icons/quote';
	import X from 'lucide-svelte/icons/x';
	import Segmented from '$lib/components/Segmented.svelte';
	import { bibtexToApa, refText, type RefPart } from '$lib/citation';

	interface Props {
		// What we're citing — used in the button's aria-label and the dialog
		// title ("Cite this {kind}").
		kind: 'benchmark' | 'task' | 'model';
		// The BibTeX entry, when known. null/empty hides the entire block —
		// the page URL itself is the shareable artifact, so we no longer need
		// a separate "Shareable link" UI here.
		citation?: string | null;
	}
	let { kind, citation }: Props = $props();

	// Every citation in mteb passes the "Cited works exist" CI check before
	// it can merge (embeddings-benchmark/mteb#5471), so anything the API
	// serves is verified — either resolved by refaudit or reviewed by hand
	// and allowlisted. The dialog states that; hovering or clicking the badge
	// explains how.

	type Format = 'bibtex' | 'apa';
	const FORMATS = [
		{ label: 'BibTeX', value: 'bibtex' },
		{ label: 'APA', value: 'apa' }
	] as const;

	let dialog = $state<HTMLDialogElement>();
	let format = $state<Format>('bibtex');
	let copied = $state(false);
	let bibtex = $derived(citation?.trim() ?? '');
	// Only parsed once the APA tab is picked.
	let apa = $derived(format === 'apa' ? bibtexToApa(bibtex) : []);
	// Hover previews the explanation; a click pins it open (for touch).
	let whyHovered = $state(false);
	let whyPinned = $state(false);
	let whyOpen = $derived(whyHovered || whyPinned);

	const escapeHtml = (s: string) =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const refHtml = (parts: readonly RefPart[]) =>
		parts.map((p) => (p.em ? `<i>${escapeHtml(p.text)}</i>` : escapeHtml(p.text))).join('');

	async function copy() {
		try {
			if (format === 'bibtex') {
				await navigator.clipboard.writeText(bibtex);
			} else {
				const text = apa.map(refText).join('\n\n');
				// Rich copy keeps the italics when pasted into a word processor.
				if (typeof ClipboardItem === 'undefined') await navigator.clipboard.writeText(text);
				else
					await navigator.clipboard.write([
						new ClipboardItem({
							'text/plain': new Blob([text], { type: 'text/plain' }),
							'text/html': new Blob([apa.map((r) => `<p>${refHtml(r)}</p>`).join('')], {
								type: 'text/html'
							})
						})
					]);
			}
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}

	// Clicks on the `::backdrop` land on the <dialog> itself; clicks on
	// the panel land on its children.
	function onDialogClick(e: MouseEvent) {
		if (e.target === dialog) dialog?.close();
	}
</script>

{#if citation}
	<div class="cite">
		<button
			type="button"
			class="cite-btn"
			aria-label="Cite this {kind}"
			onclick={() => dialog?.showModal()}
		>
			<Quote size={12} aria-hidden="true" />
			Cite
		</button>
	</div>

	<dialog
		bind:this={dialog}
		class="cite-dialog"
		aria-labelledby="cite-dialog-title"
		onclick={onDialogClick}
		onclose={() => (whyPinned = false)}
	>
		<div class="panel-body">
			<header>
				<h2 id="cite-dialog-title">Cite this {kind}</h2>
				<div class="formats">
					<Segmented
						ariaLabel="Citation format"
						options={FORMATS}
						value={format}
						onChange={(v) => (format = v)}
					/>
				</div>
				<button type="button" class="icon-btn" aria-label="Close" onclick={() => dialog?.close()}>
					<X size={16} aria-hidden="true" />
				</button>
			</header>
			{#if format === 'bibtex'}
				<pre><code>{bibtex}</code></pre>
			{:else}
				<div class="apa">
					{#each apa as ref, i (i)}
						<p>
							{#each ref as part, j (j)}{#if part.em}<i>{part.text}</i
									>{:else}{part.text}{/if}{/each}
						</p>
					{/each}
				</div>
			{/if}
			<footer>
				<div class="verified">
					<button
						type="button"
						class="verified-btn"
						aria-expanded={whyOpen}
						aria-controls="cite-verified-why"
						onclick={() => (whyPinned = !whyPinned)}
						onpointerenter={() => (whyHovered = true)}
						onpointerleave={() => (whyHovered = false)}
					>
						<BadgeCheck size={15} aria-hidden="true" />
						Verified citation
					</button>
					<p id="cite-verified-why" class="verified-why" hidden={!whyOpen}>
						Looked up in Crossref, DataCite, arXiv, DBLP and OpenAlex: the work exists, and its
						title, authors and year match the published record. Works no index covers are checked by
						hand.
					</p>
				</div>
				<button type="button" class="copy" onclick={copy}>
					{#if copied}
						<Check size={13} aria-hidden="true" /> Copied
					{:else}
						<Copy size={13} aria-hidden="true" /> Copy {format === 'apa' ? 'APA' : 'BibTeX'}
					{/if}
				</button>
			</footer>
		</div>
	</dialog>
{/if}

<style>
	.cite {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.cite-btn,
	.copy {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		border-radius: 6px;
		cursor: pointer;
	}
	/* Same 22px height as the CopyableId pill it sits beside. */
	.cite-btn {
		height: 22px;
		padding: 0 8px;
		gap: 4px;
		font-weight: 500;
		color: var(--text-muted);
		border-radius: 4px;
	}
	.cite-btn:hover,
	.copy:hover {
		background: var(--surface-muted);
		color: var(--text);
	}
	/* The explanation floats above the badge — below it would overflow the
	   modal, which the UA styles with `overflow: auto`. */
	.verified {
		position: relative;
	}
	.verified-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 4px;
		margin-left: -4px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		background: none;
		border: none;
		border-radius: 4px;
		cursor: help;
	}
	.verified-btn:hover,
	.verified-btn:focus-visible,
	.verified-btn[aria-expanded='true'] {
		background: var(--primary-soft);
	}
	.verified-why {
		position: absolute;
		bottom: calc(100% + 6px);
		left: -4px;
		width: min(340px, calc(100dvw - 80px));
		margin: 0;
		padding: 10px 12px;
		font-size: 12px;
		line-height: 1.5;
		background: var(--tip-bg);
		color: var(--tip-fg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 12px 28px rgb(var(--shadow-tint) / 0.22);
	}

	.cite-dialog {
		width: min(640px, calc(100dvw - 32px));
		padding: 0;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 12px 28px rgb(var(--shadow-tint) / 0.22);
	}
	.cite-dialog::backdrop {
		background: rgb(var(--shadow-tint) / 0.4);
	}
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
	}
	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	footer .copy {
		flex-shrink: 0;
	}
	h2 {
		margin: 0;
		font-size: 15px;
	}
	.formats {
		width: 150px;
		margin-left: auto;
	}
	/* APA references use a hanging indent. */
	.apa {
		max-height: 50dvh;
		overflow: auto;
		padding: 10px 12px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		line-height: 1.6;
	}
	.apa p {
		margin: 0;
		padding-left: 2em;
		text-indent: -2em;
		overflow-wrap: anywhere;
	}
	.apa p + p {
		margin-top: 10px;
	}
	.icon-btn {
		display: inline-flex;
		padding: 4px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
	}
	.icon-btn:hover {
		background: var(--surface-muted);
		color: var(--text);
	}
	pre {
		margin: 0;
		max-height: 50dvh;
		padding: 10px 12px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		overflow: auto;
	}
	code {
		font-family: var(--font-mono);
		background: none;
		padding: 0;
		white-space: pre;
	}
</style>
