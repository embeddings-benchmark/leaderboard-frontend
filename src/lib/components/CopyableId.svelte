<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import Copy from 'lucide-svelte/icons/copy';

	// A single pill that shows a code id and copies it to the clipboard
	// when clicked anywhere on the pill (text or icon — the whole region
	// is one <button>). Used next to benchmark display names so the
	// canonical id (e.g. `MTEB(eng, v2)`) stays one click away from any
	// user who needs it to cite the benchmark or wire it into a script.

	interface Props {
		value: string;
		ariaLabel?: string;
	}
	let { value, ariaLabel }: Props = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function copy(e: MouseEvent) {
		// The pill is often nested inside a card-wide <a> link; without
		// these the click bubbles up and navigates instead of copying.
		e.stopPropagation();
		e.preventDefault();
		// Modern path. The legacy `document.execCommand('copy')` fallback
		// is intentionally omitted — the leaderboard targets Baseline 2024
		// browsers, all of which expose `navigator.clipboard.writeText`.
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				copied = false;
				timer = null;
			}, 1400);
		} catch {
			/* user cancelled the permission prompt or the browser blocked it */
		}
	}
</script>

<button
	type="button"
	class="copyable-id"
	class:copied
	title="Copy {value}"
	aria-label={ariaLabel ?? `Copy ${value}`}
	onclick={copy}
>
	<code class="value">{value}</code>
	<span class="copy-btn" aria-hidden="true">
		{#if copied}
			<Check size={12} strokeWidth={2.6} />
		{:else}
			<Copy size={12} strokeWidth={2} />
		{/if}
	</span>
</button>

<style>
	/*
	 * Layout is deterministic on purpose: the value cell and the copy
	 * icon share an explicit height and `line-height: 1`, so Firefox
	 * (which adds font-metric ghost space differently than WebKit/Blink)
	 * renders the pill identically. The modern `text-box: trim-both cap
	 * alphabetic` fix lands in Firefox 144 (Newly Available 2025), but
	 * we target Baseline 2024, so we use the fixed-height fallback. See
	 * `precise-text-alignment` in modern-web-guidance.
	 */
	.copyable-id {
		/* The whole pill is the click target — text and icon both copy.
		   Size to content even inside flex / grid parents that would
		   otherwise stretch us to fill the cross-axis. */
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		justify-self: flex-start;
		width: max-content;
		max-width: 100%;
		height: 22px;
		gap: 0;
		padding: 0;
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 12px;
		line-height: 1;
		text-align: left;
		/* Per-state colours overridable via CSS custom properties — parents
		   can theme the pill without reaching for `:global(...)`. */
		background: var(--copyable-bg, var(--surface-muted));
		color: var(--copyable-text, var(--text-muted));
		border: 1px solid var(--copyable-border, var(--border));
		border-radius: 6px;
		overflow: clip;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s,
			border-color 0.12s;
	}
	.copyable-id:hover {
		color: var(--copyable-text-hover, var(--text));
		background: var(
			--copyable-bg-hover,
			color-mix(in srgb, var(--primary) 10%, var(--surface-muted))
		);
		border-color: var(
			--copyable-border-hover,
			color-mix(in srgb, var(--primary) 40%, var(--border))
		);
	}
	.copyable-id:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 1px;
	}
	.copyable-id.copied {
		/* Brief affirmation: tint the whole pill green-ish via the
		   primary-soft, matching the check-icon state. */
		background: color-mix(in srgb, var(--primary) 18%, var(--surface));
		border-color: var(--primary);
		color: var(--primary-strong);
	}
	.value {
		display: inline-flex;
		align-items: center;
		height: 100%;
		padding: 0 8px;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: inherit;
		font-size: inherit;
		line-height: 1;
	}
	.copy-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 100%;
		padding: 0;
		border-left: 1px solid var(--copyable-border, var(--border));
		color: inherit;
	}
	.copyable-id:hover .copy-btn {
		border-left-color: var(
			--copyable-border-hover,
			color-mix(in srgb, var(--primary) 40%, var(--border))
		);
	}
	.copyable-id.copied .copy-btn {
		border-left-color: color-mix(in srgb, var(--primary) 40%, transparent);
	}
</style>
