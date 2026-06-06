/**
 * Helpers for delegated pointer-hover events on table cells.
 *
 * Svelte 5 delegates the bubbling `pointerover` / `pointerout` pair
 * to the document — using those instead of `pointerenter` /
 * `pointerleave` saves a per-cell listener (significant on a
 * 400-row × 250-column PerTask table). The bubbling pair fires on
 * every internal cursor traversal too, so we filter for outer
 * boundary crossings via `relatedTarget`.
 */

/**
 * Return true iff the event just crossed the cell's outer boundary
 * (entry or exit). False for internal traversal (cursor moved
 * between children of the same cell).
 */
export function isBoundaryCross(e: PointerEvent | FocusEvent): boolean {
	const cell = e.currentTarget as HTMLElement | null;
	const other = (e as PointerEvent).relatedTarget as Node | null;
	return !!cell && !(other && cell.contains(other));
}
