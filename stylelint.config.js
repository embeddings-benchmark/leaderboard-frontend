/** @type {import('stylelint').Config} */
export default {
	extends: ['stylelint-config-standard'],
	plugins: ['stylelint-plugin-use-baseline'],
	overrides: [
		{
			files: ['**/*.svelte'],
			extends: ['stylelint-config-html/svelte'],
			customSyntax: 'postcss-html'
		}
	],
	rules: {
		// Target Baseline 2024 — warn on any CSS feature that hadn't reached
		// Baseline by the end of 2024. `light-dark()` (2024), `color-mix()`
		// (2024), `:has()` (2023) are all in. Newer features will warn.
		'plugin/use-baseline': [true, { available: 2024, severity: 'warning' }],

		// Project conventions
		'selector-class-pattern': null,
		'custom-property-pattern': null,
		'keyframes-name-pattern': null,

		// Svelte `:global()` and scoped-style usage
		'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
		'no-empty-source': null,

		// We rely on light-dark() and color-mix() heavily
		'function-no-unknown': [true, { ignoreFunctions: ['light-dark', 'color-mix', 'theme'] }],

		// Modern CSS features we deliberately use
		'media-feature-range-notation': 'prefix',
		'alpha-value-notation': null,
		'color-function-notation': null,
		'hue-degree-notation': null,
		'shorthand-property-no-redundant-values': null,
		'declaration-block-no-redundant-longhand-properties': null,

		// Tone down stylistic noise that conflicts with Prettier / Svelte scoping
		'no-descending-specificity': null,
		'no-duplicate-selectors': null,
		'comment-empty-line-before': null,
		'rule-empty-line-before': null,
		'declaration-empty-line-before': null,
		'at-rule-empty-line-before': null,
		'value-keyword-case': null,
		'font-family-name-quotes': null,
		'no-irregular-whitespace': null,

		// Allow vendor prefixes when needed (e.g. -webkit-line-clamp)
		'property-no-vendor-prefix': null,
		'value-no-vendor-prefix': null,
		'media-feature-name-no-vendor-prefix': null,
		'at-rule-no-vendor-prefix': null,
		'selector-no-vendor-prefix': null,

		// `clip: rect(...)` is the classic visually-hidden idiom we keep
		// alongside `clip-path` for compat; `word-break: break-word` is
		// a well-supported alias of `overflow-wrap: break-word`.
		'property-no-deprecated': null,
		'declaration-property-value-keyword-no-deprecated': null
	}
};
