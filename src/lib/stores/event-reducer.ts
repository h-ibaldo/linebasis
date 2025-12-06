/**
 * Event Reducer - Computes design state from events
 *
 * This is a pure function that takes a list of events and produces
 * the current design state. This allows us to replay events for undo/redo
 * and to reconstruct state from the event log.
 */

import { produce } from 'immer';
import type {
	DesignEvent,
	DesignState,
	Element,
	Page,
	Group,
	Component,
	CreateElementEvent,
	UpdateElementEvent,
	DeleteElementEvent,
	GroupDeleteElementsEvent,
	MoveElementEvent,
	ResizeElementEvent,
	RotateElementEvent,
	ReorderElementEvent,
	ShiftElementLayerEvent,
	ToggleViewEvent,
	ToggleVisibilityEvent,
	ToggleLockEvent,
	RenameElementEvent,
	GroupMoveElementsEvent,
	GroupResizeElementsEvent,
	GroupRotateElementsEvent,
	GroupUpdateStylesEvent,
	// GroupElementsEvent, // DEPRECATED
	// UngroupElementsEvent, // DEPRECATED
	// CreateGroupWrapperEvent, // DEPRECATED
	UpdateStylesEvent,
	UpdateTypographyEvent,
	UpdateSpacingEvent,
	UpdateAutoLayoutEvent,
	CreatePageEvent,
	UpdatePageEvent,
	DeletePageEvent,
	ReorderPagesEvent,
	CreateComponentEvent,
	UpdateComponentEvent,
	DeleteComponentEvent,
	InstanceComponentEvent,
	MigrateToUnifiedPositioningEvent
} from '$lib/types/events';
import { invalidateTransformCache } from '$lib/utils/coordinates';

/**
 * Initial empty state
 */
export function getInitialState(): DesignState {
	return {
		pages: {},
		elements: {},
		groups: {},
		components: {},
		pageOrder: [],
		currentPageId: null,
		selectedElementIds: []
	};
}

/**
 * Reduce a list of events into the current design state
 */
export function reduceEvents(events: DesignEvent[], initialState?: DesignState): DesignState {
	let state = initialState || getInitialState();

	for (const event of events) {
		state = reduceEvent(state, event);
	}

	return state;
}

/**
 * Apply new events incrementally to existing state (OPTIMIZED for transactions)
 * Uses Immer for efficient structural sharing - only mutates changed parts
 *
 * This is 5-10x faster than reduceEvents() because it doesn't rebuild the entire state.
 * Use this in commitTransaction() when you have an existing state and new events.
 */
export function applyEventsIncremental(
	currentState: DesignState,
	newEvents: DesignEvent[]
): DesignState {
	// Use Immer's produce for efficient immutable updates
	return produce(currentState, draft => {
		for (const event of newEvents) {
			// Apply each event to the draft state
			// Immer handles structural sharing automatically
			applyEventMutable(draft, event);
		}
	});
}

/**
 * Apply a single event to a mutable draft state (used by Immer)
 * This mutates the draft directly for maximum performance
 */
function applyEventMutable(draft: DesignState, event: DesignEvent): void {
	// Delegate to existing handlers but allow mutation
	// The handlers already return new state objects, but Immer will track changes
	const updated = reduceEvent(draft as DesignState, event);

	// Copy all changed properties back to draft
	Object.assign(draft, updated);
}

/**
 * Reduce a single event
 */
export function reduceEvent(state: DesignState, event: DesignEvent): DesignState {
	switch (event.type) {
		// Element operations
		case 'CREATE_ELEMENT':
			return handleCreateElement(state, event);
		case 'UPDATE_ELEMENT':
			return handleUpdateElement(state, event);
		case 'DELETE_ELEMENT':
			return handleDeleteElement(state, event);
		case 'GROUP_DELETE_ELEMENTS':
			return handleGroupDeleteElements(state, event);
		case 'MOVE_ELEMENT':
			return handleMoveElement(state, event);
		case 'RESIZE_ELEMENT':
			return handleResizeElement(state, event);
		case 'ROTATE_ELEMENT':
			return handleRotateElement(state, event);
		case 'REORDER_ELEMENT':
			return handleReorderElement(state, event);
		case 'SHIFT_ELEMENT_LAYER':
			return handleShiftElementLayer(state, event);
		case 'TOGGLE_VIEW':
			return handleToggleView(state, event);
		case 'TOGGLE_VISIBILITY':
			return handleToggleVisibility(state, event);
		case 'TOGGLE_LOCK':
			return handleToggleLock(state, event);
		case 'RENAME_ELEMENT':
			return handleRenameElement(state, event);
		case 'GROUP_MOVE_ELEMENTS':
			return handleGroupMoveElements(state, event);
		case 'GROUP_RESIZE_ELEMENTS':
			return handleGroupResizeElements(state, event);
		case 'GROUP_ROTATE_ELEMENTS':
			return handleGroupRotateElements(state, event);
		case 'GROUP_UPDATE_STYLES':
			return handleGroupUpdateStyles(state, event);

		// Group operations (DEPRECATED - groups are now regular divs)
		// case 'GROUP_ELEMENTS':
		// 	return handleGroupElements(state, event);
		// case 'UNGROUP_ELEMENTS':
		// 	return handleUngroupElements(state, event);
		// case 'CREATE_GROUP_WRAPPER':
		// 	return handleCreateGroupWrapper(state, event);

		// Style operations
		case 'UPDATE_STYLES':
			return handleUpdateStyles(state, event);
		case 'UPDATE_TYPOGRAPHY':
			return handleUpdateTypography(state, event);
		case 'UPDATE_SPACING':
			return handleUpdateSpacing(state, event);
		case 'UPDATE_AUTO_LAYOUT':
			return handleUpdateAutoLayout(state, event);

		// Page operations
		case 'CREATE_PAGE':
			return handleCreatePage(state, event);
		case 'UPDATE_PAGE':
			return handleUpdatePage(state, event);
		case 'DELETE_PAGE':
			return handleDeletePage(state, event);
		case 'REORDER_PAGES':
			return handleReorderPages(state, event);

		// Component operations
		case 'CREATE_COMPONENT':
			return handleCreateComponent(state, event);
		case 'UPDATE_COMPONENT':
			return handleUpdateComponent(state, event);
		case 'DELETE_COMPONENT':
			return handleDeleteComponent(state, event);
		case 'INSTANCE_COMPONENT':
			return handleInstanceComponent(state, event);

		// Migration operations
		case 'MIGRATE_TO_UNIFIED_POSITIONING':
			return handleMigrateToUnifiedPositioning(state, event);

		default:
			return state;
	}
}

// ============================================================================
// Element Handlers
// ============================================================================

function handleCreateElement(state: DesignState, event: CreateElementEvent): DesignState {
	const { elementId, parentId, pageId, elementType, position, size, styles, content } =
		event.payload;

	// New elements are added to end of array (visual top layer)
	// Array position determines stacking: index 0 = bottom, last = top
	// LAYERS ARE DOM POSITION - no zIndex needed

	const element: Element = {
		id: elementId,
		type: elementType,
		parentId,
		pageId,
		positionMode: 'absolute', // Default: absolute positioning
		position,
		size,
		styles: styles || {},
		typography: {},
		spacing: {},
		autoLayout: {},
		content,
		children: []
	};

	// Add element to state
	const newElements = { ...state.elements, [elementId]: element };

	// Add element to parent's children if it has a parent
	if (parentId && newElements[parentId]) {
		newElements[parentId] = {
			...newElements[parentId],
			children: [...newElements[parentId].children, elementId]
		};
	}

	// Add element to page's canvas if it's a root element (no parent)
	const newPages = { ...state.pages };
	if (!parentId && newPages[pageId]) {
		newPages[pageId] = {
			...newPages[pageId],
			canvasElements: [...newPages[pageId].canvasElements, elementId]
		};
	}

	return {
		...state,
		elements: newElements,
		pages: newPages
	};
}

function handleUpdateElement(state: DesignState, event: UpdateElementEvent): DesignState {
	const { elementId, changes } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				...changes
			}
		}
	};
}

function handleDeleteElement(state: DesignState, event: DeleteElementEvent): DesignState {
	const { elementId } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	const newElements = { ...state.elements };
	const newPages = { ...state.pages };

	// Remove from parent's children
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	}

	// Remove from page's canvas if it's a root element
	if (!element.parentId && newPages[element.pageId]) {
		newPages[element.pageId] = {
			...newPages[element.pageId],
			canvasElements: newPages[element.pageId].canvasElements.filter((id) => id !== elementId)
		};
	}

	// Recursively delete children
	const deleteRecursive = (id: string) => {
		const el = newElements[id];
		if (el) {
			el.children.forEach(deleteRecursive);
			delete newElements[id];
		}
	};

	element.children.forEach(deleteRecursive);
	delete newElements[elementId];

	// Remove from selection
	const newSelectedElementIds = state.selectedElementIds.filter((id) => id !== elementId);

	// If this is a group wrapper, also delete the group record
	let newGroups = state.groups;
	if (element.isGroupWrapper) {
		const groupEntry = Object.entries(state.groups).find(([_, group]) => group.wrapperId === elementId);
		if (groupEntry) {
			const [groupId] = groupEntry;
			newGroups = { ...state.groups };
			delete newGroups[groupId];
		}
	}

	return {
		...state,
		elements: newElements,
		pages: newPages,
		groups: newGroups,
		selectedElementIds: newSelectedElementIds
	};
}

function handleGroupDeleteElements(state: DesignState, event: GroupDeleteElementsEvent): DesignState {
	const { elementIds } = event.payload;

	// Clone state objects once
	const newElements = { ...state.elements };
	const newPages = { ...state.pages };

	// Collect all element IDs to delete (including descendants)
	const idsToDelete = new Set<string>();

	// Recursively collect all descendants
	const collectDescendants = (id: string) => {
		const el = newElements[id];
		if (el && !idsToDelete.has(id)) {
			idsToDelete.add(id);
			el.children.forEach(collectDescendants);
		}
	};

	// Collect all elements and their descendants
	elementIds.forEach(collectDescendants);

	// Build sets of elements to remove by parent and page for efficient filtering
	const elementsByParent = new Map<string | null, Set<string>>();
	const elementsByPage = new Map<string, Set<string>>();

	for (const id of idsToDelete) {
		const element = newElements[id];
		if (!element) continue;

		// Track by parent
		if (!elementsByParent.has(element.parentId)) {
			elementsByParent.set(element.parentId, new Set());
		}
		elementsByParent.get(element.parentId)!.add(id);

		// Track by page (only for root elements)
		if (!element.parentId) {
			if (!elementsByPage.has(element.pageId)) {
				elementsByPage.set(element.pageId, new Set());
			}
			elementsByPage.get(element.pageId)!.add(id);
		}
	}

	// Update parent elements - remove deleted children in one pass per parent
	for (const [parentId, childIds] of elementsByParent.entries()) {
		if (parentId && newElements[parentId]) {
			newElements[parentId] = {
				...newElements[parentId],
				children: newElements[parentId].children.filter(id => !childIds.has(id))
			};
		}
	}

	// Update pages - remove deleted root elements in one pass per page
	for (const [pageId, rootIds] of elementsByPage.entries()) {
		if (newPages[pageId]) {
			newPages[pageId] = {
				...newPages[pageId],
				canvasElements: newPages[pageId].canvasElements.filter(id => !rootIds.has(id))
			};
		}
	}

	// Delete all elements
	for (const id of idsToDelete) {
		delete newElements[id];
	}

	// Remove from selection
	const newSelectedElementIds = state.selectedElementIds.filter(id => !idsToDelete.has(id));

	// Check if any deleted elements were group wrappers or if all group elements are being deleted
	let newGroups = state.groups;
	const groupsToCheck = new Set<string>();

	// First, check if any deleted elements are wrappers
	for (const id of idsToDelete) {
		const element = state.elements[id]; // Use original state to check
		if (element?.isGroupWrapper) {
			const groupEntry = Object.entries(state.groups).find(([_, group]) => group.wrapperId === id);
			if (groupEntry) {
				const [groupId] = groupEntry;
				groupsToCheck.add(groupId);
			}
		} else if (element?.groupId) {
			// Track groups that have elements being deleted
			groupsToCheck.add(element.groupId);
		}
	}

	// For each affected group, check if all elements are being deleted
	for (const groupId of groupsToCheck) {
		const group = state.groups[groupId];
		if (!group) continue;

		// Check if all group elements are being deleted
		const allElementsDeleted = group.elementIds.every(id => idsToDelete.has(id));

		if (allElementsDeleted) {
			// All group elements are being deleted - also delete the wrapper if it exists
			if (group.wrapperId && !idsToDelete.has(group.wrapperId)) {
				// Wrapper is not in the deletion list, add it
				const wrapper = newElements[group.wrapperId];
				if (wrapper) {
					idsToDelete.add(group.wrapperId);

					// Remove wrapper from parent's children or page's canvasElements
					if (wrapper.parentId && newElements[wrapper.parentId]) {
						newElements[wrapper.parentId] = {
							...newElements[wrapper.parentId],
							children: newElements[wrapper.parentId].children.filter(id => id !== group.wrapperId)
						};
					} else if (!wrapper.parentId && newPages[wrapper.pageId]) {
						newPages[wrapper.pageId] = {
							...newPages[wrapper.pageId],
							canvasElements: newPages[wrapper.pageId].canvasElements.filter(id => id !== group.wrapperId)
						};
					}

					// Delete the wrapper element
					delete newElements[group.wrapperId];
				}
			}

			// Delete the group record
			if (newGroups === state.groups) {
				newGroups = { ...state.groups };
			}
			delete newGroups[groupId];
		} else if (group.wrapperId && idsToDelete.has(group.wrapperId)) {
			// Wrapper is being deleted - delete the group record
			if (newGroups === state.groups) {
				newGroups = { ...state.groups };
			}
			delete newGroups[groupId];
		}
	}

	return {
		...state,
		elements: newElements,
		pages: newPages,
		groups: newGroups,
		selectedElementIds: newSelectedElementIds
	};
}

function handleMoveElement(state: DesignState, event: MoveElementEvent): DesignState {
	const { elementId, position } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	// Invalidate transform cache for element and all descendants
	invalidateTransformCache(elementId, state);

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				position
			}
		}
	};
}

function handleResizeElement(state: DesignState, event: ResizeElementEvent): DesignState {
	const { elementId, size, position } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	// Invalidate transform cache for element and all descendants
	// (resize changes bounding box which affects child transforms in rotated parents)
	invalidateTransformCache(elementId, state);

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				size,
				// Update position if provided (for N/W handles)
				...(position && { position })
			}
		}
	};
}

function handleRotateElement(state: DesignState, event: RotateElementEvent): DesignState {
	const { elementId, rotation } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	// Invalidate transform cache for element and all descendants
	// (rotation affects all child transforms)
	invalidateTransformCache(elementId, state);

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				rotation
			}
		}
	};
}

function handleReorderElement(state: DesignState, event: ReorderElementEvent): DesignState {
	const { elementId, newParentId, newIndex } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	const newElements = { ...state.elements };
	const newPages = { ...state.pages };

	// Remove from old parent
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	} else if (!element.parentId && newPages[element.pageId]) {
		// Remove from page's canvas
		newPages[element.pageId] = {
			...newPages[element.pageId],
			canvasElements: newPages[element.pageId].canvasElements.filter((id) => id !== elementId)
		};
	}

	// Update element parent (parentId only - pageId stays the same)
	// newIndex is used for array position insertion (not z-index)
	newElements[elementId] = {
		...element,
		parentId: newParentId
	};

	// Add to new parent
	if (newParentId && newElements[newParentId]) {
		const children = [...newElements[newParentId].children];
		children.splice(newIndex, 0, elementId);
		newElements[newParentId] = {
			...newElements[newParentId],
			children
		};
	} else if (!newParentId && newPages[element.pageId]) {
		// Add to page's canvas
		const canvasElements = [...newPages[element.pageId].canvasElements];
		canvasElements.splice(newIndex, 0, elementId);
		newPages[element.pageId] = {
			...newPages[element.pageId],
			canvasElements
		};
	}

	return {
		...state,
		elements: newElements,
		pages: newPages
	};
}

function handleShiftElementLayer(state: DesignState, event: ShiftElementLayerEvent): DesignState {
	const { elementId, direction } = event.payload;
	const element = state.elements[elementId];

	if (!element) {
		return state;
	}

	const newElements = { ...state.elements };

	// Check if element is nested in a parent
	if (element.parentId && state.elements[element.parentId]) {
		// Nested element - reorder within parent's children array
		const parent = state.elements[element.parentId];
		const siblings = [...parent.children];
		const currentIndex = siblings.indexOf(elementId);
		
		if (currentIndex === -1) return state;
		
		siblings.splice(currentIndex, 1);
		
		let newIndex = currentIndex;
		const maxIndex = siblings.length;
		
		switch (direction) {
			case 'backward':
				newIndex = Math.max(0, currentIndex - 1);
				break;
			case 'forward':
				newIndex = Math.min(maxIndex, currentIndex + 1);
				break;
			case 'back':
				newIndex = 0;
				break;
			case 'front':
				newIndex = maxIndex;
				break;
		}
		
		siblings.splice(newIndex, 0, elementId);
		
		newElements[element.parentId] = {
			...parent,
			children: siblings
		};
		
		return {
			...state,
			elements: newElements
		};
	}

	// Check if element is a root canvas element
	if (element.pageId && state.pages[element.pageId]) {
		const page = state.pages[element.pageId];
		const newPages = { ...state.pages };
		const siblings = [...page.canvasElements];
		const currentIndex = siblings.indexOf(elementId);

		if (currentIndex === -1) return state;

		siblings.splice(currentIndex, 1);

		let newIndex = currentIndex;
		const maxIndex = siblings.length;

		switch (direction) {
			case 'backward':
				newIndex = Math.max(0, currentIndex - 1);
				break;
			case 'forward':
				newIndex = Math.min(maxIndex, currentIndex + 1);
				break;
			case 'back':
				newIndex = 0;
				break;
			case 'front':
				newIndex = maxIndex;
				break;
		}

		siblings.splice(newIndex, 0, elementId);

		newPages[element.pageId] = {
			...page,
			canvasElements: siblings
		};

		return {
			...state,
			elements: newElements,
			pages: newPages
		};
	}

	// CRITICAL ERROR: No page found for root element
	// LAYERS ARE DOM POSITION - root elements MUST belong to a page
	// This should never happen if the system is properly initialized
	console.error(
		`❌ CRITICAL: Element "${elementId}" is a root element but has no page.`,
		"LAYERS ARE DOM POSITION. Root elements MUST belong to a page's canvas to have a DOM order.",
		"Element data:", element
	);

	// Return state unchanged - do not attempt zIndex fallback
	return state;
}

// Helper function to calculate bounding box of group elements (accounting for rotation)
function calculateGroupBounds(groupElements: Element[]): { x: number; y: number; width: number; height: number } {
	if (groupElements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const el of groupElements) {
		const rotation = el.rotation || 0;

		if (rotation !== 0) {
			// For rotated elements, calculate all four corners
			const angleRad = rotation * (Math.PI / 180);
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);

			const width = el.size.width || 0;
			const height = el.size.height || 0;
			const centerX = el.position.x + width / 2;
			const centerY = el.position.y + height / 2;

			// Local corners (relative to center)
			const halfW = width / 2;
			const halfH = height / 2;
			const localCorners = [
				{ x: -halfW, y: -halfH }, // Top-left
				{ x: halfW, y: -halfH },  // Top-right
				{ x: halfW, y: halfH },   // Bottom-right
				{ x: -halfW, y: halfH }   // Bottom-left
			];

			// Rotate each corner around center
			for (const corner of localCorners) {
				const worldX = centerX + corner.x * cos - corner.y * sin;
				const worldY = centerY + corner.x * sin + corner.y * cos;
				minX = Math.min(minX, worldX);
				minY = Math.min(minY, worldY);
				maxX = Math.max(maxX, worldX);
				maxY = Math.max(maxY, worldY);
			}
		} else {
			// Non-rotated elements use simple bounds
			minX = Math.min(minX, el.position.x);
			minY = Math.min(minY, el.position.y);
			maxX = Math.max(maxX, el.position.x + (el.size.width || 0));
			maxY = Math.max(maxY, el.position.y + (el.size.height || 0));
		}
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}

// Helper function to update wrapper bounds for a group
function updateWrapperBounds(
	newElements: Record<string, Element>,
	groups: Record<string, Group>,
	group: Group
): void {
	if (!group.wrapperId) return; // Old-style group without wrapper

	const wrapper = newElements[group.wrapperId];
	if (!wrapper) return;

	// Get all group elements
	const groupElements = group.elementIds
		.map(id => newElements[id])
		.filter(Boolean);

	if (groupElements.length === 0) return;

	// Calculate new bounding box (relative to current wrapper position)
	const bounds = calculateGroupBounds(groupElements);

	// The bounding box should start at (0, 0) relative to the wrapper
	// If it doesn't, we need to adjust the wrapper position and element positions
	const deltaX = bounds.x; // How much to shift wrapper and elements
	const deltaY = bounds.y;

	// Calculate new wrapper position (move by delta to keep bounding box at origin)
	const newWrapperPosition = {
		x: wrapper.position.x + deltaX,
		y: wrapper.position.y + deltaY
	};

	// Update wrapper position and size
	newElements[group.wrapperId] = {
		...wrapper,
		position: newWrapperPosition,
		size: { width: bounds.width, height: bounds.height }
	};

	// Adjust element positions to be relative to new wrapper position
	// (subtract delta so bounding box starts at (0, 0) relative to wrapper)
	for (const el of groupElements) {
		newElements[el.id] = {
			...el,
			position: {
				x: el.position.x - deltaX,
				y: el.position.y - deltaY
			}
		};
	}
}

function handleGroupMoveElements(state: DesignState, event: GroupMoveElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };
	const newGroups = { ...state.groups };

	// Track which groups need wrapper updates
	const groupsToUpdate = new Set<string>();

	// Update all elements atomically
	for (const { elementId, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				position
			};

			// Track groups that contain this element
			if (element.groupId) {
				groupsToUpdate.add(element.groupId);
			}
		}
	}

	// Update wrapper bounds for all affected groups
	for (const groupId of groupsToUpdate) {
		const group = newGroups[groupId];
		if (group) {
			updateWrapperBounds(newElements, newGroups, group);
		}
	}

	return {
		...state,
		elements: newElements,
		groups: newGroups
	};
}

function handleGroupResizeElements(state: DesignState, event: GroupResizeElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };
	const newGroups = { ...state.groups };

	// Track which groups need wrapper updates
	const groupsToUpdate = new Set<string>();

	// Update all elements atomically
	for (const { elementId, size, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				size,
				...(position && { position })
			};

			// Track groups that contain this element
			if (element.groupId) {
				groupsToUpdate.add(element.groupId);
			}
		}
	}

	// Update wrapper bounds for all affected groups
	for (const groupId of groupsToUpdate) {
		const group = newGroups[groupId];
		if (group) {
			updateWrapperBounds(newElements, newGroups, group);
		}
	}

	return {
		...state,
		elements: newElements,
		groups: newGroups
	};
}

function handleGroupRotateElements(state: DesignState, event: GroupRotateElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };
	const newGroups = { ...state.groups };

	// Track which groups need wrapper updates
	const groupsToUpdate = new Set<string>();

	// Update all elements atomically
	for (const { elementId, rotation, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				rotation,
				position
			};

			// Track groups that contain this element
			if (element.groupId) {
				groupsToUpdate.add(element.groupId);
			}
		}
	}

	// Update wrapper bounds for all affected groups
	for (const groupId of groupsToUpdate) {
		const group = newGroups[groupId];
		if (group) {
			updateWrapperBounds(newElements, newGroups, group);
		}
	}

	return {
		...state,
		elements: newElements,
		groups: newGroups
	};
}

function handleGroupUpdateStyles(state: DesignState, event: GroupUpdateStylesEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };

	// Update all elements atomically
	for (const { elementId, styles } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				styles: {
					...element.styles,
					...styles
				}
			};
		}
	}

	return {
		...state,
		elements: newElements
	};
}

// ============================================================================
// Group Handlers
// ============================================================================

// DEPRECATED: Group handlers removed - groups are now regular divs
/*
function handleGroupElements(state: DesignState, event: GroupElementsEvent): DesignState {
	const { groupId, elementIds } = event.payload;

	// Check if group already exists - if so, add elements to it instead of replacing
	const existingGroup = state.groups[groupId];
	const group: Group = existingGroup
		? {
				id: groupId,
				elementIds: [...existingGroup.elementIds, ...elementIds]
		  }
		: {
				id: groupId,
				elementIds
		  };

	const elementsToGroup = elementIds
		.map(id => state.elements[id])
		.filter(Boolean);

	if (elementsToGroup.length === 0) return state;

	// Check if elements have a common parent
	const parentId = elementsToGroup[0].parentId;
	const allSameParent = elementsToGroup.every(el => el.parentId === parentId);

	let newPages = state.pages;
	let newElements = { ...state.elements };

	if (allSameParent && parentId) {
		// Elements have a parent - reorder in parent's children array
		const parent = state.elements[parentId];
		if (parent) {
			const allChildIds = [...parent.children];

			// Find the highest array position (topmost layer) among grouped elements
			const groupedIndices = elementIds.map(id => allChildIds.indexOf(id)).filter(i => i !== -1);
			const topmostIndex = Math.max(...groupedIndices);

			// Remove grouped element IDs
			const filteredChildIds = allChildIds.filter(id => !elementIds.includes(id));

			// Insert grouped elements as a sequence at the topmost position
			// Elements inserted maintain their relative order from elementIds array
			const newChildIds = [
				...filteredChildIds.slice(0, topmostIndex),
				...elementIds,
				...filteredChildIds.slice(topmostIndex)
			];

			// Update parent's children array
			newElements[parentId] = {
				...parent,
				children: newChildIds
			};
		}
	} else if (allSameParent && !parentId) {
		// Root elements - reorder in page's canvasElements array
		const pageId = elementsToGroup[0].pageId;
		const page = state.pages[pageId];

		if (page) {
			const allRootIds = [...page.canvasElements];

			// Find the highest array position (topmost layer) among grouped elements
			const groupedIndices = elementIds.map(id => allRootIds.indexOf(id)).filter(i => i !== -1);
			const topmostIndex = Math.max(...groupedIndices);

			// Remove grouped element IDs
			const filteredRootIds = allRootIds.filter(id => !elementIds.includes(id));

			// Insert grouped elements as a sequence at the topmost position
			// Elements inserted maintain their relative order from elementIds array
			const newRootIds = [
				...filteredRootIds.slice(0, topmostIndex),
				...elementIds,
				...filteredRootIds.slice(topmostIndex)
			];

			// Update page's canvasElements array
			newPages = {
				...state.pages,
				[pageId]: {
					...page,
					canvasElements: newRootIds
				}
			};
		}
	}

	// Update elements to reference the group (no z-index needed)
	elementsToGroup.forEach((element) => {
		newElements[element.id] = {
			...element,
			groupId
		};
	});

	// Check if all elements share a group wrapper as parent
	// If so, set wrapperId on the group
	let wrapperId: string | undefined = undefined;
	if (allSameParent && parentId) {
		const parent = newElements[parentId];
		if (parent?.isGroupWrapper) {
			wrapperId = parentId;
		}
	}

	// Update or create the group with wrapperId if applicable
	const finalGroup: Group = wrapperId
		? { ...group, wrapperId }
		: group;

	return {
		...state,
		groups: {
			...state.groups,
			[groupId]: finalGroup
		},
		elements: newElements,
		pages: newPages
	};
}

function handleUngroupElements(state: DesignState, event: UngroupElementsEvent): DesignState {
	const { groupId } = event.payload;
	const group = state.groups[groupId];

	if (!group) return state;

	const newElements = { ...state.elements };
	let newPages = state.pages;

	// Check if this is a new-style group with wrapper
	if (group.wrapperId) {
		const wrapper = newElements[group.wrapperId];

		if (wrapper) {
			// Move children out of wrapper to wrapper's parent
			for (const memberId of group.elementIds) {
				const member = newElements[memberId];
				if (member) {
					// Calculate absolute position (member position + wrapper position)
					const absolutePos = {
						x: member.position.x + wrapper.position.x,
						y: member.position.y + wrapper.position.y
					};

					newElements[memberId] = {
						...member,
						groupId: null,
						parentId: wrapper.parentId,
						position: absolutePos
					};
				}
			}

			// Remove wrapper from parent's children array or page's canvasElements
			if (wrapper.parentId && newElements[wrapper.parentId]) {
				const parent = newElements[wrapper.parentId];
				newElements[wrapper.parentId] = {
					...parent,
					children: parent.children
						.filter(id => id !== group.wrapperId)
						.concat(group.elementIds)
				};
			} else {
				// Root level - update page's canvasElements
				const page = state.pages[wrapper.pageId];
				if (page) {
					newPages = {
						...state.pages,
						[wrapper.pageId]: {
							...page,
							canvasElements: page.canvasElements
								.filter(id => id !== group.wrapperId)
								.concat(group.elementIds)
						}
					};
				}
			}

			// Delete the wrapper element
			delete newElements[group.wrapperId];
		}
	} else {
		// Old-style group (no wrapper) - just remove groupId from elements
		for (const elementId of group.elementIds) {
			const element = newElements[elementId];
			if (element) {
				newElements[elementId] = {
					...element,
					groupId: null
				};
			}
		}
	}

	// Delete the group
	const newGroups = { ...state.groups };
	delete newGroups[groupId];

	return {
		...state,
		groups: newGroups,
		elements: newElements,
		pages: newPages
	};
}

function handleCreateGroupWrapper(state: DesignState, event: CreateGroupWrapperEvent): DesignState {
	const { groupId, wrapperId, elementIds, wrapperPosition, wrapperSize, memberOffsets, parentId, pageId } = event.payload;

	const newElements = { ...state.elements };
	let newPages = state.pages;

	// Check if wrapper already exists (e.g., during paste operation)
	const existingWrapper = state.elements[wrapperId];
	if (!existingWrapper) {
		// Create the wrapper element
		const wrapper: Element = {
			id: wrapperId,
			type: 'div',
			name: 'Group',
			isGroupWrapper: true,
			parentId,
			pageId,
			groupId: null,
			position: wrapperPosition,
			size: wrapperSize,
			rotation: 0,
			visible: true,
			locked: false,
			styles: { display: 'block' },
			typography: {},
			spacing: {},
			children: elementIds
		};

		newElements[wrapperId] = wrapper;
	} else {
		// Wrapper already exists (e.g., during paste) - update it to ensure correct properties
		// Preserve existing styles but ensure display: block and isGroupWrapper: true
		const existingStyles = existingWrapper.styles || {};
		newElements[wrapperId] = {
			...existingWrapper,
			isGroupWrapper: true,
			children: elementIds,
			// Preserve wrapper's dimensions and position (they were already set during paste)
			position: wrapperPosition,
			size: wrapperSize,
			// Ensure display: block is set (preserve other styles)
			styles: {
				...existingStyles,
				display: 'block'
			}
		};
	}

	// Update each member element
	// Only update if wrapper doesn't already exist (during paste, children are already correctly set up)
	if (!existingWrapper) {
		for (const elementId of elementIds) {
			const element = newElements[elementId];
			if (element) {
				const offset = memberOffsets[elementId] || { x: 0, y: 0 };
				newElements[elementId] = {
					...element,
					parentId: wrapperId,
					groupId,
					position: offset
				};
			}
		}
	} else {
		// Wrapper already exists - just update groupId on members (they already have correct parentId and position)
		for (const elementId of elementIds) {
			const element = newElements[elementId];
			if (element) {
				newElements[elementId] = {
					...element,
					groupId
				};
			}
		}
	}

	// Add wrapper to parent's children array or page's canvasElements
	// Only do this if wrapper doesn't already exist (to avoid duplicate operations during paste)
	// When wrapper exists (during paste), it's already in the parent's children array, so we just need to ensure
	// member elements are removed from parent (they should already be children of wrapper)
	if (!existingWrapper) {
		if (parentId && newElements[parentId]) {
			const parent = newElements[parentId];

			// Remove member elements from parent's children
			const filteredChildren = parent.children.filter(id => !elementIds.includes(id));

			// Add wrapper at the position of the topmost member
			const memberIndices = elementIds.map(id => parent.children.indexOf(id)).filter(i => i !== -1);
			const topmostIndex = memberIndices.length > 0 ? Math.max(...memberIndices) : filteredChildren.length;

			const newChildren = [
				...filteredChildren.slice(0, topmostIndex),
				wrapperId,
				...filteredChildren.slice(topmostIndex)
			];

			newElements[parentId] = {
				...parent,
				children: newChildren
			};
		} else {
			// Root level - update page's canvasElements
			const page = state.pages[pageId];
			if (page) {
				// Remove member elements from page's canvasElements
				const filteredElements = page.canvasElements.filter(id => !elementIds.includes(id));

				// Add wrapper at the position of the topmost member
				const memberIndices = elementIds.map(id => page.canvasElements.indexOf(id)).filter(i => i !== -1);
				const topmostIndex = memberIndices.length > 0 ? Math.max(...memberIndices) : filteredElements.length;

				const newCanvasElements = [
					...filteredElements.slice(0, topmostIndex),
					wrapperId,
					...filteredElements.slice(topmostIndex)
				];

				newPages = {
					...state.pages,
					[pageId]: {
						...page,
						canvasElements: newCanvasElements
					}
				};
			}
		}
	} else {
		// Wrapper already exists (during paste) - ensure structure is correct
		// The wrapper was already pasted into the parent, and the children were already pasted as children of the wrapper
		// But we need to ensure:
		// 1. Member elements are NOT in parent's children array (they should be children of wrapper)
		// 2. Wrapper IS in parent's children array
		if (parentId && newElements[parentId]) {
			const parent = newElements[parentId];
			// Remove member elements from parent's children (they should be children of wrapper, not parent)
			const filteredChildren = parent.children.filter(id => !elementIds.includes(id));
			// Ensure wrapper is in parent's children (it should already be there from paste, but verify)
			if (!filteredChildren.includes(wrapperId)) {
				// Wrapper not in parent's children - add it
				filteredChildren.push(wrapperId);
			}
			newElements[parentId] = {
				...parent,
				children: filteredChildren
			};
		} else if (!parentId) {
			// Root level - ensure wrapper is in page's canvasElements and members are removed
			const page = state.pages[pageId];
			if (page) {
				const filteredElements = page.canvasElements.filter(id => !elementIds.includes(id));
				if (!filteredElements.includes(wrapperId)) {
					filteredElements.push(wrapperId);
				}
				newPages = {
					...state.pages,
					[pageId]: {
						...page,
						canvasElements: filteredElements
					}
				};
			}
		}
	}

	// Create the group record
	const group: Group = {
		id: groupId,
		elementIds,
		wrapperId
	};

	return {
		...state,
		elements: newElements,
		pages: newPages,
		groups: {
			...state.groups,
			[groupId]: group
		}
	};
}
*/

// ============================================================================
// Style Handlers
// ============================================================================

function handleUpdateStyles(state: DesignState, event: UpdateStylesEvent): DesignState {
	const { elementId, styles } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				styles: {
					...element.styles,
					...styles
				}
			}
		}
	};
}

function handleUpdateTypography(state: DesignState, event: UpdateTypographyEvent): DesignState {
	const { elementId, typography } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				typography: {
					...element.typography,
					...typography
				}
			}
		}
	};
}

function handleUpdateSpacing(state: DesignState, event: UpdateSpacingEvent): DesignState {
	const { elementId, spacing } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				spacing: {
					...element.spacing,
					...spacing
				}
			}
		}
	};
}

function handleUpdateAutoLayout(state: DesignState, event: UpdateAutoLayoutEvent): DesignState {
	const { elementId, autoLayout } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				autoLayout: {
					...element.autoLayout,
					...autoLayout
				}
			}
		}
	};
}

function handleToggleView(state: DesignState, event: ToggleViewEvent): DesignState {
	const { elementId, isView, viewName, breakpointWidth } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				isView,
				viewName: viewName || element.viewName,
				breakpointWidth: breakpointWidth || element.breakpointWidth || 1440
			}
		}
	};
}

function handleToggleVisibility(state: DesignState, event: ToggleVisibilityEvent): DesignState {
	const { elementId, visible } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				visible
			}
		}
	};
}

function handleToggleLock(state: DesignState, event: ToggleLockEvent): DesignState {
	const { elementId, locked } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				locked
			}
		}
	};
}

function handleRenameElement(state: DesignState, event: RenameElementEvent): DesignState {
	const { elementId, name } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				name
			}
		}
	};
}

// ============================================================================
// Page Handlers
// ============================================================================

function handleCreatePage(state: DesignState, event: CreatePageEvent): DesignState {
	const { pageId, name, slug } = event.payload;

	const page: Page = {
		id: pageId,
		name,
		slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
		canvasElements: []
	};

	return {
		...state,
		pages: {
			...state.pages,
			[pageId]: page
		},
		pageOrder: [...state.pageOrder, pageId],
		currentPageId: state.currentPageId || pageId // Set as current if first page
	};
}

function handleUpdatePage(state: DesignState, event: UpdatePageEvent): DesignState {
	const { pageId, changes } = event.payload;
	const page = state.pages[pageId];

	if (!page) return state;

	return {
		...state,
		pages: {
			...state.pages,
			[pageId]: {
				...page,
				...changes
			}
		}
	};
}

function handleDeletePage(state: DesignState, event: DeletePageEvent): DesignState {
	const { pageId } = event.payload;
	const page = state.pages[pageId];

	if (!page) return state;

	const newPages = { ...state.pages };
	delete newPages[pageId];

	// Delete all elements belonging to this page
	const newElements = { ...state.elements };
	Object.keys(newElements).forEach((elementId) => {
		if (newElements[elementId].pageId === pageId) {
			delete newElements[elementId];
		}
	});

	// Remove from page order
	const newPageOrder = state.pageOrder.filter((id) => id !== pageId);

	// Update current page if deleted
	let newCurrentPageId = state.currentPageId;
	if (state.currentPageId === pageId) {
		newCurrentPageId = newPageOrder.length > 0 ? newPageOrder[0] : null;
	}

	return {
		...state,
		pages: newPages,
		elements: newElements,
		pageOrder: newPageOrder,
		currentPageId: newCurrentPageId
	};
}

function handleReorderPages(state: DesignState, event: ReorderPagesEvent): DesignState {
	const { pageIds } = event.payload;

	return {
		...state,
		pageOrder: pageIds
	};
}

// ============================================================================
// Component Handlers
// ============================================================================

function handleCreateComponent(state: DesignState, event: CreateComponentEvent): DesignState {
	const { componentId, name, elementIds } = event.payload;

	const component: Component = {
		id: componentId,
		name,
		elementIds
	};

	return {
		...state,
		components: {
			...state.components,
			[componentId]: component
		}
	};
}

function handleUpdateComponent(state: DesignState, event: UpdateComponentEvent): DesignState {
	const { componentId, changes } = event.payload;
	const component = state.components[componentId];

	if (!component) return state;

	return {
		...state,
		components: {
			...state.components,
			[componentId]: {
				...component,
				...changes
			}
		}
	};
}

function handleDeleteComponent(state: DesignState, event: DeleteComponentEvent): DesignState {
	const { componentId } = event.payload;

	const newComponents = { ...state.components };
	delete newComponents[componentId];

	return {
		...state,
		components: newComponents
	};
}

function handleInstanceComponent(
	state: DesignState,
	event: InstanceComponentEvent
): DesignState {
	const { componentId, instanceId, pageId, position } = event.payload;
	const component = state.components[componentId];

	if (!component) return state;

	// Clone all elements from the component
	const newElements = { ...state.elements };
	const idMap = new Map<string, string>(); // Old ID -> New ID

	// First pass: create new IDs for all elements
	component.elementIds.forEach((oldId) => {
		const newId = `${instanceId}-${oldId}`;
		idMap.set(oldId, newId);
	});

	// Second pass: clone elements with updated IDs and references
	// Note: Component instances need to be assigned to a page
	const page = state.pages[pageId];
	if (!page) {
		// Cannot instance component without a valid page
		console.error(`Cannot instance component: page ${pageId} not found`);
		return state;
	}

	component.elementIds.forEach((oldId) => {
		const oldElement = state.elements[oldId];
		if (!oldElement) return;

		const newId = idMap.get(oldId)!;
		const newParentId = oldElement.parentId ? idMap.get(oldElement.parentId) || null : null;

		newElements[newId] = {
			...oldElement,
			id: newId,
			parentId: newParentId,
			pageId: pageId,
			position: {
				x: position.x + oldElement.position.x,
				y: position.y + oldElement.position.y
			},
			children: oldElement.children.map((childId) => idMap.get(childId) || childId)
		};
	});

	// Add root elements to page's canvas
	const rootElementIds = component.elementIds
		.filter((id) => !state.elements[id]?.parentId)
		.map((id) => idMap.get(id)!);

	const newPages = { ...state.pages };
	newPages[pageId] = {
		...page,
		canvasElements: [...page.canvasElements, ...rootElementIds]
	};

	return {
		...state,
		elements: newElements,
		pages: newPages
	};
}

// ============================================================================
// Migration Handlers
// ============================================================================

function handleMigrateToUnifiedPositioning(
	state: DesignState,
	event: MigrateToUnifiedPositioningEvent
): DesignState {
	const newElements: Record<string, Element> = {};

	// Migrate all elements to unified positioning model
	for (const [id, element] of Object.entries(state.elements)) {
		// Skip if already has positionMode
		if (element.positionMode) {
			newElements[id] = element;
			continue;
		}

		// Determine position mode based on legacy properties
		let positionMode: 'absolute' | 'flex-item' = 'absolute';

		// Check if element is a child in auto-layout parent
		if (element.parentId) {
			const parent = state.elements[element.parentId];
			if (parent?.autoLayout?.enabled && !element.autoLayout?.ignoreAutoLayout) {
				positionMode = 'flex-item';
			}
		}

		// Migrate element with positionMode
		newElements[id] = {
			...element,
			positionMode
		};
	}

	return {
		...state,
		elements: newElements
	};
}
