<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	const VIEWS = [
		{ label: 'Classic', path: '/' },
		{ label: 'Dashboard', path: '/dashboard' },
		{ label: 'Explorer', path: '/explorer' }
	];

	let currentPath = $derived.by(() => {
		const p = page.url.pathname;
		if (!base) return p;
		return p.startsWith(base) ? p.slice(base.length) || '/' : p;
	});

	function isActive(target: string, current: string): boolean {
		if (target === '/') return current === '/' || current === '';
		// Match either /target or /target/anything (handles trailing-slash and nested routes).
		return current === target || current.startsWith(target + '/');
	}
</script>

<nav class="switcher" aria-label="UI variant">
	{#each VIEWS as v (v.path)}
		<a href="{base}{v.path}" class:active={isActive(v.path, currentPath)}>
			{v.label}
		</a>
	{/each}
</nav>

<style>
	.switcher {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: inline-flex;
		gap: 2px;
		padding: 4px;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid var(--border);
		border-radius: 999px;
		box-shadow: var(--shadow-sm);
		font-size: 12px;
		font-weight: 600;
	}
	a {
		padding: 6px 14px;
		border-radius: 999px;
		color: var(--text-muted);
		text-decoration: none;
		letter-spacing: 0.02em;
		transition:
			color 0.12s,
			background 0.12s;
		white-space: nowrap;
	}
	a:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	a.active {
		color: #fff;
		background: var(--primary);
	}
	a.active:hover {
		background: var(--primary-strong);
	}
</style>
