<script lang="ts">
	/**
	 * SelectionUI - Renders selection border and handles for ONE element
	 *
	 * This component is reactive to viewport and pending transforms
	 */

	import { currentTool } from '$lib/stores/tool-store';
	import type { Element } from '$lib/types/events';

	export let element: Element;
	export let viewport: { x: number; y: number; scale: number };
	export let pendingPosition: { x: number; y: number } | null;
	export let pendingSize: { width: number; height: number } | null;
	export let rotation: number = 0; // Rotation angle in degrees for the selection UI
	export let isPanning: boolean = false;
	export let onMouseDown: (e: MouseEvent, handle?: string) => void;

	// Determine cursor based on tool and panning state
	$: dragCursor = $currentTool === 'hand' || isPanning ? 'grab' : $currentTool === 'scale' ? 'crosshair' : 'default';

	const HANDLE_SIZE = 8;
	const BORDER_WIDTH = 2;

	// Reactive: Get display position/size
	$: pos = pendingPosition || element.position;
	$: size = pendingSize || element.size;

	// Reactive: Convert to screen coordinates
	$: screenTopLeft = {
		x: viewport.x + pos.x * viewport.scale,
		y: viewport.y + pos.y * viewport.scale
	};

	$: screenBottomRight = {
		x: viewport.x + (pos.x + size.width) * viewport.scale,
		y: viewport.y + (pos.y + size.height) * viewport.scale
	};

	$: screenWidth = screenBottomRight.x - screenTopLeft.x;
	$: screenHeight = screenBottomRight.y - screenTopLeft.y;
	$: handleOffset = HANDLE_SIZE / 2;

	// Calculate center point for rotation
	$: centerX = screenWidth / 2;
	$: centerY = screenHeight / 2;
</script>

<!-- Container for all selection UI elements that will be rotated together -->
<div
	class="selection-container"
	style="
		position: absolute;
		left: {screenTopLeft.x}px;
		top: {screenTopLeft.y}px;
		width: {screenWidth}px;
		height: {screenHeight}px;
		{rotation ? `transform: rotate(${rotation}deg); transform-origin: ${centerX}px ${centerY}px;` : ''}
		pointer-events: none;
	"
>
	<!-- Selection border -->
	<div
		class="selection-border"
		style="
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			border: {BORDER_WIDTH}px solid #3b82f6;
			pointer-events: none;
			box-sizing: border-box;
		"
	/>

	<!-- Draggable area (invisible, covers element) -->
	<!-- NOTE: pointer-events: none allows clicks to pass through to elements with higher z-index -->
	<div
		class="drag-area"
		style="
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			cursor: {dragCursor};
			pointer-events: none;
		"
		role="button"
		tabindex="0"
		aria-label="Drag {element.type}"
	/>

	<!-- Resize handles - N -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: calc(50% - {handleOffset}px);
			top: -{handleOffset}px;
			cursor: ns-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'n')}
		role="button"
		tabindex="0"
		aria-label="Resize north"
	/>

	<!-- NE -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: calc(100% - {handleOffset}px);
			top: -{handleOffset}px;
			cursor: nesw-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'ne')}
		role="button"
		tabindex="0"
		aria-label="Resize northeast"
	/>

	<!-- E -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: calc(100% - {handleOffset}px);
			top: calc(50% - {handleOffset}px);
			cursor: ew-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'e')}
		role="button"
		tabindex="0"
		aria-label="Resize east"
	/>

	<!-- SE -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: calc(100% - {handleOffset}px);
			top: calc(100% - {handleOffset}px);
			cursor: nwse-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'se')}
		role="button"
		tabindex="0"
		aria-label="Resize southeast"
	/>

	<!-- S -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: calc(50% - {handleOffset}px);
			top: calc(100% - {handleOffset}px);
			cursor: ns-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 's')}
		role="button"
		tabindex="0"
		aria-label="Resize south"
	/>

	<!-- SW -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: -{handleOffset}px;
			top: calc(100% - {handleOffset}px);
			cursor: nesw-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'sw')}
		role="button"
		tabindex="0"
		aria-label="Resize southwest"
	/>

	<!-- W -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: -{handleOffset}px;
			top: calc(50% - {handleOffset}px);
			cursor: ew-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'w')}
		role="button"
		tabindex="0"
		aria-label="Resize west"
	/>

	<!-- NW -->
	<div
		class="resize-handle"
		style="
			position: absolute;
			left: -{handleOffset}px;
			top: -{handleOffset}px;
			cursor: nwse-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'nw')}
		role="button"
		tabindex="0"
		aria-label="Resize northwest"
	/>

	<!-- Rotation handle line -->
	<div
		class="rotation-line"
		style="
			position: absolute;
			left: 50%;
			top: -30px;
			width: 1px;
			height: 30px;
			background: #3b82f6;
			pointer-events: none;
		"
	/>

	<!-- Rotation handle -->
	<div
		class="rotation-handle"
		style="
			position: absolute;
			left: calc(50% - 6px);
			top: -36px;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			background: white;
			border: 2px solid #3b82f6;
			cursor: grab;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'rotate')}
		role="button"
		tabindex="0"
		aria-label="Rotate element"
	/>
</div>

<style>
	.selection-border {
		pointer-events: none;
	}

	.drag-area {
		pointer-events: auto;
	}

	.resize-handle {
		position: absolute;
		width: 8px;
		height: 8px;
		background: white;
		border: 1px solid #3b82f6;
		pointer-events: auto;
		box-sizing: border-box;
	}

	.resize-handle:hover {
		background: #3b82f6;
	}
</style>
