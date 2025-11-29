<script lang="ts">
	/**
	 * TextProperties - Typography and text editing controls
	 *
	 * Displays typography properties for text elements (p, h1-h6, span, etc.)
	 */

	import { updateElementTypography, updateElementStyles } from '$lib/stores/design-store';
	import type { Element } from '$lib/types/events';

	export let element: Element;

	// Font families (common web fonts)
	const fontFamilies = [
		{ value: 'system-ui, sans-serif', label: 'System UI' },
		{ value: 'Arial, sans-serif', label: 'Arial' },
		{ value: 'Helvetica, sans-serif', label: 'Helvetica' },
		{ value: '"Times New Roman", serif', label: 'Times New Roman' },
		{ value: 'Georgia, serif', label: 'Georgia' },
		{ value: '"Courier New", monospace', label: 'Courier New' },
		{ value: 'monospace', label: 'Monospace' },
		{ value: 'Inter, sans-serif', label: 'Inter' },
		{ value: '"Roboto", sans-serif', label: 'Roboto' }
	];

	// Font sizes
	const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px', '72px'];

	// Font weights
	const fontWeights = [
		{ value: '300', label: 'Light' },
		{ value: '400', label: 'Regular' },
		{ value: '500', label: 'Medium' },
		{ value: '600', label: 'Semi Bold' },
		{ value: '700', label: 'Bold' },
		{ value: '800', label: 'Extra Bold' }
	];

	// Line heights
	const lineHeights = ['1', '1.2', '1.4', '1.5', '1.6', '1.8', '2'];

	// Text align options
	const textAligns: Array<{ value: 'left' | 'center' | 'right' | 'justify'; label: string }> = [
		{ value: 'left', label: 'Left' },
		{ value: 'center', label: 'Center' },
		{ value: 'right', label: 'Right' },
		{ value: 'justify', label: 'Justify' }
	];

	// Update typography
	function handleTypographyChange(property: string, value: string) {
		updateElementTypography(element.id, { [property]: value });
	}
</script>

<div class="text-properties">
	<!-- Typography Section -->
	<section class="property-section">
		<h3 class="section-title">Typography</h3>

		<!-- Font Family -->
		<div class="property-group">
			<label for="fontFamily">Font Family</label>
			<select
				id="fontFamily"
				value={element.typography.fontFamily || 'system-ui, sans-serif'}
				on:change={(e) => handleTypographyChange('fontFamily', e.currentTarget.value)}
			>
				{#each fontFamilies as font}
					<option value={font.value}>{font.label}</option>
				{/each}
			</select>
		</div>

		<!-- Font Size and Weight -->
		<div class="property-row">
			<div class="property-group">
				<label for="fontSize">Size</label>
				<select
					id="fontSize"
					value={element.typography.fontSize || '16px'}
					on:change={(e) => handleTypographyChange('fontSize', e.currentTarget.value)}
				>
					{#each fontSizes as size}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</div>

			<div class="property-group">
				<label for="fontWeight">Weight</label>
				<select
					id="fontWeight"
					value={element.typography.fontWeight || '400'}
					on:change={(e) => handleTypographyChange('fontWeight', e.currentTarget.value)}
				>
					{#each fontWeights as weight}
						<option value={weight.value}>{weight.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Line Height -->
		<div class="property-group">
			<label for="lineHeight">Line Height</label>
			<select
				id="lineHeight"
				value={element.typography.lineHeight || '1.5'}
				on:change={(e) => handleTypographyChange('lineHeight', e.currentTarget.value)}
			>
				{#each lineHeights as height}
					<option value={height}>{height}</option>
				{/each}
			</select>
		</div>

		<!-- Letter Spacing -->
		<div class="property-group">
			<label for="letterSpacing">Letter Spacing</label>
			<input
				type="text"
				id="letterSpacing"
				value={element.typography.letterSpacing || '0'}
				on:input={(e) => handleTypographyChange('letterSpacing', e.currentTarget.value)}
				placeholder="0px"
			/>
		</div>

		<!-- Text Alignment -->
		<div class="property-group">
			<label for="textAlign">Text Align</label>
			<div class="button-group" id="textAlign" role="group">
				{#each textAligns as align}
					<button
						class="toggle-button"
						class:active={element.typography.textAlign === align.value}
						on:click={() => handleTypographyChange('textAlign', align.value)}
					>
						{align.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Text Decoration -->
		<div class="property-group">
			<label for="textDecoration">Decoration</label>
			<div class="button-group" id="textDecoration" role="group">
				<button
					class="toggle-button"
					class:active={element.typography.textDecoration?.includes('underline')}
					on:click={() => handleTypographyChange('textDecoration',
						element.typography.textDecoration?.includes('underline') ? 'none' : 'underline'
					)}
				>
					Underline
				</button>
				<button
					class="toggle-button"
					class:active={element.typography.textDecoration?.includes('line-through')}
					on:click={() => handleTypographyChange('textDecoration',
						element.typography.textDecoration?.includes('line-through') ? 'none' : 'line-through'
					)}
				>
					Strikethrough
				</button>
			</div>
		</div>

		<!-- Text Transform -->
		<div class="property-group">
			<label for="textTransform">Text Transform</label>
			<select
				id="textTransform"
				value={element.typography.textTransform || 'none'}
				on:change={(e) => handleTypographyChange('textTransform', e.currentTarget.value)}
			>
				<option value="none">None</option>
				<option value="uppercase">Uppercase</option>
				<option value="lowercase">Lowercase</option>
				<option value="capitalize">Capitalize</option>
			</select>
		</div>
	</section>

	<!-- Color Section -->
	<section class="property-section">
		<h3 class="section-title">Color</h3>

		<div class="property-group">
			<label for="color">Text Color</label>
			<div class="color-input-group">
				<input
					type="color"
					id="color"
					value={element.styles.color || '#000000'}
					on:input={(e) => updateElementStyles(element.id, { color: e.currentTarget.value })}
				/>
				<input
					type="text"
					value={element.styles.color || '#000000'}
					on:input={(e) => updateElementStyles(element.id, { color: e.currentTarget.value })}
					placeholder="#000000"
				/>
			</div>
		</div>
	</section>
</div>

<style>
	.text-properties {
		padding: 16px;
	}

	.property-section {
		margin-bottom: 24px;
		padding-bottom: 24px;
		border-bottom: 1px solid #e5e7eb;
	}

	.property-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.section-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: #6b7280;
		margin: 0 0 12px 0;
		letter-spacing: 0.5px;
	}

	.property-group {
		margin-bottom: 12px;
	}

	.property-group:last-child {
		margin-bottom: 0;
	}

	.property-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 12px;
	}

	label {
		display: block;
		font-size: 12px;
		font-weight: 500;
		color: #374151;
		margin-bottom: 6px;
	}

	input[type='text'],
	textarea,
	select {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 13px;
		font-family: inherit;
		background: white;
		transition: border-color 0.2s;
	}

	input[type='text']:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: #3b82f6;
	}

	textarea {
		resize: vertical;
		min-height: 60px;
	}

	.edit-button {
		width: 100%;
		margin-top: 8px;
		padding: 6px 12px;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
	}

	.edit-button:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.color-input-group {
		display: grid;
		grid-template-columns: 40px 1fr;
		gap: 8px;
	}

	input[type='color'] {
		width: 40px;
		height: 32px;
		padding: 2px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-group {
		display: flex;
		gap: 4px;
	}

	.toggle-button {
		flex: 1;
		padding: 6px 8px;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
	}

	.toggle-button:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.toggle-button.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
	}
</style>
