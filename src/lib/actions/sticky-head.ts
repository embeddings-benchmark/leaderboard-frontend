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

/**
 * Resolve the current sticky-bar offset (px). The header is `position: sticky;
 * top: 0` in `+layout.svelte` and its height depends on the viewport — the
 * mobile breakpoint compacts it to ~48 px, desktop sits ~52 px. Reading it
 * live keeps the floating thead-clone flush against the bar instead of
 * leaving a gap (when the constant was too large) or sliding under it
 * (when too small).
 */
function stickyTopPx(): number {
	const bar = document.querySelector<HTMLElement>('header.bar');
	return bar ? bar.getBoundingClientRect().height : 48;
}

export const stickyHead: Action<HTMLTableElement> = (table) => {
	const wrapperOrNull = table.closest<HTMLElement>('.tbl-scroll');
	const theadOrNull = table.tHead;
	if (!wrapperOrNull || !theadOrNull) return;
	// Bind to non-nullable locals so closures below don't need re-narrowing.
	const wrapper: HTMLElement = wrapperOrNull;
	const realThead: HTMLTableSectionElement = theadOrNull;

	const overlay = document.createElement('div');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.className = 'sticky-head-overlay';
	overlay.style.cssText = `
		position: fixed;
		top: ${stickyTopPx()}px;
		z-index: 50;
		overflow: hidden;
		pointer-events: none;
		display: none;
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
	(inner.style as CSSStyleDeclaration & { msOverflowStyle?: string }).msOverflowStyle = 'none';

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
		cloneTable.style.width = `${table.offsetWidth}px`;
		const realThs = Array.from(realThead.querySelectorAll<HTMLTableCellElement>('th'));
		const cloneThs = Array.from(cloneThead.querySelectorAll<HTMLTableCellElement>('th'));
		for (let i = 0; i < realThs.length; i++) {
			const cloneTh = cloneThs[i];
			if (!cloneTh) continue;
			const w = realThs[i].offsetWidth;
			cloneTh.style.width = `${w}px`;
			cloneTh.style.minWidth = `${w}px`;
			cloneTh.style.maxWidth = `${w}px`;
		}
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
			overlay.style.display = 'none';
			return;
		}

		const wrapperRect = wrapper.getBoundingClientRect();
		const theadRect = realThead.getBoundingClientRect();
		const tableRect = table.getBoundingClientRect();

		// Re-measure each frame — the bar shrinks at the mobile
		// breakpoint and we want the overlay flush against whatever the
		// current bar height is.
		const stickyTop = stickyTopPx();
		overlay.style.top = `${stickyTop}px`;

		// Show the overlay only when the real thead has scrolled above the offset
		// AND the table itself is still on screen (its bottom hasn't crossed
		// above the overlay yet). Otherwise we'd leave a ghost thead floating
		// after the table is gone.
		const headH = theadRect.height;
		const shouldShow = theadRect.top < stickyTop && tableRect.bottom > stickyTop + headH;

		if (!shouldShow) {
			overlay.style.display = 'none';
			return;
		}

		overlay.style.display = 'block';
		overlay.style.left = `${wrapperRect.left}px`;
		overlay.style.width = `${wrapperRect.width}px`;
		overlay.style.height = `${headH}px`;
		inner.scrollLeft = wrapper.scrollLeft;
	}

	// Forward clicks on the overlay's sort buttons (or any button-like control)
	// to the matching real one by DOM-order index, so sorting works without
	// having to scroll back up.
	function onCloneClick(e: Event) {
		const target = e.target as HTMLElement;
		const cloneBtn = target.closest('button');
		if (!cloneBtn || !inner.contains(cloneBtn)) return;
		const cloneBtns = Array.from(inner.querySelectorAll('button'));
		const realBtns = Array.from(realThead.querySelectorAll('button'));
		const idx = cloneBtns.indexOf(cloneBtn);
		const real = realBtns[idx];
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
		});
	}

	const ro = new ResizeObserver(scheduleResync);
	ro.observe(table);
	ro.observe(wrapper);

	const mo = new MutationObserver(scheduleContent);
	mo.observe(realThead, { childList: true, subtree: true, characterData: true, attributes: true });

	// Watch the containing pane (if any) for class flips so the overlay
	// hides immediately when this table's tab goes inactive — without it,
	// `update()` only runs on scroll/resize and the overlay would linger
	// at the viewport top showing columns from the wrong tab.
	const paneAncestor = table.closest('.tab-pane');
	let paneMo: MutationObserver | null = null;
	if (paneAncestor) {
		paneMo = new MutationObserver(scheduleUpdate);
		paneMo.observe(paneAncestor, { attributes: true, attributeFilter: ['class'] });
	}

	window.addEventListener('scroll', scheduleUpdate, { passive: true });
	wrapper.addEventListener('scroll', scheduleUpdate, { passive: true });
	window.addEventListener('resize', scheduleResync);
	inner.addEventListener('click', onCloneClick);

	syncWidths();
	update();

	return {
		destroy() {
			if (updateRaf) cancelAnimationFrame(updateRaf);
			if (resyncRaf) cancelAnimationFrame(resyncRaf);
			if (contentRaf) cancelAnimationFrame(contentRaf);
			ro.disconnect();
			mo.disconnect();
			paneMo?.disconnect();
			window.removeEventListener('scroll', scheduleUpdate);
			wrapper.removeEventListener('scroll', scheduleUpdate);
			window.removeEventListener('resize', scheduleResync);
			inner.removeEventListener('click', onCloneClick);
			overlay.remove();
		}
	};
};
