<script lang="ts">
	import type { Element, Group } from '$lib/types/events';
	import LayerTreeItem from './LayerTreeItem.svelte';

	export let groupId: string;
	export let groupElements: Element[] = [];
	export let nestedGroups: Array<{ id: string; groupElements: Element[]; nestedGroups: any[] }> = [];
	export let selectedIds: string[];
	export let collapsedGroups: Record<string, boolean>;
	export let draggedGroupId: string | null;
	export let draggedElementId: string | null;
	export let dropTarget: { elementId: string; position: 'before' | 'after' | 'inside' } | null;
	export let elements: Record<string, Element>;
	export let depth: number = 1;

	export let onSelectGroup: ((groupId: string) => void) | undefined = undefined;
	export let onSelectElement: ((elementId: string) => void) | undefined = undefined;
	export let onToggleVisibility: ((elementId: string) => void) | undefined = undefined;
	export let onToggleLock: ((elementId: string) => void) | undefined = undefined;
	export let onRename: ((elementId: string, newName: string) => void) | undefined = undefined;
	export let onDragStart: ((elementId: string) => void) | undefined = undefined;
	export let onDragEnd: (() => void) | undefined = undefined;
	export let onDragOver: ((e: DragEvent, elementId: string) => void) | undefined = undefined;
	export let onDrop: ((elementId: string, position: 'before' | 'after' | 'inside') => void) | undefined = undefined;
	export let onGroupDrop: ((elementId: string, position: 'before' | 'after') => void) | undefined = undefined;
	export let toggleGroupExpanded: ((groupId: string, e: Event) => void) | undefined = undefined;
	export let handleGroupDragStart: ((groupId: string) => void) | undefined = undefined;

	function handleSelectGroup() {
		onSelectGroup?.(groupId);
	}

	function handleToggleExpanded(e: Event) {
		toggleGroupExpanded?.(groupId, e);
	}

	function handleDragStart() {
		handleGroupDragStart?.(groupId);
	}

	function handleDragEnd() {
		onDragEnd?.();
	}
</script>

<div class="group-item nested-group" class:top-level={depth === 1} style="padding-left: {depth > 1 ? 16 : 0}px">
	<div
		class="group-header"
		class:selected={groupElements.some(el => selectedIds.includes(el.id))}
		class:dragging={draggedGroupId === groupId}
		draggable={true}
		on:click={handleSelectGroup}
		on:dragstart={handleDragStart}
		on:dragend={handleDragEnd}
	>
		<button
			class="expand-btn"
			draggable={false}
			on:click={handleToggleExpanded}
			on:mousedown={(e) => e.stopPropagation()}
			aria-label={!collapsedGroups[groupId] ? 'Collapse' : 'Expand'}
		>
			<span class="arrow" class:expanded={!collapsedGroups[groupId]}>▸</span>
		</button>
		<span class="group-icon">⊞</span>
		<span class="group-name">Group{depth > 1 ? ' (nested)' : ''}</span>
	</div>

	<!-- Group children (collapsible) -->
	{#if !collapsedGroups[groupId]}
		<div class="group-children" style="padding-left: 16px;">
			<!-- Recursively render nested groups -->
			{#if nestedGroups && nestedGroups.length > 0}
				{#each nestedGroups as nestedGroup (nestedGroup.id)}
					<svelte:self
						groupId={nestedGroup.id}
						groupElements={nestedGroup.groupElements || []}
						nestedGroups={nestedGroup.nestedGroups || []}
						{selectedIds}
						{collapsedGroups}
						{draggedGroupId}
						{draggedElementId}
						{dropTarget}
						{elements}
						depth={depth + 1}
						{onSelectGroup}
						{onSelectElement}
						{onToggleVisibility}
						{onToggleLock}
						{onRename}
						{onDragStart}
						{onDragEnd}
						{onDragOver}
						{onDrop}
						{onGroupDrop}
						{toggleGroupExpanded}
						{handleGroupDragStart}
					/>
				{/each}
			{/if}

			<!-- Direct elements of this group -->
			{#each groupElements as element (element.id)}
				<LayerTreeItem
					{element}
					{elements}
					{selectedIds}
					onSelect={onSelectElement}
					onToggleVisibility={onToggleVisibility}
					onToggleLock={onToggleLock}
					onRename={onRename}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					onDragOver={onDragOver}
					onDrop={onDrop}
					onGroupDrop={onGroupDrop}
					{draggedElementId}
					{draggedGroupId}
					{dropTarget}
					depth={depth + 1}
					on:contextmenu
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.group-item {
		width: 100%;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		cursor: pointer;
		user-select: none;
		border-radius: 4px;
		color: #333;
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

	.group-header.dragging {
		opacity: 0.5;
	}

	.expand-btn {
		width: 16px;
		height: 16px;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.arrow {
		display: inline-block;
		transition: transform 0.15s ease;
	}

	.arrow.expanded {
		transform: rotate(90deg);
	}

	.group-icon {
		margin: 0 6px;
		font-size: 14px;
		width: 16px;
		text-align: center;
	}

	.group-name {
		flex: 1;
		font-size: 13px;
		font-weight: 500;
	}

	.group-children {
		display: flex;
		flex-direction: column;
	}
</style>
