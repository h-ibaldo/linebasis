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
	Frame,
	Page,
	Component,
	CreateElementEvent,
	UpdateElementEvent,
	DeleteElementEvent,
	MoveElementEvent,
	ResizeElementEvent,
	RotateElementEvent,
	ReorderElementEvent,
	ToggleFrameEvent,
	GroupMoveElementsEvent,
	GroupResizeElementsEvent,
	GroupRotateElementsEvent,
	GroupUpdateStylesEvent,
	UpdateStylesEvent,
	UpdateTypographyEvent,
	UpdateSpacingEvent,
	CreateFrameEvent,
	UpdateFrameEvent,
	DeleteFrameEvent,
	ResizeFrameEvent,
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
		frames: {},
		elements: {},
		components: {},
		pageOrder: [],
		currentPageId: null,
		currentFrameId: null,
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
		case 'TOGGLE_FRAME':
			return handleToggleFrame(state, event);
		case 'GROUP_MOVE_ELEMENTS':
			return handleGroupMoveElements(state, event);
		case 'GROUP_RESIZE_ELEMENTS':
			return handleGroupResizeElements(state, event);
		case 'GROUP_ROTATE_ELEMENTS':
			return handleGroupRotateElements(state, event);
		case 'GROUP_UPDATE_STYLES':
			return handleGroupUpdateStyles(state, event);

		// Style operations
		case 'UPDATE_STYLES':
			return handleUpdateStyles(state, event);
		case 'UPDATE_TYPOGRAPHY':
			return handleUpdateTypography(state, event);
		case 'UPDATE_SPACING':
			return handleUpdateSpacing(state, event);

		// Frame operations
		case 'CREATE_FRAME':
			return handleCreateFrame(state, event);
		case 'UPDATE_FRAME':
			return handleUpdateFrame(state, event);
		case 'DELETE_FRAME':
			return handleDeleteFrame(state, event);
		case 'RESIZE_FRAME':
			return handleResizeFrame(state, event);

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
	const { elementId, parentId, frameId, elementType, position, size, styles, content } =
		event.payload;

	const element: Element = {
		id: elementId,
		type: elementType,
		parentId,
		frameId,
		position,
		size,
		styles: styles || {},
		typography: {},
		spacing: {},
		content,
		children: [],
		zIndex: 0
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

	// Add element to frame's root elements if no parent
	const newFrames = { ...state.frames };
	if (!parentId && newFrames[frameId]) {
		newFrames[frameId] = {
			...newFrames[frameId],
			elements: [...newFrames[frameId].elements, elementId]
		};
	}

	return {
		...state,
		elements: newElements,
		frames: newFrames
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
	const newFrames = { ...state.frames };

	// Remove from parent's children
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	}

	// Remove from frame's root elements
	if (!element.parentId && newFrames[element.frameId]) {
		newFrames[element.frameId] = {
			...newFrames[element.frameId],
			elements: newFrames[element.frameId].elements.filter((id) => id !== elementId)
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
		frames: newFrames,
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
	const newFrames = { ...state.frames };

	// Remove from old parent
	if (element.parentId && newElements[element.parentId]) {
		newElements[element.parentId] = {
			...newElements[element.parentId],
			children: newElements[element.parentId].children.filter((id) => id !== elementId)
		};
	} else if (!element.parentId && newFrames[element.frameId]) {
		newFrames[element.frameId] = {
			...newFrames[element.frameId],
			elements: newFrames[element.frameId].elements.filter((id) => id !== elementId)
		};
	}

	// Update element parent
	newElements[elementId] = {
		...element,
		parentId: newParentId,
		zIndex: newIndex
	};

	// Add to new parent
	if (newParentId && newElements[newParentId]) {
		const children = [...newElements[newParentId].children];
		children.splice(newIndex, 0, elementId);
		newElements[newParentId] = {
			...newElements[newParentId],
			children
		};
	} else if (!newParentId && newFrames[element.frameId]) {
		const elements = [...newFrames[element.frameId].elements];
		elements.splice(newIndex, 0, elementId);
		newFrames[element.frameId] = {
			...newFrames[element.frameId],
			elements
		};
	}

	return {
		...state,
		elements: newElements,
		frames: newFrames
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

function handleToggleFrame(state: DesignState, event: ToggleFrameEvent): DesignState {
	const { elementId, isFrame, frameName, breakpointWidth } = event.payload;
	const element = state.elements[elementId];

	if (!element) return state;

	return {
		...state,
		elements: {
			...state.elements,
			[elementId]: {
				...element,
				isFrame,
				frameName: frameName || element.frameName,
				breakpointWidth: breakpointWidth || element.breakpointWidth || 1440
			}
		}
	};
}

// ============================================================================
// Frame Handlers
// ============================================================================

function handleCreateFrame(state: DesignState, event: CreateFrameEvent): DesignState {
	const { frameId, pageId, name, breakpointWidth, position, height } = event.payload;

	const frame: Frame = {
		id: frameId,
		pageId,
		name,
		breakpointWidth,
		position,
		height: height || 900,
		elements: []
	};

	// Add frame to state
	const newFrames = { ...state.frames, [frameId]: frame };

	// Add frame to page
	const newPages = { ...state.pages };
	if (newPages[pageId]) {
		newPages[pageId] = {
			...newPages[pageId],
			frames: [...newPages[pageId].frames, frameId]
		};
	}

	return {
		...state,
		frames: newFrames,
		pages: newPages,
		currentFrameId: state.currentFrameId || frameId // Set as current if first frame
	};
}

function handleUpdateFrame(state: DesignState, event: UpdateFrameEvent): DesignState {
	const { frameId, changes } = event.payload;
	const frame = state.frames[frameId];

	if (!frame) return state;

	return {
		...state,
		frames: {
			...state.frames,
			[frameId]: {
				...frame,
				...changes
			}
		}
	};
}

function handleDeleteFrame(state: DesignState, event: DeleteFrameEvent): DesignState {
	const { frameId } = event.payload;
	const frame = state.frames[frameId];

	if (!frame) return state;

	const newFrames = { ...state.frames };
	delete newFrames[frameId];

	// Delete all elements in this frame
	const newElements = { ...state.elements };
	Object.keys(newElements).forEach((elementId) => {
		if (newElements[elementId].frameId === frameId) {
			delete newElements[elementId];
		}
	});

	// Remove from page
	const newPages = { ...state.pages };
	if (newPages[frame.pageId]) {
		newPages[frame.pageId] = {
			...newPages[frame.pageId],
			frames: newPages[frame.pageId].frames.filter((id) => id !== frameId)
		};
	}

	// Update current frame if deleted
	let newCurrentFrameId = state.currentFrameId;
	if (state.currentFrameId === frameId) {
		const remainingFrames = Object.keys(newFrames);
		newCurrentFrameId = remainingFrames.length > 0 ? remainingFrames[0] : null;
	}

	return {
		...state,
		frames: newFrames,
		elements: newElements,
		pages: newPages,
		currentFrameId: newCurrentFrameId
	};
}

function handleResizeFrame(state: DesignState, event: ResizeFrameEvent): DesignState {
	const { frameId, width, height } = event.payload;
	const frame = state.frames[frameId];

	if (!frame) return state;

	return {
		...state,
		frames: {
			...state.frames,
			[frameId]: {
				...frame,
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
		frames: []
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

	// Delete all frames belonging to this page
	const newFrames = { ...state.frames };
	const framesToDelete = Object.keys(newFrames).filter((frameId) => newFrames[frameId].pageId === pageId);
	framesToDelete.forEach((frameId) => {
		delete newFrames[frameId];
	});

	// Delete all elements in those frames
	const newElements = { ...state.elements };
	Object.keys(newElements).forEach((elementId) => {
		if (framesToDelete.includes(newElements[elementId].frameId)) {
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
		frames: newFrames,
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
	// Note: Component instances need to be assigned to a frame
	const currentFrame = state.currentFrameId ? state.frames[state.currentFrameId] : null;
	if (!currentFrame) {
		// Cannot instance component without a current frame
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
			frameId: currentFrame.id,
			position: {
				x: position.x + oldElement.position.x,
				y: position.y + oldElement.position.y
			},
			children: oldElement.children.map((childId) => idMap.get(childId) || childId)
		};
	});

	// Add root elements to current frame
	const rootElementIds = component.elementIds
		.filter((id) => !state.elements[id]?.parentId)
		.map((id) => idMap.get(id)!);

	const newFrames = { ...state.frames };
	newFrames[currentFrame.id] = {
		...currentFrame,
		elements: [...currentFrame.elements, ...rootElementIds]
	};

	return {
		...state,
		elements: newElements,
		frames: newFrames
	};
}
