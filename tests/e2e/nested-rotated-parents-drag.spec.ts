import { test, expect } from '@playwright/test';

test.describe('Nested Rotated Parents Drag', () => {
	test('should not jump when dragging child with nested rotated parents', async ({ page }) => {
		await page.goto('http://localhost:5175');

		// Wait for canvas to be ready
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get the actual page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0];
		});

		console.log('Using page ID:', pageId);

		// Create grandparent div, rotated 30 degrees
		const grandparentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 100, y: 100 },
					size: { width: 400, height: 400 },
					styles: {
						backgroundColor: '#f0f0f0',
						border: '3px solid gray'
					}
				});

				// Rotate grandparent 30 degrees
				await rotateElement(id, 30);

				return id;
			},
			{ pageId }
		);

		console.log('Created grandparent div:', grandparentId);

		// Create parent div inside grandparent, rotated 45 degrees
		const parentId = await page.evaluate(
			async ({ grandparentId, pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: grandparentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 250, height: 250 },
					styles: {
						backgroundColor: '#e0e0e0',
						border: '2px solid black'
					}
				});

				// Rotate parent 45 degrees (total: 75 degrees from root)
				await rotateElement(id, 45);

				return id;
			},
			{ grandparentId, pageId }
		);

		console.log('Created parent div:', parentId);

		// Create child div inside parent (no rotation on child itself)
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 40, y: 40 },
					size: { width: 120, height: 120 },
					styles: {
						backgroundColor: '#ff6b6b',
						border: '2px solid darkred'
					}
				});

				return id;
			},
			{ parentId, pageId }
		);

		console.log('Created child div (nested 2 levels deep):', childId);

		// Wait for rendering
		await page.waitForTimeout(500);

		// Get child's initial absolute position
		const initialPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, childId);

		console.log('Initial child position (absolute):', initialPos);

		// Get child's DOM position before drag
		const childElement = await page.locator(`[data-element-id="${childId}"]`).first();
		const initialRect = await childElement.boundingBox();

		if (!initialRect) {
			throw new Error('Could not get child element bounding box');
		}

		console.log('Initial child DOM rect:', initialRect);

		// Start drag from center of child
		const startX = initialRect.x + initialRect.width / 2;
		const startY = initialRect.y + initialRect.height / 2;

		console.log(`Clicking child at (${startX}, ${startY})`);

		// Mousedown and check for jump
		await page.mouse.move(startX, startY);
		await page.mouse.down();

		// Check position immediately after mousedown
		const afterMouseDownPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, childId);

		console.log('After mousedown position (absolute):', afterMouseDownPos);

		// Check if element jumped on mousedown
		const mousedownDeltaX = Math.abs(afterMouseDownPos.x - initialPos.x);
		const mousedownDeltaY = Math.abs(afterMouseDownPos.y - initialPos.y);
		console.log(`Mousedown delta: (${mousedownDeltaX}, ${mousedownDeltaY})`);

		// Element should NOT jump on mousedown (allow 0.5px tolerance for floating point)
		if (mousedownDeltaX > 0.5 || mousedownDeltaY > 0.5) {
			console.error('❌ ELEMENT JUMPED ON MOUSEDOWN!');
			console.error(`Jump distance: (${mousedownDeltaX}, ${mousedownDeltaY})`);
		}

		expect(mousedownDeltaX).toBeLessThan(0.5);
		expect(mousedownDeltaY).toBeLessThan(0.5);

		// Now drag it
		const endX = startX + 30;
		const endY = startY + 30;

		await page.mouse.move(endX, endY, { steps: 5 });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Get final position
		const finalPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, childId);

		console.log('Final child position (absolute):', finalPos);

		// Calculate total movement
		const totalDeltaX = finalPos.x - initialPos.x;
		const totalDeltaY = finalPos.y - initialPos.y;

		console.log(`Total delta: (${totalDeltaX}, ${totalDeltaY})`);

		// Element should have moved
		expect(Math.abs(totalDeltaX)).toBeGreaterThan(5);
		expect(Math.abs(totalDeltaY)).toBeGreaterThan(5);

		// Verify position is valid
		expect(isFinite(finalPos.x)).toBe(true);
		expect(isFinite(finalPos.y)).toBe(true);

		console.log('✓ Child with nested rotated parents dragged correctly!');
	});
});
