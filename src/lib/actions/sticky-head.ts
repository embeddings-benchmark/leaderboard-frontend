/**
 * Sticky-thead overlay for leaderboard tables.
 *
 * Why: `.tbl-scroll` has `overflow-x: auto` to contain wide tables inside the
 * main column. Browsers coerce overflow-y to `auto` too, which forms a scroll
 * container on both axes — `position: sticky` on `<thead>` therefore anchors
 * within the wrapper, not the page viewport, and scrolls out of view with
 * the wrapper.
 *
 * Tried (and rejected) CSS-only alternative: `overflow-x: auto; overflow-y: clip`
 * on `.tbl-scroll`. The spec says `clip` doesn't form a scroll container, so
 * in theory the thead's sticky positioning would escape the wrapper and
 * anchor to the viewport. In practice every browser still treats the wrapper
 * as the sticky scroll context for both axes once `overflow-x: auto` is set,
 * so the thead scrolls away with the wrapper just like before. Tested 2026-06,
 * Chrome 137. Don't bother re-trying without verifying browsers fixed this.
 *
 * What: this action clones the `<thead>` into a `position: fixed` overlay
 * pinned at `top: STICKY_TOP_PX` (under the explorer top bar). It mirrors
 * column widths, horizontal scroll, and sort-indicator state, and forwards
 * clicks on the clone's sort buttons to the real ones by index. The original
 * thead remains in the DOM (for layout + reflow) but visually identical
 * "sticky" feedback comes from the overlay.
 *
 * Usage:
 *   <div class="tbl-scroll">
 *     <table class="tbl" use:stickyHead> ... </table>
 *   </div>
 */

import type { Action } from 'svelte/action';
import { onWindowResize, onWindowScroll } from './sticky-events';

export const stickyHead: Action<HTMLTableElement> = (table) => {
	const wrapperOrNull = table.closest<HTMLElement>('.tbl-scroll');
	const theadOrNull = table.tHead;
	if (!wrapperOrNull || !theadOrNull) return;
	// Bind to non-nullable locals so closures below don't need re-narrowing.
	const wrapper: HTMLElement = wrapperOrNull;
	const realThead: HTMLTableSectionElement = theadOrNull;

	const ac = new AbortController();
	const { signal } = ac;

	// Header bar height — mobile/desktop breakpoint swaps it between ~48
	// and ~52 px. Cached so the dirty-path `readLayout()` doesn't pay for
	// a query + rect read; `barRo` below invalidates on actual resize.
	const bar = document.querySelector<HTMLElement>('header.bar');
	let cachedBarH = bar ? bar.offsetHeight : null;
	// Per-table offsets via CSS vars on the table element:
	//   `--sticky-head-base`  — overrides `bar.offsetHeight` (use this when
	//                           the rendered bar adds a border the table
	//                           shouldn't see, e.g. set to `var(--header-height)`)
	//   `--sticky-head-extra` — added on top, for a sticky toolbar etc.
	// Both default to 0 when unset; leaderboard tables (no toolbar) leave
	// them empty and fall back to bar.offsetHeight. Re-read every layout
	// pass so responsive var values are picked up.
	function readCssPx(name: string): number | null {
		const v = getComputedStyle(table).getPropertyValue(name).trim();
		if (!v) return null;
		const n = parseFloat(v);
		return Number.isFinite(n) ? n : null;
	}
	function stickyTopPx(): number {
		const extra = readCssPx('--sticky-head-extra') ?? 0;
		const base = readCssPx('--sticky-head-base');
		if (base !== null) return base + extra;
		if (cachedBarH !== null) return cachedBarH + extra;
		// Cold mount: action ran before the layout header existed. Re-query
		// lazily so a late-arriving bar still drives the offset.
		const lateBar = document.querySelector<HTMLElement>('header.bar');
		return (lateBar ? lateBar.offsetHeight : 48) + extra;
	}

	const overlay = document.createElement('div');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.className = 'sticky-head-overlay';
	// `will-change: transform` is set/cleared by `update()` only while the
	// overlay is visible so the browser doesn't promote a layer that's
	// `display: none` 90% of the page lifetime.
	overlay.style.cssText = `
		position: fixed;
		top: ${stickyTopPx()}px;
		z-index: 50;
		overflow: hidden;
		pointer-events: none;
		display: none;
		contain: layout style paint;
	`;

	// Inner div is the actual horizontal scroll container that mirrors the
	// wrapper's scrollLeft. Sticky cells (.tbl-sticky-pin, .tbl-sticky-col)
	// inside the cloned thead then "stick" relative to this inner scrollport,
	// matching their behavior in the real wrapper.
	const inner = document.createElement('div');
	inner.className = 'sticky-head-inner';
	inner.style.cssText = `
		overflow-x: scroll;
		overflow-y: hidden;
		scrollbar-width: none;
		pointer-events: auto;
		width: 100%;
		height: 100%;
	`;

	const cloneTable = document.createElement('table');
	cloneTable.className = table.className;
	// Borrow the original's inline width so column layout matches exactly.
	cloneTable.style.borderCollapse = 'separate';
	cloneTable.style.borderSpacing = '0';

	let cloneThead = realThead.cloneNode(true) as HTMLTableSectionElement;
	stripIds(cloneThead);
	cloneTable.appendChild(cloneThead);
	inner.appendChild(cloneTable);
	overlay.appendChild(inner);
	document.body.appendChild(overlay);

	function stripIds(root: HTMLElement) {
		root.removeAttribute('id');
		root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
	}

	function syncContent() {
		// Re-clone the real thead so sort indicator state (↑ ↓ ↕) and any other
		// reactive label changes show up on the overlay.
		const fresh = realThead.cloneNode(true) as HTMLTableSectionElement;
		stripIds(fresh);
		cloneTable.replaceChild(fresh, cloneThead);
		cloneThead = fresh;
		syncWidths();
	}

	function syncWidths() {
		const realThs = Array.from(realThead.querySelectorAll<HTMLTableCellElement>('th'));
		const cloneThs = Array.from(cloneThead.querySelectorAll<HTMLTableCellElement>('th'));
		// Read all layout values first, then write — interleaving `offsetWidth`
		// reads with `style.width` writes forces a synchronous reflow per
		// column. On a ~150-col PerTask table that was the dominant resize
		// cost on mobile Firefox (the file's original comment flagged it).
		const tableW = table.offsetWidth;
		const widths = realThs.map((th) => th.offsetWidth);
		cloneTable.style.width = `${tableW}px`;
		for (let i = 0; i < widths.length; i++) {
			const cloneTh = cloneThs[i];
			if (!cloneTh) continue;
			const w = widths[i];
			cloneTh.style.cssText = `width:${w}px;min-width:${w}px;max-width:${w}px`;
		}
	}

	// Layout values cached at resize / mutation / tab-activate time so the
	// hot scroll path doesn't have to call `getBoundingClientRect` (which
	// forces synchronous layout — a major source of jank on mobile Firefox
	// with this 9000-px-wide table). Pixel coordinates are stored in
	// document space (viewport rect + scroll offset) so we can derive the
	// current viewport position each frame from cheap `scrollY` reads.
	let layoutDirty = true;
	let cachedWrapperLeft = 0;
	let cachedWrapperWidth = 0;
	let cachedHeadHeight = 0;
	let cachedTheadDocTop = 0;
	let cachedTableDocBottom = 0;
	let cachedStickyTop = 48;
	// Track the last static-position styles we wrote so we can skip
	// re-applying them when scroll alone fires — keeps the scroll-path
	// style writes down to one (`display`) plus the horizontal sync.
	let appliedLeft = -1;
	let appliedWidth = -1;
	let appliedHeight = -1;
	let appliedTop = -1;
	let overlayDisplayed = false;

	function readLayout() {
		const wr = wrapper.getBoundingClientRect();
		const th = realThead.getBoundingClientRect();
		const tbl = table.getBoundingClientRect();
		const sx = window.scrollX;
		const sy = window.scrollY;
		cachedWrapperLeft = wr.left + sx;
		cachedWrapperWidth = wr.width;
		cachedHeadHeight = th.height;
		cachedTheadDocTop = th.top + sy;
		cachedTableDocBottom = tbl.bottom + sy;
		cachedStickyTop = stickyTopPx();
		layoutDirty = false;
	}

	// Bail when our table lives in any inactive `.tab-pane`. Both
	// `data-prepaint` panes (clip-path hidden, still laid out) and
	// regular `content-visibility: hidden` panes (skipped from paint
	// but `getBoundingClientRect` may still return last-laid-out
	// coords) would otherwise stack their own thead overlays at the
	// top — showing columns from the wrong tab.
	function update() {
		const pane = table.closest('.tab-pane');
		if (pane && !pane.classList.contains('active')) {
			if (overlayDisplayed) {
				overlay.style.display = 'none';
				overlay.style.willChange = '';
				overlayDisplayed = false;
			}
			return;
		}

		if (layoutDirty) readLayout();

		const sy = window.scrollY;
		const theadViewportTop = cachedTheadDocTop - sy;
		const tableViewportBottom = cachedTableDocBottom - sy;
		const stickyTop = cachedStickyTop;
		const headH = cachedHeadHeight;
		const shouldShow = theadViewportTop < stickyTop && tableViewportBottom > stickyTop + headH;

		if (!shouldShow) {
			if (overlayDisplayed) {
				overlay.style.display = 'none';
				overlay.style.willChange = '';
				overlayDisplayed = false;
			}
			return;
		}

		// Only write the static-position styles when they actually changed
		// (resize / layout shift). Scroll alone leaves them stable so the
		// hot path is just `display` + the horizontal sync.
		const left = cachedWrapperLeft - window.scrollX;
		if (appliedLeft !== left) {
			overlay.style.left = `${left}px`;
			appliedLeft = left;
		}
		if (appliedWidth !== cachedWrapperWidth) {
			overlay.style.width = `${cachedWrapperWidth}px`;
			appliedWidth = cachedWrapperWidth;
		}
		if (appliedHeight !== headH) {
			overlay.style.height = `${headH}px`;
			appliedHeight = headH;
		}
		if (appliedTop !== stickyTop) {
			overlay.style.top = `${stickyTop}px`;
			appliedTop = stickyTop;
		}
		if (!overlayDisplayed) {
			overlay.style.display = 'block';
			overlay.style.willChange = 'transform';
			overlayDisplayed = true;
		}
		inner.scrollLeft = wrapper.scrollLeft;
	}

	function markLayoutDirty() {
		layoutDirty = true;
	}

	// Cached clone-button → real-button mapping. Invalidated by the same
	// MutationObserver that watches `realThead` (see `scheduleContent`);
	// recomputed lazily on the next click rather than per click.
	let buttonMap: Map<HTMLButtonElement, HTMLButtonElement> | null = null;
	function rebuildButtonMap(): Map<HTMLButtonElement, HTMLButtonElement> {
		const map = new Map<HTMLButtonElement, HTMLButtonElement>();
		const cloneBtns = inner.querySelectorAll('button');
		const realBtns = realThead.querySelectorAll('button');
		const n = Math.min(cloneBtns.length, realBtns.length);
		for (let i = 0; i < n; i++) map.set(cloneBtns[i], realBtns[i]);
		return map;
	}
	function onCloneClick(e: Event) {
		const target = e.target as HTMLElement;
		const cloneBtn = target.closest('button');
		if (!cloneBtn || !inner.contains(cloneBtn)) return;
		if (!buttonMap) buttonMap = rebuildButtonMap();
		const real = buttonMap.get(cloneBtn as HTMLButtonElement);
		if (real) {
			e.preventDefault();
			real.click();
		}
	}

	// rAF-batch every layout-touching path. Scrolling a 9000-px table fires
	// hundreds of scroll events per second; coalescing to one read+write per
	// frame keeps the overlay sync from saturating the main thread.
	let updateRaf = 0;
	function scheduleUpdate() {
		if (updateRaf) return;
		updateRaf = requestAnimationFrame(() => {
			updateRaf = 0;
			update();
		});
	}
	let resyncRaf = 0;
	function scheduleResync() {
		if (resyncRaf) return;
		resyncRaf = requestAnimationFrame(() => {
			resyncRaf = 0;
			markLayoutDirty();
			syncWidths();
			update();
		});
	}
	let contentRaf = 0;
	function scheduleContent() {
		if (contentRaf) return;
		contentRaf = requestAnimationFrame(() => {
			contentRaf = 0;
			syncContent();
			markLayoutDirty();
			// Buttons may have shifted; force a rebuild on the next click.
			buttonMap = null;
		});
	}

	const ro = new ResizeObserver(scheduleResync);
	ro.observe(table);
	ro.observe(wrapper);

	const barRo = bar
		? new ResizeObserver((entries) => {
				// Use `borderBoxSize` not `contentRect` — the bar uses
				// `box-sizing: border-box` so contentRect (content-box)
				// would exclude its 10px×2 padding and the overlay
				// would dock 20px above the bar's bottom edge.
				cachedBarH = entries[0].borderBoxSize?.[0]?.blockSize ?? entries[0].contentRect.height;
				markLayoutDirty();
				scheduleUpdate();
			})
		: null;
	barRo?.observe(bar!);

	const mo = new MutationObserver(scheduleContent);
	mo.observe(realThead, { childList: true, subtree: true, characterData: true, attributes: true });

	// Watch the containing pane (if any) for class flips so the overlay
	// hides immediately when this table's tab goes inactive — without it,
	// `update()` only runs on scroll/resize and the overlay would linger
	// at the viewport top showing columns from the wrong tab. Also mark
	// the layout dirty so we re-measure when the pane becomes active
	// (its dimensions may have changed while hidden).
	const paneAncestor = table.closest('.tab-pane');
	let paneMo: MutationObserver | null = null;
	if (paneAncestor) {
		paneMo = new MutationObserver(() => {
			markLayoutDirty();
			scheduleUpdate();
		});
		paneMo.observe(paneAncestor, { attributes: true, attributeFilter: ['class'] });
	}

	onWindowScroll(scheduleUpdate, signal);
	wrapper.addEventListener('scroll', scheduleUpdate, { passive: true, signal });
	onWindowResize(scheduleResync, signal);
	inner.addEventListener('click', onCloneClick, { signal });

	syncWidths();
	update();

	return {
		destroy() {
			if (updateRaf) cancelAnimationFrame(updateRaf);
			if (resyncRaf) cancelAnimationFrame(resyncRaf);
			if (contentRaf) cancelAnimationFrame(contentRaf);
			ro.disconnect();
			barRo?.disconnect();
			mo.disconnect();
			paneMo?.disconnect();
			ac.abort();
			overlay.remove();
		}
	};
};
