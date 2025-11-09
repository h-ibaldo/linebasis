<script lang="ts">
	/**
	 * CanvasElement - Pure presentational component
	 *
	 * Responsibilities:
	 * - Render element with correct styles
	 * - Recursively render children
	 * - NO selection or interaction logic (handled by SelectionOverlay)
	 */

	import { designState, selectElement, selectedElements, addToSelection, removeFromSelection, updateElement } from '$lib/stores/design-store';
import { interactionState, startEditingText, stopEditingText } from '$lib/stores/interaction-store';

type DocumentWithCaret = Document & {
	caretRangeFromPoint?: (x: number, y: number) => Range | null;
	caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};
	import { currentTool } from '$lib/stores/tool-store';
	import { get } from 'svelte/store';
	import type { Element } from '$lib/types/events';

	export let element: Element;
	export let onStartDrag: ((e: MouseEvent, element: Element, handle?: string, selectedElements?: Element[]) => void) | undefined = undefined;
	export let isPanning: boolean = false;
	export let isDragging: boolean = false;

	// Check if this element is a text element (used for cursor and editing)
	$: isTextElement = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label'].includes(element.type);

	// Determine cursor based on tool, panning state, and dragging state
	$: elementCursor =
		isDragging && ($currentTool === 'hand' || isPanning) ? 'grabbing' :
		$currentTool === 'hand' || isPanning ? 'grab' :
		$currentTool === 'text' && isTextElement ? 'text' :
		$currentTool === 'scale' ? 'crosshair' :
		'default';

	// Handle mousedown - select element and potentially start drag
	function handleMouseDown(e: MouseEvent) {
		// If we're in text editing mode, don't handle mousedown
		if ($interactionState.mode === 'editing-text') {
			return;
		}

		const tool = get(currentTool);

		// Don't stop propagation if hand tool or space panning is active - let canvas handle it
		if (tool === 'hand' || isPanning) {
			return;
		}

		e.stopPropagation();

		// Text tool: start editing text element immediately on click
		if (tool === 'text' && isTextElement) {
			// Capture click position for caret placement once editor mounts
			textToolClickPosition = { x: e.clientX, y: e.clientY };
			// Start editing mode
			startEditingText(element.id);
			focusTextEditor(textToolClickPosition);
			return;
		}

		// Handle selection based on Shift key
		if (e.shiftKey) {
			// Shift+click: toggle element in selection
			const currentSelection = get(selectedElements).map(el => el.id);
			if (currentSelection.includes(element.id)) {
				removeFromSelection(element.id);
			} else {
				addToSelection(element.id);
			}
			// Don't start drag when Shift is held - just modify selection
			return;
		}

		// Check if this element is part of a multi-selection
		const currentSelection = get(selectedElements).map(el => el.id);
		const isPartOfMultiSelection = currentSelection.length > 1 && currentSelection.includes(element.id);

		// If clicking on an element that's part of a multi-selection, keep the selection
		// and start dragging all selected elements. Otherwise, select only this element.
		if (!isPartOfMultiSelection) {
			selectElement(element.id);
		}

		// If scale tool, start scaling from any click (not just handles)
		// If onStartDrag is provided (from SelectionOverlay), call it
		if (onStartDrag) {
			// For scale tool, pass 'se' handle to trigger resize mode with aspect ratio lock
			const handle = tool === 'scale' ? 'se' : undefined;

			// Pass current selection state to avoid timing issues when clicking outside selection
			const currentSelectedElements = get(selectedElements);
			const newSelectedElements = !isPartOfMultiSelection ? [element] : currentSelectedElements;
			onStartDrag(e, element, handle, newSelectedElements);
		}
	}

	// Handle double-click - enter text editing mode for text elements
	function handleDoubleClick(e: MouseEvent) {
		e.stopPropagation();

		// Only text-based elements can be edited
		const textElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label'];
		if (textElements.includes(element.type)) {
			startEditingText(element.id);
			focusTextEditor({ x: e.clientX, y: e.clientY });
			// Attempt to mimic native double-click word selection
			requestAnimationFrame(() => {
				const selection = window.getSelection();
				const modify = selection?.modify?.bind(selection);
				if (selection && modify) {
					modify('move', 'backward', 'word');
					modify('extend', 'forward', 'word');
				}
			});
		}
	}

	// Handle blur - exit text editing mode and save content
	function handleBlur(e: FocusEvent) {
		if ($interactionState.editingElementId === element.id) {
			// Prevent blur if clicking on the properties panel or other UI
			// This allows users to change text properties without losing focus
			const relatedTarget = e.relatedTarget as HTMLElement;
			if (relatedTarget && relatedTarget.closest('.properties-panel, .floating-window')) {
				return;
			}

			const target = e.target as HTMLElement;
			// Use innerHTML to preserve formatting (bold, paragraphs, etc.)
			let newContent = target.innerHTML || '';

			// Normalize the HTML to remove browser inconsistencies
			// This helps with comparison and prevents unnecessary updates
			newContent = newContent
				.replace(/\s+/g, ' ') // Normalize whitespace
				.replace(/<br\s*\/?>/gi, '<br>') // Normalize br tags
				.trim();

			// Set flag to prevent reactive updates during transition
			justExitedEditing = true;

			// Exit editing mode FIRST - this triggers the {#key} block to destroy/recreate
			stopEditingText();

			// Normalize the existing content for comparison
			const normalizedExisting = (element.content || '')
				.replace(/\s+/g, ' ')
				.replace(/<br\s*\/?>/gi, '<br>')
				.trim();

			// THEN update the content via event sourcing if it actually changed
			if (newContent !== normalizedExisting) {
				// Use requestAnimationFrame to ensure the update happens after the DOM settles
				requestAnimationFrame(() => {
					updateElement(element.id, { content: newContent });
				});
			}
		}
	}

	// Handle keydown in text editing mode
	function handleKeyDown(e: KeyboardEvent) {
		if ($interactionState.editingElementId === element.id) {
			const isModifierPressed = e.metaKey || (e.ctrlKey && !e.metaKey);

			if (isModifierPressed) {
				const key = e.key.toLowerCase();
				const { shiftKey } = e;

				const executeCommand = (command: string) => {
					e.preventDefault();
					document.execCommand(command);
				};

				if (!shiftKey) {
					switch (key) {
						case 'b':
							executeCommand('bold');
							break;
						case 'i':
							executeCommand('italic');
							break;
						case 'u':
							executeCommand('underline');
							break;
						default:
					}
				} else {
					if (key === 'x') {
						executeCommand('strikeThrough');
					} else {
						switch (key) {
							case 'l':
								executeCommand('justifyLeft');
								break;
							case 'e':
								executeCommand('justifyCenter');
								break;
							case 'r':
								executeCommand('justifyRight');
								break;
							case 'j':
								executeCommand('justifyFull');
								break;
							default:
						}
					}
				}

				if (shiftKey) {
					if (e.code === 'Digit7') {
						executeCommand('insertOrderedList');
					} else if (e.code === 'Digit8') {
						executeCommand('insertUnorderedList');
					}
				}
			}

			// Exit editing on Escape
			if (e.key === 'Escape') {
				e.preventDefault();
				(e.target as HTMLElement).blur();
			}
			// Exit editing on Enter (for single-line text elements)
			else if (e.key === 'Enter' && !['textarea', 'p', 'div'].includes(element.type)) {
				e.preventDefault();
				(e.target as HTMLElement).blur();
			}
			// Stop propagation for all keys when editing to prevent canvas shortcuts
			e.stopPropagation();
		}
	}

	// Get display position/size (pending during interaction, or actual)
	$: displayPosition =
		$interactionState.groupTransforms.has(element.id)
			? $interactionState.groupTransforms.get(element.id)!.position
			: $interactionState.activeElementId === element.id && $interactionState.pendingPosition
			? $interactionState.pendingPosition
			: element.position;

	$: displaySize =
		$interactionState.groupTransforms.has(element.id)
			? $interactionState.groupTransforms.get(element.id)!.size
			: $interactionState.activeElementId === element.id && $interactionState.pendingSize
			? $interactionState.pendingSize
			: element.size;

	$: displayRotation =
		$interactionState.groupTransforms.has(element.id) && $interactionState.groupTransforms.get(element.id)!.rotation !== undefined
			? $interactionState.groupTransforms.get(element.id)!.rotation
			: $interactionState.activeElementId === element.id && $interactionState.pendingRotation !== null
			? $interactionState.pendingRotation
			: element.rotation || 0;

	$: displayRadius =
		$interactionState.activeElementId === element.id && $interactionState.pendingRadius !== null
			? `${$interactionState.pendingRadius}px`
			: element.styles.borderRadius;

	// Get individual corner radii (for independent corner editing during drag)
	$: displayCornerRadii = $interactionState.activeElementId === element.id && $interactionState.pendingCornerRadii
		? $interactionState.pendingCornerRadii
		: null;

	// Generate inline styles from element properties
	$: elementStyles = (() => {
		const styles: string[] = [];

		// Position and size - use pending values during interaction
		styles.push(`position: absolute`);
		styles.push(`left: ${displayPosition.x}px`);
		styles.push(`top: ${displayPosition.y}px`);

		// Width and height: use 'auto' for inline-block text elements, otherwise use fixed dimensions
		if (element.styles.display === 'inline-block') {
			styles.push(`width: auto`);
			styles.push(`height: auto`);
			styles.push(`min-width: 20px`); // Minimum width for empty text
		} else {
			styles.push(`width: ${displaySize.width}px`);
			styles.push(`height: ${displaySize.height}px`);
		}
		styles.push(`cursor: ${elementCursor}`);

		// Z-index for stacking order
		if (element.zIndex !== undefined) {
			styles.push(`z-index: ${element.zIndex}`);
		}

		// Rotation
		if (displayRotation) {
			styles.push(`transform: rotate(${displayRotation}deg)`);
			styles.push(`transform-origin: center center`);
		}

		// Element styles
		if (element.styles.display) styles.push(`display: ${element.styles.display}`);
		if (element.styles.backgroundColor) styles.push(`background-color: ${element.styles.backgroundColor}`);
		if (element.styles.color) styles.push(`color: ${element.styles.color}`);
		if (element.styles.borderWidth) styles.push(`border-width: ${element.styles.borderWidth}`);
		if (element.styles.borderStyle) styles.push(`border-style: ${element.styles.borderStyle}`);
		if (element.styles.borderColor) styles.push(`border-color: ${element.styles.borderColor}`);

		// Border radius - check pending individual corners first (during independent editing)
		if (displayCornerRadii) {
			// Use pending individual corner radii (independent mode during drag)
			styles.push(`border-top-left-radius: ${displayCornerRadii.nw}px`);
			styles.push(`border-top-right-radius: ${displayCornerRadii.ne}px`);
			styles.push(`border-bottom-right-radius: ${displayCornerRadii.se}px`);
			styles.push(`border-bottom-left-radius: ${displayCornerRadii.sw}px`);
		} else if (element.styles.borderTopLeftRadius || element.styles.borderTopRightRadius ||
		    element.styles.borderBottomRightRadius || element.styles.borderBottomLeftRadius) {
			// Use stored individual corner radii
			if (element.styles.borderTopLeftRadius) styles.push(`border-top-left-radius: ${element.styles.borderTopLeftRadius}`);
			if (element.styles.borderTopRightRadius) styles.push(`border-top-right-radius: ${element.styles.borderTopRightRadius}`);
			if (element.styles.borderBottomRightRadius) styles.push(`border-bottom-right-radius: ${element.styles.borderBottomRightRadius}`);
			if (element.styles.borderBottomLeftRadius) styles.push(`border-bottom-left-radius: ${element.styles.borderBottomLeftRadius}`);
		} else if (displayRadius) {
			// Use uniform radius
			styles.push(`border-radius: ${displayRadius}`);
		}
		if (element.styles.opacity !== undefined) styles.push(`opacity: ${element.styles.opacity}`);
		if (element.styles.boxShadow) styles.push(`box-shadow: ${element.styles.boxShadow}`);
		if (element.styles.overflow) styles.push(`overflow: ${element.styles.overflow}`);

		// Typography
		if (element.typography.fontFamily) styles.push(`font-family: ${element.typography.fontFamily}`);
		if (element.typography.fontSize) styles.push(`font-size: ${element.typography.fontSize}`);
		if (element.typography.fontWeight) styles.push(`font-weight: ${element.typography.fontWeight}`);
		if (element.typography.lineHeight) styles.push(`line-height: ${element.typography.lineHeight}`);
		if (element.typography.letterSpacing) styles.push(`letter-spacing: ${element.typography.letterSpacing}`);
		if (element.typography.textAlign) styles.push(`text-align: ${element.typography.textAlign}`);
		if (element.typography.textDecoration) styles.push(`text-decoration: ${element.typography.textDecoration}`);
		if (element.typography.textTransform) styles.push(`text-transform: ${element.typography.textTransform}`);

		// Spacing
		if (element.spacing.marginTop) styles.push(`margin-top: ${element.spacing.marginTop}`);
		if (element.spacing.marginRight) styles.push(`margin-right: ${element.spacing.marginRight}`);
		if (element.spacing.marginBottom) styles.push(`margin-bottom: ${element.spacing.marginBottom}`);
		if (element.spacing.marginLeft) styles.push(`margin-left: ${element.spacing.marginLeft}`);
		if (element.spacing.paddingTop) styles.push(`padding-top: ${element.spacing.paddingTop}`);
		if (element.spacing.paddingRight) styles.push(`padding-right: ${element.spacing.paddingRight}`);
		if (element.spacing.paddingBottom) styles.push(`padding-bottom: ${element.spacing.paddingBottom}`);
		if (element.spacing.paddingLeft) styles.push(`padding-left: ${element.spacing.paddingLeft}`);

		return styles.join('; ');
	})();

	// Generate image-specific styles (objectFit applies to img, not parent div)
	$: imageStyles = (() => {
		const styles = ['width: 100%', 'height: 100%'];
		if (element.styles?.objectFit) {
			styles.push(`object-fit: ${element.styles.objectFit}`);
		} else {
			styles.push('object-fit: cover'); // Default
		}
		return styles.join('; ');
	})();

	// Check if this element is selected
	$: isSelected = $selectedElements.some(el => el.id === element.id);

	// Check if this element is being edited
	$: isEditing = $interactionState.editingElementId === element.id;

// Ref to the editable element for manual content management
let textEditorElement: HTMLDivElement | null = null;

	// Track if we just exited editing to prevent reactive updates during transition
	let justExitedEditing = false;

// Track pointer position for text tool caret placement
let textToolClickPosition: { x: number; y: number } | null = null;

// Ensure we focus once per editing session
let hasFocusedEditor = false;

// Ensure text editor shows current content on entry
$: if (textEditorElement && isEditing && isTextElement && element.children.length === 0) {
	if (!justExitedEditing) {
		textEditorElement.innerHTML = element.content || '';
	}
}

// Reset flags when leaving editing mode
$: if (!isEditing) {
	textToolClickPosition = null;
	justExitedEditing = false;
	hasFocusedEditor = false;
}

function focusTextEditor(position?: { x: number; y: number } | null) {
	hasFocusedEditor = true;
	requestAnimationFrame(() => {
		const editor =
			textEditorElement || document.querySelector(`[data-editor-for="${element.id}"]`);
		if (!(editor instanceof HTMLElement)) {
			return;
		}

		editor.focus();

		if (!position) {
			return;
		}

		const selection = window.getSelection();
		if (!selection) {
			return;
		}

		const doc = document as DocumentWithCaret;
		const rangeFromPoint = doc.caretRangeFromPoint?.(position.x, position.y);
		const range =
			rangeFromPoint ||
			(() => {
				const caretPosition = doc.caretPositionFromPoint?.(position.x, position.y);
				if (!caretPosition) return null;
				const r = document.createRange();
				r.setStart(caretPosition.offsetNode, caretPosition.offset);
				r.collapse(true);
				return r;
			})();

		if (range) {
			selection.removeAllRanges();
			selection.addRange(range);
		} else {
			// Fallback: place caret at end
			selection.removeAllRanges();
			const fallbackRange = document.createRange();
			fallbackRange.selectNodeContents(editor);
			fallbackRange.collapse(false);
			selection.addRange(fallbackRange);
		}

		textToolClickPosition = null;
	});
}

$: if (isEditing && textEditorElement && !hasFocusedEditor) {
	focusTextEditor(textToolClickPosition);
}
</script>

<!-- Canvas element - absolutely positioned, clickable for selection -->
<div
	class="canvas-element"
	class:editing-text={isEditing && isTextElement && element.children.length === 0}
	class:text-element={isTextElement && element.children.length === 0}
	data-element-id={element.id}
	style={elementStyles}
	on:mousedown={handleMouseDown}
	on:dblclick={handleDoubleClick}
	role="button"
	tabindex={isEditing ? -1 : 0}
>
		<!-- Selection indicator - blue outline overlay (Figma/Illustrator style) -->
		{#if isSelected && !isEditing}
			<div
				class="selection-indicator"
				style="border-radius: inherit;"
				aria-hidden="true"
			></div>
		{/if}

		{#if isEditing && isTextElement && element.children.length === 0}
			<div
				class="text-editor"
				bind:this={textEditorElement}
				data-editor-for={element.id}
				contenteditable="true"
				role="textbox"
				aria-multiline={element.type === 'span' || element.type === 'label' ? 'false' : 'true'}
				spellcheck="true"
				on:blur={handleBlur}
				on:keydown={handleKeyDown}
			></div>
		{:else}
			<!-- Render element content based on type -->
			{#if element.type === 'img'}
			<img src={element.src || ''} alt={element.alt || ''} style={imageStyles} />
		{:else if element.type === 'a'}
			<a href={element.href || '#'}>{@html element.content || 'Link'}</a>
		{:else if element.type === 'button'}
			<button type="button">{@html element.content || 'Button'}</button>
		{:else if element.type === 'input'}
			<input type="text" placeholder={element.content || 'Input'} />
		{:else if element.type === 'textarea'}
			<textarea placeholder={element.content || 'Textarea'}></textarea>
		{:else if isTextElement && element.children.length === 0}
			<!-- Render text content for leaf text elements (p, h1-h6, span with no children) -->
			<div class="text-content" data-display-for={element.id}>
				{@html element.content || ''}
			</div>
		{/if}
		{/if}

		<!-- Render children recursively -->
		{#each element.children as childId}
			{#if $designState.elements[childId]}
				<svelte:self element={$designState.elements[childId]} {isPanning} {isDragging} {onStartDrag} />
			{/if}
		{/each}
</div>

<style>
	.canvas-element {
		position: absolute;
		user-select: none;
		box-sizing: border-box;
		pointer-events: auto; /* Allow clicks for selection */
	}

	/* Allow text selection when in editing mode */
.canvas-element.editing-text {
	cursor: text;
}

.text-editor,
.text-content {
	display: block;
	white-space: pre-wrap;
	word-break: break-word;
	overflow-wrap: anywhere;
	width: 100%;
	box-sizing: border-box;
}

.text-content {
	pointer-events: none;
}

.text-editor {
	min-width: 20px;
	box-sizing: border-box;
	cursor: text;
	user-select: text;
	outline: 2px solid #3b82f6;
	outline-offset: 2px;
	white-space: pre-wrap;
}

.text-editor:focus {
	outline: 2px solid #3b82f6;
}

	/* Selection indicator - blue outline overlay (Figma/Illustrator style) */
	.selection-indicator {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: 2px solid #3b82f6;
		pointer-events: none;
		box-sizing: border-box;
		z-index: 9999; /* Ensure it's on top of element content */
	}
</style>
