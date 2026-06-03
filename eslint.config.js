import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import css from '@eslint/css';
import js from '@eslint/js';
import html from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Globs for the JS-language configs. Restricting them keeps core rules
// like `no-irregular-whitespace` (which expects a JS sourceCode API) from
// trying to run on the CSS files handled by `@eslint/css` below.
const JS_FILES = ['**/*.{js,mjs,cjs,ts,mts,cts,svelte,svelte.js,svelte.ts}'];

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ files: JS_FILES, extends: [js.configs.recommended] },
	{ files: JS_FILES, extends: [ts.configs.recommended] },
	{ files: JS_FILES, extends: [svelte.configs.recommended] },
	{ files: JS_FILES, extends: [prettier] },
	{ files: JS_FILES, extends: [svelte.configs.prettier] },
	{
		files: JS_FILES,
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		files: ['src/**/*.css'],
		plugins: { css },
		language: 'css/css',
		rules: {
			'css/no-duplicate-imports': 'error',
			// Mirror the Baseline 2024 cutoff used by stylelint's
			// plugin/use-baseline so the two linters agree.
			'css/use-baseline': ['warn', { available: 2024 }]
		}
	},
	{
		files: ['**/*.html'],
		plugins: { '@html-eslint': html },
		languageOptions: { parser: htmlParser },
		rules: {
			'@html-eslint/use-baseline': ['warn', { available: 2024 }]
		}
	}
);
