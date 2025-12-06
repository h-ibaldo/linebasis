/**
 * Migration utility for unified positioning model
 *
 * Converts elements from legacy auto-layout detection to explicit positionMode property
 */

import type { DesignState, Element } from '$lib/types/events';

/**
 * Migrates all elements to unified positioning model
 *
 * This migration:
 * - Adds positionMode to elements that don't have it
 * - Determines mode based on parent's auto-layout settings
 * - Is idempotent (safe to run multiple times)
 */
export function migrateToUnifiedPositioning(state: DesignState): DesignState {
	const newElements: Record<string, Element> = {};
	let migrationCount = 0;

	// Migrate all elements
	for (const [id, element] of Object.entries(state.elements)) {
		// Skip if already has positionMode
		if (element.positionMode) {
			newElements[id] = element;
			continue;
		}

		// Determine position mode based on legacy auto-layout detection
		let positionMode: 'absolute' | 'flex-item' = 'absolute';

		// Check if element is a child in auto-layout parent
		if (element.parentId) {
			const parent = state.elements[element.parentId];
			if (parent?.autoLayout?.enabled && !element.autoLayout?.ignoreAutoLayout) {
				positionMode = 'flex-item';
			}
		}

		// Migrate element with positionMode
		newElements[id] = {
			...element,
			positionMode
		};

		migrationCount++;
	}

	// Log migration results (only if elements were migrated)
	if (migrationCount > 0) {
		console.log(`[Migration] Migrated ${migrationCount} elements to unified positioning model`);
	}

	return {
		...state,
		elements: newElements
	};
}
