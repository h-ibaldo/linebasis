/**
 * Event Reducer - Computes design state from events
 *
 * This is a pure function that takes a list of events and produces
 * the current design state. This allows us to replay events for undo/redo
 * and to reconstruct state from the event log.
 */

import type {
	DesignEvent,
	DesignState,
	Element,
	View,
	Page,
	Group,
	Component,
	CreateElementEvent,
	UpdateElementEvent,
	DeleteElementEvent,
	MoveElementEvent,
	ResizeElementEvent,
	RotateElementEvent,
	ReorderElementEvent,
	ToggleViewEvent,
	ToggleVisibilityEvent,
	ToggleLockEvent,
	RenameElementEvent,
	GroupMoveElementsEvent,
	GroupResizeElementsEvent,
	GroupRotateElementsEvent,
	GroupUpdateStylesEvent,
	GroupElementsEvent,
	UngroupElementsEvent,
	UpdateStylesEvent,
	UpdateTypographyEvent,
	UpdateSpacingEvent,
	UpdateAutoLayoutEvent,
	CreateViewEvent,
	UpdateViewEvent,
	DeleteViewEvent,
	ResizeViewEvent,
	CreatePageEvent,
	UpdatePageEvent,
	DeletePageEvent,
	ReorderPagesEvent,
	CreateComponentEvent,
	UpdateComponentEvent,
	DeleteComponentEvent,
	InstanceComponentEvent
} from '$lib/types/events';

/**
 * Initial empty state
 */
export function getInitialState(): DesignState {
	return {
		pages: {},
		views: {},
		elements: {},
		groups: {},
		components: {},
		pageOrder: [],
		currentPageId: null,
		currentViewId: null,
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
		case 'MOVE_ELEMENT':
			return handleMoveElement(state, event);
		case 'RESIZE_ELEMENT':
			return handleResizeElement(state, event);
		case 'ROTATE_ELEMENT':
			return handleRotateElement(state, event);
		case 'REORDER_ELEMENT':
			return handleReorderElement(state, event);
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

		// Group operations
		case 'GROUP_ELEMENTS':
			return handleGroupElements(state, event);
		case 'UNGROUP_ELEMENTS':
			return handleUngroupElements(state, event);

		// Style operations
		case 'UPDATE_STYLES':
			return handleUpdateStyles(state, event);
		case 'UPDATE_TYPOGRAPHY':
			return handleUpdateTypography(state, event);
		case 'UPDATE_SPACING':
			return handleUpdateSpacing(state, event);
		case 'UPDATE_AUTO_LAYOUT':
			return handleUpdateAutoLayout(state, event);

		// View operations (breakpoint views)
		case 'CREATE_VIEW':
			return handleCreateView(state, event);
		case 'UPDATE_VIEW':
			return handleUpdateView(state, event);
		case 'DELETE_VIEW':
			return handleDeleteView(state, event);
		case 'RESIZE_VIEW':
			return handleResizeView(state, event);

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

		default:
			return state;
	}
}

// ============================================================================
// Element Handlers
// ============================================================================

function handleCreateElement(state: DesignState, event: CreateElementEvent): DesignState {
	const { elementId, parentId, viewId, elementType, position, size, styles, content } =
		event.payload;

	// New elements are added to end of array (visual top layer)
	// Array position determines stacking: index 0 = bottom, last = top

	const element: Element = {
		id: elementId,
		type: elementType,
		parentId,
		viewId,
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

	// Add element to parent's children
	if (parentId && newElements[parentId]) {
		newElements[parentId] = {
			...newElements[parentId],
			children: [...newElements[parentId].children, elementId]
		};
	}

	// Add element to view's root elements if no parent
	const newViews = { ...state.views };
	if (!parentId && newViews[viewId]) {
		newViews[viewId] = {
			...newViews[viewId],
			elements: [...newViews[viewId].elements, elementId]
		};
	}

	return {
		...state,
		elements: newElements,
		views: newViews
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
	const newViews = { ...state.views };

	// Remove from parent's children
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	}

	// Remove from view's root elements
	if (!element.parentId && newViews[element.viewId]) {
		newViews[element.viewId] = {
			...newViews[element.viewId],
			elements: newViews[element.viewId].elements.filter((id) => id !== elementId)
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

	return {
		...state,
		elements: newElements,
		views: newViews,
		selectedElementIds: newSelectedElementIds
	};
}

function handleMoveElement(state: DesignState, event: MoveElementEvent): DesignState {
	const { elementId, position } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

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
	const newViews = { ...state.views };

	// Remove from old parent
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	} else if (!element.parentId && newViews[element.viewId]) {
		newViews[element.viewId] = {
			...newViews[element.viewId],
			elements: newViews[element.viewId].elements.filter((id) => id !== elementId)
		};
	}

	// Update element parent
	// When moving to a parent element, clear viewId (element is now nested)
	// When moving to view root (parentId = null), keep existing viewId
	// newIndex is used for array position insertion (not z-index)
	newElements[elementId] = {
		...element,
		parentId: newParentId,
		...(newParentId !== null && { viewId: '' })
	};

	// Add to new parent
	if (newParentId && newElements[newParentId]) {
		const children = [...newElements[newParentId].children];
		children.splice(newIndex, 0, elementId);
		newElements[newParentId] = {
			...newElements[newParentId],
			children
		};
	} else if (!newParentId && newViews[element.viewId]) {
		const elements = [...newViews[element.viewId].elements];
		elements.splice(newIndex, 0, elementId);
		newViews[element.viewId] = {
			...newViews[element.viewId],
			elements
		};
	}

	return {
		...state,
		elements: newElements,
		views: newViews
	};
}

function handleGroupMoveElements(state: DesignState, event: GroupMoveElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };

	// Update all elements atomically
	for (const { elementId, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				position
			};
		}
	}

	return {
		...state,
		elements: newElements
	};
}

function handleGroupResizeElements(state: DesignState, event: GroupResizeElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };

	// Update all elements atomically
	for (const { elementId, size, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				size,
				...(position && { position })
			};
		}
	}

	return {
		...state,
		elements: newElements
	};
}

function handleGroupRotateElements(state: DesignState, event: GroupRotateElementsEvent): DesignState {
	const { elements } = event.payload;
	const newElements = { ...state.elements };

	// Update all elements atomically
	for (const { elementId, rotation, position } of elements) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				rotation,
				position
			};
		}
	}

	return {
		...state,
		elements: newElements
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

function handleGroupElements(state: DesignState, event: GroupElementsEvent): DesignState {
	const { groupId, elementIds } = event.payload;

	// Create the group
	const group: Group = {
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

	let newViews = state.views;
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
		// Root elements - reorder in view's elements array
		const viewId = elementsToGroup[0].viewId;
		const view = state.views[viewId];

		if (view) {
			const allRootIds = [...view.elements];

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

			// Update view's elements array
			newViews = {
				...state.views,
				[viewId]: {
					...view,
					elements: newRootIds
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

	return {
		...state,
		groups: {
			...state.groups,
			[groupId]: group
		},
		elements: newElements,
		views: newViews
	};
}

function handleUngroupElements(state: DesignState, event: UngroupElementsEvent): DesignState {
	const { groupId } = event.payload;
	const group = state.groups[groupId];

	if (!group) return state;

	// Remove groupId from all elements in the group
	const newElements = { ...state.elements };
	for (const elementId of group.elementIds) {
		const element = newElements[elementId];
		if (element) {
			newElements[elementId] = {
				...element,
				groupId: null
			};
		}
	}

	// Delete the group
	const newGroups = { ...state.groups };
	delete newGroups[groupId];

	return {
		...state,
		groups: newGroups,
		elements: newElements
	};
}

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
// View Handlers (Breakpoint Views)
// ============================================================================

function handleCreateView(state: DesignState, event: CreateViewEvent): DesignState {
	const { viewId, pageId, name, breakpointWidth, position, height } = event.payload;

	const view: View = {
		id: viewId,
		pageId,
		name,
		breakpointWidth,
		position,
		height: height || 900,
		elements: []
	};

	// Add view to state
	const newViews = { ...state.views, [viewId]: view };

	// Add view to page
	const newPages = { ...state.pages };
	if (newPages[pageId]) {
		newPages[pageId] = {
			...newPages[pageId],
			views: [...newPages[pageId].views, viewId]
		};
	}

	return {
		...state,
		views: newViews,
		pages: newPages,
		currentViewId: state.currentViewId || viewId // Set as current if first view
	};
}

function handleUpdateView(state: DesignState, event: UpdateViewEvent): DesignState {
	const { viewId, changes } = event.payload;
	const view = state.views[viewId];

	if (!view) return state;

	return {
		...state,
		views: {
			...state.views,
			[viewId]: {
				...view,
				...changes
			}
		}
	};
}

function handleDeleteView(state: DesignState, event: DeleteViewEvent): DesignState {
	const { viewId } = event.payload;
	const view = state.views[viewId];

	if (!view) return state;

	const newViews = { ...state.views };
	delete newViews[viewId];

	// Delete all elements in this view
	const newElements = { ...state.elements };
	Object.keys(newElements).forEach((elementId) => {
		if (newElements[elementId].viewId === viewId) {
			delete newElements[elementId];
		}
	});

	// Remove from page
	const newPages = { ...state.pages };
	if (newPages[view.pageId]) {
		newPages[view.pageId] = {
			...newPages[view.pageId],
			views: newPages[view.pageId].views.filter((id) => id !== viewId)
		};
	}

	// Update current view if deleted
	let newCurrentViewId = state.currentViewId;
	if (state.currentViewId === viewId) {
		const remainingViews = Object.keys(newViews);
		newCurrentViewId = remainingViews.length > 0 ? remainingViews[0] : null;
	}

	return {
		...state,
		views: newViews,
		elements: newElements,
		pages: newPages,
		currentViewId: newCurrentViewId
	};
}

function handleResizeView(state: DesignState, event: ResizeViewEvent): DesignState {
	const { viewId, width, height } = event.payload;
	const view = state.views[viewId];

	if (!view) return state;

	return {
		...state,
		views: {
			...state.views,
			[viewId]: {
				...view,
				breakpointWidth: width,
				...(height && { height })
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
		views: []
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

	// Delete all views belonging to this page
	const newViews = { ...state.views };
	const viewsToDelete = Object.keys(newViews).filter((viewId) => newViews[viewId].pageId === pageId);
	viewsToDelete.forEach((viewId) => {
		delete newViews[viewId];
	});

	// Delete all elements in those views
	const newElements = { ...state.elements };
	Object.keys(newElements).forEach((elementId) => {
		if (viewsToDelete.includes(newElements[elementId].viewId)) {
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
		views: newViews,
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
	// Note: Component instances need to be assigned to a view
	const currentView = state.currentViewId ? state.views[state.currentViewId] : null;
	if (!currentView) {
		// Cannot instance component without a current view
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
			viewId: currentView.id,
			position: {
				x: position.x + oldElement.position.x,
				y: position.y + oldElement.position.y
			},
			children: oldElement.children.map((childId) => idMap.get(childId) || childId)
		};
	});

	// Add root elements to current view
	const rootElementIds = component.elementIds
		.filter((id) => !state.elements[id]?.parentId)
		.map((id) => idMap.get(id)!);

	const newViews = { ...state.views };
	newViews[currentView.id] = {
		...currentView,
		elements: [...currentView.elements, ...rootElementIds]
	};

	return {
		...state,
		elements: newElements,
		views: newViews
	};
}
