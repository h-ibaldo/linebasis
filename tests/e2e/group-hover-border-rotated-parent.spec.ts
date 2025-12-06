import { test, expect } from '@playwright/test';

/**
 * Test to verify group hover border is correctly positioned when group is inside a rotated div
 */

test.describe('Group Hover Border Rotated Parent', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('group hover border should be correctly positioned when group is inside a rotated div', async ({ page }) => {
		// 1. Create a parent div with rotation
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

			// Rotate the parent div 45 degrees
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentDivId,
					rotation: 45
				}
			});

			return { parentDivId };
		});

		await page.waitForTimeout(500);

		// 2. Create a group with 2 elements inside the rotated parent div
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
			// Parent is at (500, 100) absolute with 45 degree rotation
			// We need to calculate where the group should appear on screen
			const groupLocalBounds = {
				x: 50, // wrapper position relative to parent
				y: 50,
				width: 200, // wrapper size
				height: 100
			};

			// Get canvas element to calculate screen position
			const canvas = document.querySelector('.canvas');
			const canvasRect = canvas?.getBoundingClientRect();
			
			// Get viewport info
			const viewport = (window as any).__viewport || { x: 0, y: 0, scale: 1 };
			
			// Calculate parent's absolute position
			const parentAbsPos = {
				x: parent.position.x,
				y: parent.position.y
			};
			
			// For rotated parent, we need to account for rotation
			// The group should be positioned relative to the parent's rotated coordinate system
			// But the border should appear at the correct screen position
			const parentCenterX = parentAbsPos.x + parent.size.width / 2;
			const parentCenterY = parentAbsPos.y + parent.size.height / 2;
			
			// Group's center in parent-relative coordinates
			const groupCenterLocalX = groupLocalBounds.x + groupLocalBounds.width / 2;
			const groupCenterLocalY = groupLocalBounds.y + groupLocalBounds.height / 2;
			
			// Convert to absolute coordinates (accounting for rotation)
			const rotationRad = (parent.rotation || 0) * (Math.PI / 180);
			const cos = Math.cos(rotationRad);
			const sin = Math.sin(rotationRad);
			
			// Offset from parent center
			const offsetX = groupCenterLocalX - parent.size.width / 2;
			const offsetY = groupCenterLocalY - parent.size.height / 2;
			
			// Rotate the offset
			const rotatedOffsetX = offsetX * cos - offsetY * sin;
			const rotatedOffsetY = offsetX * sin + offsetY * cos;
			
			// Absolute position of group center
			const groupCenterAbsX = parentCenterX + rotatedOffsetX;
			const groupCenterAbsY = parentCenterY + rotatedOffsetY;
			
			// Group bounds absolute (approximate - for rotated groups, bounds calculation is complex)
			const groupAbsBounds = {
				x: groupCenterAbsX - groupLocalBounds.width / 2,
				y: groupCenterAbsY - groupLocalBounds.height / 2,
				width: groupLocalBounds.width,
				height: groupLocalBounds.height
			};
			
			// Calculate expected screen position
			const expectedScreenX = (canvasRect?.left || 0) + viewport.x + groupAbsBounds.x * viewport.scale;
			const expectedScreenY = (canvasRect?.top || 0) + viewport.y + groupAbsBounds.y * viewport.scale;
			const expectedScreenWidth = groupAbsBounds.width * viewport.scale;
			const expectedScreenHeight = groupAbsBounds.height * viewport.scale;

			return {
				borderLeft: borderRect.left,
				borderTop: borderRect.top,
				borderWidth: borderRect.width,
				borderHeight: borderRect.height,
				expectedScreenX,
				expectedScreenY,
				expectedScreenWidth,
				expectedScreenHeight,
				groupAbsBounds,
				distanceX: Math.abs(borderRect.left - expectedScreenX),
				distanceY: Math.abs(borderRect.top - expectedScreenY),
				widthDiff: Math.abs(borderRect.width - expectedScreenWidth),
				heightDiff: Math.abs(borderRect.height - expectedScreenHeight)
			};
		}, { div1Id, div2Id, parentDivId });

		console.log('Hover border info:', hoverBorderInfo);

		// ASSERTIONS
		expect(hoverBorderInfo).not.toBeNull();
		// Border should be within 20px of expected position (accounting for rotation calculations)
		expect(hoverBorderInfo.distanceX).toBeLessThan(20);
		expect(hoverBorderInfo.distanceY).toBeLessThan(20);
		// Border size should match group size (within 5px tolerance)
		expect(hoverBorderInfo.widthDiff).toBeLessThan(5);
		expect(hoverBorderInfo.heightDiff).toBeLessThan(5);
	});
});

