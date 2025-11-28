<script lang="ts">
	/**
	 * ViewLabels - Labels shown above view elements
	 *
	 * Shows:
	 * - View name above NW corner (editable on double-click)
	 * - Width above NE corner (updates as view resizes)
	 */

	import type { Element } from '$lib/types/events';
	import { renameElement, updateElement } from '$lib/stores/design-store';
	import { interactionState } from '$lib/stores/interaction-store';

	export let element: Element;
	export let canvasZoom: number = 1;
	export let canvasPanX: number = 0;
	export let canvasPanY: number = 0;

	let isEditingName = false;
	let nameInput: HTMLInputElement;
	let editingName = '';

	$: viewName = element.viewName || 'View';

	// Check if this element is being individually interacted with
	$: isBeingInteracted = $interactionState.activeElementId === element.id &&
		($interactionState.mode === 'resizing' || $interactionState.mode === 'dragging');

	// Check if this element is part of a group being transformed
	$: groupTransform = $interactionState.groupTransforms.get(element.id);

	// Use pending transforms (either individual or group)
	$: currentWidth =
		isBeingInteracted && $interactionState.pendingSize ? $interactionState.pendingSize.width :
		groupTransform ? groupTransform.size.width :
		element.size.width;

	$: currentPosition =
		isBeingInteracted && $interactionState.pendingPosition ? $interactionState.pendingPosition :
		groupTransform ? groupTransform.position :
		element.position;

	$: width = Math.round(currentWidth);

	// Calculate position for labels based on current position and canvas transform
	$: labelX = currentPosition.x * canvasZoom + canvasPanX;
	$: labelY = currentPosition.y * canvasZoom + canvasPanY - 24; // 24px above element

	function handleNameDoubleClick() {
		isEditingName = true;
		editingName = viewName;
		// Focus after DOM update
		setTimeout(() => {
			nameInput?.focus();
			nameInput?.select();
		}, 0);
	}

	function handleNameSubmit() {
		if (editingName.trim() && editingName !== viewName) {
			// Update viewName property directly
			updateElement(element.id, {
				viewName: editingName.trim()
			});
		}
		isEditingName = false;
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleNameSubmit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			isEditingName = false;
		}
	}

	function handleNameBlur() {
		handleNameSubmit();
	}
</script>

<!-- View Name Label (NW corner) -->
<div
	class="view-label view-name"
	style="left: {labelX}px; top: {labelY}px;"
	on:dblclick={handleNameDoubleClick}
>
	{#if isEditingName}
		<input
			bind:this={nameInput}
			bind:value={editingName}
			class="name-input"
			on:keydown={handleNameKeydown}
			on:blur={handleNameBlur}
		/>
	{:else}
		<span class="label-text">{viewName}</span>
	{/if}
</div>

<!-- Width Label (NE corner) -->
<div
	class="view-label view-width"
	style="left: {labelX + currentWidth * canvasZoom}px; top: {labelY}px;"
>
	<span class="label-text">{width}px</span>
</div>

<style>
	.view-label {
		position: absolute;
		pointer-events: auto;
		background: rgba(0, 122, 255, 0.9);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
		z-index: 1000;
		user-select: none;
	}

	.view-name {
		cursor: text;
	}

	.view-name:hover {
		background: rgba(0, 122, 255, 1);
	}

	.view-width {
		transform: translateX(-100%);
		margin-left: -4px;
		background: rgba(0, 0, 0, 0.6);
	}

	.name-input {
		background: white;
		color: #333;
		border: none;
		outline: none;
		padding: 2px 4px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 2px;
		min-width: 60px;
	}

	.label-text {
		display: inline-block;
	}
</style>
