<script lang="ts">
	/**
	 * TextProperties - Advanced typography and text editing controls
	 *
	 * Features:
	 * - Font family, size, weight, style
	 * - Line height and letter spacing
	 * - Text alignment and formatting
	 * - Advanced text controls (word spacing, white space, hyphenation)
	 * - Selection-based styling (bold, italic, underline on selected text)
	 */

	import {
		updateElementTypography,
		updateElementStyles
	} from '$lib/stores/design-store';
	import { interactionState } from '$lib/stores/interaction-store';
	import type { Element } from '$lib/types/events';

	export let element: Element;

	// Check if this element is being edited and has a text selection
	function getActiveEditor(): HTMLElement | null {
		if ($interactionState.editingElementId !== element.id) {
			return null;
		}
		return document.querySelector(`[data-editor-for="${element.id}"]`) as HTMLElement;
	}

	function hasTextSelection(): boolean {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return false;

		const range = selection.getRangeAt(0);
		return !range.collapsed; // Returns true if there's a selection (not just a cursor)
	}

	// Font families (common web fonts + Google Fonts)
	const fontFamilies = [
		{ value: 'system-ui, sans-serif', label: 'System UI', category: 'System' },
		{ value: 'Arial, sans-serif', label: 'Arial', category: 'Sans Serif' },
		{ value: 'Helvetica, sans-serif', label: 'Helvetica', category: 'Sans Serif' },
		{ value: '"Times New Roman", serif', label: 'Times New Roman', category: 'Serif' },
		{ value: 'Georgia, serif', label: 'Georgia', category: 'Serif' },
		{ value: '"Courier New", monospace', label: 'Courier New', category: 'Monospace' },
		{ value: 'monospace', label: 'Monospace', category: 'Monospace' },
		{ value: 'Inter, sans-serif', label: 'Inter (Google)', category: 'Google Fonts' },
		{ value: '"Roboto", sans-serif', label: 'Roboto (Google)', category: 'Google Fonts' },
		{ value: '"Open Sans", sans-serif', label: 'Open Sans (Google)', category: 'Google Fonts' },
		{ value: '"Lato", sans-serif', label: 'Lato (Google)', category: 'Google Fonts' },
		{ value: '"Montserrat", sans-serif', label: 'Montserrat (Google)', category: 'Google Fonts' },
		{ value: '"Playfair Display", serif', label: 'Playfair Display (Google)', category: 'Google Fonts' },
		{ value: '"Merriweather", serif', label: 'Merriweather (Google)', category: 'Google Fonts' }
	];

	// Font sizes (px values)
	const fontSizes = [
		'10px', '12px', '14px', '16px', '18px', '20px', '22px', '24px',
		'28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px', '96px'
	];

	// Font weights
	const fontWeights = [
		{ value: '100', label: 'Thin' },
		{ value: '200', label: 'Extra Light' },
		{ value: '300', label: 'Light' },
		{ value: '400', label: 'Regular' },
		{ value: '500', label: 'Medium' },
		{ value: '600', label: 'Semi Bold' },
		{ value: '700', label: 'Bold' },
		{ value: '800', label: 'Extra Bold' },
		{ value: '900', label: 'Black' }
	];

	// Font styles
	const fontStyles: Array<{ value: 'normal' | 'italic' | 'oblique'; label: string; icon: string }> = [
		{ value: 'normal', label: 'Normal', icon: 'R' },
		{ value: 'italic', label: 'Italic', icon: 'I' },
		{ value: 'oblique', label: 'Oblique', icon: 'O' }
	];

	// Line heights
	const lineHeights = ['1', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.75', '1.8', '2', '2.5', '3'];

	// Text align options
	const textAligns: Array<{ value: 'left' | 'center' | 'right' | 'justify'; label: string; icon: string }> = [
		{ value: 'left', label: 'Left', icon: '≡' },
		{ value: 'center', label: 'Center', icon: '≡' },
		{ value: 'right', label: 'Right', icon: '≡' },
		{ value: 'justify', label: 'Justify', icon: '≡' }
	];

	// Text decoration styles
	const decorationStyles: Array<{ value: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy'; label: string }> = [
		{ value: 'solid', label: 'Solid' },
		{ value: 'double', label: 'Double' },
		{ value: 'dotted', label: 'Dotted' },
		{ value: 'dashed', label: 'Dashed' },
		{ value: 'wavy', label: 'Wavy' }
	];

	// White space options
	const whiteSpaceOptions: Array<{ value: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line'; label: string }> = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'nowrap', label: 'No Wrap' },
		{ value: 'pre', label: 'Pre' },
		{ value: 'pre-wrap', label: 'Pre Wrap' },
		{ value: 'pre-line', label: 'Pre Line' }
	];

	// Word break options
	const wordBreakOptions: Array<{ value: 'normal' | 'break-all' | 'keep-all' | 'break-word'; label: string }> = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'break-all', label: 'Break All' },
		{ value: 'keep-all', label: 'Keep All' },
		{ value: 'break-word', label: 'Break Word' }
	];

	// Update typography property
	function handleTypographyChange(property: string, value: any) {
		const editor = getActiveEditor();

		// If editing this element and has a text selection, apply to selection only
		if (editor && hasTextSelection()) {
			applyStyleToSelection(property, value);
		} else {
			// Otherwise apply to entire element
			updateElementTypography(element.id, {
				[property]: value
			});
		}
	}

	// Apply style to current text selection using execCommand or DOM manipulation
	function applyStyleToSelection(property: string, value: any) {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		// Map typography properties to execCommand or CSS styling
		switch (property) {
			case 'fontWeight':
				if (value === '700' || value === '800' || value === '900') {
					document.execCommand('bold');
				} else {
					// For other weights, we need to wrap in a span
					wrapSelectionInSpan({ fontWeight: value });
				}
				break;

			case 'fontStyle':
				if (value === 'italic' || value === 'oblique') {
					document.execCommand('italic');
				} else {
					wrapSelectionInSpan({ fontStyle: value });
				}
				break;

			case 'textDecoration':
				if (value.includes('underline')) {
					document.execCommand('underline');
				} else if (value.includes('line-through')) {
					document.execCommand('strikeThrough');
				} else {
					wrapSelectionInSpan({ textDecoration: value });
				}
				break;

			case 'fontSize':
				wrapSelectionInSpan({ fontSize: value });
				break;

			case 'fontFamily':
				wrapSelectionInSpan({ fontFamily: value });
				break;

			case 'color':
				document.execCommand('foreColor', false, value);
				break;

			case 'textTransform':
			case 'letterSpacing':
			case 'wordSpacing':
			case 'lineHeight':
				wrapSelectionInSpan({ [property]: value });
				break;

			default:
				// For properties that don't apply to selections, apply to whole element
				updateElementTypography(element.id, {
					[property]: value
				});
		}
	}

	// Helper: Wrap current selection in a span with inline styles
	function wrapSelectionInSpan(styles: Record<string, any>) {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const selectedContent = range.extractContents();

		// Create span with inline styles
		const span = document.createElement('span');
		Object.entries(styles).forEach(([key, value]) => {
			// Convert camelCase to kebab-case for CSS
			const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
			span.style.setProperty(cssKey, value);
		});

		span.appendChild(selectedContent);
		range.insertNode(span);

		// Restore selection
		selection.removeAllRanges();
		const newRange = document.createRange();
		newRange.selectNodeContents(span);
		selection.addRange(newRange);
	}

	// Handle color change (supports selection-based styling)
	function handleColorChange(value: string) {
		const editor = getActiveEditor();

		// If editing this element and has a text selection, apply to selection only
		if (editor && hasTextSelection()) {
			applyStyleToSelection('color', value);
		} else {
			// Otherwise apply to entire element
			updateElementStyles(element.id, { color: value });
		}
	}

	// Toggle font style (italic)
	function toggleFontStyle(style: 'normal' | 'italic' | 'oblique') {
		handleTypographyChange('fontStyle', style);
	}

	// Toggle text decoration
	function toggleTextDecoration(decoration: 'underline' | 'line-through' | 'overline' | 'none') {
		const current = element.typography.textDecoration || 'none';
		handleTypographyChange('textDecoration', current === decoration ? 'none' : decoration);
	}
</script>

<div class="text-properties">
	<!-- Font Properties -->
	<section class="property-section">
		<h3 class="section-title">Font</h3>

		<!-- Font Family -->
		<div class="property-group">
			<label for="fontFamily">Family</label>
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

		<!-- Font Style -->
		<div class="property-group">
			<label>Style</label>
			<div class="button-group">
				{#each fontStyles as style}
					<button
						class="toggle-button"
						class:active={element.typography.fontStyle === style.value}
						on:click={() => toggleFontStyle(style.value)}
						title={style.label}
					>
						{style.icon}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- Text Spacing -->
	<section class="property-section">
		<h3 class="section-title">Spacing</h3>

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

		<!-- Word Spacing -->
		<div class="property-group">
			<label for="wordSpacing">Word Spacing</label>
			<input
				type="text"
				id="wordSpacing"
				value={element.typography.wordSpacing || '0'}
				on:input={(e) => handleTypographyChange('wordSpacing', e.currentTarget.value)}
				placeholder="0px"
			/>
		</div>

		<!-- Text Indent -->
		<div class="property-group">
			<label for="textIndent">Text Indent</label>
			<input
				type="text"
				id="textIndent"
				value={element.typography.textIndent || '0'}
				on:input={(e) => handleTypographyChange('textIndent', e.currentTarget.value)}
				placeholder="0px"
			/>
		</div>
	</section>

	<!-- Text Formatting -->
	<section class="property-section">
		<h3 class="section-title">Formatting</h3>

		<!-- Text Alignment -->
		<div class="property-group">
			<label>Alignment</label>
			<div class="button-group">
				{#each textAligns as align}
					<button
						class="toggle-button"
						class:active={element.typography.textAlign === align.value}
						on:click={() => handleTypographyChange('textAlign', align.value)}
						title={align.label}
					>
						{align.icon}
					</button>
				{/each}
			</div>
		</div>

		<!-- Text Decoration -->
		<div class="property-group">
			<label>Decoration</label>
			<div class="button-group">
				<button
					class="toggle-button"
					class:active={element.typography.textDecoration?.includes('underline')}
					on:click={() => toggleTextDecoration('underline')}
					title="Underline"
				>
					U
				</button>
				<button
					class="toggle-button"
					class:active={element.typography.textDecoration?.includes('line-through')}
					on:click={() => toggleTextDecoration('line-through')}
					title="Strikethrough"
				>
					S
				</button>
				<button
					class="toggle-button"
					class:active={element.typography.textDecoration?.includes('overline')}
					on:click={() => toggleTextDecoration('overline')}
					title="Overline"
				>
					O
				</button>
			</div>
		</div>

		<!-- Decoration Style (only show if decoration is active) -->
		{#if element.typography.textDecoration && element.typography.textDecoration !== 'none'}
			<div class="property-group">
				<label for="decorationStyle">Decoration Style</label>
				<select
					id="decorationStyle"
					value={element.typography.textDecorationStyle || 'solid'}
					on:change={(e) => handleTypographyChange('textDecorationStyle', e.currentTarget.value)}
				>
					{#each decorationStyles as style}
						<option value={style.value}>{style.label}</option>
					{/each}
				</select>
			</div>

			<div class="property-group">
				<label for="decorationColor">Decoration Color</label>
				<div class="color-input-group">
					<input
						type="color"
						id="decorationColor"
						value={element.typography.textDecorationColor || element.styles.color || '#000000'}
						on:input={(e) => handleTypographyChange('textDecorationColor', e.currentTarget.value)}
					/>
					<input
						type="text"
						value={element.typography.textDecorationColor || element.styles.color || '#000000'}
						on:input={(e) => handleTypographyChange('textDecorationColor', e.currentTarget.value)}
						placeholder="#000000"
					/>
				</div>
			</div>
		{/if}

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

	<!-- Advanced -->
	<section class="property-section">
		<h3 class="section-title">Advanced</h3>

		<!-- White Space -->
		<div class="property-group">
			<label for="whiteSpace">White Space</label>
			<select
				id="whiteSpace"
				value={element.typography.whiteSpace || 'normal'}
				on:change={(e) => handleTypographyChange('whiteSpace', e.currentTarget.value)}
			>
				{#each whiteSpaceOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- Word Break -->
		<div class="property-group">
			<label for="wordBreak">Word Break</label>
			<select
				id="wordBreak"
				value={element.typography.wordBreak || 'normal'}
				on:change={(e) => handleTypographyChange('wordBreak', e.currentTarget.value)}
			>
				{#each wordBreakOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- Hyphens -->
		<div class="property-group">
			<label for="hyphens">Hyphens</label>
			<select
				id="hyphens"
				value={element.typography.hyphens || 'none'}
				on:change={(e) => handleTypographyChange('hyphens', e.currentTarget.value)}
			>
				<option value="none">None</option>
				<option value="manual">Manual</option>
				<option value="auto">Auto</option>
			</select>
		</div>
	</section>

	<!-- Color -->
	<section class="property-section">
		<h3 class="section-title">Color</h3>

		<div class="property-group">
			<label for="color">Text Color</label>
			<div class="color-input-group">
				<input
					type="color"
					id="color"
					value={element.styles.color || '#000000'}
					on:input={(e) => handleColorChange(e.currentTarget.value)}
				/>
				<input
					type="text"
					value={element.styles.color || '#000000'}
					on:input={(e) => handleColorChange(e.currentTarget.value)}
					placeholder="#000000"
				/>
			</div>
		</div>
	</section>
</div>

<style>
	.text-properties {
		padding: 16px;
		max-height: calc(100vh - 200px);
		overflow-y: auto;
	}

	.property-section {
		margin-bottom: 20px;
		padding-bottom: 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.property-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.section-title {
		font-size: 11px;
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
		font-size: 11px;
		font-weight: 500;
		color: #374151;
		margin-bottom: 6px;
	}

	input[type='text'],
	select {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 12px;
		font-family: inherit;
		background: white;
		transition: border-color 0.2s;
	}

	input[type='text']:focus,
	select:focus {
		outline: none;
		border-color: #3b82f6;
	}

	.color-input-group {
		display: grid;
		grid-template-columns: 36px 1fr;
		gap: 8px;
	}

	input[type='color'] {
		width: 36px;
		height: 30px;
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
		font-weight: 600;
		color: #374151;
		cursor: pointer;
		transition: all 0.15s;
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
