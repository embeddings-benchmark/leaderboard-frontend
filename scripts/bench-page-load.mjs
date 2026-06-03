#!/usr/bin/env node
/**
 * Cross-browser cold-vs-hot page-load benchmark.
 *
 * "Cold" = fresh browser context (no cachedHttp entries, no module cache).
 * "Hot"  = same context, navigate to /, then back to the route. Measures
 *          the in-memory `cachedHttp` hit + SPA route swap, no network.
 *
 * Reports time from `link.click()` (or initial `goto`) to the first
 * route-specific "ready" selector being present in the DOM.
 *
 * Usage:
 *   node scripts/bench-page-load.mjs                      # all defaults
 *   node scripts/bench-page-load.mjs --base=http://localhost:4173
 *   BROWSERS=chromium,firefox node scripts/bench-page-load.mjs
 *   node scripts/bench-page-load.mjs --iters=5
 */
import { chromium, firefox, webkit } from 'playwright';

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.filter((a) => a.startsWith('--'))
		.map((a) => {
			const [k, ...rest] = a.replace(/^--/, '').split('=');
			return [k, rest.join('=') || true];
		})
);

const BASE = args.base ?? 'http://localhost:5173';
const ITERATIONS = Number(args.iters ?? 3);
const BROWSER_LIST = (process.env.BROWSERS ?? 'chromium,firefox,webkit')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const ENGINES = { chromium, firefox, webkit };

/** Routes to benchmark — `ready` is the selector that signals first
 *  meaningful content for that route. */
const ROUTES = [
	{ key: 'home', path: '/', ready: '.section .card' },
	{ key: 'benchmarks', path: '/benchmarks', ready: 'section.block a.card' },
	{ key: 'models', path: '/models', ready: 'a.card' },
	{ key: 'tasks', path: '/tasks', ready: 'a.card' },
	// Model + task detail pages need a known name — pick popular ones.
	{
		key: 'model[name]',
		path: '/models/GritLM%2FGritLM-8x7B',
		ready: '.hero h1'
	},
	{
		key: 'task[name]',
		path: '/tasks/STS17',
		ready: '.hero h1'
	}
];

async function timeColdGoto(page, route) {
	const t = Date.now();
	await page.goto(`${BASE}${route.path}`, { waitUntil: 'commit' });
	await page.waitForSelector(route.ready, { timeout: 30_000 });
	return Date.now() - t;
}

/** SPA navigation via in-page JS — exercises the cachedHttp hit path,
 *  no network round-trip if the URL was previously visited in the
 *  same context. Falls back to a direct `goto` if no nav link exists
 *  for the target route (e.g. detail pages with dynamic names — for
 *  those we measure the round-trip after a cache-warming `goto`). */
async function timeHotSpaNav(page, route) {
	// Warm: visit once via goto so the in-memory caches fill, then bounce home.
	await page.goto(`${BASE}${route.path}`);
	await page.waitForSelector(route.ready, { timeout: 30_000 });
	await page.goto(`${BASE}/`);
	await page.waitForSelector('.section .card', { timeout: 30_000 });

	// Hot click — try clicking a same-route nav link first; fall back to
	// scripted SPA navigation if no link exists for this URL.
	const ms = await page.evaluate(
		async ({ path, ready }) => {
			const targetHref = path;
			const link = Array.from(document.querySelectorAll('a')).find(
				(a) => a.getAttribute('href') === targetHref
			);
			async function waitFor(sel) {
				for (let i = 0; i < 200; i++) {
					if (location.pathname.startsWith(targetHref.split('?')[0]) && document.querySelector(sel))
						return;
					await new Promise((r) => setTimeout(r, 10));
				}
			}
			const t = performance.now();
			if (link) {
				link.click();
			} else {
				// History-API SPA navigation: triggers SvelteKit's client router.
				history.pushState({}, '', targetHref);
				window.dispatchEvent(new PopStateEvent('popstate'));
			}
			await waitFor(ready);
			return performance.now() - t;
		},
		{ path: route.path, ready: route.ready }
	);
	return Math.round(ms);
}

function summarise(samples) {
	if (samples.length === 0) return { n: 0 };
	const sorted = [...samples].sort((a, b) => a - b);
	const sum = samples.reduce((a, b) => a + b, 0);
	return {
		n: samples.length,
		avg: Math.round(sum / samples.length),
		median: Math.round(sorted[Math.floor(sorted.length / 2)]),
		min: Math.round(sorted[0]),
		max: Math.round(sorted[sorted.length - 1])
	};
}

async function benchRouteInBrowser(browserName, browserType) {
	const browser = await browserType.launch();
	try {
		const results = {};
		for (const route of ROUTES) {
			const cold = [];
			const hot = [];
			for (let i = 0; i < ITERATIONS; i++) {
				// Fresh context per cold iteration = no in-memory cache, no module cache.
				const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
				const page = await ctx.newPage();
				cold.push(await timeColdGoto(page, route));
				hot.push(await timeHotSpaNav(page, route));
				await ctx.close();
			}
			results[route.key] = { cold: summarise(cold), hot: summarise(hot) };
		}
		return results;
	} finally {
		await browser.close();
	}
}

function pad(s, n) {
	s = String(s);
	return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

console.log(`Page load benchmark  (${ITERATIONS} iters per cell, base=${BASE})`);
console.log('—'.repeat(78));
const header = `${pad('route', 14)} ${pad('browser', 10)}  ${pad('cold avg', 10)} ${pad('cold med', 10)} ${pad('hot avg', 10)} ${pad('hot med', 10)}`;
console.log(header);
console.log('—'.repeat(78));

for (const browserName of BROWSER_LIST) {
	const engine = ENGINES[browserName];
	if (!engine) {
		console.error(`Unknown browser: ${browserName}`);
		continue;
	}
	let perRoute;
	try {
		perRoute = await benchRouteInBrowser(browserName, engine);
	} catch (e) {
		console.error(`${browserName}: ${e.message}`);
		continue;
	}
	for (const route of ROUTES) {
		const r = perRoute[route.key];
		console.log(
			`${pad(route.key, 14)} ${pad(browserName, 10)}  ${pad(r.cold.avg + ' ms', 10)} ` +
				`${pad(r.cold.median + ' ms', 10)} ${pad(r.hot.avg + ' ms', 10)} ${pad(r.hot.median + ' ms', 10)}`
		);
	}
	console.log('—'.repeat(78));
}
