<script lang="ts">
	/**
	 * SelectionBox - Drag to select multiple elements
	 *
	 * Click and drag on canvas to create a selection box
	 * that selects all elements within the box.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { designState, selectElements, clearSelection } from '$lib/stores/design-store';
	import { currentTool } from '$lib/stores/tool-store';

	export let canvasElement: HTMLElement;
	export let viewport: { x: number; y: number; scale: number };
	export let isPanning: boolean = false;

	let isSelecting = false;
	let selectionStart = { x: 0, y: 0 };
	let selectionEnd = { x: 0, y: 0 };
	let box = { x: 0, y: 0, width: 0, height: 0 };

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
			isSelecting = true;

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

	function handleMouseUp() {
		if (isSelecting) {
			// Find elements within selection box
			const selectedIds: string[] = [];

			Object.values($designState.elements).forEach((element) => {
				const elementRect = {
					x: element.position.x,
					y: element.position.y,
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
					selectedIds.push(element.id);
				}
			});

			if (selectedIds.length > 0) {
				selectElements(selectedIds);
			} else {
				clearSelection();
			}

			isSelecting = false;
			box = { x: 0, y: 0, width: 0, height: 0 };
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
