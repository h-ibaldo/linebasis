import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper border should be hidden when dragging individual element
 *
 * This test verifies that when dragging an individual element from a group,
 * the wrapper's dotted border is hidden.
 */

test.describe('Group Wrapper Border During Drag', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper border should be hidden when dragging individual element from group', async ({ page }) => {
		// 1. Create two divs
		console.log('Creating two divs...');

		const { div1, div2 } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div1Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 100, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#3b82f6' }
				}
			});

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div2Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 200, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#ef4444' }
				}
			});

			return { div1: div1Id, div2: div2Id };
		});

		console.log('Created div1:', div1);
		console.log('Created div2:', div2);
		await page.waitForTimeout(500);

		// 2. Group the two divs
		console.log('Grouping elements...');
		const groupData = await page.evaluate(async (ids) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			const div1 = state.elements[ids.div1];
			const div2 = state.elements[ids.div2];

			// Calculate bounding box
			const minX = Math.min(div1.position.x, div2.position.x);
			const minY = Math.min(div1.position.y, div2.position.y);
			const maxX = Math.max(
				div1.position.x + div1.size.width,
				div2.position.x + div2.size.width
			);
			const maxY = Math.max(
				div1.position.y + div1.size.height,
				div2.position.y + div2.size.height
			);

			const groupId = nanoid();
			const wrapperId = nanoid();
			const pageId = Object.keys(state.pages)[0];

			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [ids.div1, ids.div2],
					wrapperPosition: { x: minX, y: minY },
					wrapperSize: { width: maxX - minX, height: maxY - minY },
					memberOffsets: {
						[ids.div1]: { x: div1.position.x - minX, y: div1.position.y - minY },
						[ids.div2]: { x: div2.position.x - minX, y: div2.position.y - minY }
					},
					parentId: null,
					pageId
				}
			});

			// Get the updated state
			const updatedState = (window as any).__getDesignState();
			const wrapper = updatedState.elements[wrapperId];
			const group = updatedState.groups[groupId];

			return {
				groupId,
				wrapperId,
				memberIds: group?.elementIds
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// 3. Select the first element (individual element from group) by clicking it
		console.log('Selecting individual element...');
		const elementSelector = `[data-element-id="${groupData.memberIds[0]}"]`;
		const element = await page.locator(elementSelector).first();
		await element.click({ force: true });
		await page.waitForTimeout(300);

		// 4. Check if wrapper border is visible when NOT dragging
		console.log('Checking wrapper border visibility (not dragging)...');
		const beforeDrag = await page.evaluate(() => {
			// Find all elements with selection-border class
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			const parentWrappers = Array.from(document.querySelectorAll('.parent-wrapper'));
			
			// Check if any parent wrapper is visible
			const visibleParentWrappers = parentWrappers.filter(wrapper => {
				const style = window.getComputedStyle(wrapper as HTMLElement);
				return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
			});

			return {
				selectionBordersCount: selectionBorders.length,
				parentWrappersCount: parentWrappers.length,
				visibleParentWrappersCount: visibleParentWrappers.length
			};
		});

		console.log('Before drag:', beforeDrag);

		// 5. Start dragging the element
		console.log('Starting drag...');
		const box = await element.boundingBox();
		
		if (!box) {
			throw new Error('Element not found');
		}

		// Start drag
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.waitForTimeout(100); // Wait for drag to start
		
		// Move mouse to simulate dragging
		await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
		await page.waitForTimeout(200); // Wait for drag state to update

		// 6. Check if wrapper border is hidden during drag
		console.log('Checking wrapper border visibility (during drag)...');
		
		// Take a screenshot to see what's visible
		await page.screenshot({ path: 'test-results/during-drag-screenshot.png', fullPage: true });
		
		const duringDrag = await page.evaluate((wrapperId) => {
			// Find all elements with selection-border class
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			const parentWrappers = Array.from(document.querySelectorAll('.parent-wrapper'));
			
			// Check if any parent wrapper is visible
			const visibleParentWrappers = parentWrappers.filter(wrapper => {
				const style = window.getComputedStyle(wrapper as HTMLElement);
				return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
			});

			// Check for wrapper element itself
			const wrapperElement = document.querySelector(`[data-element-id="${wrapperId}"]`) as HTMLElement;
			
			// Check wrapper element's computed style for borders
			let wrapperHasBorder = false;
			let wrapperBorderStyle = '';
			if (wrapperElement) {
				const style = window.getComputedStyle(wrapperElement);
				wrapperHasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				wrapperBorderStyle = style.borderStyle;
			}

			// Check for any blue borders (the selection border color) - only check canvas elements, not UI buttons
			const allElements = Array.from(document.querySelectorAll('.canvas-element, .selection-border, .parent-wrapper, [data-element-id]'));
			const blueBorders = allElements.filter(el => {
				// Skip UI buttons and other non-canvas elements
				if ((el as HTMLElement).closest('.toolbar, .layers-panel, .properties-panel')) {
					return false;
				}
				const style = window.getComputedStyle(el as HTMLElement);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)') || borderColor.includes('#3b82f6');
				return hasBorder && isBlue && style.display !== 'none' && style.visibility !== 'hidden';
			});

			// Get details about the blue border element
			const blueBorderDetails = blueBorders.map(el => {
				const id = (el as HTMLElement).getAttribute('data-element-id') || '';
				const className = el.className || '';
				const tagName = el.tagName || '';
				const style = window.getComputedStyle(el as HTMLElement);
				return {
					id,
					className,
					tagName,
					borderColor: style.borderColor,
					borderWidth: style.borderWidth,
					borderStyle: style.borderStyle
				};
			});

			return {
				selectionBordersCount: selectionBorders.length,
				parentWrappersCount: parentWrappers.length,
				visibleParentWrappersCount: visibleParentWrappers.length,
				wrapperElementFound: !!wrapperElement,
				wrapperHasBorder,
				wrapperBorderStyle,
				blueBordersCount: blueBorders.length,
				blueBorderDetails
			};
		}, groupData.wrapperId);

		console.log('During drag:', duringDrag);
		if (duringDrag.blueBordersCount > 0) {
			console.log('Blue border details:', JSON.stringify(duringDrag.blueBorderDetails, null, 2));
		}

		// Release mouse
		await page.mouse.up();
		await page.waitForTimeout(200);

		// ASSERTIONS
		// The wrapper border (parent-wrapper) should be hidden during drag
		expect(duringDrag.visibleParentWrappersCount).toBe(0);
		console.log('✓ Parent wrapper div is hidden during drag');

		// Wrapper element itself should not have a border
		expect(duringDrag.wrapperHasBorder).toBe(false);
		console.log('✓ Wrapper element has no border');

		// There should be no blue borders visible (selection border color)
		// This ensures no wrapper border is showing
		expect(duringDrag.blueBordersCount).toBe(0);
		console.log('✓ No blue borders visible during drag');
		
		console.log('✅ TEST PASSED: Wrapper border is hidden when dragging individual element!');
	});
});

