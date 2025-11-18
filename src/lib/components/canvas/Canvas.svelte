<script lang="ts">
	/**
	 * Canvas - The main page builder canvas
	 *
	 * Features:
	 * - Infinite scrollable canvas
	 * - Zoom in/out with mouse wheel
	 * - Pan with space + drag
	 * - Multi-page support (Figma-style)
	 * - Baseline grid overlay
	 * - Element rendering and interaction
	 */

	import { onMount, onDestroy } from 'svelte';
	import type { Element } from '$lib/types/events';
	import {
		designState,
		currentPage,
		initialize,
		createElement,
		updateElement,
		selectElement,
		clearSelection,
		selectedElements
	} from '$lib/stores/design-store';
	import { currentTool } from '$lib/stores/tool-store';
	import { interactionState, startEditingText } from '$lib/stores/interaction-store';
	import { viewport as viewportStore } from '$lib/stores/viewport-store';
	import { CANVAS_INTERACTION } from '$lib/constants/canvas';
	import CanvasElement from './CanvasElement.svelte';
	import BaselineGrid from './BaselineGrid.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';
	import SelectionBox from './SelectionBox.svelte';

	let canvasElement: HTMLDivElement;
	let viewport = { x: 0, y: 0, scale: 1 };

	// Sync local viewport state with the store
	$: viewportStore.set(viewport);
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	let isPanning = false;
	// Reference to SelectionOverlay component
	let selectionOverlay: {
		startDrag: (e: MouseEvent, el: Element, handle?: string, selectedElements?: Element[]) => void;
	} | undefined = undefined;

	// Handler for starting drag operations
	const handleStartDrag = (e: MouseEvent, el: Element, handle?: string, selectedElems?: Element[]) => {
		selectionOverlay?.startDrag(e, el, handle, selectedElems);
	};

	// Update canvas cursor based on tool and state
	$: if (canvasElement) {
		canvasElement.style.cursor =
			isDragging && ($currentTool === 'hand' || isPanning) ? 'grabbing' :
			$currentTool === 'hand' || isPanning ? 'grab' :
			$currentTool === 'text' ? 'text' :
			$currentTool === 'div' || $currentTool === 'media' ? 'crosshair' :
			'default';
	}

	// Drawing state (for creating new elements)
	let isDrawing = false;
	let drawStart = { x: 0, y: 0 };
	let drawPreview: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null = null;

	// Zoom settings
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 4;
	const ZOOM_STEP = 0.1;

	onMount(async () => {
		await initialize();
		setupEventListeners();
	});

	function setupEventListeners() {
		if (typeof window === 'undefined') return;

		// Mouse wheel for zoom
		canvasElement.addEventListener('wheel', handleWheel, { passive: false });

		// Space key for panning
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
	}

	onDestroy(() => {
		if (typeof window === 'undefined') return;

		canvasElement?.removeEventListener('wheel', handleWheel);
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
	});

	function handleWheel(e: WheelEvent) {
		// Zoom with Cmd/Ctrl + wheel
		if (e.metaKey || e.ctrlKey) {
			e.preventDefault();

			const delta = -e.deltaY * 0.001;
			const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.scale + delta));

			// Zoom towards mouse position
			const rect = canvasElement.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const oldScale = viewport.scale;
			const scaleRatio = newScale / oldScale;

			viewport = {
				x: mouseX - (mouseX - viewport.x) * scaleRatio,
				y: mouseY - (mouseY - viewport.y) * scaleRatio,
				scale: newScale
			};
		}
		// Pan with shift + wheel (horizontal) or plain wheel (vertical)
		else {
			e.preventDefault();
			viewport = {
				...viewport,
				x: viewport.x - (e.shiftKey ? e.deltaY : e.deltaX),
				y: viewport.y - (e.shiftKey ? 0 : e.deltaY)
			};
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		// ESC key: switch to move tool when text tool is active
		if (e.key === 'Escape' && $currentTool === 'text') {
			e.preventDefault();
			currentTool.set('move');
			return;
		}

		// Space key for panning
		if (e.code === 'Space' && !isPanning) {
			e.preventDefault();
			e.stopPropagation();

			// Blur any focused select elements to prevent dropdown toggle
			if (document.activeElement && document.activeElement.tagName === 'SELECT') {
				(document.activeElement as HTMLElement).blur();
			}

			isPanning = true;
			return;
		}

		// Zoom shortcuts: Cmd/Ctrl + Plus/Minus/0
		if (e.metaKey || e.ctrlKey) {
			if (e.code === 'Equal' || e.code === 'NumpadAdd') {
				// Cmd/Ctrl + (or Cmd/Ctrl =)
				e.preventDefault();
				zoomIn();
			} else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
				// Cmd/Ctrl -
				e.preventDefault();
				zoomOut();
			} else if (e.code === 'Digit0' || e.code === 'Numpad0') {
				// Cmd/Ctrl 0
				e.preventDefault();
				resetZoom();
			}
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.code === 'Space') {
			isPanning = false;
			if (isDragging) {
				isDragging = false;
			}
		}
	}

	function handleMouseDown(e: MouseEvent) {
		const tool = $currentTool;

		// Hand tool or Space key = panning (works even over elements)
		if (tool === 'hand' || isPanning) {
			isDragging = true;
			dragStart = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
			e.preventDefault();
			return;
		}

		// Only handle clicks on the canvas background for other tools
		if (e.target !== e.currentTarget) return;

		// If we're in text editing mode, blur the active element first to save content
		// Then clear selection on the next event loop to allow blur to complete
		if ($interactionState.mode === 'editing-text') {
			const editingElementId = $interactionState.editingElementId;
			if (editingElementId) {
				const el = document.querySelector(`[data-element-id="${editingElementId}"]`);
				if (el instanceof HTMLElement) {
					el.blur();
					// Clear selection after a small delay to allow blur event to process
					setTimeout(() => {
						clearSelection();
					}, 0);
					return;
				}
			}
		}

		// Move tool: Let SelectionBox handle all selection logic (drag selection, click selection, etc.)
		if (tool === 'move') {
			return;
		}

		// Scale tool: Clear selection when clicking empty canvas
		if (tool === 'scale') {
			clearSelection();
			return;
		}

		// Drawing tools: div, text, media
		if (tool === 'div' || tool === 'text' || tool === 'media') {
			isDrawing = true;

			// Convert screen coordinates to canvas coordinates (accounting for viewport)
			const rect = canvasElement.getBoundingClientRect();
			const canvasX = (e.clientX - rect.left - viewport.x) / viewport.scale;
			const canvasY = (e.clientY - rect.top - viewport.y) / viewport.scale;

			drawStart = { x: canvasX, y: canvasY };
			drawPreview = { x: canvasX, y: canvasY, width: 0, height: 0 };
			e.preventDefault();
		}
	}

	function handleMouseMove(e: MouseEvent) {
		// Panning
		if (isDragging && !isDrawing) {
			viewport = {
				...viewport,
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			};
			return;
		}

		// Drawing preview
		if (isDrawing && drawPreview) {
			const rect = canvasElement.getBoundingClientRect();
			const canvasX = (e.clientX - rect.left - viewport.x) / viewport.scale;
			const canvasY = (e.clientY - rect.top - viewport.y) / viewport.scale;

			// Calculate position and size supporting all 4 quadrants
			const x = Math.min(drawStart.x, canvasX);
			const y = Math.min(drawStart.y, canvasY);
			const width = Math.abs(canvasX - drawStart.x);
			const height = Math.abs(canvasY - drawStart.y);

			drawPreview = { x, y, width, height };
		}
	}

	async function handleMouseUp() {
		// Finish panning
		if (isDragging && !isDrawing) {
			isDragging = false;
			return;
		}

		// Finish drawing and create element
		if (isDrawing && drawPreview) {
			const tool = $currentTool;
			let newElementId: string;

			// Get current page ID
			const pageId = $designState.currentPageId;
			if (!pageId) {
				console.error('No current page ID');
				return;
			}

			// Placeholder SVG for media elements
			const placeholderSVG = 'data:image/svg+xml,' + encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
				'<rect width="200" height="200" fill="#f5f5f5"/>' +
				'<text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14" fill="#999">Select Image</text>' +
				'</svg>'
			);

			// If dragged less than minimum size, create default-sized element
			if (drawPreview.width < CANVAS_INTERACTION.MIN_ELEMENT_SIZE || drawPreview.height < CANVAS_INTERACTION.MIN_ELEMENT_SIZE) {
				// Click: create default size centered at click position

				if (tool === 'text') {
					// Text tool with click (no drag): Create text with AUTO width
					// Start editing immediately so user can type
					newElementId = await createElement({
						pageId,
						parentId: null,
						elementType: 'p',
						position: {
							x: drawStart.x,
							y: drawStart.y
						},
						size: { width: 200, height: 40 }, // Initial size, will auto-expand
						content: 'Text',
						styles: {
							color: '#000000',
							display: 'inline-block' // Allow width to shrink-wrap content
						}
					});

					// Automatically start editing the text element
					setTimeout(() => {
						startEditingText(newElementId);
						// Focus after a brief delay to ensure element is rendered
						setTimeout(() => {
							const editor = document.querySelector(
								`[data-editor-for="${newElementId}"]`
							);
							if (editor instanceof HTMLElement) {
								editor.focus();
								// Select all text for easy replacement
								const selection = window.getSelection();
								const range = document.createRange();
								range.selectNodeContents(editor);
								selection?.removeAllRanges();
								selection?.addRange(range);
							}
						}, 50);
					}, 0);
				} else {
					// Div and media tools: use fixed default sizes
					const defaultSizes = {
						div: { width: 200, height: 200 },
						media: { width: 200, height: 200 }
					};

					const size = defaultSizes[tool as 'div' | 'media'] || { width: 200, height: 200 };

					// Center element at click position
					newElementId = await createElement({
						pageId,
						parentId: null,
						elementType: tool === 'media' ? 'img' : 'div',
						position: {
							x: drawStart.x - size.width / 2,
							y: drawStart.y - size.height / 2
						},
						size,
						content: '',
						styles: {
							backgroundColor: tool === 'div' ? '#f5f5f5' : undefined
						}
					});

					// Add placeholder image for media elements
					if (tool === 'media') {
						await updateElement(newElementId, {
							src: placeholderSVG,
							alt: 'Click to select image'
						});
					}
				}
			} else {
				// Drag: create element with drawn size
				newElementId = await createElement({
					pageId,
					parentId: null,
					elementType: tool === 'text' ? 'p' : tool === 'media' ? 'img' : 'div',
					position: { x: drawPreview.x, y: drawPreview.y },
					size: { width: drawPreview.width, height: drawPreview.height },
					content: tool === 'text' ? 'Text' : '',
					styles: {
						backgroundColor: tool === 'div' ? '#f5f5f5' : undefined,
						color: '#000000'
					}
				});

				if (tool === 'text') {
					// Automatically start editing the text element on mouse up
					setTimeout(() => {
						startEditingText(newElementId);
						setTimeout(() => {
							const el = document.querySelector(`[data-editor-for=\"${newElementId}\"]`);
							if (el instanceof HTMLElement) {
								el.focus();
								const selection = window.getSelection();
								const range = document.createRange();
								range.selectNodeContents(el);
								selection?.removeAllRanges();
								selection?.addRange(range);
							}
						}, 50);
					}, 0);
				}

				// Add placeholder image for media elements
				if (tool === 'media') {
					await updateElement(newElementId, {
						src: placeholderSVG,
						alt: 'Click to select image'
					});
				}
			}

			// Automatically select the newly created element
			selectElement(newElementId);

			// Reset drawing state (keep tool selected)
			isDrawing = false;
			drawPreview = null;

			// Don't switch back to move tool - keep current tool selected
		}
	}

	// Zoom controls
	function zoomIn() {
		const newScale = Math.min(MAX_ZOOM, viewport.scale + ZOOM_STEP);
		
		// Calculate center of viewport
		const rect = canvasElement.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;
		
		// Calculate scale ratio
		const scaleRatio = newScale / viewport.scale;
		
		// Adjust position to keep center point fixed
		viewport = {
			x: centerX - (centerX - viewport.x) * scaleRatio,
			y: centerY - (centerY - viewport.y) * scaleRatio,
			scale: newScale
		};
	}

	function zoomOut() {
		const newScale = Math.max(MIN_ZOOM, viewport.scale - ZOOM_STEP);
		
		// Calculate center of viewport
		const rect = canvasElement.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;
		
		// Calculate scale ratio
		const scaleRatio = newScale / viewport.scale;
		
		// Adjust position to keep center point fixed
		viewport = {
			x: centerX - (centerX - viewport.x) * scaleRatio,
			y: centerY - (centerY - viewport.y) * scaleRatio,
			scale: newScale
		};
	}

	function resetZoom() {
		// Calculate the current center point in canvas coordinates
		const screenCenterX = canvasElement.clientWidth / 2;
		const screenCenterY = canvasElement.clientHeight / 2;

		// Convert screen center to canvas coordinates before zoom reset
		const canvasCenterX = (screenCenterX - viewport.x) / viewport.scale;
		const canvasCenterY = (screenCenterY - viewport.y) / viewport.scale;

		// Reset scale to 1 and adjust pan to keep the same point centered
		viewport = {
			x: screenCenterX - canvasCenterX,
			y: screenCenterY - canvasCenterY,
			scale: 1
		};
	}
</script>

<!-- STYLE: Canvas container - full viewport, overflow hidden -->
<div class="canvas-container">
	<!-- STYLE: Zoom controls - floating toolbar, top-right corner -->
	<div class="zoom-controls">
		<button on:click={zoomOut}>-</button>
		<span>{Math.round(viewport.scale * 100)}%</span>
		<button on:click={zoomIn}>+</button>
		<button on:click={resetZoom}>Reset</button>
	</div>

	<!-- STYLE: Canvas - infinite scrollable area, dark background -->
	<div
		class="canvas"
		class:cursor-text={$currentTool === 'text'}
		class:cursor-crosshair={$currentTool === 'div' || $currentTool === 'media'}
		class:cursor-grab={$currentTool === 'hand' || isPanning}
		bind:this={canvasElement}
		on:mousedown={handleMouseDown}
		on:mousemove={handleMouseMove}
		on:mouseup={handleMouseUp}
		on:mouseleave={handleMouseUp}
		role="application"
		aria-label="Page builder canvas"
	>
		<!-- STYLE: Canvas viewport - transformed container with zoom/pan -->
		<div
			class="canvas-viewport"
			style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.scale});"
		>
			<!-- Render all root elements in view.elements array order (first = bottom layer, last = top layer) -->
			<!-- Fallback: if no view, show all root elements (parentId === null) for backwards compatibility -->
			{#each ($designState.currentViewId && $designState.views[$designState.currentViewId]
				? $designState.views[$designState.currentViewId].elements.map(id => $designState.elements[id]).filter(Boolean)
				: Object.values($designState.elements).filter(el => el.parentId === null)
			) as element (element.id)}
				<CanvasElement
					{element}
					{isPanning}
					{isDragging}
					onStartDrag={selectionOverlay ? handleStartDrag : undefined}
				/>
			{/each}

			<!-- Drawing preview - actual element being drawn -->
			{#if drawPreview && drawPreview.width > 0 && drawPreview.height > 0}
				<div
					class="element-preview"
					style="
						position: absolute;
						left: {drawPreview.x}px;
						top: {drawPreview.y}px;
						width: {drawPreview.width}px;
						height: {drawPreview.height}px;
						background-color: {$currentTool === 'div' ? '#f5f5f5' : $currentTool === 'text' ? 'transparent' : '#e5e7eb'};
						color: #000000;
						border: 2px solid #3b82f6;
						opacity: 0.8;
					"
				>
					{#if $currentTool === 'text'}
						<span style="padding: 8px; display: block;">Text</span>
					{/if}
				</div>
			{/if}

			<!-- Render views as visual artboards (breakpoints) -->
			{#each Object.values($designState.views) as view (view.id)}
				<div
					class="view-artboard"
					style="
						position: absolute;
						left: {view.position.x}px;
						top: {view.position.y}px;
						width: {view.breakpointWidth}px;
						height: {view.height}px;
					"
				>
					<!-- Baseline grid per view -->
					<BaselineGrid />

					<div class="view-artboard-label">
						{view.name} ({view.breakpointWidth}px)
					</div>
				</div>
			{/each}
		</div>

		<!-- Selection Overlay - handles selection UI and interactions -->
		<SelectionOverlay bind:this={selectionOverlay} {viewport} {isPanning} selectedElements={$selectedElements} />
		
		<!-- Selection Box - multi-select by dragging -->
		{#if canvasElement}
			<SelectionBox {canvasElement} {viewport} {isPanning} />
		{/if}
	</div>
</div>

<style>
	/* STYLE: Add your design here! */
	/* This is unstyled semantic HTML with functional logic */

	.canvas-container {
		position: relative;
		width: 100%;
		height: 100vh;
		padding-top: 60px; /* Space for top toolbar */
		overflow: hidden;
		background: #1a1a1a; /* Dark canvas background */
		box-sizing: border-box;
	}

	.zoom-controls {
		position: absolute;
		bottom: 20px;
		right: 20px;
		z-index: 100;
		display: flex;
		gap: 8px;
		padding: 8px;
		background: white;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.zoom-controls button {
		padding: 4px 12px;
		border: 1px solid #ddd;
		background: white;
		cursor: pointer;
	}

	.zoom-controls button:hover {
		background: #f5f5f5;
	}

	.zoom-controls span {
		padding: 4px 8px;
		font-size: 14px;
		color: #333;
	}

	.canvas {
		width: 100%;
		height: 100%;
		position: relative;
		cursor: default;
	}

	.canvas.cursor-text {
		cursor: text;
	}

	.canvas.cursor-crosshair {
		cursor: crosshair;
	}

	.canvas.cursor-grab {
		cursor: grab;
	}

	.canvas-viewport {
		transform-origin: 0 0;
		will-change: transform;
	}

	.view-artboard {
		position: absolute;
		border: 2px solid rgba(100, 100, 255, 0.3);
		background: rgba(255, 255, 255, 0.02);
		pointer-events: none;
	}

	.view-artboard-label {
		position: absolute;
		top: -30px;
		left: 0;
		color: rgba(100, 100, 255, 0.8);
		font-size: 14px;
		font-weight: 500;
		pointer-events: none;
	}

	/* Element preview while drawing */
	.element-preview {
		pointer-events: none;
		z-index: 1000;
		box-sizing: border-box;
	}
</style>
