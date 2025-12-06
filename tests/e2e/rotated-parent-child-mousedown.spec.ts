import { test, expect } from '@playwright/test';

test.describe('Rotated Parent Child Mousedown', () => {
	test('should not jump when clicking on child inside rotated parent', async ({ page }) => {
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

		// Get child's DOM position before click
		const childElement = await page.locator(`[data-element-id="${childId}"]`).first();
		const initialRect = await childElement.boundingBox();

		if (!initialRect) {
			throw new Error('Could not get child element bounding box');
		}

		console.log('Initial child DOM rect:', initialRect);

		// Click on the child element (this should NOT cause it to jump)
		const clickX = initialRect.x + initialRect.width / 2;
		const clickY = initialRect.y + initialRect.height / 2;

		console.log(`Clicking child at screen position: (${clickX}, ${clickY})`);

		await page.mouse.click(clickX, clickY);

		// Wait a bit for any potential jump to happen
		await page.waitForTimeout(100);

		// Get child's position after click
		const afterClickPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];
			const { getAbsolutePosition } = (window as any).__coordinates;
			return getAbsolutePosition(element, state);
		}, childId);

		console.log('After click position (absolute):', afterClickPos);

		// Get child's DOM position after click
		const afterClickRect = await childElement.boundingBox();

		if (!afterClickRect) {
			throw new Error('Could not get child element bounding box after click');
		}

		console.log('After click DOM rect:', afterClickRect);

		// The position should NOT have changed
		const deltaX = Math.abs(afterClickPos.x - initialPos.x);
		const deltaY = Math.abs(afterClickPos.y - initialPos.y);

		console.log(`Position delta: (${deltaX}, ${deltaY})`);

		// Allow a tiny tolerance for floating point errors (0.1px)
		expect(deltaX).toBeLessThan(0.1);
		expect(deltaY).toBeLessThan(0.1);

		// Also check DOM position hasn't changed significantly
		const domDeltaX = Math.abs(afterClickRect.x - initialRect.x);
		const domDeltaY = Math.abs(afterClickRect.y - initialRect.y);

		console.log(`DOM delta: (${domDeltaX}, ${domDeltaY})`);

		// DOM position can have slight changes due to selection UI, but should be minimal
		expect(domDeltaX).toBeLessThan(5);
		expect(domDeltaY).toBeLessThan(5);

		console.log('✓ Child element did NOT jump on mousedown!');
	});
});
