/**
 * Event Sourcing Types for Linabasis Page Builder
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
	| 'GROUP_DELETE_ELEMENTS'
	| 'MOVE_ELEMENT'
	| 'RESIZE_ELEMENT'
	| 'ROTATE_ELEMENT'
	| 'REORDER_ELEMENT'
	| 'SHIFT_ELEMENT_LAYER'
	| 'TOGGLE_VIEW'
	| 'TOGGLE_VISIBILITY'
	| 'TOGGLE_LOCK'
	| 'RENAME_ELEMENT'
	| 'GROUP_MOVE_ELEMENTS'
	| 'GROUP_RESIZE_ELEMENTS'
	| 'GROUP_ROTATE_ELEMENTS'
	// Group operations
	| 'GROUP_ELEMENTS'
	| 'UNGROUP_ELEMENTS'
	// Style operations
	| 'UPDATE_STYLES'
	| 'GROUP_UPDATE_STYLES'
	| 'UPDATE_TYPOGRAPHY'
	| 'APPLY_TYPOGRAPHY_PRESET'
	| 'UPDATE_SPACING'
	| 'UPDATE_AUTO_LAYOUT'
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
		parentId: string | null; // null for root elements (canvas elements)
		pageId: string; // Elements belong to a page's canvas
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

export interface GroupDeleteElementsEvent extends BaseEvent {
	type: 'GROUP_DELETE_ELEMENTS';
	payload: {
		elementIds: string[];
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

export interface ShiftElementLayerEvent extends BaseEvent {
	type: 'SHIFT_ELEMENT_LAYER';
	payload: {
		elementId: string;
		direction: 'forward' | 'backward' | 'front' | 'back';
	};
}

export interface ToggleViewEvent extends BaseEvent {
	type: 'TOGGLE_VIEW';
	payload: {
		elementId: string;
		isView: boolean;
		viewName?: string;
		breakpointWidth?: number;
	};
}

export interface ToggleVisibilityEvent extends BaseEvent {
	type: 'TOGGLE_VISIBILITY';
	payload: {
		elementId: string;
		visible: boolean;
	};
}

export interface ToggleLockEvent extends BaseEvent {
	type: 'TOGGLE_LOCK';
	payload: {
		elementId: string;
		locked: boolean;
	};
}

export interface RenameElementEvent extends BaseEvent {
	type: 'RENAME_ELEMENT';
	payload: {
		elementId: string;
		name: string;
	};
}

export interface GroupMoveElementsEvent extends BaseEvent {
	type: 'GROUP_MOVE_ELEMENTS';
	payload: {
		elements: Array<{
			elementId: string;
			position: Position;
		}>;
	};
}

export interface GroupResizeElementsEvent extends BaseEvent {
	type: 'GROUP_RESIZE_ELEMENTS';
	payload: {
		elements: Array<{
			elementId: string;
			size: Size;
			position?: Position;
		}>;
	};
}

export interface GroupRotateElementsEvent extends BaseEvent {
	type: 'GROUP_ROTATE_ELEMENTS';
	payload: {
		elements: Array<{
			elementId: string;
			rotation: number;
			position: Position;
		}>;
	};
}

export interface GroupUpdateStylesEvent extends BaseEvent {
	type: 'GROUP_UPDATE_STYLES';
	payload: {
		elements: Array<{
			elementId: string;
			styles: Partial<ElementStyles>;
		}>;
	};
}

// ============================================================================
// Group Events
// ============================================================================

export interface GroupElementsEvent extends BaseEvent {
	type: 'GROUP_ELEMENTS';
	payload: {
		groupId: string;
		elementIds: string[];
	};
}

export interface UngroupElementsEvent extends BaseEvent {
	type: 'UNGROUP_ELEMENTS';
	payload: {
		groupId: string;
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

export interface ApplyTypographyPresetEvent extends BaseEvent {
	type: 'APPLY_TYPOGRAPHY_PRESET';
	payload: {
		elementId: string;
		preset: TypographyPreset;
	};
}

export interface UpdateSpacingEvent extends BaseEvent {
	type: 'UPDATE_SPACING';
	payload: {
		elementId: string;
		spacing: Partial<SpacingStyle>;
	};
}

export interface UpdateAutoLayoutEvent extends BaseEvent {
	type: 'UPDATE_AUTO_LAYOUT';
	payload: {
		elementId: string;
		autoLayout: Partial<AutoLayoutStyle>;
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
	| GroupDeleteElementsEvent
	| MoveElementEvent
	| ResizeElementEvent
	| RotateElementEvent
	| ReorderElementEvent
	| ShiftElementLayerEvent
	| ToggleViewEvent
	| ToggleVisibilityEvent
	| ToggleLockEvent
	| RenameElementEvent
	| GroupMoveElementsEvent
	| GroupResizeElementsEvent
	| GroupRotateElementsEvent
	| GroupUpdateStylesEvent
	| GroupElementsEvent
	| UngroupElementsEvent
	| UpdateStylesEvent
	| UpdateTypographyEvent
	| ApplyTypographyPresetEvent
	| UpdateSpacingEvent
	| UpdateAutoLayoutEvent
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
	// Individual corner radii (for independent corner editing with Alt key)
	borderTopLeftRadius?: string;
	borderTopRightRadius?: string;
	borderBottomRightRadius?: string;
	borderBottomLeftRadius?: string;
	// Effects
	opacity: number;
	boxShadow: string;
	transform: string;
	// Overflow
	overflow: 'visible' | 'hidden' | 'scroll' | 'auto';
    // Object fit (for img/video elements)
	objectFit: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export type TypographyPreset =
	| 'heading-1'
	| 'heading-2'
	| 'heading-3'
	| 'heading-4'
	| 'heading-5'
	| 'heading-6'
	| 'body'
	| 'caption'
	| 'small'
	| 'custom';

export interface TypographyStyle {
	// Preset selection
	preset?: TypographyPreset; // Predefined typography style

	// Font properties
	fontFamily: string;
	fontSize: string;
	fontWeight: string;
	fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
	lineHeight: string;
	letterSpacing: string;

	// Text alignment and formatting
	textAlign: 'left' | 'center' | 'right' | 'justify';
	textDecoration: string;
	textDecorationColor?: string; // Decoration color
	textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy'; // Decoration style
	textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';

	// Advanced features
	textIndent?: string; // First line indentation
	wordSpacing?: string; // Space between words
	whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line'; // White space handling
	wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word'; // Word breaking behavior
	hyphens?: 'none' | 'manual' | 'auto'; // Hyphenation
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

export interface AutoLayoutStyle {
	enabled: boolean; // Toggle between freeform (false) and auto layout (true)
	direction: 'row' | 'column' | 'row-wrap'; // Flex direction
	justifyContent: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'; // Main axis alignment
	alignItems: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'; // Cross axis alignment
	gap: string; // Gap between children (e.g., "8px", "16px")
	ignoreAutoLayout?: boolean; // Per-child property: if true, child uses position: absolute
}

export interface Element {
	id: string;
	type: ElementType;
	name?: string; // Custom name for the element (for layers panel)
	parentId: string | null;
	pageId: string; // Elements belong to a page's canvas
	groupId?: string | null; // Group ID if element belongs to a group
	position: Position;
	size: Size;
	rotation?: number; // Rotation angle in degrees (default 0)
	visible?: boolean; // Whether element is visible (default true)
	locked?: boolean; // Whether element is locked (default false)
	styles: Partial<ElementStyles>;
	typography: Partial<TypographyStyle>;
	spacing: Partial<SpacingStyle>;
	autoLayout?: Partial<AutoLayoutStyle>; // Auto layout (flexbox) configuration
	content?: string;
	alt?: string;
	href?: string;
	src?: string;
	children: string[]; // Child element IDs
	// NOTE: NO zIndex - DOM order determined by position in view.elements or parent.children arrays
	// Array index 0 = bottom layer, last index = top layer (standard HTML rendering)
	// FALLBACK: zIndex used when views system is not active (for backwards compatibility)
	zIndex?: number; // Z-index for stacking order (only used when not in a view)
	isView?: boolean; // Whether this div is a view (page/breakpoint)
	viewName?: string; // Name of the view if isView is true
	breakpointWidth?: number; // Width of the view if isView is true
}

export interface Page {
	id: string;
	name: string; // e.g., "Homepage", "About"
	slug: string; // URL slug
	canvasElements: string[]; // Root element IDs on canvas (DOM order for layer ordering)
	// Array index 0 = bottom layer, last index = top layer
}

export interface Group {
	id: string;
	elementIds: string[]; // Element IDs that belong to this group
}

export interface Component {
	id: string;
	name: string;
	elementIds: string[]; // Element IDs that make up this component
}

export interface DesignState {
	pages: Record<string, Page>;
	elements: Record<string, Element>;
	groups: Record<string, Group>;
	components: Record<string, Component>;
	pageOrder: string[];
	currentPageId: string | null;
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
