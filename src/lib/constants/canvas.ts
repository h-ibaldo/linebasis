/**
 * Canvas interaction and UI constants
 * Centralized configuration for consistent behavior across canvas components
 */

/**
 * Interaction thresholds for drag/resize operations
 */
export const CANVAS_INTERACTION = {
	/** Minimum movement in pixels before considering it a drag operation */
	MOVEMENT_THRESHOLD: 2,

	/** Dead zone in pixels for resize start to avoid initial jump */
	RESIZE_START_THRESHOLD: 3,

	/** Minimum element size in pixels when creating new elements */
	MIN_ELEMENT_SIZE: 10
} as const;

/**
 * Visual UI element sizes
 */
export const CANVAS_UI = {
	/** Size of resize handles in pixels */
	HANDLE_SIZE: 8,

	/** Base distance from corner resize handle for radius handles in pixels */
	RADIUS_HANDLE_BASE_DISTANCE: 10
} as const;
