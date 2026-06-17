<script lang="ts">
	// Sponsor acknowledgement band, mounted once in the root layout just
	// above the footer so it sits at the bottom of every page.
	//
	// Logo rendering has two modes:
	//  - Full-colour brand logos (`mono: false`) render as <img>. Their
	//    palettes read on both the light and dark page backgrounds.
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
<section class="sponsors" aria-label="Sponsors">
	<div class="tier tier-active">
		<h2 class="tier-label">Active Sponsors</h2>
		<ul class="row">
			{#each active as s (s.name)}
				<li>
					<a
						class="logo"
						href={s.url}
						target="_blank"
						rel="noreferrer"
						aria-label={s.name}
						title={s.name}
					>
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
				</li>
			{/each}
		</ul>
	</div>

	<div class="tier tier-past">
		<h2 class="tier-label">Past Sponsors</h2>
		<ul class="row">
			{#each past as s (s.name)}
				<li>
					<a
						class="logo"
						href={s.url}
						target="_blank"
						rel="noreferrer"
						aria-label={s.name}
						title={s.name}
					>
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
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	/* `margin-top: auto` (relocated here from `.page-footer`) pins the
	   sponsors + footer block to the viewport floor on short pages. */
	.sponsors {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
		padding: 28px 28px 24px;
		border-top: 1px solid var(--border);
		background: var(--bar-bg);
	}
	.tier {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.tier-label {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 16px 40px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row li {
		display: inline-flex;
	}
	.logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		opacity: 0.92;
		transition:
			opacity 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}
	.logo:hover {
		opacity: 1;
		color: var(--ink-strong);
		transform: translateY(-1px);
		text-decoration: none;
	}
	.logo:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 4px;
		border-radius: 6px;
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

	.tier-active {
		--logo-h: 30px;
	}
	/* Past sponsors read smaller and dimmer; hover restores presence. */
	.tier-past {
		--logo-h: 19px;
		gap: 12px;
	}
	.tier-past .tier-label {
		font-size: 10px;
		color: var(--text-subtle);
		opacity: 0.85;
	}
	.tier-past .logo {
		opacity: 0.6;
	}
	.tier-past .logo:hover {
		opacity: 0.95;
	}

	@media (max-width: 640px) {
		.sponsors {
			padding: 22px 16px 20px;
			gap: 18px;
		}
		.row {
			gap: 14px 26px;
		}
		.tier-active {
			--logo-h: 26px;
		}
		.tier-past {
			--logo-h: 17px;
		}
	}

	/* Honour reduced-motion: drop the hover lift. */
	@media (prefers-reduced-motion: reduce) {
		.logo {
			transition: opacity 0.16s ease;
		}
		.logo:hover {
			transform: none;
		}
	}
</style>
