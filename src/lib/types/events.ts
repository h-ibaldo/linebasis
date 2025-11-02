/**
 * Event Sourcing Types for LineBasis Page Builder
 *
 * All design changes are stored as append-only events.
 * The current design state is computed by reducing events.
 */

// ============================================================================
// Core Event Types
// ============================================================================

export type EventType =
	// Element operations
	| 'CREATE_ELEMENT'
	| 'UPDATE_ELEMENT'
	| 'DELETE_ELEMENT'
	| 'MOVE_ELEMENT'
	| 'RESIZE_ELEMENT'
	| 'ROTATE_ELEMENT'
	| 'REORDER_ELEMENT'
	| 'TOGGLE_FRAME'
	// Style operations
	| 'UPDATE_STYLES'
	| 'UPDATE_TYPOGRAPHY'
	| 'UPDATE_SPACING'
	// Frame operations
	| 'CREATE_FRAME'
	| 'UPDATE_FRAME'
	| 'DELETE_FRAME'
	| 'RESIZE_FRAME'
	// Page operations
	| 'CREATE_PAGE'
	| 'UPDATE_PAGE'
	| 'DELETE_PAGE'
	| 'REORDER_PAGES'
	// Component operations
	| 'CREATE_COMPONENT'
	| 'UPDATE_COMPONENT'
	| 'DELETE_COMPONENT'
	| 'INSTANCE_COMPONENT';

export interface BaseEvent {
	id: string; // UUID for the event
	type: EventType;
	timestamp: number; // Unix timestamp in milliseconds
	userId?: string; // User who performed the action (for collaboration)
}

// ============================================================================
// Element Events
// ============================================================================

export interface CreateElementEvent extends BaseEvent {
	type: 'CREATE_ELEMENT';
	payload: {
		elementId: string;
		parentId: string | null; // null for root elements
		frameId: string; // Elements belong to frames, not pages
		elementType: ElementType;
		position: Position;
		size: Size;
		styles?: Partial<ElementStyles>;
		content?: string; // For text elements
	};
}

export interface UpdateElementEvent extends BaseEvent {
	type: 'UPDATE_ELEMENT';
	payload: {
		elementId: string;
		changes: {
			content?: string;
			alt?: string;
			href?: string;
			src?: string;
		};
	};
}

export interface DeleteElementEvent extends BaseEvent {
	type: 'DELETE_ELEMENT';
	payload: {
		elementId: string;
	};
}

export interface MoveElementEvent extends BaseEvent {
	type: 'MOVE_ELEMENT';
	payload: {
		elementId: string;
		position: Position;
		snapToBaseline?: boolean;
	};
}

export interface ResizeElementEvent extends BaseEvent {
	type: 'RESIZE_ELEMENT';
	payload: {
		elementId: string;
		size: Size;
		position?: Position; // Optional: for N/W handles that also move the element
	};
}

export interface RotateElementEvent extends BaseEvent {
	type: 'ROTATE_ELEMENT';
	payload: {
		elementId: string;
		rotation: number; // Rotation angle in degrees
	};
}

export interface ReorderElementEvent extends BaseEvent {
	type: 'REORDER_ELEMENT';
	payload: {
		elementId: string;
		newParentId: string | null;
		newIndex: number; // Z-index or child position
	};
}

export interface ToggleFrameEvent extends BaseEvent {
	type: 'TOGGLE_FRAME';
	payload: {
		elementId: string;
		isFrame: boolean;
		frameName?: string;
		breakpointWidth?: number;
	};
}

// ============================================================================
// Style Events
// ============================================================================

export interface UpdateStylesEvent extends BaseEvent {
	type: 'UPDATE_STYLES';
	payload: {
		elementId: string;
		styles: Partial<ElementStyles>;
	};
}

export interface UpdateTypographyEvent extends BaseEvent {
	type: 'UPDATE_TYPOGRAPHY';
	payload: {
		elementId: string;
		typography: Partial<TypographyStyle>;
	};
}

export interface UpdateSpacingEvent extends BaseEvent {
	type: 'UPDATE_SPACING';
	payload: {
		elementId: string;
		spacing: Partial<SpacingStyle>;
	};
}

// ============================================================================
// Frame Events
// ============================================================================

export interface CreateFrameEvent extends BaseEvent {
	type: 'CREATE_FRAME';
	payload: {
		frameId: string;
		pageId: string; // Frames belong to pages
		name: string;
		breakpointWidth: number; // e.g., 1920, 768, 375
		position: Position; // Position on canvas
		height?: number; // Auto or fixed
	};
}

export interface UpdateFrameEvent extends BaseEvent {
	type: 'UPDATE_FRAME';
	payload: {
		frameId: string;
		changes: {
			name?: string;
			breakpointWidth?: number;
			position?: Position;
			height?: number;
		};
	};
}

export interface DeleteFrameEvent extends BaseEvent {
	type: 'DELETE_FRAME';
	payload: {
		frameId: string;
	};
}

export interface ResizeFrameEvent extends BaseEvent {
	type: 'RESIZE_FRAME';
	payload: {
		frameId: string;
		width: number;
		height?: number;
	};
}

// ============================================================================
// Page Events
// ============================================================================

export interface CreatePageEvent extends BaseEvent {
	type: 'CREATE_PAGE';
	payload: {
		pageId: string;
		name: string;
		slug?: string;
		width?: number;
		height?: number;
	};
}

export interface UpdatePageEvent extends BaseEvent {
	type: 'UPDATE_PAGE';
	payload: {
		pageId: string;
		changes: {
			name?: string;
			slug?: string;
			width?: number;
			height?: number;
		};
	};
}

export interface DeletePageEvent extends BaseEvent {
	type: 'DELETE_PAGE';
	payload: {
		pageId: string;
	};
}

export interface ReorderPagesEvent extends BaseEvent {
	type: 'REORDER_PAGES';
	payload: {
		pageIds: string[]; // New order
	};
}

// ============================================================================
// Component Events
// ============================================================================

export interface CreateComponentEvent extends BaseEvent {
	type: 'CREATE_COMPONENT';
	payload: {
		componentId: string;
		name: string;
		elementIds: string[]; // Elements that make up this component
	};
}

export interface UpdateComponentEvent extends BaseEvent {
	type: 'UPDATE_COMPONENT';
	payload: {
		componentId: string;
		changes: {
			name?: string;
		};
	};
}

export interface DeleteComponentEvent extends BaseEvent {
	type: 'DELETE_COMPONENT';
	payload: {
		componentId: string;
	};
}

export interface InstanceComponentEvent extends BaseEvent {
	type: 'INSTANCE_COMPONENT';
	payload: {
		componentId: string;
		instanceId: string; // New element ID for the instance
		pageId: string;
		position: Position;
	};
}

// ============================================================================
// Union Type
// ============================================================================

export type DesignEvent =
	| CreateElementEvent
	| UpdateElementEvent
	| DeleteElementEvent
	| MoveElementEvent
	| ResizeElementEvent
	| RotateElementEvent
	| ReorderElementEvent
	| ToggleFrameEvent
	| UpdateStylesEvent
	| UpdateTypographyEvent
	| UpdateSpacingEvent
	| CreateFrameEvent
	| UpdateFrameEvent
	| DeleteFrameEvent
	| ResizeFrameEvent
	| CreatePageEvent
	| UpdatePageEvent
	| DeletePageEvent
	| ReorderPagesEvent
	| CreateComponentEvent
	| UpdateComponentEvent
	| DeleteComponentEvent
	| InstanceComponentEvent;

// ============================================================================
// Design State Types (computed from events)
// ============================================================================

export type ElementType =
	| 'div'
	| 'section'
	| 'header'
	| 'footer'
	| 'article'
	| 'aside'
	| 'nav'
	| 'main'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'h4'
	| 'h5'
	| 'h6'
	| 'p'
	| 'span'
	| 'a'
	| 'button'
	| 'img'
	| 'video'
	| 'form'
	| 'input'
	| 'textarea'
	| 'label'
	| 'ul'
	| 'ol'
	| 'li';

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface ElementStyles {
	// Layout
	display: 'block' | 'inline' | 'inline-block' | 'flex' | 'grid' | 'none';
	position: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
	// Colors
	backgroundColor: string;
	color: string;
	// Border
	borderWidth: string;
	borderStyle: string;
	borderColor: string;
	borderRadius: string;
	// Effects
	opacity: number;
	boxShadow: string;
	transform: string;
	// Overflow
	overflow: 'visible' | 'hidden' | 'scroll' | 'auto';
    // Object fit (for img/video elements)
	objectFit: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export interface TypographyStyle {
	fontFamily: string;
	fontSize: string;
	fontWeight: string;
	lineHeight: string;
	letterSpacing: string;
	textAlign: 'left' | 'center' | 'right' | 'justify';
	textDecoration: string;
	textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface SpacingStyle {
	marginTop: string;
	marginRight: string;
	marginBottom: string;
	marginLeft: string;
	paddingTop: string;
	paddingRight: string;
	paddingBottom: string;
	paddingLeft: string;
}

export interface Element {
	id: string;
	type: ElementType;
	parentId: string | null;
	frameId: string; // Elements belong to frames
	position: Position;
	size: Size;
	rotation?: number; // Rotation angle in degrees (default 0)
	styles: Partial<ElementStyles>;
	typography: Partial<TypographyStyle>;
	spacing: Partial<SpacingStyle>;
	content?: string;
	alt?: string;
	href?: string;
	src?: string;
	children: string[]; // Child element IDs
	zIndex: number;
	isFrame?: boolean; // Whether this div is a frame (page/breakpoint)
	frameName?: string; // Name of the frame if isFrame is true
	breakpointWidth?: number; // Width of the frame if isFrame is true
}

export interface Frame {
	id: string;
	pageId: string; // Frame belongs to a page
	name: string; // e.g., "Desktop", "Mobile", "Tablet"
	breakpointWidth: number; // e.g., 1920, 768, 375
	position: Position; // Position on canvas
	height: number; // Height in pixels (auto-grows with content)
	elements: string[]; // Root element IDs
}

export interface Page {
	id: string;
	name: string; // e.g., "Homepage", "About"
	slug: string; // URL slug
	frames: string[]; // Frame IDs (different breakpoints)
}

export interface Component {
	id: string;
	name: string;
	elementIds: string[]; // Element IDs that make up this component
}

export interface DesignState {
	pages: Record<string, Page>;
	frames: Record<string, Frame>;
	elements: Record<string, Element>;
	components: Record<string, Component>;
	pageOrder: string[];
	currentPageId: string | null;
	currentFrameId: string | null; // Currently selected frame
	selectedElementIds: string[];
}

// ============================================================================
// Event Store Types
// ============================================================================

export interface EventStoreSnapshot {
	version: number;
	events: DesignEvent[];
	lastEventId: string | null;
	createdAt: number;
	updatedAt: number;
}
