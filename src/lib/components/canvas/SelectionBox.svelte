<script lang="ts">
	/**
	 * SelectionBox - Drag to select multiple elements
	 *
	 * Click and drag on canvas to create a selection box
	 * that selects all elements within the box.
	 * Hold SHIFT while dragging to add/remove from existing selection:
	 * - Elements not selected → add to selection
	 * - Elements already selected → remove from selection
	 */

	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { designState, selectElements, clearSelection, selectedElements } from '$lib/stores/design-store';
	import { currentTool } from '$lib/stores/tool-store';

	export let canvasElement: HTMLElement;
	export let viewport: { x: number; y: number; scale: number };
	export let isPanning: boolean = false;

	let isSelecting = false;
	let selectionStart = { x: 0, y: 0 };
	let selectionEnd = { x: 0, y: 0 };
	let box = { x: 0, y: 0, width: 0, height: 0 };
	let shiftKeyPressed = false; // Track if SHIFT was pressed when starting drag
	let initialSelection: string[] = []; // Store initial selection when starting drag with SHIFT

	onMount(() => {
		canvasElement.addEventListener('mousedown', handleMouseDown);
	});

	onDestroy(() => {
		canvasElement?.removeEventListener('mousedown', handleMouseDown);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});

	function handleMouseDown(e: MouseEvent) {
		// Don't start selection if spacebar panning is active
		if (isPanning) return;

		// Only work with move tool
		const tool = get(currentTool);
		if (tool !== 'move') return;

		// Only start selection if clicking on canvas background (not an element)
		const target = e.target as HTMLElement;
		const isCanvasBackground = target === canvasElement ||
		                          target.classList.contains('canvas-viewport') ||
		                          target.classList.contains('canvas');

		if (isCanvasBackground) {
			// Clear selection immediately on canvas click (before drag starts)
			// This ensures single click on background clears selection
			if (!e.shiftKey) {
				clearSelection();
			}

			isSelecting = true;
			shiftKeyPressed = e.shiftKey; // Store SHIFT key state at drag start

			// If SHIFT is held and there's an existing selection, store it
			if (shiftKeyPressed) {
				initialSelection = get(selectedElements).map(el => el.id);
			} else {
				initialSelection = [];
			}

			const rect = canvasElement.getBoundingClientRect();
			selectionStart = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top
			};
			selectionEnd = { ...selectionStart };

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);

			e.preventDefault();
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isSelecting) return;

		const rect = canvasElement.getBoundingClientRect();
		selectionEnd = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		};

		// Calculate box dimensions in screen space
		const screenBox = {
			x: Math.min(selectionStart.x, selectionEnd.x),
			y: Math.min(selectionStart.y, selectionEnd.y),
			width: Math.abs(selectionEnd.x - selectionStart.x),
			height: Math.abs(selectionEnd.y - selectionStart.y)
		};

		// Convert to canvas space for element intersection checking
		box = {
			x: (screenBox.x - viewport.x) / viewport.scale,
			y: (screenBox.y - viewport.y) / viewport.scale,
			width: screenBox.width / viewport.scale,
			height: screenBox.height / viewport.scale
		};
	}

	/**
	 * Calculate absolute position of an element in canvas space
	 * For nested elements, walk up the parent chain and accumulate positions
	 */
	function getAbsolutePosition(element: typeof $designState.elements[string]): { x: number; y: number } {
		let absoluteX = element.position.x;
		let absoluteY = element.position.y;

		// Walk up parent chain to accumulate absolute position
		let currentElement = element;
		while (currentElement.parentId) {
			const parent = $designState.elements[currentElement.parentId];
			if (!parent) break;

			// Add parent's position to get absolute coordinates
			absoluteX += parent.position.x;
			absoluteY += parent.position.y;

			currentElement = parent;
		}

		return { x: absoluteX, y: absoluteY };
	}

	function handleMouseUp() {
		if (isSelecting) {
			// Find elements within selection box
			const newlySelectedIds: string[] = [];

			Object.values($designState.elements).forEach((element) => {
				// Calculate absolute position in canvas space
				const absolutePos = getAbsolutePosition(element);

				const elementRect = {
					x: absolutePos.x,
					y: absolutePos.y,
					width: element.size.width,
					height: element.size.height
				};

				// Check if element intersects with selection box
				if (
					box.x < elementRect.x + elementRect.width &&
					box.x + box.width > elementRect.x &&
					box.y < elementRect.y + elementRect.height &&
					box.y + box.height > elementRect.y
				) {
					newlySelectedIds.push(element.id);
				}
			});

			// If SHIFT was held during drag, toggle selection (add/remove)
			if (shiftKeyPressed) {
				// Toggle selection for each newly selected element:
				// - If element was already in initial selection → remove it
				// - If element was not in initial selection → add it
				const initialSet = new Set(initialSelection);
				const toAdd: string[] = [];
				const toRemove: string[] = [];

				newlySelectedIds.forEach(id => {
					if (initialSet.has(id)) {
						// Element was already selected → remove it
						toRemove.push(id);
					} else {
						// Element was not selected → add it
						toAdd.push(id);
					}
				});

				// Start with initial selection
				let finalSelection = [...initialSelection];

				// Remove elements that should be deselected
				finalSelection = finalSelection.filter(id => !toRemove.includes(id));

				// Add elements that should be selected
				finalSelection = [...new Set([...finalSelection, ...toAdd])];

				if (finalSelection.length > 0) {
					selectElements(finalSelection);
				} else {
					clearSelection();
				}
				// If no drag occurred (no newlySelectedIds), initial selection is preserved
			} else {
				// Normal behavior: replace selection
				if (newlySelectedIds.length > 0) {
					selectElements(newlySelectedIds);
				} else {
					clearSelection();
				}
			}

			isSelecting = false;
			box = { x: 0, y: 0, width: 0, height: 0 };
			shiftKeyPressed = false;
			initialSelection = [];
		}

		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}
</script>

<!-- STYLE: Selection box - dashed blue border, semi-transparent fill -->
{#if isSelecting && box.width > 0 && box.height > 0}
	<div
		class="selection-box"
		style="
			position: absolute;
			left: {box.x * viewport.scale + viewport.x}px;
			top: {box.y * viewport.scale + viewport.y}px;
			width: {box.width * viewport.scale}px;
			height: {box.height * viewport.scale}px;
			border: 2px dashed #3b82f6;
			background: rgba(59, 130, 246, 0.1);
			pointer-events: none;
			z-index: 1000;
		"
	></div>
{/if}

<style>
	.selection-box {
		position: absolute;
		border: 2px dashed #3b82f6;
		background: rgba(59, 130, 246, 0.1);
		pointer-events: none;
		z-index: 1000;
	}
</style>
