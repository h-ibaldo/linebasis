import { test, expect } from '@playwright/test';

/**
 * Test: Hover border positioning for individual group elements
 *
 * This test verifies that when hovering over an individual element from a group,
 * the hover border appears at the correct position (not hundreds of pixels away).
 */

test.describe('Group Element Hover Positioning', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('hover border should be correctly positioned for individual group elements', async ({ page }) => {
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

		// 3. Hover over the first element (individual element from group)
		console.log('Hovering over individual element...');
		const elementSelector = `[data-element-id="${groupData.memberIds[0]}"]`;
		const element = await page.locator(elementSelector).first();
		await element.hover();
		await page.waitForTimeout(300);

		// 4. Check hover border position
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
				elementHeight: elementRect?.height || 0,
				distanceX: Math.abs(borderRect.left - (elementRect?.left || 0)),
				distanceY: Math.abs(borderRect.top - (elementRect?.top || 0))
			};
		}, groupData.memberIds[0]);

		console.log('Hover border position:', hoverBorderPosition);

		// ASSERTIONS
		expect(hoverBorderPosition).not.toBeNull();
		// Hover border should be very close to element (within 10px tolerance for borders)
		expect(hoverBorderPosition.distanceX).toBeLessThan(10);
		expect(hoverBorderPosition.distanceY).toBeLessThan(10);
		// Border size should match element size (within 5px tolerance)
		expect(Math.abs(hoverBorderPosition.borderWidth - hoverBorderPosition.elementWidth)).toBeLessThan(5);
		expect(Math.abs(hoverBorderPosition.borderHeight - hoverBorderPosition.elementHeight)).toBeLessThan(5);

		console.log('✅ TEST PASSED: Hover border is correctly positioned for individual group elements!');
	});
});

