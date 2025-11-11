<script lang="ts">
	/**
	 * DivProperties - Properties for Div elements
	 *
	 * Features:
	 * - Frame toggle (converts div to frame)
	 * - Layout properties
	 * - Background, border, spacing
	 */

	import type { Element } from '$lib/types/events';
	import { updateElementStyles, toggleFrame, updateElementAutoLayout } from '$lib/stores/design-store';

	export let element: Element;

	// Frame toggle state (stored in element metadata)
	$: isFrame = element.isFrame || false;

	async function handleToggleFrame() {
		await toggleFrame(element.id, !isFrame, `Frame ${element.id.slice(0, 8)}`, 1440);
	}

	// Background color
	$: backgroundColor = element.styles?.backgroundColor || '#f5f5f5';

	function updateBackgroundColor(e: Event) {
		const input = e.target as HTMLInputElement;
		updateElementStyles(element.id, { backgroundColor: input.value });
	}

	// Border
	$: borderWidth = element.styles?.borderWidth || '0px';
	$: borderColor = element.styles?.borderColor || '#000000';
	$: borderStyle = element.styles?.borderStyle || 'solid';

	function updateBorder(property: string, value: string) {
		updateElementStyles(element.id, { [property]: value });
	}

	// Opacity
	$: opacity = element.styles?.opacity !== undefined ? element.styles.opacity : 1;

	function updateOpacity(e: Event) {
		const input = e.target as HTMLInputElement;
		updateElementStyles(element.id, { opacity: parseFloat(input.value) });
	}

	// Auto Layout
	$: autoLayoutEnabled = element.autoLayout?.enabled || false;
	$: direction = element.autoLayout?.direction || 'row';
	$: justifyContent = element.autoLayout?.justifyContent || 'flex-start';
	$: alignItems = element.autoLayout?.alignItems || 'flex-start';
	$: gap = element.autoLayout?.gap || '0px';
	$: ignoreAutoLayout = element.autoLayout?.ignoreAutoLayout || false;

	async function handleToggleAutoLayout() {
		await updateElementAutoLayout(element.id, { enabled: !autoLayoutEnabled });
	}

	async function updateAutoLayoutProperty(property: string, value: string | boolean) {
		await updateElementAutoLayout(element.id, { [property]: value });
	}
</script>

<div class="div-properties">
	<!-- Frame Toggle -->
	<div class="property-section">
		<h3>Type</h3>
		<label class="toggle-label">
			<input type="checkbox" checked={isFrame} on:change={handleToggleFrame} />
			<span>Convert to Frame</span>
		</label>
		{#if isFrame}
			<p class="hint">This div is a frame (page/breakpoint)</p>
		{/if}
	</div>

	<!-- Background -->
	<div class="property-section">
		<h3>Background</h3>
		<div class="property-row">
			<label>
				<span>Color</span>
				<input type="color" value={backgroundColor} on:input={updateBackgroundColor} />
			</label>
		</div>
	</div>

	<!-- Border -->
	<div class="property-section">
		<h3>Border</h3>
		<div class="property-row">
			<label>
				<span>Width</span>
				<input
					type="text"
					value={borderWidth}
					on:input={(e) => updateBorder('borderWidth', e.currentTarget.value)}
				/>
			</label>
		</div>
		<div class="property-row">
			<label>
				<span>Color</span>
				<input
					type="color"
					value={borderColor}
					on:input={(e) => updateBorder('borderColor', e.currentTarget.value)}
				/>
			</label>
		</div>
		<div class="property-row">
			<label>
				<span>Style</span>
				<select
					value={borderStyle}
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
				<span>{Math.round(opacity * 100)}%</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={opacity}
					on:input={updateOpacity}
				/>
			</label>
		</div>
	</div>

	<!-- Auto Layout -->
	<div class="property-section">
		<h3>Auto Layout</h3>
		<label class="toggle-label">
			<input type="checkbox" checked={autoLayoutEnabled} on:change={handleToggleAutoLayout} />
			<span>{autoLayoutEnabled ? 'Enabled (Flex)' : 'Disabled (Freeform)'}</span>
		</label>

		{#if autoLayoutEnabled}
			<p class="hint">Children use relative positioning</p>

			<!-- Direction -->
			<div class="property-row">
				<span class="property-label">Direction</span>
				<div class="radio-group">
					<label class="radio-option">
						<input
							type="radio"
							name="direction"
							value="row"
							checked={direction === 'row'}
							on:change={() => updateAutoLayoutProperty('direction', 'row')}
						/>
						<span>Row</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="direction"
							value="column"
							checked={direction === 'column'}
							on:change={() => updateAutoLayoutProperty('direction', 'column')}
						/>
						<span>Column</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="direction"
							value="row-wrap"
							checked={direction === 'row-wrap'}
							on:change={() => updateAutoLayoutProperty('direction', 'row-wrap')}
						/>
						<span>Wrap</span>
					</label>
				</div>
			</div>

			<!-- Justify Content (main axis) -->
			<div class="property-row">
				<span class="property-label">Justify</span>
				<div class="radio-group">
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="flex-start"
							checked={justifyContent === 'flex-start'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'flex-start')}
						/>
						<span>Start</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="center"
							checked={justifyContent === 'center'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'center')}
						/>
						<span>Center</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="flex-end"
							checked={justifyContent === 'flex-end'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'flex-end')}
						/>
						<span>End</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="space-between"
							checked={justifyContent === 'space-between'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'space-between')}
						/>
						<span>Between</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="space-around"
							checked={justifyContent === 'space-around'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'space-around')}
						/>
						<span>Around</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="justify"
							value="space-evenly"
							checked={justifyContent === 'space-evenly'}
							on:change={() => updateAutoLayoutProperty('justifyContent', 'space-evenly')}
						/>
						<span>Evenly</span>
					</label>
				</div>
			</div>

			<!-- Align Items (cross axis) -->
			<div class="property-row">
				<span class="property-label">Align</span>
				<div class="radio-group">
					<label class="radio-option">
						<input
							type="radio"
							name="align"
							value="flex-start"
							checked={alignItems === 'flex-start'}
							on:change={() => updateAutoLayoutProperty('alignItems', 'flex-start')}
						/>
						<span>Start</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="align"
							value="center"
							checked={alignItems === 'center'}
							on:change={() => updateAutoLayoutProperty('alignItems', 'center')}
						/>
						<span>Center</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="align"
							value="flex-end"
							checked={alignItems === 'flex-end'}
							on:change={() => updateAutoLayoutProperty('alignItems', 'flex-end')}
						/>
						<span>End</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="align"
							value="stretch"
							checked={alignItems === 'stretch'}
							on:change={() => updateAutoLayoutProperty('alignItems', 'stretch')}
						/>
						<span>Stretch</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="align"
							value="baseline"
							checked={alignItems === 'baseline'}
							on:change={() => updateAutoLayoutProperty('alignItems', 'baseline')}
						/>
						<span>Baseline</span>
					</label>
				</div>
			</div>

			<!-- Gap -->
			<div class="property-row">
				<label>
					<span>Gap</span>
					<input
						type="text"
						value={gap}
						placeholder="0px"
						on:input={(e) => updateAutoLayoutProperty('gap', e.currentTarget.value)}
					/>
				</label>
			</div>
		{/if}
	</div>

	<!-- Per-Child: Ignore Auto Layout -->
	{#if element.parentId}
		<div class="property-section">
			<h3>Positioning</h3>
			<label class="toggle-label">
				<input
					type="checkbox"
					checked={ignoreAutoLayout}
					on:change={(e) => updateAutoLayoutProperty('ignoreAutoLayout', e.currentTarget.checked)}
				/>
				<span>Ignore parent's auto layout</span>
			</label>
			{#if ignoreAutoLayout}
				<p class="hint">This element uses absolute positioning</p>
			{/if}
		</div>
	{/if}

	<!-- Element Info -->
	<div class="property-section">
		<h3>Info</h3>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Position</span>
				<span class="info-value">{Math.round(element.position.x)}, {Math.round(element.position.y)}</span>
			</div>
			<div class="info-item">
				<span class="info-label">Size</span>
				<span class="info-value"
					>{Math.round(element.size.width)} × {Math.round(element.size.height)}</span
				>
			</div>
		</div>
	</div>
</div>

<style>
	.div-properties {
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

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: #f5f5f5;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.toggle-label:hover {
		background: #e8e8e8;
	}

	.toggle-label input[type='checkbox'] {
		cursor: pointer;
	}

	.property-label {
		color: #666;
		font-size: 12px;
		font-weight: 500;
		margin-bottom: 4px;
	}

	.radio-group {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.15s ease;
		user-select: none;
	}

	.radio-option:hover {
		background: #e8e8e8;
		border-color: #d0d0d0;
	}

	.radio-option input[type='radio'] {
		cursor: pointer;
		margin: 0;
	}

	.radio-option input[type='radio']:checked + span {
		font-weight: 600;
		color: #333;
	}

	.radio-option:has(input[type='radio']:checked) {
		background: #e0e7ff;
		border-color: #6366f1;
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
