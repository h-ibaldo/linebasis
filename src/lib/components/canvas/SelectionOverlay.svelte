<script lang="ts">
	/**
	 * SelectionOverlay - Renders selection UI and handles interactions
	 *
	 * Architecture:
	 * - Renders ABOVE all canvas elements in a separate fixed layer
	 * - Handles all drag/resize interactions for selected elements
	 * - Maintains constant visual size regardless of canvas zoom
	 * - Future: measurements, angles, distances, alignment guides
	 */

	import { onMount, onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { Element, DesignState } from '$lib/types/events';
	import { designState, moveElement, resizeElement, rotateElement, moveElementsGroup, resizeElementsGroup, rotateElementsGroup, selectElement, selectElements, clearSelection, addToSelection, removeFromSelection, updateElementStyles, reorderElement, duplicateElements, deleteElements } from '$lib/stores/design-store';
	import { interactionState, updateInteractionStateThrottled, updateInteractionStateImmediate } from '$lib/stores/interaction-store';
	import { currentTool } from '$lib/stores/tool-store';
	import { CANVAS_INTERACTION } from '$lib/constants/canvas';
	import SelectionUI from './SelectionUI.svelte';

	// Props
	export let viewport: { x: number; y: number; scale: number };
	export let selectedElements: Element[];
	export let isPanning: boolean = false;

	// Event listener cleanup registry to prevent memory leaks
	// Stores cleanup functions for all active event listeners
	const cleanupFunctions: Array<() => void> = [];

	// Helper to register event listeners with automatic cleanup
	function addTrackedEventListener<K extends keyof DocumentEventMap>(
		target: EventTarget,
		event: K,
		handler: (event: DocumentEventMap[K]) => void
	) {
		target.addEventListener(event, handler as EventListener);
		cleanupFunctions.push(() => target.removeEventListener(event, handler as EventListener));
	}

	// Local interaction state
	let activeElementId: string | null = null;
	let interactionMode: 'idle' | 'dragging' | 'resizing' | 'rotating' | 'radius' = 'idle';
	let resizeHandle: string | null = null;
	let isGroupInteraction = false; // Track if interacting with multiple elements
	let hoveredElementId: string | null = null; // Element currently being hovered (for hover border)
	let isDuplicateDrag = false; // Track if Alt key is currently held during drag
	let originalElementIds: string[] = []; // IDs of original elements before duplication
	let duplicateElementIds: string[] = []; // IDs of duplicate elements created during Alt+drag
	let hasDuplicated = false; // Track if duplication has occurred this drag session

	// Pending transform during interaction (for live preview)
	let pendingPosition: { x: number; y: number } | null = null;
	let pendingSize: { width: number; height: number } | null = null;
	let pendingRotation: number | null = null;
	let pendingRadius: number | null = null;
	let rotationStartAngle: number = 0; // Initial angle at rotation start
	let elementStartRotation: number = 0; // Element's rotation at start
	let rotationReferenceCorner: 'nw' | 'ne' | 'se' | 'sw' = 'ne'; // Which corner to align with cursor during rotation
	let rotationInitialOffset: number = 0; // Initial angular offset between cursor and corner to prevent jump

	// Debug visualization for rotation
	let debugCenter: { x: number; y: number } | null = null;
	let debugCorner: { x: number; y: number } | null = null;
	let debugCursor: { x: number; y: number } | null = null;
	let debugCenterAngle: number = 0;
	let debugCornerAngle: number = 0;
	let debugCursorAngle: number = 0;
	let debugCornerBaseAngle: number = 0;
	let debugTargetRotation: number = 0;
	let radiusCorner: 'nw' | 'ne' | 'se' | 'sw' | null = null; // Which corner is being adjusted
	let radiusStartDistance: number = 0; // Initial distance from corner at drag start
	let radiusInitialValue: number = 0; // Initial radius value at drag start
	let radiusCornersIndependent: boolean = false; // Track if corners are currently independent (desynchronized)
	let radiusStartedIndependent: boolean = false; // Track if corners were already independent when drag started
	let radiusAltKeyPressed: boolean = false; // Track current Alt key state during radius drag
	let radiusValuesWhenToggled: { nw: number; ne: number; se: number; sw: number } | null = null; // Capture corner values when toggling to independent
	let radiusFrozenValues: { nw: number; ne: number; se: number; sw: number } | null = null; // Frozen values for visual feedback during independent drag
	let groupPendingTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }> = new Map();

	// Auto layout reordering state
	let reorderTargetIndex: number | null = null;
	let reorderParentId: string | null = null;
	let reorderOriginalIndex: number | null = null;
	let lastAppliedIndex: number | null = null;
	let reorderGhostOffset: { x: number; y: number } = { x: 0, y: 0 }; // Offset from cursor to element top-left
	let reorderElementRotation: number = 0; // Rotation of element being reordered
	let reorderElementSize: { width: number; height: number } = { width: 0, height: 0 }; // Size of element being reordered
	let currentMouseScreen: { x: number; y: number } = { x: 0, y: 0 }; // Current mouse position for debug
	let hasMovedBeyondThreshold: boolean = false; // Track if we've moved past the drag threshold

	// Screen-space debug helpers for rotation visualization (account for canvas DOM offset)
	let debugCenterScreen: { x: number; y: number } | null = null;
	let debugCornerScreen: { x: number; y: number } | null = null;
	let debugCursorScreen: { x: number; y: number } | null = null;

	$: {
		if (interactionMode === 'rotating' && debugCenter && debugCorner) {
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			if (canvasElement) {
				const canvasRect = canvasElement.getBoundingClientRect();

				// Center and corner: convert from canvas-space (debugCenter/debugCorner) to screen-space
				debugCenterScreen = {
					x: canvasRect.left + viewport.x + debugCenter.x * viewport.scale,
					y: canvasRect.top + viewport.y + debugCenter.y * viewport.scale
				};

				debugCornerScreen = {
					x: canvasRect.left + viewport.x + debugCorner.x * viewport.scale,
					y: canvasRect.top + viewport.y + debugCorner.y * viewport.scale
				};

				// Cursor: use actual OS cursor position directly (already in screen space)
				debugCursorScreen = {
					x: currentMouseScreen.x,
					y: currentMouseScreen.y
				};
			} else {
				debugCenterScreen = debugCornerScreen = debugCursorScreen = null;
			}
		} else {
			debugCenterScreen = debugCornerScreen = debugCursorScreen = null;
		}
	}

	// Note: DOM reordering during drag has been disabled as it causes flashing issues
	// and is no longer needed with the new drop restrictions (views/auto-layout only).
	// The visual stacking is handled by CSS z-index and position: absolute, which works
	// correctly without DOM manipulation.
	//
	// Previous behavior: Temporarily moved dragged element above droppable target if behind
	// Problem: Caused constant DOM reordering and flashing when dragging
	// Solution: Removed DOM manipulation - rely on CSS positioning instead

	// Parent change detection during drag (for dragging elements out of/into divs)
	let potentialDropParentId: string | null = null; // Element being hovered over that could become new parent
	let originalParentId: string | null = null; // Original parent at drag start (to detect if parent changed)

	/**
	 * Find the container element that the dragged element overlaps with
	 * Returns null if the element is completely outside all containers (should drop at root level)
	 */
	function findDropParentAtPosition(
		elementX: number,
		elementY: number,
		elementWidth: number,
		elementHeight: number,
		draggedElementId: string
	): string | null {
		const state = get(designState);
		const draggedElement = state.elements[draggedElementId];
		if (!draggedElement) return null;

		// Container types that can accept children
		// Note: divs have special restrictions - only views or auto-layout divs can accept drops
		const containerTypes = ['div', 'section', 'header', 'footer', 'article', 'aside', 'nav', 'main'];

		// Get visual boundaries from DOM for accurate containment checking
		const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
		const canvasRect = canvasElement?.getBoundingClientRect();
		if (!canvasRect) return null;

		// Use the passed-in position and size (which represents where we're dragging to)
		// NOT the DOM position (which may be controlled by auto-layout and doesn't reflect drag position)
		const draggedVisualLeft = elementX;
		const draggedVisualRight = elementX + elementWidth;
		const draggedVisualTop = elementY;
		const draggedVisualBottom = elementY + elementHeight;

		// IMPORTANT: Check if element is still within its original parent's visual boundaries
		// Use rotated rectangle check instead of bounding box for accurate detection
		if (originalParentId && state.elements[originalParentId]) {
			const originalParent = state.elements[originalParentId];

			// When checking if element should stay in CURRENT parent during drag,
			// we DON'T apply drop restrictions - elements can stay in any container
			// Drop restrictions only apply when finding a NEW parent below
			if (containerTypes.includes(originalParent.type)) {
				const parentRotation = getDisplayRotation(originalParent);
				const parentRotationRad = parentRotation * (Math.PI / 180);
				const parentAbsPos = getAbsolutePosition(originalParent);

				// Parent's center in canvas space
				const parentCenterX = parentAbsPos.x + originalParent.size.width / 2;
				const parentCenterY = parentAbsPos.y + originalParent.size.height / 2;

				// Check if ANY corner of dragged element is inside the rotated parent
				const elementCorners = [
					{ x: draggedVisualLeft, y: draggedVisualTop },      // Top-left
					{ x: draggedVisualRight, y: draggedVisualTop },     // Top-right
					{ x: draggedVisualRight, y: draggedVisualBottom },  // Bottom-right
					{ x: draggedVisualLeft, y: draggedVisualBottom }    // Bottom-left
				];

				let anyCornerInside = false;
				for (const corner of elementCorners) {
					// Transform corner to parent's local coordinate system
					const relX = corner.x - parentCenterX;
					const relY = corner.y - parentCenterY;

					const cos = Math.cos(-parentRotationRad);
					const sin = Math.sin(-parentRotationRad);
					const localX = relX * cos - relY * sin;
					const localY = relX * sin + relY * cos;

					// Check if corner is inside parent's bounds
					const halfWidth = originalParent.size.width / 2;
					const halfHeight = originalParent.size.height / 2;

					if (localX > -halfWidth && localX < halfWidth && localY > -halfHeight && localY < halfHeight) {
						anyCornerInside = true;
						break;
					}
				}

				// Special rule for regular divs (not views, not auto-layout):
				// Children cannot be dragged out - they're locked inside
				// The only way to remove them is via copy/cut and paste outside
				const isRegularDiv = originalParent.type === 'div' &&
					!originalParent.isView &&
					!originalParent.autoLayout?.enabled;

				if (isRegularDiv) {
					// Force element to stay in parent even if all corners are outside
					return originalParentId;
				}

				// If ANY corner is still within original parent, keep the original parent
				// (only for non-regular divs - views and auto-layout divs can be dragged out of)
				if (anyCornerInside) {
					return originalParentId;
				}
			}
		}

		// Element has moved beyond its original parent (or had no parent)
		// Now find overlapping containers to determine the new parent
		const overlappingContainers: Element[] = [];

		for (const elementId in state.elements) {
			const element = state.elements[elementId];

			// Skip the dragged element and its descendants
			if (element.id === draggedElementId) continue;
			if (isDescendant(draggedElementId, element.id, state)) continue;
			// Skip if dragged element is ancestor of this element (can't drop parent into child)
			if (isDescendant(element.id, draggedElementId, state)) continue;

			// Only consider container elements as potential parents
			if (!containerTypes.includes(element.type)) continue;

			// Special restriction for divs: only allow drops into views or auto-layout divs
			// This prevents the unnatural HTML behavior of arbitrary nesting
			if (element.type === 'div') {
				const isView = element.isView === true;
				const hasAutoLayout = element.autoLayout?.enabled === true;

				// Skip this div if it's not a view and doesn't have auto layout
				if (!isView && !hasAutoLayout) {
					continue;
				}
			}

			// Check containment using actual rotated rectangle, not bounding box
			// Get container's stored position and rotation
			const containerAbsPos = getAbsolutePosition(element);
			const containerRotation = getDisplayRotation(element);
			const containerRotationRad = containerRotation * (Math.PI / 180);
			
			// Container's center in canvas space
			const containerCenterX = containerAbsPos.x + element.size.width / 2;
			const containerCenterY = containerAbsPos.y + element.size.height / 2;
			
			// Check if all four corners of dragged element's bounding box are inside the rotated container
			// Transform each corner to container's local coordinate system and check bounds
			const elementCorners = [
				{ x: draggedVisualLeft, y: draggedVisualTop },      // Top-left
				{ x: draggedVisualRight, y: draggedVisualTop },     // Top-right
				{ x: draggedVisualRight, y: draggedVisualBottom }, // Bottom-right
				{ x: draggedVisualLeft, y: draggedVisualBottom }    // Bottom-left
			];
			
			let allCornersInside = true;
			for (const corner of elementCorners) {
				// Transform corner to container's local coordinate system (rotate by -containerRotation)
				const relX = corner.x - containerCenterX;
				const relY = corner.y - containerCenterY;
				
				const cos = Math.cos(-containerRotationRad);
				const sin = Math.sin(-containerRotationRad);
				const localX = relX * cos - relY * sin;
				const localY = relX * sin + relY * cos;
				
				// Check if corner is inside container's bounds (with strict boundaries)
				const halfWidth = element.size.width / 2;
				const halfHeight = element.size.height / 2;
				
				if (!(localX > -halfWidth && localX < halfWidth && localY > -halfHeight && localY < halfHeight)) {
					allCornersInside = false;
					break;
				}
			}
			
			const isFullyContained = allCornersInside;

			if (isFullyContained) {
				overlappingContainers.push(element);
			}
		}

		// Sort by z-index (highest first) to get topmost container
		overlappingContainers.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

		const result = overlappingContainers.length > 0 ? overlappingContainers[0].id : null;

		// Return the topmost overlapping container (or null to drop at root)
		return result;
	}

	/**
	 * Check if childId is a descendant of parentId
	 */
	function isDescendant(parentId: string, childId: string, state: DesignState): boolean {
		let currentId: string | null = childId;
		while (currentId) {
			const element: Element | undefined = state.elements[currentId];
			if (!element) return false;
			if (element.parentId === parentId) return true;
			currentId = element.parentId;
		}
		return false;
	}

	/**
	 * Calculate the actual top-left position for a rotated element in screen space
	 * For non-rotated elements, this is just the bounding box top-left
	 * For rotated elements with transform-origin: center center, the element's center stays fixed
	 * and we need to calculate where the top-left corner is
	 */
	function calculateActualTopLeftForRotated(
		boundingRect: DOMRect,
		elementSize: { width: number; height: number },
		rotation: number,
		scale: number
	): { left: number; top: number } {
		if (rotation === 0) {
			return { left: boundingRect.left, top: boundingRect.top };
		}

		// Get the element's unrotated size in screen pixels
		const width = elementSize.width * scale;
		const height = elementSize.height * scale;

		// For elements with transform-origin: center center (which CanvasElement uses):
		// The center of the element stays at the same position
		// The bounding box center IS the element's rotation center
		const elementCenterX = boundingRect.left + boundingRect.width / 2;
		const elementCenterY = boundingRect.top + boundingRect.height / 2;

		// The top-left corner is offset from center by half the dimensions
		// Since the element is NOT rotated around top-left, we just offset from center
		const topLeftX = elementCenterX - width / 2;
		const topLeftY = elementCenterY - height / 2;

		return {
			left: topLeftX,
			top: topLeftY
		};
	}

	// Get actual rendered size for auto-sized elements (inline-block text, auto layout)
	function getActualSize(element: Element): { width: number; height: number } {
		const state = get(designState);

		// Check if element is in auto layout mode
		const parent = element.parentId ? state.elements[element.parentId] : null;
		const parentHasAutoLayout = parent?.autoLayout?.enabled || false;
		const childIgnoresAutoLayout = element.autoLayout?.ignoreAutoLayout || false;
		const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;

		// IMPORTANT: Don't use getBoundingClientRect for rotated elements (or elements in rotated parents)
		// because it returns the bounding box (which is larger), not the actual size
		const totalRotation = getCumulativeRotation(element) + (element.rotation || 0);
		// Floating point precision check
		const isRotated = Math.abs(totalRotation % 360) > 0.1;

		// For rotated elements in auto layout, get the intrinsic size from CSS
		// (flexbox may have resized the element to fit the bounding box)
		if (isRotated && isInAutoLayout) {
			const domElement = document.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement;
			if (domElement) {
				// Get computed style to see the actual CSS width/height
				// computedStyle returns CSS pixel values (canvas units), NOT screen pixels
				// So we DON'T divide by viewport.scale here
				const computedStyle = window.getComputedStyle(domElement);
				const width = parseFloat(computedStyle.width);
				const height = parseFloat(computedStyle.height);

				// Only use computed size if it's valid
				if (!isNaN(width) && !isNaN(height)) {
					return { width, height };
				}
			}
		}

		// If element has display: inline-block OR is in auto layout (and not rotated), get actual rendered size from DOM
		if (!isRotated && (element.styles?.display === 'inline-block' || isInAutoLayout)) {
			const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
			if (domElement) {
				const rect = domElement.getBoundingClientRect();
				// Account for viewport scale
				return {
					width: rect.width / viewport.scale,
					height: rect.height / viewport.scale
				};
			}
		}
		// Otherwise use stored size
		return element.size;
	}

	// Get display size for SelectionUI (actual rendered size for auto elements)
	$: displaySizeForSelection = selectedElements.length === 1
		? getActualSize(selectedElements[0])
		: null;

	// Helper: Get cumulative rotation of all ancestors (for Selection UI)
	function getCumulativeRotation(element: Element): number {
		const state = get(designState);
		let totalRotation = 0;

		let current = element;
		while (current.parentId) {
			const parent = state.elements[current.parentId];
			if (!parent) break;
			totalRotation += parent.rotation || 0;
			current = parent;
		}

		return totalRotation;
	}

	// Broadcast state to store for CanvasElement to consume
	$: {
		// Calculate pending corner radii for independent mode OR when element has individual corners
		let cornerRadii: { nw: number; ne: number; se: number; sw: number } | null = null;

		if (radiusCorner && pendingRadius !== null) {
			const activeElement = selectedElements.find(el => el.id === activeElementId);
			if (activeElement) {
				// Check if element has individual corner styles
				const hasIndividualCorners = !!(
					activeElement.styles?.borderTopLeftRadius ||
					activeElement.styles?.borderTopRightRadius ||
					activeElement.styles?.borderBottomRightRadius ||
					activeElement.styles?.borderBottomLeftRadius
				);

				// Only set cornerRadii if we're in independent mode OR element has individual corners
				if (radiusCornersIndependent || hasIndividualCorners) {
					if (radiusCornersIndependent) {
						// Independent mode: update only the active corner, keep others at their current values
						const getCurrentValue = (corner: 'nw' | 'ne' | 'se' | 'sw'): number => {
							if (radiusFrozenValues) {
								return radiusFrozenValues[corner];
							}
							// Get from element's individual corner styles
							const cornerProperty = {
								'nw': activeElement.styles?.borderTopLeftRadius,
								'ne': activeElement.styles?.borderTopRightRadius,
								'se': activeElement.styles?.borderBottomRightRadius,
								'sw': activeElement.styles?.borderBottomLeftRadius
							}[corner];
							return parseFloat(cornerProperty as string) || 0;
						};

						cornerRadii = {
							nw: radiusCorner === 'nw' ? pendingRadius : getCurrentValue('nw'),
							ne: radiusCorner === 'ne' ? pendingRadius : getCurrentValue('ne'),
							se: radiusCorner === 'se' ? pendingRadius : getCurrentValue('se'),
							sw: radiusCorner === 'sw' ? pendingRadius : getCurrentValue('sw')
						};
					} else {
						// Synchronized mode but element has individual corners: set all to pendingRadius
						cornerRadii = {
							nw: pendingRadius,
							ne: pendingRadius,
							se: pendingRadius,
							sw: pendingRadius
						};
					}
				}
			}
		}

		// Use throttled updates during interactions for better performance
		// Limits updates to 60fps via requestAnimationFrame
		// NOTE: Do NOT include editingElementId here - it's managed exclusively by startEditingText/stopEditingText
		// Including it causes issues where it gets restored after being cleared
		updateInteractionStateThrottled({
			activeElementId,
			mode: interactionMode,
			pendingPosition,
			pendingSize,
			pendingRotation,
			pendingRadius,
			pendingCornerRadii: cornerRadii,
			groupTransforms: groupPendingTransforms,
			hiddenDuringTransition: $interactionState.hiddenDuringTransition // Preserve during reactive updates
		});
	}

	// Drag start tracking
	let dragStartScreen = { x: 0, y: 0 };
	let elementStartCanvas = { x: 0, y: 0, width: 0, height: 0 };
	let dragOffsetCanvas = { x: 0, y: 0 }; // Offset from cursor to element's top-left at drag start
	let rotationStartCenter: { x: number; y: number; screenX: number; screenY: number } | null = null; // Fixed center at rotation start (for child elements)
	let groupStartElements: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }> = [];
	let hasMovedPastThreshold = false; // Track if we've moved past the initial dead zone
	let initialHandlePosition: Point | null = null; // The ideal position of the handle being dragged at start
	let mouseToHandleOffset: Point = { x: 0, y: 0 }; // Offset from mouse click to ideal handle position

	/**
	 * Normalize rotation angle to -180 to 180 degree range
	 * Properly handles negative angles
	 */
	function normalizeRotation(rotation: number): number {
		// First normalize to 0-360 range
		let normalized = rotation % 360;

		// Handle negative modulo results (JavaScript preserves sign in modulo)
		if (normalized < 0) normalized += 360;

		// Convert to -180 to 180 range
		if (normalized > 180) normalized -= 360;

		return normalized;
	}

	// Calculate bounding box for multiple elements
	function getGroupBounds(elements: Element[]): { x: number; y: number; width: number; height: number } {
		if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const el of elements) {
			const pos = getDisplayPosition(el);
			const size = getDisplaySize(el);
			const rotation = getDisplayRotation(el);

			if (rotation !== 0) {
				// For rotated elements, get all four corners and find their bounds
				const corners = getRotatedCorners({
					x: pos.x,
					y: pos.y,
					width: size.width,
					height: size.height,
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
				minX = Math.min(minX, pos.x);
				minY = Math.min(minY, pos.y);
				maxX = Math.max(maxX, pos.x + size.width);
				maxY = Math.max(maxY, pos.y + size.height);
			}
		}

		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	}

	// Calculate unrotated bounding box for multiple elements (used for resize handles)
	function getUnrotatedGroupBounds(elements: Element[]): { x: number; y: number; width: number; height: number } {
		if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const el of elements) {
			const pos = getDisplayPosition(el);
			const size = getDisplaySize(el);

			minX = Math.min(minX, pos.x);
			minY = Math.min(minY, pos.y);
			maxX = Math.max(maxX, pos.x + size.width);
			maxY = Math.max(maxY, pos.y + size.height);
		}

		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	}

	// Reactive: compute group bounds (depends on groupPendingTransforms for live updates)
	// Use rotated bounds to properly surround rotated elements
	// During interactions, use the pending transforms to show real-time updates
	$: groupBounds = (() => {
		if (selectedElements.length <= 1) return null;

		// If we're in a group interaction and have pending transforms, calculate bounds from those
		if (isGroupInteraction && groupPendingTransforms.size > 0) {
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

			for (const el of selectedElements) {
				const pending = groupPendingTransforms.get(el.id);
				if (!pending) continue;

				const pos = pending.position;
				const size = pending.size;
				const rotation = pending.rotation || 0;

				if (rotation !== 0) {
					// For rotated elements, get all four corners and find their bounds
					const corners = getRotatedCorners({
						x: pos.x,
						y: pos.y,
						width: size.width,
						height: size.height,
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
					minX = Math.min(minX, pos.x);
					minY = Math.min(minY, pos.y);
					maxX = Math.max(maxX, pos.x + size.width);
					maxY = Math.max(maxY, pos.y + size.height);
				}
			}

			return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
		}

		// Otherwise use the current state
		return getGroupBounds(selectedElements);
	})();

	// Helper: Get common rotation angle if all selected elements have the same rotation
	function getCommonRotation(elements: Element[]): number | null {
		if (elements.length === 0) return null;

		// Get rotation from pending state if rotating, otherwise from elements
		if (interactionMode === 'rotating' && pendingRotation !== null) {
			return pendingRotation;
		}

		const firstRotation = elements[0].rotation || 0;
		const allSame = elements.every(el => (el.rotation || 0) === firstRotation);
		return allSame ? firstRotation : null;
	}

	// Reactive: compute common rotation (also depends on interactionMode and pendingRotation)
	let commonRotation: number | null;
	$: {
		// Trigger reactivity on these values
		interactionMode;
		pendingRotation;
		commonRotation = getCommonRotation(selectedElements);
	}

	// Geometry helpers for rotated resize
	interface Point {
		x: number;
		y: number;
	}

	interface RotatedRect {
		x: number;
		y: number;
		width: number;
		height: number;
		rotation: number;
	}

	/**
	 * Get the four corners of a rotated rectangle in world space
	 * Returns [topLeft, topRight, bottomRight, bottomLeft]
	 */
	function getRotatedCorners(rect: RotatedRect): [Point, Point, Point, Point] {
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
		})) as [Point, Point, Point, Point];
	}

	/**
	 * Get the index of the opposite corner for a given resize handle
	 * 0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left
	 */
	function getAnchorCornerIndex(handle: string): number {
		if (handle === 'nw') return 2; // Bottom-right
		if (handle === 'ne') return 3; // Bottom-left
		if (handle === 'se') return 0; // Top-left
		if (handle === 'sw') return 1; // Top-right
		return -1;
	}

	/**
	 * Calculate new rectangle for rotated resize
	 *
	 * APPROACH: When resizing a rotated rectangle:
	 * 1. We have a fixed point (opposite corner/edge or center)
	 * 2. We transform the element's START state into a local coordinate system where the fixed point is at origin
	 * 3. We project the mouse position onto this local coordinate system
	 * 4. We calculate new dimensions, then transform back to world space
	 */
	function calculateRectFromFixedPoint(
		fixedPoint: Point,
		mouseCanvas: Point,
		rotation: number,
		maintainAspectRatio: boolean,
		originalAspectRatio: number,
		isFromCenter: boolean,
		currentWidth: number,
		currentHeight: number,
		handle: string
	): { width: number; height: number; x: number; y: number } {
		const angleRad = rotation * (Math.PI / 180);
		const cos = Math.cos(angleRad);
		const sin = Math.sin(angleRad);

		const isCornerHandle = handle.length === 2;

		// Transform mouse position to local space (rotated coordinate system)
		// In this local space, the element's axes are aligned with X and Y
		const worldDx = mouseCanvas.x - fixedPoint.x;
		const worldDy = mouseCanvas.y - fixedPoint.y;

		// Rotate by -angle to get to local space
		const localDx = worldDx * cos + worldDy * sin;
		const localDy = -worldDx * sin + worldDy * cos;

		// Calculate new dimensions based on which handle is being dragged
		// The key insight: localDx and localDy represent the vector from fixed point to mouse in local space
		// For dimensions, we want absolute values, but we also need to track if the mouse crossed over
		let newWidth: number;
		let newHeight: number;

		if (isCornerHandle) {
			if (isFromCenter) {
				// When resizing from center, the mouse distance is half the dimension
				newWidth = Math.abs(localDx) * 2;
				newHeight = Math.abs(localDy) * 2;
			} else {
				// Normal resize: the distance from fixed point to mouse is the dimension
				// Use absolute values since dimensions are always positive
				newWidth = Math.abs(localDx);
				newHeight = Math.abs(localDy);
			}

			if (maintainAspectRatio) {
				// Lock aspect ratio - use the larger dimension change
				if (Math.abs(localDx) > Math.abs(localDy)) {
					newHeight = newWidth / originalAspectRatio;
				} else {
					newWidth = newHeight * originalAspectRatio;
				}
			}
		} else {
			// Edge handle
			if (handle === 'n' || handle === 's') {
				newHeight = isFromCenter ? Math.abs(localDy) * 2 : Math.abs(localDy);
				newWidth = maintainAspectRatio ? newHeight * originalAspectRatio : currentWidth;
			} else {
				newWidth = isFromCenter ? Math.abs(localDx) * 2 : Math.abs(localDx);
				newHeight = maintainAspectRatio ? newWidth / originalAspectRatio : currentHeight;
			}
		}

		// Now calculate where the top-left corner should be in world space
		// We know:
		// - The fixedPoint location in world space
		// - The new dimensions
		// - Where the fixed point is relative to the new rectangle's center (in local space)

		// Determine the fixed point's position in the NEW rectangle's local space
		let fixedLocalX: number, fixedLocalY: number;

		if (isFromCenter) {
			// Center is fixed - it's at (0, 0) in local space
			fixedLocalX = 0;
			fixedLocalY = 0;
		} else if (isCornerHandle) {
			// Fixed corner is opposite to the handle being dragged
			// In local space (center-relative coords):
			if (handle === 'se') { fixedLocalX = -newWidth / 2; fixedLocalY = -newHeight / 2; } // Fixed at NW
			else if (handle === 'sw') { fixedLocalX = newWidth / 2; fixedLocalY = -newHeight / 2; } // Fixed at NE
			else if (handle === 'ne') { fixedLocalX = -newWidth / 2; fixedLocalY = newHeight / 2; } // Fixed at SW
			else if (handle === 'nw') { fixedLocalX = newWidth / 2; fixedLocalY = newHeight / 2; } // Fixed at SE
			else { fixedLocalX = 0; fixedLocalY = 0; }
		} else {
			// Edge handle - fixed edge center
			if (handle === 'n') { fixedLocalX = 0; fixedLocalY = newHeight / 2; } // S edge fixed
			else if (handle === 's') { fixedLocalX = 0; fixedLocalY = -newHeight / 2; } // N edge fixed
			else if (handle === 'e') { fixedLocalX = -newWidth / 2; fixedLocalY = 0; } // W edge fixed
			else if (handle === 'w') { fixedLocalX = newWidth / 2; fixedLocalY = 0; } // E edge fixed
			else { fixedLocalX = 0; fixedLocalY = 0; }
		}

		// Convert the fixed point's local position to world space offset from center
		// fixedPoint (world) = center (world) + rotate(fixedLocal)
		// Therefore: center (world) = fixedPoint (world) - rotate(fixedLocal)
		const rotatedFixedX = fixedLocalX * cos - fixedLocalY * sin;
		const rotatedFixedY = fixedLocalX * sin + fixedLocalY * cos;

		const newCenterX = fixedPoint.x - rotatedFixedX;
		const newCenterY = fixedPoint.y - rotatedFixedY;

		// Now calculate the top-left corner position
		// IMPORTANT: The position {x, y} represents the top-left of the UNROTATED rectangle
		// So we simply subtract half-widths from the center (no rotation needed)
		const newX = newCenterX - newWidth / 2;
		const newY = newCenterY - newHeight / 2;

		return { x: newX, y: newY, width: newWidth, height: newHeight };
	}

	// Helper: Get absolute position (relative to canvas, not parent)
	function getAbsolutePosition(element: Element): { x: number; y: number } {
		const state = get(designState);

		// Check if element is in auto layout mode (parent has auto layout and child doesn't ignore it)
		const parent = element.parentId ? state.elements[element.parentId] : null;
		const parentHasAutoLayout = parent?.autoLayout?.enabled || false;
		const childIgnoresAutoLayout = element.autoLayout?.ignoreAutoLayout || false;
		const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;
		const isRotated = element.rotation && element.rotation !== 0;

		// If in auto layout, get actual rendered position from DOM
		if (isInAutoLayout) {
			const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
			if (domElement) {
				const rect = domElement.getBoundingClientRect();
				const canvasElement = document.querySelector('.canvas');
				if (canvasElement) {
					const canvasRect = canvasElement.getBoundingClientRect();

					// For rotated elements, getBoundingClientRect gives us the bounding box position
					// We need to calculate the actual element's top-left from the center
					if (isRotated) {
						// Get bounding box center in canvas coordinates
						const boundingCenterX = (rect.left + rect.width / 2 - canvasRect.left - viewport.x) / viewport.scale;
						const boundingCenterY = (rect.top + rect.height / 2 - canvasRect.top - viewport.y) / viewport.scale;

						// The bounding box center IS the element's center (rotation doesn't change the center)
						// Calculate top-left from center using element's actual size (not bounding box size)
						// IMPORTANT: Use getActualSize to get the same size that the selection UI will use
						const actualSize = getActualSize(element);
						return {
							x: boundingCenterX - actualSize.width / 2,
							y: boundingCenterY - actualSize.height / 2
						};
					}

					// For non-rotated elements, use top-left directly
					return {
						x: (rect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (rect.top - canvasRect.top - viewport.y) / viewport.scale
					};
				}
			}
		}

		// Otherwise, use stored coordinates and traverse parent chain
		// IMPORTANT: We need to apply parent transforms (position AND rotation) correctly

		// Build ancestor chain from element to root
		const ancestors: Array<{ position: { x: number; y: number }; size: { width: number; height: number }; rotation: number }> = [];
		let currentElement = element;

		while (currentElement.parentId) {
			const parent = state.elements[currentElement.parentId];
			if (!parent) break;

			ancestors.push({
				position: parent.position,
				size: parent.size,
				rotation: parent.rotation || 0
			});

			currentElement = parent;
		}

		// Start with element's local position
		let x = element.position.x;
		let y = element.position.y;

		// Apply transforms from immediate parent to root (reverse order)
		for (let i = 0; i < ancestors.length; i++) {
			const ancestor = ancestors[i];

			// If parent is rotated, we need to rotate the child's position around parent's center
			if (ancestor.rotation !== 0) {
				const centerX = ancestor.size.width / 2;
				const centerY = ancestor.size.height / 2;

				// Translate to parent's center
				const relX = x - centerX;
				const relY = y - centerY;

				// Apply rotation
				const angleRad = ancestor.rotation * (Math.PI / 180);
				const cos = Math.cos(angleRad);
				const sin = Math.sin(angleRad);

				const rotatedX = relX * cos - relY * sin;
				const rotatedY = relX * sin + relY * cos;

				// Translate back from center
				x = rotatedX + centerX;
				y = rotatedY + centerY;
			}

			// Add parent's position
			x += ancestor.position.x;
			y += ancestor.position.y;
		}

		return { x, y };
	}

	// Helper: Convert absolute position to parent-relative position
	// This properly handles rotated parent hierarchies
	function absoluteToRelativePosition(element: Element, absolutePos: { x: number; y: number }): { x: number; y: number } {
		const state = get(designState);

		// If element has no parent, absolute = relative
		if (!element.parentId) {
			return absolutePos;
		}

		// Get parent's absolute position
		const parent = state.elements[element.parentId];
		if (!parent) {
			return absolutePos;
		}

		// Build the ancestor chain from root to immediate parent
		const ancestors: Array<{
			id: string;
			position: { x: number; y: number };
			size: { width: number; height: number };
			rotation: number;
		}> = [];
		let currentParent = parent;

		while (currentParent) {
			ancestors.unshift({
				id: currentParent.id,
				position: currentParent.position,
				size: currentParent.size,
				rotation: currentParent.rotation || 0
			});

			if (!currentParent.parentId) break;
			const nextParent = state.elements[currentParent.parentId];
			if (!nextParent) break;
			currentParent = nextParent;
		}

		// Start with absolute position
		let x = absolutePos.x;
		let y = absolutePos.y;

		// Apply inverse transform for each ancestor (from root to immediate parent)
		for (const ancestor of ancestors) {
			// Subtract the ancestor's position (in its parent's coordinate space)
			x -= ancestor.position.x;
			y -= ancestor.position.y;

			// If ancestor is rotated, we need to apply inverse rotation around its center
			// CSS rotation uses the element's center as transform-origin
			if (ancestor.rotation !== 0) {
				// Get ancestor's center point (in its local coordinate space, which is now our current space)
				const centerX = ancestor.size.width / 2;
				const centerY = ancestor.size.height / 2;

				// Translate to origin (relative to ancestor's center)
				const relX = x - centerX;
				const relY = y - centerY;

				// Apply inverse rotation
				const angleRad = -ancestor.rotation * (Math.PI / 180); // Negative for inverse
				const cos = Math.cos(angleRad);
				const sin = Math.sin(angleRad);

				const rotatedX = relX * cos - relY * sin;
				const rotatedY = relX * sin + relY * cos;

				// Translate back from origin
				x = rotatedX + centerX;
				y = rotatedY + centerY;
			}
		}

		return { x, y };
	}

	// Helper: Get display position (pending or actual, in absolute coordinates)
	function getDisplayPosition(element: Element): { x: number; y: number } {
		if (isGroupInteraction && groupPendingTransforms.has(element.id)) {
			return groupPendingTransforms.get(element.id)!.position;
		}

		// If this element is being interacted with and has pending position, use it
		// Otherwise calculate absolute position from element hierarchy
		if (pendingPosition && activeElementId === element.id) {
			return pendingPosition;
		}

		return getAbsolutePosition(element);
	}

	// Helper: Get display size (pending or actual)
	function getDisplaySize(element: Element): { width: number; height: number } {
		if (isGroupInteraction && groupPendingTransforms.has(element.id)) {
			return groupPendingTransforms.get(element.id)!.size;
		}
		return pendingSize && activeElementId === element.id ? pendingSize : getActualSize(element);
	}

	// Helper: Get display rotation (pending or actual)
	function getDisplayRotation(element: Element): number {
		if (isGroupInteraction && groupPendingTransforms.has(element.id)) {
			return groupPendingTransforms.get(element.id)!.rotation || 0;
		}
		if (interactionMode === 'rotating' && pendingRotation !== null && activeElementId === element.id) {
			return pendingRotation;
		}
		return element.rotation || 0;
	}

	/**
	 * Get all ancestors of an element (from root to immediate parent)
	 * Returns array ordered from root ancestor to immediate parent
	 */
	function getAllAncestors(element: Element): Element[] {
		const state = get(designState);
		const ancestors: Element[] = [];
		
		let currentElement: Element | null = element;
		while (currentElement?.parentId) {
			const parent: Element | undefined = state.elements[currentElement.parentId];
			if (!parent) break;
			ancestors.push(parent);
			currentElement = parent;
		}
		
		// Reverse to get order from root to immediate parent
		return ancestors.reverse();
	}

	// Start group interaction (for multi-selection)
	function startGroupInteraction(e: MouseEvent, handle?: string) {
		const tool = get(currentTool);
		if (tool === 'hand' || isPanning) return;

		// If no handle (just clicking drag area), check if clicking on an actual element
		if (!handle) {
			// Check if we actually moved before considering this a drag
			// If it's just a click, we want to handle element/canvas selection differently
			const startX = e.clientX;
			const startY = e.clientY;
			let hasMoved = false;

			const checkMove = (moveEvent: MouseEvent) => {
				const deltaX = Math.abs(moveEvent.clientX - startX);
				const deltaY = Math.abs(moveEvent.clientY - startY);
				if (deltaX > 3 || deltaY > 3) {
					hasMoved = true;
					startDragging();
				}
			};

			const handleClick = (upEvent: MouseEvent) => {
				// Remove from cleanup registry when manually cleaned up
				document.removeEventListener('mousemove', checkMove);
				document.removeEventListener('mouseup', handleClick);

				// Don't handle clicks if panning is active
				if (isPanning) return;

				if (!hasMoved) {
					// It was a click, not a drag - check what's underneath
					const allSelectionElements = document.querySelectorAll('.selection-border, .drag-area, .resize-handle');
					allSelectionElements.forEach(el => (el as HTMLElement).style.pointerEvents = 'none');

					let elementBelow = document.elementFromPoint(upEvent.clientX, upEvent.clientY);

					allSelectionElements.forEach(el => (el as HTMLElement).style.pointerEvents = '');

					// Find the actual canvas-element wrapper (might be a child element like img)
					let canvasElement: HTMLElement | null = null;
					if (elementBelow) {
						// Check if it's a canvas-element or find the closest one
						if (elementBelow.classList.contains('canvas-element')) {
							canvasElement = elementBelow as HTMLElement;
						} else {
							canvasElement = elementBelow.closest('.canvas-element') as HTMLElement;
						}
					}

					// If we found a canvas element, handle selection based on Shift key
					if (canvasElement) {
						const elementId = canvasElement.getAttribute('data-element-id');
						if (elementId) {
							if (upEvent.shiftKey) {
								// Shift+click: toggle element in selection
								const currentSelection = selectedElements.map(el => el.id);
								if (currentSelection.includes(elementId)) {
									removeFromSelection(elementId);
								} else {
									addToSelection(elementId);
								}
							} else {
								// Normal click: select only this element
								selectElement(elementId);
							}
							return;
						}
					}

					// If clicking empty space, clear selection (unless Shift is held)
					if (!upEvent.shiftKey) {
						clearSelection();
					}
				}
			};

			const startDragging = () => {
				document.removeEventListener('mousemove', checkMove);
				document.removeEventListener('mouseup', handleClick);

				e.stopPropagation();
				e.preventDefault();

				isGroupInteraction = true;
				dragStartScreen = { x: startX, y: startY };

				// Store initial bounds for all elements (use absolute positions)
				groupStartElements = selectedElements.map(el => {
					const absPos = getAbsolutePosition(el);
					return {
						id: el.id,
						x: absPos.x,
						y: absPos.y,
						width: el.size.width,
						height: el.size.height,
						rotation: el.rotation || 0
					};
				});

				// Store group bounds (use unrotated bounds for consistent coordinate system)
				const unrotatedBounds = getUnrotatedGroupBounds(selectedElements);
				elementStartCanvas = {
					x: unrotatedBounds.x,
					y: unrotatedBounds.y,
					width: unrotatedBounds.width,
					height: unrotatedBounds.height
				};

				interactionMode = 'dragging';
				hoveredElementId = null; // Clear hover when starting drag
				pendingPosition = { x: elementStartCanvas.x, y: elementStartCanvas.y };

				document.addEventListener('mousemove', handleMouseMove);
				document.addEventListener('mouseup', handleMouseUp);
			};

			e.stopPropagation();
			e.preventDefault();

			// Use tracked listeners to ensure cleanup on component unmount
			addTrackedEventListener(document, 'mousemove', checkMove);
			addTrackedEventListener(document, 'mouseup', handleClick);
			return;
		}

		// Handle is provided (resize or rotate)
		e.stopPropagation();
		e.preventDefault();

		isGroupInteraction = true;
		dragStartScreen = { x: e.clientX, y: e.clientY };

		// Store initial bounds for all elements (use absolute positions)
		groupStartElements = selectedElements.map(el => {
			const absPos = getAbsolutePosition(el);
			return {
				id: el.id,
				x: absPos.x,
				y: absPos.y,
				width: el.size.width,
				height: el.size.height,
				rotation: el.rotation || 0
			};
		});

		// Store group bounds (use unrotated bounds for resize calculations)
		// This ensures consistent coordinate system when scaling
		const unrotatedBounds = getUnrotatedGroupBounds(selectedElements);
		elementStartCanvas = {
			x: unrotatedBounds.x,
			y: unrotatedBounds.y,
			width: unrotatedBounds.width,
			height: unrotatedBounds.height
		};

		if (handle?.startsWith('rotate')) {
			// Rotation mode
			interactionMode = 'rotating';
			
			// Initialize mouse screen position for debug overlay
			currentMouseScreen = { x: e.clientX, y: e.clientY };

			// Extract corner from handle (e.g., 'rotate-nw' -> 'nw')
			if (handle.includes('-')) {
				rotationReferenceCorner = handle.split('-')[1] as 'nw' | 'ne' | 'se' | 'sw';
			}

			// Calculate center point of selection in canvas space
			const centerX = elementStartCanvas.x + elementStartCanvas.width / 2;
			const centerY = elementStartCanvas.y + elementStartCanvas.height / 2;

			// Get canvas rect for screen-space conversion
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			const canvasRect = canvasElement?.getBoundingClientRect();

			// Convert center to screen space (matches how SelectionUI renders center)
			const centerScreenX = canvasRect
				? canvasRect.left + viewport.x + centerX * viewport.scale
				: centerX;
			const centerScreenY = canvasRect
				? canvasRect.top + viewport.y + centerY * viewport.scale
				: centerY;

			// Calculate initial angle from center to cursor in SCREEN space
			// (angles are preserved under translate+scale, so this matches canvas-space geometry)
			rotationStartAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

			// Store current rotation of first element (for groups, we'll rotate all together)
			elementStartRotation = selectedElements[0].rotation || 0;
			pendingRotation = elementStartRotation;

			// Calculate corner base angle (in local/unrotated space)
			const cornerOffsets = {
				nw: { x: -elementStartCanvas.width / 2, y: -elementStartCanvas.height / 2 },
				ne: { x: elementStartCanvas.width / 2, y: -elementStartCanvas.height / 2 },
				se: { x: elementStartCanvas.width / 2, y: elementStartCanvas.height / 2 },
				sw: { x: -elementStartCanvas.width / 2, y: elementStartCanvas.height / 2 }
			};
			const cornerOffset = cornerOffsets[rotationReferenceCorner];
			const cornerBaseAngle = Math.atan2(cornerOffset.y, cornerOffset.x) * (180 / Math.PI);

			// Calculate initial offset to prevent jump
			// For groups, check if all elements share the same parent rotation
			const state_for_parent = get(designState);
			let parentRotation = 0;
			if (selectedElements.length > 0) {
				const firstElement = selectedElements[0];
				const parent_at_start = firstElement.parentId ? state_for_parent.elements[firstElement.parentId] : null;
				parentRotation = parent_at_start ? (parent_at_start.rotation || 0) : 0;
			}
			// Corner's visual angle = cornerBaseAngle + elementRotation + parentRotation
			rotationInitialOffset = rotationStartAngle - (cornerBaseAngle + elementStartRotation + parentRotation);
		} else {
			// Resize mode
			interactionMode = 'resizing';
			resizeHandle = handle;
			pendingSize = { width: elementStartCanvas.width, height: elementStartCanvas.height };
			pendingPosition = { x: elementStartCanvas.x, y: elementStartCanvas.y };
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	// Expose handleMouseDown for CanvasElement
	export async function startDrag(e: MouseEvent, element: Element, handle?: string, passedSelectedElements?: Element[]) {
		// Clear hover when starting interaction
		hoveredElementId = null;
		const tool = get(currentTool);

		// Don't handle if hand tool or space panning is active - let canvas handle it
		if (tool === 'hand' || isPanning) {
			return;
		}

		e.stopPropagation();
		e.preventDefault();

		// If clicking on a different element while another has pending transforms,
		// clear the pending state to prevent layout issues
		if (activeElementId && activeElementId !== element.id) {
			pendingPosition = null;
			pendingSize = null;
			pendingRotation = null;
			pendingRadius = null;
			groupPendingTransforms.clear();
			// Wait for Svelte to update the DOM before calculating positions
			await tick();
		}

		activeElementId = element.id;

		// Use passed selection if provided (to avoid timing issues), otherwise use store
		const elementsToUse = passedSelectedElements || selectedElements;

		// Check if we're working with a multi-selection
		// EXCEPTION: If this element has been isolated from its group, treat as single element
		const isIsolated = $interactionState.isolatedElementId === element.id;
		isGroupInteraction = !isIsolated && elementsToUse.length > 1;

		dragStartScreen = { x: e.clientX, y: e.clientY };
		hasMovedBeyondThreshold = false; // Reset movement threshold flag

		const pos = getDisplayPosition(element);
		const size = getDisplaySize(element);

		elementStartCanvas = {
			x: pos.x,
			y: pos.y,
			width: size.width,
			height: size.height
		};

		if (handle?.startsWith('rotate')) {
			// Rotation mode
			interactionMode = 'rotating';
			
			// Initialize mouse screen position for debug overlay
			currentMouseScreen = { x: e.clientX, y: e.clientY };

			// Extract corner from handle (e.g., 'rotate-nw' -> 'nw')
			if (handle.includes('-')) {
				rotationReferenceCorner = handle.split('-')[1] as 'nw' | 'ne' | 'se' | 'sw';
			}

			// Get canvas rect for screen-space conversion
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			const canvasRect = canvasElement?.getBoundingClientRect();

			// For child elements, get actual DOM center to account for parent rotation
			// For root elements, use calculated center
			let centerX: number, centerY: number;
			let centerScreenX: number, centerScreenY: number;
			
			if (element.parentId && canvasRect) {
				// Child element: get actual center from DOM (accounts for parent rotation)
				const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
				if (domElement) {
					const rect = domElement.getBoundingClientRect();
					// Center of bounding box is the element's center (rotation is around center)
					const domCenterScreenX = rect.left + rect.width / 2;
					const domCenterScreenY = rect.top + rect.height / 2;
					
					// Convert to canvas space
					centerX = (domCenterScreenX - canvasRect.left - viewport.x) / viewport.scale;
					centerY = (domCenterScreenY - canvasRect.top - viewport.y) / viewport.scale;
					
					// Screen space is just the DOM center
					centerScreenX = domCenterScreenX;
					centerScreenY = domCenterScreenY;
				} else {
					// Fallback: use calculated center
					centerX = pos.x + size.width / 2;
					centerY = pos.y + size.height / 2;
					centerScreenX = canvasRect.left + viewport.x + centerX * viewport.scale;
					centerScreenY = canvasRect.top + viewport.y + centerY * viewport.scale;
				}
			} else {
				// Root element: use calculated center
				centerX = pos.x + size.width / 2;
				centerY = pos.y + size.height / 2;
				centerScreenX = canvasRect
					? canvasRect.left + viewport.x + centerX * viewport.scale
					: centerX;
				centerScreenY = canvasRect
					? canvasRect.top + viewport.y + centerY * viewport.scale
					: centerY;
			}

			// Also store mouse position in canvas space for debugging
			const mouseCanvasX = canvasRect
				? (e.clientX - canvasRect.left - viewport.x) / viewport.scale
				: (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = canvasRect
				? (e.clientY - canvasRect.top - viewport.y) / viewport.scale
				: (e.clientY - viewport.y) / viewport.scale;

			// Store fixed center for use during rotation move (prevents inconsistencies)
			rotationStartCenter = {
				x: centerX,
				y: centerY,
				screenX: centerScreenX,
				screenY: centerScreenY
			};

			// Calculate initial angle from center to cursor in SCREEN space
			// (angles are preserved under translate+scale, so this matches canvas-space geometry)
			rotationStartAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

			// Store current rotation
			elementStartRotation = element.rotation || 0;
			pendingRotation = elementStartRotation;

			// Calculate corner base angle (in local/unrotated space)
			const cornerOffsets = {
				nw: { x: -size.width / 2, y: -size.height / 2 },
				ne: { x: size.width / 2, y: -size.height / 2 },
				se: { x: size.width / 2, y: size.height / 2 },
				sw: { x: -size.width / 2, y: size.height / 2 }
			};
			const cornerOffset = cornerOffsets[rotationReferenceCorner];
			const cornerBaseAngle = Math.atan2(cornerOffset.y, cornerOffset.x) * (180 / Math.PI);

			// Calculate initial offset to prevent jump
			// For child elements with rotated parents, we need to apply rotations in correct order
			const state_for_parent = get(designState);
			const parent_at_start = element.parentId ? state_for_parent.elements[element.parentId] : null;
			const parentRotation = parent_at_start ? (parent_at_start.rotation || 0) : 0;
			
			// Calculate actual visual corner angle at rotation start
			// For child elements with rotated parents, apply rotations in order:
			// 1. First rotate corner offset by element rotation (in element's local space)
			// 2. Then transform by parent rotation (in parent's coordinate system)
			const elementRotationRad = elementStartRotation * (Math.PI / 180);
			const parentRotationRad = parentRotation * (Math.PI / 180);
			
			// Step 1: Rotate corner offset by element rotation
			const elementRotatedCornerX = cornerOffset.x * Math.cos(elementRotationRad) - cornerOffset.y * Math.sin(elementRotationRad);
			const elementRotatedCornerY = cornerOffset.x * Math.sin(elementRotationRad) + cornerOffset.y * Math.cos(elementRotationRad);
			
			// Step 2: Transform by parent rotation (if parent is rotated)
			let rotatedCornerX: number, rotatedCornerY: number;
			if (parentRotation !== 0) {
				rotatedCornerX = elementRotatedCornerX * Math.cos(parentRotationRad) - elementRotatedCornerY * Math.sin(parentRotationRad);
				rotatedCornerY = elementRotatedCornerX * Math.sin(parentRotationRad) + elementRotatedCornerY * Math.cos(parentRotationRad);
			} else {
				rotatedCornerX = elementRotatedCornerX;
				rotatedCornerY = elementRotatedCornerY;
			}
			
			// Add to center to get actual corner position
			const cornerWorldX = centerX + rotatedCornerX;
			const cornerWorldY = centerY + rotatedCornerY;
			
			// Calculate actual visual angle from center to rotated corner
			const actualCornerAngleAtStart = Math.atan2(cornerWorldY - centerY, cornerWorldX - centerX) * (180 / Math.PI);
			
			// Initial offset = difference between cursor angle and actual visual corner angle
			rotationInitialOffset = rotationStartAngle - actualCornerAngleAtStart;

			// Get element's actual DOM center for comparison
			const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
			let actualDOMCenter = { x: 0, y: 0 };
			if (domElement && canvasElement) {
				const rect = domElement.getBoundingClientRect();
				const canvasRect = canvasElement.getBoundingClientRect();
				// For rotated elements, getBoundingClientRect gives bounding box
				// The center of the bounding box IS the element's center (rotation is around center)
				actualDOMCenter.x = (rect.left + rect.width / 2 - canvasRect.left - viewport.x) / viewport.scale;
				actualDOMCenter.y = (rect.top + rect.height / 2 - canvasRect.top - viewport.y) / viewport.scale;
			}

		} else if (handle?.startsWith('radius-')) {
			// Corner radius mode
			interactionMode = 'radius';

			// Extract corner from handle (e.g., 'radius-nw' -> 'nw')
			radiusCorner = handle.split('-')[1] as 'nw' | 'ne' | 'se' | 'sw';

			// Check if corners are already independent (any corner-specific radius is set)
			const hasIndependentCorners = !!(
				element.styles?.borderTopLeftRadius ||
				element.styles?.borderTopRightRadius ||
				element.styles?.borderBottomRightRadius ||
				element.styles?.borderBottomLeftRadius
			);
			radiusCornersIndependent = hasIndependentCorners;
			radiusStartedIndependent = hasIndependentCorners;
			radiusAltKeyPressed = false;

			// Clear frozen values from previous drag
			radiusFrozenValues = null;
			radiusValuesWhenToggled = null;


			// Store current border radius for this specific corner
			const cornerProperty = {
				'nw': element.styles?.borderTopLeftRadius,
				'ne': element.styles?.borderTopRightRadius,
				'se': element.styles?.borderBottomRightRadius,
				'sw': element.styles?.borderBottomLeftRadius
			}[radiusCorner];

			// Use corner-specific radius if set, otherwise use uniform borderRadius
			radiusInitialValue = parseFloat(cornerProperty as string) || parseFloat(element.styles?.borderRadius as string) || 0;

			// Calculate max allowed radius (50% of smaller dimension)
			const maxAllowedRadius = Math.min(size.width, size.height) / 2;

			// Clamp the initial radius to match the visual position of the handle
			// When radius exceeds max, handle is shown at max position
			// When radius is 0, handle is shown at BASE_DISTANCE
			const BASE_DISTANCE = 10;
			let visualRadius: number;
			if (radiusInitialValue > 0) {
				// Clamp to max allowed radius to match visual position
				visualRadius = Math.min(radiusInitialValue, maxAllowedRadius);
			} else {
				// If radius is 0, handle shows at base distance
				visualRadius = BASE_DISTANCE;
			}

			// Set pendingRadius to visualRadius to prevent jump on mousedown
			// This keeps the handle at its current visual position when drag starts
			pendingRadius = visualRadius;

			// Convert mouse position to canvas space
			const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Get the center point of the element
			const centerX = pos.x + size.width / 2;
			const centerY = pos.y + size.height / 2;

			// Get element rotation in radians
			const rotationRad = ((element.rotation || 0) * Math.PI) / 180;

			// Translate mouse position to element's local coordinate system
			const relX = mouseCanvasX - centerX;
			const relY = mouseCanvasY - centerY;
			const cos = Math.cos(-rotationRad);
			const sin = Math.sin(-rotationRad);
			const localX = relX * cos - relY * sin + centerX;
			const localY = relX * sin + relY * cos + centerY;

			// Get the corner position in local space
			let cornerX: number, cornerY: number;

			if (radiusCorner === 'nw') {
				cornerX = pos.x;
				cornerY = pos.y;
			} else if (radiusCorner === 'ne') {
				cornerX = pos.x + size.width;
				cornerY = pos.y;
			} else if (radiusCorner === 'se') {
				cornerX = pos.x + size.width;
				cornerY = pos.y + size.height;
			} else { // sw
				cornerX = pos.x;
				cornerY = pos.y + size.height;
			}

			// Project cursor onto the 45° diagonal line from corner towards element center
			const dx = localX - cornerX;
			const dy = localY - cornerY;

			// Determine the direction of the 45° diagonal based on which corner
			let diagonalDirX: number, diagonalDirY: number;

			if (radiusCorner === 'nw') {
				diagonalDirX = 1;
				diagonalDirY = 1;
			} else if (radiusCorner === 'ne') {
				diagonalDirX = -1;
				diagonalDirY = 1;
			} else if (radiusCorner === 'se') {
				diagonalDirX = -1;
				diagonalDirY = -1;
			} else { // sw
				diagonalDirX = 1;
				diagonalDirY = -1;
			}

			// Normalize the diagonal direction
			const diagonalLength = Math.sqrt(2);
			diagonalDirX /= diagonalLength;
			diagonalDirY /= diagonalLength;

			// Project cursor position onto diagonal to get initial cursor distance from corner
			const initialCursorDistance = dx * diagonalDirX + dy * diagonalDirY;

			// Calculate where the handle is currently positioned visually
			// Handle is at (visualRadius, visualRadius) from corner, so its distance along the 45° diagonal is visualRadius * √2
			const initialHandleDistance = visualRadius * Math.sqrt(2);

			// Store the offset between cursor and handle
			// This allows us to maintain the relative position during drag
			radiusStartDistance = initialCursorDistance - initialHandleDistance;

			// Add global listeners
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		} else if (handle) {
			// Resize mode
			interactionMode = 'resizing';
			resizeHandle = handle;

			// FIX: Recalculate elementStartCanvas to be the unrotated box centered at the element's actual center.
			// getDisplayPosition() returns the physical top-left corner, which for nested rotated elements
			// is NOT the top-left of the unrotated box. We need the unrotated box for resize calculations.
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			const canvasRect = canvasElement?.getBoundingClientRect();
			const elementDom = document.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement | null;
			
			if (canvasRect && elementDom) {
				const elementRect = elementDom.getBoundingClientRect();
				const elementCenterScreenX = elementRect.left + elementRect.width / 2;
				const elementCenterScreenY = elementRect.top + elementRect.height / 2;
				const elementCenterCanvasX = (elementCenterScreenX - canvasRect.left - viewport.x) / viewport.scale;
				const elementCenterCanvasY = (elementCenterScreenY - canvasRect.top - viewport.y) / viewport.scale;

				elementStartCanvas = {
					x: elementCenterCanvasX - size.width / 2,
					y: elementCenterCanvasY - size.height / 2,
					width: size.width,
					height: size.height
				};
			}

			// Convert auto-sized (inline-block) text elements to fixed size before resizing
			if (element.styles?.display === 'inline-block') {
				const actualSize = getActualSize(element);
				// Update element to fixed size and remove inline-block
				updateElementStyles(element.id, { display: undefined });
				resizeElement(element.id, actualSize, element.position);
				// Update local state to reflect the new fixed size
				// Note: elementStartCanvas is already set correctly above based on actual DOM size/center
				elementStartCanvas.width = actualSize.width;
				elementStartCanvas.height = actualSize.height;
				// Re-center based on new size (center stays same, top-left shifts)
				const centerX = elementStartCanvas.x + size.width / 2;
				const centerY = elementStartCanvas.y + size.height / 2;
				elementStartCanvas.x = centerX - actualSize.width / 2;
				elementStartCanvas.y = centerY - actualSize.height / 2;
			}

			// Don't set pending values yet - wait until mouse actually moves
			// This prevents initial jump from coordinate calculation differences
			pendingSize = null;
			pendingPosition = null;

			// Calculate where the handle SHOULD be (the ideal corner/edge position)
			// This will be used for the first resize calculation to avoid jump
			const localRotation = element.rotation || 0;
			const ancestorRotation = getCumulativeRotation(element);
			const totalRotation = localRotation + ancestorRotation;

			if (totalRotation !== 0) {
				const corners = getRotatedCorners({
					x: elementStartCanvas.x,
					y: elementStartCanvas.y,
					width: elementStartCanvas.width,
					height: elementStartCanvas.height,
					rotation: totalRotation
				});

				const isCornerHandle = handle.length === 2;
				const isEdgeHandle = handle.length === 1;

				if (isCornerHandle) {
					// For corner handles, the dragged corner is opposite to the anchor
					const anchorIndex = getAnchorCornerIndex(handle);
					const draggedCornerIndex = (anchorIndex + 2) % 4;
					initialHandlePosition = corners[draggedCornerIndex];
				} else if (isEdgeHandle) {
					// For edge handles, calculate the center of the edge
					if (handle === 'n') {
						initialHandlePosition = {
							x: (corners[0].x + corners[1].x) / 2,
							y: (corners[0].y + corners[1].y) / 2
						};
					} else if (handle === 's') {
						initialHandlePosition = {
							x: (corners[2].x + corners[3].x) / 2,
							y: (corners[2].y + corners[3].y) / 2
						};
					} else if (handle === 'e') {
						initialHandlePosition = {
							x: (corners[1].x + corners[2].x) / 2,
							y: (corners[1].y + corners[2].y) / 2
						};
					} else if (handle === 'w') {
						initialHandlePosition = {
							x: (corners[0].x + corners[3].x) / 2,
							y: (corners[0].y + corners[3].y) / 2
						};
					}
				}
				// Calculate the offset from the mouse click position to the ideal handle position
				const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
				const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;
				if (initialHandlePosition) {
					mouseToHandleOffset = {
						x: initialHandlePosition.x - mouseCanvasX,
						y: initialHandlePosition.y - mouseCanvasY
					};
				}
			}
		} else {
			// Drag mode
			interactionMode = 'dragging';

			if (isGroupInteraction) {
				// Initialize group dragging
				// Store initial bounds for all selected elements (including rotation)
				groupStartElements = elementsToUse.map(el => ({
					id: el.id,
					x: el.position.x,
					y: el.position.y,
					width: el.size.width,
					height: el.size.height,
					rotation: el.rotation || 0
				}));

				// Store group bounds (use unrotated bounds for consistent coordinate system)
				const unrotatedBounds = getUnrotatedGroupBounds(elementsToUse);
				elementStartCanvas = {
					x: unrotatedBounds.x,
					y: unrotatedBounds.y,
					width: unrotatedBounds.width,
					height: unrotatedBounds.height
				};

				pendingPosition = { x: elementStartCanvas.x, y: elementStartCanvas.y };
			} else {
				// Single element drag
				pendingPosition = { ...pos };

				// Calculate and store offset from cursor to element's center at drag start
				const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
				const canvasRect = canvasElement?.getBoundingClientRect();
				const elementDom = document.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement | null;
				if (canvasRect && elementDom) {
					const cursorCanvasX = (e.clientX - canvasRect.left - viewport.x) / viewport.scale;
					const cursorCanvasY = (e.clientY - canvasRect.top - viewport.y) / viewport.scale;

					// Get element's actual rendered center from DOM
					const elementRect = elementDom.getBoundingClientRect();
					const elementCenterScreenX = elementRect.left + elementRect.width / 2;
					const elementCenterScreenY = elementRect.top + elementRect.height / 2;
					const elementCenterCanvasX = (elementCenterScreenX - canvasRect.left - viewport.x) / viewport.scale;
					const elementCenterCanvasY = (elementCenterScreenY - canvasRect.top - viewport.y) / viewport.scale;

					// Store offset from cursor to element's center
					dragOffsetCanvas = {
						x: cursorCanvasX - elementCenterCanvasX,
						y: cursorCanvasY - elementCenterCanvasY
					};

					// CRITICAL: For the initial pendingPosition, we need to calculate what would produce
					// the element's current visual position when passed through absoluteToRelativePosition.
					// This is NOT the same as getAbsolutePosition(element) because that calculates
					// the unrotated top-left in canvas space, but we need the position that when
					// converted through our transforms produces the current rendered position.

					// The element is currently rendered at the DOM position we just measured.
					// During drag, we calculate: elementCenter = cursor - dragOffset
					// Then: pendingPosition = elementCenter - size/2
					// So for consistency, use the same calculation here:
					const initialPendingPosition = {
						x: elementCenterCanvasX - size.width / 2,
						y: elementCenterCanvasY - size.height / 2
					};

					elementStartCanvas = {
						x: initialPendingPosition.x,
						y: initialPendingPosition.y,
						width: size.width,
						height: size.height
					};

					pendingPosition = initialPendingPosition;
				}

				// Initialize auto layout reordering state
				reorderTargetIndex = null;
				lastAppliedIndex = null;

				// Store original parent for drag-out detection
				originalParentId = element.parentId;
				potentialDropParentId = null;
				

				// Check if element is in auto layout and can be reordered
				const state = get(designState);
				const parent = element.parentId ? state.elements[element.parentId] : null;

				if (parent?.autoLayout?.enabled && !element.autoLayout?.ignoreAutoLayout) {
					reorderParentId = parent.id;
					reorderOriginalIndex = parent.children?.indexOf(element.id) ?? null;

					// Store the offset from cursor to element's top-left in SCREEN space
					// We'll use screen coordinates for ghost positioning to avoid coordinate conversion issues
					const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
					if (domElement) {
						const rect = domElement.getBoundingClientRect();

						// Store element rotation and size for recalculation during drag
						// Use getActualSize directly to ensure we use the CURRENT element being dragged
						// (displaySizeForSelection might be stale if selection just changed)
						reorderElementRotation = element.rotation || 0;
						const elementDisplaySize = getActualSize(element);
						reorderElementSize = { ...elementDisplaySize };

						// Calculate actual top-left position accounting for rotation
						const actualPos = calculateActualTopLeftForRotated(
							rect,
							elementDisplaySize,
							// Use total cumulative rotation here, just like the ghost element renderer
							getCumulativeRotation(element) + (element.rotation || 0),
							viewport.scale
						);

						// Offset from mouse to element's actual top-left (rotation origin) in screen pixels
						reorderGhostOffset = {
							x: actualPos.left - e.clientX,
							y: actualPos.top - e.clientY
						};

						// Get all children positions at start
						const allChildren = parent?.children?.map(childId => {
							const child = state.elements[childId];
							const domEl = document.querySelector(`[data-element-id="${childId}"]`);
							if (!domEl || !child) return null;
							const childRect = domEl.getBoundingClientRect();
							return {
								id: childId,
								isBeingDragged: childId === element.id,
								screenPos: { left: childRect.left, top: childRect.top },
								size: { width: childRect.width, height: childRect.height }
							};
						}).filter(Boolean) || [];


						// Calculate initial ghost position at drag start
						const initialGhostScreenX = e.clientX + reorderGhostOffset.x;
						const initialGhostScreenY = e.clientY + reorderGhostOffset.y;
						const initialGhostCanvasX = (initialGhostScreenX - viewport.x) / viewport.scale;
						const initialGhostCanvasY = (initialGhostScreenY - viewport.y) / viewport.scale;


						// Initialize pendingPosition to the actual DOM position in canvas coordinates
						// This ensures the ghost starts at the element's visual position
						pendingPosition = {
							x: initialGhostCanvasX,
							y: initialGhostCanvasY
						};
					}
				} else {
					reorderParentId = null;
					reorderOriginalIndex = null;
				}
			}

			// If group interaction, initialize groupPendingTransforms with current positions
			// so elements display correctly immediately (before first mousemove)
			if (isGroupInteraction) {
				groupPendingTransforms = new Map();
				groupStartElements.forEach(el => {
					groupPendingTransforms.set(el.id, {
						position: { x: el.x, y: el.y },
						size: { width: el.width, height: el.height },
						rotation: el.rotation
					});
				});
			}
		}

		// Don't call selectElement here - CanvasElement already handles selection logic
		// This prevents clearing multi-selection when starting to drag

		// Add global listeners
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	// Auto layout reordering helper - applies the reorder via design-store
	async function applyReorder(elementId: string, parentId: string, targetIndex: number): Promise<void> {
		const state = get(designState);
		const parent = state.elements[parentId];
		if (!parent) {
			return;
		}

		const siblings = parent.children || [];
		const currentIndex = siblings.indexOf(elementId);
		if (currentIndex === -1 || currentIndex === targetIndex) {
			return;
		}

		// Dispatch the reorder event via design-store
		await reorderElement(elementId, parentId, targetIndex);
	}

	function calculateReorderTargetIndex(
		cursorX: number,
		cursorY: number,
		parentId: string,
		elementId: string
	): number | null {
		const state = get(designState);
		const parent = state.elements[parentId];
		if (!parent || !parent.children) return null;

		const siblings = parent.children
			.map(id => state.elements[id])
			.filter(el => el && el.id !== elementId);

		if (siblings.length === 0) return 0;

		const flexDirection = parent.autoLayout?.direction || 'row';

		// Get DOM positions for siblings (auto layout uses actual rendered positions)
		const siblingPositions = siblings.map(sibling => {
			const domElement = document.querySelector(`[data-element-id="${sibling.id}"]`);
			if (!domElement) return null;

			const rect = domElement.getBoundingClientRect();
			return {
				id: sibling.id,
				x: (rect.left - viewport.x) / viewport.scale,
				y: (rect.top - viewport.y) / viewport.scale,
				width: rect.width / viewport.scale,
				height: rect.height / viewport.scale,
				centerX: (rect.left - viewport.x) / viewport.scale + rect.width / viewport.scale / 2,
				centerY: (rect.top - viewport.y) / viewport.scale + rect.height / viewport.scale / 2
			};
		}).filter(pos => pos !== null) as Array<{
			id: string;
			x: number;
			y: number;
			width: number;
			height: number;
			centerX: number;
			centerY: number;
		}>;

		if (siblingPositions.length === 0) return 0;

		// For row-wrap, we need to handle multi-row layout
		if (flexDirection === 'row-wrap') {
			// Group siblings by rows (elements with similar Y positions)
			const rows: Array<typeof siblingPositions> = [];
			const rowThreshold = 5; // pixels tolerance for same row

			siblingPositions.forEach(pos => {
				// Find if this element belongs to an existing row
				let foundRow = false;
				for (const row of rows) {
					if (Math.abs(row[0].centerY - pos.centerY) < rowThreshold) {
						row.push(pos);
						foundRow = true;
						break;
					}
				}
				// If not in existing row, create new row
				if (!foundRow) {
					rows.push([pos]);
				}
			});

			// Sort rows by Y position (top to bottom)
			rows.sort((a, b) => a[0].centerY - b[0].centerY);

			// Sort elements within each row by X position (left to right)
			rows.forEach(row => row.sort((a, b) => a.centerX - b.centerX));

			// Find the nearest row based on Y distance (better for horizontal dragging)
			let targetRow: typeof siblingPositions = rows[0];
			let targetRowIndex = 0;
			let minDistance = Infinity;

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const rowCenterY = row[0].centerY; // All elements in row have similar centerY
				const distance = Math.abs(cursorY - rowCenterY);

				if (distance < minDistance) {
					minDistance = distance;
					targetRow = row;
					targetRowIndex = i;
				}
			}

			// Find insertion point within the row by X position
			let insertIndexInRow = targetRow.length;
			for (let i = 0; i < targetRow.length; i++) {
				if (cursorX < targetRow[i].centerX) {
					insertIndexInRow = i;
					break;
				}
			}

			// Convert row-local index to global index
			let globalIndex = 0;
			for (let i = 0; i < targetRowIndex; i++) {
				globalIndex += rows[i].length;
			}
			globalIndex += insertIndexInRow;

			// No adjustment needed - siblingPositions already excludes the dragged element
			// and reorderElement removes before inserting at the given index
			return globalIndex;
		}

		// For row direction: compare X positions
		if (flexDirection === 'row') {
			let targetIndex = siblingPositions.length;
			for (let i = 0; i < siblingPositions.length; i++) {
				if (cursorX < siblingPositions[i].centerX) {
					targetIndex = i;
					break;
				}
			}

			// No adjustment needed - siblingPositions already excludes the dragged element
			// and reorderElement removes before inserting at the given index
			return targetIndex;
		}

		// For column direction: compare Y positions
		if (flexDirection === 'column') {
			let targetIndex = siblingPositions.length;
			for (let i = 0; i < siblingPositions.length; i++) {
				if (cursorY < siblingPositions[i].centerY) {
					targetIndex = i;
					break;
				}
			}

			// No adjustment needed - siblingPositions already excludes the dragged element
			// and reorderElement removes before inserting at the given index
			return targetIndex;
		}

		return null;
	}

	// Live reordering: reorder elements as user drags
	// Use potentialDropParentId if available (dragging to different parent), otherwise use reorderParentId
	// Only apply if we've moved beyond the threshold to avoid reordering on clicks
	$: if (interactionMode === 'dragging' && reorderTargetIndex !== null &&
		reorderTargetIndex !== lastAppliedIndex && activeElementId && hasMovedBeyondThreshold) {
		const targetParent = potentialDropParentId || reorderParentId;
		if (targetParent) {
			// Check if changing parents (dragging from one auto-layout to another)
			const effectiveFromParent = reorderParentId; // Where element started
			const effectiveToParent = potentialDropParentId || reorderParentId; // Where it's going
			const isChangingParents = effectiveFromParent !== effectiveToParent;

			// Check if the target index is different from where we started
			// This prevents reordering when just clicking (which might calculate same index)
			const isActuallyReordering = reorderTargetIndex !== reorderOriginalIndex;

			// Apply live reordering if:
			// 1. Changing parents (always show feedback), OR
			// 2. Same parent but actually moving to a different index
			if (isChangingParents || isActuallyReordering) {
				lastAppliedIndex = reorderTargetIndex;
				applyReorder(activeElementId, targetParent, reorderTargetIndex);
			}
		}
	}

	/**
	 * Handle Alt key press/release during drag to enable/disable duplication mode
	 */
	async function handleAltKeyDuplication(altKeyPressed: boolean) {
		// Alt key pressed and not yet duplicated
		if (altKeyPressed && !hasDuplicated) {
			// Store original element IDs
			const state = get(designState);
			originalElementIds = state.selectedElementIds;

			// Duplicate the selected elements
			await duplicateElements();
			await tick();

			// Get the newly created duplicate IDs
			const newState = get(designState);
			duplicateElementIds = newState.selectedElementIds;

			// Mark as duplicated
			hasDuplicated = true;
			isDuplicateDrag = true;

			// Update active element ID to the duplicate
			if (activeElementId) {
				const originalIndex = originalElementIds.indexOf(activeElementId);
				if (originalIndex !== -1 && duplicateElementIds[originalIndex]) {
					activeElementId = duplicateElementIds[originalIndex];
				}
			}
		}
		// Alt key released and we had duplicated - cancel duplication
		else if (!altKeyPressed && hasDuplicated) {
			// Delete the duplicates
			await deleteElements(duplicateElementIds);
			await tick();

			// Re-select the original elements
			selectElements(originalElementIds);
			await tick();

			// Update active element ID back to original
			if (activeElementId && duplicateElementIds.includes(activeElementId)) {
				const dupIndex = duplicateElementIds.indexOf(activeElementId);
				if (dupIndex !== -1 && originalElementIds[dupIndex]) {
					activeElementId = originalElementIds[dupIndex];
				}
			}

			// Reset duplication state
			hasDuplicated = false;
			isDuplicateDrag = false;
			duplicateElementIds = [];
		}
	}

	// Mouse event handlers
	function handleMouseDown(e: MouseEvent, element: Element, handle?: string) {
		startDrag(e, element, handle);
	}

	function handleMouseMove(e: MouseEvent) {
		if (interactionMode === 'idle') return;
		if (!isGroupInteraction && !activeElementId) return;

		const deltaScreen = {
			x: e.clientX - dragStartScreen.x,
			y: e.clientY - dragStartScreen.y
		};

		// Convert delta to canvas space
		const deltaCanvas = {
			x: deltaScreen.x / viewport.scale,
			y: deltaScreen.y / viewport.scale
		};

		// Check if we've moved beyond the threshold
		if (!hasMovedBeyondThreshold) {
			const movedX = Math.abs(deltaCanvas.x);
			const movedY = Math.abs(deltaCanvas.y);
			if (movedX > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || movedY > CANVAS_INTERACTION.MOVEMENT_THRESHOLD) {
				hasMovedBeyondThreshold = true;
			}
		}

		// Handle Alt+drag duplication during dragging
		if (interactionMode === 'dragging' && hasMovedBeyondThreshold) {
			handleAltKeyDuplication(e.altKey);
		}

		if (interactionMode === 'dragging') {
			// Calculate reorder target index if in auto layout
			if (reorderParentId && activeElementId) {
				currentMouseScreen = { x: e.clientX, y: e.clientY }; // Store for debug

				const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
				const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

				// For auto layout reordering, calculate ghost position using the stored offset
				// The offset accounts for rotation and was calculated at drag start
				const ghostScreenX = e.clientX + reorderGhostOffset.x;
				const ghostScreenY = e.clientY + reorderGhostOffset.y;

				// Convert to canvas coordinates
				pendingPosition = {
					x: (ghostScreenX - viewport.x) / viewport.scale,
					y: (ghostScreenY - viewport.y) / viewport.scale
				};

				// Only check for parent changes and calculate reorder index if we've moved beyond threshold
				// This prevents unwanted reordering on small mouse movements (clicks)
				if (hasMovedBeyondThreshold) {
					// Check if dragging into a different auto layout parent
					const state = get(designState);
					const draggedElement = state.elements[activeElementId];
					if (draggedElement) {
						const detectedParentId = findDropParentAtPosition(
							pendingPosition.x,
							pendingPosition.y,
							draggedElement.size.width,
							draggedElement.size.height,
							activeElementId
						);

						// Track the potential drop parent (could be different from original)
						potentialDropParentId = detectedParentId;

						// Determine which parent to use for reordering calculation
						const targetParentId = detectedParentId || reorderParentId;
						const targetParent = state.elements[targetParentId];

						// Only calculate reorder index if target parent has auto layout enabled
						if (targetParent?.autoLayout?.enabled) {
						// Get all children positions for debugging
						const childrenPositions = targetParent.children?.map(childId => {
							const child = state.elements[childId];
							const domEl = document.querySelector(`[data-element-id="${childId}"]`);
							if (!domEl || !child) return null;
							const rect = domEl.getBoundingClientRect();
							return {
								id: childId,
								isBeingDragged: childId === activeElementId,
								screenPos: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
								size: { width: rect.width, height: rect.height }
							};
						}).filter(Boolean) || [];

							// Calculate reorder index within the target parent
							reorderTargetIndex = calculateReorderTargetIndex(
								mouseCanvasX,
								mouseCanvasY,
								targetParentId,
								activeElementId
							);
						} else {
							// Target parent doesn't have auto layout - clear reorder state
							reorderTargetIndex = null;
						}
					}
				}
			} else {
				// Normal drag: calculate position
				const state = get(designState);
				const activeElement = state.elements[activeElementId!];
				
				let tempPendingPosition: { x: number; y: number };
				
				// For nested elements, use cursor-based calculation to ensure coordinate system consistency
				// This avoids issues with parent transforms affecting delta-based calculations
				if (activeElement && activeElement.parentId) {
					// Get current cursor position in canvas space
					const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
					const canvasRect = canvasElement?.getBoundingClientRect();
					if (!canvasRect) return;

					const cursorCanvasX = (e.clientX - canvasRect.left - viewport.x) / viewport.scale;
					const cursorCanvasY = (e.clientY - canvasRect.top - viewport.y) / viewport.scale;

					// Calculate element center from cursor position minus the drag offset
					// dragOffsetCanvas was calculated at drag start as: cursor - elementCenter
					// So: elementCenter = cursor - dragOffsetCanvas
					const elementCenterCanvasX = cursorCanvasX - dragOffsetCanvas.x;
					const elementCenterCanvasY = cursorCanvasY - dragOffsetCanvas.y;

					// Convert center to top-left position
					const elementSize = getDisplaySize(activeElement);
					tempPendingPosition = {
						x: elementCenterCanvasX - elementSize.width / 2,
						y: elementCenterCanvasY - elementSize.height / 2
					};
				} else {
					// For root elements, use delta-based calculation (works fine for non-nested)
					tempPendingPosition = {
						x: elementStartCanvas.x + deltaCanvas.x,
						y: elementStartCanvas.y + deltaCanvas.y
					};
				}
				// Detect potential drop parent for single element drags (not groups, not in auto layout mode)
				// Only check after moving beyond threshold to avoid unwanted reordering on clicks
				if (!isGroupInteraction && activeElementId && tempPendingPosition && hasMovedBeyondThreshold) {
					// Get the dragged element's size to check for overlap with potential parents
					const draggedElement = state.elements[activeElementId];
					if (draggedElement) {
						const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
						const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

						const detectedParentId = findDropParentAtPosition(
							tempPendingPosition.x,
							tempPendingPosition.y,
							draggedElement.size.width,
							draggedElement.size.height,
							activeElementId
						);

						// Track potential parent
						potentialDropParentId = detectedParentId;

						// If dragging into an auto-layout parent, calculate reorder index
						if (detectedParentId) {
							const targetParent = state.elements[detectedParentId];
							if (targetParent?.autoLayout?.enabled) {
								// Calculate where in the auto-layout to insert this element
								reorderTargetIndex = calculateReorderTargetIndex(
									mouseCanvasX,
									mouseCanvasY,
									detectedParentId,
									activeElementId
								);
							} else {
								reorderTargetIndex = null;
							}
						} else {
							reorderTargetIndex = null;
						}

						pendingPosition = tempPendingPosition;
					} else {
						pendingPosition = tempPendingPosition;
					}
				} else {
					pendingPosition = tempPendingPosition;
				}

				// Update pending transforms for all group elements
				if (isGroupInteraction) {
					const deltaX = deltaCanvas.x;
					const deltaY = deltaCanvas.y;

					groupPendingTransforms = new Map(
						groupStartElements.map(el => {
							// Use rotation stored at drag start (preserves it throughout drag)
							return [
								el.id,
								{
									position: { x: el.x + deltaX, y: el.y + deltaY },
									size: { width: el.width, height: el.height },
									rotation: el.rotation
								}
							];
						})
					);
				}
			}
		} else if (interactionMode === 'resizing' && resizeHandle) {
			// Check if scale tool is active OR shift key is held - if so, maintain aspect ratio
			const tool = get(currentTool);
			const maintainAspectRatio = tool === 'scale' || e.shiftKey;
			const resizeFromCenter = e.altKey; // Option/Alt key resizes from center

			// Get current rotation from active element or pending rotation
			const activeElement = selectedElements.find(el => el.id === activeElementId);
			// FIX: Use total cumulative rotation (ancestors + local) for resizing logic
			// This ensures we calculate the correct visual corners and anchor point in canvas space
			const localRotation = activeElement?.rotation || 0;
			const ancestorRotation = activeElement ? getCumulativeRotation(activeElement) : 0;
			const rotation = localRotation + ancestorRotation;

			// Calculate new size based on handle
			let newWidth = elementStartCanvas.width;
			let newHeight = elementStartCanvas.height;
			let newX = elementStartCanvas.x;
			let newY = elementStartCanvas.y;

			// Convert current mouse position to canvas space
			let mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			let mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Check if we've moved past the threshold
			if (!hasMovedPastThreshold) {
				const deltaScreenDist = Math.sqrt(deltaScreen.x ** 2 + deltaScreen.y ** 2);
				if (deltaScreenDist < CANVAS_INTERACTION.RESIZE_START_THRESHOLD) {
					// Still within dead zone - don't update position/size yet
					return;
				}
				hasMovedPastThreshold = true;
			}

			// Apply the offset to compensate for where the user clicked vs where the handle actually is
			// This ensures smooth resizing even if the user didn't click exactly on the handle center
			if (rotation !== 0 && (mouseToHandleOffset.x !== 0 || mouseToHandleOffset.y !== 0)) {
				mouseCanvasX += mouseToHandleOffset.x;
				mouseCanvasY += mouseToHandleOffset.y;
			}

			// Handle rotated object resize with proper geometry
			if (rotation !== 0) {
				const isCornerHandle = resizeHandle.length === 2;
				const isEdgeHandle = resizeHandle.length === 1;

				let fixedPoint: Point;
				let edgeAxis: 'horizontal' | 'vertical' | null = null;

				if (resizeFromCenter) {
					// Alt/Option: resize from center
					// The center is simply the midpoint of the original bounds
					// (elementStartCanvas represents the un-rotated bounding box)
					fixedPoint = {
						x: elementStartCanvas.x + elementStartCanvas.width / 2,
						y: elementStartCanvas.y + elementStartCanvas.height / 2
					};
					// For center resize, we treat it as an edge resize with 2x distance
					edgeAxis = isEdgeHandle ? (resizeHandle === 'n' || resizeHandle === 's' ? 'horizontal' : 'vertical') : null;
				} else {
					// Normal resize: fix opposite corner/edge
					const corners = getRotatedCorners({
						x: elementStartCanvas.x,
						y: elementStartCanvas.y,
						width: elementStartCanvas.width,
						height: elementStartCanvas.height,
						rotation
					});

					if (isCornerHandle) {
						// For corner handles, use the opposite corner as anchor
						const anchorIndex = getAnchorCornerIndex(resizeHandle);
						fixedPoint = corners[anchorIndex];
					} else if (isEdgeHandle) {
						// For edge handles, use center of opposite edge as anchor
						if (resizeHandle === 'n') {
							// North handle: fix south edge (bottom-right and bottom-left midpoint)
							fixedPoint = {
								x: (corners[2].x + corners[3].x) / 2,
								y: (corners[2].y + corners[3].y) / 2
							};
							edgeAxis = 'horizontal';
						} else if (resizeHandle === 's') {
							// South handle: fix north edge (top-left and top-right midpoint)
							fixedPoint = {
								x: (corners[0].x + corners[1].x) / 2,
								y: (corners[0].y + corners[1].y) / 2
							};
							edgeAxis = 'horizontal';
						} else if (resizeHandle === 'e') {
							// East handle: fix west edge (top-left and bottom-left midpoint)
							fixedPoint = {
								x: (corners[0].x + corners[3].x) / 2,
								y: (corners[0].y + corners[3].y) / 2
							};
							edgeAxis = 'vertical';
						} else {
							// West handle: fix east edge (top-right and bottom-right midpoint)
							fixedPoint = {
								x: (corners[1].x + corners[2].x) / 2,
								y: (corners[1].y + corners[2].y) / 2
							};
							edgeAxis = 'vertical';
						}
					} else {
						// Shouldn't happen, but fallback to center
						fixedPoint = {
							x: elementStartCanvas.x + elementStartCanvas.width / 2,
							y: elementStartCanvas.y + elementStartCanvas.height / 2
						};
					}
				}

				// Calculate new dimensions with fixed point
				const originalAspectRatio = elementStartCanvas.width / elementStartCanvas.height;

				const result = calculateRectFromFixedPoint(
					fixedPoint,
					{ x: mouseCanvasX, y: mouseCanvasY },
					rotation,
					maintainAspectRatio,
					originalAspectRatio,
					resizeFromCenter,
					elementStartCanvas.width,
					elementStartCanvas.height,
					resizeHandle
				);

				newX = result.x;
				newY = result.y;
				newWidth = result.width;
				newHeight = result.height;
			} else if (maintainAspectRatio) {
				// For scale tool, calculate scale factor based on handle
				let scaleFactor = 1;

				// Check if it's a corner handle or edge handle
				const isCornerHandle = resizeHandle.length === 2;

				if (resizeHandle.includes('e') || resizeHandle.includes('w')) {
					const widthDelta = resizeHandle.includes('e') ? deltaCanvas.x : -deltaCanvas.x;
					scaleFactor = (elementStartCanvas.width + widthDelta) / elementStartCanvas.width;
				}
				if (resizeHandle.includes('s') || resizeHandle.includes('n')) {
					const heightDelta = resizeHandle.includes('s') ? deltaCanvas.y : -deltaCanvas.y;
					const heightScaleFactor = (elementStartCanvas.height + heightDelta) / elementStartCanvas.height;

					// For corner handles, use the larger scale factor
					// For edge handles (n, s only), just use the height scale factor
					if (isCornerHandle) {
						scaleFactor = Math.abs(heightScaleFactor) > Math.abs(scaleFactor) ? heightScaleFactor : scaleFactor;
					} else {
						scaleFactor = heightScaleFactor;
					}
				}

				newWidth = elementStartCanvas.width * scaleFactor;
				newHeight = elementStartCanvas.height * scaleFactor;

				// Adjust position based on handle and modifiers
				if (resizeFromCenter) {
					// Alt/Option: resize from center
					newX = elementStartCanvas.x + (elementStartCanvas.width - newWidth) / 2;
					newY = elementStartCanvas.y + (elementStartCanvas.height - newHeight) / 2;
				} else {
					// Normal resize: keep opposite edge/corner fixed
					if (resizeHandle === 'n' || resizeHandle === 's') {
						// North or South: keep horizontally centered
						newX = elementStartCanvas.x + (elementStartCanvas.width - newWidth) / 2;
						if (resizeHandle === 'n') {
							// North: keep bottom (S) edge fixed
							newY = elementStartCanvas.y + (elementStartCanvas.height - newHeight);
						}
						// South: keep top (N) edge fixed - newY stays as elementStartCanvas.y
					} else if (resizeHandle === 'e' || resizeHandle === 'w') {
						// East or West: keep vertically centered
						newY = elementStartCanvas.y + (elementStartCanvas.height - newHeight) / 2;
						if (resizeHandle === 'w') {
							// West: keep right (E) edge fixed
							newX = elementStartCanvas.x + (elementStartCanvas.width - newWidth);
						}
						// East: keep left (W) edge fixed - newX stays as elementStartCanvas.x
					} else {
						// Corner handles: keep opposite corner fixed
						if (resizeHandle.includes('w')) {
							newX = elementStartCanvas.x + (elementStartCanvas.width - newWidth);
						}
						if (resizeHandle.includes('n')) {
							newY = elementStartCanvas.y + (elementStartCanvas.height - newHeight);
						}
					}
				}

				// Allow negative dimensions (flip element when dragging past opposite edge)
				if (newWidth < 0) {
					newX = newX + newWidth;
					newWidth = Math.abs(newWidth);
				}
				if (newHeight < 0) {
					newY = newY + newHeight;
					newHeight = Math.abs(newHeight);
				}
			} else {
				// Free resize (move tool without aspect ratio constraint)
				if (resizeFromCenter) {
					// Alt/Option: resize from center
					// Double the delta since we're expanding from center
					if (resizeHandle.includes('e')) {
						newWidth = elementStartCanvas.width + deltaCanvas.x * 2;
						newX = elementStartCanvas.x - deltaCanvas.x;
					}
					if (resizeHandle.includes('w')) {
						newWidth = elementStartCanvas.width - deltaCanvas.x * 2;
						newX = elementStartCanvas.x + deltaCanvas.x;
					}
					if (resizeHandle.includes('s')) {
						newHeight = elementStartCanvas.height + deltaCanvas.y * 2;
						newY = elementStartCanvas.y - deltaCanvas.y;
					}
					if (resizeHandle.includes('n')) {
						newHeight = elementStartCanvas.height - deltaCanvas.y * 2;
						newY = elementStartCanvas.y + deltaCanvas.y;
					}
				} else {
					// Normal free resize
					if (resizeHandle.includes('e')) {
						newWidth = elementStartCanvas.width + deltaCanvas.x;
					}
					if (resizeHandle.includes('w')) {
						newWidth = elementStartCanvas.width - deltaCanvas.x;
						newX = elementStartCanvas.x + deltaCanvas.x;
					}
					if (resizeHandle.includes('s')) {
						newHeight = elementStartCanvas.height + deltaCanvas.y;
					}
					if (resizeHandle.includes('n')) {
						newHeight = elementStartCanvas.height - deltaCanvas.y;
						newY = elementStartCanvas.y + deltaCanvas.y;
					}
				}

				// Allow negative dimensions (flip element when dragging past opposite edge)
				if (newWidth < 0) {
					newX = newX + newWidth;
					newWidth = Math.abs(newWidth);
				}
				if (newHeight < 0) {
					newY = newY + newHeight;
					newHeight = Math.abs(newHeight);
				}
			}

			pendingSize = { width: newWidth, height: newHeight };

			// For elements in auto layout, read position from DOM (flexbox repositions them)
			// For other elements, use calculated anchor position
			if (activeElement) {
				const state = get(designState);
				const parent = activeElement.parentId ? state.elements[activeElement.parentId] : null;
				const parentHasAutoLayout = !!(parent?.autoLayout?.enabled);
				const childIgnoresAutoLayout = !!(activeElement.autoLayout?.ignoreAutoLayout);
				const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;

				if (isInAutoLayout) {
					// For auto layout: read actual position from DOM (flexbox controls positioning)
					// Use setTimeout to let Svelte update the DOM first
					setTimeout(() => {
						const actualPos = getAbsolutePosition(activeElement);
						pendingPosition = actualPos;
					}, 0);
					// Temporarily use the last known position
					pendingPosition = pendingPosition || getAbsolutePosition(activeElement);
				} else {
					// For non-auto layout: use calculated anchor position
					pendingPosition = { x: newX, y: newY };
				}
			} else {
				pendingPosition = { x: newX, y: newY };
			}

			// Update pending transforms for all group elements during resize
			if (isGroupInteraction) {
				const scaleX = newWidth / elementStartCanvas.width;
				const scaleY = newHeight / elementStartCanvas.height;

				groupPendingTransforms = new Map(
					groupStartElements.map(el => {
						// Find the original element to get its rotation
						const originalElement = selectedElements.find(e => e.id === el.id);
						const rotation = originalElement?.rotation || 0;

						// Calculate element's center in original group
						const elCenterX = el.x + el.width / 2;
						const elCenterY = el.y + el.height / 2;

						// Calculate offset from group top-left
						const offsetX = elCenterX - elementStartCanvas.x;
						const offsetY = elCenterY - elementStartCanvas.y;

						// Scale the offset (this maintains relative positions)
						const newOffsetX = offsetX * scaleX;
						const newOffsetY = offsetY * scaleY;

						// Calculate new element center
						const newElCenterX = newX + newOffsetX;
						const newElCenterY = newY + newOffsetY;

						// Scale element size
						const newElWidth = el.width * scaleX;
						const newElHeight = el.height * scaleY;

						// Calculate new top-left position
						const newElX = newElCenterX - newElWidth / 2;
						const newElY = newElCenterY - newElHeight / 2;

						return [
							el.id,
							{
								position: { x: newElX, y: newElY },
								size: { width: newElWidth, height: newElHeight },
								rotation
							}
						];
					})
				);
			}
		} else if (interactionMode === 'rotating') {
			// Track latest screen-space cursor position for debug overlay
			currentMouseScreen = { x: e.clientX, y: e.clientY };

			// Use fixed center stored at rotation start (prevents inconsistencies)
			// For child elements, this center was calculated from DOM accounting for parent rotation
			// For root elements, this center was calculated from position
			let centerX: number, centerY: number;
			let centerScreenX: number, centerScreenY: number;
			
			if (rotationStartCenter) {
				// Use stored fixed center from rotation start
				centerX = rotationStartCenter.x;
				centerY = rotationStartCenter.y;
				centerScreenX = rotationStartCenter.screenX;
				centerScreenY = rotationStartCenter.screenY;
			} else {
				// Fallback: calculate center (shouldn't happen, but safety check)
				const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
				const canvasRect = canvasElement?.getBoundingClientRect();
				centerX = elementStartCanvas.x + elementStartCanvas.width / 2;
				centerY = elementStartCanvas.y + elementStartCanvas.height / 2;
				centerScreenX = canvasRect
					? canvasRect.left + viewport.x + centerX * viewport.scale
					: centerX;
				centerScreenY = canvasRect
					? canvasRect.top + viewport.y + centerY * viewport.scale
					: centerY;
			}

			// Get canvas rect for mouse position conversion
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			const canvasRect = canvasElement?.getBoundingClientRect();

			// Convert current mouse position to canvas space for debugging
			const mouseCanvasX = canvasRect
				? (e.clientX - canvasRect.left - viewport.x) / viewport.scale
				: (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = canvasRect
				? (e.clientY - canvasRect.top - viewport.y) / viewport.scale
				: (e.clientY - viewport.y) / viewport.scale;

			// Calculate current cursor angle from center in SCREEN space
			const cursorAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX) * (180 / Math.PI);

			// Calculate base angle from center to the reference corner (in local/unrotated space)
			const cornerOffsets = {
				nw: { x: -elementStartCanvas.width / 2, y: -elementStartCanvas.height / 2 },
				ne: { x: elementStartCanvas.width / 2, y: -elementStartCanvas.height / 2 },
				se: { x: elementStartCanvas.width / 2, y: elementStartCanvas.height / 2 },
				sw: { x: -elementStartCanvas.width / 2, y: elementStartCanvas.height / 2 }
			};
			const cornerOffset = cornerOffsets[rotationReferenceCorner];
			const cornerBaseAngle = Math.atan2(cornerOffset.y, cornerOffset.x) * (180 / Math.PI);

			// Get parent rotation to account for it in target rotation calculation
			// For groups, use first element's parent rotation (same as in rotation start)
			const state_for_parent = get(designState);
			let parentRotation = 0;
			if (isGroupInteraction && selectedElements.length > 0) {
				const firstElement = selectedElements[0];
				const parentForRotation = firstElement.parentId ? state_for_parent.elements[firstElement.parentId] : null;
				parentRotation = parentForRotation ? (parentForRotation.rotation || 0) : 0;
			} else if (activeElementId) {
				const activeElementForRotation = state_for_parent.elements[activeElementId];
				const parentForRotation = activeElementForRotation?.parentId ? state_for_parent.elements[activeElementForRotation.parentId] : null;
				parentRotation = parentForRotation ? (parentForRotation.rotation || 0) : 0;
			}

			// Calculate rotation to make corner point toward cursor
			// For child elements with rotated parents, we need to account for parent rotation
			// The visual corner angle = cornerBaseAngle + targetRotation + parentRotation
			// We want: visual corner angle = cursorAngle - rotationInitialOffset
			// So: cursorAngle - rotationInitialOffset = cornerBaseAngle + targetRotation + parentRotation
			// Therefore: targetRotation = cursorAngle - cornerBaseAngle - parentRotation - rotationInitialOffset
			let targetRotation = cursorAngle - cornerBaseAngle - parentRotation - rotationInitialOffset;

			// DEBUG: Calculate actual corner position in world space
			// Get parent rotation for debug (same as above)
			let parentRotationForDebug = parentRotation;
			// Total visual rotation includes both element and parent rotation
			const totalVisualRotation = (pendingRotation || 0) + parentRotationForDebug;
			const currentRotationRad = totalVisualRotation * (Math.PI / 180);
			const rotatedCornerX = centerX + cornerOffset.x * Math.cos(currentRotationRad) - cornerOffset.y * Math.sin(currentRotationRad);
			const rotatedCornerY = centerY + cornerOffset.x * Math.sin(currentRotationRad) + cornerOffset.y * Math.cos(currentRotationRad);
			const actualCornerAngle = Math.atan2(rotatedCornerY - centerY, rotatedCornerX - centerX) * (180 / Math.PI);

			// Store debug values for visualization
			debugCenter = { x: centerX, y: centerY };
			debugCorner = { x: rotatedCornerX, y: rotatedCornerY };
			debugCursor = { x: mouseCanvasX, y: mouseCanvasY };
			debugCursorAngle = cursorAngle;
			debugCornerAngle = actualCornerAngle;
			debugCornerBaseAngle = cornerBaseAngle;
			debugTargetRotation = targetRotation;

			// Apply Shift key snap to 15° increments
			if (e.shiftKey) {
				targetRotation = Math.round(targetRotation / 15) * 15;
			}

			// Normalize and apply rotation
			pendingRotation = normalizeRotation(targetRotation);

			// For auto layout, update position from DOM (element moves as it rotates)
			const activeElement = selectedElements.find(el => el.id === activeElementId);
			if (activeElement) {
				const state_for_autolayout = get(designState);
				const parent_for_autolayout = activeElement.parentId ? state_for_autolayout.elements[activeElement.parentId] : null;
				const parentHasAutoLayout = !!(parent_for_autolayout?.autoLayout?.enabled);
				const childIgnoresAutoLayout = !!(activeElement?.autoLayout?.ignoreAutoLayout);
				const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;
				
				if (isInAutoLayout) {
					setTimeout(() => {
						const actualPos = getAbsolutePosition(activeElement);
						pendingPosition = actualPos;
					}, 0);
					pendingPosition = getAbsolutePosition(activeElement);
				}
			}

			// Update pending transforms for all group elements during rotation
			if (isGroupInteraction) {
				const rotationDelta = (pendingRotation - elementStartRotation) * (Math.PI / 180);
				const rotationDeltaDegrees = pendingRotation - elementStartRotation;

				groupPendingTransforms = new Map(
					groupStartElements.map(el => {
						// Get the original element's rotation
						const originalElement = selectedElements.find(e => e.id === el.id);
						const originalRotation = originalElement?.rotation || 0;

						// Calculate element's center relative to group center
						const elCenterX = el.x + el.width / 2;
						const elCenterY = el.y + el.height / 2;
						const relX = elCenterX - centerX;
						const relY = elCenterY - centerY;

						// Rotate the relative position around group center
						const cos = Math.cos(rotationDelta);
						const sin = Math.sin(rotationDelta);
						const newRelX = relX * cos - relY * sin;
						const newRelY = relX * sin + relY * cos;

						// Calculate new element position (top-left corner)
						const newElCenterX = centerX + newRelX;
						const newElCenterY = centerY + newRelY;
						const newElX = newElCenterX - el.width / 2;
						const newElY = newElCenterY - el.height / 2;

						// Apply rotation delta to element's original rotation
						const newRotation = normalizeRotation(originalRotation + rotationDeltaDegrees);

						return [
							el.id,
							{
								position: { x: newElX, y: newElY },
								size: { width: el.width, height: el.height },
								rotation: newRotation
							}
						];
					})
				);
			}
		} else if (interactionMode === 'radius' && radiusCorner) {
			// Handle Alt key toggle logic for radius synchronization
			// Alt key acts as a toggle:
			// - If corners are synchronized: Alt press breaks synchronization (makes corners independent)
			// - If corners are already independent: Alt press re-synchronizes them
			const altKeyCurrentlyPressed = e.altKey;

			// Detect Alt key state change
			if (altKeyCurrentlyPressed && !radiusAltKeyPressed) {
				// Alt key was just pressed - toggle the independent state
				const wasIndependent = radiusCornersIndependent;
				radiusCornersIndependent = !radiusCornersIndependent;

				// When toggling TO independent mode, freeze the inactive corners at current pendingRadius
				// When toggling TO synchronized mode, clear frozen values
				if (radiusCornersIndependent && !wasIndependent) {
					// Toggled to INDEPENDENT - freeze inactive corners at current value
					const activeElement = selectedElements.find(el => el.id === activeElementId);
					if (activeElement && radiusCorner) {
						// Use pendingRadius (current drag value) for all corners
						// This freezes them at the value they're currently displaying
						const currentValue = pendingRadius !== null ? pendingRadius : (parseFloat(activeElement.styles?.borderRadius as string) || 0);

						radiusValuesWhenToggled = {
							nw: parseFloat(activeElement.styles?.borderTopLeftRadius as string) || currentValue,
							ne: parseFloat(activeElement.styles?.borderTopRightRadius as string) || currentValue,
							se: parseFloat(activeElement.styles?.borderBottomRightRadius as string) || currentValue,
							sw: parseFloat(activeElement.styles?.borderBottomLeftRadius as string) || currentValue
						};

						// Set frozen values for visual feedback - all corners freeze at current pendingRadius
						radiusFrozenValues = {
							nw: currentValue,
							ne: currentValue,
							se: currentValue,
							sw: currentValue
						};

					}
				} else if (!radiusCornersIndependent && wasIndependent) {
					// Toggled to SYNCHRONIZED - clear frozen values
					radiusFrozenValues = null;
				}
			}
			radiusAltKeyPressed = altKeyCurrentlyPressed;

			// Convert current mouse position to canvas space
			const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Get the center point of the element
			const centerX = elementStartCanvas.x + elementStartCanvas.width / 2;
			const centerY = elementStartCanvas.y + elementStartCanvas.height / 2;

			// Get element rotation in radians
			const activeElement = selectedElements.find(el => el.id === activeElementId);
			const rotationRad = ((activeElement?.rotation || 0) * Math.PI) / 180;

			// Translate mouse position to element's local coordinate system
			const relX = mouseCanvasX - centerX;
			const relY = mouseCanvasY - centerY;
			const cos = Math.cos(-rotationRad);
			const sin = Math.sin(-rotationRad);
			const localX = relX * cos - relY * sin + centerX;
			const localY = relX * sin + relY * cos + centerY;

			// Get the corner position in local space
			let cornerX: number, cornerY: number;

			if (radiusCorner === 'nw') {
				cornerX = elementStartCanvas.x;
				cornerY = elementStartCanvas.y;
			} else if (radiusCorner === 'ne') {
				cornerX = elementStartCanvas.x + elementStartCanvas.width;
				cornerY = elementStartCanvas.y;
			} else if (radiusCorner === 'se') {
				cornerX = elementStartCanvas.x + elementStartCanvas.width;
				cornerY = elementStartCanvas.y + elementStartCanvas.height;
			} else { // sw
				cornerX = elementStartCanvas.x;
				cornerY = elementStartCanvas.y + elementStartCanvas.height;
			}

			// Project cursor onto the 45° diagonal line from corner towards element center
			// This constrains the movement to only along the diagonal, preventing issues when cursor goes far away
			const dx = localX - cornerX;
			const dy = localY - cornerY;

			// Determine the direction of the 45° diagonal based on which corner
			// The diagonal should always point towards the center of the element
			let diagonalDirX: number, diagonalDirY: number;

			if (radiusCorner === 'nw') {
				diagonalDirX = 1;
				diagonalDirY = 1;
			} else if (radiusCorner === 'ne') {
				diagonalDirX = -1;
				diagonalDirY = 1;
			} else if (radiusCorner === 'se') {
				diagonalDirX = -1;
				diagonalDirY = -1;
			} else { // sw
				diagonalDirX = 1;
				diagonalDirY = -1;
			}

			// Normalize the diagonal direction (already unit vector for 45°)
			const diagonalLength = Math.sqrt(2);
			diagonalDirX /= diagonalLength;
			diagonalDirY /= diagonalLength;

			// Project the cursor displacement onto the diagonal direction
			// This gives us the distance along the diagonal from corner to cursor
			const currentCursorDistance = dx * diagonalDirX + dy * diagonalDirY;

			// Calculate max radius (50% of smaller dimension)
			const maxRadius = Math.min(elementStartCanvas.width, elementStartCanvas.height) / 2;

			// Target handle distance along the diagonal (where cursor is minus the stored offset)
			const targetHandleDistance = currentCursorDistance - radiusStartDistance;

			// Convert from diagonal distance to radius value
			// Since handle is at (radius, radius), diagonal distance = radius * √2
			let newRadius = targetHandleDistance / Math.sqrt(2);

			// Clamp radius to valid range [0, maxRadius]
			newRadius = Math.max(0, Math.min(maxRadius, newRadius));

			pendingRadius = newRadius;
		}
	}

	async function handleMouseUp(e?: MouseEvent) {
		if (interactionMode === 'idle') return;
		if (!isGroupInteraction && !activeElementId) return;
		
		// Get cursor position in canvas coordinates at drop time
		let cursorCanvasPos: { x: number; y: number } | null = null;
		if (e) {
			const canvasElement = document.querySelector('.canvas') as HTMLElement | null;
			const canvasRect = canvasElement?.getBoundingClientRect();
			if (canvasRect) {
				cursorCanvasPos = {
					x: (e.clientX - canvasRect.left - viewport.x) / viewport.scale,
					y: (e.clientY - canvasRect.top - viewport.y) / viewport.scale
				};
			}
		}

		// Check if actually moved beyond threshold
		const movedX = pendingPosition ? Math.abs(pendingPosition.x - elementStartCanvas.x) : 0;
		const movedY = pendingPosition ? Math.abs(pendingPosition.y - elementStartCanvas.y) : 0;
		const sizeChangedW = pendingSize ? Math.abs(pendingSize.width - elementStartCanvas.width) : 0;
		const sizeChangedH = pendingSize ? Math.abs(pendingSize.height - elementStartCanvas.height) : 0;

		if (isGroupInteraction) {
			// Handle group interaction
			if (interactionMode === 'dragging' && pendingPosition) {
				if (movedX > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || movedY > CANVAS_INTERACTION.MOVEMENT_THRESHOLD) {
					const deltaX = pendingPosition.x - elementStartCanvas.x;
					const deltaY = pendingPosition.y - elementStartCanvas.y;

					// Move all elements by the same delta as a single batch operation
					await moveElementsGroup(
						groupStartElements.map(el => ({
							elementId: el.id,
							position: { x: el.x + deltaX, y: el.y + deltaY }
						}))
					);
				}
			} else if (interactionMode === 'resizing' && pendingSize && pendingPosition) {
				const sizeChanged = sizeChangedW > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || sizeChangedH > CANVAS_INTERACTION.MOVEMENT_THRESHOLD;

				if (sizeChanged) {
					// Calculate scale ratios
					const scaleX = pendingSize.width / elementStartCanvas.width;
					const scaleY = pendingSize.height / elementStartCanvas.height;
					const deltaX = pendingPosition.x - elementStartCanvas.x;
					const deltaY = pendingPosition.y - elementStartCanvas.y;

					// Resize and reposition all elements proportionally as a single batch operation
					await resizeElementsGroup(
						groupStartElements.map(el => {
							const relX = el.x - elementStartCanvas.x;
							const relY = el.y - elementStartCanvas.y;
							const newWidth = el.width * scaleX;
							const newHeight = el.height * scaleY;
							const newX = elementStartCanvas.x + deltaX + relX * scaleX;
							const newY = elementStartCanvas.y + deltaY + relY * scaleY;

							return {
								elementId: el.id,
								size: { width: newWidth, height: newHeight },
								position: { x: newX, y: newY }
							};
						})
					);
				}
			} else if (interactionMode === 'rotating' && pendingRotation !== null) {
				// Calculate group center
				const groupCenterX = elementStartCanvas.x + elementStartCanvas.width / 2;
				const groupCenterY = elementStartCanvas.y + elementStartCanvas.height / 2;

				// Calculate rotation delta in radians and degrees
				const rotationDelta = (pendingRotation - elementStartRotation) * (Math.PI / 180);
				const rotationDeltaDegrees = pendingRotation - elementStartRotation;

				// Apply rotation to all selected elements around group center as a single batch operation
				await rotateElementsGroup(
					groupStartElements.map(el => {
						// Get the original element's rotation
						const originalElement = selectedElements.find(e => e.id === el.id);
						const originalRotation = originalElement?.rotation || 0;

						// Calculate element's center relative to group center
						const elCenterX = el.x + el.width / 2;
						const elCenterY = el.y + el.height / 2;
						const relX = elCenterX - groupCenterX;
						const relY = elCenterY - groupCenterY;

						// Rotate the relative position around group center
						const cos = Math.cos(rotationDelta);
						const sin = Math.sin(rotationDelta);
						const newRelX = relX * cos - relY * sin;
						const newRelY = relX * sin + relY * cos;

						// Calculate new element position (top-left corner)
						const newElCenterX = groupCenterX + newRelX;
						const newElCenterY = groupCenterY + newRelY;
						const newElX = newElCenterX - el.width / 2;
						const newElY = newElCenterY - el.height / 2;

						// Apply rotation delta to element's original rotation
						const newRotation = normalizeRotation(originalRotation + rotationDeltaDegrees);

						return {
							elementId: el.id,
							rotation: newRotation,
							position: { x: newElX, y: newElY }
						};
					})
				);
			}

			// Keep group selected after interaction
			selectElements(groupStartElements.map(el => el.id));
		} else if (activeElementId) {
			// Handle single element interaction
			const activeElement = selectedElements.find(el => el.id === activeElementId);

			if (interactionMode === 'dragging') {
				if (movedX > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || movedY > CANVAS_INTERACTION.MOVEMENT_THRESHOLD) {
					if (pendingPosition && activeElement) {
						// Check if parent changed during drag (drag out of/into div)
						// This applies to both auto layout and non-auto layout drags
						// IMPORTANT: Only process parent changes if we actually moved beyond threshold
						// and detected a parent (hasMovedBeyondThreshold ensures potentialDropParentId was calculated)
						if (hasMovedBeyondThreshold && potentialDropParentId !== originalParentId) {
							// Parent changed - need to update parent and position
							const state_for_drop = get(designState);
							const newParent = potentialDropParentId ? state_for_drop.elements[potentialDropParentId] : null;

							// Check if new parent has auto layout
							const newParentHasAutoLayout = newParent?.autoLayout?.enabled || false;

							if (newParentHasAutoLayout) {
								// Dropping into auto layout parent - position doesn't matter, auto layout will handle it
								// The reorder index may have been applied during drag (via reactive statement)
								// But we need to ensure the element is in the correct parent with the correct index
								const currentState = get(designState);
								const currentParent = currentState.elements[activeElementId]?.parentId;

								// Check if parent actually changed or if we need to finalize
								if (currentParent !== potentialDropParentId || !hasMovedBeyondThreshold) {
									// Parent not yet changed OR we didn't move beyond threshold (clicked without dragging)
									// Need to finalize the parent change
									await reorderElement(activeElementId, potentialDropParentId, reorderTargetIndex ?? 0);
								}
								// No need to call moveElement - auto layout will position it
							} else {
								// Dropping into non-auto layout parent - need to calculate relative position
								// Use cursor position as drop reference, maintaining the offset from drag start
								const dropPosition = cursorCanvasPos || pendingPosition;

								if (!cursorCanvasPos) {
									console.warn('cursorCanvasPos not available at drop time, using pendingPosition');
								}

								// Calculate element's center position from cursor
								const elementCenterCanvas = {
									x: dropPosition.x - dragOffsetCanvas.x,
									y: dropPosition.y - dragOffsetCanvas.y
								};

								// Convert center to top-left
								const elementTopLeftCanvas = {
									x: elementCenterCanvas.x - activeElement.size.width / 2,
									y: elementCenterCanvas.y - activeElement.size.height / 2
								};

								let relativePos: { x: number; y: number };

								if (newParent) {
									// Convert element's top-left position to relative position for new parent
									const newParentAbsPos = getAbsolutePosition(newParent);
									const newParentRotation = getDisplayRotation(newParent);

									// Get parent's center in canvas space
									const parentCenterX = newParentAbsPos.x + newParent.size.width / 2;
									const parentCenterY = newParentAbsPos.y + newParent.size.height / 2;

									// Get element's center in canvas space
									const elementCenterX = elementTopLeftCanvas.x + activeElement.size.width / 2;
									const elementCenterY = elementTopLeftCanvas.y + activeElement.size.height / 2;

									// Offset from parent center to element center (in world/canvas space)
									const dx = elementCenterX - parentCenterX;
									const dy = elementCenterY - parentCenterY;

									if (newParentRotation !== 0) {
										// Transform to parent's local space (inverse rotation)
										const angleRad = -newParentRotation * (Math.PI / 180);
										const localDx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
										const localDy = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

										// Convert from center-relative to top-left relative (in parent's local space)
										relativePos = {
											x: localDx + newParent.size.width / 2 - activeElement.size.width / 2,
											y: localDy + newParent.size.height / 2 - activeElement.size.height / 2
										};
									} else {
										// Parent not rotated - simple subtraction
										relativePos = {
											x: elementTopLeftCanvas.x - newParentAbsPos.x,
											y: elementTopLeftCanvas.y - newParentAbsPos.y
										};
									}
								} else {
									// Dropping at root - element top-left is already in absolute coordinates
									relativePos = elementTopLeftCanvas;
								}

								// Change parent and move position
								// Note: If parent changed during auto layout drag, reorderElement was already called
								// during the drag via the reactive statement, so we only need to call moveElement here
								if (!reorderParentId || potentialDropParentId !== (get(designState).elements[activeElementId]?.parentId)) {
									// Parent not yet changed, or changed to different parent than current
									await reorderElement(activeElementId, potentialDropParentId, reorderTargetIndex ?? 0);
								}
								await moveElement(activeElementId, relativePos);
							}
						} else {
							// Parent didn't change - just move within same parent
							if (reorderParentId) {
								// In auto layout - apply final reorder index
								// We skipped live reordering to avoid unwanted reordering from clicks
								// Now apply the final index on mouseup
								if (reorderTargetIndex !== null && reorderTargetIndex !== reorderOriginalIndex) {
									await reorderElement(activeElementId, reorderParentId, reorderTargetIndex);
								}
							} else {
								// Not in auto layout - move the element
								// FIX: Use center-based transformation to prevent jump on drop for rotated nested elements
								const currentSize = activeElement.size;
								const centerWorld = {
									x: pendingPosition.x + currentSize.width / 2,
									y: pendingPosition.y + currentSize.height / 2
								};
								const centerLocal = absoluteToRelativePosition(activeElement, centerWorld);
								const relativePos = {
									x: centerLocal.x - currentSize.width / 2,
									y: centerLocal.y - currentSize.height / 2
								};

								await moveElement(activeElementId, relativePos);
							}
						}
					}
				}
			} else if (interactionMode === 'resizing') {
				const sizeChanged = sizeChangedW > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || sizeChangedH > CANVAS_INTERACTION.MOVEMENT_THRESHOLD;
				const positionChanged = movedX > CANVAS_INTERACTION.MOVEMENT_THRESHOLD || movedY > CANVAS_INTERACTION.MOVEMENT_THRESHOLD;

				if (sizeChanged || positionChanged) {
					if (pendingSize && activeElement) {
						// Convert absolute position to parent-relative position if needed
						let relativePos: { x: number; y: number } | undefined;

						if (positionChanged && pendingPosition) {
							// FIX: Use center-based transformation to prevent jump on resize for rotated nested elements
							// This mirrors the fix applied to dragging logic
							const currentSize = pendingSize; // Use the NEW size
							
							// 1. Calculate center in world space
							const centerWorld = {
								x: pendingPosition.x + currentSize.width / 2,
								y: pendingPosition.y + currentSize.height / 2
							};
							
							// 2. Transform center to local space (parent-relative)
							const centerLocal = absoluteToRelativePosition(activeElement, centerWorld);
							
							// 3. Convert back to top-left in local space
							relativePos = {
								x: centerLocal.x - currentSize.width / 2,
								y: centerLocal.y - currentSize.height / 2
							};
						}

						await resizeElement(
							activeElementId,
							pendingSize,
							relativePos
						);
					}
				}
			} else if (interactionMode === 'rotating' && pendingRotation !== null) {
				// Apply rotation
				await rotateElement(activeElementId, pendingRotation);
			} else if (interactionMode === 'radius' && pendingRadius !== null) {
				// Apply border radius change based on whether corners are independent
					if (radiusCornersIndependent && radiusCorner) {
					// Independent mode: only update the specific corner being dragged
					// Use the captured values when we toggled to independent, or get current values
					const activeElement = selectedElements.find(el => el.id === activeElementId);
					if (activeElement) {
						const cornerProperty = {
							'nw': 'borderTopLeftRadius',
							'ne': 'borderTopRightRadius',
							'se': 'borderBottomRightRadius',
							'sw': 'borderBottomLeftRadius'
						}[radiusCorner] as 'borderTopLeftRadius' | 'borderTopRightRadius' | 'borderBottomRightRadius' | 'borderBottomLeftRadius';

						// Use captured values if we toggled during this drag, otherwise use existing values
						let cornerValues;
						if (radiusValuesWhenToggled) {
							cornerValues = radiusValuesWhenToggled;
						} else {
							// Already was independent - use current values
							const uniformRadius = parseFloat(activeElement.styles?.borderRadius as string) || 0;
							cornerValues = {
								nw: parseFloat(activeElement.styles?.borderTopLeftRadius as string) || uniformRadius,
								ne: parseFloat(activeElement.styles?.borderTopRightRadius as string) || uniformRadius,
								se: parseFloat(activeElement.styles?.borderBottomRightRadius as string) || uniformRadius,
								sw: parseFloat(activeElement.styles?.borderBottomLeftRadius as string) || uniformRadius
							};
						}

						await updateElementStyles(activeElementId, {
							borderRadius: undefined, // Clear uniform radius
							borderTopLeftRadius: `${cornerValues.nw}px`,
							borderTopRightRadius: `${cornerValues.ne}px`,
							borderBottomRightRadius: `${cornerValues.se}px`,
							borderBottomLeftRadius: `${cornerValues.sw}px`,
							[cornerProperty]: `${pendingRadius}px` // Update only the dragged corner
						});
					}
				} else {
					// Synchronized mode: update all corners together
					await updateElementStyles(activeElementId, {
						borderRadius: `${pendingRadius}px`,
						// Clear individual corner radii when setting uniform radius
						borderTopLeftRadius: undefined,
						borderTopRightRadius: undefined,
						borderBottomRightRadius: undefined,
						borderBottomLeftRadius: undefined
					});
				}
			}

			// Keep element selected after interaction
			selectElement(activeElementId);
		}

		// Reset state
		interactionMode = 'idle';
		activeElementId = null;
		isGroupInteraction = false;
		isDuplicateDrag = false;
		hasDuplicated = false;
		originalElementIds = [];
		duplicateElementIds = [];
		resizeHandle = null;
		pendingPosition = null;
		pendingSize = null;
		pendingRotation = null;
		pendingRadius = null;
		rotationStartCenter = null;
		radiusCorner = null;
		radiusStartDistance = 0;
		radiusInitialValue = 0;
		radiusCornersIndependent = false;
		radiusStartedIndependent = false;
		radiusAltKeyPressed = false;
		radiusValuesWhenToggled = null;
		groupStartElements = [];
		groupPendingTransforms = new Map();
		hasMovedPastThreshold = false;
		initialHandlePosition = null;
		mouseToHandleOffset = { x: 0, y: 0 };
		reorderTargetIndex = null;
		reorderParentId = null;
		reorderOriginalIndex = null;
		lastAppliedIndex = null;
		reorderGhostOffset = { x: 0, y: 0 };
		reorderElementRotation = 0;
		reorderElementSize = { width: 0, height: 0 };
		potentialDropParentId = null;

		// Clear debug values
		debugCenter = null;
		debugCorner = null;
		debugCursor = null;

		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}

	// Cleanup on destroy - remove all event listeners to prevent memory leaks
	onDestroy(() => {
		// Clean up all tracked event listeners
		cleanupFunctions.forEach(cleanup => cleanup());
		cleanupFunctions.length = 0;

		// Also clean up the main handlers as a safety measure
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});

	// Set up persistent mouse move listener for hover tracking
	onMount(() => {
		function handleHoverMouseMove(e: MouseEvent) {
			// Only track hover when idle
			if (interactionMode === 'idle') {
				const element = document.elementFromPoint(e.clientX, e.clientY);
				const canvasElement = element?.closest('[data-element-id]') as HTMLElement | null;
				const elementId = canvasElement?.getAttribute('data-element-id') || null;
				
				// Only update if changed to avoid unnecessary reactivity
				if (hoveredElementId !== elementId) {
					hoveredElementId = elementId;
				}
			} else {
				// Clear hover when not idle
				if (hoveredElementId !== null) {
					hoveredElementId = null;
				}
			}
		}

		document.addEventListener('mousemove', handleHoverMouseMove);
		
		return () => {
			document.removeEventListener('mousemove', handleHoverMouseMove);
		};
	});
</script>

<!-- Render selection UI (hide during rotation, during auto layout reordering, or during parent change transition) -->
	{#if selectedElements.length === 1 && !(interactionMode === 'dragging' && reorderParentId) && interactionMode !== 'rotating' && !$interactionState.hiddenDuringTransition}
		<!-- Single element selection (hidden during auto layout reordering - ghost shows instead) -->
		{@const selectedElement = selectedElements[0]}
		{@const state = get(designState)}
		{@const parent = selectedElement.parentId ? $designState.elements[selectedElement.parentId] : null}
		{@const parentHasAutoLayout = parent?.autoLayout?.enabled || false}
		{@const childIgnoresAutoLayout = selectedElement.autoLayout?.ignoreAutoLayout || false}
		{@const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout}
		{@const parentTransform = parent ? (() => {
			const absPos = getAbsolutePosition(parent);
			// getCumulativeRotation returns sum of ANCESTORS' rotations (not including parent itself)
			const ancestorRot = getCumulativeRotation(parent);
			// Total rotation for the wrapper should include parent's own rotation
			const totalRot = ancestorRot + (parent.rotation || 0);
			
			// For nested parents, getAbsolutePosition returns the ACTUAL WORLD ORIGIN (top-left corner).
			// But the wrapper is rotated around its center.
			// We need to calculate the "unrotated position" that, when rotated around center, results in the Actual Origin.
			// The Origin position is determined by ANCESTORS' rotation only (parent rotates around its own center).
			// Formula: UnrotatedPos = ActualOrigin - Size/2 + Rotate_Ancestors(Size/2)
			
			let pos = absPos;
			if (parent.parentId) {
				const angleRad = ancestorRot * (Math.PI / 180);
				const cos = Math.cos(angleRad);
				const sin = Math.sin(angleRad);
				const halfW = parent.size.width / 2;
				const halfH = parent.size.height / 2;
				
				// Rotate(Size/2) using ancestor rotation
				const rotatedHalfW = halfW * cos - halfH * sin;
				const rotatedHalfH = halfW * sin + halfH * cos;
				
				pos = {
					x: absPos.x - halfW + rotatedHalfW,
					y: absPos.y - halfH + rotatedHalfH
				};
			}

			return {
				position: pos,
				rotation: totalRot,
				size: parent.size
			};
		})() : null}
		{@const relativePendingPosition = (() => {
			// If element is being dragged and has pending position
			if (activeElementId === selectedElement.id && pendingPosition) {
				// If element has a parent, convert absolute position to relative
				if (parent) {
					// FIX: For rotated parents, we must transform the CENTER of the element, not the top-left.
					// Transforming top-left directly fails because rotation happens around the center.
					const currentSize = pendingSize || selectedElement.size;
					
					// 1. Calculate center in world space
					const centerWorld = {
						x: pendingPosition.x + currentSize.width / 2,
						y: pendingPosition.y + currentSize.height / 2
					};
					
					// 2. Transform center to local space (parent-relative)
					const centerLocal = absoluteToRelativePosition(selectedElement, centerWorld);
					
					// 3. Convert back to top-left in local space
					return {
						x: centerLocal.x - currentSize.width / 2,
						y: centerLocal.y - currentSize.height / 2
					};
				}
				// If element has no parent (root-level), pendingPosition is already absolute
				return pendingPosition;
			}
			// For auto layout children, get actual rendered position from DOM
			if (isInAutoLayout && parent && parentTransform) {
				const domElement = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
				const parentDomElement = document.querySelector(`[data-element-id="${parent.id}"]`);
				
				if (domElement && parentDomElement) {
					// 1. Get centers in screen space (zoomed) from DOM
					// note: getBoundingClientRect().width/height is the bounding box size, but center is accurate
					const elementRect = domElement.getBoundingClientRect();
					const parentRect = parentDomElement.getBoundingClientRect();
					
					const elementCenterX = elementRect.left + elementRect.width / 2;
					const elementCenterY = elementRect.top + elementRect.height / 2;
					const parentCenterX = parentRect.left + parentRect.width / 2;
					const parentCenterY = parentRect.top + parentRect.height / 2;
					
					// 2. Calculate vector from parent center to element center (screen space)
					const dx = elementCenterX - parentCenterX;
					const dy = elementCenterY - parentCenterY;
					
					// 3. Convert to model space (unzoomed)
					// SelectionUI scales positions by viewport.scale, so we need unscaled units here
					const dxModel = dx / viewport.scale;
					const dyModel = dy / viewport.scale;
					
					// 4. Rotate vector by -parentRotation to map back to local unrotated space
					// This handles the mismatch between visual flexbox position (rotated) and local coordinate system
					const parentRotationRad = (parentTransform.rotation || 0) * (Math.PI / 180);
					const cos = Math.cos(-parentRotationRad);
					const sin = Math.sin(-parentRotationRad);
					
					const localDx = dxModel * cos - dyModel * sin;
					const localDy = dxModel * sin + dyModel * cos;
					
					// 5. Calculate local position relative to parent top-left
					// Parent center in local space is (width/2, height/2)
					const parentHalfW = parent.size.width / 2;
					const parentHalfH = parent.size.height / 2;
					
					// Element center in local space
					const localCenterX = parentHalfW + localDx;
					const localCenterY = parentHalfH + localDy;
					
					// 6. Convert center to top-left for SelectionUI
					const currentSize = pendingSize || selectedElement.size;
					
					return {
						x: localCenterX - currentSize.width / 2,
						y: localCenterY - currentSize.height / 2
					};
				}
			}
			// Default: use element's stored position (already relative to parent)
			return null;
		})()}
		<SelectionUI
			element={selectedElement}
			{viewport}
			{isPanning}
			pendingPosition={relativePendingPosition}
			pendingSize={activeElementId === selectedElement.id ? pendingSize : null}
			pendingRadius={activeElementId === selectedElement.id ? pendingRadius : null}
			activeRadiusCorner={activeElementId === selectedElement.id ? radiusCorner : null}
			radiusCornersIndependent={activeElementId === selectedElement.id ? radiusCornersIndependent : false}
			radiusFrozenValues={activeElementId === selectedElement.id ? radiusFrozenValues : null}
			rotation={getDisplayRotation(selectedElement)}
			{parentTransform}
			onMouseDown={(e, handle) => handleMouseDown(e, selectedElement, handle)}
		/>
	{:else if selectedElements.length > 1 && groupBounds && interactionMode !== 'rotating' && !$interactionState.hiddenDuringTransition}
		<!-- Multi-element selection - single bounding box -->
		<!-- Note: groupBounds already accounts for rotated elements by calculating their corners -->
		<!-- groupBounds is reactive to groupPendingTransforms, so it updates in real-time during interactions -->
		<SelectionUI
			element={{
				id: 'group',
				type: 'div',
				parentId: null,
				pageId: '',
				position: { x: groupBounds.x, y: groupBounds.y },
				size: { width: groupBounds.width, height: groupBounds.height },
				styles: {},
				typography: {},
				spacing: {},
				children: [],
				zIndex: 0
			}}
			{viewport}
			{isPanning}
			pendingPosition={null}
			pendingSize={null}
			pendingRadius={null}
			rotation={0}
			onMouseDown={(e, handle) => startGroupInteraction(e, handle)}
		/>
	{/if}

<!-- Hover border - show border on hover (like Figma/Framer) -->
{#if hoveredElementId && interactionMode === 'idle' && !$interactionState.hiddenDuringTransition}
	{@const hoveredElement = $designState.elements[hoveredElementId]}
	{@const isHoveredSelected = selectedElements.some(el => el.id === hoveredElementId)}
	{#if hoveredElement && !isHoveredSelected && $interactionState.mode !== 'editing-text'}
		{@const parent = hoveredElement.parentId ? $designState.elements[hoveredElement.parentId] : null}
		{@const parentTransform = parent ? (() => {
			const absPos = getAbsolutePosition(parent);
			const ancestorRot = getCumulativeRotation(parent);
			const totalRot = ancestorRot + (parent.rotation || 0);
			
			let parentPos = absPos;
			if (parent.parentId) {
				const angleRad = ancestorRot * (Math.PI / 180);
				const cos = Math.cos(angleRad);
				const sin = Math.sin(angleRad);
				const halfW = parent.size.width / 2;
				const halfH = parent.size.height / 2;
				
				const rotatedHalfW = halfW * cos - halfH * sin;
				const rotatedHalfH = halfW * sin + halfH * cos;
				
				parentPos = {
					x: absPos.x - halfW + rotatedHalfW,
					y: absPos.y - halfH + rotatedHalfH
				};
			}

			return {
				position: parentPos,
				rotation: totalRot,
				size: parent.size
			};
		})() : null}
		{@const parentHasAutoLayout = parent?.autoLayout?.enabled || false}
		{@const childIgnoresAutoLayout = hoveredElement.autoLayout?.ignoreAutoLayout || false}
		{@const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout}
		{@const absPos = getAbsolutePosition(hoveredElement)}
		{@const pos = isInAutoLayout ? absPos : hoveredElement.position}
		{@const size = hoveredElement.size}
		{@const elementRotation = getDisplayRotation(hoveredElement)}
		{@const cumulativeRotation = isInAutoLayout ? getCumulativeRotation(hoveredElement) : 0}
		{@const totalRotation = elementRotation + cumulativeRotation}
		{@const rotation = totalRotation}
		{@const hasParent = parent !== null && !isInAutoLayout}
		{@const canvasElement = document.querySelector('.canvas')}
		{#if canvasElement}
			{@const canvasRect = canvasElement.getBoundingClientRect()}
			{@const parentWrapperScreenPos = hasParent && parentTransform ? {
				x: canvasRect.left + viewport.x + parentTransform.position.x * viewport.scale,
				y: canvasRect.top + viewport.y + parentTransform.position.y * viewport.scale
			} : null}
			{@const screenWidth = size.width * viewport.scale}
			{@const screenHeight = size.height * viewport.scale}
			{@const centerX = screenWidth / 2}
			{@const centerY = screenHeight / 2}
			{@const parentCenterX = hasParent && parentTransform ? parentTransform.size.width / 2 * viewport.scale : 0}
			{@const parentCenterY = hasParent && parentTransform ? parentTransform.size.height / 2 * viewport.scale : 0}
			{@const childScreenPos = hasParent ? {
				x: pos.x * viewport.scale,
				y: pos.y * viewport.scale
			} : {
				x: canvasRect.left + viewport.x + pos.x * viewport.scale,
				y: canvasRect.top + viewport.y + pos.y * viewport.scale
			}}

			{#if hasParent && parentTransform && parentWrapperScreenPos}
				<!-- Parent wrapper: applies parent's transform -->
				<div
					style="
						position: fixed;
						left: {parentWrapperScreenPos.x}px;
						top: {parentWrapperScreenPos.y}px;
						{parentTransform.rotation ? `transform: rotate(${parentTransform.rotation}deg); transform-origin: ${parentCenterX}px ${parentCenterY}px;` : ''}
						pointer-events: none;
					"
				>
					<!-- Selection container: positioned relative to parent, rotated by element's own rotation -->
					<div
						style="
							position: absolute;
							left: {childScreenPos.x}px;
							top: {childScreenPos.y}px;
							width: {screenWidth}px;
							height: {screenHeight}px;
							{rotation ? `transform: rotate(${rotation}deg); transform-origin: ${centerX}px ${centerY}px;` : ''}
							pointer-events: none;
						"
					>
						<!-- Hover border -->
						<div
							style="
								position: absolute;
								left: 0;
								top: 0;
								width: 100%;
								height: 100%;
								border: 2px solid #3b82f6;
								pointer-events: none;
								box-sizing: border-box;
							"
						/>
					</div>
				</div>
			{:else}
				<!-- No parent: positioned absolutely in canvas space -->
				<div
					style="
						position: fixed;
						left: {childScreenPos.x}px;
						top: {childScreenPos.y}px;
						width: {screenWidth}px;
						height: {screenHeight}px;
						{rotation ? `transform: rotate(${rotation}deg); transform-origin: ${centerX}px ${centerY}px;` : ''}
						pointer-events: none;
					"
				>
					<!-- Hover border -->
					<div
						style="
							position: absolute;
							left: 0;
							top: 0;
							width: 100%;
							height: 100%;
							border: 2px solid #3b82f6;
							pointer-events: none;
							box-sizing: border-box;
						"
					/>
				</div>
			{/if}
			{/if}
		{/if}
	{/if}

<!-- Rotation angle display - follows cursor -->
{#if interactionMode === 'rotating' && pendingRotation !== null && currentMouseScreen.x !== 0 && currentMouseScreen.y !== 0}
	<div
		style="
			position: fixed;
			left: {currentMouseScreen.x + 20}px;
			top: {currentMouseScreen.y - 30}px;
			background: #1e293b;
			color: white;
			padding: 4px 12px;
			border-radius: 4px;
			font-size: 12px;
			font-family: system-ui, -apple-system, sans-serif;
			font-weight: 500;
			pointer-events: none;
			white-space: nowrap;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			z-index: 10001;
		"
	>
		{Math.round(pendingRotation)}°
	</div>
{/if}

<!-- Auto layout reordering: Ghost element following cursor -->
{#if interactionMode === 'dragging' && reorderParentId && activeElementId}
	{@const draggedElement = selectedElements.find(el => el.id === activeElementId)}
	{#if draggedElement && pendingPosition}
		{@const ghostSize = displaySizeForSelection || draggedElement.size}
		<!-- Use pendingPosition which is already being updated to follow cursor during reordering -->
		{@const ghostPos = pendingPosition}

		<!-- Ghost element with visual preview -->
		{@const totalRotation = getCumulativeRotation(draggedElement) + (draggedElement.rotation || 0)}

		{@const ghostScreenLeft = viewport.x + ghostPos.x * viewport.scale}
		{@const ghostScreenTop = viewport.y + ghostPos.y * viewport.scale}
		{@const ghostWidth = ghostSize.width * viewport.scale}
		{@const ghostHeight = ghostSize.height * viewport.scale}

		<div
			style="
				position: fixed;
				left: {ghostScreenLeft}px;
				top: {ghostScreenTop}px;
				width: {ghostWidth}px;
				height: {ghostHeight}px;
				background-color: {draggedElement.styles?.backgroundColor || '#f5f5f5'};
				border: {draggedElement.styles?.borderWidth || '0px'} {draggedElement.styles?.borderStyle || 'solid'} {draggedElement.styles?.borderColor || 'transparent'};
				border-radius: {draggedElement.styles?.borderRadius || '0px'};
				opacity: 0.9;
				pointer-events: none;
				z-index: 10000;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				transform: rotate({totalRotation}deg);
				transform-origin: center center;
			"
		>
			{#if draggedElement.type === 'img'}
				<img
					src={draggedElement.src || ''}
					alt={draggedElement.alt || ''}
					style="width: 100%; height: 100%; object-fit: {draggedElement.styles?.objectFit || 'cover'};"
				/>
			{/if}
		</div>
	{/if}
{/if}

<!-- DEBUG: Rotation visualization -->
{#if interactionMode === 'rotating' && debugCenterScreen && debugCornerScreen && debugCursorScreen}
	<svg
		style="
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			pointer-events: none;
			z-index: 100000;
		"
	>

		<!-- Line from center to cursor (RED) -->
		<line
			x1={debugCenterScreen.x}
			y1={debugCenterScreen.y}
			x2={debugCursorScreen.x}
			y2={debugCursorScreen.y}
			stroke="red"
			stroke-width="2"
			opacity="0.7"
		/>

		<!-- Line from center to corner (GREEN) -->
		<line
			x1={debugCenterScreen.x}
			y1={debugCenterScreen.y}
			x2={debugCornerScreen.x}
			y2={debugCornerScreen.y}
			stroke="lime"
			stroke-width="2"
			opacity="0.7"
		/>

		<!-- Center point (BLUE) -->
		<circle cx={debugCenterScreen.x} cy={debugCenterScreen.y} r="6" fill="blue" opacity="0.8" />

		<!-- Corner point (GREEN) -->
		<circle cx={debugCornerScreen.x} cy={debugCornerScreen.y} r="6" fill="lime" opacity="0.8" />

		<!-- Cursor point (RED) -->
		<circle cx={debugCursorScreen.x} cy={debugCursorScreen.y} r="6" fill="red" opacity="0.8" />

		<!-- Labels -->
		<text x={debugCenterScreen.x + 10} y={debugCenterScreen.y - 10} fill="blue" font-size="12" font-weight="bold">
			CENTER
		</text>
		<text x={debugCornerScreen.x + 10} y={debugCornerScreen.y - 10} fill="lime" font-size="12" font-weight="bold">
			CORNER ({rotationReferenceCorner.toUpperCase()})
		</text>
		<text x={debugCursorScreen.x + 10} y={debugCursorScreen.y + 20} fill="red" font-size="12" font-weight="bold">
			CURSOR
		</text>

		<!-- Angle information -->
		<g transform="translate(20, 80)">
			<rect x="0" y="0" width="320" height="180" fill="black" opacity="0.8" rx="5" />
			<text x="10" y="20" fill="white" font-size="12" font-family="monospace">
				Corner Base Angle: {debugCornerBaseAngle.toFixed(2)}°
			</text>
			<text x="10" y="40" fill="white" font-size="12" font-family="monospace">
				Cursor Angle: {debugCursorAngle.toFixed(2)}°
			</text>
			<text x="10" y="60" fill="lime" font-size="12" font-family="monospace">
				Actual Corner Angle: {debugCornerAngle.toFixed(2)}°
			</text>
			<text x="10" y="80" fill="yellow" font-size="12" font-family="monospace">
				Angular Delta: {(debugCursorAngle - debugCornerAngle).toFixed(2)}°
			</text>
			<text x="10" y="100" fill="white" font-size="12" font-family="monospace">
				Initial Offset: {rotationInitialOffset.toFixed(2)}°
			</text>
			<text x="10" y="120" fill="white" font-size="12" font-family="monospace">
				Element Start Rotation: {elementStartRotation.toFixed(2)}°
			</text>
			<text x="10" y="140" fill="white" font-size="12" font-family="monospace">
				Target Rotation: {debugTargetRotation.toFixed(2)}°
			</text>
			<text x="10" y="160" fill="cyan" font-size="12" font-family="monospace">
				Pending Rotation: {(pendingRotation || 0).toFixed(2)}°
			</text>
		</g>
	</svg>
{/if}

<!-- Drop parent boundary visualization - show wrapper boundaries when dragging inside -->
{#if interactionMode === 'dragging' && potentialDropParentId}
	{@const state = $designState}
	{@const dropParent = state.elements[potentialDropParentId]}
	{#if dropParent}
		{@const canvasElement = document.querySelector('.canvas')}
		{#if canvasElement}
			{@const canvasRect = canvasElement.getBoundingClientRect()}
			
			<!-- FIX: Apply same coordinate transformation logic as SelectionUI for nested rotated parents -->
			{@const ancestorRot = getCumulativeRotation(dropParent)}
			{@const totalRot = ancestorRot + (dropParent.rotation || 0)}
			{@const absPos = getAbsolutePosition(dropParent)}
			
			{@const parentCanvasPos = (() => {
				let pos = absPos;
				if (dropParent.parentId) {
					const angleRad = ancestorRot * (Math.PI / 180);
					const cos = Math.cos(angleRad);
					const sin = Math.sin(angleRad);
					const halfW = dropParent.size.width / 2;
					const halfH = dropParent.size.height / 2;
					
					// Rotate(Size/2) using ancestor rotation
					const rotatedHalfW = halfW * cos - halfH * sin;
					const rotatedHalfH = halfW * sin + halfH * cos;
					
					pos = {
						x: absPos.x - halfW + rotatedHalfW,
						y: absPos.y - halfH + rotatedHalfH
					};
				}
				return pos;
			})()}

			{@const parentRotation = totalRot}
			{@const parentSize = dropParent.size}

			{@const parentScreenLeft = canvasRect.left + viewport.x + parentCanvasPos.x * viewport.scale}
			{@const parentScreenTop = canvasRect.top + viewport.y + parentCanvasPos.y * viewport.scale}
			{@const parentScreenWidth = parentSize.width * viewport.scale}
			{@const parentScreenHeight = parentSize.height * viewport.scale}
			{@const parentCenterX = parentScreenWidth / 2}
			{@const parentCenterY = parentScreenHeight / 2}

			{@const draggedElement = activeElementId ? state.elements[activeElementId] : null}
			{@const isSameAsOriginalParent = draggedElement && draggedElement.parentId === potentialDropParentId}
			{@const isView = dropParent.isView === true}
			{@const hasAutoLayout = dropParent.autoLayout?.enabled === true}
			{@const isRegularDiv = dropParent.type === 'div' && !isView && !hasAutoLayout}

			{@const shouldHideHighlight = isSameAsOriginalParent && isView}
			{@const shouldShowMinimalHighlight = isSameAsOriginalParent && isRegularDiv}

			{#if !shouldHideHighlight}
				<div
					style="
						position: fixed;
						left: {parentScreenLeft}px;
						top: {parentScreenTop}px;
						width: {parentScreenWidth}px;
						height: {parentScreenHeight}px;
						border: {shouldShowMinimalHighlight ? '1px dotted #3b82f6' : '2px dashed #3b82f6'};
						background: {shouldShowMinimalHighlight ? 'transparent' : 'rgba(59, 130, 246, 0.05)'};
						pointer-events: none;
						box-sizing: border-box;
						z-index: 9999;
						{parentRotation ? `transform: rotate(${parentRotation}deg); transform-origin: ${parentCenterX}px ${parentCenterY}px;` : ''}
					"
				/>
			{/if}
		{/if}
	{/if}
{/if}

