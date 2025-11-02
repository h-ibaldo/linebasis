/**
 * Interaction Store - Tracks active drag/resize state
 *
 * This store allows SelectionOverlay to broadcast pending transforms
 * so CanvasElement can show live preview during interaction
 */

import { writable } from 'svelte/store';

export interface InteractionState {
	activeElementId: string | null;
	mode: 'idle' | 'dragging' | 'resizing' | 'rotating';
	pendingPosition: { x: number; y: number } | null;
	pendingSize: { width: number; height: number } | null;
	pendingRotation: number | null;
	groupTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }>;
}

const initialState: InteractionState = {
	activeElementId: null,
	mode: 'idle',
	pendingPosition: null,
	pendingSize: null,
	pendingRotation: null,
	groupTransforms: new Map()
};

export const interactionState = writable<InteractionState>(initialState);
