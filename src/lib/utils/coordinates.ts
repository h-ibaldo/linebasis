/**
 * Unified coordinate system utilities
 *
 * Single source of truth for coordinate conversions and transforms.
 * All positions stored relative to parent, converted to absolute as needed.
 */

import type { Element, DesignState } from '$lib/types/events';

// ============================================================================
// Types
// ============================================================================

export interface AbsoluteTransform {
	x: number;
	y: number;
	rotation: number;
}

export interface Point {
	x: number;
	y: number;
}

// ============================================================================
// Transform Cache
// ============================================================================

const transformCache = new Map<string, AbsoluteTransform>();

/**
 * Invalidate cached transforms for element and all descendants
 */
export function invalidateTransformCache(elementId: string, state: DesignState): void {
	transformCache.delete(elementId);
	const element = state.elements[elementId];
	if (element) {
		element.children.forEach(childId => invalidateTransformCache(childId, state));
	}
}

/**
 * Clear entire transform cache
 */
export function clearTransformCache(): void {
	transformCache.clear();
}

// ============================================================================
// Core Transform Functions
// ============================================================================

/**
 * Get absolute position and rotation of element
 *
 * Traverses parent chain and accumulates transforms.
 * Results are cached - call invalidateTransformCache after moves/rotations.
 *
 * @param element - Element to get absolute transform for
 * @param state - Design state containing all elements
 * @returns Absolute position and rotation in canvas space
 */
export function getAbsoluteTransform(
	element: Element,
	state: DesignState
): AbsoluteTransform {
	// Check cache first
	const cached = transformCache.get(element.id);
	if (cached) return cached;

	// Start with element's relative position/rotation
	let x = element.position.x;
	let y = element.position.y;
	let rotation = element.rotation || 0;

	// Traverse up parent chain, accumulating transforms
	let current = element;
	while (current.parentId) {
		const parent = state.elements[current.parentId];
		if (!parent) break; // Orphaned element (shouldn't happen)

		// Apply parent's rotation to child's position
		if (parent.rotation && parent.rotation !== 0) {
			const angleRad = (parent.rotation * Math.PI) / 180;
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);

			// Rotate position vector around origin
			const rotatedX = x * cos - y * sin;
			const rotatedY = x * sin + y * cos;
			x = rotatedX;
			y = rotatedY;

			// Accumulate rotation
			rotation += parent.rotation;
		}

		// Add parent's position
		x += parent.position.x;
		y += parent.position.y;

		current = parent;
	}

	const result: AbsoluteTransform = { x, y, rotation };
	transformCache.set(element.id, result);
	return result;
}


/**
 * Get cumulative rotation of all ancestors (not including element itself)
 */
function getCumulativeRotation(element: Element, state: DesignState): number {
	let totalRotation = 0;
	let current = element;
	while (current.parentId) {
		const parent = state.elements[current.parentId];
		if (!parent) break;
		totalRotation += parent.rotation || 0;
		current = parent;
	}
	return totalRotation;
}

/**
 * Recursively calculate element center in absolute space
 * This correctly handles nested rotated parents by accounting for center-based rotation at each level
 * 
 * @param element - Element to get center for
 * @param state - Design state
 * @returns Center point in absolute canvas space
 */
function getElementCenterAbsoluteRecursive(element: Element, state: DesignState): Point {
	// Base case: root element
	if (!element.parentId) {
		const absPos = getAbsolutePosition(element, state);
		return {
			x: absPos.x + element.size.width / 2,
			y: absPos.y + element.size.height / 2
		};
	}
	
	// Recursive case: get parent's center first
	const parent = state.elements[element.parentId];
	if (!parent) {
		// Orphaned - fallback
		const absPos = getAbsolutePosition(element, state);
		return {
			x: absPos.x + element.size.width / 2,
			y: absPos.y + element.size.height / 2
		};
	}
	
	// Get parent's center recursively
	const parentCenter = getElementCenterAbsoluteRecursive(parent, state);
	
	// Calculate total rotation up to and including parent
	let totalRotation = 0;
	let current = parent;
	while (current) {
		totalRotation += current.rotation || 0;
		if (!current.parentId) break;
		current = state.elements[current.parentId];
		if (!current) break;
	}
	
	const halfW = element.size.width / 2;
	const halfH = element.size.height / 2;
	const parentHalfW = parent.size.width / 2;
	const parentHalfH = parent.size.height / 2;
	
	// Element's relative position to parent's top-left
	const relX = element.position.x;
	const relY = element.position.y;
	
	// Calculate element's center relative to parent's center in parent's local (unrotated) space
	// This is the vector from parent's center to child's center, before parent's rotation
	const childCenterRelToParentCenterUnrotatedX = relX + halfW - parentHalfW;
	const childCenterRelToParentCenterUnrotatedY = relY + halfH - parentHalfH;
	
	// Rotate this vector by the parent's total rotation to get its position relative to parent's center in world space
	const angleRad = (totalRotation * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	
	const rotatedRelX = childCenterRelToParentCenterUnrotatedX * cos - childCenterRelToParentCenterUnrotatedY * sin;
	const rotatedRelY = childCenterRelToParentCenterUnrotatedX * sin + childCenterRelToParentCenterUnrotatedY * cos;
	
	// Add this rotated relative position to the parent's absolute center to get the child's absolute center
	return {
		x: parentCenter.x + rotatedRelX,
		y: parentCenter.y + rotatedRelY
	};
}

/**
 * Convert absolute position to relative position within parent
 * Accounts for center-based rotation (CSS rotates around center, not origin)
 *
 * @param absolutePos - Position in canvas space
 * @param targetParent - Parent element to convert relative to (null for root)
 * @param state - Design state
 * @returns Position relative to parent
 */
export function absoluteToRelative(
	absolutePos: Point,
	targetParent: Element | null,
	state: DesignState
): Point {
	if (!targetParent) {
		// No parent = root element, absolute position is the same as relative
		return { x: absolutePos.x, y: absolutePos.y };
	}

	// Get parent's absolute transform
	const parentTransform = getAbsoluteTransform(targetParent, state);

	// If parent is rotated, CSS rotates around the parent's center, not the origin
	if (parentTransform.rotation && parentTransform.rotation !== 0) {
		// Use recursive function to get parent's center in absolute space
		// This correctly handles deeply nested rotated parents
		const parentCenterAbs = getElementCenterAbsoluteRecursive(targetParent, state);
		
		const halfW = targetParent.size.width / 2;
		const halfH = targetParent.size.height / 2;
		
		// Translate point to be relative to parent's center
		const relToCenterX = absolutePos.x - parentCenterAbs.x;
		const relToCenterY = absolutePos.y - parentCenterAbs.y;
		
		// Rotate by negative total rotation to un-rotate (back to parent's local space)
		const totalRotation = parentTransform.rotation;
		const unrotateAngleRad = (-totalRotation * Math.PI) / 180;
		const unrotateCos = Math.cos(unrotateAngleRad);
		const unrotateSin = Math.sin(unrotateAngleRad);
		
		const unrotatedRelToCenterX = relToCenterX * unrotateCos - relToCenterY * unrotateSin;
		const unrotatedRelToCenterY = relToCenterX * unrotateSin + relToCenterY * unrotateCos;
		
		// Translate back to be relative to parent's top-left (add local center)
		return {
			x: unrotatedRelToCenterX + halfW,
			y: unrotatedRelToCenterY + halfH
		};
	} else {
		// No rotation: simple translation
		return {
			x: absolutePos.x - parentTransform.x,
			y: absolutePos.y - parentTransform.y
		};
	}
}

/**
 * Get absolute position (convenience wrapper)
 */
export function getAbsolutePosition(element: Element, state: DesignState): Point {
	const transform = getAbsoluteTransform(element, state);
	return { x: transform.x, y: transform.y };
}

/**
 * Get absolute rotation (convenience wrapper)
 */
export function getAbsoluteRotation(element: Element, state: DesignState): number {
	const transform = getAbsoluteTransform(element, state);
	return transform.rotation;
}

// Expose for E2E testing
if (typeof window !== 'undefined') {
	(window as any).__coordinates = {
		getAbsoluteTransform,
		absoluteToRelative,
		getAbsolutePosition,
		getAbsoluteRotation,
		invalidateTransformCache,
		clearTransformCache
	};
}
