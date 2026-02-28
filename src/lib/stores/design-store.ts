/**
 * Design Store - Svelte store wrapping the event sourcing system
 *
 * This is the main API for interacting with the design system.
 * It provides a reactive Svelte store and action dispatchers.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { DesignEvent, DesignState, Element, Page, Component, AutoLayoutStyle, Group } from '$lib/types/events';
import {
	initDB,
	appendEvent,
	appendEvents,
	getAllEvents,
	clearEvents,
	exportEvents,
	importEvents
} from './event-store';
import { reduceEvents, applyEventsIncremental, getInitialState } from './event-reducer';
import { currentTool } from './tool-store';
import { interactionState, startEditingText, clearElementIsolation, isolateElementFromGroup } from './interaction-store';
import { viewport, screenToCanvas } from './viewport-store';
import { migrateToUnifiedPositioning } from '$lib/utils/migrate-positioning';

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

export const storeState: Writable<StoreState> = writable(initialStoreState);

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
// Performance-Optimized Derived Stores
// ============================================================================

/**
 * Memoized store for current page root elements
 * Prevents redundant .map() and .filter() operations on every render
 */
export const currentPageRootElements: Readable<Element[]> = derived(
	designState,
	($designState) => {
		if (!$designState.currentPageId) return [];
		const page = $designState.pages[$designState.currentPageId];
		if (!page) return [];

		return page.canvasElements
			.map(id => $designState.elements[id])
			.filter(Boolean);
	}
);

/**
 * Memoized store for current page root element IDs
 */
export const currentPageRootElementIds: Readable<string[]> = derived(
	designState,
	($designState) => {
		if (!$designState.currentPageId) return [];
		const page = $designState.pages[$designState.currentPageId];
		return page ? page.canvasElements : [];
	}
);

/**
 * Memoized store for selected element IDs (array instead of object lookups)
 */
export const selectedElementIds: Readable<string[]> = derived(
	designState,
	($designState) => $designState.selectedElementIds
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

	let designState = reduceEvents(events);

	// TODO: Group migration removed - groups feature has been deprecated
	// Groups are no longer supported in this version

	// Migrate to unified positioning model (adds positionMode to all elements)
	// This is safe to run on every load - it only migrates elements that need it
	designState = migrateToUnifiedPositioning(designState);

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
		designState = get(storeState).designState; // Refresh after creating page
	} else {
		// Set the first page as current if not set
		if (!designState.currentPageId) {
			const firstPageId = designState.pageOrder[0];
			if (firstPageId) {
				setCurrentPage(firstPageId);
			}
		}
	}

	// Note: Old migration code for view.elements[] was removed
	// Users should clear IndexedDB if they have old data from before the architecture refactor
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

	// Recompute design state INCREMENTALLY (only apply new transaction events)
	let newDesignState = applyEventsIncremental(state.designState, transactionEvents);

	// Preserve selection state (selection is not part of event sourcing)
	// Create new object because Immer returns frozen object
	newDesignState = {
		...newDesignState,
		selectedElementIds: state.designState.selectedElementIds
	};

	// Update store - increment index only once for all events
	storeState.update((s) => ({
		...s,
		events: newEvents,
		designState: newDesignState,
		currentEventIndex: newEvents.length - 1,
		isSaving: true
	}));

	// Persist all events to IndexedDB in a single batch write (massive performance boost)
	try {
		await appendEvents(transactionEvents);

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
export async function dispatch(event: DesignEvent): Promise<void> {
	// If in transaction, collect events instead of dispatching immediately
	if (isInTransaction) {
		transactionEvents.push(event);
		// OPTIMIZATION: Don't rebuild state on every event during transaction!
		// This was causing O(n²) complexity (reduce 1, then 2, then 3... events)
		// State will be rebuilt once in commitTransaction() instead
		// UI will update when transaction commits (still feels instant)
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

	// Create page with empty canvas
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

	// Set as current page
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			currentPageId: pageId
		}
	}));

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
	storeState.update((state) => {
		const page = state.designState.pages[pageId];
		if (!page) {
			console.error(`Page ${pageId} not found`);
			return state;
		}

		return {
			...state,
			designState: {
				...state.designState,
				currentPageId: pageId
			}
		};
	});
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

	// CRITICAL: Root elements MUST belong to a page (LAYERS = DOM POSITION)
	// Check that the page exists
	if (!data.parentId && !state.pages[data.pageId]) {
		throw new Error(
			'CRITICAL: Cannot create root element without a valid page. ' +
			'LAYERS ARE DOM POSITION. Root elements must belong to a page\'s canvas to have a DOM order. ' +
			`pageId: ${data.pageId}, pages: ${Object.keys(state.pages)}`
		);
	}

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			parentId: data.parentId,
			pageId: data.pageId,
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

/**
 * Delete multiple elements at once (batched for performance)
 * Uses a single GROUP_DELETE_ELEMENTS event instead of N individual events
 */
export async function deleteElements(elementIds: string[]): Promise<void> {
	if (elementIds.length === 0) return;

	// Single deletion - use individual event for better event log
	if (elementIds.length === 1) {
		return deleteElement(elementIds[0]);
	}

	// Batch deletion - single event for performance
	await dispatch({
		id: uuidv4(),
		type: 'GROUP_DELETE_ELEMENTS',
		timestamp: Date.now(),
		payload: {
			elementIds
		}
	});
}

/**
 * Clear all elements from the current page's canvas
 * Useful for resetting a corrupted canvas
 */
export async function clearCurrentPageCanvas(): Promise<void> {
	const state = get(storeState);
	const pageId = state.designState.currentPageId;
	
	if (!pageId) {
		console.warn('No current page to clear');
		return;
	}

	const page = state.designState.pages[pageId];
	if (!page) {
		console.warn(`Page ${pageId} not found`);
		return;
	}

	// Get all root element IDs from the canvas
	const rootElementIds = page.canvasElements;
	
	if (rootElementIds.length === 0) {
		console.log('Canvas is already empty');
		return;
	}

	// Delete all root elements (this will recursively delete all children)
	await deleteElements(rootElementIds);
	
	console.log(`Cleared ${rootElementIds.length} root element(s) from canvas`);
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

	// Check if any of the elements being selected is currently isolated
	const isolatedId = get(interactionState).isolatedElementId;

	// If an element is isolated, check if we're in "sticky isolation mode"
	// This happens when:
	// 1. An element from a group is isolated (isolatedId exists)
	// 2. We're adding more elements from the same group
	const isolatedElement = isolatedId ? state.elements[isolatedId] : null;
	const isolatedGroupId = isolatedElement?.groupId;

	// Check if ANY element being added is from the same group as the isolated element
	const isAddingFromIsolatedGroup = isolatedGroupId && elementIds.some(id => {
		const el = state.elements[id];
		return el?.groupId === isolatedGroupId;
	});

	// Helper function to recursively expand a group and all its nested child groups
	const expandGroup = (groupId: string, shouldSkip: boolean) => {
		const group = state.groups[groupId];
		if (!group) return;

		// Add all direct members of this group
		for (const memberId of group.elementIds) {
			if (!seen.has(memberId) && state.elements[memberId]) {
				seen.add(memberId);
				expanded.push(memberId);
			}
		}

		// Recursively expand any nested child groups (groups with this group as parent)
		if (!shouldSkip) {
			for (const childGroup of Object.values(state.groups)) {
				if (childGroup.parentGroupId === groupId) {
					expandGroup(childGroup.id, false);
				}
			}
		}
	};

	for (const id of elementIds) {
		const element = state.elements[id];

		// Skip group expansion if:
		// 1. This element is the isolated one, OR
		// 2. We're adding elements from the same group as the isolated element (sticky isolation)
		const shouldSkipGroupExpansion =
			(element?.groupId && isolatedId && element.groupId === isolatedGroupId) ||
			(element?.groupId && isAddingFromIsolatedGroup && element.groupId === isolatedGroupId);

		if (element?.groupId && !shouldSkipGroupExpansion) {
			// Find the root parent group (traverse up the hierarchy)
			let currentGroupId = element.groupId;
			let group = state.groups[currentGroupId];
			const visitedGroups = new Set<string>([currentGroupId]);

			while (group?.parentGroupId) {
				if (visitedGroups.has(group.parentGroupId)) break;
				visitedGroups.add(group.parentGroupId);
				currentGroupId = group.parentGroupId;
				group = state.groups[currentGroupId];
			}

			// Expand from the root parent group down (includes all nested groups)
			expandGroup(currentGroupId, false);
			continue;
		}

		if (!seen.has(id) && state.elements[id]) {
			seen.add(id);
			expanded.push(id);
		}
	}

	return expanded;
}

export function selectElement(elementId: string): void {
	console.trace('selectElement called with:', elementId);
	storeState.update((state) => {
		const expanded = expandSelectionWithGroups([elementId], state.designState);
		console.log('selectElement expanded to:', expanded.length, 'elements');
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
	console.trace('selectElements called with:', elementIds.length, 'elements');
	storeState.update((state) => {
		const expanded = expandSelectionWithGroups(elementIds, state.designState);
		console.log('selectElements expanded to:', expanded.length, 'elements');
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
		const isolatedId = get(interactionState).isolatedElementId;
		const isolatedElement = isolatedId ? state.designState.elements[isolatedId] : null;
		const isolatedGroupId = isolatedElement?.groupId;

		// Check if we're in sticky isolation mode (removing an element from an isolated group)
		const isRemovingFromIsolatedGroup =
			element?.groupId &&
			isolatedGroupId === element.groupId;

		// If in sticky isolation mode, only remove this specific element
		// Otherwise, remove all group members
		const groupMemberIds =
			element?.groupId && state.designState.groups[element.groupId] && !isRemovingFromIsolatedGroup
				? new Set(state.designState.groups[element.groupId].elementIds)
				: new Set([elementId]);

		const newSelectedIds = state.designState.selectedElementIds.filter(
			(id) => !groupMemberIds.has(id)
		);

		// Smart isolation state management:
		// - If selection becomes empty, clear isolation
		// - If removing the isolated element but others from same group remain, update isolatedElementId to one of them
		// - If no elements from the isolated group remain, clear isolation
		if (isolatedId && isolatedGroupId) {
			if (newSelectedIds.length === 0) {
				// Selection is empty, clear isolation
				clearElementIsolation();
			} else if (groupMemberIds.has(isolatedId)) {
				// We're removing the currently isolated element
				// Check if any other elements from the same group are still selected
				const remainingFromGroup = newSelectedIds.filter(id => {
					const el = state.designState.elements[id];
					return el?.groupId === isolatedGroupId;
				});

				if (remainingFromGroup.length > 0) {
					// Update isolation to point to one of the remaining elements
					isolateElementFromGroup(remainingFromGroup[0]);
				} else {
					// No elements from the isolated group remain, clear isolation
					clearElementIsolation();
				}
			}
		}

		return {
			...state,
			designState: {
				...state.designState,
				selectedElementIds: newSelectedIds
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
// Clipboard for group records (needed for nested groups)
let clipboardGroups: Record<string, Group> = {};
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
			const visitedParents = new Set<string>(wrapper.parentId ? [wrapper.parentId] : []);
			while (currentParent) {
				wrapperAbsX += currentParent.position.x;
				wrapperAbsY += currentParent.position.y;
				if (!currentParent.parentId || visitedParents.has(currentParent.parentId)) break;
				visitedParents.add(currentParent.parentId);
				currentParent = state.elements[currentParent.parentId] ?? null;
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
 * Simply assigns the same groupId to all selected elements
 * Allows single-element groups so users can add more elements via drag-and-drop
 */
export async function groupElements(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length < 1) return; // Need at least 1 element to group

	const elementIds = selected.map(el => el.id);
	const groupId = uuidv4();

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_GROUP',
		timestamp: Date.now(),
		payload: { groupId, elementIds }
	});

	// Keep selection on the grouped elements
	selectElements(elementIds);
}

/**
 * Helper function to recursively get all element IDs in a group
 */
function getAllElementsInGroup(groupId: string, state: DesignState): string[] {
	const result: string[] = [];
	const group = state.groups[groupId];
	if (!group) return result;

	// Add direct elements from the group's elementIds array
	result.push(...group.elementIds);

	// Add elements from child groups recursively
	for (const childGroup of Object.values(state.groups)) {
		if (childGroup.parentGroupId === groupId) {
			result.push(...getAllElementsInGroup(childGroup.id, state));
		}
	}

	return result;
}

/**
 * Ungroup selected elements
 * Removes grouping from all selected elements that are in a group
 * Implements Figma-like behavior: only ungroups the parent-most group that contains the selection
 */
export async function ungroupElements(): Promise<void> {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	const state = get(designState);

	// If selected elements include group wrapper divs (plain divs inside AL), expand to include
	// their actual group elements. This handles groups-in-AL where the wrapper is what's selected.
	// Also handles outer wrappers for groups-of-groups (whose children are inner wrappers).
	function collectGroupElementsFromWrapper(wrapperId: string, into: Set<string>): void {
		const wrapper = state.elements[wrapperId];
		if (!wrapper || wrapper.autoLayout?.enabled || wrapper.isView) return;
		for (const childId of wrapper.children) {
			const child = state.elements[childId];
			if (!child) continue;
			if (child.groupId) {
				into.add(childId);
			} else {
				// Child is itself a wrapper (inner wrapper of a group-of-groups) — recurse
				collectGroupElementsFromWrapper(childId, into);
			}
		}
	}

	const expandedIds = new Set(selected.map(el => el.id));
	for (const el of selected) {
		if (el.autoLayout?.enabled || el.isView || el.children.length === 0) continue;
		const parentEl = el.parentId ? state.elements[el.parentId] : null;
		if (!parentEl?.autoLayout?.enabled) continue;
		// Expand wrapper (simple or outer) into actual group element IDs
		collectGroupElementsFromWrapper(el.id, expandedIds);
	}

	const expandedSelected = Array.from(expandedIds)
		.map(id => state.elements[id])
		.filter(Boolean) as Element[];

	const selectedIds = new Set(expandedSelected.map(el => el.id));

	// Find all groups where ALL of the group's elements are selected
	// We need to recursively check all descendants, not just direct elementIds
	const fullySelectedGroups: string[] = [];
	for (const [groupId] of Object.entries(state.groups)) {
		// Get ALL elements that belong to this group (recursively)
		const allGroupElements = getAllElementsInGroup(groupId, state);

		// A group is fully selected if ALL its elements (including nested) are selected
		const allElementsSelected = allGroupElements.length > 0 && allGroupElements.every((id: string) => selectedIds.has(id));

		if (allElementsSelected) {
			fullySelectedGroups.push(groupId);
		}
	}

	if (fullySelectedGroups.length === 0) return;

	// Find ALL top-most fully selected groups (groups with no parent that's also fully selected)
	// If multiple top-level groups are selected, we ungroup ALL of them at once
	const topMostGroupIds: string[] = [];
	for (const groupId of fullySelectedGroups) {
		const group = state.groups[groupId];
		if (!group) continue;

		// Check if this group's parent is also fully selected
		const hasFullySelectedParent = group.parentGroupId && fullySelectedGroups.includes(group.parentGroupId);

		if (!hasFullySelectedParent) {
			// This is a top-most fully selected group
			topMostGroupIds.push(groupId);
		}
	}

	if (topMostGroupIds.length === 0) return;

	// Collect all elements that will remain selected after ungrouping all top-most groups
	const elementsToSelect: string[] = [];

	for (const topMostGroupId of topMostGroupIds) {
		// Find all direct child groups of this group being ungrouped
		for (const [childGroupId, childGroup] of Object.entries(state.groups)) {
			if (childGroup.parentGroupId === topMostGroupId) {
				// This is a child group - get all its elements
				const childElements = getAllElementsInGroup(childGroupId, state);
				elementsToSelect.push(...childElements);
			}
		}

		// Also include any direct elements of the group being ungrouped
		const group = state.groups[topMostGroupId];
		if (group) {
			elementsToSelect.push(...group.elementIds);
		}
	}

	// Dispatch ungroup events for ALL top-most groups.
	// For parent groups (groups of groups, elementIds=[]), also ungroup each child group
	// so that UNGROUP_ELEMENTS clears groupId from all descendant elements.
	for (const groupId of topMostGroupIds) {
		const group = state.groups[groupId];

		// If this is a parent group (has child groups, no direct elements), ungroup children first
		if (group && group.elementIds.length === 0) {
			const childGroupIds = Object.keys(state.groups).filter(
				id => state.groups[id].parentGroupId === groupId
			);
			for (const childGroupId of childGroupIds) {
				await dispatch({
					id: uuidv4(),
					type: 'UNGROUP_ELEMENTS',
					timestamp: Date.now(),
					payload: { groupId: childGroupId }
				});
			}
		}

		await dispatch({
			id: uuidv4(),
			type: 'UNGROUP_ELEMENTS',
			timestamp: Date.now(),
			payload: { groupId }
		});
	}

	// After ungrouping, check if any group was inside a group wrapper
	// (a plain div inside an auto-layout container). If so, move its ex-children
	// up into the AL container directly and delete the now-empty wrapper div.
	const freshState = get(designState);
	for (const groupId of topMostGroupIds) {
		const group = state.groups[groupId]; // use pre-ungroup state

		// Case 1: simple group — find wrapper via first element
		if (group && group.elementIds.length > 0) {
			const firstEl = freshState.elements[group.elementIds[0]];
			if (!firstEl) continue;

			const wrapper = firstEl.parentId ? freshState.elements[firstEl.parentId] : null;
			const alParent = wrapper?.parentId ? freshState.elements[wrapper.parentId] : null;

			if (
				wrapper &&
				!wrapper.autoLayout?.enabled &&
				!wrapper.isView &&
				alParent?.autoLayout?.enabled
			) {
				const wrapperIndex = alParent.children.indexOf(wrapper.id);
				const childIds = [...wrapper.children];
				for (let i = 0; i < childIds.length; i++) {
					await dispatch({
						id: uuidv4(),
						type: 'REORDER_ELEMENT',
						timestamp: Date.now(),
						payload: { elementId: childIds[i], newParentId: alParent.id, newIndex: wrapperIndex + i }
					});
				}
				await dispatch({
					id: uuidv4(),
					type: 'DELETE_ELEMENT',
					timestamp: Date.now(),
					payload: { elementId: wrapper.id }
				});
			}
			continue;
		}

		// Case 2: parent group (group of groups) — find outer wrapper via a child group's element
		if (!group) continue;
		const childGroupIds = Object.keys(state.groups).filter(
			id => state.groups[id].parentGroupId === groupId
		);
		if (childGroupIds.length === 0) continue;

		// Collect all elements across child groups to find the outer wrapper
		const allChildElementIds = childGroupIds.flatMap(
			id => state.groups[id].elementIds
		);
		if (allChildElementIds.length === 0) continue;

		const anyChildEl = freshState.elements[allChildElementIds[0]];
		if (!anyChildEl) continue;

		// anyChildEl → inner wrapper → outer wrapper → AL parent
		const innerWrapper = anyChildEl.parentId ? freshState.elements[anyChildEl.parentId] : null;
		const outerWrapper = innerWrapper?.parentId ? freshState.elements[innerWrapper.parentId] : null;
		const alParent = outerWrapper?.parentId ? freshState.elements[outerWrapper.parentId] : null;

		if (
			outerWrapper &&
			!outerWrapper.autoLayout?.enabled &&
			!outerWrapper.isView &&
			alParent?.autoLayout?.enabled
		) {
			const outerIndex = alParent.children.indexOf(outerWrapper.id);

			// Move each inner wrapper's children directly to the AL parent, then delete inner wrapper
			let insertAt = outerIndex;
			const innerWrapperIds = [...outerWrapper.children];
			for (const innerWrapperId of innerWrapperIds) {
				const innerWrapperEl = freshState.elements[innerWrapperId];
				if (!innerWrapperEl) continue;
				const grandchildIds = [...innerWrapperEl.children];
				for (let i = 0; i < grandchildIds.length; i++) {
					await dispatch({
						id: uuidv4(),
						type: 'REORDER_ELEMENT',
						timestamp: Date.now(),
						payload: { elementId: grandchildIds[i], newParentId: alParent.id, newIndex: insertAt + i }
					});
				}
				insertAt += grandchildIds.length;
				await dispatch({
					id: uuidv4(),
					type: 'DELETE_ELEMENT',
					timestamp: Date.now(),
					payload: { elementId: innerWrapperId }
				});
			}
			// Delete the outer wrapper
			await dispatch({
				id: uuidv4(),
				type: 'DELETE_ELEMENT',
				timestamp: Date.now(),
				payload: { elementId: outerWrapper.id }
			});
		}
	}

	// Select the child elements/groups that remain after ungrouping
	// This matches Figma behavior where ungrouping maintains selection of the children
	if (elementsToSelect.length > 0) {
		selectElements(elementsToSelect);
	}
}

/**
 * Reorder an entire group to a new position in the DOM.
 * When moving into an auto-layout container, wraps the group elements in a div
 * so their relative positioning is preserved (auto-layout would otherwise treat
 * each element as an independent flex item, losing the group's internal layout).
 */
export async function reorderGroup(
	groupId: string,
	newParentId: string | null,
	newIndex: number
): Promise<void> {
	const state = get(designState);
	const targetParent = newParentId ? state.elements[newParentId] : null;

	if (targetParent?.autoLayout?.enabled) {
		// Target is an auto-layout container: wrap the group elements in a div first
		const groupElements = Object.values(state.elements)
			.filter(el => el.groupId === groupId);

		if (groupElements.length >= 2) {
			beginTransaction();
			try {
				// Calculate bounding box of the group in its current coordinate space
				let minX = Infinity, minY = Infinity;
				let maxX = -Infinity, maxY = -Infinity;
				for (const el of groupElements) {
					minX = Math.min(minX, el.position.x);
					minY = Math.min(minY, el.position.y);
					maxX = Math.max(maxX, el.position.x + (el.size.width || 0));
					maxY = Math.max(maxY, el.position.y + (el.size.height || 0));
				}

				// Create wrapper div as a flex item in the auto-layout container
				const wrapperId = await createElement({
					parentId: newParentId,
					pageId: groupElements[0].pageId,
					elementType: 'div',
					position: { x: 0, y: 0 },
					size: { width: maxX - minX, height: maxY - minY },
					styles: { display: 'block' }
				});

				// Move each group element into the wrapper at its relative position
				for (let i = 0; i < groupElements.length; i++) {
					const el = groupElements[i];
					await reorderElement(el.id, wrapperId, i);
					await moveElement(el.id, {
						x: el.position.x - minX,
						y: el.position.y - minY
					});
				}

				await commitTransaction();
			} catch (error) {
				await commitTransaction();
				throw error;
			}
			return;
		}
	}

	await dispatch({
		id: uuidv4(),
		type: 'REORDER_GROUP',
		timestamp: Date.now(),
		payload: {
			groupId,
			newParentId,
			newIndex
		}
	});
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

	// If selected elements are part of a group but the wrapper is not selected,
	// we need to include the wrapper in the clipboard to preserve the group structure
	const selectedIds = new Set(selected.map(el => el.id));
	for (const el of selected) {
		if (el.groupId && state.groups[el.groupId]) {
			const group = state.groups[el.groupId];
			// If this is a new-style group with a wrapper
			if (group.wrapperId && !selectedIds.has(group.wrapperId)) {
				// Check if all group members are selected
				const allMembersSelected = group.elementIds.every(id => selectedIds.has(id));
				if (allMembersSelected) {
					// All group members are selected but wrapper is not - include the wrapper
					const wrapper = state.elements[group.wrapperId];
					if (wrapper) {
						elementsToCopy.add(wrapper);
						// Also include wrapper's ancestors if any
						let current = wrapper;
						while (current.parentId) {
							const parent = state.elements[current.parentId];
							if (parent && !elementsToCopy.has(parent)) {
								elementsToCopy.add(parent);
								current = parent;
							} else {
								break;
							}
						}
					}
				}
			}
		}
	}

	// Clone elements (deep copy)
	clipboard = Array.from(elementsToCopy).map((el) => ({ ...el }));
	isClipboardFromCut = false;

	// Copy group records for all groups that the copied elements belong to
	// This is CRITICAL for nested groups to preserve the hierarchy
	const copiedGroupIds = new Set<string>();
	for (const el of clipboard) {
		if (el.groupId) {
			copiedGroupIds.add(el.groupId);
		}
	}

	// Also include parent groups in the hierarchy
	const groupIdsToInclude = new Set(copiedGroupIds);
	for (const groupId of copiedGroupIds) {
		let currentGroup = state.groups[groupId];
		const visited = new Set<string>([groupId]);
		while (currentGroup?.parentGroupId) {
			if (visited.has(currentGroup.parentGroupId)) break;
			visited.add(currentGroup.parentGroupId);
			groupIdsToInclude.add(currentGroup.parentGroupId);
			currentGroup = state.groups[currentGroup.parentGroupId];
		}
	}

	// Copy all relevant group records
	clipboardGroups = {};
	for (const groupId of groupIdsToInclude) {
		if (state.groups[groupId]) {
			clipboardGroups[groupId] = { ...state.groups[groupId] };
		}
	}
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

	// Copy group records for all groups that the copied elements belong to
	// This is CRITICAL for nested groups to preserve the hierarchy
	const copiedGroupIds = new Set<string>();
	for (const el of clipboard) {
		if (el.groupId) {
			copiedGroupIds.add(el.groupId);
		}
	}

	// Also include parent groups in the hierarchy
	const groupIdsToInclude = new Set(copiedGroupIds);
	for (const groupId of copiedGroupIds) {
		let currentGroup = state.groups[groupId];
		const visited = new Set<string>([groupId]);
		while (currentGroup?.parentGroupId) {
			if (visited.has(currentGroup.parentGroupId)) break;
			visited.add(currentGroup.parentGroupId);
			groupIdsToInclude.add(currentGroup.parentGroupId);
			currentGroup = state.groups[currentGroup.parentGroupId];
		}
	}

	// Copy all relevant group records
	clipboardGroups = {};
	for (const groupId of groupIdsToInclude) {
		if (state.groups[groupId]) {
			clipboardGroups[groupId] = { ...state.groups[groupId] };
		}
	}

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
export async function pasteElements(
	customOffset?: { x: number; y: number } | null,
	pasteInside = false
): Promise<void> {
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
			if (pasteInside) {
				// Cmd+Shift+V: Explicitly paste inside selected element
				targetParentId = selectedElement.id;
			} else {
				// Cmd+V: Always paste as sibling (same level as selected element)
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
		const oldToNewGroupIdMap = new Map<string, string>(); // Map old group IDs to new group IDs

		// Generate new group IDs for all groups in clipboard
		// This prevents pasted elements from being linked to original groups
		// IMPORTANT: Use clipboardGroups (not just element.groupId) to include parent groups
		for (const oldGroupId of Object.keys(clipboardGroups)) {
			if (!oldToNewGroupIdMap.has(oldGroupId)) {
				oldToNewGroupIdMap.set(oldGroupId, uuidv4());
			}
		}

		// Identify root elements (elements whose parent is not in clipboard or is null)
		const clipboardIds = new Set(clipboard.map(el => el.id));
		const rootElements = clipboard.filter(el => !el.parentId || !clipboardIds.has(el.parentId));

	// Calculate group offsets for centering groups when pasting inside a parent
	const groupOffsets = new Map<string, { x: number; y: number }>();
	const groupedRoots = new Map<string, Element[]>();

	// Walk up the parentGroupId chain in clipboardGroups to find the topmost (root) group ID.
	// This handles nested groups: A[BA, BB] — elements of BA and BB all belong to root group A.
	function getRootGroupId(groupId: string): string {
		let current = groupId;
		const visited = new Set<string>([current]);
		while (clipboardGroups[current]?.parentGroupId) {
			const next = clipboardGroups[current].parentGroupId!;
			if (visited.has(next)) break;
			visited.add(next);
			current = next;
		}
		return current;
	}

	// Group root elements by their root group ID (topmost ancestor group).
	// Using the root group ID ensures nested groups like A[BA, BB] are bucketed together
	// instead of being split into separate wrappers per sub-group.
	for (const element of rootElements) {
		if (element.groupId) {
			const rootGroupId = getRootGroupId(element.groupId);
			const group = groupedRoots.get(rootGroupId) || [];
			group.push(element);
			groupedRoots.set(rootGroupId, group);
		}
	}

	// If pasting inside a container, calculate offsets to center groups
	// Also pre-create wrapper divs for groups pasted into auto-layout containers
	const groupWrappers = new Map<string, { wrapperId: string; minX: number; minY: number }>();
	if (targetParentId) {
		const currentState = get(designState);
		const parentElement = currentState.elements[targetParentId];

		if (parentElement && !parentElement.autoLayout?.enabled) {
			for (const [groupId, rootElementsInGroup] of groupedRoots) {
				// Calculate bounding box
				let minX = Infinity, minY = Infinity;
				let maxX = -Infinity, maxY = -Infinity;

				for (const el of rootElementsInGroup) {
					minX = Math.min(minX, el.position.x);
					minY = Math.min(minY, el.position.y);
					maxX = Math.max(maxX, el.position.x + el.size.width);
					maxY = Math.max(maxY, el.position.y + el.size.height);
				}

				const groupWidth = maxX - minX;
				const groupHeight = maxY - minY;
				const targetX = (parentElement.size.width - groupWidth) / 2;
				const targetY = (parentElement.size.height - groupHeight) / 2;
				const offsetX_group = targetX - minX;
				const offsetY_group = targetY - minY;

				groupOffsets.set(groupId, { x: offsetX_group, y: offsetY_group });
			}
		} else if (parentElement?.autoLayout?.enabled) {
			// Pasting groups into an AL container.
			//
			// Simple group (A[E1,E2,E3]):
			//   → one wrapper div (flex item), elements absolutely positioned inside it.
			//
			// Group of groups (A[BA[E1,E2], BB[E3,E4]]):
			//   → one OUTER wrapper for A (flex item in AL), sized to A's full bounding box.
			//   → one INNER wrapper per sub-group (BA, BB), absolutely positioned inside the
			//     outer wrapper at their original position relative to A's origin.
			//   → elements go into their sub-group wrapper, positioned relative to it.
			//   This preserves both the internal layout of each sub-group AND the spatial
			//   disposition of sub-groups relative to each other.

			// Identify which groups are parent groups (have child groups pointing to them)
			const parentGroupIds = new Set(
				Object.values(clipboardGroups)
					.map(g => g.parentGroupId)
					.filter(Boolean) as string[]
			);

			// Build a map from direct groupId → root elements that belong to it
			const directGroupElements = new Map<string, Element[]>();
			for (const element of rootElements) {
				if (!element.groupId) continue;
				const list = directGroupElements.get(element.groupId) || [];
				list.push(element);
				directGroupElements.set(element.groupId, list);
			}

			// Helper: compute bounding box of elements from their clipboard positions
			function boundingBox(elements: Element[]): { minX: number; minY: number; maxX: number; maxY: number } {
				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
				for (const el of elements) {
					minX = Math.min(minX, el.position.x);
					minY = Math.min(minY, el.position.y);
					maxX = Math.max(maxX, el.position.x + (el.size.width || 0));
					maxY = Math.max(maxY, el.position.y + (el.size.height || 0));
				}
				return { minX, minY, maxX, maxY };
			}

			// Process each root-level group (no parentGroupId = top-level in this clipboard)
			const topLevelGroupIds = Object.keys(clipboardGroups).filter(
				id => !clipboardGroups[id].parentGroupId
			);

			for (const topGroupId of topLevelGroupIds) {
				// Collect all root elements that ultimately belong to this top-level group
				const allElementsInTree: Element[] = [];
				for (const element of rootElements) {
					if (element.groupId && getRootGroupId(element.groupId) === topGroupId) {
						allElementsInTree.push(element);
					}
				}
				if (allElementsInTree.length === 0) continue;

				const isParentGroup = parentGroupIds.has(topGroupId);

				if (!isParentGroup) {
					// Simple leaf group: one wrapper for everything
					if (allElementsInTree.length < 2) continue;
					const { minX, minY, maxX, maxY } = boundingBox(allElementsInTree);
					const wrapperId = uuidv4();
					dispatch({
						id: uuidv4(), type: 'CREATE_ELEMENT', timestamp: Date.now(),
						payload: {
							elementId: wrapperId, parentId: targetParentId, pageId,
							elementType: 'div', position: { x: 0, y: 0 },
							size: { width: maxX - minX, height: maxY - minY },
							styles: { display: 'block' }
						}
					});
					groupWrappers.set(topGroupId, { wrapperId, minX, minY });
				} else {
					// Group of groups: create outer wrapper sized to the full tree bounding box,
					// then inner wrappers per sub-group positioned relative to the outer wrapper.
					const { minX: outerMinX, minY: outerMinY, maxX: outerMaxX, maxY: outerMaxY } = boundingBox(allElementsInTree);
					const outerWrapperId = uuidv4();
					dispatch({
						id: uuidv4(), type: 'CREATE_ELEMENT', timestamp: Date.now(),
						payload: {
							elementId: outerWrapperId, parentId: targetParentId, pageId,
							elementType: 'div', position: { x: 0, y: 0 },
							size: { width: outerMaxX - outerMinX, height: outerMaxY - outerMinY },
							styles: { display: 'block' }
						}
					});

					// Store the outer wrapper so elements without a sub-group wrapper also resolve correctly
					groupWrappers.set(topGroupId, { wrapperId: outerWrapperId, minX: outerMinX, minY: outerMinY });

					// Create inner wrappers for each direct child group of topGroupId
					const childGroupIds = Object.keys(clipboardGroups).filter(
						id => clipboardGroups[id].parentGroupId === topGroupId
					);
					for (const childGroupId of childGroupIds) {
						const childElements = directGroupElements.get(childGroupId) || [];
						if (childElements.length < 2) {
							// Single element in sub-group: no inner wrapper, position relative to outer
							groupWrappers.set(childGroupId, { wrapperId: outerWrapperId, minX: outerMinX, minY: outerMinY });
							continue;
						}
						const { minX, minY, maxX, maxY } = boundingBox(childElements);
						const innerWrapperId = uuidv4();
						dispatch({
							id: uuidv4(), type: 'CREATE_ELEMENT', timestamp: Date.now(),
							payload: {
								elementId: innerWrapperId,
								parentId: outerWrapperId,
								pageId,
								elementType: 'div',
								// Position inner wrapper relative to outer wrapper's origin
								position: { x: minX - outerMinX, y: minY - outerMinY },
								size: { width: maxX - minX, height: maxY - minY },
								styles: { display: 'block' }
							}
						});
						groupWrappers.set(childGroupId, { wrapperId: innerWrapperId, minX, minY });
					}
				}
			}
		}
	}

	// Calculate position offset based on whether this is a cut or copy operation
	let offsetX = 0;
	let offsetY = 0;

	// Use custom offset if provided (takes precedence)
	if (customOffset !== undefined) {
		if (customOffset === null) {
			// null means no offset (paste in place)
			offsetX = 0;
			offsetY = 0;
		} else {
			offsetX = customOffset.x;
			offsetY = customOffset.y;
		}
	} else if (isClipboardFromCut) {
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
		// For copied elements, paste at same position (no offset)
		// This makes it clear what was pasted and easy to adjust
		offsetX = 0;
		offsetY = 0;
	}

	// Recursive function to paste an element and its descendants
	// NOTE: Synchronous to avoid await overhead - transaction batches all events
	function pasteElementTree(element: Element, isRoot: boolean): string {
		// Determine new parent ID
		let newParentId: string | null;
		if (element.parentId && oldToNewIdMap.has(element.parentId)) {
			// Parent is in clipboard, use its new ID
			newParentId = oldToNewIdMap.get(element.parentId)!;
		} else if (isRoot) {
			// For root elements, use the determined target parent.
			// If the element's direct groupId has a pre-created wrapper (leaf-group AL case),
			// redirect into that wrapper. Parent groups (groups of groups) have no wrapper —
			// their elements go directly into the AL container.
			const directGid = element.groupId ?? null;
			if (directGid && groupWrappers.has(directGid)) {
				newParentId = groupWrappers.get(directGid)!.wrapperId;
			} else {
				newParentId = targetParentId;
			}
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

			// If this element is going into a pre-created leaf-group wrapper, position it
			// relative to the wrapper's bounding box origin (preserves spatial config).
			const directGidForPos = element.groupId ?? null;
			if (directGidForPos && groupWrappers.has(directGidForPos)) {
				const wrapper = groupWrappers.get(directGidForPos)!;
				position = {
					x: element.position.x - wrapper.minX,
					y: element.position.y - wrapper.minY
				};
			} else {
				const currentState = get(designState);
				const parentElement = currentState.elements[newParentId];

				if (parentElement?.autoLayout?.enabled) {
					// Parent has auto layout -> paste as last child in queue
					// For group wrappers, position at {0,0} preserves children's relative positions
					// For regular elements, position doesn't matter - auto layout will handle it
					position = { x: 0, y: 0 };
				} else if (parentElement) {
					// Parent doesn't have auto layout
					// Check if pasting as sibling (element's original parent matches new parent)
					if (element.parentId === newParentId) {
						// Pasting as sibling in same parent -> maintain position with offset
						position = {
							x: element.position.x + offsetX,
							y: element.position.y + offsetY
						};
					} else {
						// Pasting into different parent -> paste at center of parent
						const rootGidForOffset = element.groupId ? getRootGroupId(element.groupId) : null;
						if (rootGidForOffset && groupOffsets.has(rootGidForOffset)) {
							// Apply group offset while maintaining relative position
							const offset = groupOffsets.get(rootGidForOffset)!;
							position = {
								x: element.position.x + offset.x,
								y: element.position.y + offset.y
							};
						} else {
							// Ungrouped element -> center it
							const centerX = parentElement.size.width / 2 - element.size.width / 2;
							const centerY = parentElement.size.height / 2 - element.size.height / 2;
							position = { x: centerX, y: centerY };
						}
					}
				} else {
					// Fallback if parent not found
					position = { x: element.position.x, y: element.position.y };
				}
			}
		} else {
			// Non-root elements -> maintain their relative position
			position = { x: element.position.x, y: element.position.y };
		}

		// Generate new element ID
		const newElementId = uuidv4();

		// Dispatch CREATE_ELEMENT event (batched in transaction)
		dispatch({
			id: uuidv4(),
			type: 'CREATE_ELEMENT',
			timestamp: Date.now(),
			payload: {
				elementId: newElementId,
				parentId: newParentId,
				pageId,
				elementType: element.type,
				position,
				size: element.size,
				styles: element.styles,
				content: element.content
			}
		});

		// Map old ID to new ID
		oldToNewIdMap.set(element.id, newElementId);

		// Copy additional properties (all dispatched synchronously within transaction)

		// DEPRECATED: No need to preserve isGroupWrapper - groups are just divs now
		// Groups are identified by having children, not by a special flag

		// Preserve element name if set
		if (element.name) {
			dispatch({
				id: uuidv4(),
				type: 'RENAME_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					name: element.name
				}
			});
		}

		// Preserve visibility if explicitly set to false
		if (element.visible === false) {
			dispatch({
				id: uuidv4(),
				type: 'TOGGLE_VISIBILITY',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId
				}
			});
		}

		// Preserve locked state if true
		if (element.locked === true) {
			dispatch({
				id: uuidv4(),
				type: 'TOGGLE_LOCK',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId
				}
			});
		}

		if (Object.keys(element.typography || {}).length > 0) {
			dispatch({
				id: uuidv4(),
				type: 'UPDATE_TYPOGRAPHY',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					typography: element.typography
				}
			});
		}
		if (Object.keys(element.spacing || {}).length > 0) {
			dispatch({
				id: uuidv4(),
				type: 'UPDATE_SPACING',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					spacing: element.spacing
				}
			});
		}
		if (element.autoLayout && Object.keys(element.autoLayout).length > 0) {
			dispatch({
				id: uuidv4(),
				type: 'UPDATE_AUTO_LAYOUT',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					autoLayout: element.autoLayout
				}
			});
		}
		if (element.rotation && element.rotation !== 0) {
			dispatch({
				id: uuidv4(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					rotation: element.rotation
				}
			});
		}
		if (element.alt || element.href || element.src) {
			dispatch({
				id: uuidv4(),
				type: 'UPDATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: newElementId,
					changes: {
						alt: element.alt,
						href: element.href,
						src: element.src
					}
				}
			});
		}
		// Note: groupId will be applied after all elements are pasted
		// (see group recreation logic after the pasteElementTree loop)

		// Recursively paste children (synchronous)
		const children = clipboard.filter(el => el.parentId === element.id);
		for (const child of children) {
			pasteElementTree(child, false);
		}

		return newElementId;
	}

		// Paste all root elements (and their descendants recursively)
		// All synchronous - events batched in transaction for single IndexedDB write
		const newRootElementIds: string[] = [];
		for (const rootElement of rootElements) {
			const newId = pasteElementTree(rootElement, true);
			newRootElementIds.push(newId);
		}

		// Recreate groups: For each old groupId, dispatch a CREATE_GROUP event with all new element IDs
		// that belong to that group, preserving the parent-child hierarchy
		for (const [oldGroupId, newGroupId] of oldToNewGroupIdMap.entries()) {
			// Find all pasted elements that had this groupId in the clipboard
			const elementsInGroup: string[] = [];
			for (const clipboardElement of clipboard) {
				if (clipboardElement.groupId === oldGroupId) {
					const newElementId = oldToNewIdMap.get(clipboardElement.id);
					if (newElementId) {
						elementsInGroup.push(newElementId);
					}
				}
			}

			// Get the original group from clipboard
			const originalGroup = clipboardGroups[oldGroupId];

			// Check if this group has child groups (via parentGroupId references)
			const hasChildGroups = Object.values(clipboardGroups).some(g => g.parentGroupId === oldGroupId);

			// If this is a parent group (has child groups but no direct elements),
			// populate elementIds with all elements from child groups
			if (hasChildGroups && elementsInGroup.length === 0) {
				// Get all child group IDs
				const childGroupIds = Object.keys(clipboardGroups).filter(id =>
					clipboardGroups[id].parentGroupId === oldGroupId
				);

				// Collect all elements from child groups
				for (const childGroupId of childGroupIds) {
					for (const clipboardElement of clipboard) {
						if (clipboardElement.groupId === childGroupId) {
							const newElementId = oldToNewIdMap.get(clipboardElement.id);
							if (newElementId && !elementsInGroup.includes(newElementId)) {
								elementsInGroup.push(newElementId);
							}
						}
					}
				}
			}

			// Create the group if it has elements OR if it has child groups (parent groups)
			if (elementsInGroup.length > 0 || hasChildGroups) {
				// If the original group had a parent group, map it to the new parent group ID
				let newParentGroupId: string | undefined;
				if (originalGroup?.parentGroupId) {
					newParentGroupId = oldToNewGroupIdMap.get(originalGroup.parentGroupId);
				}

				dispatch({
					id: uuidv4(),
					type: 'CREATE_GROUP',
					timestamp: Date.now(),
					payload: {
						groupId: newGroupId,
						elementIds: elementsInGroup,
						parentGroupId: newParentGroupId
					}
				});
			}
		}

		// Commit the transaction (batches all events into single undo/redo step + single IndexedDB write)
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
 * Duplicate selected elements
 */
export async function duplicateElements(customOffset?: { x: number; y: number } | null): Promise<void> {
	copyElements();
	// If no custom offset provided, use default offset of 10px to make duplicates visible
	const offset = customOffset !== undefined ? customOffset : { x: 10, y: 10 };
	await pasteElements(offset);
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
		id: uuidv4(),
		type: 'TOGGLE_VISIBILITY',
		timestamp: Date.now(),
		payload: {
			elementId,
			visible
		}
	});
}

/**
 * Toggle element lock state
 */
export async function toggleLock(elementId: string, locked: boolean): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'TOGGLE_LOCK',
		timestamp: Date.now(),
		payload: {
			elementId,
			locked
		}
	});
}

/**
 * Rename element (set custom name)
 */
export async function renameElement(elementId: string, name: string): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'RENAME_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			name
		}
	});
}

// ============================================================================
// Layer Ordering
// ============================================================================

/**
 * Shift element layer (Z-index equivalent in DOM order)
 * Dispatches the SHIFT_ELEMENT_LAYER event which is handled entirely in the reducer
 */
export async function shiftElementLayer(
	elementId: string,
	direction: 'forward' | 'backward' | 'front' | 'back'
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'SHIFT_ELEMENT_LAYER',
		timestamp: Date.now(),
		payload: {
			elementId,
			direction
		}
	});
}

/**
 * Move selected elements backward (down) one layer
 */
function moveLayerBackward(elements: Element[]): void {
	for (const element of elements) {
		shiftElementLayer(element.id, 'backward');
	}
}

/**
 * Move selected elements forward (up) one layer
 */
function moveLayerForward(elements: Element[]): void {
	for (const element of elements) {
		shiftElementLayer(element.id, 'forward');
	}
}

/**
 * Send selected elements to back (bottom layer)
 */
function sendToBack(elements: Element[]): void {
	for (const element of elements) {
		shiftElementLayer(element.id, 'back');
	}
}

/**
 * Bring selected elements to front (top layer)
 */
function bringToFront(elements: Element[]): void {
	for (const element of elements) {
		shiftElementLayer(element.id, 'front');
	}
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
		// Don't trigger shortcuts if user is typing in an input/textarea/contenteditable
		const target = e.target as HTMLElement;
		const isTyping = target.tagName === 'INPUT' ||
						 target.tagName === 'TEXTAREA' ||
						 target.isContentEditable;


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
		// Cmd+Shift+V (paste inside - as child of selected element)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && e.shiftKey && !isTyping) {
			e.preventDefault();
			pasteElements(undefined, true);
		}
		// Cmd+V (paste as sibling - same level as selected element)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey && !isTyping) {
			e.preventDefault();
			pasteElements(undefined, false);
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
		// [ - Send to back
		else if (e.key === '[' && !e.metaKey && !e.ctrlKey && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				sendToBack(selected);
			}
		}
		// ] - Bring to front
		else if (e.key === ']' && !e.metaKey && !e.ctrlKey && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				bringToFront(selected);
			}
		}
		// Cmd/Ctrl + [ - Move layer backward (down one level)
		else if ((e.metaKey || e.ctrlKey) && e.key === '[' && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				moveLayerBackward(selected);
			}
		}
		// Cmd/Ctrl + ] - Move layer forward (up one level)
		else if ((e.metaKey || e.ctrlKey) && e.key === ']' && !isTyping) {
			e.preventDefault();
			const selected = get(selectedElements);
			if (selected.length > 0) {
				moveLayerForward(selected);
			}
		}
		// Cmd+G - Group selected elements
		if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !isTyping) {
			e.preventDefault();
			groupElements();
			return;
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
				// Delete all selected elements using batched operation (single event for performance)
				deleteElements(selected.map((element) => element.id))
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


/**
 * Clean up orphaned groups (groups with no elements)
 * This should be called periodically or after major operations
 */
export function cleanupOrphanedGroups(): void {
	storeState.update((state) => {
		const newGroups = { ...state.designState.groups };
		let hasChanges = false;

		// Find all groups that have no elements with matching groupId
		for (const [groupId, group] of Object.entries(newGroups)) {
			const hasElements = Object.values(state.designState.elements).some(
				(el) => el.groupId === groupId
			);

			if (!hasElements) {
				delete newGroups[groupId];
				hasChanges = true;
			}
		}

		if (!hasChanges) return state;

		return {
			...state,
			designState: {
				...state.designState,
				groups: newGroups
			}
		};
	});
}

// Expose for E2E testing
if (typeof window !== 'undefined') {
	(window as any).__designStore = {
		get designState() {
			return get(designState);
		},
		createElement,
		rotateElement,
		selectElement,
		selectElements,
		clearSelection,
		cleanupOrphanedGroups
	};
}
