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
	 * - Drag to reorder (array position changes, not z-index)
	 */

	import { designState, selectElement, selectElements, toggleVisibility, toggleLock, renameElement, shiftElementLayer } from '$lib/stores/design-store';
	import FloatingWindow from '$lib/components/ui/FloatingWindow.svelte';
	import LayerTreeItem from './LayerTreeItem.svelte';
	import type { Element, Group } from '$lib/types/events';

	$: selectedIds = $designState.selectedElementIds;

	// Drag and drop state
	let draggedElementId: string | null = null;
	let dropTargetIndex: number | null = null;

	// Get root elements from current view's elements array (in DOM order)
	// Array index 0 = bottom layer (renders first), last index = top layer (renders last)
	// Reverse the array for display so top layers appear first in the list (like Figma)
	// Fallback: if no view, show all root elements (parentId === null) sorted by zIndex
	$: rootElements = $designState.currentViewId && $designState.views[$designState.currentViewId]
		? $designState.views[$designState.currentViewId].elements
			.map(id => $designState.elements[id])
			.filter(Boolean)
			.reverse() // Reverse for display: top layers first
		: Object.values($designState.elements)
			.filter(el => !el.parentId)
			.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)); // Fallback: sort by zIndex descending (top layers first)

	// Build layer items that can be groups or individual elements
	// Groups should appear as single items containing their members
	$: layerItems = buildLayerItems(rootElements, $designState.groups);

	$: hasElements = rootElements.length > 0;

	interface LayerItem {
		type: 'element' | 'group';
		id: string;
		element?: Element;
		group?: Group;
		groupElements?: Element[];
	}

	function buildLayerItems(elements: Element[], groups: Record<string, Group>): LayerItem[] {
		const items: LayerItem[] = [];
		const processedElementIds = new Set<string>();

		for (const element of elements) {
			// Skip if already processed as part of a group
			if (processedElementIds.has(element.id)) continue;

			// Check if element belongs to a group
			if (element.groupId && groups[element.groupId]) {
				// Skip if we already added this group
				if (processedElementIds.has(element.groupId)) continue;

				const group = groups[element.groupId];
				const groupElements = group.elementIds
					.map(id => $designState.elements[id])
					.filter(Boolean);
				// Note: groupElements order comes from group.elementIds array order
				// No z-index sorting needed - array order IS the DOM order

				// Mark all group elements as processed
				group.elementIds.forEach(id => processedElementIds.add(id));
				processedElementIds.add(element.groupId);

				items.push({
					type: 'group',
					id: element.groupId,
					group,
					groupElements
				});
			} else {
				// Regular element (not in a group)
				processedElementIds.add(element.id);
				items.push({
					type: 'element',
					id: element.id,
					element
				});
			}
		}

		// No sorting needed - elements are already in correct order from view.elements (reversed)
		return items;
	}

	function handleSelectGroup(groupId: string) {
		const group = $designState.groups[groupId];
		if (group) {
			selectElements(group.elementIds);
		}
	}

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

	// Drag and drop handlers
	function handleDragStart(event: DragEvent, elementId: string) {
		if (!event.dataTransfer) return;

		draggedElementId = elementId;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', elementId);

		// Add visual feedback
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '0.5';
		}
	}

	function handleDragEnd(event: DragEvent) {
		draggedElementId = null;
		dropTargetIndex = null;

		// Reset visual feedback
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '1';
		}
	}

	function handleDragOver(event: DragEvent, targetIndex: number) {
		event.preventDefault();
		if (!event.dataTransfer) return;

		event.dataTransfer.dropEffect = 'move';
		dropTargetIndex = targetIndex;
	}

	function handleDragLeave() {
		dropTargetIndex = null;
	}

	function handleDrop(event: DragEvent, targetIndex: number) {
		event.preventDefault();

		if (!draggedElementId) return;

		const draggedElement = $designState.elements[draggedElementId];
		if (!draggedElement) return;

		// Find current index of dragged element in rootElements
		const currentIndex = rootElements.findIndex(el => el.id === draggedElementId);
		if (currentIndex === -1) return;

		// Calculate how many positions to move
		// Remember: rootElements is reversed (top layers first in UI)
		// But zIndex/layer order is normal (higher = on top)
		const positionDiff = targetIndex - currentIndex;

		if (positionDiff === 0) {
			// No movement needed
			dropTargetIndex = null;
			draggedElementId = null;
			return;
		}

		// Use the shift layer function multiple times to move the element
		const direction = positionDiff > 0 ? 'backward' : 'forward';
		const steps = Math.abs(positionDiff);

		for (let i = 0; i < steps; i++) {
			shiftElementLayer(draggedElementId, direction);
		}

		dropTargetIndex = null;
		draggedElementId = null;
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
				{#each layerItems as item, index (item.id)}
					<div
						class="layer-wrapper"
						class:drop-target={dropTargetIndex === index}
						draggable="true"
						on:dragstart={(e) => item.element && handleDragStart(e, item.element.id)}
						on:dragend={handleDragEnd}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
					>
						{#if item.type === 'group' && item.groupElements}
							<!-- Group item -->
							<div class="group-item">
								<div
									class="group-header"
									class:selected={item.groupElements.some(el => selectedIds.includes(el.id))}
									on:click={() => handleSelectGroup(item.id)}
								>
									<button class="expand-btn" on:click|stopPropagation={() => {}} aria-label="Expand">
										<span class="arrow expanded">▸</span>
									</button>
									<span class="group-icon">⊞</span>
									<span class="group-name">Group</span>
								</div>
								<!-- Group members (always expanded for now, collapsible in future) -->
								<div class="group-children">
									{#each item.groupElements as element (element.id)}
										<LayerTreeItem
											{element}
											elements={$designState.elements}
											{selectedIds}
											onSelect={handleSelectElement}
											onToggleVisibility={handleToggleVisibility}
											onToggleLock={handleToggleLock}
											onRename={handleRename}
											depth={1}
										/>
									{/each}
								</div>
							</div>
						{:else if item.element}
							<!-- Regular element -->
							<LayerTreeItem
								element={item.element}
								elements={$designState.elements}
								{selectedIds}
								onSelect={handleSelectElement}
								onToggleVisibility={handleToggleVisibility}
								onToggleLock={handleToggleLock}
								onRename={handleRename}
							/>
						{/if}
					</div>
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

	.layer-wrapper {
		position: relative;
		transition: transform 0.1s ease;
	}

	.layer-wrapper.drop-target {
		border-top: 2px solid #007aff;
		margin-top: 2px;
	}

	.layer-wrapper:active {
		cursor: grabbing;
	}

	.group-item {
		width: 100%;
	}

	.group-header {
		display: flex;
		align-items: center;
		padding: 4px 8px;
		cursor: pointer;
		user-select: none;
		border-radius: 4px;
		transition: background-color 0.1s;
	}

	.group-header:hover {
		background-color: #f5f5f5;
	}

	.group-header.selected {
		background-color: #007aff;
		color: white;
	}

	.group-header.selected:hover {
		background-color: #0051d5;
	}

	.expand-btn {
		background: none;
		border: none;
		padding: 0;
		width: 16px;
		height: 16px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.arrow {
		display: inline-block;
		transition: transform 0.1s;
		font-size: 10px;
	}

	.arrow.expanded {
		transform: rotate(90deg);
	}

	.group-icon {
		margin: 0 6px;
		font-size: 14px;
		width: 16px;
		text-align: center;
		flex-shrink: 0;
	}

	.group-name {
		flex: 1;
		font-size: 13px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-children {
		/* No extra padding needed as LayerTreeItem handles its own depth padding */
	}
</style>
