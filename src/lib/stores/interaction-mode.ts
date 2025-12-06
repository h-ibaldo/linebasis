/**
 * Interaction Mode State Machine
 *
 * Explicit state machine for SelectionOverlay interactions.
 * Replaces 17+ scattered state variables with clear states and transitions.
 */

import { writable, type Writable } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Corner = 'nw' | 'ne' | 'se' | 'sw';

// Base state shared across all modes
interface BaseInteractionState {
	hoveredElementId: string | null;
}

// Specific interaction states
export type InteractionMode =
	| { type: 'idle' } & BaseInteractionState
	| {
			type: 'hovering';
			elementId: string;
	  } & BaseInteractionState
	| {
			type: 'dragging';
			elementId: string;
			isGroup: boolean;
			startPosition: Point;
			startTime: number;
			hasMovedBeyondThreshold: boolean;
			// Duplication state
			isDuplicateDrag: boolean;
			hasDuplicated: boolean;
			originalElementIds: string[];
			duplicateElementIds: string[];
			// Reorder state (for auto-layout)
			reorderTargetIndex: number | null;
			reorderParentId: string | null;
			reorderOriginalIndex: number | null;
			lastAppliedIndex: number | null;
			reorderGhostOffset: Point;
			reorderElementRotation: number;
			reorderElementSize: Size;
	  } & BaseInteractionState
	| {
			type: 'resizing';
			elementId: string;
			isGroup: boolean;
			handle: string;
			startSize: Size;
			startPosition: Point;
	  } & BaseInteractionState
	| {
			type: 'rotating';
			elementId: string;
			isGroup: boolean;
			startAngle: number;
			elementStartRotation: number;
			referenceCorner: Corner;
			initialOffset: number;
			// Debug visualization
			debugCenter: Point | null;
			debugCorner: Point | null;
			debugCursor: Point | null;
			debugCenterAngle: number;
			debugCornerAngle: number;
			debugCursorAngle: number;
			debugCornerBaseAngle: number;
			debugTargetRotation: number;
	  } & BaseInteractionState
	| {
			type: 'editing-radius';
			elementId: string;
			corner: Corner;
			startDistance: number;
			initialValue: number;
			cornersIndependent: boolean;
			startedIndependent: boolean;
			altKeyPressed: boolean;
			valuesWhenToggled: { nw: number; ne: number; se: number; sw: number } | null;
			frozenValues: { nw: number; ne: number; se: number; sw: number } | null;
	  } & BaseInteractionState;

// ============================================================================
// Store
// ============================================================================

const initialState: InteractionMode = {
	type: 'idle',
	hoveredElementId: null
};

export const interactionMode: Writable<InteractionMode> = writable(initialState);

// ============================================================================
// Transition Functions
// ============================================================================

export function setIdle() {
	interactionMode.set({ type: 'idle', hoveredElementId: null });
}

export function setHovering(elementId: string) {
	interactionMode.update(state => ({
		type: 'hovering',
		elementId,
		hoveredElementId: elementId
	}));
}

export function startDragging(params: {
	elementId: string;
	isGroup: boolean;
	startPosition: Point;
	reorderParentId?: string | null;
	reorderOriginalIndex?: number | null;
	reorderGhostOffset?: Point;
	reorderElementRotation?: number;
	reorderElementSize?: Size;
}) {
	interactionMode.set({
		type: 'dragging',
		elementId: params.elementId,
		isGroup: params.isGroup,
		startPosition: params.startPosition,
		startTime: Date.now(),
		hasMovedBeyondThreshold: false,
		isDuplicateDrag: false,
		hasDuplicated: false,
		originalElementIds: [],
		duplicateElementIds: [],
		reorderTargetIndex: null,
		reorderParentId: params.reorderParentId ?? null,
		reorderOriginalIndex: params.reorderOriginalIndex ?? null,
		lastAppliedIndex: null,
		reorderGhostOffset: params.reorderGhostOffset ?? { x: 0, y: 0 },
		reorderElementRotation: params.reorderElementRotation ?? 0,
		reorderElementSize: params.reorderElementSize ?? { width: 0, height: 0 },
		hoveredElementId: null
	});
}

export function updateDragging(updates: Partial<Omit<Extract<InteractionMode, { type: 'dragging' }>, 'type'>>) {
	interactionMode.update(state => {
		if (state.type !== 'dragging') return state;
		return { ...state, ...updates };
	});
}

export function startResizing(params: {
	elementId: string;
	isGroup: boolean;
	handle: string;
	startSize: Size;
	startPosition: Point;
}) {
	interactionMode.set({
		type: 'resizing',
		elementId: params.elementId,
		isGroup: params.isGroup,
		handle: params.handle,
		startSize: params.startSize,
		startPosition: params.startPosition,
		hoveredElementId: null
	});
}

export function startRotating(params: {
	elementId: string;
	isGroup: boolean;
	startAngle: number;
	elementStartRotation: number;
	referenceCorner: Corner;
	initialOffset: number;
}) {
	interactionMode.set({
		type: 'rotating',
		elementId: params.elementId,
		isGroup: params.isGroup,
		startAngle: params.startAngle,
		elementStartRotation: params.elementStartRotation,
		referenceCorner: params.referenceCorner,
		initialOffset: params.initialOffset,
		debugCenter: null,
		debugCorner: null,
		debugCursor: null,
		debugCenterAngle: 0,
		debugCornerAngle: 0,
		debugCursorAngle: 0,
		debugCornerBaseAngle: 0,
		debugTargetRotation: 0,
		hoveredElementId: null
	});
}

export function updateRotating(updates: Partial<Omit<Extract<InteractionMode, { type: 'rotating' }>, 'type'>>) {
	interactionMode.update(state => {
		if (state.type !== 'rotating') return state;
		return { ...state, ...updates };
	});
}

export function startEditingRadius(params: {
	elementId: string;
	corner: Corner;
	startDistance: number;
	initialValue: number;
	cornersIndependent: boolean;
	startedIndependent: boolean;
}) {
	interactionMode.set({
		type: 'editing-radius',
		elementId: params.elementId,
		corner: params.corner,
		startDistance: params.startDistance,
		initialValue: params.initialValue,
		cornersIndependent: params.cornersIndependent,
		startedIndependent: params.startedIndependent,
		altKeyPressed: false,
		valuesWhenToggled: null,
		frozenValues: null,
		hoveredElementId: null
	});
}

export function updateRadiusEditing(
	updates: Partial<Omit<Extract<InteractionMode, { type: 'editing-radius' }>, 'type'>>
) {
	interactionMode.update(state => {
		if (state.type !== 'editing-radius') return state;
		return { ...state, ...updates };
	});
}

export function setHoveredElement(elementId: string | null) {
	interactionMode.update(state => ({
		...state,
		hoveredElementId: elementId
	}));
}
