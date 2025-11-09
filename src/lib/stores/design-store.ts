/**
 * Design Store - Svelte store wrapping the event sourcing system
 *
 * This is the main API for interacting with the design system.
 * It provides a reactive Svelte store and action dispatchers.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import type { DesignEvent, DesignState, Element, Page, Component } from '$lib/types/events';
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
 * Dispatch a new event and update the design state
 */
async function dispatch(event: DesignEvent): Promise<void> {
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
 * Undo the last event
 */
export function undo(): void {
	const state = get(storeState);

	if (state.currentEventIndex <= -1) {
		return; // Nothing to undo
	}

	const newEventIndex = state.currentEventIndex - 1;
	const eventsToApply = state.events.slice(0, newEventIndex + 1);
	const newDesignState = reduceEvents(eventsToApply);

	storeState.update((s) => ({
		...s,
		designState: newDesignState,
		currentEventIndex: newEventIndex
	}));
}

/**
 * Redo the next event
 */
export function redo(): void {
	const state = get(storeState);

	if (state.currentEventIndex >= state.events.length - 1) {
		return; // Nothing to redo
	}

	const newEventIndex = state.currentEventIndex + 1;
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

	await dispatch({
		id: uuidv4(),
		type: 'CREATE_ELEMENT',
		timestamp: Date.now(),
		payload: {
			elementId,
			...data
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

export async function toggleFrame(
	elementId: string,
	isFrame: boolean,
	frameName?: string,
	breakpointWidth?: number
): Promise<void> {
	await dispatch({
		id: uuidv4(),
		type: 'TOGGLE_FRAME',
		timestamp: Date.now(),
		payload: {
			elementId,
			isFrame,
			frameName,
			breakpointWidth
		}
	});
}

// ============================================================================
// Selection
// ============================================================================

export function selectElement(elementId: string): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			selectedElementIds: [elementId]
		}
	}));
}

export function selectElements(elementIds: string[]): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			selectedElementIds: elementIds
		}
	}));
}

export function addToSelection(elementId: string): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			selectedElementIds: [...state.designState.selectedElementIds, elementId]
		}
	}));
}

export function removeFromSelection(elementId: string): void {
	storeState.update((state) => ({
		...state,
		designState: {
			...state.designState,
			selectedElementIds: state.designState.selectedElementIds.filter((id) => id !== elementId)
		}
	}));
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

/**
 * Copy selected elements to clipboard
 */
export function copyElements(): void {
	const selected = get(selectedElements);
	if (selected.length === 0) return;

	// Clone elements (deep copy)
	clipboard = selected.map((el) => ({ ...el }));
}

/**
 * Paste elements from clipboard
 */
export async function pasteElements(): Promise<void> {
	if (clipboard.length === 0) return;

	const state = get(designState);
	const pageId = state.currentPageId;
	if (!pageId) return;

	// Clear selection first
	clearSelection();

	const newElementIds: string[] = [];

	// Paste each element with a small offset
	for (const element of clipboard) {
		const newElementId = await createElement({
			parentId: element.parentId,
			pageId,
			elementType: element.type,
			position: {
				x: element.position.x + 20, // Offset by 20px
				y: element.position.y + 20
			},
			size: element.size,
			styles: element.styles,
			content: element.content
		});

		newElementIds.push(newElementId);

		// Copy typography and spacing if they exist
		if (Object.keys(element.typography || {}).length > 0) {
			await updateElementTypography(newElementId, element.typography);
		}
		if (Object.keys(element.spacing || {}).length > 0) {
			await updateElementSpacing(newElementId, element.spacing);
		}

		// Copy rotation if it exists
		if (element.rotation && element.rotation !== 0) {
			await rotateElement(newElementId, element.rotation);
		}

		// Copy other properties
		if (element.alt || element.href || element.src) {
			await updateElement(newElementId, {
				alt: element.alt,
				href: element.href,
				src: element.src
			});
		}
	}

	// Select the newly pasted elements
	selectElements(newElementIds);
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
// Keyboard Shortcuts
// ============================================================================

/**
 * Setup keyboard shortcuts for undo/redo
 * Call this in your root layout
 */
export function setupKeyboardShortcuts(): (() => void) | undefined {
	if (typeof window === 'undefined') return;

	const textElementTypes = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label']);

	const getTextShortcutCommand = (e: KeyboardEvent):
		| 'bold'
		| 'italic'
		| 'underline'
		| 'strikeThrough'
		| 'insertOrderedList'
		| 'insertUnorderedList'
		| 'justifyLeft'
		| 'justifyCenter'
		| 'justifyRight'
		| 'justifyFull'
		| null => {
		if (!(e.metaKey || e.ctrlKey)) {
			return null;
		}

		const key = e.key.toLowerCase();
		const { shiftKey } = e;

		if (!shiftKey) {
			if (key === 'b') return 'bold';
			if (key === 'i') return 'italic';
			if (key === 'u') return 'underline';
			return null;
		}

		if (key === 'x') return 'strikeThrough';

		switch (key) {
			case 'l':
				return 'justifyLeft';
			case 'e':
				return 'justifyCenter';
			case 'r':
				return 'justifyRight';
			case 'j':
				return 'justifyFull';
			default:
		}

		if (e.code === 'Digit7') return 'insertOrderedList';
		if (e.code === 'Digit8') return 'insertUnorderedList';

		return null;
	};

	const applyTextShortcutToSelection = (command: NonNullable<ReturnType<typeof getTextShortcutCommand>>) => {
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

			document.execCommand(command);

			editor.blur();
		};

		requestAnimationFrame(execute);
		return true;
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		// Don't trigger shortcuts if user is typing in an input/textarea
		const target = e.target as HTMLElement;
		const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

		const textCommand = getTextShortcutCommand(e);
		if (!isTyping && textCommand) {
			const applied = applyTextShortcutToSelection(textCommand);
			if (applied) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
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
		// Cmd+V (paste)
		else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !isTyping) {
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
