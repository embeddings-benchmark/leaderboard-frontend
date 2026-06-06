#!/usr/bin/env node
/**
 * SummaryTable cold-mount benchmark.
 *
 * For each browser, opens a fresh context, navigates to a benchmark
 * detail page, and reports:
 *   - first-row visible (perceived "table is here")
 *   - all-rows visible  (full leaderboard rendered)
 *
 * The gap between the two surfaces progressive-render benefit: cold
 * Firefox often shows a ~700 ms tail between first row + last row
 * because its style/layout engine streams the rest. Chrome + Safari
 * render the whole tbody in one go, so the gap is ~tens of ms.
 *
 * Usage:
 *   node scripts/bench-summary-mount.mjs
 *   node scripts/bench-summary-mount.mjs --base=http://localhost:4173
 *   node scripts/bench-summary-mount.mjs --bench='MTEB(eng, v2)' --iters=5
 *   BROWSERS=firefox node scripts/bench-summary-mount.mjs
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
const BENCH = args.bench ?? 'MTEB(Multilingual, v2)';
const ITERATIONS = Number(args.iters ?? 3);
const MIN_ROWS = Number(args.minRows ?? 400);
const BROWSER_LIST = (process.env.BROWSERS ?? 'chromium,firefox,webkit')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const ENGINES = { chromium, firefox, webkit };
const URL = `${BASE}/benchmark/${encodeURIComponent(BENCH)}`;

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

async function bench(name, engine) {
	const browser = await engine.launch();
	try {
		const samples = [];
		for (let i = 0; i < ITERATIONS; i++) {
			// Fresh context per iteration so cachedHttp is empty + no module cache.
			const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
			const page = await ctx.newPage();
			const t = Date.now();
			await page.goto(URL, { waitUntil: 'commit' });
			await page.waitForSelector('.summary-table tbody tr', { timeout: 30_000 });
			const firstRowMs = Date.now() - t;
			await page.waitForFunction(
				(min) => document.querySelectorAll('.summary-table tbody tr').length >= min,
				MIN_ROWS,
				{ timeout: 30_000 }
			);
			const allRowsMs = Date.now() - t;
			samples.push({ firstRowMs, allRowsMs });
			await ctx.close();
		}
		return { browser: name, samples };
	} finally {
		await browser.close();
	}
}

console.log(`SummaryTable mount benchmark  —  ${BENCH}  (${ITERATIONS} cold iters, base=${BASE})`);
console.log('—'.repeat(78));
console.log(
	`${'browser'.padEnd(10)}  ${'first-row med'.padEnd(15)} ${'all-rows med'.padEnd(15)} ${'tail'.padEnd(8)}  samples`
);
console.log('—'.repeat(78));

for (const browserName of BROWSER_LIST) {
	const engine = ENGINES[browserName];
	if (!engine) {
		console.error(`Unknown browser: ${browserName}`);
		continue;
	}
	try {
		const r = await bench(browserName, engine);
		const first = r.samples.map((s) => s.firstRowMs);
		const all = r.samples.map((s) => s.allRowsMs);
		const fMed = med(first);
		const aMed = med(all);
		console.log(
			`${browserName.padEnd(10)}  ${(fMed + ' ms').padEnd(15)} ${(aMed + ' ms').padEnd(15)} ` +
				`${(aMed - fMed + ' ms').padEnd(8)}  first=[${first.join(',')}] all=[${all.join(',')}]`
		);
	} catch (e) {
		console.error(`${browserName}: ${e.message}`);
	}
}
