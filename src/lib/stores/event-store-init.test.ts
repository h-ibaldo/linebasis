/**
 * Tests for initDB() resilience.
 *
 * Regression cover for the "canvas renders but ignores all input" bug: when
 * another tab holds the IndexedDB connection, `indexedDB.open()` fires
 * `onblocked` and never resolves. Canvas.svelte awaits initDB() before
 * registering its event listeners, so a hanging open left the builder
 * permanently unresponsive with nothing in the console.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Minimal IDBOpenDBRequest stand-in — we only drive the handlers by hand. */
type FakeOpenRequest = {
	onerror: ((this: unknown, ev: unknown) => void) | null;
	onsuccess: ((this: unknown, ev: unknown) => void) | null;
	onblocked: ((this: unknown, ev: unknown) => void) | null;
	onupgradeneeded: ((this: unknown, ev: unknown) => void) | null;
	result: unknown;
};

function makeOpenRequest(): FakeOpenRequest {
	return {
		onerror: null,
		onsuccess: null,
		onblocked: null,
		onupgradeneeded: null,
		result: null
	};
}

/** A stand-in for IDBDatabase that satisfies initDB's liveness probe. */
function makeFakeDB() {
	return {
		objectStoreNames: { contains: () => true },
		transaction: () => ({}),
		close: vi.fn(),
		onclose: null as unknown,
		onversionchange: null as unknown
	};
}

let openRequest: FakeOpenRequest;

beforeEach(async () => {
	vi.resetModules();
	vi.useFakeTimers();
	openRequest = makeOpenRequest();
	vi.stubGlobal('indexedDB', { open: () => openRequest });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('initDB blocked-open handling', () => {
	it('rejects instead of hanging when the open request is blocked by another tab', async () => {
		const { initDB } = await import('./event-store');

		const promise = initDB();
		// Attach a catch handler up front so the rejection is never unhandled.
		const settled = promise.then(
			() => 'resolved' as const,
			(e: Error) => e
		);

		// Another tab holds the connection: the browser fires onblocked and
		// never follows up with success or error.
		openRequest.onblocked?.call(null, {});

		await vi.runAllTimersAsync();

		const outcome = await settled;
		expect(outcome).toBeInstanceOf(Error);
		expect((outcome as Error).message).toMatch(/another tab/i);
	});

	it('rejects when the open request never settles at all', async () => {
		const { initDB } = await import('./event-store');

		const settled = initDB().then(
			() => 'resolved' as const,
			(e: Error) => e
		);

		// No handler fires — simulates an open that silently stalls.
		await vi.runAllTimersAsync();

		const outcome = await settled;
		expect(outcome).toBeInstanceOf(Error);
		expect((outcome as Error).message).toMatch(/timed out|another tab/i);
	});

	it('still resolves normally when the open succeeds', async () => {
		const { initDB } = await import('./event-store');

		const promise = initDB();
		const fakeDB = makeFakeDB();
		openRequest.result = fakeDB;
		openRequest.onsuccess?.call(null, {});

		await expect(promise).resolves.toBe(fakeDB);
	});

	it('does not reject after a successful open, even once the timeout elapses', async () => {
		const { initDB } = await import('./event-store');

		const promise = initDB();
		const fakeDB = makeFakeDB();
		openRequest.result = fakeDB;
		openRequest.onsuccess?.call(null, {});

		await expect(promise).resolves.toBe(fakeDB);

		// The pending timeout must not fire a late rejection at an already
		// settled promise, nor leave a dangling timer behind.
		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe(fakeDB);
	});
});
