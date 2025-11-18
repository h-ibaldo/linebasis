<script lang="ts">
	/**
	 * LayersWindow - Hierarchical layers panel for all canvas elements
	 *
	 * Shows all elements on the canvas (like Figma/Framer):
	 * - Tree view of all root elements (no parent)
	 * - Nested structure (children indented)
	 * - Click to select element
	 * - Eye icon to hide/show element
	 * - Lock icon to lock element (prevent editing)
	 * - Rename via double-click
	 * - Drag to reorder (z-index changes)
	 */

	import { designState, selectElement, toggleVisibility, toggleLock, renameElement } from '$lib/stores/design-store';
	import FloatingWindow from '$lib/components/ui/FloatingWindow.svelte';
	import LayerTreeItem from './LayerTreeItem.svelte';
	import type { Element } from '$lib/types/events';

	$: selectedIds = $designState.selectedElementIds;

	// Get ALL root elements on the canvas (elements with no parent), sorted by z-index
	// This shows the entire canvas like Figma, not just the current view
	$: rootElements = Object.values($designState.elements)
		.filter((el) => !el.parentId)
		.sort((a, b) => b.zIndex - a.zIndex); // Sort by z-index descending (top to bottom)

	$: hasElements = rootElements.length > 0;

	function handleSelectElement(elementId: string) {
		selectElement(elementId);
	}

	function handleToggleVisibility(elementId: string, currentVisible: boolean) {
		toggleVisibility(elementId, !currentVisible);
	}

	function handleToggleLock(elementId: string, currentLocked: boolean) {
		toggleLock(elementId, !currentLocked);
	}

	function handleRename(elementId: string, newName: string) {
		renameElement(elementId, newName);
	}
</script>

<FloatingWindow
	title="Layers"
	defaultX={20}
	defaultY={-400}
	storageKey="layers-window-pos"
	minWidth={200}
	maxWidth={300}
>
	<div class="layers-panel">
		{#if !hasElements}
			<div class="no-elements">
				<p>No elements</p>
				<p class="hint">Add elements to the canvas</p>
			</div>
		{:else}
			<div class="layers-tree">
				{#each rootElements as element (element.id)}
					<LayerTreeItem
						{element}
						elements={$designState.elements}
						{selectedIds}
						onSelect={handleSelectElement}
						onToggleVisibility={handleToggleVisibility}
						onToggleLock={handleToggleLock}
						onRename={handleRename}
					/>
				{/each}
			</div>
		{/if}
	</div>
</FloatingWindow>

<style>
	.layers-panel {
		min-width: 200px;
		max-width: 300px;
		width: 100%;
		max-height: 400px;
		overflow-y: auto;
	}

	.no-view,
	.no-elements {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.no-view p:first-child,
	.no-elements p:first-child {
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 8px;
	}

	.hint {
		font-size: 12px;
		color: #999;
		margin: 0;
	}

	.layers-tree {
		padding: 8px 0;
	}
</style>
