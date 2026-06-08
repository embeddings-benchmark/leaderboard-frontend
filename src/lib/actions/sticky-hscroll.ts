/**
 * Sticky horizontal scrollbar overlay for tall tables.
 *
 * Why: `.tbl-scroll` has `overflow-x: auto` and no `max-height`, so it grows
 * to fit the table (often several thousand pixels) and the native horizontal
 * scrollbar sits at the very bottom of that wrapper — far below the viewport
 * fold. Users had no visual hint that the table was horizontally scrollable.
 *
 * What: this action mirrors the `stickyHead` pattern in reverse. It builds a
 * `position: fixed; bottom: 0` overlay the same width as the wrapper, with a
 * single inner element sized to the real table's `scrollWidth`. The browser
 * gives the overlay a native horizontal scrollbar; we sync its `scrollLeft`
 * both ways with the underlying wrapper so dragging the floating bar pans
 * the table and vice versa. Visible only when the wrapper straddles the
 * viewport such that its own scrollbar is off-screen.
 *
 * Usage:
 *   <div class="tbl-scroll" use:stickyHScroll>
 *     <table>…</table>
 *   </div>
 *
 * FUTURE: container scroll-state queries (`@container scroll-state(scrollable: right)`)
 * could drive the *visibility* of the overlay declaratively once that feature
 * is Baseline. The overlay still needs JS for two-way scrollLeft sync — the
 * scroll-state API only exposes a boolean "can scroll", not a position — so
 * this action would shrink, not disappear. Tracking guide:
 * scrollability-affordance-hints in modern-web-guidance. Today (2026-06)
 * container scroll-state queries are Chrome 133+ / Edge 133+ only, with no
 * Firefox/Safari support, so a pure-CSS fallback isn't tenable yet.
 */

import type { Action } from 'svelte/action';
import { onWindowResize, onWindowScroll } from './sticky-events';

// Same `::-webkit-scrollbar { height: 10px }` rule that `.tbl-scroll`
// uses (see leaderboard-table.css). Pad the overlay slightly above so
// the thumb has breathing room from the border-top.
const BAR_HEIGHT_PX = 14;

export const stickyHScroll: Action<HTMLElement> = (wrapper) => {
	// On narrow viewports the native touch-swipe already scrolls the
	// table horizontally and there's no mouse cursor to drag a floating
	// scrollbar — the overlay just covers the bottom edge of content
	// without adding affordance. Skip the whole setup (observers,
	// listeners, DOM nodes) below 640 px to match the mobile breakpoint
	// used elsewhere in the project. We don't react to later rotation;
	// orientation changes typically come with a reload on phones.
	if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
		return;
	}

	const ac = new AbortController();
	const { signal } = ac;

	const overlay = document.createElement('div');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.className = 'sticky-hscroll-overlay';
	overlay.style.cssText = `
		position: fixed;
		left: 0;
		bottom: 0;
		height: ${BAR_HEIGHT_PX}px;
		overflow-x: scroll;
		overflow-y: hidden;
		pointer-events: auto;
		z-index: 40;
		background: var(--bar-bg, var(--surface));
		border-top: 1px solid var(--border);
		display: none;
	`;

	// Inner spacer just gives the overlay something with the table's
	// scrollable width so the native scrollbar appears the right size.
	const spacer = document.createElement('div');
	spacer.style.cssText = 'height: 1px; width: 1px;';
	overlay.appendChild(spacer);
	document.body.appendChild(overlay);

	// Two-way scroll sync. The `syncing` flag avoids the feedback loop
	// where setting scrollLeft fires the listener which sets scrollLeft
	// back, etc.
	let syncing = false;
	function onOverlayScroll() {
		if (syncing) return;
		syncing = true;
		wrapper.scrollLeft = overlay.scrollLeft;
		syncing = false;
	}
	function onWrapperScroll() {
		if (syncing) return;
		syncing = true;
		overlay.scrollLeft = wrapper.scrollLeft;
		syncing = false;
	}

	// Layout cache — same pattern as sticky-head. Wrapper geometry only
	// shifts on resize / DOM change, so caching it once means the scroll
	// hot-path can derive viewport coordinates from cheap `scrollY` reads
	// without firing per-frame `getBoundingClientRect()` calls (3-per-frame
	// across the three tab tables — the main source of phone-Firefox jank).
	let layoutDirty = true;
	let cachedWrapperLeft = 0;
	let cachedWrapperWidth = 0;
	let cachedWrapperDocTop = 0;
	let cachedWrapperDocBottom = 0;
	let cachedScrollWidth = 0;
	let cachedClientWidth = 0;
	let appliedLeft = -1;
	let appliedWidth = -1;
	let appliedSpacer = -1;
	let overlayDisplayed = false;
	function readLayout() {
		const wr = wrapper.getBoundingClientRect();
		const sx = window.scrollX;
		const sy = window.scrollY;
		cachedWrapperLeft = wr.left + sx;
		cachedWrapperWidth = wr.width;
		cachedWrapperDocTop = wr.top + sy;
		cachedWrapperDocBottom = wr.bottom + sy;
		// `querySelector('table')` over `firstElementChild` so a future
		// caption, header strip, or skeleton placeholder above the table
		// doesn't silently break the scrollWidth measurement.
		const table = wrapper.querySelector('table');
		cachedScrollWidth = table ? table.scrollWidth : wrapper.scrollWidth;
		cachedClientWidth = wrapper.clientWidth;
		layoutDirty = false;
	}
	function markLayoutDirty() {
		layoutDirty = true;
	}

	function update() {
		// Bail when our wrapper lives in any inactive `.tab-pane` — without
		// this both Summary's and Per Task's overlays paint at the same
		// `bottom: 0` position and stack, intercepting horizontal-scroll
		// gestures meant for whichever overlay sits underneath. Mirrors
		// the same guard in sticky-head.
		const pane = wrapper.closest('.tab-pane');
		if (pane && !pane.classList.contains('active')) {
			if (overlayDisplayed) {
				overlay.style.display = 'none';
				overlayDisplayed = false;
			}
			return;
		}
		if (layoutDirty) readLayout();
		// Hide when the wrapper isn't horizontally scrollable.
		if (cachedScrollWidth <= cachedClientWidth) {
			if (overlayDisplayed) {
				overlay.style.display = 'none';
				overlayDisplayed = false;
			}
			return;
		}
		const sy = window.scrollY;
		const wrapperTop = cachedWrapperDocTop - sy;
		const wrapperBottom = cachedWrapperDocBottom - sy;
		const viewportH = window.innerHeight;
		// Hide while the native bottom scrollbar is on-screen (wrapper
		// bottom inside viewport) or the wrapper has scrolled past.
		if (wrapperBottom <= viewportH || wrapperTop >= viewportH) {
			if (overlayDisplayed) {
				overlay.style.display = 'none';
				overlayDisplayed = false;
			}
			return;
		}
		// Only write static-position styles when they actually change.
		const left = cachedWrapperLeft - window.scrollX;
		if (appliedLeft !== left) {
			overlay.style.left = `${left}px`;
			appliedLeft = left;
		}
		if (appliedWidth !== cachedWrapperWidth) {
			overlay.style.width = `${cachedWrapperWidth}px`;
			appliedWidth = cachedWrapperWidth;
		}
		if (appliedSpacer !== cachedScrollWidth) {
			spacer.style.width = `${cachedScrollWidth}px`;
			appliedSpacer = cachedScrollWidth;
		}
		if (!overlayDisplayed) {
			overlay.style.display = 'block';
			overlayDisplayed = true;
		}
		if (overlay.scrollLeft !== wrapper.scrollLeft) {
			syncing = true;
			overlay.scrollLeft = wrapper.scrollLeft;
			syncing = false;
		}
	}

	// Batch `update()` so a noisy scroll stream resolves to one layout
	// read + style write per frame instead of one per event.
	let rafId = 0;
	function scheduleUpdate() {
		if (rafId) return;
		rafId = requestAnimationFrame(() => {
			rafId = 0;
			update();
		});
	}
	// Resize / DOM growth invalidates the cached layout values.
	function scheduleResync() {
		markLayoutDirty();
		scheduleUpdate();
	}

	const ro = new ResizeObserver(scheduleResync);
	ro.observe(wrapper);
	const table = wrapper.querySelector('table');
	if (table) ro.observe(table);

	// Mirror sticky-head — flush + re-evaluate the moment the containing
	// pane is activated, so the overlay appears immediately rather than
	// waiting for the next scroll/resize event.
	const paneAncestor = wrapper.closest('.tab-pane');
	let paneMo: MutationObserver | null = null;
	if (paneAncestor) {
		paneMo = new MutationObserver(() => {
			markLayoutDirty();
			scheduleUpdate();
		});
		paneMo.observe(paneAncestor, { attributes: true, attributeFilter: ['class'] });
	}

	onWindowScroll(scheduleUpdate, signal);
	wrapper.addEventListener('scroll', onWrapperScroll, { passive: true, signal });
	overlay.addEventListener('scroll', onOverlayScroll, { passive: true, signal });
	onWindowResize(scheduleResync, signal);

	update();

	return {
		destroy() {
			if (rafId) cancelAnimationFrame(rafId);
			ro.disconnect();
			paneMo?.disconnect();
			ac.abort();
			overlay.remove();
		}
	};
};
