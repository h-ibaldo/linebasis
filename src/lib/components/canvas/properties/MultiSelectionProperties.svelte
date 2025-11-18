<script lang="ts">
	/**
	 * MultiSelectionProperties - Properties panel for multiple selected elements
	 *
	 * Shows and allows editing of common properties across all selected elements.
	 * Displays "Mixed" indicator when property values differ across elements.
	 */

	import type { Element } from '$lib/types/events';
	import { updateElementsStylesGroup } from '$lib/stores/design-store';

	export let elements: Element[];

	// Helper: Get common value or null if values differ
	function getCommonValue(property: keyof Element['styles']): string | number | null {
		if (elements.length === 0) return null;
		const firstValue = elements[0].styles?.[property];
		if (firstValue === undefined) return null;
		const allSame = elements.every(el => el.styles?.[property] === firstValue);
		return allSame ? firstValue : null;
	}

	// Helper: Get first element's value as fallback for mixed values
	function getFirstValue(property: keyof Element['styles'], defaultValue: string | number): string | number {
		if (elements.length === 0) return defaultValue;
		const firstValue = elements[0].styles?.[property];
		return firstValue !== undefined ? firstValue : defaultValue;
	}

	// Background color
	$: backgroundColor = getCommonValue('backgroundColor');
	$: backgroundColorMixed = backgroundColor === null;
	$: backgroundColorDisplay = backgroundColor || getFirstValue('backgroundColor', '#f5f5f5');

	function updateBackgroundColor(e: Event) {
		const input = e.target as HTMLInputElement;
		updateElementsStylesGroup(
			elements.map(el => ({
				elementId: el.id,
				styles: { backgroundColor: input.value }
			}))
		);
	}

	// Border properties
	$: borderWidth = getCommonValue('borderWidth');
	$: borderWidthMixed = borderWidth === null;
	$: borderWidthDisplay = borderWidth || getFirstValue('borderWidth', '0px');
	$: borderColor = getCommonValue('borderColor');
	$: borderColorMixed = borderColor === null;
	$: borderColorDisplay = borderColor || getFirstValue('borderColor', '#000000');
	$: borderStyle = getCommonValue('borderStyle');
	$: borderStyleMixed = borderStyle === null;
	$: borderStyleDisplay = borderStyle || getFirstValue('borderStyle', 'solid');

	function updateBorder(property: 'borderWidth' | 'borderColor' | 'borderStyle', value: string) {
		updateElementsStylesGroup(
			elements.map(el => ({
				elementId: el.id,
				styles: { [property]: value }
			}))
		);
	}

	// Opacity
	$: opacity = getCommonValue('opacity');
	$: opacityMixed = opacity === null;
	$: opacityValue = opacity !== null ? opacity : (getFirstValue('opacity', 1) as number);

	function updateOpacity(e: Event) {
		const input = e.target as HTMLInputElement;
		const value = parseFloat(input.value);
		updateElementsStylesGroup(
			elements.map(el => ({
				elementId: el.id,
				styles: { opacity: value }
			}))
		);
	}
</script>

<div class="multi-properties">
	<!-- Selection Info -->
	<div class="property-section">
		<h3>Selection</h3>
		<p class="selection-count">{elements.length} element{elements.length !== 1 ? 's' : ''} selected</p>
		<p class="hint">Edit properties to apply to all selected elements. Mixed values can be set to unify all elements.</p>
	</div>

	<!-- Background -->
	<div class="property-section">
		<h3>Background</h3>
		<div class="property-row">
			<label>
				<span>Color {#if backgroundColorMixed}(Mixed){/if}</span>
				<input
					type="color"
					value={backgroundColorDisplay}
					on:input={updateBackgroundColor}
				/>
			</label>
		</div>
	</div>

	<!-- Border -->
	<div class="property-section">
		<h3>Border</h3>
		<div class="property-row">
			<label>
				<span>Width {#if borderWidthMixed}(Mixed){/if}</span>
				<input
					type="text"
					value={borderWidthDisplay}
					on:input={(e) => updateBorder('borderWidth', e.currentTarget.value)}
					placeholder={borderWidthMixed ? 'Set new value' : ''}
				/>
			</label>
		</div>
		<div class="property-row">
			<label>
				<span>Color {#if borderColorMixed}(Mixed){/if}</span>
				<input
					type="color"
					value={borderColorDisplay}
					on:input={(e) => updateBorder('borderColor', e.currentTarget.value)}
				/>
			</label>
		</div>
		<div class="property-row">
			<label>
				<span>Style {#if borderStyleMixed}(Mixed){/if}</span>
				<select
					value={borderStyleDisplay}
					on:change={(e) => updateBorder('borderStyle', e.currentTarget.value)}
				>
					<option value="solid">Solid</option>
					<option value="dashed">Dashed</option>
					<option value="dotted">Dotted</option>
				</select>
			</label>
		</div>
	</div>

	<!-- Opacity -->
	<div class="property-section">
		<h3>Opacity</h3>
		<div class="property-row">
			<label>
				<span>
					{#if opacityMixed}
						Mixed
					{:else}
						{Math.round(opacityValue * 100)}%
					{/if}
				</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={opacityValue}
					on:input={updateOpacity}
				/>
			</label>
		</div>
	</div>

	<!-- Info -->
	<div class="property-section">
		<h3>Info</h3>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Elements</span>
				<span class="info-value">{elements.length}</span>
			</div>
		</div>
	</div>
</div>

<style>
	.multi-properties {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.property-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.property-section h3 {
		font-size: 12px;
		font-weight: 600;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.selection-count {
		font-size: 13px;
		font-weight: 500;
		color: #333;
		margin: 0;
	}

	.property-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.property-row label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}

	.property-row label span {
		color: #666;
		font-size: 12px;
	}

	.property-row input[type='text'],
	.property-row select {
		padding: 6px 8px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-size: 13px;
		font-family: inherit;
	}

	.property-row input[type='color'] {
		height: 32px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
	}

	.property-row input[type='range'] {
		width: 100%;
	}

	.hint {
		font-size: 11px;
		color: #999;
		margin: 0;
		padding: 4px 8px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 8px;
		background: #f5f5f5;
		border-radius: 4px;
		font-size: 12px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		color: #999;
		font-size: 11px;
	}

	.info-value {
		color: #333;
		font-weight: 500;
	}
</style>

