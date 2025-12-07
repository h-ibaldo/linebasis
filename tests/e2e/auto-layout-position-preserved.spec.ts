import { test, expect } from '@playwright/test';

test.describe('Auto Layout Position Preservation', () => {
	test('should preserve position (0,0) for auto-layout children after drag', async ({ page }) => {
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

		// Create auto-layout parent
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 100, y: 100 },
					size: { width: 400, height: 400 },
					styles: {
						backgroundColor: '#f0f0f0',
						border: '2px solid black'
					},
					autoLayout: {
						enabled: true,
						direction: 'row',
						gap: '10px',
						justifyContent: 'flex-start',
						alignItems: 'flex-start'
					}
				});

				return id;
			},
			{ pageId }
		);

		console.log('Created auto-layout parent:', parentId);

		// Create two child divs inside auto-layout parent
		const child1Id = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 100, height: 100 },
					styles: {
						backgroundColor: '#ff6b6b',
						border: '2px solid darkred'
					}
				});

				return id;
			},
			{ parentId, pageId }
		);

		const child2Id = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 100, height: 100 },
					styles: {
						backgroundColor: '#51cf66',
						border: '2px solid darkgreen'
					}
				});

				return id;
			},
			{ parentId, pageId }
		);

		console.log('Created child1:', child1Id);
		console.log('Created child2:', child2Id);

		// Wait for rendering
		await page.waitForTimeout(500);

		// Verify initial positions are (0, 0)
		const initialPositions = await page.evaluate(
			({ child1Id, child2Id }) => {
				const state = (window as any).__designStore.designState;
				return {
					child1: state.elements[child1Id].position,
					child2: state.elements[child2Id].position
				};
			},
			{ child1Id, child2Id }
		);

		console.log('Initial stored positions:', initialPositions);
		expect(initialPositions.child1.x).toBe(0);
		expect(initialPositions.child1.y).toBe(0);
		expect(initialPositions.child2.x).toBe(0);
		expect(initialPositions.child2.y).toBe(0);

		// Select both children
		await page.evaluate(
			({ child1Id, child2Id }) => {
				const { selectElements } = (window as any).__designStore;
				selectElements([child1Id, child2Id]);
			},
			{ child1Id, child2Id }
		);

		await page.waitForTimeout(100);

		// Get child1 DOM position
		const child1Element = await page.locator(`[data-element-id="${child1Id}"]`).first();
		const child1Rect = await child1Element.boundingBox();

		if (!child1Rect) {
			throw new Error('Could not get child1 bounding box');
		}

		// Drag both children
		const startX = child1Rect.x + child1Rect.width / 2;
		const startY = child1Rect.y + child1Rect.height / 2;
		const endX = startX + 50;
		const endY = startY + 50;

		console.log(`Dragging children from (${startX}, ${startY}) to (${endX}, ${endY})`);

		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(endX, endY, { steps: 5 });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Check if the fix was triggered
		const fixTriggered = await page.evaluate(() => {
			return (window as any).AUTO_LAYOUT_FIX_TRIGGERED || false;
		});

		console.log('AUTO_LAYOUT_FIX_TRIGGERED:', fixTriggered);

		// Verify positions are STILL (0, 0) after drag
		const finalPositions = await page.evaluate(
			({ child1Id, child2Id }) => {
				const state = (window as any).__designStore.designState;
				return {
					child1: state.elements[child1Id].position,
					child2: state.elements[child2Id].position
				};
			},
			{ child1Id, child2Id }
		);

		console.log('Final stored positions after drag:', finalPositions);

		// CRITICAL: Auto-layout children should ALWAYS have position (0, 0)
		// because flexbox controls their position, not stored coordinates
		expect(finalPositions.child1.x).toBe(0);
		expect(finalPositions.child1.y).toBe(0);
		expect(finalPositions.child2.x).toBe(0);
		expect(finalPositions.child2.y).toBe(0);

		console.log('✓ Auto-layout children positions preserved at (0, 0) after drag!');

		// Now test that positions remain (0, 0) after page refresh
		console.log('Refreshing page...');
		await page.reload();
		await page.waitForSelector('.canvas', { timeout: 5000 });
		await page.waitForTimeout(500);

		// Verify positions are STILL (0, 0) after refresh
		const positionsAfterRefresh = await page.evaluate(
			({ child1Id, child2Id }) => {
				const state = (window as any).__designStore.designState;
				return {
					child1: state.elements[child1Id].position,
					child2: state.elements[child2Id].position
				};
			},
			{ child1Id, child2Id }
		);

		console.log('Stored positions after refresh:', positionsAfterRefresh);

		expect(positionsAfterRefresh.child1.x).toBe(0);
		expect(positionsAfterRefresh.child1.y).toBe(0);
		expect(positionsAfterRefresh.child2.x).toBe(0);
		expect(positionsAfterRefresh.child2.y).toBe(0);

		console.log('✓ Auto-layout children positions preserved at (0, 0) after refresh!');
	});
});
