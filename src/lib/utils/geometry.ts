import type { Element, DesignState } from '$lib/types/events';

/**
 * Get actual rendered size for auto-sized elements (inline-block text, auto layout)
 */
export function getActualSize(
    element: Element, 
    designState: DesignState, 
    viewport: { scale: number }
): { width: number; height: number } {
    // Check if element is in auto layout mode
    const parent = element.parentId ? designState.elements[element.parentId] : null;
    const parentHasAutoLayout = parent?.autoLayout?.enabled || false;
    const childIgnoresAutoLayout = element.autoLayout?.ignoreAutoLayout || false;
    const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;

    // IMPORTANT: Don't use getBoundingClientRect for rotated elements
    // because it returns the bounding box (which is larger), not the actual size
    const isRotated = element.rotation && element.rotation !== 0;

    // For rotated elements in auto layout, get the intrinsic size from CSS
    // (flexbox may have resized the element to fit the bounding box)
    if (isRotated && isInAutoLayout) {
        const domElement = document.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement;
        if (domElement) {
            // Get computed style to see the actual CSS width/height
            // computedStyle returns CSS pixel values (canvas units), NOT screen pixels
            // So we DON'T divide by viewport.scale here
            const computedStyle = window.getComputedStyle(domElement);
            const width = parseFloat(computedStyle.width);
            const height = parseFloat(computedStyle.height);

            // Only use computed size if it's valid
            if (!isNaN(width) && !isNaN(height)) {
                return { width, height };
            }
        }
    }

    // If element has display: inline-block OR is in auto layout (and not rotated), get actual rendered size from DOM
    if (!isRotated && (element.styles?.display === 'inline-block' || isInAutoLayout)) {
        const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
        if (domElement) {
            const rect = domElement.getBoundingClientRect();
            // Account for viewport scale
            return {
                width: rect.width / viewport.scale,
                height: rect.height / viewport.scale
            };
        }
    }
    // Otherwise use stored size
    return element.size;
}

/**
 * Get absolute position (relative to canvas, not parent)
 */
export function getAbsolutePosition(
    element: Element, 
    designState: DesignState, 
    viewport: { x: number; y: number; scale: number }
): { x: number; y: number } {
    // Check if element is in auto layout mode (parent has auto layout and child doesn't ignore it)
    const parent = element.parentId ? designState.elements[element.parentId] : null;
    const parentHasAutoLayout = parent?.autoLayout?.enabled || false;
    const childIgnoresAutoLayout = element.autoLayout?.ignoreAutoLayout || false;
    const isInAutoLayout = parentHasAutoLayout && !childIgnoresAutoLayout;
    const isRotated = element.rotation && element.rotation !== 0;

    console.log(`[Geometry Debug] Element ${element.id} (${element.type}):`, {
        parentId: element.parentId,
        parentFound: !!parent,
        parentAutoLayout: parent?.autoLayout,
        parentHasAutoLayout,
        childIgnoresAutoLayout,
        isInAutoLayout
    });

    // If in auto layout, get actual rendered position from DOM
    if (isInAutoLayout) {
        const domElement = document.querySelector(`[data-element-id="${element.id}"]`);
        if (domElement) {
            const rect = domElement.getBoundingClientRect();
            const canvasElement = document.querySelector('.canvas');
            if (canvasElement) {
                const canvasRect = canvasElement.getBoundingClientRect();

                // For rotated elements, getBoundingClientRect gives us the bounding box position
                // We need to calculate the actual element's top-left from the center
                if (isRotated) {
                    // Get bounding box center in canvas coordinates
                    const boundingCenterX = (rect.left + rect.width / 2 - canvasRect.left - viewport.x) / viewport.scale;
                    const boundingCenterY = (rect.top + rect.height / 2 - canvasRect.top - viewport.y) / viewport.scale;

                    // The bounding box center IS the element's center (rotation doesn't change the center)
                    // Calculate top-left from center using element's actual size (not bounding box size)
                    // IMPORTANT: Use getActualSize to get the same size that the selection UI will use
                    const actualSize = getActualSize(element, designState, viewport);
                    return {
                        x: boundingCenterX - actualSize.width / 2,
                        y: boundingCenterY - actualSize.height / 2
                    };
                }

                // For non-rotated elements, use top-left directly
                return {
                    x: (rect.left - canvasRect.left - viewport.x) / viewport.scale,
                    y: (rect.top - canvasRect.top - viewport.y) / viewport.scale
                };
            } else {
                console.warn('[Geometry Debug] Canvas element not found');
            }
        } else {
            console.warn(`[Geometry Debug] DOM element not found for ${element.id}`);
        }
    } else {
        // console.log(`[Geometry Debug] Not in auto layout: ${element.id}, parent: ${parentHasAutoLayout}, ignore: ${childIgnoresAutoLayout}`);
    }

    // Otherwise, use stored coordinates and traverse parent chain
    // IMPORTANT: We need to apply parent transforms (position AND rotation) correctly

    // Build ancestor chain from element to root
    const ancestors: Array<{ position: { x: number; y: number }; size: { width: number; height: number }; rotation: number }> = [];
    let currentElement = element;

    while (currentElement.parentId) {
        const parent = designState.elements[currentElement.parentId];
        if (!parent) break;

        ancestors.push({
            position: parent.position,
            size: parent.size,
            rotation: parent.rotation || 0
        });

        currentElement = parent;
    }

    // Start with element's local position
    let x = element.position.x;
    let y = element.position.y;

    // Apply transforms from immediate parent to root (reverse order)
    for (let i = 0; i < ancestors.length; i++) {
        const ancestor = ancestors[i];

        // If parent is rotated, we need to rotate the child's position around parent's center
        if (ancestor.rotation !== 0) {
            const centerX = ancestor.size.width / 2;
            const centerY = ancestor.size.height / 2;

            // Translate to parent's center
            const relX = x - centerX;
            const relY = y - centerY;

            // Apply rotation
            const angleRad = ancestor.rotation * (Math.PI / 180);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            const rotatedX = relX * cos - relY * sin;
            const rotatedY = relX * sin + relY * cos;

            // Translate back from center
            x = rotatedX + centerX;
            y = rotatedY + centerY;
        }

        // Add parent's position
        x += ancestor.position.x;
        y += ancestor.position.y;
    }

    return { x, y };
}

/**
 * Convert absolute position to parent-relative position
 * This properly handles rotated parent hierarchies
 */
export function absoluteToRelativePosition(
    element: Element, 
    absolutePos: { x: number; y: number },
    designState: DesignState
): { x: number; y: number } {
    // If element has no parent, absolute = relative
    if (!element.parentId) {
        return absolutePos;
    }

    // Get parent's absolute position
    const parent = designState.elements[element.parentId];
    if (!parent) {
        return absolutePos;
    }

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
        const nextParent = designState.elements[currentParent.parentId];
        if (!nextParent) break;
        currentParent = nextParent;
    }

    // Start with absolute position
    let x = absolutePos.x;
    let y = absolutePos.y;

    // Apply inverse transform for each ancestor (from root to immediate parent)
    for (const ancestor of ancestors) {
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
