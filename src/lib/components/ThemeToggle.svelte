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
		try {
			if (next === 'system') {
				localStorage.removeItem('color-scheme');
				root.removeAttribute('data-theme');
				setMeta('light dark');
			} else {
				localStorage.setItem('color-scheme', next);
				root.setAttribute('data-theme', next);
				setMeta(next);
			}
		} catch {
			/* localStorage may throw; the DOM updates still take effect */
		}
	}
</script>

<div class="theme-toggle" role="radiogroup" aria-label="Color theme">
	<button
		type="button"
		class="seg"
		class:on={choice === 'light'}
		role="radio"
		aria-checked={choice === 'light'}
		title="Light theme"
		onclick={() => apply('light')}
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
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m4.93 19.07 1.41-1.41" />
			<path d="m17.66 6.34 1.41-1.41" />
		</svg>
		<span class="sr-only">Light</span>
	</button>
	<button
		type="button"
		class="seg"
		class:on={choice === 'system'}
		role="radio"
		aria-checked={choice === 'system'}
		title="Follow system theme"
		onclick={() => apply('system')}
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
			<rect x="2" y="3" width="20" height="14" rx="2" />
			<path d="M8 21h8" />
			<path d="M12 17v4" />
		</svg>
		<span class="sr-only">System</span>
	</button>
	<button
		type="button"
		class="seg"
		class:on={choice === 'dark'}
		role="radio"
		aria-checked={choice === 'dark'}
		title="Dark theme"
		onclick={() => apply('dark')}
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
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
		<span class="sr-only">Dark</span>
	</button>
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
		transition:
			color 0.16s ease,
			background 0.16s ease;
	}
	.seg:hover {
		color: var(--ink-strong);
	}
	.seg.on {
		background: var(--surface);
		color: var(--ink-strong);
		box-shadow: 0 1px 2px rgb(0, 0, 0, 0.08);
	}
	.seg:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
