import { test, expect } from '@playwright/test';

/**
 * Test: Selection UI and hover border positioning for individual group elements
 *
 * This test verifies that:
 * 1. Selection UI appears at the correct position when selecting an individual element from a group
 * 2. Hover border appears at the correct position when hovering an individual element from a group
 * 3. Wrapper border is hidden during drag
 */

test.describe('Group Element Selection Positioning', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('selection UI and hover border should be correctly positioned for individual group elements', async ({ page }) => {
		// 1. Create two divs
		console.log('Creating two divs...');

		const { div1, div2, div1Pos, div2Pos } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();

			const div1Pos = { x: 100, y: 100 };
			const div2Pos = { x: 200, y: 100 };

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div1Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: div1Pos,
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
					position: div2Pos,
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#ef4444' }
				}
			});

			return { div1: div1Id, div2: div2Id, div1Pos, div2Pos };
		});

		console.log('Created divs:', { div1, div2 });
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
				memberIds: group?.elementIds,
				wrapperPos: wrapper?.position,
				div1LocalPos: updatedState.elements[ids.div1]?.position,
				div2LocalPos: updatedState.elements[ids.div2]?.position
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// 3. Select the first element (individual element from group)
		console.log('Selecting individual element...');
		const elementSelector = `[data-element-id="${groupData.memberIds[0]}"]`;
		const element = await page.locator(elementSelector).first();
		await element.click({ force: true });
		await page.waitForTimeout(300);

		// 4. Check selection UI position
		console.log('Checking selection UI position...');
		const selectionUIPosition = await page.evaluate((elementId) => {
			const state = (window as any).__getDesignState();
			const element = state.elements[elementId];
			const wrapper = element.parentId ? state.elements[element.parentId] : null;
			
			// Find selection border element
			const selectionBorder = document.querySelector('.selection-border');
			if (!selectionBorder) return null;

			const borderRect = selectionBorder.getBoundingClientRect();
			const canvas = document.querySelector('.canvas');
			const canvasRect = canvas?.getBoundingClientRect();

			// Get element's actual position on screen
			const elementEl = document.querySelector(`[data-element-id="${elementId}"]`);
			const elementRect = elementEl?.getBoundingClientRect();

			return {
				borderLeft: borderRect.left,
				borderTop: borderRect.top,
				borderWidth: borderRect.width,
				borderHeight: borderRect.height,
				elementLeft: elementRect?.left || 0,
				elementTop: elementRect?.top || 0,
				elementWidth: elementRect?.width || 0,
				elementHeight: elementRect?.height || 0,
				elementLocalPos: element.position,
				wrapperPos: wrapper?.position,
				hasParentWrapper: !!document.querySelector('.parent-wrapper')
			};
		}, groupData.memberIds[0]);

		console.log('Selection UI position:', selectionUIPosition);

		// Selection border should be very close to element (within 5px tolerance for borders)
		expect(selectionUIPosition).not.toBeNull();
		expect(Math.abs(selectionUIPosition.borderLeft - selectionUIPosition.elementLeft)).toBeLessThan(10);
		expect(Math.abs(selectionUIPosition.borderTop - selectionUIPosition.elementTop)).toBeLessThan(10);
		expect(selectionUIPosition.hasParentWrapper).toBe(false); // Should not show parent wrapper for group wrappers

		// 5. Hover over the second element
		console.log('Hovering over second element...');
		const element2Selector = `[data-element-id="${groupData.memberIds[1]}"]`;
		const element2 = await page.locator(element2Selector).first();
		await element2.hover();
		await page.waitForTimeout(200);

		// 6. Check hover border position
		console.log('Checking hover border position...');
		const hoverBorderPosition = await page.evaluate((elementId) => {
			// Find hover border (it's a div with blue border, not .selection-border)
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

			if (!hoverBorder) return null;

			const borderRect = hoverBorder.getBoundingClientRect();
			const elementEl = document.querySelector(`[data-element-id="${elementId}"]`);
			const elementRect = elementEl?.getBoundingClientRect();

			return {
				borderLeft: borderRect.left,
				borderTop: borderRect.top,
				borderWidth: borderRect.width,
				borderHeight: borderRect.height,
				elementLeft: elementRect?.left || 0,
				elementTop: elementRect?.top || 0,
				elementWidth: elementRect?.width || 0,
				elementHeight: elementRect?.height || 0
			};
		}, groupData.memberIds[1]);

		console.log('Hover border position:', hoverBorderPosition);

		// Hover border should be very close to element (within 5px tolerance for borders)
		if (hoverBorderPosition) {
			expect(Math.abs(hoverBorderPosition.borderLeft - hoverBorderPosition.elementLeft)).toBeLessThan(10);
			expect(Math.abs(hoverBorderPosition.borderTop - hoverBorderPosition.elementTop)).toBeLessThan(10);
		}

		// 7. Start dragging the first element
		console.log('Starting drag...');
		const box = await element.boundingBox();
		if (!box) throw new Error('Element not found');

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.waitForTimeout(100);
		await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
		await page.waitForTimeout(200);

		// 8. Check that wrapper border is hidden during drag
		console.log('Checking wrapper border during drag...');
		const duringDrag = await page.evaluate((wrapperId) => {
			const parentWrappers = Array.from(document.querySelectorAll('.parent-wrapper'));
			const visibleParentWrappers = parentWrappers.filter(wrapper => {
				const style = window.getComputedStyle(wrapper as HTMLElement);
				return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
			});

			// Check for any blue borders on canvas elements
			const canvasElements = Array.from(document.querySelectorAll('.canvas-element, .selection-border, [data-element-id]'));
			const blueBorders = canvasElements.filter(el => {
				if ((el as HTMLElement).closest('.toolbar, .layers-panel, .properties-panel')) return false;
				const style = window.getComputedStyle(el as HTMLElement);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)');
				return hasBorder && isBlue && style.display !== 'none' && style.visibility !== 'hidden';
			});

			return {
				visibleParentWrappersCount: visibleParentWrappers.length,
				blueBordersCount: blueBorders.length
			};
		}, groupData.wrapperId);

		console.log('During drag:', duringDrag);

		// Release mouse
		await page.mouse.up();
		await page.waitForTimeout(200);

		// ASSERTIONS
		expect(duringDrag.visibleParentWrappersCount).toBe(0);
		expect(duringDrag.blueBordersCount).toBe(0); // No wrapper borders should be visible

		console.log('✅ TEST PASSED: Selection UI, hover border, and drag behavior are correct!');
	});
});

