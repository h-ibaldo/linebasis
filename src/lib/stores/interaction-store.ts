/**
 * Interaction Store - Tracks active drag/resize state
 *
 * This store allows SelectionOverlay to broadcast pending transforms
 * so CanvasElement can show live preview during interaction
 */

import { writable } from 'svelte/store';

export interface InteractionState {
	activeElementId: string | null;
	mode: 'idle' | 'dragging' | 'resizing' | 'rotating' | 'radius';
	pendingPosition: { x: number; y: number } | null;
	pendingSize: { width: number; height: number } | null;
	pendingRotation: number | null;
	pendingRadius: number | null;
	// Individual corner radii for independent corner editing
	pendingCornerRadii: { nw: number; ne: number; se: number; sw: number } | null;
	groupTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }>;
}

const initialState: InteractionState = {
	activeElementId: null,
	mode: 'idle',
	pendingPosition: null,
	pendingSize: null,
	pendingRotation: null,
	pendingRadius: null,
	pendingCornerRadii: null,
	groupTransforms: new Map()
};

export const interactionState = writable<InteractionState>(initialState);
