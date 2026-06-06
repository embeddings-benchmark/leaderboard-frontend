<script lang="ts">
	interface Props {
		// What we're citing — used in the summary line ("Cite this {kind}")
		// and the empty-state message ("No citation available for this {kind} yet.").
		kind: 'benchmark' | 'task' | 'model';
		// The BibTeX entry, when known. null/empty hides the entire block —
		// the page URL itself is the shareable artifact, so we no longer need
		// a separate "Shareable link" UI here.
		citation?: string | null;
	}
	let { kind, citation }: Props = $props();

	let open = $state(false);
	let copied = $state(false);

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

{#if citation}
	<details class="cite" bind:open>
		<summary>Cite this {kind}</summary>
		<div class="body">
			<div class="block">
				<div class="block-head">
					<span class="label">Citation (BibTeX)</span>
					<button type="button" class="copy" onclick={() => copy(citation!)}>
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
				<pre><code>{citation}</code></pre>
			</div>
		</div>
	</details>
{/if}

<style>
	.cite {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-bottom: 14px;
	}
	summary {
		padding: 10px 14px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	summary::after {
		content: '+';
		color: var(--text-subtle);
		font-weight: 400;
		font-size: 16px;
	}
	details[open] summary::after {
		content: '−';
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.body {
		padding: 0 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}
	.copy {
		padding: 3px 10px;
		font-size: 11px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		border-radius: 4px;
		cursor: pointer;
	}
	.copy:hover {
		background: var(--surface-muted);
		color: var(--text);
	}
	pre {
		margin: 0;
		padding: 10px 12px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		overflow-x: auto;
	}
	code {
		font-family: var(--font-mono);
		background: none;
		padding: 0;
		white-space: pre;
	}
</style>
