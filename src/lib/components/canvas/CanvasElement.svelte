<script lang="ts">
	/**
	 * CanvasElement - Pure presentational component
	 *
	 * Responsibilities:
	 * - Render element with correct styles
	 * - Recursively render children
	 * - NO selection or interaction logic (handled by SelectionOverlay)
	 */

	import { designState, selectElement, selectedElements, addToSelection, removeFromSelection } from '$lib/stores/design-store';
	import { interactionState } from '$lib/stores/interaction-store';
	import { currentTool } from '$lib/stores/tool-store';
	import { get } from 'svelte/store';
	import type { Element } from '$lib/types/events';

	export let element: Element;
	export let onStartDrag: ((e: MouseEvent, element: Element, handle?: string, selectedElements?: Element[]) => void) | undefined = undefined;
	export let isPanning: boolean = false;
	export let isDragging: boolean = false;

	// Determine cursor based on tool, panning state, and dragging state
	$: elementCursor =
		isDragging && ($currentTool === 'hand' || isPanning) ? 'grabbing' :
		$currentTool === 'hand' || isPanning ? 'grab' :
		$currentTool === 'scale' ? 'crosshair' :
		'default';

	// Handle mousedown - select element and potentially start drag
	function handleMouseDown(e: MouseEvent) {
		const tool = get(currentTool);

		// Don't stop propagation if hand tool or space panning is active - let canvas handle it
		if (tool === 'hand' || isPanning) {
			return;
		}

		e.stopPropagation();

		// Handle selection based on Shift key
		if (e.shiftKey) {
			// Shift+click: toggle element in selection
			const currentSelection = get(selectedElements).map(el => el.id);
			if (currentSelection.includes(element.id)) {
				removeFromSelection(element.id);
			} else {
				addToSelection(element.id);
			}
			// Don't start drag when Shift is held - just modify selection
			return;
		}

		// Check if this element is part of a multi-selection
		const currentSelection = get(selectedElements).map(el => el.id);
		const isPartOfMultiSelection = currentSelection.length > 1 && currentSelection.includes(element.id);

		// If clicking on an element that's part of a multi-selection, keep the selection
		// and start dragging all selected elements. Otherwise, select only this element.
		if (!isPartOfMultiSelection) {
			selectElement(element.id);
		}

		// If scale tool, start scaling from any click (not just handles)
		// If onStartDrag is provided (from SelectionOverlay), call it
		if (onStartDrag) {
			// For scale tool, pass 'se' handle to trigger resize mode with aspect ratio lock
			const handle = tool === 'scale' ? 'se' : undefined;

			// Pass current selection state to avoid timing issues when clicking outside selection
			const currentSelectedElements = get(selectedElements);
			const newSelectedElements = !isPartOfMultiSelection ? [element] : currentSelectedElements;
			onStartDrag(e, element, handle, newSelectedElements);
		}
	}

	// Get display position/size (pending during interaction, or actual)
	$: displayPosition =
		$interactionState.groupTransforms.has(element.id)
			? $interactionState.groupTransforms.get(element.id)!.position
			: $interactionState.activeElementId === element.id && $interactionState.pendingPosition
			? $interactionState.pendingPosition
			: element.position;

	$: displaySize =
		$interactionState.groupTransforms.has(element.id)
			? $interactionState.groupTransforms.get(element.id)!.size
			: $interactionState.activeElementId === element.id && $interactionState.pendingSize
			? $interactionState.pendingSize
			: element.size;

	$: displayRotation =
		$interactionState.groupTransforms.has(element.id) && $interactionState.groupTransforms.get(element.id)!.rotation !== undefined
			? $interactionState.groupTransforms.get(element.id)!.rotation
			: $interactionState.activeElementId === element.id && $interactionState.pendingRotation !== null
			? $interactionState.pendingRotation
			: element.rotation || 0;

	$: displayRadius =
		$interactionState.activeElementId === element.id && $interactionState.pendingRadius !== null
			? `${$interactionState.pendingRadius}px`
			: element.styles.borderRadius;

	// Get individual corner radii (for independent corner editing during drag)
	$: displayCornerRadii = $interactionState.activeElementId === element.id && $interactionState.pendingCornerRadii
		? $interactionState.pendingCornerRadii
		: null;

	// Generate inline styles from element properties
	$: elementStyles = (() => {
		const styles: string[] = [];

		// Position and size - use pending values during interaction
		styles.push(`position: absolute`);
		styles.push(`left: ${displayPosition.x}px`);
		styles.push(`top: ${displayPosition.y}px`);
		styles.push(`width: ${displaySize.width}px`);
		styles.push(`height: ${displaySize.height}px`);
		styles.push(`cursor: ${elementCursor}`);

		// Z-index for stacking order
		if (element.zIndex !== undefined) {
			styles.push(`z-index: ${element.zIndex}`);
		}

		// Rotation
		if (displayRotation) {
			styles.push(`transform: rotate(${displayRotation}deg)`);
			styles.push(`transform-origin: center center`);
		}

		// Element styles
		if (element.styles.backgroundColor) styles.push(`background-color: ${element.styles.backgroundColor}`);
		if (element.styles.color) styles.push(`color: ${element.styles.color}`);
		if (element.styles.borderWidth) styles.push(`border-width: ${element.styles.borderWidth}`);
		if (element.styles.borderStyle) styles.push(`border-style: ${element.styles.borderStyle}`);
		if (element.styles.borderColor) styles.push(`border-color: ${element.styles.borderColor}`);

		// Border radius - check pending individual corners first (during independent editing)
		if (displayCornerRadii) {
			// Use pending individual corner radii (independent mode during drag)
			styles.push(`border-top-left-radius: ${displayCornerRadii.nw}px`);
			styles.push(`border-top-right-radius: ${displayCornerRadii.ne}px`);
			styles.push(`border-bottom-right-radius: ${displayCornerRadii.se}px`);
			styles.push(`border-bottom-left-radius: ${displayCornerRadii.sw}px`);
		} else if (element.styles.borderTopLeftRadius || element.styles.borderTopRightRadius ||
		    element.styles.borderBottomRightRadius || element.styles.borderBottomLeftRadius) {
			// Use stored individual corner radii
			if (element.styles.borderTopLeftRadius) styles.push(`border-top-left-radius: ${element.styles.borderTopLeftRadius}`);
			if (element.styles.borderTopRightRadius) styles.push(`border-top-right-radius: ${element.styles.borderTopRightRadius}`);
			if (element.styles.borderBottomRightRadius) styles.push(`border-bottom-right-radius: ${element.styles.borderBottomRightRadius}`);
			if (element.styles.borderBottomLeftRadius) styles.push(`border-bottom-left-radius: ${element.styles.borderBottomLeftRadius}`);
		} else if (displayRadius) {
			// Use uniform radius
			styles.push(`border-radius: ${displayRadius}`);
		}
		if (element.styles.opacity !== undefined) styles.push(`opacity: ${element.styles.opacity}`);
		if (element.styles.boxShadow) styles.push(`box-shadow: ${element.styles.boxShadow}`);
		if (element.styles.overflow) styles.push(`overflow: ${element.styles.overflow}`);

		// Typography
		if (element.typography.fontFamily) styles.push(`font-family: ${element.typography.fontFamily}`);
		if (element.typography.fontSize) styles.push(`font-size: ${element.typography.fontSize}`);
		if (element.typography.fontWeight) styles.push(`font-weight: ${element.typography.fontWeight}`);
		if (element.typography.lineHeight) styles.push(`line-height: ${element.typography.lineHeight}`);
		if (element.typography.letterSpacing) styles.push(`letter-spacing: ${element.typography.letterSpacing}`);
		if (element.typography.textAlign) styles.push(`text-align: ${element.typography.textAlign}`);
		if (element.typography.textDecoration) styles.push(`text-decoration: ${element.typography.textDecoration}`);
		if (element.typography.textTransform) styles.push(`text-transform: ${element.typography.textTransform}`);

		// Spacing
		if (element.spacing.marginTop) styles.push(`margin-top: ${element.spacing.marginTop}`);
		if (element.spacing.marginRight) styles.push(`margin-right: ${element.spacing.marginRight}`);
		if (element.spacing.marginBottom) styles.push(`margin-bottom: ${element.spacing.marginBottom}`);
		if (element.spacing.marginLeft) styles.push(`margin-left: ${element.spacing.marginLeft}`);
		if (element.spacing.paddingTop) styles.push(`padding-top: ${element.spacing.paddingTop}`);
		if (element.spacing.paddingRight) styles.push(`padding-right: ${element.spacing.paddingRight}`);
		if (element.spacing.paddingBottom) styles.push(`padding-bottom: ${element.spacing.paddingBottom}`);
		if (element.spacing.paddingLeft) styles.push(`padding-left: ${element.spacing.paddingLeft}`);

		return styles.join('; ');
	})();

	// Generate image-specific styles (objectFit applies to img, not parent div)
	$: imageStyles = (() => {
		const styles = ['width: 100%', 'height: 100%'];
		if (element.styles?.objectFit) {
			styles.push(`object-fit: ${element.styles.objectFit}`);
		} else {
			styles.push('object-fit: cover'); // Default
		}
		return styles.join('; ');
	})();
</script>

<!-- Canvas element - absolutely positioned, clickable for selection -->
<div class="canvas-element" data-element-id={element.id} style={elementStyles} on:mousedown={handleMouseDown} role="button" tabindex="0">
	<!-- Render element content based on type -->
	{#if element.type === 'img'}
		<img src={element.src || ''} alt={element.alt || ''} style={imageStyles} />
	{:else if element.type === 'a'}
		<a href={element.href || '#'}>{element.content || 'Link'}</a>
	{:else if element.type === 'button'}
		<button type="button">{element.content || 'Button'}</button>
	{:else if element.type === 'input'}
		<input type="text" placeholder={element.content || 'Input'} />
	{:else if element.type === 'textarea'}
		<textarea placeholder={element.content || 'Textarea'}></textarea>
	{:else}
		<!-- Text content for other elements -->
		{element.content || ''}
	{/if}

	<!-- Render children recursively -->
	{#each element.children as childId}
		{#if $designState.elements[childId]}
			<svelte:self element={$designState.elements[childId]} {isPanning} {isDragging} {onStartDrag} />
		{/if}
	{/each}
</div>

<style>
	.canvas-element {
		position: absolute;
		user-select: none;
		box-sizing: border-box;
		pointer-events: auto; /* Allow clicks for selection */
	}
</style>
