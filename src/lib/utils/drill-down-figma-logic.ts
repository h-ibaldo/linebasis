/**
 * Figma-style Drill-Down Isolation Logic
 *
 * This file contains the core logic for implementing Figma-style hierarchical group isolation.
 * It will be integrated into CanvasElement.svelte after validation.
 */

import type { DesignState, Group } from '$lib/stores/design-store';
import type { InteractionState } from '$lib/stores/interaction-store';

// Helper: Build hierarchy from element to root
export function buildHierarchy(elementGroupId: string, groups: Record<string, Group>): string[] {
	const hierarchy: string[] = [];
	let currentGroupId: string | null = elementGroupId;

	while (currentGroupId) {
		hierarchy.unshift(currentGroupId);
		const group = groups[currentGroupId];
		currentGroupId = group?.parentGroupId || null;
	}

	return hierarchy;
}

// Helper: Get all elements in a group (recursively)
export function getAllElementsInGroup(groupId: string, groups: Record<string, Group>): string[] {
	const group = groups[groupId];
	if (!group) return [];

	const result = [...group.elementIds];

	// Add elements from child groups
	Object.values(groups).forEach(childGroup => {
		if (childGroup.parentGroupId === groupId) {
			result.push(...getAllElementsInGroup(childGroup.id, groups));
		}
	});

	return result;
}

// Helper: Check if element/group is within current isolation boundary
export function isWithinIsolation(
	elementGroupId: string,
	isolationStack: string[],
	groups: Record<string, Group>
): boolean {
	if (isolationStack.length === 0) return true; // No isolation = everything is accessible

	const hierarchy = buildHierarchy(elementGroupId, groups);
	const currentIsolation = isolationStack[isolationStack.length - 1];

	// Element is within isolation if the current isolation level is in its hierarchy
	return hierarchy.includes(currentIsolation);
}

// Helper: Find which child of isolatedGroupId contains this element
export function findChildAtIsolationLevel(
	elementGroupId: string,
	isolationLevel: string,
	groups: Record<string, Group>
): string | null {
	const hierarchy = buildHierarchy(elementGroupId, groups);
	const isolatedIndex = hierarchy.indexOf(isolationLevel);

	if (isolatedIndex !== -1 && isolatedIndex + 1 < hierarchy.length) {
		return hierarchy[isolatedIndex + 1];
	}

	return null; // Element is not within this isolation level
}

/**
 * Handle double-click: Drill down one isolation level
 *
 * Rules:
 * 1. If not isolated: isolate the root group, select the child containing clicked element
 * 2. If isolated: drill into the selected group one level deeper
 */
export function handleDoubleClick(
	elementGroupId: string | null,
	elementId: string,
	isolationStack: string[],
	groups: Record<string, Group>
): {
	newIsolationStack: string[];
	groupToSelect: string;
	elementsToSelect: string[];
} {
	if (!elementGroupId) {
		// Element has no group - can't drill down
		return {
			newIsolationStack: isolationStack,
			groupToSelect: elementId,
			elementsToSelect: [elementId]
		};
	}

	const hierarchy = buildHierarchy(elementGroupId, groups);
	const currentIsolation = isolationStack.length > 0 ? isolationStack[isolationStack.length - 1] : null;

	if (!currentIsolation) {
		// At root level - drill into first level
		const rootGroupId = hierarchy[0];
		const childToSelect = hierarchy.length > 1 ? hierarchy[1] : rootGroupId;

		return {
			newIsolationStack: [rootGroupId],
			groupToSelect: childToSelect,
			elementsToSelect: getAllElementsInGroup(childToSelect, groups)
		};
	}

	// Already isolated - drill one level deeper
	const currentIndex = hierarchy.indexOf(currentIsolation);

	if (currentIndex === -1) {
		// Clicked element is not in current isolation - this shouldn't happen
		// Reset to root
		return {
			newIsolationStack: [],
			groupToSelect: hierarchy[0],
			elementsToSelect: getAllElementsInGroup(hierarchy[0], groups)
		};
	}

	if (currentIndex + 1 < hierarchy.length) {
		// Drill into next level
		const nextLevel = hierarchy[currentIndex + 1];

		// If there's another level after nextLevel, select that group
		// Otherwise, we're drilling into a leaf group, so select the actual element
		if (currentIndex + 2 < hierarchy.length) {
			const childToSelect = hierarchy[currentIndex + 2];
			return {
				newIsolationStack: [...isolationStack, nextLevel],
				groupToSelect: childToSelect,
				elementsToSelect: getAllElementsInGroup(childToSelect, groups)
			};
		} else {
			// Drilling into leaf group - select the clicked element
			return {
				newIsolationStack: [...isolationStack, nextLevel],
				groupToSelect: elementId,
				elementsToSelect: [elementId]
			};
		}
	}

	// At deepest group level - can't drill further
	// (In Figma, this would isolate individual elements)
	return {
		newIsolationStack: [...isolationStack, elementGroupId],
		groupToSelect: elementId,
		elementsToSelect: [elementId]
	};
}

/**
 * Handle single-click: Select element/group at current isolation level
 *
 * Rules:
 * 1. If clicking outside isolation boundary: dismantle isolation to that level
 * 2. If clicking within isolation: select the group at the current isolation level
 * 3. If clicking across branches: dismantle deeper isolations
 */
export function handleSingleClick(
	elementGroupId: string | null,
	elementId: string,
	isolationStack: string[],
	groups: Record<string, Group>
): {
	newIsolationStack: string[];
	elementsToSelect: string[];
	shouldDismantle: boolean;
} {
	if (!elementGroupId) {
		// Ungrouped element clicked - dismantle all isolation
		return {
			newIsolationStack: [],
			elementsToSelect: [elementId],
			shouldDismantle: isolationStack.length > 0
		};
	}

	if (isolationStack.length === 0) {
		// No isolation - select entire root group
		const hierarchy = buildHierarchy(elementGroupId, groups);
		const rootGroup = hierarchy[0];
		return {
			newIsolationStack: [],
			elementsToSelect: getAllElementsInGroup(rootGroup, groups),
			shouldDismantle: false
		};
	}

	// Check if element is within current isolation
	const hierarchy = buildHierarchy(elementGroupId, groups);
	const currentIsolation = isolationStack[isolationStack.length - 1];

	// Find where the isolation stack and element hierarchy diverge
	let commonDepth = 0;
	for (let i = 0; i < Math.min(isolationStack.length, hierarchy.length); i++) {
		if (isolationStack[i] === hierarchy[i]) {
			commonDepth = i + 1;
		} else {
			break;
		}
	}

	// If they diverged before the current isolation level, we're clicking across branches
	if (commonDepth < isolationStack.length) {
		// Dismantle isolations deeper than the common point
		const newStack = isolationStack.slice(0, commonDepth);
		const levelToSelect = commonDepth < hierarchy.length ? hierarchy[commonDepth] : elementGroupId;

		return {
			newIsolationStack: newStack,
			elementsToSelect: getAllElementsInGroup(levelToSelect, groups),
			shouldDismantle: true
		};
	}

	// Element is within current isolation - select at current level
	const childAtLevel = findChildAtIsolationLevel(elementGroupId, currentIsolation, groups);

	if (childAtLevel) {
		return {
			newIsolationStack: isolationStack,
			elementsToSelect: getAllElementsInGroup(childAtLevel, groups),
			shouldDismantle: false
		};
	}

	// Fallback: select immediate group
	return {
		newIsolationStack: isolationStack,
		elementsToSelect: getAllElementsInGroup(elementGroupId, groups),
		shouldDismantle: false
	};
}
