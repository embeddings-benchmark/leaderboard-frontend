<script lang="ts">
	// Compact sponsor acknowledgement strip. Rendered inside the global
	// footer so it reads as one slim line rather than a tall band.
	//
	// Logo rendering has two modes:
	//  - Full-colour brand logos (`mono: false`) render as <img>. Their
	//    palettes read on both the light and dark footer backgrounds.
	//  - Single-colour marks/wordmarks (`mono: true`) render as a masked
	//    <span> tinted with `currentColor`, so they track the theme's text
	//    colour instead of vanishing on one background. (An <img> can't
	//    inherit currentColor; a CSS mask can.)
	import { base } from '$app/paths';

	interface Sponsor {
		name: string;
		url: string;
		file: string;
		// Intrinsic dimensions — drive `aspect-ratio` so each logo reserves
		// the right width at a fixed row height (no layout shift, and the
		// masked variant has no intrinsic size of its own).
		w: number;
		h: number;
		mono?: boolean;
	}

	const active: Sponsor[] = [
		{ name: 'Laude Institute', url: 'https://www.laude.org', file: 'laude.svg', w: 296, h: 296 },
		{ name: 'Hugging Face', url: 'https://huggingface.co', file: 'huggingface.svg', w: 95, h: 88 },
		{ name: 'Cursor', url: 'https://cursor.com', file: 'cursor.svg', w: 24, h: 24, mono: true }
	];
	const past: Sponsor[] = [
		{
			name: 'Contextual AI',
			url: 'https://contextual.ai',
			file: 'contextual.svg',
			w: 175,
			h: 27,
			mono: true
		},
		{ name: 'Google', url: 'https://about.google', file: 'google.svg', w: 272, h: 92 }
	];

	const src = (file: string) => `${base}/sponsors/${file}`;
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href below is an external sponsor URL -->
{#snippet logo(s: Sponsor)}
	<a class="logo" href={s.url} target="_blank" rel="noreferrer" aria-label={s.name} title={s.name}>
		{#if s.mono}
			<span
				class="mark mono-mark"
				style="aspect-ratio: {s.w} / {s.h}; -webkit-mask-image: url('{src(
					s.file
				)}'); mask-image: url('{src(s.file)}');"
				aria-hidden="true"
			></span>
		{:else}
			<img
				class="mark"
				src={src(s.file)}
				alt=""
				style="aspect-ratio: {s.w} / {s.h};"
				loading="lazy"
				decoding="async"
			/>
		{/if}
	</a>
{/snippet}

<div class="sponsors">
	<span class="sp-label">Sponsors</span>
	<ul class="sp-row">
		{#each active as s (s.name)}
			<li>{@render logo(s)}</li>
		{/each}
	</ul>
	<span class="sp-dot" aria-hidden="true"></span>
	<span class="sp-label sp-label-past">Past</span>
	<ul class="sp-row sp-row-past">
		{#each past as s (s.name)}
			<li>{@render logo(s)}</li>
		{/each}
	</ul>
</div>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	.sponsors {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px 14px;
	}
	.sp-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}
	.sp-label-past {
		opacity: 0.85;
	}
	.sp-row {
		--logo-h: 22px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sp-row-past {
		--logo-h: 15px;
	}
	.sp-row li {
		display: inline-flex;
	}
	/* Subtle dot separating the active and past groups. */
	.sp-dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--border-strong);
	}
	.logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		opacity: 0.9;
		transition:
			opacity 0.16s ease,
			color 0.16s ease;
	}
	.logo:hover {
		opacity: 1;
		color: var(--ink-strong);
		text-decoration: none;
	}
	.logo:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
		border-radius: 5px;
	}
	/* Past sponsors read dimmer; hover restores presence. */
	.sp-row-past .logo {
		opacity: 0.6;
	}
	.sp-row-past .logo:hover {
		opacity: 0.95;
	}
	/* Shared logo sizing — height is the constant, width derives from the
	   inline `aspect-ratio`. */
	.mark {
		display: block;
		height: var(--logo-h);
		width: auto;
	}
	/* Single-colour marks painted with the link's `currentColor`. */
	.mono-mark {
		background-color: currentColor;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
	}

	@media (max-width: 640px) {
		.sponsors {
			gap: 6px 10px;
		}
		.sp-row {
			--logo-h: 20px;
			gap: 6px 12px;
		}
		.sp-row-past {
			--logo-h: 14px;
		}
	}
</style>
