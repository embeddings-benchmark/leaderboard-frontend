<script lang="ts">
	import { resolve } from '$app/paths';
	type Id = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l';
	interface Props {
		active: Id;
	}
	let { active }: Props = $props();
	const VARIANTS: Array<{ id: Id; label: string; path: string }> = [
		{ id: 'a', label: 'A · Featured + flat', path: '/home-a' },
		{ id: 'b', label: 'B · Editorial', path: '/home-b' },
		{ id: 'c', label: 'C · Search-first', path: '/home-c' },
		{ id: 'd', label: 'D · Starters + tabs', path: '/home-d' },
		{ id: 'e', label: 'E · Flat tabs', path: '/home-e' },
		{ id: 'f', label: 'F · Sidebar', path: '/home-f' },
		{ id: 'g', label: 'G · Hero + drawer', path: '/home-g' },
		{ id: 'h', label: 'H · Wizard', path: '/home-h' },
		{ id: 'i', label: 'I · Bento', path: '/home-i' },
		{ id: 'j', label: 'J · Quadrant', path: '/home-j' },
		{ id: 'k', label: 'K · Top-5 + tabs', path: '/home-k' },
		{ id: 'l', label: 'L · Featured + size + discover', path: '/home-l' }
	];
</script>

<nav class="switch" aria-label="Home page variants">
	<span class="lbl">Mockup:</span>
	{#each VARIANTS as v (v.id)}
		<a class="chip" class:on={v.id === active} href={resolve(v.path as '/home-a')}>{v.label}</a>
	{/each}
	<a class="chip ghost" href={resolve('/')}>← current /</a>
</nav>

<style>
	.switch {
		position: sticky;
		top: var(--header-offset, 56px);
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.lbl {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.chip {
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--border);
		color: var(--text-muted);
		text-decoration: none;
		font-weight: 600;
		white-space: nowrap;
	}
	.chip:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.chip.on {
		color: var(--primary-strong);
		background: var(--primary-soft);
		border-color: var(--primary);
	}
	.chip.ghost {
		margin-left: auto;
		font-weight: 500;
	}
</style>
