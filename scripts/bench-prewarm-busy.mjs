#!/usr/bin/env node
/**
 * Pre-warm main-thread busy time benchmark.
 *
 * Loads /benchmark/{name} (Summary visible), then for the next WINDOW ms
 * measures:
 *   - aggregate long-task duration (>= 50 ms tasks per Long Tasks API)
 *   - max single long task
 *   - count of long tasks
 *   - time-to-perf-task-pane-fully-rendered (when its tbody has all rows)
 *
 * This surfaces whether the offscreen pre-paint of PerTaskTab is
 * blocking the main thread in one big burst (regressive) or streaming
 * across idle slots (progressive).
 *
 *   node scripts/bench-prewarm-busy.mjs
 *   BROWSERS=chromium,firefox node scripts/bench-prewarm-busy.mjs
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
const WINDOW = Number(args.window ?? 4000);
const ITERS = Number(args.iters ?? 3);
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
		for (let i = 0; i < ITERS; i++) {
			const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
			const page = await ctx.newPage();
			await page.goto(URL, { waitUntil: 'load' });
			await page.waitForSelector('.tab-pane.active .tbl', { timeout: 30_000 });
			const result = await page.evaluate(async (windowMs) => {
				let firstFullRenderMs = null;
				const t0 = performance.now();

				// Cross-browser main-thread block measurement: schedule
				// setTimeout(fn, INTERVAL) every INTERVAL ms. Each
				// probe records `now - (scheduledAt + INTERVAL)` — its
				// own lateness vs. its own scheduling time, not the
				// cumulative drift from the original cadence. A long
				// blocking task delays that one probe by the task
				// length; subsequent probes reset clean.
				const TIMER_INTERVAL = 20;
				const delays = [];
				const scheduleProbe = () => {
					const scheduledAt = performance.now();
					setTimeout(() => {
						const now = performance.now();
						const delay = now - scheduledAt - TIMER_INTERVAL;
						if (delay > 0) delays.push(delay);
						if (now - t0 < windowMs) scheduleProbe();
					}, TIMER_INTERVAL);
				};
				scheduleProbe();

				const totalRows = document.querySelectorAll('.summary-table tbody tr').length;
				const findPerfTask = () => {
					const panes = document.querySelectorAll('.tab-pane[data-prepaint]');
					for (const p of panes) {
						const cols = p.querySelectorAll('thead th').length;
						if (cols >= 50) return p;
					}
					return null;
				};
				const checkFull = () => {
					if (firstFullRenderMs !== null) return;
					const p = findPerfTask();
					if (!p) return;
					const bodyRows = p.querySelectorAll('tbody tr').length;
					if (bodyRows >= totalRows) {
						firstFullRenderMs = Math.round(performance.now() - t0);
					}
				};
				const pollInterval = setInterval(checkFull, 25);
				await new Promise((r) => setTimeout(r, windowMs));
				clearInterval(pollInterval);

				// Filter to "meaningful" blocks (> 30 ms = clearly above
				// scheduler jitter floor). Sum + max approximate the
				// Long Tasks API metrics but work cross-browser.
				const meaningful = delays.filter((d) => d > 30);
				const blockedTotal = meaningful.reduce((a, b) => a + b, 0);
				return {
					totalRows,
					blockCount: meaningful.length,
					blockedTotal: Math.round(blockedTotal),
					blockedMax: Math.round(Math.max(0, ...delays)),
					perfTaskReadyMs: firstFullRenderMs
				};
			}, WINDOW);
			samples.push(result);
			await ctx.close();
		}
		return samples;
	} finally {
		await browser.close();
	}
}

console.log(`Pre-warm busy benchmark  —  ${BENCH}  (${ITERS} cold iters, window=${WINDOW}ms)`);
console.log('—'.repeat(90));
console.log(
	`${'browser'.padEnd(10)}  ${'blocks med'.padEnd(12)} ${'blocked-total'.padEnd(15)} ${'blocked-max'.padEnd(13)} ${'ready med'.padEnd(11)}`
);
console.log('—'.repeat(90));

for (const name of BROWSER_LIST) {
	const engine = ENGINES[name];
	if (!engine) {
		console.error(`Unknown browser: ${name}`);
		continue;
	}
	try {
		const s = await bench(name, engine);
		const counts = s.map((x) => x.blockCount);
		const totals = s.map((x) => x.blockedTotal);
		const maxes = s.map((x) => x.blockedMax);
		const ready = s.map((x) => x.perfTaskReadyMs ?? WINDOW);
		console.log(
			`${name.padEnd(10)}  ${String(med(counts)).padEnd(12)} ${(med(totals) + ' ms').padEnd(15)} ${(med(maxes) + ' ms').padEnd(13)} ${(med(ready) + ' ms').padEnd(11)}`
		);
		console.log(
			`${' '.repeat(10)}  counts=[${counts.join(',')}] totals=[${totals.join(',')}] maxes=[${maxes.join(',')}] ready=[${ready.join(',')}]`
		);
	} catch (e) {
		console.error(`${name}: ${e.message}`);
	}
}
