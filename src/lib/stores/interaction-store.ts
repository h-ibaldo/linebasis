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
	// Hierarchical group isolation stack for drill-down navigation (Figma-style)
	// Each entry represents a level of isolation, from root to deepest
	// Empty array = no isolation (root level)
	// [ga] = ga's children (gb, gc) are isolated
	// [ga, gb] = gb's children (gba, gbb) are isolated (within ga's isolation)
	// The LAST item in the stack is the current isolation level
	isolationStack: string[];
	// Auto-layout reordering state
	reorderParentId: string | null;
	reorderTargetIndex: number | null;
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
	hiddenDuringTransition: null,
	isolationStack: [],
	reorderParentId: null,
	reorderTargetIndex: null
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

/**
 * Push a new isolation level onto the stack
 * Drills down one level deeper into the specified group
 */
export function pushIsolation(groupId: string): void {
	interactionState.update((state) => ({
		...state,
		isolationStack: [...state.isolationStack, groupId]
	}));
}

/**
 * Pop the last isolation level from the stack
 * Goes up one level (dismantles deepest isolation)
 */
export function popIsolation(): void {
	interactionState.update((state) => ({
		...state,
		isolationStack: state.isolationStack.slice(0, -1)
	}));
}

/**
 * Set the entire isolation stack
 * Used when jumping to a specific isolation level
 */
export function setIsolationStack(stack: string[]): void {
	interactionState.update((state) => ({
		...state,
		isolationStack: [...stack]
	}));
}

/**
 * Clear all isolation levels (return to root level)
 */
export function clearIsolation(): void {
	interactionState.update((state) => ({
		...state,
		isolationStack: []
	}));
}

/**
 * Get the current isolation level (last item in stack)
 * Returns null if no isolation (at root level)
 */
export function getCurrentIsolationLevel(state: InteractionState): string | null {
	return state.isolationStack.length > 0
		? state.isolationStack[state.isolationStack.length - 1]
		: null;
}

// Backward compatibility aliases (deprecated - will be removed)
export const isolateElementFromGroup = (elementId: string) => {
	console.warn('isolateElementFromGroup is deprecated, use pushIsolation');
	pushIsolation(elementId);
};
export const clearElementIsolation = clearIsolation;
