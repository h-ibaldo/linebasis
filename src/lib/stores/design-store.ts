/**
 * Design Store - Svelte store wrapping the event sourcing system
 *
 * This is the main API for interacting with the design system.
 * It provides a reactive Svelte store and action dispatchers.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { DesignEvent, DesignState, Element, Page, Component, AutoLayoutStyle } from '$lib/types/events';
import {
	initDB,
	appendEvent,
	getAllEvents,
	clearEvents,
	exportEvents,
	importEvents
} from './event-store';
import { reduceEvents, getInitialState } from './event-reducer';
import { currentTool } from './tool-store';
import { interactionState, startEditingText } from './interaction-store';
import { viewport, screenToCanvas } from './viewport-store';

// ============================================================================
// Store State
// ============================================================================

interface StoreState {
	designState: DesignState;
	events: DesignEvent[];
	currentEventIndex: number; // For undo/redo
	isInitialized: boolean;
	isSaving: boolean;
	lastSavedAt: number | null;
}

// Transaction batching for undo/redo
let isInTransaction = false;
let transactionEvents: DesignEvent[] = [];
let currentTransactionId: string | null = null;
const eventTransactionMap = new Map<number, string>(); // Maps event index to transaction ID

const initialStoreState: StoreState = {
	designState: getInitialState(),
	events: [],
	currentEventIndex: -1,
	isInitialized: false,
	isSaving: false,
	lastSavedAt: null
};

// ============================================================================
// Core Store
// ============================================================================

const storeState: Writable<StoreState> = writable(initialStoreState);

// Derived stores for convenience
export const designState: Readable<DesignState> = derived(
	storeState,
	($state) => $state.designState
);

export const currentPage: Readable<Page | null> = derived(designState, ($state) => {
	return $state.currentPageId ? $state.pages[$state.currentPageId] : null;
});

export const selectedElements: Readable<Element[]> = derived(designState, ($state) => {
	return $state.selectedElementIds.map((id) => $state.elements[id]).filter(Boolean);
});

export const canUndo: Readable<boolean> = derived(
	storeState,
	($state) => $state.currentEventIndex > -1
);

export const canRedo: Readable<boolean> = derived(
	storeState,
	($state) => $state.currentEventIndex < $state.events.length - 1
);

export const isInitialized: Readable<boolean> = derived(
	storeState,
	($state) => $state.isInitialized
);

export const isSaving: Readable<boolean> = derived(storeState, ($state) => $state.isSaving);

export const lastSavedAt: Readable<number | null> = derived(
	storeState,
	($state) => $state.lastSavedAt
);

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the store by loading events from IndexedDB
 */
export async function initialize(): Promise<void> {
	await initDB();
	const events = await getAllEvents();

	const designState = reduceEvents(events);

	storeState.update((state) => ({
		...state,
		events,
		designState,
		currentEventIndex: events.length - 1,
		isInitialized: true
	}));

	// Create default page if none exists
	if (Object.keys(designState.pages).length === 0) {
		const pageId = await createPage('Untitled Page', 'untitled');
		setCurrentPage(pageId);
	} else {
		// Set the first page as current if not set
		if (!designState.currentPageId) {
			const firstPageId = designState.pageOrder[0];
			if (firstPageId) {
				setCurrentPage(firstPageId);
			}
		}
	}
}

/**
 * Reset the store to initial state (clear all events)
 */
export async function reset(): Promise<void> {
	await clearEvents();

	storeState.set({
		...initialStoreState,
		isInitialized: true
	});
}

// ============================================================================
// Event Dispatching
// ============================================================================

/**
 * Start a transaction - batch multiple events into a single undo/redo step
 */
function beginTransaction(): void {
	if (isInTransaction) {
		throw new Error('Transaction already in progress');
	}
	isInTransaction = true;
	transactionEvents = [];
	currentTransactionId = uuidv4();
}

/**
 * Commit a transaction - apply all batched events as a single undo/redo step
 */
async function commitTransaction(): Promise<void> {
	if (!isInTransaction) {
		throw new Error('No transaction in progress');
	}

	if (transactionEvents.length === 0) {
		isInTransaction = false;
		currentTransactionId = null;
		return;
	}

	const state = get(storeState);

	// If we're not at the end of the event log, remove future events (they're undone)
	let newEvents = state.events;
	if (state.currentEventIndex < state.events.length - 1) {
		newEvents = state.events.slice(0, state.currentEventIndex + 1);
		// Clear transaction map for removed events
		for (let i = state.currentEventIndex + 1; i < state.events.length; i++) {
			eventTransactionMap.delete(i);
		}
	}

	const startIndex = newEvents.length;
	// Add all transaction events and track their transaction ID
	newEvents = [...newEvents, ...transactionEvents];
	for (let i = 0; i < transactionEvents.length; i++) {
		eventTransactionMap.set(startIndex + i, currentTransactionId!);
	}

	// Recompute design state
	const newDesignState = reduceEvents(newEvents);

	// Preserve selection state (selection is not part of event sourcing)
	newDesignState.selectedElementIds = state.designState.selectedElementIds;

	// Update store - increment index only once for all events
	storeState.update((s) => ({
		...s,
		events: newEvents,
		designState: newDesignState,
		currentEventIndex: newEvents.length - 1,
		isSaving: true
	}));

	// Persist all events to IndexedDB
	try {
		for (const event of transactionEvents) {
			await appendEvent(event);
		}
		storeState.update((s) => ({
			...s,
			isSaving: false,
			lastSavedAt: Date.now()
		}));
	} catch (error) {
		console.error('Failed to save transaction:', error);
		storeState.update((s) => ({
			...s,
			isSaving: false
		}));
		throw error;
	} finally {
		isInTransaction = false;
		transactionEvents = [];
		currentTransactionId = null;
	}
}

/**
 * Dispatch a new event and update the design state
 */
async function dispatch(event: DesignEvent): Promise<void> {
	// If in transaction, collect events instead of dispatching immediately
	if (isInTransaction) {
		transactionEvents.push(event);
		// Still update design state for live preview during transaction
		const state = get(storeState);
		const tempEvents = [...state.events.slice(0, state.currentEventIndex + 1), ...transactionEvents];
		const newDesignState = reduceEvents(tempEvents);
		newDesignState.selectedElementIds = state.designState.selectedElementIds;
		storeState.update((s) => ({
			...s,
			designState: newDesignState
		}));
		return;
	}

	const state = get(storeState);

	// If we're not at the end of the event log, remove future events (they're undone)
	let newEvents = state.events;
	if (state.currentEventIndex < state.events.length - 1) {
		newEvents = state.events.slice(0, state.currentEventIndex + 1);
	}

	// Add the new event
	newEvents = [...newEvents, event];

	// Recompute design state
	const newDesignState = reduceEvents(newEvents);

	// Preserve selection state (selection is not part of event sourcing)
	newDesignState.selectedElementIds = state.designState.selectedElementIds;

	// Update store
	storeState.update((s) => ({
		...s,
		events: newEvents,
		designState: newDesignState,
		currentEventIndex: newEvents.length - 1,
		isSaving: true
	}));

	// Persist to IndexedDB
	try {
		await appendEvent(event);
		storeState.update((s) => ({
			...s,
			isSaving: false,
			lastSavedAt: Date.now()
		}));
	} catch (error) {
		console.error('Failed to save event:', error);
		storeState.update((s) => ({
			...s,
			isSaving: false
		}));
		throw error;
	}
}

// ============================================================================
// Undo/Redo
// ============================================================================

/**
 * Undo the last event (or transaction)
 */
export function undo(): void {
	const state = get(storeState);

	if (state.currentEventIndex <= -1) {
		return; // Nothing to undo
	}

	// Check if current event is part of a transaction
	const currentTransactionId = eventTransactionMap.get(state.currentEventIndex);
	let newEventIndex = state.currentEventIndex - 1;

	// If it's part of a transaction, skip back to before the transaction started
	if (currentTransactionId) {
		// Find the first event in this transaction
		while (newEventIndex >= 0 && eventTransactionMap.get(newEventIndex) === currentTransactionId) {
			newEventIndex--;
		}
	}

	const eventsToApply = state.events.slice(0, newEventIndex + 1);
	const newDesignState = reduceEvents(eventsToApply);

	storeState.update((s) => ({
		...s,
		designState: newDesignState,
		currentEventIndex: newEventIndex
	}));
}

/**
 * Redo the next event (or transaction)
 */
export function redo(): void {
	const state = get(storeState);

	if (state.currentEventIndex >= state.events.length - 1) {
		return; // Nothing to redo
	}

	let newEventIndex = state.currentEventIndex + 1;

	// Check if the next event is part of a transaction
	const nextTransactionId = eventTransactionMap.get(newEventIndex);

	// If it's part of a transaction, skip forward to the end of the transaction
	if (nextTransactionId) {
		// Find the last event in this transaction
		while (newEventIndex < state.events.length - 1 &&
		       eventTransactionMap.get(newEventIndex + 1) === nextTransactionId) {
			newEventIndex++;
		}
	}

	const eventsToApply = state.events.slice(0, newEventIndex + 1);
	const newDesignState = reduceEvents(eventsToApply);

	storeState.update((s) => ({
		...s,
		designState: newDesignState,
		currentEventIndex: newEventIndex
	}));
}

// ============================================================================
// Page Actions
// ============================================================================

export async function createPage(name: string, slug?: string): Promise<string> {
	const pageId = uuidv4();

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_PAGE',
		timestamp: Date.now(),
		payload: {
			pageId,
			name,
			slug
		}
	});

	return pageId;
}

export async function updatePage(
	pageId: string,
	changes: { name?: string; slug?: string; width?: number; height?: number }
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_PAGE',
		timestamp: Date.now(),
		payload: {
			pageId,
			changes
		}
	});
}

export async function deletePage(pageId: string): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'DELETE_PAGE',
		timestamp: Date.now(),
		payload: {
			pageId
		}
	});
}

export async function reorderPages(pageIds: string[]): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'REORDER_PAGES',
		timestamp: Date.now(),
		payload: {
			pageIds
		}
	});
}

export function setCurrentPage(pageId: string): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			currentPageId: pageId
		}
	}));
}

// ============================================================================
// Element Actions
// ============================================================================

export async function createElement(data: {
	parentId: string | null;
	pageId: string;
	elementType: Element['type'];
	position: { x: number; y: number };
	size: { width: number; height: number };
	styles?: Partial<Element['styles']>;
	content?: string;
}): Promise<string> {
	const elementId = uuidv4();
	const state = get(designState);

	// Get viewId from currentViewId or default to empty string
	// (Elements belong to views (breakpoint views) in the new architecture)
	const viewId = state.currentViewId || '';

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			parentId: data.parentId,
			viewId,
			elementType: data.elementType,
			position: data.position,
			size: data.size,
			styles: data.styles,
			content: data.content
		}
	});

	return elementId;
}

export async function updateElement(
	elementId: string,
	changes: {
		content?: string;
		alt?: string;
		href?: string;
		src?: string;
	}
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			changes
		}
	});
}

export async function deleteElement(elementId: string): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'DELETE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId
		}
	});
}

export async function moveElement(
	elementId: string,
	position: { x: number; y: number },
	snapToBaseline = false
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'MOVE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			position,
			snapToBaseline
		}
	});
}

export async function resizeElement(
	elementId: string,
	size: { width: number; height: number },
	position?: { x: number; y: number }
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'RESIZE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			size,
			position
		}
	});
}

export async function rotateElement(elementId: string, rotation: number): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'ROTATE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			rotation
		}
	});
}

/**
 * Move multiple elements as a single atomic operation (for group operations)
 */
export async function moveElementsGroup(
	elements: Array<{ elementId: string; position: { x: number; y: number } }>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'GROUP_MOVE_ELEMENTS',
		timestamp: Date.now(),
		payload: {
			elements
		}
	});
}

/**
 * Resize multiple elements as a single atomic operation (for group operations)
 */
export async function resizeElementsGroup(
	elements: Array<{
		elementId: string;
		size: { width: number; height: number };
		position?: { x: number; y: number };
	}>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'GROUP_RESIZE_ELEMENTS',
		timestamp: Date.now(),
		payload: {
			elements
		}
	});
}

/**
 * Rotate multiple elements as a single atomic operation (for group operations)
 */
export async function rotateElementsGroup(
	elements: Array<{
		elementId: string;
		rotation: number;
		position: { x: number; y: number };
	}>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'GROUP_ROTATE_ELEMENTS',
		timestamp: Date.now(),
		payload: {
			elements
		}
	});
}

export async function reorderElement(
	elementId: string,
	newParentId: string | null,
	newIndex: number
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'REORDER_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			newParentId,
			newIndex
		}
	});
}

export async function updateElementStyles(
	elementId: string,
	styles: Partial<Element['styles']>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_STYLES',
		timestamp: Date.now(),
		payload: {
			elementId,
			styles
		}
	});
}

/**
 * Update styles for multiple elements as a single atomic operation (for multi-selection)
 */
export async function updateElementsStylesGroup(
	elements: Array<{
		elementId: string;
		styles: Partial<Element['styles']>;
	}>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'GROUP_UPDATE_STYLES',
		timestamp: Date.now(),
		payload: {
			elements
		}
	});
}

export async function updateElementTypography(
	elementId: string,
	typography: Partial<Element['typography']>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_TYPOGRAPHY',
		timestamp: Date.now(),
		payload: {
			elementId,
			typography
		}
	});
}

export async function updateElementSpacing(
	elementId: string,
	spacing: Partial<Element['spacing']>
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_SPACING',
		timestamp: Date.now(),
		payload: {
			elementId,
			spacing
		}
	});
}

export async function updateElementAutoLayout(
	elementId: string,
	autoLayout: Partial<AutoLayoutStyle>
): Promise<void> {
	const state = get(designState);
	const element = state.elements[elementId];

	// If we're disabling auto-layout, preserve children's visual positions
	if (element && autoLayout.enabled === false && element.autoLayout?.enabled === true) {
		// STEP 1: Read current visual positions from DOM while auto-layout is still active
		const children = element.children || [];
		const childPositions = new Map<string, { x: number; y: number }>();

		// Get viewport for coordinate conversion
		const currentViewport = get(viewport);

		for (const childId of children) {
			const child = state.elements[childId];
			if (!child) continue;

			// Skip children that already ignore auto-layout (they already have absolute positions)
			if (child.autoLayout?.ignoreAutoLayout) continue;

			// Get the child's DOM element to find its actual rendered position
			const domElement = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
			if (!domElement) {
				console.warn(`Could not find DOM element for child ${childId}, using stored position`);
				// Fallback to stored position if DOM element not found
				childPositions.set(childId, { x: child.position.x, y: child.position.y });
				continue;
			}

			// Get the bounding rect of the child and parent
			const childRect = domElement.getBoundingClientRect();
			const parentElement = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement;
			if (!parentElement) {
				console.warn(`Could not find parent DOM element ${elementId}, using stored position`);
				childPositions.set(childId, { x: child.position.x, y: child.position.y });
				continue;
			}

			const parentRect = parentElement.getBoundingClientRect();

			// Calculate child's position relative to parent's top-left corner in screen pixels
			const screenRelativeX = childRect.left - parentRect.left;
			const screenRelativeY = childRect.top - parentRect.top;

			// Convert from screen pixels to canvas units (account for viewport scale)
			const canvasRelativeX = screenRelativeX / currentViewport.scale;
			const canvasRelativeY = screenRelativeY / currentViewport.scale;

			console.log(`Child ${childId}: screen (${screenRelativeX.toFixed(1)}, ${screenRelativeY.toFixed(1)}) -> canvas (${canvasRelativeX.toFixed(1)}, ${canvasRelativeY.toFixed(1)})`);

			// Store the position for this child
			childPositions.set(childId, { x: canvasRelativeX, y: canvasRelativeY });
		}

		// STEP 2: Begin transaction to batch all changes
		beginTransaction();

		try {
			// First, update all children positions while auto-layout is still enabled
			// This ensures positions are set before the layout mode changes
			for (const [childId, position] of childPositions) {
				await moveElement(childId, position);
			}

			// STEP 3: Now disable auto-layout
			// Children now have their positions set, so they'll stay in place
			await dispatch({
				id: uuidv4(),
				type: 'UPDATE_AUTO_LAYOUT',
				timestamp: Date.now(),
				payload: {
					elementId,
					autoLayout
				}
			});

			await commitTransaction();
		} catch (error) {
			// Clean up transaction state on error
			if (isInTransaction) {
				isInTransaction = false;
				transactionEvents = [];
				currentTransactionId = null;
			}
			throw error;
		}
	} else {
		// For other auto-layout updates (enabling, changing direction, etc.), just dispatch normally
		await dispatch({
			id: uuidv4(),
			type: 'UPDATE_AUTO_LAYOUT',
			timestamp: Date.now(),
			payload: {
				elementId,
				autoLayout
			}
		});
	}
}

export async function toggleView(
	elementId: string,
	isView: boolean,
	viewName?: string,
	breakpointWidth?: number
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'TOGGLE_VIEW',
		timestamp: Date.now(),
		payload: {
			elementId,
			isView,
			viewName,
			breakpointWidth
		}
	});
}

// ============================================================================
// Selection
// ============================================================================

function expandSelectionWithGroups(elementIds: string[], state: DesignState): string[] {
	const seen = new Set<string>();
	const expanded: string[] = [];

	for (const id of elementIds) {
		const element = state.elements[id];

		if (element?.groupId) {
			const group = state.groups[element.groupId];
			if (group) {
				for (const memberId of group.elementIds) {
					if (!seen.has(memberId) && state.elements[memberId]) {
						seen.add(memberId);
						expanded.push(memberId);
					}
				}
				continue;
			}
		}

		if (!seen.has(id) && state.elements[id]) {
			seen.add(id);
			expanded.push(id);
		}
	}

	return expanded;
}

export function selectElement(elementId: string): void {
	storeState.update((state) => {
		const expanded = expandSelectionWithGroups([elementId], state.designState);
		return {
			...state,
			designState: {
				...state.designState,
				selectedElementIds: expanded
			}
		};
	});
}

export function selectElements(elementIds: string[]): void {
	storeState.update((state) => {
		const expanded = expandSelectionWithGroups(elementIds, state.designState);
		return {
			...state,
			designState: {
				...state.designState,
				selectedElementIds: expanded
			}
		};
	});
}

export function addToSelection(elementId: string): void {
	storeState.update((state) => {
		const expanded = expandSelectionWithGroups(
			[...state.designState.selectedElementIds, elementId],
			state.designState
		);
		return {
			...state,
			designState: {
				...state.designState,
				selectedElementIds: expanded
			}
		};
	});
}

export function removeFromSelection(elementId: string): void {
	storeState.update((state) => {
		const element = state.designState.elements[elementId];
		const groupMemberIds =
			element?.groupId && state.designState.groups[element.groupId]
				? new Set(state.designState.groups[element.groupId].elementIds)
				: new Set([elementId]);

		return {
			...state,
			designState: {
				...state.designState,
				selectedElementIds: state.designState.selectedElementIds.filter(
					(id) => !groupMemberIds.has(id)
				)
			}
		};
	});
}

export function clearSelection(): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			selectedElementIds: []
		}
	}));
}

// ============================================================================
// Component Actions
// ============================================================================

export async function createComponent(name: string, elementIds: string[]): Promise<string> {
	const componentId = uuidv4();

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_COMPONENT',
		timestamp: Date.now(),
		payload: {
			componentId,
			name,
			elementIds
		}
	});

	return componentId;
}

export async function updateComponent(
	componentId: string,
	changes: { name?: string }
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'UPDATE_COMPONENT',
		timestamp: Date.now(),
		payload: {
			componentId,
			changes
		}
	});
}

export async function deleteComponent(componentId: string): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'DELETE_COMPONENT',
		timestamp: Date.now(),
		payload: {
			componentId
		}
	});
}

export async function instanceComponent(
	componentId: string,
	pageId: string,
	position: { x: number; y: number }
): Promise<string> {
	const instanceId = uuidv4();

	await dispatch({
		id: uuidv4(),
		type: 'INSTANCE_COMPONENT',
		timestamp: Date.now(),
		payload: {
			componentId,
			instanceId,
			pageId,
			position
		}
	});

	return instanceId;
}

// ============================================================================
// Import/Export
// ============================================================================

export async function exportDesign(): Promise<string> {
	return await exportEvents();
}

export async function importDesign(json: string): Promise<void> {
	await importEvents(json);
	await initialize();
}

// ============================================================================
// Manual Save
// ============================================================================

/**
 * Trigger manual save (updates lastSavedAt for visual feedback)
 * Note: Events are auto-saved to IndexedDB on dispatch, so this just updates the timestamp
 */
export function manualSave(): void {
	storeState.update((s) => ({
		...s,
		lastSavedAt: Date.now()
	}));
}

// ============================================================================
// Copy/Paste/Duplicate
// ============================================================================

// Clipboard for storing copied elements (in-memory, not system clipboard)
let clipboard: Element[] = [];
// Track if clipboard contains cut elements (vs copied elements)
let isClipboardFromCut = false;

/**
 * Helper: Get the four corners of a rotated rectangle in world space
 * Returns [topLeft, topRight, bottomRight, bottomLeft]
 */
function getRotatedCorners(rect: {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}): Array<{ x: number; y: number }> {
	const { x, y, width, height, rotation } = rect;
	const angleRad = rotation * (Math.PI / 180);
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);

	// Center of the rectangle
	const centerX = x + width / 2;
	const centerY = y + height / 2;

	// Local corners (relative to center)
	const halfW = width / 2;
	const halfH = height / 2;
	const localCorners = [
		{ x: -halfW, y: -halfH }, // Top-left
		{ x: halfW, y: -halfH },  // Top-right
		{ x: halfW, y: halfH },   // Bottom-right
		{ x: -halfW, y: halfH }   // Bottom-left
	];

	// Rotate each corner around center and convert to world space
	return localCorners.map(corner => ({
		x: centerX + corner.x * cos - corner.y * sin,
		y: centerY + corner.x * sin + corner.y * cos
	}));
}

/**
 * Wrap selected elements in a new div container
 */
export async function wrapSelectedElementsInDiv(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	const state = get(designState);
	const pageId = state.currentPageId;
	if (!pageId) return;

	// Find the common parent of all selected elements
	// If all elements share the same parent, use that parent
	// Otherwise, use null (root level)
	const firstParentId = selected[0].parentId;
	const commonParent = selected.every(el => el.parentId === firstParentId)
		? firstParentId
		: null;

	// Calculate bounding box of all selected elements (accounting for rotation)
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const el of selected) {
		const rotation = el.rotation || 0;

		if (rotation !== 0) {
			// For rotated elements, get all four corners and find their bounds
			const corners = getRotatedCorners({
				x: el.position.x,
				y: el.position.y,
				width: el.size.width || 0,
				height: el.size.height || 0,
				rotation
			});

			// Find min/max across all corners
			for (const corner of corners) {
				minX = Math.min(minX, corner.x);
				minY = Math.min(minY, corner.y);
				maxX = Math.max(maxX, corner.x);
				maxY = Math.max(maxY, corner.y);
			}
		} else {
			// For non-rotated elements, use simple bounds
			minX = Math.min(minX, el.position.x);
			minY = Math.min(minY, el.position.y);
			maxX = Math.max(maxX, el.position.x + (el.size.width || 0));
			maxY = Math.max(maxY, el.position.y + (el.size.height || 0));
		}
	}

	const wrapperWidth = maxX - minX;
	const wrapperHeight = maxY - minY;

	// Create the wrapper div with the common parent
	const wrapperId = await createElement({
		parentId: commonParent,
		pageId,
		elementType: 'div',
		position: { x: minX, y: minY },
		size: { width: wrapperWidth, height: wrapperHeight },
		styles: {
			display: 'block'
		}
	});

	// Reparent each selected element to the wrapper and adjust its position
	for (let i = 0; i < selected.length; i++) {
		const el = selected[i];

		// Move element to be a child of the wrapper at index i
		await reorderElement(el.id, wrapperId, i);

		// Update position to be relative to wrapper
		const relativeX = el.position.x - minX;
		const relativeY = el.position.y - minY;
		await moveElement(el.id, { x: relativeX, y: relativeY });
	}

	// Select the new wrapper div
	selectElement(wrapperId);
}

/**
 * Unwrap selected div - move its children out and delete the wrapper
 * Preserves visual position and rotation of children
 */
export async function unwrapSelectedDiv(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length !== 1) return;

	const wrapper = selected[0];
	if (wrapper.type !== 'div' || wrapper.children.length === 0) return;

	const state = get(designState);
	const childrenToSelect: string[] = [];
	const parentId = wrapper.parentId;

	// Check if wrapper has auto-layout enabled
	const wrapperHasAutoLayout = wrapper.autoLayout?.enabled || false;

	// Wrap entire operation in transaction for instant batched update
	beginTransaction();

	try {
		// Prepare all operations upfront
		const operations: Array<() => Promise<void>> = [];

		// If wrapper has auto-layout, read positions from DOM (like we do when disabling auto-layout)
		if (wrapperHasAutoLayout) {
			// Get viewport for coordinate conversion
			const currentViewport = get(viewport);

			// First, collect all child positions BEFORE making any changes
			const childPositions = new Map<string, { x: number; y: number }>();

			// Get wrapper's parent element (if it exists)
			const wrapperParent = parentId ? state.elements[parentId] : null;
			const wrapperParentElement = wrapperParent
				? document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement
				: null;

			for (const childId of wrapper.children) {
				const child = state.elements[childId];
				if (!child) continue;

				childrenToSelect.push(childId);

				// Get the child's DOM element
				const childElement = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
				if (!childElement) {
					console.warn(`Could not find DOM element for child ${childId}`);
					continue;
				}

				// Get the wrapper's DOM element
				const wrapperElement = document.querySelector(`[data-element-id="${wrapper.id}"]`) as HTMLElement;
				if (!wrapperElement) {
					console.warn(`Could not find wrapper DOM element ${wrapper.id}`);
					continue;
				}

				// Get bounding rectangles
				const childRect = childElement.getBoundingClientRect();
				const wrapperRect = wrapperElement.getBoundingClientRect();

				// For rotated elements, getBoundingClientRect gives us the bounding box
				// We need to find the element's actual top-left corner (before rotation)
				const childRotation = child.rotation || 0;
				const isRotated = childRotation !== 0;

				let childTopLeftX: number;
				let childTopLeftY: number;

				if (isRotated) {
					// For rotated elements, the center is what we want to preserve
					// getBoundingClientRect gives us the bounding box, so we calculate the center
					const childCenterScreenX = childRect.left + childRect.width / 2;
					const childCenterScreenY = childRect.top + childRect.height / 2;

					// Convert element's actual size (not bounding box) to screen pixels
					const childWidthScreen = child.size.width * currentViewport.scale;
					const childHeightScreen = child.size.height * currentViewport.scale;

					// Calculate top-left from center (this is the logical position, not visual bounding box)
					childTopLeftX = childCenterScreenX - childWidthScreen / 2;
					childTopLeftY = childCenterScreenY - childHeightScreen / 2;
				} else {
					// Non-rotated element - use getBoundingClientRect directly
					childTopLeftX = childRect.left;
					childTopLeftY = childRect.top;
				}

				// Calculate target position based on whether wrapper has a parent
				let targetX: number;
				let targetY: number;

				if (wrapperParent && wrapperParentElement) {
					// Wrapper has a parent - calculate position relative to parent
					const parentRect = wrapperParentElement.getBoundingClientRect();

					// Child's position relative to parent in screen pixels
					const screenRelativeToParent = {
						x: childTopLeftX - parentRect.left,
						y: childTopLeftY - parentRect.top
					};

					// Convert to canvas units - this is the position relative to parent
					targetX = screenRelativeToParent.x / currentViewport.scale;
					targetY = screenRelativeToParent.y / currentViewport.scale;
				} else {
					// No parent - calculate absolute canvas position
					const wrapperTopLeft = {
						x: wrapperRect.left,
						y: wrapperRect.top
					};

					const screenRelativeToWrapper = {
						x: childTopLeftX - wrapperTopLeft.x,
						y: childTopLeftY - wrapperTopLeft.y
					};

					const canvasRelativeToWrapper = {
						x: screenRelativeToWrapper.x / currentViewport.scale,
						y: screenRelativeToWrapper.y / currentViewport.scale
					};

					// Add wrapper's position to get absolute canvas position
					targetX = wrapper.position.x + canvasRelativeToWrapper.x;
					targetY = wrapper.position.y + canvasRelativeToWrapper.y;
				}

				childPositions.set(childId, { x: targetX, y: targetY });
			}

			// Queue all operations (will be batched in transaction)
			for (const childId of wrapper.children) {
				const position = childPositions.get(childId);
				if (!position) continue;

				// Queue reorder operation
				operations.push(() => reorderElement(childId, parentId, 0));
				
				// Queue move operation
				operations.push(() => moveElement(childId, position));

				// Children in auto-layout don't inherit rotation from wrapper, so keep their own rotation
				// (No need to add wrapper rotation)
			}
		} else {
			// Original logic for non-auto-layout wrappers (freeform positioning)
			// Get wrapper's absolute top-left position (traverse parent chain)
			let wrapperAbsX = wrapper.position.x;
			let wrapperAbsY = wrapper.position.y;
			let currentParent = wrapper.parentId ? state.elements[wrapper.parentId] : null;
			while (currentParent) {
				wrapperAbsX += currentParent.position.x;
				wrapperAbsY += currentParent.position.y;
				currentParent = currentParent.parentId ? state.elements[currentParent.parentId] : null;
			}

			const wrapperRotation = wrapper.rotation || 0;
			const wrapperRotationRad = wrapperRotation * (Math.PI / 180);

			// Calculate wrapper's center in canvas space (for rotating child positions)
			const wrapperCenterAbsX = wrapperAbsX + wrapper.size.width / 2;
			const wrapperCenterAbsY = wrapperAbsY + wrapper.size.height / 2;

			// Calculate all child positions and queue operations
			for (const childId of wrapper.children) {
				const child = state.elements[childId];
				if (!child) continue;

				childrenToSelect.push(childId);

				// Calculate visual position accounting for wrapper rotation
				// Child's center relative to wrapper's center (in wrapper's local space)
				const childCenterLocalX = child.position.x + child.size.width / 2 - wrapper.size.width / 2;
				const childCenterLocalY = child.position.y + child.size.height / 2 - wrapper.size.height / 2;

				// Rotate child center by wrapper rotation to get visual center relative to wrapper's center
				let childCenterVisualX: number, childCenterVisualY: number;
				if (wrapperRotation !== 0) {
					childCenterVisualX = childCenterLocalX * Math.cos(wrapperRotationRad) - childCenterLocalY * Math.sin(wrapperRotationRad);
					childCenterVisualY = childCenterLocalX * Math.sin(wrapperRotationRad) + childCenterLocalY * Math.cos(wrapperRotationRad);
				} else {
					childCenterVisualX = childCenterLocalX;
					childCenterVisualY = childCenterLocalY;
				}

				// Add wrapper's center absolute position to get child's visual center in canvas space
				const childCenterAbsX = wrapperCenterAbsX + childCenterVisualX;
				const childCenterAbsY = wrapperCenterAbsY + childCenterVisualY;

				// Calculate visual top-left position
				const absoluteX = childCenterAbsX - child.size.width / 2;
				const absoluteY = childCenterAbsY - child.size.height / 2;

				// Calculate visual rotation (child rotation + wrapper rotation)
				// This preserves the visual rotation the child displayed while inside the rotated wrapper
				const childRotation = child.rotation ?? 0;
				const visualRotation = childRotation + wrapperRotation;

				// Queue all operations (will be batched in transaction)
				operations.push(() => reorderElement(childId, parentId, 0));
				operations.push(() => moveElement(childId, { x: absoluteX, y: absoluteY }));
				operations.push(() => rotateElement(childId, visualRotation));
			}
		}

		// Queue wrapper deletion (must be in transaction)
		operations.push(() => deleteElement(wrapper.id));

		// Execute all operations in parallel (they'll be batched in the transaction)
		await Promise.all(operations.map(op => op()));

		// Commit transaction - all changes applied at once for instant update
		await commitTransaction();

		// Select the children that were moved out
		if (childrenToSelect.length > 0) {
			selectElements(childrenToSelect);
		}
	} catch (error) {
		// Clean up transaction on error
		if (isInTransaction) {
			isInTransaction = false;
			transactionEvents = [];
			currentTransactionId = null;
		}
		throw error;
	}
}

/**
 * Group selected elements
 * Grouped elements behave as if they are selected together - property changes affect all group members
 */
export async function groupElements(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length < 2) return; // Need at least 2 elements to group

	const groupId = uuidv4();
	const elementIds = selected.map(el => el.id);

	await dispatch({
		id: uuidv4(),
		type: 'GROUP_ELEMENTS',
		timestamp: Date.now(),
		payload: {
			groupId,
			elementIds
		}
	});
}

/**
 * Ungroup selected elements
 * Removes grouping from all selected elements that are in a group
 */
export async function ungroupElements(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	// Find all unique groups from selected elements
	const groupIds = new Set<string>();
	for (const element of selected) {
		if (element.groupId) {
			groupIds.add(element.groupId);
		}
	}

	// Dispatch ungroup event for each group
	for (const groupId of groupIds) {
		await dispatch({
			id: uuidv4(),
			type: 'UNGROUP_ELEMENTS',
			timestamp: Date.now(),
			payload: {
				groupId
			}
		});
	}
}

/**
 * Toggle auto-layout on selected elements
 * - If one div is selected: toggle its auto-layout property
 * - If multiple elements are selected: wrap them in a div with auto-layout enabled
 */
export async function toggleAutoLayout(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	// Single element selected: toggle auto-layout
	if (selected.length === 1) {
		const element = selected[0];
		if (element.type === 'div') {
			const currentAutoLayout = element.autoLayout?.enabled || false;
			await updateElementAutoLayout(element.id, {
				enabled: !currentAutoLayout,
				direction: 'row',
				justifyContent: 'flex-start',
				alignItems: 'flex-start',
				gap: '0px'
			});
		}
		return;
	}

	// Multiple elements selected: wrap in div with auto-layout enabled
	// Use transaction to batch all events into a single undo/redo step
	beginTransaction();

	try {
		const state = get(designState);
		const pageId = state.currentPageId;
		if (!pageId) {
			await commitTransaction();
			return;
		}

		const initialGroupId = selected[0].groupId;
		const isSingleGroupSelection =
			Boolean(initialGroupId) &&
			selected.every((el) => el.groupId === initialGroupId) &&
			Boolean(initialGroupId && state.groups[initialGroupId]);

		// Find the common parent
		const firstParentId = selected[0].parentId;
		const commonParent = selected.every(el => el.parentId === firstParentId)
			? firstParentId
			: null;

		// Calculate bounding box
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const el of selected) {
			minX = Math.min(minX, el.position.x);
			minY = Math.min(minY, el.position.y);
			maxX = Math.max(maxX, el.position.x + (el.size.width || 0));
			maxY = Math.max(maxY, el.position.y + (el.size.height || 0));
		}

		const boundingWidth = maxX - minX;
		const boundingHeight = maxY - minY;

		// Determine direction based on aspect ratio
		// If more horizontal (wider than tall) or square, use row; if more vertical, use column
		const direction = boundingWidth >= boundingHeight ? 'row' : 'column';

		// Helper: Calculate bounding box size for an element (accounting for rotation)
		const getElementLayoutSize = (el: Element): { width: number; height: number } => {
			const rotation = el.rotation || 0;
			if (rotation === 0) {
				return el.size;
			}
			// For rotated elements, calculate bounding box size
			const angleRad = rotation * (Math.PI / 180);
			const cos = Math.abs(Math.cos(angleRad));
			const sin = Math.abs(Math.sin(angleRad));
			return {
				width: el.size.width * cos + el.size.height * sin,
				height: el.size.width * sin + el.size.height * cos
			};
		};

		// Calculate wrapper size based on direction and elements aligned with gap=0
		let wrapperWidth: number;
		let wrapperHeight: number;

		if (direction === 'row') {
			// Row: width = sum of element layout widths, height = max element layout height
			wrapperWidth = selected.reduce((sum, el) => {
				const layoutSize = getElementLayoutSize(el);
				return sum + layoutSize.width;
			}, 0);
			wrapperHeight = Math.max(...selected.map(el => getElementLayoutSize(el).height));
		} else {
			// Column: width = max element layout width, height = sum of element layout heights
			wrapperWidth = Math.max(...selected.map(el => getElementLayoutSize(el).width));
			wrapperHeight = selected.reduce((sum, el) => {
				const layoutSize = getElementLayoutSize(el);
				return sum + layoutSize.height;
			}, 0);
		}

		// Create wrapper div with auto-layout enabled
		const wrapperId = await createElement({
			parentId: commonParent,
			pageId,
			elementType: 'div',
			position: { x: minX, y: minY },
			size: { width: wrapperWidth, height: wrapperHeight },
			styles: {
				display: 'flex'
			}
		});

		// Enable auto-layout on the wrapper
		await updateElementAutoLayout(wrapperId, {
			enabled: true,
			direction,
			justifyContent: 'flex-start',
			alignItems: 'flex-start',
			gap: '0px'
		});

		// Reparent each selected element to the wrapper
		// In auto layout, flexbox handles positioning, so set element positions to (0, 0)
		for (let i = 0; i < selected.length; i++) {
			const el = selected[i];
			await reorderElement(el.id, wrapperId, i);

			// Set position to (0, 0) - flexbox will handle layout
			await moveElement(el.id, { x: 0, y: 0 });
		}

		// Select the new wrapper div
		if (isSingleGroupSelection && initialGroupId) {
			await dispatch({
				id: uuidv4(),
				type: 'UNGROUP_ELEMENTS',
				timestamp: Date.now(),
				payload: {
					groupId: initialGroupId
				}
			});
		}

		await commitTransaction();
		selectElement(wrapperId);
	} catch (error) {
		isInTransaction = false;
		transactionEvents = [];
		throw error;
	}
}

/**
 * Helper: Get all descendant elements of a given element
 */
function getAllDescendants(elementId: string, state: DesignState): Element[] {
	const element = state.elements[elementId];
	if (!element) return [];

	const descendants: Element[] = [];

	// Add direct children
	for (const childId of element.children) {
		const child = state.elements[childId];
		if (child) {
			descendants.push(child);
			// Recursively add grandchildren
			descendants.push(...getAllDescendants(childId, state));
		}
	}

	return descendants;
}

/**
 * Copy selected elements to clipboard (including their children)
 */
export function copyElements(): void {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	const state = get(designState);
	const elementsToCopy = new Set<Element>();

	// Add selected elements and all their descendants
	for (const el of selected) {
		elementsToCopy.add(el);
		const descendants = getAllDescendants(el.id, state);
		descendants.forEach(desc => elementsToCopy.add(desc));
	}

	// Clone elements (deep copy)
	clipboard = Array.from(elementsToCopy).map((el) => ({ ...el }));
	isClipboardFromCut = false;
}

/**
 * Cut selected elements (copy to clipboard and delete)
 */
export async function cutElements(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	const state = get(designState);
	const elementsToCopy = new Set<Element>();

	// Add selected elements and all their descendants
	for (const el of selected) {
		elementsToCopy.add(el);
		const descendants = getAllDescendants(el.id, state);
		descendants.forEach(desc => elementsToCopy.add(desc));
	}

	// Clone elements (deep copy)
	clipboard = Array.from(elementsToCopy).map((el) => ({ ...el }));
	isClipboardFromCut = true;

	// Wrap deletion in a transaction for single undo/redo
	beginTransaction();

	try {
		// Delete only the selected elements (children will be deleted automatically)
		for (const element of selected) {
			await deleteElement(element.id);
		}

		await commitTransaction();
	} catch (error) {
		// If cut fails, still commit transaction to clean up state
		if (isInTransaction) {
			isInTransaction = false;
			transactionEvents = [];
			currentTransactionId = null;
		}
		throw error;
	}
}

/**
 * Paste elements from clipboard
 */
export async function pasteElements(): Promise<void> {
	if (clipboard.length === 0) return;

	const state = get(designState);
	const currentPageId = state.currentPageId;
	if (!currentPageId) return;

	// Narrow type for use in nested function
	const pageId: string = currentPageId;

	// Determine target parent based on selected element and clipboard
	const selected = get(selectedElements);
	let targetParentId: string | null = null;

	if (selected.length === 1) {
		const selectedElement = selected[0];
		const clipboardIds = new Set(clipboard.map(el => el.id));

		// Check if selected element is one of the copied elements
		if (clipboardIds.has(selectedElement.id)) {
			// Paste as sibling of selected element
			targetParentId = selectedElement.parentId;
		} else {
			// Selected element is NOT in clipboard
			if (selectedElement.children && selectedElement.children.length > 0) {
				// Selected element has children -> paste as child
				targetParentId = selectedElement.id;
			} else {
				// Selected element has no children -> paste as sibling
				targetParentId = selectedElement.parentId;
			}
		}
	}

	// Clear selection
	clearSelection();

	// Wrap entire paste operation in a transaction for single undo/redo
	beginTransaction();

	try {
		// Create a map from old IDs to new IDs
		const oldToNewIdMap = new Map<string, string>();

		// Identify root elements (elements whose parent is not in clipboard or is null)
		const clipboardIds = new Set(clipboard.map(el => el.id));
		const rootElements = clipboard.filter(el => !el.parentId || !clipboardIds.has(el.parentId));

	// Calculate position offset based on whether this is a cut or copy operation
	let offsetX = 0;
	let offsetY = 0;

	if (isClipboardFromCut) {
		// For cut elements, paste at the center of the visible screen
		// Get current viewport state
		const currentViewport = get(viewport);

		// Get screen dimensions (use window.innerWidth/Height as canvas fills the screen)
		const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
		const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

		// Calculate the center of the screen in canvas coordinates
		const centerCanvas = screenToCanvas(
			screenWidth / 2,
			screenHeight / 2,
			currentViewport
		);

		// Calculate the bounding box of ROOT clipboard elements only
		const minX = Math.min(...rootElements.map(el => el.position.x));
		const minY = Math.min(...rootElements.map(el => el.position.y));
		const maxX = Math.max(...rootElements.map(el => el.position.x + (el.size.width || 0)));
		const maxY = Math.max(...rootElements.map(el => el.position.y + (el.size.height || 0)));

		// Calculate the center of the clipboard group
		const groupCenterX = (minX + maxX) / 2;
		const groupCenterY = (minY + maxY) / 2;

		// Offset to place group center at screen center
		offsetX = centerCanvas.x - groupCenterX;
		offsetY = centerCanvas.y - groupCenterY;
	} else {
		// For copied elements, paste with small offset from original
		offsetX = 20;
		offsetY = 20;
	}

	// Recursive function to paste an element and its descendants
	async function pasteElementTree(element: Element, isRoot: boolean): Promise<string> {
		// Determine new parent ID
		let newParentId: string | null;
		if (element.parentId && oldToNewIdMap.has(element.parentId)) {
			// Parent is in clipboard, use its new ID
			newParentId = oldToNewIdMap.get(element.parentId)!;
		} else if (isRoot) {
			// For root elements, use the determined target parent
			// (based on whether selected element is in clipboard and has children)
			newParentId = targetParentId;
		} else {
			// Non-root elements without parent in clipboard -> paste as root
			newParentId = null;
		}

		// Calculate position based on paste context
		let position: { x: number; y: number };

		if (isRoot && newParentId === null) {
			// Pasting at root level with no parent -> apply offset
			position = {
				x: element.position.x + offsetX,
				y: element.position.y + offsetY
			};
		} else if (isRoot && newParentId !== null) {
			// Pasting as child of a parent element
			const currentState = get(designState);
			const parentElement = currentState.elements[newParentId];

			if (parentElement?.autoLayout?.enabled) {
				// Parent has auto layout -> paste as last child in queue
				// Position doesn't matter, auto layout will handle it
				position = { x: 0, y: 0 };
			} else if (parentElement) {
				// Parent doesn't have auto layout -> paste at center of parent
				const centerX = parentElement.size.width / 2 - element.size.width / 2;
				const centerY = parentElement.size.height / 2 - element.size.height / 2;
				position = { x: centerX, y: centerY };
			} else {
				// Fallback if parent not found
				position = { x: element.position.x, y: element.position.y };
			}
		} else {
			// Non-root elements -> maintain their relative position
			position = { x: element.position.x, y: element.position.y };
		}

		// Create the new element
		const createData: Parameters<typeof createElement>[0] = {
			parentId: newParentId,
			pageId,
			elementType: element.type,
			position,
			size: element.size,
			styles: element.styles,
			content: element.content
		};
		const newElementId = await createElement(createData);

		// Map old ID to new ID
		oldToNewIdMap.set(element.id, newElementId);

		// Copy additional properties
		if (Object.keys(element.typography || {}).length > 0) {
			await updateElementTypography(newElementId, element.typography);
		}
		if (Object.keys(element.spacing || {}).length > 0) {
			await updateElementSpacing(newElementId, element.spacing);
		}
		if (element.autoLayout && Object.keys(element.autoLayout).length > 0) {
			await updateElementAutoLayout(newElementId, element.autoLayout);
		}
		if (element.rotation && element.rotation !== 0) {
			await rotateElement(newElementId, element.rotation);
		}
		if (element.alt || element.href || element.src) {
			await updateElement(newElementId, {
				alt: element.alt,
				href: element.href,
				src: element.src
			});
		}

		// Recursively paste children
		const children = clipboard.filter(el => el.parentId === element.id);
		for (const child of children) {
			await pasteElementTree(child, false);
		}

		return newElementId;
	}

		// Paste all root elements (and their descendants recursively)
		const newRootElementIds: string[] = [];
		for (const rootElement of rootElements) {
			const newId = await pasteElementTree(rootElement, true);
			newRootElementIds.push(newId);
		}

		// Commit the transaction (batches all events into single undo/redo step)
		await commitTransaction();

		// Select the newly pasted root elements
		selectElements(newRootElementIds);

		// Note: We don't reset isClipboardFromCut here
		// This allows multiple pastes from a cut operation to all paste at screen center
		// The flag will only be reset when the user does a new copy (Cmd+C)
	} catch (error) {
		// If paste fails, still commit transaction to clean up state
		if (isInTransaction) {
			isInTransaction = false;
			transactionEvents = [];
			currentTransactionId = null;
		}
		throw error;
	}
}

/**
 * Paste elements from clipboard INSIDE the selected container
 * This bypasses the normal drop restrictions and allows pasting into ANY div
 * Triggered by Cmd/Ctrl+Shift+V
 */
export async function pasteElementsInside(): Promise<void> {
	if (clipboard.length === 0) return;

	const state = get(designState);
	const currentPageId = state.currentPageId;
	if (!currentPageId) return;

	const pageId: string = currentPageId;

	// Check if a single element is selected to paste inside
	const selected = get(selectedElements);
	if (selected.length !== 1) {
		console.warn('Paste inside requires exactly one container element to be selected');
		return;
	}

	const selectedElement = selected[0];

	// Check if selected element can be a container
	const containerTypes = ['div', 'section', 'header', 'footer', 'article', 'aside', 'nav', 'main'];
	if (!containerTypes.includes(selectedElement.type)) {
		console.warn('Selected element cannot contain children. Select a container element (div, section, etc.)');
		return;
	}

	// Force paste inside the selected element (bypassing drop restrictions)
	const targetParentId = selectedElement.id;

	// Clear selection
	clearSelection();

	// Wrap entire paste operation in a transaction
	beginTransaction();

	try {
		const oldToNewIdMap = new Map<string, string>();
		const clipboardIds = new Set(clipboard.map(el => el.id));
		const rootElements = clipboard.filter(el => !el.parentId || !clipboardIds.has(el.parentId));

		// Recursive function to paste an element and its descendants
		async function pasteElementTree(element: Element, isRoot: boolean): Promise<string> {
			// Determine new parent ID
			let newParentId: string | null;
			if (element.parentId && oldToNewIdMap.has(element.parentId)) {
				newParentId = oldToNewIdMap.get(element.parentId)!;
			} else if (isRoot) {
				// Force paste inside the selected container
				newParentId = targetParentId;
			} else {
				newParentId = null;
			}

			// Calculate position based on paste context
			let position: { x: number; y: number };

			if (isRoot && newParentId !== null) {
				// Pasting as child of the selected container
				const currentState = get(designState);
				const parentElement = currentState.elements[newParentId];

				if (parentElement?.autoLayout?.enabled) {
					// Parent has auto layout -> paste as last child
					position = { x: 0, y: 0 };
				} else if (parentElement) {
					// Parent doesn't have auto layout -> paste at center of parent
					const centerX = parentElement.size.width / 2 - element.size.width / 2;
					const centerY = parentElement.size.height / 2 - element.size.height / 2;
					position = { x: centerX, y: centerY };
				} else {
					position = { x: element.position.x, y: element.position.y };
				}
			} else {
				// Non-root elements -> maintain their relative position
				position = { x: element.position.x, y: element.position.y };
			}

			// Create the new element
			const createData: Parameters<typeof createElement>[0] = {
				parentId: newParentId,
				pageId,
				elementType: element.type,
				position,
				size: element.size,
				styles: element.styles,
				content: element.content
			};
			const newElementId = await createElement(createData);

			// Map old ID to new ID
			oldToNewIdMap.set(element.id, newElementId);

			// Copy additional properties
			if (Object.keys(element.typography || {}).length > 0) {
				await updateElementTypography(newElementId, element.typography);
			}
			if (Object.keys(element.spacing || {}).length > 0) {
				await updateElementSpacing(newElementId, element.spacing);
			}
			if (element.autoLayout && Object.keys(element.autoLayout).length > 0) {
				await updateElementAutoLayout(newElementId, element.autoLayout);
			}
			if (element.rotation && element.rotation !== 0) {
				await rotateElement(newElementId, element.rotation);
			}
			if (element.alt || element.href || element.src) {
				await updateElement(newElementId, {
					alt: element.alt,
					href: element.href,
					src: element.src
				});
			}

			// Paste all descendants
			const descendants = clipboard.filter(el => el.parentId === element.id);
			for (const descendant of descendants) {
				await pasteElementTree(descendant, false);
			}

			return newElementId;
		}

		// Paste all root elements
		const newRootElementIds: string[] = [];
		for (const rootElement of rootElements) {
			const newId = await pasteElementTree(rootElement, true);
			newRootElementIds.push(newId);
		}

		await commitTransaction();

		// Select the newly pasted root elements
		selectElements(newRootElementIds);
	} catch (error) {
		if (isInTransaction) {
			isInTransaction = false;
			transactionEvents = [];
			currentTransactionId = null;
		}
		throw error;
	}
}

/**
 * Duplicate selected elements
 */
export async function duplicateElements(): Promise<void> {
	copyElements();
	await pasteElements();
}

/**
 * Select all elements on current page
 */
export function selectAll(): void {
	const state = get(designState);
	const pageId = state.currentPageId;
	if (!pageId) return;

	// Get all elements that belong to the current page (root elements with no parent)
	const allElementIds: string[] = Object.values(state.elements)
		.filter(el => el.parentId === null)
		.map(el => el.id);

	selectElements(allElementIds);
}

// ============================================================================
// Layer Management (Visibility, Lock, Rename)
// ============================================================================

/**
 * Toggle element visibility
 */
export async function toggleVisibility(elementId: string, visible: boolean): Promise<void> {
	await dispatch({
		type: 'UPDATE_ELEMENT',
		elementId,
		updates: { visible }
	});
}

/**
 * Toggle element lock state
 */
export async function toggleLock(elementId: string, locked: boolean): Promise<void> {
	await dispatch({
		type: 'UPDATE_ELEMENT',
		elementId,
		updates: { locked }
	});
}

/**
 * Rename element (set custom name)
 */
export async function renameElement(elementId: string, name: string): Promise<void> {
	await dispatch({
		type: 'UPDATE_ELEMENT',
		elementId,
		updates: { name }
	});
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * Setup keyboard shortcuts for undo/redo
 * Call this in your root layout
 */
export function setupKeyboardShortcuts(): (() => void) | undefined {
	if (typeof window === 'undefined') return;

	const textElementTypes = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label']);

	type TextShortcutAction =
		| { type: 'exec'; command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertOrderedList' | 'insertUnorderedList' | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull' }
		| { type: 'font-size'; delta: number };

	const getTextShortcutAction = (e: KeyboardEvent): TextShortcutAction | null => {
		const hasPrimaryModifier = e.metaKey || (e.ctrlKey && !e.metaKey);
		const code = e.code;
		const key = e.key.toLowerCase();

		// Alignment: Option/Alt + primary modifier
		if (e.altKey && hasPrimaryModifier) {
			switch (code) {
				case 'KeyL':
					return { type: 'exec', command: 'justifyLeft' };
				case 'KeyT':
					return { type: 'exec', command: 'justifyCenter' };
				case 'KeyR':
					return { type: 'exec', command: 'justifyRight' };
				case 'KeyJ':
					return { type: 'exec', command: 'justifyFull' };
				default:
			}

			switch (key) {
				case 'l':
					return { type: 'exec', command: 'justifyLeft' };
				case 't':
					return { type: 'exec', command: 'justifyCenter' };
				case 'r':
					return { type: 'exec', command: 'justifyRight' };
				case 'j':
					return { type: 'exec', command: 'justifyFull' };
				default:
			}
		}

		if (!hasPrimaryModifier) {
			return null;
		}

		// Font size adjustments: Shift + primary modifier (+/-)
		if (e.shiftKey && !e.altKey) {
			if (code === 'Period' || key === '>' || key === '.') {
				return { type: 'font-size', delta: 1 };
			}
			if (code === 'Comma' || key === '<' || key === ',') {
				return { type: 'font-size', delta: -1 };
			}
		}

		// Strikethrough
		if (e.shiftKey && !e.altKey && (code === 'KeyX' || key === 'x')) {
			return { type: 'exec', command: 'strikeThrough' };
		}

		// Lists
		if (e.shiftKey && !e.altKey) {
			if (e.code === 'Digit7') {
				return { type: 'exec', command: 'insertOrderedList' };
			}
			if (e.code === 'Digit8') {
				return { type: 'exec', command: 'insertUnorderedList' };
			}
		}

		// Basic formatting (no shift/alt)
		if (!e.shiftKey && !e.altKey) {
			switch (code) {
				case 'KeyB':
					return { type: 'exec', command: 'bold' };
				case 'KeyI':
					return { type: 'exec', command: 'italic' };
				case 'KeyU':
					return { type: 'exec', command: 'underline' };
				default:
			}

			switch (key) {
				case 'b':
					return { type: 'exec', command: 'bold' };
				case 'i':
					return { type: 'exec', command: 'italic' };
				case 'u':
					return { type: 'exec', command: 'underline' };
				default:
			}
		}

		return null;
	};

	const computeNextFontSize = (rawSize: string | undefined, delta: number): string => {
		const raw = rawSize || '16px';
		const match = raw.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
		const value = match ? parseFloat(match[1]) : parseFloat(raw);
		const unit = match && match[2] ? match[2] : 'px';
		const baseValue = Number.isNaN(value) ? 16 : value;
		const newValue = Math.max(1, baseValue + delta);

		return `${Number(newValue.toFixed(2))}${unit}`;
	};

	const applyTextShortcutToSelection = (action: TextShortcutAction) => {
		const selected = get(selectedElements);
		if (selected.length !== 1) return false;

		const [element] = selected;
		if (!element || !textElementTypes.has(element.type) || element.children.length > 0) {
			return false;
		}

		const { editingElementId } = get(interactionState);
		if (editingElementId) {
			return false;
		}

		if (action.type === 'font-size') {
			const nextSize = computeNextFontSize(element.typography.fontSize, action.delta);
			updateElementTypography(element.id, { fontSize: nextSize });
			return true;
		}

		startEditingText(element.id);

		const execute = () => {
			const editor = document.querySelector(`[data-editor-for="${element.id}"]`) as HTMLDivElement | null;
			if (!editor) {
				requestAnimationFrame(execute);
				return;
			}

			editor.focus();

			const selection = window.getSelection();
			if (selection) {
				selection.removeAllRanges();
				const range = document.createRange();
				range.selectNodeContents(editor);
				selection.addRange(range);
			}

			document.execCommand(action.command);

			editor.blur();
		};

		requestAnimationFrame(execute);
		return true;
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		// Don't trigger shortcuts if user is typing in an input/textarea
		const target = e.target as HTMLElement;
		const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

		const textAction = getTextShortcutAction(e);
		if (!isTyping && textAction) {
			const applied = applyTextShortcutToSelection(textAction);
			if (applied) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		}

		// Shift+W - Wrap selection in div
		if (
			e.shiftKey &&
			!e.metaKey &&
			!e.ctrlKey &&
			!e.altKey &&
			e.key.toLowerCase() === 'w' &&
			!isTyping
		) {
			e.preventDefault();
			wrapSelectedElementsInDiv();
			return;
		}

		// Shift+A - Toggle auto-layout
		if (
			e.shiftKey &&
			!e.metaKey &&
			!e.ctrlKey &&
			!e.altKey &&
			e.key.toLowerCase() === 'a' &&
			!isTyping
		) {
			e.preventDefault();
			toggleAutoLayout();
			return;
		}

		// Cmd+G (Mac) or Ctrl+G (Windows/Linux) - Group elements
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && !e.shiftKey && !isTyping) {
			e.preventDefault();
			groupElements();
			return;
		}

		// Cmd+Shift+G (Mac) or Ctrl+Shift+G (Windows/Linux) - Ungroup elements
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && e.shiftKey && !isTyping) {
			e.preventDefault();
			ungroupElements();
			return;
		}

		// Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
		if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		}
		// Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows/Linux)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
			e.preventDefault();
			redo();
		}
		// Cmd+Y (alternative redo)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
			e.preventDefault();
			redo();
		}
		// Cmd+S (save - visual feedback)
		else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			manualSave();
		}
		// Cmd+C (copy)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isTyping) {
			e.preventDefault();
			copyElements();
		}
		// Cmd+X (cut)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'x' && !isTyping) {
			e.preventDefault();
			cutElements();
		}
		// Cmd+Shift+V (paste inside) - bypasses drop restrictions
		else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && e.shiftKey && !isTyping) {
			e.preventDefault();
			pasteElementsInside();
		}
		// Cmd+V (paste)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey && !isTyping) {
			e.preventDefault();
			pasteElements();
		}
		// Cmd+D (duplicate)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !isTyping) {
			e.preventDefault();
			duplicateElements();
		}
		// Cmd+A (select all)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isTyping) {
			e.preventDefault();
			selectAll();
		}
		// ESC (deselect all)
		else if (e.key === 'Escape' && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				clearSelection();
			}
		}
		// V (switch to Move tool)
		else if (e.key === 'v' && !isTyping) {
			e.preventDefault();
			currentTool.set('move');
		}
		// H (switch to Hand tool)
		else if (e.key === 'h' && !isTyping) {
			e.preventDefault();
			currentTool.set('hand');
		}
		// S (switch to Scale tool)
		else if (e.key === 's' && !isTyping) {
			e.preventDefault();
			currentTool.set('scale');
		}
		// D (switch to Div tool)
		else if (e.key === 'd' && !isTyping) {
			e.preventDefault();
			currentTool.set('div');
		}
		// T (switch to Text tool)
		else if (e.key === 't' && !isTyping) {
			e.preventDefault();
			currentTool.set('text');
		}
		// M (switch to Media tool)
		else if (e.key === 'm' && !isTyping) {
			e.preventDefault();
			currentTool.set('media');
		}
		// Cmd/Ctrl + [ - Rotate 15° counter-clockwise
		else if ((e.metaKey || e.ctrlKey) && e.key === '[' && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				selected.forEach(el => {
					const currentRotation = el.rotation || 0;
					rotateElement(el.id, currentRotation - 15);
				});
			}
		}
		// Cmd/Ctrl + ] - Rotate 15° clockwise
		else if ((e.metaKey || e.ctrlKey) && e.key === ']' && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				selected.forEach(el => {
					const currentRotation = el.rotation || 0;
					rotateElement(el.id, currentRotation + 15);
				});
			}
		}
		// Cmd+Backspace (Mac) or Ctrl+Backspace (Windows) - Unwrap selected div
		if (
			(e.metaKey || e.ctrlKey) &&
			(e.key === 'Backspace' || e.key === 'Delete') &&
			!isTyping
		) {
			e.preventDefault();
			unwrapSelectedDiv();
			return;
		}

		// Delete or Backspace - delete selected elements
		else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				// Delete all selected elements (await all deletions)
				Promise.all(selected.map((element) => deleteElement(element.id)))
					.catch((error) => {
						console.error('Failed to delete elements:', error);
					});
			}
		}
	};

	window.addEventListener('keydown', handleKeyDown);

	// Cleanup function
	return () => {
		window.removeEventListener('keydown', handleKeyDown);
	};
}

