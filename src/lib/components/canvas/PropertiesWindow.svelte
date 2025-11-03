<script lang="ts">
	/**
	 * PropertiesWindow - Properties panel for selected elements
	 *
	 * Shows properties based on selected element type:
	 * - Div: Layout, background, border, frame toggle
	 * - Text: Content, typography, alignment
	 * - Media: Source, display, alt text
	 */

	import { selectedElements } from '$lib/stores/design-store';
	import FloatingWindow from '$lib/components/ui/FloatingWindow.svelte';
	import DivProperties from './properties/DivProperties.svelte';
	import MediaProperties from './properties/MediaProperties.svelte';
	import MultiSelectionProperties from './properties/MultiSelectionProperties.svelte';

	$: selectedElement = $selectedElements.length === 1 ? $selectedElements[0] : null;
	$: elementType = selectedElement?.type;
	$: isMultiSelection = $selectedElements.length > 1;
</script>

<FloatingWindow title="Properties" defaultX={-320} defaultY={-400} storageKey="properties-window-pos">
	<div class="properties-panel">
		{#if isMultiSelection}
			<MultiSelectionProperties elements={$selectedElements} />
		{:else if !selectedElement}
			<div class="no-selection">
				<p>No element selected</p>
				<p class="hint">Select an element to edit its properties</p>
			</div>
		{:else if elementType === 'div'}
			<DivProperties element={selectedElement} />
		{:else if elementType === 'p' || elementType?.startsWith('h')}
			<div class="coming-soon">
				<p>Text Properties</p>
				<p class="hint">Coming soon</p>
			</div>
		{:else if elementType === 'img'}
			<MediaProperties element={selectedElement} />
		{:else}
			<div class="no-selection">
				<p>Unknown element type: {elementType}</p>
			</div>
		{/if}
	</div>
</FloatingWindow>

<style>
	.properties-panel {
		min-width: 260px;
	}

	.no-selection,
	.coming-soon {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.no-selection p:first-child,
	.coming-soon p:first-child {
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 8px;
	}

	.hint {
		font-size: 12px;
		color: #999;
		margin: 0;
	}
</style>
