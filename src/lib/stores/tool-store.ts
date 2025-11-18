/**
 * Tool Store - Manages the currently selected tool
 *
 * Tools:
 * - move: Select and move elements (default)
 * - hand: Pan around canvas
 * - scale: Resize elements
 * - div: Draw div container
 * - text: Draw text element
 * - media: Draw media (image/video)
 */

import { writable, get } from 'svelte/store';

export type Tool = 'move' | 'hand' | 'scale' | 'div' | 'text' | 'media';

// Current selected tool
export const currentTool = writable<Tool>('move');

/**
 * Cycle through navigation tools: move → hand → scale → move
 */
export function cycleNavigationTools(): void {
	const current = get(currentTool);

	if (current === 'move') {
		currentTool.set('hand');
	} else if (current === 'hand') {
		currentTool.set('scale');
	} else if (current === 'scale') {
		currentTool.set('move');
	} else {
		// If on any other tool (div, text, media), switch to move
		currentTool.set('move');
	}
}
