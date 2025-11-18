/**
 * Viewport Store - Tracks canvas viewport position and scale
 */

import { writable } from 'svelte/store';

export interface Viewport {
	x: number;
	y: number;
	scale: number;
}

// Default viewport centered at origin with 1:1 scale
const initialViewport: Viewport = {
	x: 0,
	y: 0,
	scale: 1
};

export const viewport = writable<Viewport>(initialViewport);

/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
	screenX: number,
	screenY: number,
	viewportState: Viewport
): { x: number; y: number } {
	return {
		x: (screenX - viewportState.x) / viewportState.scale,
		y: (screenY - viewportState.y) / viewportState.scale
	};
}

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
	canvasX: number,
	canvasY: number,
	viewportState: Viewport
): { x: number; y: number } {
	return {
		x: canvasX * viewportState.scale + viewportState.x,
		y: canvasY * viewportState.scale + viewportState.y
	};
}

/**
 * Get the center point of the visible screen in canvas coordinates
 */
export function getViewportCenter(
	viewportState: Viewport,
	screenWidth: number,
	screenHeight: number
): { x: number; y: number } {
	const screenCenterX = screenWidth / 2;
	const screenCenterY = screenHeight / 2;
	return screenToCanvas(screenCenterX, screenCenterY, viewportState);
}
