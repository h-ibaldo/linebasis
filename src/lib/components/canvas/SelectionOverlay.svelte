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
	import { moveElement, resizeElement, rotateElement, selectElement, selectElements, clearSelection, addToSelection, removeFromSelection } from '$lib/stores/design-store';
	import { interactionState } from '$lib/stores/interaction-store';
	import { currentTool } from '$lib/stores/tool-store';
	import SelectionUI from './SelectionUI.svelte';

	// Props
	export let viewport: { x: number; y: number; scale: number };
	export let selectedElements: Element[];
	export let isPanning: boolean = false;

	// Local interaction state
	let activeElementId: string | null = null;
	let interactionMode: 'idle' | 'dragging' | 'resizing' | 'rotating' = 'idle';
	let resizeHandle: string | null = null;
	let isGroupInteraction = false; // Track if interacting with multiple elements

	// Pending transform during interaction (for live preview)
	let pendingPosition: { x: number; y: number } | null = null;
	let pendingSize: { width: number; height: number } | null = null;
	let pendingRotation: number | null = null;
	let rotationStartAngle: number = 0; // Initial angle at rotation start
	let elementStartRotation: number = 0; // Element's rotation at start
	let groupPendingTransforms: Map<string, { position: { x: number; y: number }; size: { width: number; height: number } }> = new Map();

	// Broadcast state to store for CanvasElement to consume
	$: {
		interactionState.set({
			activeElementId,
			mode: interactionMode,
			pendingPosition,
			pendingSize,
			pendingRotation,
			groupTransforms: groupPendingTransforms
		});
	}

	// Drag start tracking
	let dragStartScreen = { x: 0, y: 0 };
	let elementStartCanvas = { x: 0, y: 0, width: 0, height: 0 };
	let groupStartElements: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

	// Constants
	const MOVEMENT_THRESHOLD = 2; // px

	// Calculate bounding box for multiple elements
	function getGroupBounds(elements: Element[]): { x: number; y: number; width: number; height: number } {
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
	$: groupBounds = selectedElements.length > 1 && groupPendingTransforms ? getGroupBounds(selectedElements) : null;

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

				// Store group bounds
				const bounds = getGroupBounds(selectedElements);
				elementStartCanvas = bounds;

				interactionMode = 'dragging';
				pendingPosition = { x: bounds.x, y: bounds.y };

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

		// Store group bounds
		const bounds = getGroupBounds(selectedElements);
		elementStartCanvas = bounds;

		if (handle === 'rotate') {
			// Rotation mode
			interactionMode = 'rotating';

			// Calculate center point of selection
			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;

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
			pendingSize = { width: bounds.width, height: bounds.height };
			pendingPosition = { x: bounds.x, y: bounds.y };
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
		} else if (handle) {
			// Resize mode
			interactionMode = 'resizing';
			resizeHandle = handle;
			pendingSize = { ...size };
			pendingPosition = { ...pos };
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
					groupStartElements.map(el => [
						el.id,
						{
							position: { x: el.x + deltaX, y: el.y + deltaY },
							size: { width: el.width, height: el.height }
						}
					])
				);
			}
		} else if (interactionMode === 'resizing' && resizeHandle) {
			// Check if scale tool is active OR shift key is held - if so, maintain aspect ratio
			const tool = get(currentTool);
			const maintainAspectRatio = tool === 'scale' || e.shiftKey;
			const resizeFromCenter = e.altKey; // Option/Alt key resizes from center

			// Calculate new size based on handle
			let newWidth = elementStartCanvas.width;
			let newHeight = elementStartCanvas.height;
			let newX = elementStartCanvas.x;
			let newY = elementStartCanvas.y;

			if (maintainAspectRatio) {
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
				const deltaX = newX - elementStartCanvas.x;
				const deltaY = newY - elementStartCanvas.y;

				groupPendingTransforms = new Map(
					groupStartElements.map(el => {
						const relX = el.x - elementStartCanvas.x;
						const relY = el.y - elementStartCanvas.y;
						const newElWidth = el.width * scaleX;
						const newElHeight = el.height * scaleY;
						const newElX = elementStartCanvas.x + deltaX + relX * scaleX;
						const newElY = elementStartCanvas.y + deltaY + relY * scaleY;

						return [
							el.id,
							{
								position: { x: newElX, y: newElY },
								size: { width: newElWidth, height: newElHeight }
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

				groupPendingTransforms = new Map(
					groupStartElements.map(el => {
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

						return [
							el.id,
							{
								position: { x: newElX, y: newElY },
								size: { width: el.width, height: el.height },
								rotation: pendingRotation
							}
						];
					})
				);
			}
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

					// Move all elements by the same delta
					await Promise.all(
						groupStartElements.map(el =>
							moveElement(el.id, { x: el.x + deltaX, y: el.y + deltaY })
						)
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

					// Resize and reposition all elements proportionally
					await Promise.all(
						groupStartElements.map(el => {
							const relX = el.x - elementStartCanvas.x;
							const relY = el.y - elementStartCanvas.y;
							const newWidth = el.width * scaleX;
							const newHeight = el.height * scaleY;
							const newX = elementStartCanvas.x + deltaX + relX * scaleX;
							const newY = elementStartCanvas.y + deltaY + relY * scaleY;

							return resizeElement(el.id, { width: newWidth, height: newHeight }, { x: newX, y: newY });
						})
					);
				}
			} else if (interactionMode === 'rotating' && pendingRotation !== null) {
				// Calculate group center
				const groupCenterX = elementStartCanvas.x + elementStartCanvas.width / 2;
				const groupCenterY = elementStartCanvas.y + elementStartCanvas.height / 2;

				// Calculate rotation delta in radians
				const rotationDelta = (pendingRotation - elementStartRotation) * (Math.PI / 180);

				// Apply rotation to all selected elements around group center
				await Promise.all(
					groupStartElements.map(el => {
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

						// Apply rotation and move
						return Promise.all([
							rotateElement(el.id, pendingRotation!),
							moveElement(el.id, { x: newElX, y: newElY })
						]);
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
		groupStartElements = [];
		groupPendingTransforms = new Map();

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
		rotation={commonRotation || 0}
		onMouseDown={(e, handle) => handleMouseDown(e, selectedElements[0], handle)}
	/>
{:else if selectedElements.length > 1 && groupBounds}
	<!-- Multi-element selection - single bounding box -->
	<SelectionUI
		element={{
			id: 'group',
			type: 'div',
			parentId: null,
			frameId: '',
			position: isGroupInteraction && pendingPosition ? pendingPosition : { x: groupBounds.x, y: groupBounds.y },
			size: isGroupInteraction && pendingSize ? pendingSize : { width: groupBounds.width, height: groupBounds.height },
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
		rotation={commonRotation || 0}
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
