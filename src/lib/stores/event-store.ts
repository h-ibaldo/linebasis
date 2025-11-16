/**
 * Event Store - IndexedDB persistence for design events
 *
 * This is the core of the event sourcing system. All design changes
 * are stored as append-only events in IndexedDB for local-first persistence.
 */

import type { DesignEvent, EventStoreSnapshot } from '$lib/types/events';

const DB_NAME = 'linebasis';
const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const SNAPSHOTS_STORE = 'snapshots';

// ============================================================================
// IndexedDB Setup
// ============================================================================

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
	if (dbInstance) {
		return dbInstance;
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error('Failed to open IndexedDB'));
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Events store - append-only event log
			if (!db.objectStoreNames.contains(EVENTS_STORE)) {
				const eventStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' });
				eventStore.createIndex('timestamp', 'timestamp', { unique: false });
				eventStore.createIndex('type', 'type', { unique: false });
			}

			// Snapshots store - periodic state snapshots for performance
			if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
				db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'version' });
			}
		};
	});
}

/**
 * Close IndexedDB connection
 */
export function closeDB(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * Append a new event to the event log
 */
export async function appendEvent(event: DesignEvent): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readwrite');
		const store = transaction.objectStore(EVENTS_STORE);
		const request = store.add(event);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to append event'));
	});
}

/**
 * Append multiple events in a single transaction
 */
export async function appendEvents(events: DesignEvent[]): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readwrite');
		const store = transaction.objectStore(EVENTS_STORE);

		let completed = 0;
		for (const event of events) {
			const request = store.add(event);
			request.onsuccess = () => {
				completed++;
				if (completed === events.length) {
					resolve();
				}
			};
			request.onerror = () => reject(new Error('Failed to append events'));
		}
	});
}

/**
 * Get all events from the event log
 */
export async function getAllEvents(): Promise<DesignEvent[]> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readonly');
		const store = transaction.objectStore(EVENTS_STORE);
		const index = store.index('timestamp');
		const request = index.getAll();

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error('Failed to get events'));
	});
}

/**
 * Get events since a specific timestamp
 */
export async function getEventsSince(timestamp: number): Promise<DesignEvent[]> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readonly');
		const store = transaction.objectStore(EVENTS_STORE);
		const index = store.index('timestamp');
		const range = IDBKeyRange.lowerBound(timestamp, true); // Exclude the timestamp itself
		const request = index.getAll(range);

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error('Failed to get events since timestamp'));
	});
}

/**
 * Get events of a specific type
 */
export async function getEventsByType(type: string): Promise<DesignEvent[]> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readonly');
		const store = transaction.objectStore(EVENTS_STORE);
		const index = store.index('type');
		const request = index.getAll(type);

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error('Failed to get events by type'));
	});
}

/**
 * Get a single event by ID
 */
export async function getEvent(eventId: string): Promise<DesignEvent | null> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readonly');
		const store = transaction.objectStore(EVENTS_STORE);
		const request = store.get(eventId);

		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(new Error('Failed to get event'));
	});
}

/**
 * Get the count of events in the store
 */
export async function getEventCount(): Promise<number> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readonly');
		const store = transaction.objectStore(EVENTS_STORE);
		const request = store.count();

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error('Failed to count events'));
	});
}

/**
 * Clear all events (use with caution!)
 */
export async function clearEvents(): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([EVENTS_STORE], 'readwrite');
		const store = transaction.objectStore(EVENTS_STORE);
		const request = store.clear();

		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to clear events'));
	});
}

// ============================================================================
// Snapshot Operations
// ============================================================================

/**
 * Save a snapshot of the current state
 * Snapshots improve performance by avoiding full event replay
 */
export async function saveSnapshot(snapshot: EventStoreSnapshot): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SNAPSHOTS_STORE], 'readwrite');
		const store = transaction.objectStore(SNAPSHOTS_STORE);
		const request = store.put(snapshot);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to save snapshot'));
	});
}

/**
 * Get the latest snapshot
 */
export async function getLatestSnapshot(): Promise<EventStoreSnapshot | null> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SNAPSHOTS_STORE], 'readonly');
		const store = transaction.objectStore(SNAPSHOTS_STORE);
		const request = store.getAll();

		request.onsuccess = () => {
			const snapshots = request.result as EventStoreSnapshot[];
			if (snapshots.length === 0) {
				resolve(null);
			} else {
				// Find the snapshot with the highest version
				const latest = snapshots.reduce((max, snapshot) =>
					snapshot.version > max.version ? snapshot : max
				);
				resolve(latest);
			}
		};
		request.onerror = () => reject(new Error('Failed to get latest snapshot'));
	});
}

/**
 * Get a specific snapshot by version
 */
export async function getSnapshot(version: number): Promise<EventStoreSnapshot | null> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SNAPSHOTS_STORE], 'readonly');
		const store = transaction.objectStore(SNAPSHOTS_STORE);
		const request = store.get(version);

		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(new Error('Failed to get snapshot'));
	});
}

/**
 * Clear all snapshots
 */
export async function clearSnapshots(): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([SNAPSHOTS_STORE], 'readwrite');
		const store = transaction.objectStore(SNAPSHOTS_STORE);
		const request = store.clear();

		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to clear snapshots'));
	});
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Export all events as JSON (for backup/sync)
 */
export async function exportEvents(): Promise<string> {
	const events = await getAllEvents();
	return JSON.stringify(events, null, 2);
}

/**
 * Validate if parsed JSON is a valid array of DesignEvents
 */
function validateEvents(data: unknown): data is DesignEvent[] {
	if (!Array.isArray(data)) {
		return false;
	}

	// Check that each item has required event properties
	return data.every((event) => {
		return (
			event &&
			typeof event === 'object' &&
			'id' in event &&
			'type' in event &&
			'timestamp' in event &&
			typeof event.id === 'string' &&
			typeof event.type === 'string' &&
			typeof event.timestamp === 'number'
		);
	});
}

/**
 * Import events from JSON (for restore/sync)
 *
 * @throws {Error} If JSON is invalid or doesn't match expected event structure
 */
export async function importEvents(json: string): Promise<void> {
	try {
		// Parse JSON with error handling
		const parsed = JSON.parse(json);

		// Validate structure
		if (!validateEvents(parsed)) {
			throw new Error(
				'Invalid event data: Expected an array of events with id, type, and timestamp properties'
			);
		}

		// Clear existing events and import new ones
		await clearEvents();
		await appendEvents(parsed);
	} catch (error) {
		// Re-throw with more context if it's a JSON parse error
		if (error instanceof SyntaxError) {
			throw new Error(`Failed to parse JSON: ${error.message}`);
		}
		// Re-throw other errors as-is
		throw error;
	}
}

/**
 * Get database size estimate
 */
export async function getStorageEstimate(): Promise<{
	usage: number;
	quota: number;
	percentage: number;
} | null> {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		const estimate = await navigator.storage.estimate();
		const usage = estimate.usage || 0;
		const quota = estimate.quota || 0;
		const percentage = quota > 0 ? (usage / quota) * 100 : 0;
		return { usage, quota, percentage };
	}
	return null;
}
