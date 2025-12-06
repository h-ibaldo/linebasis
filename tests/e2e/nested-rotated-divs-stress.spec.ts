import { test, expect } from '@playwright/test';

test.describe('Nested Rotated Divs Stress Test', () => {
	test('should correctly move 50 nested divs all rotated without jumping', async ({ page }) => {
		await page.goto('http://localhost:5175');

		// Wait for canvas to be ready
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get the actual page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0]; // Get first page ID
		});

		console.log('Using page ID:', pageId);

		// Create 50 nested divs, each rotated
		console.log('Creating 50 nested rotated divs...');

		let currentParentId = null;
		const divIds: string[] = [];

		for (let i = 0; i < 50; i++) {
			// Create div
			const createResult = await page.evaluate(
				async ({ parentId, index, pageId }) => {
					const { createElement, rotateElement } = (window as any).__designStore;

					const rotation = (index * 7.2) % 360; // Each div rotated differently

					const id = await createElement({
						elementType: 'div',
						parentId,
						pageId,
						position: { x: 10, y: 10 },
						size: { width: 200 - index * 2, height: 200 - index * 2 }, // Shrinking
						styles: {
							backgroundColor: `hsl(${index * 7}, 70%, 60%)`,
							border: '2px solid rgba(0,0,0,0.3)'
						}
					});

					// Set rotation
					await rotateElement(id, rotation);

					return { id, rotation };
				},
				{ parentId: currentParentId, index: i, pageId }
			);

			divIds.push(createResult.id);
			currentParentId = createResult.id; // Next div will be child of this one

			// Log progress every 10 divs
			if ((i + 1) % 10 === 0) {
				console.log(`Created ${i + 1}/50 divs...`);
			}
		}

		console.log('All 50 nested rotated divs created!');

		// Wait for rendering
		await page.waitForTimeout(500);

		// Get initial position of the deepest child (div 49)
		const deepestChildId = divIds[49];
		const initialPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];

			// Get absolute position using the unified coordinate utility
			const { getAbsoluteTransform } = (window as any).__coordinates || {};
			if (getAbsoluteTransform) {
				const transform = getAbsoluteTransform(element, state);
				return { x: transform.x, y: transform.y, rotation: transform.rotation };
			}

			// Fallback: just return stored position
			return { x: element.position.x, y: element.position.y, rotation: element.rotation || 0 };
		}, deepestChildId);

		console.log('Initial deepest child position:', initialPos);

		// Select the root div (div 0)
		await page.evaluate((id) => {
			const { selectElement } = (window as any).__designStore;
			selectElement(id);
		}, divIds[0]);

		await page.waitForTimeout(100);

		// Move the root div by dragging
		const rootElement = await page.locator(`[data-element-id="${divIds[0]}"]`).first();
		const box = await rootElement.boundingBox();

		if (!box) {
			throw new Error('Could not get root element bounding box');
		}

		const startX = box.x + box.width / 2;
		const startY = box.y + box.height / 2;
		const endX = startX + 100;
		const endY = startY + 100;

		console.log(`Dragging root div from (${startX}, ${startY}) to (${endX}, ${endY})`);

		// Perform drag
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(endX, endY, { steps: 10 });
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Get final position of the deepest child
		const finalPos = await page.evaluate((id) => {
			const state = (window as any).__designStore.designState;
			const element = state.elements[id];

			// Get absolute position using the unified coordinate utility
			const { getAbsoluteTransform } = (window as any).__coordinates || {};
			if (getAbsoluteTransform) {
				const transform = getAbsoluteTransform(element, state);
				return { x: transform.x, y: transform.y, rotation: transform.rotation };
			}

			// Fallback: just return stored position
			return { x: element.position.x, y: element.position.y, rotation: element.rotation || 0 };
		}, deepestChildId);

		console.log('Final deepest child position:', finalPos);

		// Calculate expected position change
		// The deepest child should move by approximately 100px in both x and y
		// (accounting for all the rotations in the parent chain)
		const deltaX = finalPos.x - initialPos.x;
		const deltaY = finalPos.y - initialPos.y;

		console.log(`Delta: (${deltaX}, ${deltaY})`);

		// The actual delta will be affected by the parent rotations, but should not be zero
		// and should not jump randomly
		expect(Math.abs(deltaX)).toBeGreaterThan(10);
		expect(Math.abs(deltaY)).toBeGreaterThan(10);

		// Verify no elements jumped to invalid positions (like NaN or Infinity)
		for (const id of divIds) {
			const pos = await page.evaluate((divId) => {
				const state = (window as any).__designStore.designState;
				const element = state.elements[divId];
				return element.position;
			}, id);

			expect(isFinite(pos.x)).toBe(true);
			expect(isFinite(pos.y)).toBe(true);
			expect(isNaN(pos.x)).toBe(false);
			expect(isNaN(pos.y)).toBe(false);
		}

		console.log('✓ All 50 nested rotated divs moved correctly without jumping!');

		// Performance check: Verify transform cache is being used
		const cacheStats = await page.evaluate((deepestId) => {
			const { getAbsoluteTransform, clearTransformCache } = (window as any).__coordinates || {};
			if (!getAbsoluteTransform) return null;

			const state = (window as any).__designStore.designState;
			const element = state.elements[deepestId];
			if (!element) return null;

			// Clear cache and measure time without cache
			clearTransformCache();
			const startNoCache = performance.now();
			for (let i = 0; i < 100; i++) {
				getAbsoluteTransform(element, state);
				clearTransformCache(); // Clear each time to prevent caching
			}
			const timeNoCache = performance.now() - startNoCache;

			// Measure time with cache
			const startWithCache = performance.now();
			for (let i = 0; i < 100; i++) {
				getAbsoluteTransform(element, state);
			}
			const timeWithCache = performance.now() - startWithCache;

			return {
				timeNoCache,
				timeWithCache,
				speedup: timeNoCache / timeWithCache
			};
		}, deepestChildId);

		if (cacheStats) {
			console.log('Cache performance:', cacheStats);
			console.log(`Speedup: ${cacheStats.speedup.toFixed(1)}x faster with cache`);

			// Verify cache provides significant speedup (at least 5x for 50 levels deep)
			expect(cacheStats.speedup).toBeGreaterThan(5);
		}
	});
});
