/**
 * Interaction Store - Tracks active drag/resize state
 *
 * This store allows SelectionOverlay to broadcast pending transforms
 * so CanvasElement can show live preview during interaction
 */

import { writable } from 'svelte/store';

export interface InteractionState {
	activeElementId: string | null;
	mode: 'idle' | 'dragging' | 'resizing' | 'rotating' | 'radius' | 'editing-text';
	pendingPosition: { x: number; y: number } | null;
	pendingSize: { width: number; height: number } | null;
	pendingRotation: number | null;
	pendingRadius: number | null;
	// Individual corner radii for independent corner editing
	pendingCornerRadii: { nw: number; ne: number; se: number; sw: number } | null;
	groupTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }>;
	// Text editing state
	editingElementId: string | null;
	// Hide element during parent change transition to prevent flash
	hiddenDuringTransition: string | null; // Element ID to hide
}

const initialState: InteractionState = {
	activeElementId: null,
	mode: 'idle',
	pendingPosition: null,
	pendingSize: null,
	pendingRotation: null,
	pendingRadius: null,
	pendingCornerRadii: null,
	groupTransforms: new Map(),
	editingElementId: null,
	hiddenDuringTransition: null
};

export const interactionState = writable<InteractionState>(initialState);

/**
 * Enter text editing mode for an element
 */
export function startEditingText(elementId: string): void {
	interactionState.update((state) => ({
		...state,
		mode: 'editing-text',
		editingElementId: elementId
	}));
}

/**
 * Exit text editing mode
 */
export function stopEditingText(): void {
	interactionState.update((state) => ({
		...state,
		mode: 'idle',
		editingElementId: null
	}));
}
