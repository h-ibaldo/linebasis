import { test, expect } from '@playwright/test';

test.describe('Deep Nested Rotated Drag', () => {
	test('should not jump when dragging great-grandchild with deeply nested rotated parents', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			return Object.keys(state.pages)[0];
		});

		// Create great-great-grandparent (root, rotated 30 degrees)
		const greatGreatGrandparentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 100, y: 100 },
					size: { width: 500, height: 500 },
					styles: { backgroundColor: '#f0f0f0', border: '2px solid #ccc' }
				});
				await rotateElement(id, 30);
				return id;
			},
			{ pageId }
		);

		// Create great-grandparent (rotated 45 degrees)
		const greatGrandparentId = await page.evaluate(
			async ({ greatGreatGrandparentId, pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: greatGreatGrandparentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 400, height: 400 },
					styles: { backgroundColor: '#e0e0e0', border: '2px solid #999' }
				});
				await rotateElement(id, 45);
				return id;
			},
			{ greatGreatGrandparentId, pageId }
		);

		// Create grandparent (rotated 60 degrees)
		const grandparentId = await page.evaluate(
			async ({ greatGrandparentId, pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: greatGrandparentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 300, height: 300 },
					styles: { backgroundColor: '#d0d0d0', border: '2px solid #666' }
				});
				await rotateElement(id, 60);
				return id;
			},
			{ greatGrandparentId, pageId }
		);

		// Create parent (rotated 90 degrees)
		const parentId = await page.evaluate(
			async ({ grandparentId, pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: grandparentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 200, height: 200 },
					styles: { backgroundColor: '#c0c0c0', border: '2px solid #333' }
				});
				await rotateElement(id, 90);
				return id;
			},
			{ grandparentId, pageId }
		);

		// Create great-grandchild (the element we'll drag)
		const greatGrandchildId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 25, y: 25 },
					size: { width: 100, height: 100 },
					styles: { backgroundColor: '#ff6b6b', border: '2px solid darkred' }
				});
			},
			{ parentId, pageId }
		);

		await page.waitForTimeout(500);

		// Get initial position
		const initialPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, greatGrandchildId);

		console.log('Initial great-grandchild position (absolute):', initialPos);

		// Get DOM position before drag
		const element = await page.locator(`[data-element-id="${greatGrandchildId}"]`).first();
		const initialRect = await element.boundingBox();
		if (!initialRect) throw new Error('Element not found');

		const startX = initialRect.x + initialRect.width / 2;
		const startY = initialRect.y + initialRect.height / 2;

		// Click to select
		await element.click();
		await page.waitForTimeout(100);

		// Start drag
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Check position after mousedown
		const afterMouseDownPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, greatGrandchildId);

		console.log('After mousedown position (absolute):', afterMouseDownPos);

		// Check if element jumped on mousedown
		const mousedownDeltaX = Math.abs(afterMouseDownPos.x - initialPos.x);
		const mousedownDeltaY = Math.abs(afterMouseDownPos.y - initialPos.y);
		console.log(`Mousedown delta: (${mousedownDeltaX}, ${mousedownDeltaY})`);

		// Element should NOT jump on mousedown
		expect(mousedownDeltaX).toBeLessThan(0.5);
		expect(mousedownDeltaY).toBeLessThan(0.5);

		// Drag it
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
		}, greatGrandchildId);

		console.log('Final great-grandchild position (absolute):', finalPos);

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

		console.log('✓ Great-grandchild with deeply nested rotated parents dragged correctly!');
	});
});

