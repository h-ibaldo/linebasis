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

	import type { Element } from '$lib/types/events';
	import { onMount } from 'svelte';

	export let element: Element;
	export let elements: Record<string, Element>;
	export let selectedIds: string[];
	export let onSelect: (elementId: string) => void;
	export let onToggleVisibility: (elementId: string, currentVisible: boolean) => void;
	export let onToggleLock: (elementId: string, currentLocked: boolean) => void;
	export let onRename: (elementId: string, newName: string) => void;
	export let depth: number = 0;

	let isExpanded = true;
	let isRenaming = false;
	let nameInput: HTMLInputElement;
	let editingName = '';

	$: isSelected = selectedIds.includes(element.id);
	$: hasChildren = element.children && element.children.length > 0;
	// Reverse children to show visual top-to-bottom order (last child = top layer)
	$: children = hasChildren
		? element.children.map((id) => elements[id]).filter(Boolean).reverse()
		: [];
	$: visible = element.visible !== false; // Default to visible if not specified
	$: locked = element.locked === true; // Default to not locked

	// Get element display name
	$: displayName = element.name || getDefaultName(element);

	function getDefaultName(el: Element): string {
		const type = el.type;
		if (el.isView) return el.viewName || 'View';
		if (type === 'div') return 'Div';
		if (type === 'p') return el.content ? el.content.substring(0, 20) + (el.content.length > 20 ? '...' : '') : 'Text';
		if (type === 'img') return 'Image';
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getElementIcon(el: Element): string {
		const type = el.type;
		if (el.isView) return '□';
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
</script>

<div class="layer-item" style="padding-left: {depth * 16}px">
	<div class="layer-row" class:selected={isSelected} class:locked on:click={handleClick} on:dblclick={handleDoubleClick}>
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
			<span class="element-name" class:dimmed={!visible}>
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

	<!-- Children -->
	{#if hasChildren && isExpanded}
		{#each children as child (child.id)}
			<svelte:self
				element={child}
				{elements}
				{selectedIds}
				{onSelect}
				{onToggleVisibility}
				{onToggleLock}
				{onRename}
				depth={depth + 1}
			/>
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
</style>
