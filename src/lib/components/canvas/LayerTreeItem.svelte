<script lang="ts">
	/**
	 * LayerTreeItem - Individual layer item in the layers tree
	 *
	 * Displays:
	 * - Element icon based on type
	 * - Element name (or default name based on type)
	 * - Visibility toggle (eye icon)
	 * - Lock toggle (lock icon)
	 * - Children (recursively rendered)
	 * - Collapse/expand for parents with children
	 * - Rename on double-click
	 */

	import type { Element, Group } from '$lib/types/events';
	import { designState } from '$lib/stores/design-store';
	import { onMount, createEventDispatcher } from 'svelte';

	export let element: Element;
	export let elements: Record<string, Element>;
	export let selectedIds: string[];
	export let onSelect: (elementId: string) => void;
	export let onToggleVisibility: (elementId: string, currentVisible: boolean) => void;
	export let onToggleLock: (elementId: string, currentLocked: boolean) => void;
	export let onRename: (elementId: string, newName: string) => void;
	export let onDragStart: (elementId: string, parentId: string | null) => void;
	export let onDragEnd: () => void;
	export let onDragOver: (targetElementId: string, position: 'before' | 'after' | 'inside') => void;
	export let onDrop: (targetElementId: string, position: 'before' | 'after' | 'inside') => void;
	export let draggedElementId: string | null = null;
	export let dropTarget: { elementId: string; position: 'before' | 'after' | 'inside' } | null = null;
	export let depth: number = 0;
	export let onSelectGroup: ((groupId: string) => void) | undefined = undefined;

	const dispatch = createEventDispatcher<{ contextmenu: { elementId: string; x: number; y: number } }>();

	let isExpanded = true;
	let isRenaming = false;
	let nameInput: HTMLInputElement;
	let editingName = '';
	
	// Group expand/collapse state for nested groups (default to all groups expanded)
	// Track which groups are collapsed - if a group is not in this set, it's expanded
	let collapsedNestedGroups = new Set<string>();
	let collapsedNestedGroupsSize = 0; // Track size for reactivity
	
	function toggleNestedGroupExpanded(groupId: string, e: MouseEvent) {
		e.stopPropagation();
		// Create a completely new Set to ensure Svelte detects the change
		const newSet = new Set(collapsedNestedGroups);
		if (newSet.has(groupId)) {
			newSet.delete(groupId);
		} else {
			newSet.add(groupId);
		}
		collapsedNestedGroups = newSet;
		collapsedNestedGroupsSize = newSet.size; // Update size to trigger reactivity
	}

	$: isSelected = selectedIds.includes(element.id);
	$: hasChildren = element.children && element.children.length > 0;
	// Reverse children to show visual top-to-bottom order (last child = top layer)
	$: children = hasChildren
		? element.children.map((id) => elements[id]).filter(Boolean).reverse()
		: [];
	$: visible = element.visible !== false; // Default to visible if not specified
	$: locked = element.locked === true; // Default to not locked

	// Build layer items from children to handle groups at nested levels
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

		return items;
	}

	// Build layer items from children to handle groups
	$: childLayerItems = hasChildren ? buildLayerItems(children, $designState.groups) : [];

	// Get element display name
	$: displayName = element.name || getDefaultName(element);

	function getDefaultName(el: Element): string {
		// Views show their view name and breakpoint
		if (el.isView) {
			const viewName = el.viewName || 'View';
			const width = el.breakpointWidth ? ` (${el.breakpointWidth}px)` : '';
			return `${viewName}${width}`;
		}

		const type = el.type;
		if (type === 'div') return 'Div';
		if (type === 'p') return el.content ? el.content.substring(0, 20) + (el.content.length > 20 ? '...' : '') : 'Text';
		if (type === 'img') return 'Image';
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getElementIcon(el: Element): string {
		// Views get special icon
		if (el.isView) return '□'; // Box icon for views/breakpoints

		const type = el.type;
		if (type === 'div') return '▭';
		if (type === 'p') return 'T';
		if (type === 'img') return '⬚';
		return '○';
	}

	function handleClick() {
		if (!locked) {
			onSelect(element.id);
		}
	}

	function handleToggleExpand(e: Event) {
		e.stopPropagation();
		isExpanded = !isExpanded;
	}

	function handleVisibilityClick(e: Event) {
		e.stopPropagation();
		onToggleVisibility(element.id, visible);
	}

	function handleLockClick(e: Event) {
		e.stopPropagation();
		onToggleLock(element.id, locked);
	}

	function handleDoubleClick(e: Event) {
		if (!locked) {
			e.stopPropagation();
			isRenaming = true;
			editingName = displayName;
		}
	}

	function handleRenameSubmit() {
		if (editingName.trim() && editingName !== displayName) {
			onRename(element.id, editingName.trim());
		}
		isRenaming = false;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleRenameSubmit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			isRenaming = false;
		}
	}

	onMount(() => {
		if (isRenaming && nameInput) {
			nameInput.focus();
			nameInput.select();
		}
	});

	$: if (isRenaming && nameInput) {
		nameInput.focus();
		nameInput.select();
	}

	// Drag and drop state
	$: isDragging = draggedElementId === element.id;
	$: isDropTarget = dropTarget?.elementId === element.id;
	$: dropPosition = isDropTarget && dropTarget ? dropTarget.position : null;

	// Drag handlers
	function handleDragStartLocal(e: DragEvent) {
		if (locked || isRenaming) {
			e.preventDefault();
			return;
		}
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', element.id);
		}
		onDragStart(element.id, element.parentId ?? null);
	}

	function handleDragEndLocal(e: DragEvent) {
		e.stopPropagation();
		onDragEnd();
	}

	function handleDragOverLocal(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (!draggedElementId || draggedElementId === element.id) return;

		// Prevent dropping parent into its own child
		if (isAncestor(draggedElementId, element.id)) return;

		const draggedElement = elements[draggedElementId];
		if (!draggedElement) return;

		// Determine drop position based on mouse Y position
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const y = e.clientY - rect.top;
		const height = rect.height;

		let position: 'before' | 'after' | 'inside';

		// Check if dragged element and target element are siblings (same parent)
		const areSiblings = draggedElement.parentId === element.parentId;

		// Only allow "inside" drop if:
		// 1. Element has children and is expanded
		// 2. Mouse is in the middle zone (30-70%)
		// 3. Elements are NOT siblings (different parents or dragging root into nested)
		if (hasChildren && isExpanded && y > height * 0.3 && y < height * 0.7 && !areSiblings) {
			position = 'inside';
		} else if (y < height / 2) {
			position = 'before';
		} else {
			position = 'after';
		}

		onDragOver(element.id, position);
	}

	function handleDropLocal(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (!draggedElementId || draggedElementId === element.id) return;
		if (isAncestor(draggedElementId, element.id)) return;

		if (dropPosition) {
			onDrop(element.id, dropPosition);
		}
	}

	function handleDragLeaveLocal(e: DragEvent) {
		e.stopPropagation();
		// Only clear if leaving this element (not entering a child)
		const relatedTarget = e.relatedTarget as HTMLElement;
		if (!relatedTarget || !(e.currentTarget as HTMLElement).contains(relatedTarget)) {
			// onDragOver will be called again if entering another element
		}
	}

	// Check if an element is an ancestor of another
	function isAncestor(ancestorId: string, descendantId: string): boolean {
		let current = elements[descendantId];
		while (current) {
			if (current.parentId === ancestorId) return true;
			if (!current.parentId) return false;
			current = elements[current.parentId];
		}
		return false;
	}

	// Context menu handler
	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		dispatch('contextmenu', {
			elementId: element.id,
			x: e.clientX,
			y: e.clientY
		});
	}
</script>

<div class="layer-item" style="padding-left: {depth * 16}px" data-layer-id={element.id}>
	<!-- Drop indicator before -->
	{#if dropPosition === 'before'}
		<div class="drop-indicator drop-before"></div>
	{/if}

	<div
		class="layer-row"
		class:selected={isSelected}
		class:locked
		class:dragging={isDragging}
		class:drop-target={isDropTarget && dropPosition === 'inside'}
		draggable={!locked && !isRenaming}
		on:click={handleClick}
		on:dblclick={handleDoubleClick}
		on:contextmenu={handleContextMenu}
		on:dragstart={handleDragStartLocal}
		on:dragend={handleDragEndLocal}
		on:dragover={handleDragOverLocal}
		on:drop={handleDropLocal}
		on:dragleave={handleDragLeaveLocal}
	>
		<!-- Expand/collapse arrow -->
		{#if hasChildren}
			<button class="expand-btn" on:click={handleToggleExpand} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
				<span class="arrow" class:expanded={isExpanded}>▸</span>
			</button>
		{:else}
			<div class="expand-spacer"></div>
		{/if}

		<!-- Element icon -->
		<span class="element-icon" title={element.type}>
			{getElementIcon(element)}
		</span>

		<!-- Element name -->
		{#if isRenaming}
			<input
				bind:this={nameInput}
				bind:value={editingName}
				class="name-input"
				on:blur={handleRenameSubmit}
				on:keydown={handleRenameKeydown}
			/>
		{:else}
			<span
				class="element-name"
				class:dimmed={!visible}
			>
				{displayName}
			</span>
		{/if}

		<!-- Controls -->
		<div class="controls">
			<!-- Visibility toggle -->
			<button
				class="control-btn"
				class:active={visible}
				on:click={handleVisibilityClick}
				aria-label={visible ? 'Hide' : 'Show'}
				title={visible ? 'Hide' : 'Show'}
			>
				{visible ? '👁' : '👁‍🗨'}
			</button>

			<!-- Lock toggle -->
			<button
				class="control-btn"
				class:active={locked}
				on:click={handleLockClick}
				aria-label={locked ? 'Unlock' : 'Lock'}
				title={locked ? 'Unlock' : 'Lock'}
			>
				{locked ? '🔒' : '🔓'}
			</button>
		</div>
	</div>

	<!-- Drop indicator after -->
	{#if dropPosition === 'after'}
		<div class="drop-indicator drop-after"></div>
	{/if}

	<!-- Children -->
	{#if hasChildren && isExpanded}
		{#each childLayerItems as item (item.id)}
			{#if item.type === 'group' && item.groupElements}
				<!-- Group item -->
				<div class="group-item" style="padding-left: {(depth + 1) * 16}px">
					<div
						class="group-header"
						class:selected={item.groupElements.some(el => selectedIds.includes(el.id))}
						on:click={() => onSelectGroup?.(item.id)}
					>
						<button 
							class="expand-btn" 
							on:click={(e) => toggleNestedGroupExpanded(item.id, e)}
							aria-label={!collapsedNestedGroups.has(item.id) ? 'Collapse' : 'Expand'}
						>
							<span class="arrow" class:expanded={!collapsedNestedGroups.has(item.id)}>▸</span>
						</button>
						<span class="group-icon">⊞</span>
						<span class="group-name">Group</span>
					</div>
					<!-- Group members (collapsible) -->
					{#if !collapsedNestedGroups.has(item.id)}
					<div class="group-children">
						{#each item.groupElements as groupElement (groupElement.id)}
							<svelte:self
								element={groupElement}
								{elements}
								{selectedIds}
								{onSelect}
								{onToggleVisibility}
								{onToggleLock}
								{onRename}
								{onDragStart}
								{onDragEnd}
								{onDragOver}
								{onDrop}
								{draggedElementId}
								{dropTarget}
								depth={depth + 2}
								{onSelectGroup}
								on:contextmenu
							/>
						{/each}
					</div>
					{/if}
				</div>
			{:else if item.element}
				<!-- Regular element -->
				<svelte:self
					element={item.element}
					{elements}
					{selectedIds}
					{onSelect}
					{onToggleVisibility}
					{onToggleLock}
					{onRename}
					{onDragStart}
					{onDragEnd}
					{onDragOver}
					{onDrop}
					{draggedElementId}
					{dropTarget}
					depth={depth + 1}
					{onSelectGroup}
					on:contextmenu
				/>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.layer-item {
		width: 100%;
	}

	.layer-row {
		display: flex;
		align-items: center;
		padding: 4px 8px;
		cursor: pointer;
		user-select: none;
		border-radius: 4px;
		transition: background-color 0.1s;
	}

	.layer-row:hover {
		background-color: #f5f5f5;
	}

	.layer-row.selected {
		background-color: #007aff;
		color: white;
	}

	.layer-row.selected:hover {
		background-color: #0051d5;
	}

	.layer-row.locked {
		opacity: 0.6;
		cursor: not-allowed;
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

	.expand-spacer {
		width: 16px;
		height: 16px;
	}

	.arrow {
		display: inline-block;
		transition: transform 0.1s;
		font-size: 10px;
	}

	.arrow.expanded {
		transform: rotate(90deg);
	}

	.element-icon {
		margin: 0 6px;
		font-size: 14px;
		width: 16px;
		text-align: center;
		flex-shrink: 0;
	}

	.element-name {
		flex: 1;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.element-name.dimmed {
		opacity: 0.5;
	}

	.name-input {
		flex: 1;
		font-size: 13px;
		border: 1px solid #007aff;
		border-radius: 3px;
		padding: 2px 4px;
		outline: none;
		background: white;
		color: #333;
	}

	.controls {
		display: flex;
		gap: 2px;
		margin-left: 8px;
	}

	.control-btn {
		background: none;
		border: none;
		padding: 2px 4px;
		cursor: pointer;
		font-size: 14px;
		opacity: 0.5;
		transition: opacity 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.control-btn:hover {
		opacity: 1;
	}

	.control-btn.active {
		opacity: 1;
	}

	.layer-row.selected .control-btn {
		color: white;
		opacity: 0.7;
	}

	.layer-row.selected .control-btn:hover {
		opacity: 1;
	}

	/* Drag and drop styles */
	.layer-row.dragging {
		opacity: 0.4;
	}

	.layer-row.drop-target {
		background-color: #007aff33;
		border: 2px solid #007aff;
	}

	.drop-indicator {
		height: 2px;
		background-color: #007aff;
		margin: 0 8px;
		position: relative;
	}

	.drop-indicator::before {
		content: '';
		position: absolute;
		left: -4px;
		top: -3px;
		width: 8px;
		height: 8px;
		background-color: #007aff;
		border-radius: 50%;
	}

	.drop-before {
		margin-top: -2px;
	}

	.drop-after {
		margin-bottom: -2px;
	}

	/* Group styles (for nested groups) */
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
	}

	.group-children {
		width: 100%;
	}
</style>
