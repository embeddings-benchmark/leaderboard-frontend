<script lang="ts">
	/**
	 * Three-state color-scheme switcher (light / system / dark).
	 *
	 * State storage: ``localStorage["color-scheme"]`` holds one of "light",
	 * "dark", or is absent (= system default). The inline pre-paint script in
	 * ``src/app.html`` reads the same key, so refreshes don't flash the wrong
	 * scheme.
	 *
	 * Effect on the page: setting "light" or "dark" pins the
	 * ``<html data-theme>`` attribute and updates the ``<meta name="color-scheme">``
	 * content. The base stylesheet's ``light-dark()`` tokens automatically
	 * collapse to the pinned branch because ``data-theme`` rewrites
	 * ``color-scheme`` for the root element.
	 */
	import { onMount } from 'svelte';
	import Sun from 'lucide-svelte/icons/sun';
	import Monitor from 'lucide-svelte/icons/monitor';
	import Moon from 'lucide-svelte/icons/moon';

	type Choice = 'light' | 'system' | 'dark';

	// Module-stable options list so the `{#each}` doesn't re-allocate it
	// per reactive read.
	const OPTS: ReadonlyArray<{ k: Choice; title: string; label: string }> = [
		{ k: 'light', title: 'Light theme', label: 'Light' },
		{ k: 'system', title: 'Follow system theme', label: 'System' },
		{ k: 'dark', title: 'Dark theme', label: 'Dark' }
	];

	let choice = $state<Choice>('system');

	onMount(() => {
		try {
			const saved = localStorage.getItem('color-scheme');
			if (saved === 'light' || saved === 'dark') choice = saved;
		} catch {
			/* private mode etc. — leave as system */
		}
	});

	function setMeta(value: 'light dark' | 'light' | 'dark') {
		const meta = document.querySelector('meta[name="color-scheme"]');
		if (meta) meta.setAttribute('content', value);
	}

	function apply(next: Choice) {
		choice = next;
		const root = document.documentElement;
		// DOM updates first — keep them out of the try block so a partitioned
		// or sandboxed iframe (e.g. HF Spaces) where localStorage throws
		// SecurityError still flips the theme in-session.
		if (next === 'system') {
			root.removeAttribute('data-theme');
			setMeta('light dark');
		} else {
			root.setAttribute('data-theme', next);
			setMeta(next);
		}
		try {
			if (next === 'system') localStorage.removeItem('color-scheme');
			else localStorage.setItem('color-scheme', next);
		} catch {
			/* iframe sandbox / private mode — choice won't persist across reloads */
		}
	}
</script>

<div class="theme-toggle" role="radiogroup" aria-label="Color theme">
	{#each OPTS as opt (opt.k)}
		<button
			type="button"
			class="seg"
			class:on={choice === opt.k}
			role="radio"
			aria-checked={choice === opt.k}
			title={opt.title}
			onclick={() => apply(opt.k)}
		>
			{#if opt.k === 'light'}
				<Sun size={14} strokeWidth={1.8} aria-hidden="true" />
			{:else if opt.k === 'system'}
				<Monitor size={14} strokeWidth={1.8} aria-hidden="true" />
			{:else}
				<Moon size={14} strokeWidth={1.8} aria-hidden="true" />
			{/if}
			<span class="sr-only">{opt.label}</span>
		</button>
	{/each}
</div>

<style>
	.theme-toggle {
		display: inline-flex;
		padding: 2px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 999px;
	}
	.seg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-subtle);
		border-radius: 999px;
		cursor: pointer;
	}
	.seg:hover {
		color: var(--ink-strong);
	}
	.seg.on {
		background: var(--surface);
		color: var(--ink-strong);
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.08);
	}
	.seg:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
</style>
