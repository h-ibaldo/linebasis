import { test, expect } from '@playwright/test';

test.describe('Rotated Parent Child Drag', () => {
	test('should not jump when dragging child inside rotated parent', async ({ page }) => {
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

		// Create parent div, rotated 45 degrees
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 300, height: 300 },
					styles: {
						backgroundColor: '#e0e0e0',
						border: '2px solid black'
					}
				});

				// Rotate parent 45 degrees
				await rotateElement(id, 45);

				return id;
			},
			{ pageId }
		);

		console.log('Created parent div:', parentId);

		// Create child div inside rotated parent
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 150, height: 150 },
					styles: {
						backgroundColor: '#ff6b6b',
						border: '2px solid darkred'
					}
				});

				return id;
			},
			{ parentId, pageId }
		);

		console.log('Created child div:', childId);

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
		const endX = startX + 50; // Drag 50px to the right
		const endY = startY + 50; // Drag 50px down

		console.log(`Dragging child from (${startX}, ${startY}) to (${endX}, ${endY})`);

		// Perform drag
		await page.mouse.move(startX, startY);
		await page.mouse.down();

		// Check position immediately after mousedown (before any movement)
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

		// Element should NOT jump on mousedown
		expect(mousedownDeltaX).toBeLessThan(0.1);
		expect(mousedownDeltaY).toBeLessThan(0.1);

		// Continue with drag
		await page.mouse.move(endX, endY, { steps: 10 });
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

		// Element should have moved (drag worked)
		expect(Math.abs(totalDeltaX)).toBeGreaterThan(10);
		expect(Math.abs(totalDeltaY)).toBeGreaterThan(10);

		// Verify position is valid
		expect(isFinite(finalPos.x)).toBe(true);
		expect(isFinite(finalPos.y)).toBe(true);
		expect(isNaN(finalPos.x)).toBe(false);
		expect(isNaN(finalPos.y)).toBe(false);

		console.log('✓ Child element dragged correctly without jumping!');
	});
});
