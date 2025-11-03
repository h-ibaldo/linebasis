<script lang="ts">
	/**
	 * FloatingWindow - Illustrator-style floating window
	 *
	 * Features:
	 * - Draggable by header
	 * - Resizable (future)
	 * - Remembers position in localStorage
	 * - Minimize/maximize/close
	 */

	import { onMount } from 'svelte';

	export let title: string;
	export let defaultX = 20;
	export let defaultY = 80;
	export let minWidth = 280;
	export let storageKey: string;
	export let visible = true;

	let x = defaultX;
	let y = defaultY;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let windowStartX = 0;
	let windowStartY = 0;

	onMount(() => {
		// Load position from localStorage
		const savedPosition = localStorage.getItem(storageKey);
		if (savedPosition) {
			const pos = JSON.parse(savedPosition);
			x = pos.x;
			y = pos.y;
		} else {
			// If negative, position from right/bottom
			if (defaultX < 0) {
				x = window.innerWidth + defaultX;
			}
			if (defaultY < 0) {
				y = window.innerHeight + defaultY;
			}
		}
	});

	function handleMouseDown(e: MouseEvent) {
		// Always stop propagation to prevent canvas from handling clicks
		// This prevents deselection when interacting with window controls
		e.stopPropagation();

		if ((e.target as HTMLElement).closest('.window-header')) {
			isDragging = true;
			dragStartX = e.clientX;
			dragStartY = e.clientY;
			windowStartX = x;
			windowStartY = y;

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		}
	}

	function handleClick(e: MouseEvent) {
		// Also stop click propagation for extra safety
		e.stopPropagation();
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		x = windowStartX + deltaX;
		y = windowStartY + deltaY;

		// Keep window on screen
		x = Math.max(0, Math.min(x, window.innerWidth - minWidth));
		y = Math.max(0, Math.min(y, window.innerHeight - 100));
	}

	function handleMouseUp(e?: MouseEvent) {
		// Stop mouseup propagation to prevent canvas from handling it
		e?.stopPropagation();

		if (isDragging) {
			isDragging = false;
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);

			// Save position to localStorage
			localStorage.setItem(storageKey, JSON.stringify({ x, y }));
		}
	}

	function handleClose() {
		visible = false;
	}
</script>

{#if visible}
	<div
		class="floating-window"
		style="left: {x}px; top: {y}px; min-width: {minWidth}px;"
		on:mousedown={handleMouseDown}
		on:mouseup={handleMouseUp}
		on:click={handleClick}
		role="dialog"
		aria-label={title}
	>
		<div class="window-header">
			<span class="window-title">{title}</span>
			<button class="close-btn" on:click={handleClose} type="button">×</button>
		</div>
		<div class="window-content">
			<slot />
		</div>
	</div>
{/if}

<style>
	.floating-window {
		position: fixed;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		max-height: 80vh;
	}

	.window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #e0e0e0;
		cursor: move;
		user-select: none;
		background: #f5f5f5;
		border-radius: 8px 8px 0 0;
	}

	.window-title {
		font-weight: 600;
		font-size: 14px;
		color: #333;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		line-height: 1;
		color: #666;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: #e0e0e0;
		color: #333;
	}

	.window-content {
		padding: 16px;
		overflow-y: auto;
		flex: 1;
	}
</style>
