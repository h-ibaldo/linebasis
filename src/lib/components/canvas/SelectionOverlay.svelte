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

	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import type { Element } from '$lib/types/events';
	import { moveElement, resizeElement, rotateElement, moveElementsGroup, resizeElementsGroup, rotateElementsGroup, selectElement, selectElements, clearSelection, addToSelection, removeFromSelection, updateElementStyles } from '$lib/stores/design-store';
	import { interactionState } from '$lib/stores/interaction-store';
	import { currentTool } from '$lib/stores/tool-store';
	import SelectionUI from './SelectionUI.svelte';

	// Props
	export let viewport: { x: number; y: number; scale: number };
	export let selectedElements: Element[];
	export let isPanning: boolean = false;

	// Local interaction state
	let activeElementId: string | null = null;
	let interactionMode: 'idle' | 'dragging' | 'resizing' | 'rotating' | 'radius' = 'idle';
	let resizeHandle: string | null = null;
	let isGroupInteraction = false; // Track if interacting with multiple elements

	// Pending transform during interaction (for live preview)
	let pendingPosition: { x: number; y: number } | null = null;
	let pendingSize: { width: number; height: number } | null = null;
	let pendingRotation: number | null = null;
	let pendingRadius: number | null = null;
	let rotationStartAngle: number = 0; // Initial angle at rotation start
	let elementStartRotation: number = 0; // Element's rotation at start
	let radiusCorner: 'nw' | 'ne' | 'se' | 'sw' | null = null; // Which corner is being adjusted
	let radiusStartDistance: number = 0; // Initial distance from corner at drag start
	let radiusInitialValue: number = 0; // Initial radius value at drag start
	let groupPendingTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }> = new Map();

	// Broadcast state to store for CanvasElement to consume
	$: {
		interactionState.set({
			activeElementId,
			mode: interactionMode,
			pendingPosition,
			pendingSize,
			pendingRotation,
			pendingRadius,
			groupTransforms: groupPendingTransforms
		});
	}

	// Drag start tracking
	let dragStartScreen = { x: 0, y: 0 };
	let elementStartCanvas = { x: 0, y: 0, width: 0, height: 0 };
	let groupStartElements: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
	let hasMovedPastThreshold = false; // Track if we've moved past the initial dead zone
	let initialHandlePosition: Point | null = null; // The ideal position of the handle being dragged at start
	let mouseToHandleOffset: Point = { x: 0, y: 0 }; // Offset from mouse click to ideal handle position

	// Constants
	const MOVEMENT_THRESHOLD = 2; // px
	const RESIZE_START_THRESHOLD = 3; // px - dead zone for resize start to avoid initial jump

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

	// Helper: Get display position (pending or actual)
	function getDisplayPosition(element: Element): { x: number; y: number } {
		if (isGroupInteraction && groupPendingTransforms.has(element.id)) {
			return groupPendingTransforms.get(element.id)!.position;
		}
		return pendingPosition && activeElementId === element.id ? pendingPosition : element.position;
	}

	// Helper: Get display size (pending or actual)
	function getDisplaySize(element: Element): { width: number; height: number } {
		if (isGroupInteraction && groupPendingTransforms.has(element.id)) {
			return groupPendingTransforms.get(element.id)!.size;
		}
		return pendingSize && activeElementId === element.id ? pendingSize : element.size;
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

				// Store initial bounds for all elements
				groupStartElements = selectedElements.map(el => ({
					id: el.id,
					x: el.position.x,
					y: el.position.y,
					width: el.size.width,
					height: el.size.height
				}));

				// Store group bounds (use unrotated bounds for consistent coordinate system)
				const unrotatedBounds = getUnrotatedGroupBounds(selectedElements);
				elementStartCanvas = {
					x: unrotatedBounds.x,
					y: unrotatedBounds.y,
					width: unrotatedBounds.width,
					height: unrotatedBounds.height
				};

				interactionMode = 'dragging';
				pendingPosition = { x: elementStartCanvas.x, y: elementStartCanvas.y };

				document.addEventListener('mousemove', handleMouseMove);
				document.addEventListener('mouseup', handleMouseUp);
			};

			e.stopPropagation();
			e.preventDefault();

			document.addEventListener('mousemove', checkMove);
			document.addEventListener('mouseup', handleClick);
			return;
		}

		// Handle is provided (resize or rotate)
		e.stopPropagation();
		e.preventDefault();

		isGroupInteraction = true;
		dragStartScreen = { x: e.clientX, y: e.clientY };

		// Store initial bounds for all elements
		groupStartElements = selectedElements.map(el => ({
			id: el.id,
			x: el.position.x,
			y: el.position.y,
			width: el.size.width,
			height: el.size.height
		}));

		// Store group bounds (use unrotated bounds for resize calculations)
		// This ensures consistent coordinate system when scaling
		const unrotatedBounds = getUnrotatedGroupBounds(selectedElements);
		elementStartCanvas = {
			x: unrotatedBounds.x,
			y: unrotatedBounds.y,
			width: unrotatedBounds.width,
			height: unrotatedBounds.height
		};

		if (handle === 'rotate') {
			// Rotation mode
			interactionMode = 'rotating';

			// Calculate center point of selection
			const centerX = elementStartCanvas.x + elementStartCanvas.width / 2;
			const centerY = elementStartCanvas.y + elementStartCanvas.height / 2;

			// Convert mouse position to canvas space
			const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Calculate initial angle
			rotationStartAngle = Math.atan2(mouseCanvasY - centerY, mouseCanvasX - centerX) * (180 / Math.PI);

			// Store current rotation of first element (for groups, we'll rotate all together)
			elementStartRotation = selectedElements[0].rotation || 0;
			pendingRotation = elementStartRotation;
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
	export function startDrag(e: MouseEvent, element: Element, handle?: string) {
		const tool = get(currentTool);

		// Don't handle if hand tool or space panning is active - let canvas handle it
		if (tool === 'hand' || isPanning) {
			return;
		}

		e.stopPropagation();
		e.preventDefault();

		activeElementId = element.id;
		isGroupInteraction = false;
		dragStartScreen = { x: e.clientX, y: e.clientY };

		const pos = getDisplayPosition(element);
		const size = getDisplaySize(element);

		elementStartCanvas = {
			x: pos.x,
			y: pos.y,
			width: size.width,
			height: size.height
		};

		if (handle === 'rotate') {
			// Rotation mode
			interactionMode = 'rotating';

			// Calculate center point
			const centerX = pos.x + size.width / 2;
			const centerY = pos.y + size.height / 2;

			// Convert mouse position to canvas space
			const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Calculate initial angle
			rotationStartAngle = Math.atan2(mouseCanvasY - centerY, mouseCanvasX - centerX) * (180 / Math.PI);

			// Store current rotation
			elementStartRotation = element.rotation || 0;
			pendingRotation = elementStartRotation;
		} else if (handle?.startsWith('radius-')) {
			// Corner radius mode
			interactionMode = 'radius';

			// Extract corner from handle (e.g., 'radius-nw' -> 'nw')
			radiusCorner = handle.split('-')[1] as 'nw' | 'ne' | 'se' | 'sw';

			// Store current border radius
			radiusInitialValue = parseFloat(element.styles?.borderRadius as string) || 0;

			// When starting interaction, if radius is 0, treat it as BASE_DISTANCE for handle positioning
			// This matches the visual position of the handle in SelectionUI
			const BASE_DISTANCE = 10;
			const visualRadius = radiusInitialValue > 0 ? radiusInitialValue : BASE_DISTANCE;

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
			// Don't set pending values yet - wait until mouse actually moves
			// This prevents initial jump from coordinate calculation differences
			pendingSize = null;
			pendingPosition = null;

			// Calculate where the handle SHOULD be (the ideal corner/edge position)
			// This will be used for the first resize calculation to avoid jump
			const rotation = element.rotation || 0;
			if (rotation !== 0) {
				const corners = getRotatedCorners({
					x: pos.x,
					y: pos.y,
					width: size.width,
					height: size.height,
					rotation
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
			pendingPosition = { ...pos };
		}

		// Select the element (already selected by CanvasElement, but ensure it)
		selectElement(element.id);

		// Add global listeners
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
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

		if (interactionMode === 'dragging') {
			// Update pending position for bounding box
			pendingPosition = {
				x: elementStartCanvas.x + deltaCanvas.x,
				y: elementStartCanvas.y + deltaCanvas.y
			};

			// Update pending transforms for all group elements
			if (isGroupInteraction) {
				const deltaX = deltaCanvas.x;
				const deltaY = deltaCanvas.y;

				groupPendingTransforms = new Map(
					groupStartElements.map(el => {
						// Find the original element to preserve its rotation
						const originalElement = selectedElements.find(e => e.id === el.id);
						const rotation = originalElement?.rotation || 0;

						return [
							el.id,
							{
								position: { x: el.x + deltaX, y: el.y + deltaY },
								size: { width: el.width, height: el.height },
								rotation
							}
						];
					})
				);
			}
		} else if (interactionMode === 'resizing' && resizeHandle) {
			// Check if scale tool is active OR shift key is held - if so, maintain aspect ratio
			const tool = get(currentTool);
			const maintainAspectRatio = tool === 'scale' || e.shiftKey;
			const resizeFromCenter = e.altKey; // Option/Alt key resizes from center

			// Get current rotation from active element or pending rotation
			const activeElement = selectedElements.find(el => el.id === activeElementId);
			const rotation = activeElement?.rotation || 0;

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
				if (deltaScreenDist < RESIZE_START_THRESHOLD) {
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
			pendingPosition = { x: newX, y: newY };

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
			// Calculate center point of selection
			const centerX = elementStartCanvas.x + elementStartCanvas.width / 2;
			const centerY = elementStartCanvas.y + elementStartCanvas.height / 2;

			// Convert current mouse position to canvas space
			const mouseCanvasX = (e.clientX - viewport.x) / viewport.scale;
			const mouseCanvasY = (e.clientY - viewport.y) / viewport.scale;

			// Calculate current angle
			const currentAngle = Math.atan2(mouseCanvasY - centerY, mouseCanvasX - centerX) * (180 / Math.PI);

			// Calculate rotation delta
			let angleDelta = currentAngle - rotationStartAngle;

			// Apply Shift key snap to 15° increments
			if (e.shiftKey) {
				angleDelta = Math.round(angleDelta / 15) * 15;
			}

			// Calculate new rotation
			pendingRotation = elementStartRotation + angleDelta;

			// Normalize to -180 to 180 range
			while (pendingRotation > 180) pendingRotation -= 360;
			while (pendingRotation < -180) pendingRotation += 360;

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
						let newRotation = originalRotation + rotationDeltaDegrees;

						// Normalize to -180 to 180 range
						while (newRotation > 180) newRotation -= 360;
						while (newRotation < -180) newRotation += 360;

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

	async function handleMouseUp() {
		if (interactionMode === 'idle') return;
		if (!isGroupInteraction && !activeElementId) return;

		// Check if actually moved beyond threshold
		const movedX = pendingPosition ? Math.abs(pendingPosition.x - elementStartCanvas.x) : 0;
		const movedY = pendingPosition ? Math.abs(pendingPosition.y - elementStartCanvas.y) : 0;
		const sizeChangedW = pendingSize ? Math.abs(pendingSize.width - elementStartCanvas.width) : 0;
		const sizeChangedH = pendingSize ? Math.abs(pendingSize.height - elementStartCanvas.height) : 0;

		if (isGroupInteraction) {
			// Handle group interaction
			if (interactionMode === 'dragging' && pendingPosition) {
				if (movedX > MOVEMENT_THRESHOLD || movedY > MOVEMENT_THRESHOLD) {
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
				const sizeChanged = sizeChangedW > MOVEMENT_THRESHOLD || sizeChangedH > MOVEMENT_THRESHOLD;

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
						let newRotation = originalRotation + rotationDeltaDegrees;

						// Normalize to -180 to 180 range
						while (newRotation > 180) newRotation -= 360;
						while (newRotation < -180) newRotation += 360;

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
			if (interactionMode === 'dragging') {
				if (movedX > MOVEMENT_THRESHOLD || movedY > MOVEMENT_THRESHOLD) {
					if (pendingPosition) {
						await moveElement(activeElementId, pendingPosition);
					}
				}
			} else if (interactionMode === 'resizing') {
				const sizeChanged = sizeChangedW > MOVEMENT_THRESHOLD || sizeChangedH > MOVEMENT_THRESHOLD;
				const positionChanged = movedX > MOVEMENT_THRESHOLD || movedY > MOVEMENT_THRESHOLD;

				if (sizeChanged || positionChanged) {
					if (pendingSize) {
						await resizeElement(
							activeElementId,
							pendingSize,
							positionChanged && pendingPosition ? pendingPosition : undefined
						);
					}
				}
			} else if (interactionMode === 'rotating' && pendingRotation !== null) {
				// Apply rotation
				await rotateElement(activeElementId, pendingRotation);
			} else if (interactionMode === 'radius' && pendingRadius !== null) {
				// Apply border radius change
				await updateElementStyles(activeElementId, {
					borderRadius: `${pendingRadius}px`
				});
			}

			// Keep element selected after interaction
			selectElement(activeElementId);
		}

		// Reset state
		interactionMode = 'idle';
		activeElementId = null;
		isGroupInteraction = false;
		resizeHandle = null;
		pendingPosition = null;
		pendingSize = null;
		pendingRotation = null;
		pendingRadius = null;
		radiusCorner = null;
		radiusStartDistance = 0;
		radiusInitialValue = 0;
		groupStartElements = [];
		groupPendingTransforms = new Map();
		hasMovedPastThreshold = false;
		initialHandlePosition = null;
		mouseToHandleOffset = { x: 0, y: 0 };

		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}

	// Cleanup on destroy
	onDestroy(() => {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});
</script>

<!-- Render selection UI -->
{#if selectedElements.length === 1}
	<!-- Single element selection -->
	<SelectionUI
		element={selectedElements[0]}
		{viewport}
		{isPanning}
		pendingPosition={activeElementId === selectedElements[0].id ? pendingPosition : null}
		pendingSize={activeElementId === selectedElements[0].id ? pendingSize : null}
		pendingRadius={activeElementId === selectedElements[0].id ? pendingRadius : null}
		rotation={commonRotation || 0}
		onMouseDown={(e, handle) => handleMouseDown(e, selectedElements[0], handle)}
	/>
{:else if selectedElements.length > 1 && groupBounds}
	<!-- Multi-element selection - single bounding box -->
	<!-- Note: groupBounds already accounts for rotated elements by calculating their corners -->
	<!-- groupBounds is reactive to groupPendingTransforms, so it updates in real-time during interactions -->
	<SelectionUI
		element={{
			id: 'group',
			type: 'div',
			parentId: null,
			frameId: '',
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

<!-- Rotation angle display -->
{#if interactionMode === 'rotating' && pendingRotation !== null}
	<div
		style="
			position: absolute;
			left: {viewport.x + (elementStartCanvas.x + elementStartCanvas.width / 2) * viewport.scale}px;
			top: {viewport.y + (elementStartCanvas.y + elementStartCanvas.height / 2) * viewport.scale - 60}px;
			transform: translateX(-50%);
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
		"
	>
		{Math.round(pendingRotation)}°
	</div>
{/if}
