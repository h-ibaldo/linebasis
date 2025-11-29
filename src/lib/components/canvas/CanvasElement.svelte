<script lang="ts">
	/**
	 * CanvasElement - Pure presentational component
	 *
	 * Responsibilities:
	 * - Render element with correct styles
	 * - Recursively render children
	 * - NO selection or interaction logic (handled by SelectionOverlay)
	 */

	import { createEventDispatcher, tick } from 'svelte';
	import {
		designState,
		selectElement,
		selectElements,
		selectedElements,
		selectedElementIds as selectedIdsStore,
		addToSelection,
		removeFromSelection,
		updateElement,
		updateElementTypography
	} from '$lib/stores/design-store';
import { interactionState, startEditingText, stopEditingText } from '$lib/stores/interaction-store';
import { sanitizeTextContent } from '$lib/utils/sanitize';

	const dispatch = createEventDispatcher<{ contextmenu: { elementId: string; x: number; y: number } }>();

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

	// Sanitize element content to prevent XSS attacks when rendering
	$: sanitizedContent = sanitizeTextContent(element.content || '');

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

		// For text elements with move tool, prevent default to allow double-click
		// This prevents drag from interfering with double-click detection
		if (isTextElement && tool === 'move') {
			e.preventDefault();
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

		// Check if this element belongs to a group
		const state = get(designState);
		const clickedElement = state.elements[element.id];
		const groupId = clickedElement?.groupId;

		// Check if this element is part of a multi-selection
		const currentSelection = get(selectedElements).map(el => el.id);
		const isPartOfMultiSelection = currentSelection.length > 1 && currentSelection.includes(element.id);

		// If clicking on an element that's part of a multi-selection, keep the selection
		// and start dragging all selected elements. Otherwise, select element(s).
		let elementsToDrag: Element[] = [];
		if (!isPartOfMultiSelection) {
			// If element belongs to a group, select all elements in that group
			if (groupId && state.groups[groupId]) {
				const groupElementIds = state.groups[groupId].elementIds;
				selectElements(groupElementIds);
				// Get group elements directly from state (store update is synchronous)
				elementsToDrag = groupElementIds
					.map(id => state.elements[id])
					.filter(Boolean);
			} else {
				selectElement(element.id);
				// For single element, just use the clicked element
				elementsToDrag = [element];
			}
		} else {
			// Already part of multi-selection, use current selection
			elementsToDrag = get(selectedElements);
		}

		// If scale tool, start scaling from any click (not just handles)
		// If onStartDrag is provided (from SelectionOverlay), call it
		// Don't start drag for text elements with move tool - they should only be dragged by handles
		// This allows double-click to edit text without interference
		if (onStartDrag && !(isTextElement && tool === 'move')) {
			// For scale tool, pass 'se' handle to trigger resize mode with aspect ratio lock
			const handle = tool === 'scale' ? 'se' : undefined;
			onStartDrag(e, element, handle, elementsToDrag);
		}
	}

	// Handle double-click - enter text editing mode for text elements
	async function handleDoubleClick(e: MouseEvent) {
		e.stopPropagation();

		// Only text-based elements can be edited
		const textElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label'];
		if (textElements.includes(element.type)) {
			startEditingText(element.id);

			// Wait for Svelte to re-render with the text editor element
			await tick();

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
			// Sanitize to prevent XSS attacks
		let newContent = sanitizeTextContent(target.innerHTML || '');

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

	type ShortcutAction =
		| { type: 'exec'; command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertOrderedList' | 'insertUnorderedList' | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull' }
		| { type: 'font-size'; delta: number };

	function getShortcutAction(e: KeyboardEvent): ShortcutAction | null {
		const hasPrimaryModifier = e.metaKey || (e.ctrlKey && !e.metaKey);
		const code = e.code;
		const key = e.key.toLowerCase();

		// Alignment: Option/Alt + primary modifier
		if (e.altKey && hasPrimaryModifier) {
			switch (code) {
				case 'KeyL':
					return { type: 'exec', command: 'justifyLeft' };
				case 'KeyT':
					return { type: 'exec', command: 'justifyCenter' };
				case 'KeyR':
					return { type: 'exec', command: 'justifyRight' };
				case 'KeyG':
					return { type: 'exec', command: 'justifyFull' };
				default:
			}

			// Fallback for environments without `code`
			switch (key) {
				case 'l':
					return { type: 'exec', command: 'justifyLeft' };
				case 't':
					return { type: 'exec', command: 'justifyCenter' };
				case 'r':
					return { type: 'exec', command: 'justifyRight' };
				case 'g':
					return { type: 'exec', command: 'justifyFull' };
				default:
			}
		}

		if (!hasPrimaryModifier) {
			return null;
		}

		// Font size: Shift + primary modifier (+/-)
		if (e.shiftKey && !e.altKey) {
			if (code === 'Period' || key === '>' || key === '.') {
				return { type: 'font-size', delta: 1 };
			}
			if (code === 'Comma' || key === '<' || key === ',') {
				return { type: 'font-size', delta: -1 };
			}
		}

		// Strikethrough
		if (e.shiftKey && !e.altKey && (code === 'KeyX' || key === 'x')) {
			return { type: 'exec', command: 'strikeThrough' };
		}

		// Lists
		if (e.shiftKey && !e.altKey) {
			if (e.code === 'Digit7') {
				return { type: 'exec', command: 'insertOrderedList' };
			}
			if (e.code === 'Digit8') {
				return { type: 'exec', command: 'insertUnorderedList' };
			}
		}

		// Basic formatting (no shift/alt)
		if (!e.shiftKey && !e.altKey) {
			switch (code) {
				case 'KeyB':
					return { type: 'exec', command: 'bold' };
				case 'KeyI':
					return { type: 'exec', command: 'italic' };
				case 'KeyU':
					return { type: 'exec', command: 'underline' };
				default:
			}

			switch (key) {
				case 'b':
					return { type: 'exec', command: 'bold' };
				case 'i':
					return { type: 'exec', command: 'italic' };
				case 'u':
					return { type: 'exec', command: 'underline' };
				default:
			}
		}

		return null;
	}

	function adjustFontSize(delta: number) {
		const rawSize = element.typography.fontSize || '16px';
		const match = rawSize.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
		const value = match ? parseFloat(match[1]) : parseFloat(rawSize);
		const unit = match && match[2] ? match[2] : 'px';

		const baseValue = Number.isNaN(value) ? 16 : value;

		const newValue = Math.max(1, baseValue + delta);
		const formatted = `${Number(newValue.toFixed(2))}${unit}`;

		updateElementTypography(element.id, { fontSize: formatted });

		if (textEditorElement) {
			textEditorElement.style.fontSize = formatted;
		}
	}

	// Handle keydown in text editing mode
	function handleKeyDown(e: KeyboardEvent) {
		if ($interactionState.editingElementId === element.id) {
			const action = getShortcutAction(e);

			if (action) {
				e.preventDefault();
				e.stopPropagation();

				if (action.type === 'exec') {
					document.execCommand(action.command);
				} else {
					adjustFontSize(action.delta);
				}

				return;
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

	// Helper: Convert absolute position (from SelectionOverlay) to parent-relative position
	// This properly handles rotated parent hierarchies
	function absoluteToRelativePosition(absolutePos: { x: number; y: number }): { x: number; y: number } {
		// If element has no parent, absolute = relative
		if (!element.parentId) return absolutePos;

		// Get parent element from store
		const state = get(designState);
		const parent = state.elements[element.parentId];
		if (!parent) return absolutePos;

		// Build the ancestor chain from root to immediate parent
		const ancestors: Array<{
			id: string;
			position: { x: number; y: number };
			size: { width: number; height: number };
			rotation: number;
		}> = [];
		let currentParent = parent;

		while (currentParent) {
			ancestors.unshift({
				id: currentParent.id,
				position: currentParent.position,
				size: currentParent.size,
				rotation: currentParent.rotation || 0
			});

			if (!currentParent.parentId) break;
			const nextParent = state.elements[currentParent.parentId];
			if (!nextParent) break;
			currentParent = nextParent;
		}

		// Start with absolute position
		let x = absolutePos.x;
		let y = absolutePos.y;

		// Apply inverse transform for each ancestor (from root to immediate parent)
		for (let i = 0; i < ancestors.length; i++) {
			const ancestor = ancestors[i];

			// Subtract the ancestor's position (in its parent's coordinate space)
			x -= ancestor.position.x;
			y -= ancestor.position.y;

			// If ancestor is rotated, we need to apply inverse rotation around its center
			// CSS rotation uses the element's center as transform-origin
			if (ancestor.rotation !== 0) {
				// Get ancestor's center point (in its local coordinate space, which is now our current space)
				const centerX = ancestor.size.width / 2;
				const centerY = ancestor.size.height / 2;

				// Translate to origin (relative to ancestor's center)
				const relX = x - centerX;
				const relY = y - centerY;

				// Apply inverse rotation
				const angleRad = -ancestor.rotation * (Math.PI / 180); // Negative for inverse
				const cos = Math.cos(angleRad);
				const sin = Math.sin(angleRad);

				const rotatedX = relX * cos - relY * sin;
				const rotatedY = relX * sin + relY * cos;

				// Translate back from origin
				x = rotatedX + centerX;
				y = rotatedY + centerY;
			}
		}

		return { x, y };
	}

	// Get display position/size (pending during interaction, or actual)
	$: displayPosition = (() => {
		// Group transforms are already in the correct coordinate space
		if ($interactionState.groupTransforms.has(element.id)) {
			return $interactionState.groupTransforms.get(element.id)!.position;
		}

		// Pending position from SelectionOverlay during drag is in absolute coordinates
		// When dragging (not auto-layout reordering), we need to convert to parent-relative
		// because nested elements with position:absolute are positioned relative to their parent
		if ($interactionState.activeElementId === element.id && $interactionState.pendingPosition) {
			// Check if this is auto layout child dragging for reordering
			const parent = element.parentId ? $designState.elements[element.parentId] : null;
			const isAutoLayoutReorder = parent?.autoLayout?.enabled && !element.autoLayout?.ignoreAutoLayout;

			if (isAutoLayoutReorder) {
				// Auto layout reordering: convert to relative
				return absoluteToRelativePosition($interactionState.pendingPosition);
			} else if (element.parentId) {
				// Nested element drag: convert absolute position to parent-relative
				// This is critical because position:absolute on nested elements is relative to parent
				
				// FIX: For rotated parents, we must transform the CENTER of the element, not the top-left.
				// Transforming top-left directly fails because rotation happens around the center.
				const currentSize = $interactionState.pendingSize || element.size;
				
				// 1. Calculate center in world space
				const centerWorld = {
					x: $interactionState.pendingPosition.x + currentSize.width / 2,
					y: $interactionState.pendingPosition.y + currentSize.height / 2
				};
				
				// 2. Transform center to local space (parent-relative)
				const centerLocal = absoluteToRelativePosition(centerWorld);
				
				// 3. Convert back to top-left in local space
				return {
					x: centerLocal.x - currentSize.width / 2,
					y: centerLocal.y - currentSize.height / 2
				};
			} else {
				// Root element drag: use absolute position directly
				return $interactionState.pendingPosition;
			}
		}

		// Default: use element's stored position (already relative)
		return element.position;
	})();

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

	// Check if this element is being dragged
	$: isBeingDragged = $interactionState.mode === 'dragging' &&
		$interactionState.activeElementId === element.id &&
		$interactionState.pendingPosition !== null;

	// Check if element should be hidden during parent change transition
	$: isHiddenDuringTransition = $interactionState.hiddenDuringTransition === element.id;

	// Check if this is an auto layout child being dragged for reordering
	$: isAutoLayoutChildDragging = (() => {
		if (!isBeingDragged) return false;
		const parent = element.parentId ? $designState.elements[element.parentId] : null;
		return parent?.autoLayout?.enabled && !element.autoLayout?.ignoreAutoLayout;
	})();

	// Generate inline styles from element properties
	$: elementStyles = (() => {
		const styles: string[] = [];

		// Check if parent has auto layout enabled (and child doesn't ignore it)
		const parent = element.parentId ? $designState.elements[element.parentId] : null;
		const parentHasAutoLayout = parent?.autoLayout?.enabled || false;
		const childIgnoresAutoLayout = element.autoLayout?.ignoreAutoLayout || false;
		const useRelativePosition = parentHasAutoLayout && !childIgnoresAutoLayout;

		// Position and size - use pending values during interaction
		if (isBeingDragged && !isAutoLayoutChildDragging) {
			// Non-auto-layout element being dragged: use absolute positioning to follow cursor
			// Note: DOM order determines stacking, no z-index manipulation needed
			styles.push(`position: absolute`);
			styles.push(`left: ${displayPosition.x}px`);
			styles.push(`top: ${displayPosition.y}px`);
		} else if (useRelativePosition) {
			// Auto layout: children use relative positioning
			styles.push(`position: relative`);
			styles.push(`left: 0`);
			styles.push(`top: 0`);
			// Prevent flex children from shrinking or growing - maintain their dimensions
			styles.push(`flex-shrink: 0`);
			styles.push(`flex-grow: 0`);

			// If being dragged, dim the original (ghost will follow cursor at full opacity)
			if (isAutoLayoutChildDragging) {
				styles.push(`opacity: 0.3`);
			}
		} else {
			// Freeform: use absolute positioning with coordinates
			styles.push(`position: absolute`);
			styles.push(`left: ${displayPosition.x}px`);
			styles.push(`top: ${displayPosition.y}px`);
		}

		// Z-index for stacking order (only for root elements when not in a view)
		if (element.zIndex !== undefined && !element.parentId) {
			styles.push(`z-index: ${element.zIndex}`);
		}

		// Width and height: use 'auto' for inline-block text elements, otherwise use fixed dimensions
		if (element.styles.display === 'inline-block') {
			styles.push(`width: auto`);
			styles.push(`height: auto`);
			styles.push(`min-width: 20px`); // Minimum width for empty text
		} else {
			styles.push(`width: ${displaySize.width}px`);
			styles.push(`height: ${displaySize.height}px`);

			// For rotated elements in auto layout, add margin to reserve space for bounding box
			if (useRelativePosition && displayRotation && displayRotation !== 0) {
				const angleRad = displayRotation * (Math.PI / 180);
				const cos = Math.abs(Math.cos(angleRad));
				const sin = Math.abs(Math.sin(angleRad));
				const boundingWidth = displaySize.width * cos + displaySize.height * sin;
				const boundingHeight = displaySize.width * sin + displaySize.height * cos;

				// Calculate margin needed to expand to bounding box
				const marginX = (boundingWidth - displaySize.width) / 2;
				const marginY = (boundingHeight - displaySize.height) / 2;

				// Add margin to make flexbox reserve bounding box space
				styles.push(`margin: ${marginY}px ${marginX}px`);
			}
		}
		styles.push(`cursor: ${elementCursor}`);

		// Stacking order is determined by DOM position (no z-index needed)
		// Elements later in the children array appear on top

		// Rotation
		if (displayRotation) {
			styles.push(`transform: rotate(${displayRotation}deg)`);
			styles.push(`transform-origin: center center`);
		}

		// Element styles
		if (element.styles.display) styles.push(`display: ${element.styles.display}`);

		// Auto Layout (Flexbox)
		if (element.autoLayout?.enabled) {
			styles.push(`display: flex`);

			// Flex direction
			const direction = element.autoLayout.direction || 'row';
			if (direction === 'row-wrap') {
				styles.push(`flex-direction: row`);
				styles.push(`flex-wrap: wrap`);
			} else {
				styles.push(`flex-direction: ${direction}`);
			}

			// Justify content (main axis alignment)
			if (element.autoLayout.justifyContent) {
				styles.push(`justify-content: ${element.autoLayout.justifyContent}`);
			}

			// Align items (cross axis alignment)
			if (element.autoLayout.alignItems) {
				styles.push(`align-items: ${element.autoLayout.alignItems}`);
			}

			// Gap between children
			if (element.autoLayout.gap) {
				styles.push(`gap: ${element.autoLayout.gap}`);
			}
		}

		// Per-child: Ignore auto layout (absolute positioning override)
		if (element.autoLayout?.ignoreAutoLayout && element.parentId) {
			styles.push(`position: absolute`);
			// Keep the x, y coordinates for absolute positioning
		}

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
		if (element.typography.fontStyle) styles.push(`font-style: ${element.typography.fontStyle}`);
		if (element.typography.lineHeight) styles.push(`line-height: ${element.typography.lineHeight}`);
		if (element.typography.letterSpacing) styles.push(`letter-spacing: ${element.typography.letterSpacing}`);
		if (element.typography.wordSpacing) styles.push(`word-spacing: ${element.typography.wordSpacing}`);
		if (element.typography.textAlign) styles.push(`text-align: ${element.typography.textAlign}`);
		if (element.typography.textDecoration) styles.push(`text-decoration: ${element.typography.textDecoration}`);
		if (element.typography.textDecorationColor) styles.push(`text-decoration-color: ${element.typography.textDecorationColor}`);
		if (element.typography.textDecorationStyle) styles.push(`text-decoration-style: ${element.typography.textDecorationStyle}`);
		if (element.typography.textTransform) styles.push(`text-transform: ${element.typography.textTransform}`);
		if (element.typography.textIndent) styles.push(`text-indent: ${element.typography.textIndent}`);
		if (element.typography.whiteSpace) styles.push(`white-space: ${element.typography.whiteSpace}`);
		if (element.typography.wordBreak) styles.push(`word-break: ${element.typography.wordBreak}`);
		if (element.typography.hyphens) styles.push(`hyphens: ${element.typography.hyphens}`);

		// Spacing
		if (element.spacing.marginTop) styles.push(`margin-top: ${element.spacing.marginTop}`);
		if (element.spacing.marginRight) styles.push(`margin-right: ${element.spacing.marginRight}`);
		if (element.spacing.marginBottom) styles.push(`margin-bottom: ${element.spacing.marginBottom}`);
		if (element.spacing.marginLeft) styles.push(`margin-left: ${element.spacing.marginLeft}`);
		if (element.spacing.paddingTop) styles.push(`padding-top: ${element.spacing.paddingTop}`);
		if (element.spacing.paddingRight) styles.push(`padding-right: ${element.spacing.paddingRight}`);
		if (element.spacing.paddingBottom) styles.push(`padding-bottom: ${element.spacing.paddingBottom}`);
		if (element.spacing.paddingLeft) styles.push(`padding-left: ${element.spacing.paddingLeft}`);

		// Hide element during parent change transition to prevent flash
		if (isHiddenDuringTransition) {
			styles.push(`visibility: hidden`);
			styles.push(`pointer-events: none`);
		}

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
	// Optimized: Use memoized selectedIds store and Set lookup O(1) instead of array.some() O(n)
	$: selectedIdsSet = new Set($selectedIdsStore);
	$: isSelected = selectedIdsSet.has(element.id);

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
		// Sanitize content to prevent XSS attacks
		textEditorElement.innerHTML = sanitizeTextContent(element.content || '');
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

	// Capture the editor element immediately, don't rely on it in RAF
	const capturedEditor = textEditorElement;

	requestAnimationFrame(() => {
		// Use captured editor or query DOM as fallback
		const editor = capturedEditor || document.querySelector(`[data-editor-for="${element.id}"]`);
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

// Context menu handler
function handleContextMenu(e: MouseEvent) {
	e.preventDefault();
	e.stopPropagation();
	dispatch('contextmenu', {
		elementId: element.id,
		x: e.clientX,
		y: e.clientY
	});
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
	on:contextmenu={handleContextMenu}
	role="button"
	tabindex={isEditing ? -1 : 0}
>
		<!-- Selection indicator - blue outline overlay (Figma/Illustrator style) -->
		{#if isSelected && !isEditing && !isAutoLayoutChildDragging}
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
				on:keydown={(e) => {
					console.log('[text-editor] keydown:', e.key, 'isContentEditable:', e.target?.isContentEditable);
					handleKeyDown(e);
				}}
				on:input={() => {
					console.log('[text-editor] input event fired');
				}}
				on:beforeinput={() => {
					console.log('[text-editor] beforeinput fired');
				}}
				on:focus={() => {
					console.log('[text-editor] FOCUSED!');
				}}
			></div>
		{:else}
			<!-- Render element content based on type -->
			{#if element.type === 'img'}
			<img src={element.src || ''} alt={element.alt || ''} style={imageStyles} />
		{:else if element.type === 'a'}
			<a href={element.href || '#'}>{@html sanitizedContent || 'Link'}</a>
		{:else if element.type === 'button'}
			<button type="button">{@html sanitizedContent || 'Button'}</button>
		{:else if element.type === 'input'}
			<input type="text" placeholder={element.content || 'Input'} />
		{:else if element.type === 'textarea'}
			<textarea placeholder={element.content || 'Textarea'}></textarea>
		{:else if isTextElement && element.children.length === 0}
			<!-- Render text content for leaf text elements (p, h1-h6, span with no children) -->
			<div class="text-content" data-display-for={element.id}>
				{@html sanitizedContent}
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
	user-select: text; /* Re-enable text selection for editing */
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
	-webkit-user-select: text; /* Safari support */
	-moz-user-select: text; /* Firefox support */
	outline: 2px solid #3b82f6;
	outline-offset: 2px;
	white-space: pre-wrap;
	pointer-events: auto; /* Ensure editor receives pointer events */
	position: relative; /* Ensure stacking context */
	z-index: 1; /* Above other content */
}

.text-editor:focus {
	outline: 2px solid #3b82f6;
	outline-offset: 2px;
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
