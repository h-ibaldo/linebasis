<script lang="ts">
	/**
	 * Page Builder - Main application interface
	 *
	 * This is the page builder interface where users design pages.
	 * Features:
	 * - Canvas with zoom/pan
	 * - Element toolbar
	 * - Keyboard shortcuts (Cmd+Z undo, Cmd+Shift+Z redo, Cmd+K shortcuts modal)
	 */

	import { onMount } from 'svelte';
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import Toolbar from '$lib/components/canvas/Toolbar.svelte';
	import PropertiesWindow from '$lib/components/canvas/PropertiesWindow.svelte';
	import LayersWindow from '$lib/components/canvas/LayersWindow.svelte';
	import ShortcutsModal from '$lib/components/canvas/ShortcutsModal.svelte';
	import {
		setupKeyboardShortcuts,
		designState,
		selectElements,
		updateElement,
		updateElementAutoLayout,
		dispatch
	} from '$lib/stores/design-store';
	import { get } from 'svelte/store';
	import { nanoid } from 'nanoid';

	let cleanupKeyboard: (() => void) | undefined;
	let showShortcutsModal = false;

	function handleKeyDown(e: KeyboardEvent) {
		// Cmd/Ctrl+K to toggle shortcuts modal
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			showShortcutsModal = !showShortcutsModal;
		}
	}

	function closeShortcutsModal() {
		showShortcutsModal = false;
	}

	onMount(() => {
		// Setup keyboard shortcuts for undo/redo
		cleanupKeyboard = setupKeyboardShortcuts();

		// Expose design store and functions to window for E2E testing
		if (typeof window !== 'undefined') {
			(window as any).__designState = designState;
			(window as any).__selectElements = selectElements;
			(window as any).__getDesignState = () => get(designState);
			(window as any).__updateElement = updateElement;
			(window as any).__updateAutoLayout = updateElementAutoLayout;
			(window as any).__dispatch = dispatch;
			(window as any).__nanoid = nanoid;
		}

		return () => {
			if (cleanupKeyboard) cleanupKeyboard();
		};
	});
</script>

<svelte:window on:keydown={handleKeyDown} />

<svelte:head>
	<title>Linabasis - Page Builder</title>
</svelte:head>

<!-- STYLE: Page builder layout - full viewport -->
<div class="page-builder">
	<!-- Toolbar for creating elements -->
	<Toolbar />

	<!-- Main canvas -->
	<Canvas />

	<!-- Properties window -->
	<PropertiesWindow />

	<!-- Layers window -->
	<LayersWindow />

	<!-- Keyboard shortcuts modal -->
	<ShortcutsModal isOpen={showShortcutsModal} onClose={closeShortcutsModal} />
</div>

<style>
	.page-builder {
		width: 100%;
		height: 100vh;
		overflow: hidden;
		position: relative;
	}
</style>
