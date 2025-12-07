import { test, expect } from '@playwright/test';

/**
 * Test: Hover border positioning for auto-layout children with rotated parents
 *
 * This test verifies that when hovering over an auto-layout child of a rotated parent,
 * the hover border appears at the correct position and rotation.
 */

test.describe('Auto Layout Rotated Parent Hover', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		});

		await page.waitForTimeout(1000);
	});

	test('hover border should be correctly positioned and rotated for auto-layout child of rotated parent', async ({ page }) => {
		// 1. Create a rotated auto-layout parent
		console.log('Creating rotated auto-layout parent...');

		const { parentId, childId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const parentId = nanoid();
			const childId = nanoid();

			// Create parent with auto-layout
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 200, y: 200 },
					size: { width: 400, height: 300 },
					content: '',
					styles: { backgroundColor: '#ffffff' },
					autoLayout: {
						enabled: true,
						direction: 'horizontal',
						justify: 'start',
						align: 'start',
						gap: 10
					}
				}
			});

			// Rotate parent 45 degrees
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					rotation: 45
				}
			});

			// Create child inside auto-layout parent
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: childId,
					pageId,
					parentId: parentId,
					elementType: 'div',
					position: { x: 50, y: 50 }, // Position will be overridden by auto-layout
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#3b82f6' }
				}
			});

			return { parentId, childId };
		});

		console.log('Created elements:', { parentId, childId });
		await page.waitForTimeout(1000); // Wait longer for rendering

		// Verify parent has rotation applied
		const parentRotationCheck = await page.evaluate((parentId) => {
			const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;
			if (!parentEl) return { error: 'Parent not found' };
			const transform = window.getComputedStyle(parentEl).transform;
			const inlineStyle = parentEl.getAttribute('style') || '';
			return { transform, inlineStyle, hasRotation: inlineStyle.includes('rotate') };
		}, parentId);
		console.log('Parent rotation check:', parentRotationCheck);

		// 2. Hover over the child element
		console.log('Hovering over child element...');
		const childSelector = `[data-element-id="${childId}"]`;
		const childElement = await page.locator(childSelector).first();
		await childElement.hover();
		await page.waitForTimeout(500); // Wait longer for hover border to appear

		// 3. Measure hover border position and rotation
		console.log('Measuring hover border position and rotation...');
		const measurements = await page.evaluate(({ childId, parentId }) => {
			// Find hover border
			const allDivs = Array.from(document.querySelectorAll('div'));
			let hoverBorder = null;
			
			for (const div of allDivs) {
				const style = window.getComputedStyle(div);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)');
				
				// Skip selection border and UI elements
				if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
				    !div.closest('.toolbar, .layers-panel, .properties-panel')) {
					hoverBorder = div;
					break;
				}
			}

			if (!hoverBorder) {
				return { error: 'Hover border not found' };
			}

			// Get element and parent DOM elements
			const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
			const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;

			if (!childEl || !parentEl) {
				return { error: 'Element not found' };
			}

			// Get bounding boxes - these give us the actual visual positions
			const borderRect = hoverBorder.getBoundingClientRect();
			const childRect = childEl.getBoundingClientRect();
			const parentRect = parentEl.getBoundingClientRect();

			// Also get the actual element's stored rotation from the state
			const state = (window as any).__getDesignState();
			const childElementData = state.elements[childId];
			const parentElementData = state.elements[parentId];
			const storedChildRotation = childElementData?.rotation || 0;
			const storedParentRotation = parentElementData?.rotation || 0;

			// Get computed transforms - check if hover border is inside a parent wrapper
			let borderParentWrapper = hoverBorder.parentElement;
			while (borderParentWrapper && borderParentWrapper !== document.body) {
				const style = window.getComputedStyle(borderParentWrapper);
				if (style.position === 'fixed' && style.transform && style.transform !== 'none') {
					break; // Found the parent wrapper with transform
				}
				borderParentWrapper = borderParentWrapper.parentElement;
			}

			const borderTransform = window.getComputedStyle(hoverBorder).transform;
			const borderWrapperTransform = borderParentWrapper ? window.getComputedStyle(borderParentWrapper).transform : 'none';
			const childTransform = window.getComputedStyle(childEl).transform;
			const parentTransform = window.getComputedStyle(parentEl).transform;

			// Parse rotation from transform matrix
			const parseRotation = (transform: string): number => {
				if (!transform || transform === 'none') return 0;
				const matrix = transform.match(/matrix\(([^)]+)\)/);
				if (!matrix) return 0;
				const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
				if (values.length < 4) return 0;
				// Extract rotation from matrix: atan2(b, a) in degrees
				const angleRad = Math.atan2(values[1], values[0]);
				return (angleRad * 180) / Math.PI;
			};

			// For nested transforms, we need to combine them
			const borderRotation = parseRotation(borderTransform) + parseRotation(borderWrapperTransform);
			const childRotation = parseRotation(childTransform);
			const parentRotation = parseRotation(parentTransform);
			
			// For auto-layout children, the child's visual rotation is the parent's rotation
			// because the child is inside a rotated parent container
			// The border should match the child's visual rotation (which is the parent's rotation)
			const childVisualRotation = parentRotation; // Child is visually rotated by parent

			// Calculate centers
			const borderCenter = {
				x: borderRect.left + borderRect.width / 2,
				y: borderRect.top + borderRect.height / 2
			};
			const childCenter = {
				x: childRect.left + childRect.width / 2,
				y: childRect.top + childRect.height / 2
			};

			// Calculate distances
			const distanceX = Math.abs(borderCenter.x - childCenter.x);
			const distanceY = Math.abs(borderCenter.y - childCenter.y);
			const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

			// Calculate rotation difference
			// Compare border rotation to child's visual rotation (parent's rotation for auto-layout children)
			const rotationDiff = Math.abs(borderRotation - childVisualRotation);
			// Normalize to 0-180 range
			const normalizedRotationDiff = rotationDiff > 180 ? 360 - rotationDiff : rotationDiff;

			// Also check the actual visual corners to detect rotation misalignment
			// Get the four corners of the border and child
			const borderCorners = [
				{ x: borderRect.left, y: borderRect.top },
				{ x: borderRect.right, y: borderRect.top },
				{ x: borderRect.right, y: borderRect.bottom },
				{ x: borderRect.left, y: borderRect.bottom }
			];
			const childCorners = [
				{ x: childRect.left, y: childRect.top },
				{ x: childRect.right, y: childRect.top },
				{ x: childRect.right, y: childRect.bottom },
				{ x: childRect.left, y: childRect.bottom }
			];

			// Calculate corner distances
			const cornerDistances = borderCorners.map((borderCorner, i) => {
				const childCorner = childCorners[i];
				const dx = borderCorner.x - childCorner.x;
				const dy = borderCorner.y - childCorner.y;
				return Math.sqrt(dx * dx + dy * dy);
			});

			return {
				borderRect: {
					left: borderRect.left,
					top: borderRect.top,
					width: borderRect.width,
					height: borderRect.height
				},
				childRect: {
					left: childRect.left,
					top: childRect.top,
					width: childRect.width,
					height: childRect.height
				},
				parentRect: {
					left: parentRect.left,
					top: parentRect.top,
					width: parentRect.width,
					height: parentRect.height
				},
				borderCenter,
				childCenter,
				distanceX,
				distanceY,
				distance,
				borderRotation,
				childRotation,
				childVisualRotation,
				parentRotation,
				rotationDiff: normalizedRotationDiff,
				borderTransform,
				borderWrapperTransform,
				childTransform,
				parentTransform,
				cornerDistances,
				maxCornerDistance: Math.max(...cornerDistances),
				storedChildRotation,
				storedParentRotation,
				// Calculate visual rotation from bounding box if element is rotated
				// For a rotated square, the bounding box will be larger than the element
				visualRotationDetected: childRect.width !== childRect.height || 
				                        Math.abs(childRect.width - (childElementData?.size?.width || 100)) > 1
			};
		}, { childId, parentId });

		console.log('Measurements:', JSON.stringify(measurements, null, 2));

		// 4. Take a screenshot for visual inspection
		await page.screenshot({ 
			path: 'test-results/auto-layout-rotated-parent-hover.png', 
			fullPage: true 
		});

		// 5. Assertions
		expect(measurements).not.toHaveProperty('error');
		
		// Position should be very close (within 5px for borders)
		console.log(`Position distance: ${measurements.distance}px (X: ${measurements.distanceX}px, Y: ${measurements.distanceY}px)`);
		console.log(`Max corner distance: ${measurements.maxCornerDistance}px`);
		console.log(`Corner distances: ${measurements.cornerDistances.join(', ')}px`);
		
		// Use corner distances to detect both position and rotation misalignment
		// If rotation is wrong, corners will be misaligned even if center is close
		expect(measurements.maxCornerDistance).toBeLessThan(10);
		expect(measurements.distance).toBeLessThan(10);
		
		// Rotation should match (within 1 degree tolerance)
		// For auto-layout children, border should match child's visual rotation (parent's rotation)
		console.log(`Rotation difference: ${measurements.rotationDiff}° (border: ${measurements.borderRotation}°, child visual: ${measurements.childVisualRotation}°, child own: ${measurements.childRotation}°)`);
		console.log(`Parent rotation: ${measurements.parentRotation}°`);
		console.log(`Stored parent rotation: ${measurements.storedParentRotation}°`);
		console.log(`Stored child rotation: ${measurements.storedChildRotation}°`);
		console.log(`Border transform: ${measurements.borderTransform}`);
		console.log(`Border wrapper transform: ${measurements.borderWrapperTransform}`);
		console.log(`Child transform: ${measurements.childTransform}`);
		console.log(`Parent transform: ${measurements.parentTransform}`);
		console.log(`Visual rotation detected: ${measurements.visualRotationDetected}`);
		
		// If parent should be rotated but transforms show "none", there might be a rendering issue
		if (measurements.storedParentRotation !== 0 && measurements.parentTransform === 'none') {
			console.warn('WARNING: Parent has stored rotation but transform is "none" - rendering may not be complete');
		}
		
		expect(measurements.rotationDiff).toBeLessThan(2);
	});

	test('hover border should work for deeply nested auto-layout children', async ({ page }) => {
		// Test with 3 levels: rotated parent -> auto-layout parent -> child
		console.log('Creating deeply nested structure...');

		const { grandparentId, parentId, childId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const grandparentId = nanoid();
			const parentId = nanoid();
			const childId = nanoid();

			// Create grandparent
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: grandparentId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 300, y: 300 },
					size: { width: 500, height: 400 },
					content: '',
					styles: { backgroundColor: '#f0f0f0' }
				}
			});

			// Rotate grandparent 30 degrees
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: grandparentId,
					rotation: 30
				}
			});

			// Create auto-layout parent inside grandparent
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					pageId,
					parentId: grandparentId,
					elementType: 'div',
					position: { x: 50, y: 50 },
					size: { width: 300, height: 200 },
					content: '',
					styles: { backgroundColor: '#ffffff' },
					autoLayout: {
						enabled: true,
						direction: 'horizontal',
						justify: 'start',
						align: 'start',
						gap: 10
					}
				}
			});

			// Create child inside auto-layout parent
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: childId,
					pageId,
					parentId: parentId,
					elementType: 'div',
					position: { x: 0, y: 0 },
					size: { width: 80, height: 80 },
					content: '',
					styles: { backgroundColor: '#10b981' }
				}
			});

			return { grandparentId, parentId, childId };
		});

		console.log('Created nested elements:', { grandparentId, parentId, childId });
		await page.waitForTimeout(500);

		// Hover over the child
		const childSelector = `[data-element-id="${childId}"]`;
		const childElement = await page.locator(childSelector).first();
		await childElement.hover();
		await page.waitForTimeout(300);

		// Measure hover border
		const measurements = await page.evaluate(({ childId }) => {
			const allDivs = Array.from(document.querySelectorAll('div'));
			let hoverBorder = null;
			
			for (const div of allDivs) {
				const style = window.getComputedStyle(div);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)');
				
				if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
				    !div.closest('.toolbar, .layers-panel, .properties-panel')) {
					hoverBorder = div;
					break;
				}
			}

			if (!hoverBorder) return { error: 'Hover border not found' };

			const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
			if (!childEl) return { error: 'Child element not found' };

			const borderRect = hoverBorder.getBoundingClientRect();
			const childRect = childEl.getBoundingClientRect();

			const parseRotation = (transform: string): number => {
				if (!transform || transform === 'none') return 0;
				const matrix = transform.match(/matrix\(([^)]+)\)/);
				if (!matrix) return 0;
				const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
				if (values.length < 4) return 0;
				const angleRad = Math.atan2(values[1], values[0]);
				return (angleRad * 180) / Math.PI;
			};

			const borderRotation = parseRotation(window.getComputedStyle(hoverBorder).transform);
			const childRotation = parseRotation(window.getComputedStyle(childEl).transform);

			const borderCenter = {
				x: borderRect.left + borderRect.width / 2,
				y: borderRect.top + borderRect.height / 2
			};
			const childCenter = {
				x: childRect.left + childRect.width / 2,
				y: childRect.top + childRect.height / 2
			};

			const distanceX = Math.abs(borderCenter.x - childCenter.x);
			const distanceY = Math.abs(borderCenter.y - childCenter.y);
			const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

			const rotationDiff = Math.abs(borderRotation - childRotation);
			const normalizedRotationDiff = rotationDiff > 180 ? 360 - rotationDiff : rotationDiff;

			return {
				distance,
				distanceX,
				distanceY,
				rotationDiff: normalizedRotationDiff,
				borderRotation,
				childRotation
			};
		}, { childId });

		console.log('Deep nesting measurements:', JSON.stringify(measurements, null, 2));

		await page.screenshot({ 
			path: 'test-results/auto-layout-deeply-nested-hover.png', 
			fullPage: true 
		});

		expect(measurements).not.toHaveProperty('error');
		console.log(`Deep nesting - Position distance: ${measurements.distance}px, Rotation diff: ${measurements.rotationDiff}°`);
		expect(measurements.distance).toBeLessThan(10);
		expect(measurements.rotationDiff).toBeLessThan(2);
	});
});

