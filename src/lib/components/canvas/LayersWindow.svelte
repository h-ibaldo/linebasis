<script lang="ts">
	/**
	 * LayersWindow - Hierarchical layers panel for elements
	 *
	 * Shows:
	 * - Tree view of all elements in current view
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

	$: currentViewId = $designState.currentViewId;
	$: currentView = currentViewId ? $designState.views[currentViewId] : null;
	$: selectedIds = $designState.selectedElementIds;

	// Get root elements in current view (elements with no parent or parent in different view)
	$: rootElements = currentView
		? Object.values($designState.elements)
				.filter((el) => el.viewId === currentView.id && (!el.parentId || !$designState.elements[el.parentId]))
				.sort((a, b) => b.zIndex - a.zIndex) // Sort by z-index descending (top to bottom)
		: [];

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
		{#if !currentView}
			<div class="no-view">
				<p>No view selected</p>
				<p class="hint">Create or select a view to see layers</p>
			</div>
		{:else if rootElements.length === 0}
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
