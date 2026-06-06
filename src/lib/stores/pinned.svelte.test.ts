import { describe, expect, it } from 'vitest';
import { pinnedModels } from './pinned.svelte';

// The pinned store is a process-level singleton, so each test starts by
// clearing whatever the previous test left behind.

describe('pinnedModels store', () => {
	it('starts empty under a node test runner (no `?pin=` URL hydration)', () => {
		pinnedModels.clear();
		expect(pinnedModels.size).toBe(0);
		expect(pinnedModels.has('anything')).toBe(false);
	});

	it('add() inserts and is idempotent', () => {
		pinnedModels.clear();
		pinnedModels.add('a');
		pinnedModels.add('a');
		expect(pinnedModels.size).toBe(1);
		expect(pinnedModels.has('a')).toBe(true);
	});

	it('remove() deletes and is a no-op on missing names', () => {
		pinnedModels.clear();
		pinnedModels.add('a');
		pinnedModels.remove('b'); // no-op
		expect(pinnedModels.size).toBe(1);
		pinnedModels.remove('a');
		expect(pinnedModels.has('a')).toBe(false);
	});

	it('toggle() flips presence', () => {
		pinnedModels.clear();
		pinnedModels.toggle('x');
		expect(pinnedModels.has('x')).toBe(true);
		pinnedModels.toggle('x');
		expect(pinnedModels.has('x')).toBe(false);
	});

	it('clear() drops the whole set', () => {
		pinnedModels.add('a');
		pinnedModels.add('b');
		pinnedModels.add('c');
		expect(pinnedModels.size).toBeGreaterThan(0);
		pinnedModels.clear();
		expect(pinnedModels.size).toBe(0);
	});
});
