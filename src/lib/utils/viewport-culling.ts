/**
 * Viewport Culling Utilities
 *
 * Optimizes canvas rendering by only rendering elements visible in the viewport.
 * Includes a buffer zone to prevent pop-in during panning/zooming.
 */

import type { Element } from '$lib/types/events';

export interface ViewportBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Viewport {
	x: number; // Pan offset X
	y: number; // Pan offset Y
	scale: number; // Zoom level
}

/**
 * Calculate the visible area in canvas coordinates
 * @param viewport Current viewport state (pan and zoom)
 * @param canvasBounds Canvas element bounding rect
 * @param bufferMultiplier Extra buffer zone (0.5 = 50% extra on each side)
 */
export function getVisibleArea(
	viewport: Viewport,
	canvasBounds: DOMRect | null,
	bufferMultiplier: number = 0.5
): ViewportBounds | null {
	if (!canvasBounds) return null;

	// Calculate visible area in canvas coordinates (accounting for zoom and pan)
	const visibleArea: ViewportBounds = {
		x: (-viewport.x) / viewport.scale,
		y: (-viewport.y) / viewport.scale,
		width: canvasBounds.width / viewport.scale,
		height: canvasBounds.height / viewport.scale
	};

	// Add buffer zone to prevent pop-in during panning
	visibleArea.x -= visibleArea.width * bufferMultiplier;
	visibleArea.y -= visibleArea.height * bufferMultiplier;
	visibleArea.width *= (1 + bufferMultiplier * 2);
	visibleArea.height *= (1 + bufferMultiplier * 2);

	return visibleArea;
}

/**
 * Check if an element intersects with the visible area
 * @param element Element to check
 * @param visibleArea Visible viewport bounds in canvas coordinates
 */
export function intersectsViewport(element: Element, visibleArea: ViewportBounds): boolean {
	const elementBounds = {
		x: element.position.x,
		y: element.position.y,
		width: element.size.width,
		height: element.size.height
	};

	// AABB (Axis-Aligned Bounding Box) intersection test
	return !(
		elementBounds.x + elementBounds.width < visibleArea.x ||
		elementBounds.x > visibleArea.x + visibleArea.width ||
		elementBounds.y + elementBounds.height < visibleArea.y ||
		elementBounds.y > visibleArea.y + visibleArea.height
	);
}

/**
 * Get absolute position of an element (accounting for parent hierarchy)
 * @param element Element to get position for
 * @param elements All elements in the design
 */
export function getAbsoluteElementBounds(
	element: Element,
	elements: Record<string, Element>
): { x: number; y: number; width: number; height: number } {
	let x = element.position.x;
	let y = element.position.y;

	// Traverse parent hierarchy to get absolute position
	let currentElement = element;
	while (currentElement.parentId) {
		const parent = elements[currentElement.parentId];
		if (!parent) break;
		x += parent.position.x;
		y += parent.position.y;
		currentElement = parent;
	}

	return {
		x,
		y,
		width: element.size.width,
		height: element.size.height
	};
}

/**
 * Filter elements to only those visible in the viewport
 * @param rootElementIds Root-level element IDs (from page.canvasElements)
 * @param elements All elements in the design
 * @param visibleArea Visible viewport bounds
 * @param alwaysIncludeSelected Whether to always include selected elements (prevents deselection glitches)
 * @param selectedIds IDs of currently selected elements
 */
export function getVisibleElements(
	rootElementIds: string[],
	elements: Record<string, Element>,
	visibleArea: ViewportBounds | null,
	alwaysIncludeSelected: boolean = true,
	selectedIds: string[] = []
): Element[] {
	if (!visibleArea) {
		// If no visible area, render all elements (fallback)
		return rootElementIds.map(id => elements[id]).filter(Boolean);
	}

	const visibleElements: Element[] = [];

	// Check each root element
	for (const id of rootElementIds) {
		const element = elements[id];
		if (!element) continue;

		// Get absolute bounds (accounting for parent hierarchy)
		const bounds = getAbsoluteElementBounds(element, elements);

		// Check if element is visible or selected
		const isVisible = intersectsViewport(
			{ ...element, position: { x: bounds.x, y: bounds.y } },
			visibleArea
		);
		const isSelected = alwaysIncludeSelected && selectedIds.includes(id);

		if (isVisible || isSelected) {
			visibleElements.push(element);
		}
	}

	return visibleElements;
}

/**
 * Recursively get all descendant element IDs
 * Used to ensure child elements are rendered when parent is visible
 */
export function getAllDescendantIds(element: Element, elements: Record<string, Element>): string[] {
	const descendants: string[] = [];

	if (!element.children || element.children.length === 0) {
		return descendants;
	}

	for (const childId of element.children) {
		descendants.push(childId);
		const child = elements[childId];
		if (child) {
			descendants.push(...getAllDescendantIds(child, elements));
		}
	}

	return descendants;
}
