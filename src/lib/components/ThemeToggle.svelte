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
			<svg
				viewBox="0 0 24 24"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{#if opt.k === 'light'}
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2" />
					<path d="M12 20v2" />
					<path d="m4.93 4.93 1.41 1.41" />
					<path d="m17.66 17.66 1.41 1.41" />
					<path d="M2 12h2" />
					<path d="M20 12h2" />
					<path d="m4.93 19.07 1.41-1.41" />
					<path d="m17.66 6.34 1.41-1.41" />
				{:else if opt.k === 'system'}
					<rect x="2" y="3" width="20" height="14" rx="2" />
					<path d="M8 21h8" />
					<path d="M12 17v4" />
				{:else}
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				{/if}
			</svg>
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
