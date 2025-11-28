<script lang="ts">
	/**
	 * ContextMenu - Right-click context menu component
	 *
	 * Features:
	 * - Opens on right-click at mouse position
	 * - Closes on outside click or Escape key
	 * - Supports nested menu items with separators
	 * - Keyboard navigation
	 */

	import { onMount, createEventDispatcher } from 'svelte';

	export let x: number = 0;
	export let y: number = 0;
	export let items: MenuItem[] = [];

	export interface MenuItem {
		id: string;
		label: string;
		shortcut?: string;
		disabled?: boolean;
		separator?: boolean;
		submenu?: MenuItem[];
	}

	const dispatch = createEventDispatcher<{ select: string; close: void }>();

	let menuElement: HTMLDivElement;

	onMount(() => {
		// Adjust position if menu goes off-screen
		const rect = menuElement.getBoundingClientRect();
		const windowWidth = window.innerWidth;
		const windowHeight = window.innerHeight;

		if (rect.right > windowWidth) {
			x = windowWidth - rect.width - 8;
		}
		if (rect.bottom > windowHeight) {
			y = windowHeight - rect.height - 8;
		}

		// Focus menu for keyboard navigation
		menuElement.focus();

		// Close on outside click
		const handleClickOutside = (e: MouseEvent) => {
			if (menuElement && !menuElement.contains(e.target as Node)) {
				dispatch('close');
			}
		};

		// Close on Escape key
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				dispatch('close');
			}
		};

		window.addEventListener('click', handleClickOutside);
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('click', handleClickOutside);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	function handleItemClick(itemId: string, disabled?: boolean) {
		if (disabled) return;
		dispatch('select', itemId);
		dispatch('close');
	}
</script>

<div class="context-menu" bind:this={menuElement} style="left: {x}px; top: {y}px;" tabindex="-1">
	{#each items as item}
		{#if item.separator}
			<div class="separator"></div>
		{:else}
			<button
				class="menu-item"
				class:disabled={item.disabled}
				on:click={() => handleItemClick(item.id, item.disabled)}
			>
				<span class="label">{item.label}</span>
				{#if item.shortcut}
					<span class="shortcut">{item.shortcut}</span>
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.context-menu {
		position: fixed;
		z-index: 10000;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 180px;
		padding: 4px;
		outline: none;
	}

	.menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: none;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		color: #333;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s;
		user-select: none;
	}

	.menu-item:hover:not(.disabled) {
		background: #f5f5f5;
	}

	.menu-item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.label {
		flex: 1;
	}

	.shortcut {
		font-size: 11px;
		color: #999;
		margin-left: 16px;
	}

	.separator {
		height: 1px;
		background: #e0e0e0;
		margin: 4px 0;
	}
</style>
