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

// ============================================================================
// Performance Optimization: Throttled Updates
// ============================================================================

let rafId: number | null = null;
let pendingUpdate: Partial<InteractionState> | null = null;

/**
 * Throttled interaction state update using requestAnimationFrame
 * Limits updates to 60fps to prevent excessive re-renders during drag/resize
 */
export function updateInteractionStateThrottled(updates: Partial<InteractionState>): void {
	// Merge with any pending updates
	pendingUpdate = pendingUpdate ? { ...pendingUpdate, ...updates } : updates;

	// If already scheduled, don't schedule again
	if (rafId !== null) return;

	rafId = requestAnimationFrame(() => {
		if (pendingUpdate) {
			interactionState.update(state => ({ ...state, ...pendingUpdate }));
			pendingUpdate = null;
		}
		rafId = null;
	});
}

/**
 * Immediate (non-throttled) interaction state update
 * Use for critical state changes that must be instant (e.g., mode changes)
 */
export function updateInteractionStateImmediate(updates: Partial<InteractionState>): void {
	// Cancel any pending throttled update
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}

	// Apply immediately
	interactionState.update(state => ({ ...state, ...updates }));
	pendingUpdate = null;
}

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
