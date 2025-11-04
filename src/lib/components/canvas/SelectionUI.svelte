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
	export let pendingRadius: number | null = null;
	export let rotation: number = 0; // Rotation angle in degrees for the selection UI
	export let isPanning: boolean = false;
	export let onMouseDown: (e: MouseEvent, handle?: string) => void;

	// Determine cursor based on tool and panning state
	$: dragCursor = $currentTool === 'hand' || isPanning ? 'grab' : $currentTool === 'scale' ? 'crosshair' : 'default';

	const HANDLE_SIZE = 8;
	const BORDER_WIDTH = 2;
	const ROTATION_ZONE_SIZE = 15; // Size of rotation zone extending from each corner handle
	const EDGE_RESIZE_ZONE_WIDTH = 6; // Width of the invisible resize zone along each edge (extends inward and outward)
	const RADIUS_HANDLE_SIZE = 10; // Size of radius handle
	const RADIUS_HANDLE_BASE_DISTANCE = 10; // Base distance from corner resize handle (10px as requested)

	// Reactive: Get display position/size
	$: pos = pendingPosition || element.position;
	$: size = pendingSize || element.size;

	// Reactive: Get display radius (use pendingRadius if available, otherwise element's borderRadius)
	$: displayRadius = pendingRadius !== null ? pendingRadius : (parseFloat(element.styles?.borderRadius as string) || 0);

	// Reactive: Calculate max allowed radius (50% of smaller dimension)
	$: maxAllowedRadius = Math.min(size.width, size.height) / 2;

	// Reactive: Clamp display radius to max allowed (ensures handle stops at 50% mark)
	$: clampedDisplayRadius = Math.min(displayRadius, maxAllowedRadius);

	// Reactive: Calculate radius handle distance based on clamped radius value
	// Position handle center at the border-radius arc along the 45° diagonal
	// For a circle with radius r, the point on the arc at 45° is exactly at distance r from corner
	// During drag (pendingRadius !== null), allow handle to go to 0. Otherwise, show BASE_DISTANCE minimum.
	$: radiusHandleDistance = clampedDisplayRadius > 0 ? clampedDisplayRadius : (pendingRadius !== null ? 0 : RADIUS_HANDLE_BASE_DISTANCE);

	// Reactive: Determine if radius handles should be shown
	// Hide only if element dimensions are too small (below a minimum size threshold)
	// Don't hide based on radius value - let the user drag to maximum even if handles would overlap
	const MIN_DIMENSION_FOR_RADIUS_HANDLES = 40; // Minimum px for width/height to show radius handles
	$: showRadiusHandles = size.width >= MIN_DIMENSION_FOR_RADIUS_HANDLES && size.height >= MIN_DIMENSION_FOR_RADIUS_HANDLES;

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

	<!-- Corner resize handles (visual indicators) -->
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

	<!-- Corner radius handles (one per corner, positioned inside at 45° diagonal) -->
	<!-- Only show if element is large enough relative to radius -->
	{#if showRadiusHandles}
		<!-- NW corner radius handle -->
		<div
			class="radius-handle"
			style="
				position: absolute;
				left: calc({radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				top: calc({radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				width: {RADIUS_HANDLE_SIZE}px;
				height: {RADIUS_HANDLE_SIZE}px;
				border-radius: 50%;
				background: white;
				border: 1px solid #3b82f6;
				cursor: move;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'radius-nw')}
			role="button"
			tabindex="0"
			aria-label="Adjust corner radius"
		/>

		<!-- NE corner radius handle -->
		<div
			class="radius-handle"
			style="
				position: absolute;
				left: calc(100% - {radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				top: calc({radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				width: {RADIUS_HANDLE_SIZE}px;
				height: {RADIUS_HANDLE_SIZE}px;
				border-radius: 50%;
				background: white;
				border: 1px solid #3b82f6;
				cursor: move;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'radius-ne')}
			role="button"
			tabindex="0"
			aria-label="Adjust corner radius"
		/>

		<!-- SE corner radius handle -->
		<div
			class="radius-handle"
			style="
				position: absolute;
				left: calc(100% - {radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				top: calc(100% - {radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				width: {RADIUS_HANDLE_SIZE}px;
				height: {RADIUS_HANDLE_SIZE}px;
				border-radius: 50%;
				background: white;
				border: 1px solid #3b82f6;
				cursor: move;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'radius-se')}
			role="button"
			tabindex="0"
			aria-label="Adjust corner radius"
		/>

		<!-- SW corner radius handle -->
		<div
			class="radius-handle"
			style="
				position: absolute;
				left: calc({radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				top: calc(100% - {radiusHandleDistance}px - {RADIUS_HANDLE_SIZE / 2}px);
				width: {RADIUS_HANDLE_SIZE}px;
				height: {RADIUS_HANDLE_SIZE}px;
				border-radius: 50%;
				background: white;
				border: 1px solid #3b82f6;
				cursor: move;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'radius-sw')}
			role="button"
			tabindex="0"
			aria-label="Adjust corner radius"
		/>
	{/if}

	<!-- Full-width invisible edge resize zones (Figma-style) -->
	<!-- North edge - full width clickable zone -->
	<div
		class="edge-resize-zone"
		style="
			position: absolute;
			left: 0;
			top: -{EDGE_RESIZE_ZONE_WIDTH}px;
			width: 100%;
			height: {EDGE_RESIZE_ZONE_WIDTH * 2}px;
			cursor: ns-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'n')}
		role="button"
		tabindex="0"
		aria-label="Resize north"
	/>

	<!-- East edge - full height clickable zone -->
	<div
		class="edge-resize-zone"
		style="
			position: absolute;
			left: calc(100% - {EDGE_RESIZE_ZONE_WIDTH}px);
			top: 0;
			width: {EDGE_RESIZE_ZONE_WIDTH * 2}px;
			height: 100%;
			cursor: ew-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'e')}
		role="button"
		tabindex="0"
		aria-label="Resize east"
	/>

	<!-- South edge - full width clickable zone -->
	<div
		class="edge-resize-zone"
		style="
			position: absolute;
			left: 0;
			top: calc(100% - {EDGE_RESIZE_ZONE_WIDTH}px);
			width: 100%;
			height: {EDGE_RESIZE_ZONE_WIDTH * 2}px;
			cursor: ns-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 's')}
		role="button"
		tabindex="0"
		aria-label="Resize south"
	/>

	<!-- West edge - full height clickable zone -->
	<div
		class="edge-resize-zone"
		style="
			position: absolute;
			left: -{EDGE_RESIZE_ZONE_WIDTH}px;
			top: 0;
			width: {EDGE_RESIZE_ZONE_WIDTH * 2}px;
			height: 100%;
			cursor: ew-resize;
			pointer-events: auto;
		"
		on:mousedown={(e) => onMouseDown(e, 'w')}
		role="button"
		tabindex="0"
		aria-label="Resize west"
	/>

	<!-- Rotation zones - L-shaped areas around each corner handle for rotation -->
	<!-- Only show rotation zones when not panning -->
	{#if !isPanning}
		<!-- NW (top-left) corner rotation zone - L-shaped -->
		<!-- Horizontal part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: -{ROTATION_ZONE_SIZE}px;
				top: -{ROTATION_ZONE_SIZE}px;
				width: {ROTATION_ZONE_SIZE * 2}px;
				height: {ROTATION_ZONE_SIZE}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>
		<!-- Vertical part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: -{ROTATION_ZONE_SIZE}px;
				top: -{ROTATION_ZONE_SIZE}px;
				width: {ROTATION_ZONE_SIZE}px;
				height: {ROTATION_ZONE_SIZE * 2}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>

		<!-- NE (top-right) corner rotation zone - L-shaped -->
		<!-- Horizontal part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: calc(100% - {ROTATION_ZONE_SIZE}px);
				top: -{ROTATION_ZONE_SIZE}px;
				width: {ROTATION_ZONE_SIZE * 2}px;
				height: {ROTATION_ZONE_SIZE}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>
		<!-- Vertical part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: calc(100%);
				top: -{ROTATION_ZONE_SIZE}px;
				width: {ROTATION_ZONE_SIZE}px;
				height: {ROTATION_ZONE_SIZE * 2}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>

		<!-- SE (bottom-right) corner rotation zone - L-shaped -->
		<!-- Horizontal part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: calc(100% - {ROTATION_ZONE_SIZE}px);
				top: calc(100%);
				width: {ROTATION_ZONE_SIZE * 2}px;
				height: {ROTATION_ZONE_SIZE}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>
		<!-- Vertical part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: calc(100%);
				top: calc(100% - {ROTATION_ZONE_SIZE}px);
				width: {ROTATION_ZONE_SIZE}px;
				height: {ROTATION_ZONE_SIZE * 2}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>

		<!-- SW (bottom-left) corner rotation zone - L-shaped -->
		<!-- Horizontal part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: -{ROTATION_ZONE_SIZE}px;
				top: calc(100%);
				width: {ROTATION_ZONE_SIZE * 2}px;
				height: {ROTATION_ZONE_SIZE}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>
		<!-- Vertical part -->
		<div
			class="rotation-zone"
			style="
				position: absolute;
				left: -{ROTATION_ZONE_SIZE}px;
				top: calc(100% - {ROTATION_ZONE_SIZE}px);
				width: {ROTATION_ZONE_SIZE}px;
				height: {ROTATION_ZONE_SIZE * 2}px;
				cursor: grab;
				pointer-events: auto;
			"
			on:mousedown={(e) => onMouseDown(e, 'rotate')}
			role="button"
			tabindex="0"
			aria-label="Rotate element"
		/>
	{/if}
</div>

<style>
	.selection-border {
		pointer-events: none;
	}

	.drag-area {
		pointer-events: auto;
	}

	.resize-handle {
		/* Corner resize handles - visual indicators only */
		position: absolute;
		width: 8px;
		height: 8px;
		background: white;
		border: 1px solid #3b82f6;
		pointer-events: auto;
		box-sizing: border-box;
		z-index: 4; /* Above edge zones */
	}

	.resize-handle:hover {
		background: #3b82f6;
	}

	.radius-handle {
		/* Corner radius handles - small circles at 45° from corners */
		position: absolute;
		box-sizing: border-box;
		z-index: 6; /* Highest priority */
	}

	.radius-handle:hover {
		background: #3b82f6;
	}

	.edge-resize-zone {
		/* Invisible full-width edge resize zones (Figma-style) */
		background: transparent;
		/* Uncomment for debugging to see the edge zones */
		/* background: rgba(59, 130, 246, 0.05); */
		/* border: 1px dashed rgba(59, 130, 246, 0.2); */
		z-index: 2; /* Above rotation zones, below corner resize handles */
	}

	.rotation-zone {
		/* Invisible rotation zone */
		background: transparent;
		/* Uncomment for debugging to see the rotation zones */
		/* background: rgba(59, 130, 246, 0.1); */
		/* border: 1px dashed rgba(59, 130, 246, 0.3); */
		z-index: 1; /* Below resize zones */
	}

	.rotation-zone:hover {
		cursor: grab;
	}

	.rotation-zone:active {
		cursor: grabbing;
	}
</style>
