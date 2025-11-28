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

	import { designState, selectElement, selectElements, toggleVisibility, toggleLock, renameElement, shiftElementLayer, reorderElement, toggleView } from '$lib/stores/design-store';
	import FloatingWindow from '$lib/components/ui/FloatingWindow.svelte';
	import LayerTreeItem from './LayerTreeItem.svelte';
	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import type { Element, Group } from '$lib/types/events';
	import type { MenuItem } from '$lib/components/ui/ContextMenu.svelte';

	$: selectedIds = $designState.selectedElementIds;

	// Drag and drop state
	let draggedElementId: string | null = null;
	let draggedParentId: string | null = null;
	let dropTargetIndex: number | null = null;
	let dropTarget: { elementId: string; position: 'before' | 'after' | 'inside' } | null = null;

	// Context menu state
	let contextMenu: { x: number; y: number; elementId: string } | null = null;

	// Count existing views to auto-name
	$: viewCount = Object.values($designState.elements).filter(el => el.isView).length;

	// Get current page
	$: currentPage = $designState.currentPageId
		? $designState.pages[$designState.currentPageId]
		: null;

	// Get root elements from current page's canvasElements array (in DOM order)
	// Array index 0 = bottom layer (renders first), last index = top layer (renders last)
	// Reverse the array for display so top layers appear first in the list (like Figma)
	$: rootElements = currentPage
		? currentPage.canvasElements
			.map(id => $designState.elements[id])
			.filter(Boolean)
			.reverse() // Reverse for display: top layers first
		: [];

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

	// Drag and drop handlers for nested layers
	function handleDragStart(elementId: string, parentId: string | null) {
		draggedElementId = elementId;
		draggedParentId = parentId;
	}

	function handleDragEnd() {
		draggedElementId = null;
		draggedParentId = null;
		dropTarget = null;
		dropTargetIndex = null;
	}

	function handleDragOver(targetElementId: string, position: 'before' | 'after' | 'inside') {
		dropTarget = { elementId: targetElementId, position };
	}

	async function handleDrop(targetElementId: string, position: 'before' | 'after' | 'inside') {
		if (!draggedElementId) return;

		const draggedElement = $designState.elements[draggedElementId];
		const targetElement = $designState.elements[targetElementId];

		if (!draggedElement || !targetElement) return;

		let newParentId: string | null;
		let newIndex: number;

		if (position === 'inside') {
			// Drop inside the target element (make it a child)
			newParentId = targetElementId;
			// Add as first child (top layer)
			newIndex = 0;
		} else {
			// Drop before or after the target (same parent as target)
			newParentId = targetElement.parentId ?? null;

			// Find target's position in its parent's children array
			let siblings: string[];
			if (newParentId) {
				// Has a parent - get parent's children
				const parent = $designState.elements[newParentId];
				if (!parent) return;
				siblings = parent.children || [];
			} else {
				// Root level - MUST have a page for DOM-based layer ordering
				// LAYERS ARE DOM POSITION, NOT Z-INDEX
				if (!currentPage) {
					console.error('❌ CRITICAL: No page found for root elements. Cannot reorder layers without a page.');
					console.error('   LAYERS ARE DOM POSITION. Root elements MUST belong to a page\'s canvas to have a DOM order.');
					handleDragEnd();
					return;
				}

				// Use page's canvasElements array (DOM order)
				siblings = currentPage.canvasElements;
			}

			const targetIndex = siblings.indexOf(targetElementId);
			if (targetIndex === -1) return;

			// Calculate new index
			// Array: [A(0), B(1), C(2)] where 0=bottom layer, 2=top layer
			// Visual display (reversed): C, B, A (top layer C shows first)
			//
			// When hovering over B in the UI:
			//   - Mouse in TOP half: position='before', wants ABOVE B visually
			//     → Between C and B in UI → Array: [A, B, ★, C] → Index = targetIndex + 1
			//   - Mouse in BOTTOM half: position='after', wants BELOW B visually
			//     → Between B and A in UI → Array: [A, ★, B, C] → Index = targetIndex
			//
			// ★ represents where the dragged element will be inserted
			if (position === 'before') {
				newIndex = targetIndex + 1;
			} else {
				newIndex = targetIndex;
			}

			// Adjust index if moving within same parent
			if (newParentId === draggedParentId) {
				const currentIndex = siblings.indexOf(draggedElementId);
				if (currentIndex !== -1 && currentIndex < newIndex) {
					// Element will be removed first, so adjust index
					newIndex--;
				}
			}
		}

		// Perform the reorder
		await reorderElement(draggedElementId, newParentId, newIndex);

		// Clear drag state
		handleDragEnd();
	}

	// Old drag handlers for root-level elements (kept for backwards compatibility)
	function handleDragStartOld(event: DragEvent, elementId: string) {
		if (!event.dataTransfer) return;

		draggedElementId = elementId;
		const element = $designState.elements[elementId];
		draggedParentId = element?.parentId ?? null;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', elementId);

		// Add visual feedback
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '0.5';
		}
	}

	function handleDragEndOld(event: DragEvent) {
		handleDragEnd();

		// Reset visual feedback
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '1';
		}
	}

	function handleDragOverOld(event: DragEvent, targetIndex: number) {
		event.preventDefault();
		if (!event.dataTransfer) return;

		event.dataTransfer.dropEffect = 'move';
		dropTargetIndex = targetIndex;
	}

	function handleDragLeaveOld() {
		dropTargetIndex = null;
	}

	async function handleDropOld(event: DragEvent, targetIndex: number) {
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
			handleDragEnd();
			return;
		}

		// Use the shift layer function multiple times to move the element
		const direction = positionDiff > 0 ? 'backward' : 'forward';
		const steps = Math.abs(positionDiff);

		for (let i = 0; i < steps; i++) {
			shiftElementLayer(draggedElementId, direction);
		}

		handleDragEnd();
	}

	// Context menu handlers
	function handleContextMenuOpen(e: CustomEvent<{ elementId: string; x: number; y: number }>) {
		const { elementId, x, y } = e.detail;
		contextMenu = { elementId, x, y };
	}

	function handleContextMenuClose() {
		contextMenu = null;
	}

	async function handleContextMenuSelect(e: CustomEvent<string>) {
		const action = e.detail;
		if (!contextMenu) return;

		const element = $designState.elements[contextMenu.elementId];
		if (!element) return;

		switch (action) {
			case 'convert-to-view':
				if (element.type === 'div') {
					// Auto-name and use current width
					const viewName = `View ${viewCount + 1}`;
					const breakpointWidth = element.size.width;
					await toggleView(contextMenu.elementId, true, viewName, breakpointWidth);
				}
				break;
			case 'convert-to-div':
				if (element.type === 'div' && element.isView) {
					// Convert back to regular div
					await toggleView(contextMenu.elementId, false);
				}
				break;
			// Future actions: duplicate, delete, copy, paste, etc.
		}

		contextMenu = null;
	}

	// Build context menu items based on selected element
	$: contextMenuItems = contextMenu ? buildContextMenuItems($designState.elements[contextMenu.elementId]) : [];

	function buildContextMenuItems(element: Element | undefined): MenuItem[] {
		if (!element) return [];

		const items: MenuItem[] = [];

		// Convert to View / Convert to Regular Div
		if (element.type === 'div' && !element.parentId) {
			if (element.isView) {
				// Already a view - offer to convert back to regular div
				items.push({
					id: 'convert-to-div',
					label: 'Convert to Div',
					shortcut: ''
				});
			} else {
				// Regular div - offer to convert to view
				items.push({
					id: 'convert-to-view',
					label: 'Convert to View',
					shortcut: ''
				});
			}
		}

		// Future menu items:
		// - Duplicate
		// - Copy/Paste
		// - Delete
		// - Group/Ungroup
		// - Lock/Unlock
		// - Hide/Show

		return items;
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
				{#each layerItems as item (item.id)}
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
										onDragStart={handleDragStart}
										onDragEnd={handleDragEnd}
										onDragOver={handleDragOver}
										onDrop={handleDrop}
										{draggedElementId}
										{dropTarget}
										depth={1}
										on:contextmenu={handleContextMenuOpen}
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
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
							{draggedElementId}
							{dropTarget}
							on:contextmenu={handleContextMenuOpen}
						/>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</FloatingWindow>

<!-- Context Menu -->
{#if contextMenu}
	<ContextMenu
		x={contextMenu.x}
		y={contextMenu.y}
		items={contextMenuItems}
		on:select={handleContextMenuSelect}
		on:close={handleContextMenuClose}
	/>
{/if}

<style>
	.layers-panel {
		min-width: 200px;
		max-width: 300px;
		width: 100%;
		max-height: 400px;
		overflow-y: auto;
	}

	.no-elements {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

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
		/* LayerTreeItem handles its own depth padding */
		padding: 0;
	}
</style>
