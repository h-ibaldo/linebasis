import { test, expect } from '@playwright/test';

/**
 * Test to verify group hover border is correctly positioned
 */

test.describe('Group Hover Border Positioning', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('group hover border should be correctly positioned when group is at root level', async ({ page }) => {
		// 1. Create a group with 2 elements at root level
		const { wrapperId, div1Id, div2Id } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();
			const groupId = nanoid();
			const wrapperId = nanoid();

			// Create two divs
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

			// Group them
			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [div1Id, div2Id],
					wrapperPosition: { x: 100, y: 100 },
					wrapperSize: { width: 200, height: 100 },
					memberOffsets: {
						[div1Id]: { x: 0, y: 0 },
						[div2Id]: { x: 100, y: 0 }
					},
					parentId: null,
					pageId
				}
			});

			return { wrapperId, div1Id, div2Id };
		});

		await page.waitForTimeout(500);

		// 2. Hover over one of the group elements
		const elementSelector = `[data-element-id="${div1Id}"]`;
		const element = await page.locator(elementSelector).first();
		await element.hover();
		await page.waitForTimeout(300);

		// 3. Find the hover border and check its position
		const hoverBorderInfo = await page.evaluate(({ div1Id, div2Id }) => {
			// Find hover border (blue border div)
			const allDivs = Array.from(document.querySelectorAll('div'));
			let hoverBorder = null;
			
			for (const div of allDivs) {
				const style = window.getComputedStyle(div);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)') || borderColor.includes('#3b82f6');
				
				// Skip selection border and UI elements
				if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
				    !div.closest('.toolbar, .layers-panel, .properties-panel')) {
					hoverBorder = div;
					break;
				}
			}

			if (!hoverBorder) return null;

			const borderRect = hoverBorder.getBoundingClientRect();
			
			// Get group bounds from state
			const state = (window as any).__getDesignState();
			const div1 = state.elements[div1Id];
			const div2 = state.elements[div2Id];
			
			// Calculate group bounds (wrapper bounds)
			const groupBounds = {
				x: 100, // wrapper position
				y: 100,
				width: 200, // wrapper size
				height: 100
			};

			// Get canvas element to calculate screen position
			const canvas = document.querySelector('.canvas');
			const canvasRect = canvas?.getBoundingClientRect();
			
			// Get viewport info
			const viewport = (window as any).__viewport || { x: 0, y: 0, scale: 1 };
			
			// Calculate expected screen position
			const expectedScreenX = (canvasRect?.left || 0) + viewport.x + groupBounds.x * viewport.scale;
			const expectedScreenY = (canvasRect?.top || 0) + viewport.y + groupBounds.y * viewport.scale;
			const expectedScreenWidth = groupBounds.width * viewport.scale;
			const expectedScreenHeight = groupBounds.height * viewport.scale;

			return {
				borderLeft: borderRect.left,
				borderTop: borderRect.top,
				borderWidth: borderRect.width,
				borderHeight: borderRect.height,
				expectedScreenX,
				expectedScreenY,
				expectedScreenWidth,
				expectedScreenHeight,
				distanceX: Math.abs(borderRect.left - expectedScreenX),
				distanceY: Math.abs(borderRect.top - expectedScreenY),
				widthDiff: Math.abs(borderRect.width - expectedScreenWidth),
				heightDiff: Math.abs(borderRect.height - expectedScreenHeight)
			};
		}, { div1Id, div2Id });

		console.log('Hover border info:', hoverBorderInfo);

		// ASSERTIONS
		expect(hoverBorderInfo).not.toBeNull();
		// Border should be within 10px of expected position (accounting for viewport transforms)
		expect(hoverBorderInfo.distanceX).toBeLessThan(10);
		expect(hoverBorderInfo.distanceY).toBeLessThan(10);
		// Border size should match group size (within 5px tolerance)
		expect(hoverBorderInfo.widthDiff).toBeLessThan(5);
		expect(hoverBorderInfo.heightDiff).toBeLessThan(5);
	});

	test('group hover border should be correctly positioned when group is inside a div', async ({ page }) => {
		// 1. Create a parent div
		const { parentDivId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const parentDivId = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentDivId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 500, y: 100 },
					size: { width: 400, height: 400 },
					content: '',
					styles: { backgroundColor: '#e5e7eb', border: '2px solid #9ca3af' }
				}
			});

			return { parentDivId };
		});

		await page.waitForTimeout(500);

		// 2. Create a group with 2 elements inside the parent div
		const { wrapperId, div1Id, div2Id } = await page.evaluate(async ({ parentDivId }) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();
			const groupId = nanoid();
			const wrapperId = nanoid();

			// Create two divs inside parent
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div1Id,
					pageId,
					parentId: parentDivId,
					elementType: 'div',
					position: { x: 50, y: 50 },
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
					parentId: parentDivId,
					elementType: 'div',
					position: { x: 150, y: 50 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#ef4444' }
				}
			});

			// Group them
			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [div1Id, div2Id],
					wrapperPosition: { x: 50, y: 50 },
					wrapperSize: { width: 200, height: 100 },
					memberOffsets: {
						[div1Id]: { x: 0, y: 0 },
						[div2Id]: { x: 100, y: 0 }
					},
					parentId: parentDivId,
					pageId
				}
			});

			return { wrapperId, div1Id, div2Id };
		}, { parentDivId });

		await page.waitForTimeout(500);

		// 3. Hover over one of the group elements
		const elementSelector = `[data-element-id="${div1Id}"]`;
		const element = await page.locator(elementSelector).first();
		await element.hover();
		await page.waitForTimeout(300);

		// 4. Find the hover border and check its position
		const hoverBorderInfo = await page.evaluate(({ div1Id, div2Id, parentDivId }) => {
			// Find hover border (blue border div)
			const allDivs = Array.from(document.querySelectorAll('div'));
			let hoverBorder = null;
			
			for (const div of allDivs) {
				const style = window.getComputedStyle(div);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)') || borderColor.includes('#3b82f6');
				
				// Skip selection border and UI elements
				if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
				    !div.closest('.toolbar, .layers-panel, .properties-panel')) {
					hoverBorder = div;
					break;
				}
			}

			if (!hoverBorder) return null;

			const borderRect = hoverBorder.getBoundingClientRect();
			
			// Get group bounds from state
			const state = (window as any).__getDesignState();
			const parent = state.elements[parentDivId];
			const div1 = state.elements[div1Id];
			const div2 = state.elements[div2Id];
			
			// Group wrapper is at (50, 50) relative to parent
			// Parent is at (500, 100) absolute
			// So group absolute position is (500 + 50, 100 + 50) = (550, 150)
			const groupAbsoluteBounds = {
				x: parent.position.x + 50, // wrapper position relative to parent + parent position
				y: parent.position.y + 50,
				width: 200, // wrapper size
				height: 100
			};

			// Get canvas element to calculate screen position
			const canvas = document.querySelector('.canvas');
			const canvasRect = canvas?.getBoundingClientRect();
			
			// Get viewport info
			const viewport = (window as any).__viewport || { x: 0, y: 0, scale: 1 };
			
			// Calculate expected screen position
			const expectedScreenX = (canvasRect?.left || 0) + viewport.x + groupAbsoluteBounds.x * viewport.scale;
			const expectedScreenY = (canvasRect?.top || 0) + viewport.y + groupAbsoluteBounds.y * viewport.scale;
			const expectedScreenWidth = groupAbsoluteBounds.width * viewport.scale;
			const expectedScreenHeight = groupAbsoluteBounds.height * viewport.scale;

			return {
				borderLeft: borderRect.left,
				borderTop: borderRect.top,
				borderWidth: borderRect.width,
				borderHeight: borderRect.height,
				expectedScreenX,
				expectedScreenY,
				expectedScreenWidth,
				expectedScreenHeight,
				groupAbsoluteBounds,
				distanceX: Math.abs(borderRect.left - expectedScreenX),
				distanceY: Math.abs(borderRect.top - expectedScreenY),
				widthDiff: Math.abs(borderRect.width - expectedScreenWidth),
				heightDiff: Math.abs(borderRect.height - expectedScreenHeight)
			};
		}, { div1Id, div2Id, parentDivId });

		console.log('Hover border info:', hoverBorderInfo);

		// ASSERTIONS
		expect(hoverBorderInfo).not.toBeNull();
		// Border should be within 10px of expected position (accounting for viewport transforms)
		expect(hoverBorderInfo.distanceX).toBeLessThan(10);
		expect(hoverBorderInfo.distanceY).toBeLessThan(10);
		// Border size should match group size (within 5px tolerance)
		expect(hoverBorderInfo.widthDiff).toBeLessThan(5);
		expect(hoverBorderInfo.heightDiff).toBeLessThan(5);
	});
});
