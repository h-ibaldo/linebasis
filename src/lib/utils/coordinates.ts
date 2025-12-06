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
 * Convert absolute position to relative position within parent
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

	// Subtract parent's position to get relative position
	let relX = absolutePos.x - parentTransform.x;
	let relY = absolutePos.y - parentTransform.y;

	// If parent is rotated, need to un-rotate the child position
	if (parentTransform.rotation && parentTransform.rotation !== 0) {
		// Rotate by negative parent rotation to get back to parent's local space
		const angleRad = (-parentTransform.rotation * Math.PI) / 180;
		const cos = Math.cos(angleRad);
		const sin = Math.sin(angleRad);

		const unrotatedX = relX * cos - relY * sin;
		const unrotatedY = relX * sin + relY * cos;

		relX = unrotatedX;
		relY = unrotatedY;
	}

	return { x: relX, y: relY };
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
