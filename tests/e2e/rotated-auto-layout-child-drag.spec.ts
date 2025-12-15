import { test, expect } from '@playwright/test';

test.describe('Nested Element in Rotated Auto-Layout Parent Drag', () => {
	test('should not jump when dragging nested element inside rotated auto-layout child', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0];
		});

		// Create rotated auto-layout parent
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 500, height: 500 },
					rotation: 45, // ROTATED PARENT
					styles: { backgroundColor: '#e0e0e0', border: '2px solid #333' },
					autoLayout: { enabled: true, direction: 'row', gap: '20px', justifyContent: 'flex-start', alignItems: 'flex-start' }
				});
				return id;
			},
			{ pageId }
		);

		console.log('Created rotated auto-layout parent:', parentId);

		// Create auto-layout child (the blue div)
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 150, height: 150 },
					styles: { backgroundColor: '#4dabf7', border: '2px solid #1971c2' }
				});
				return id;
			},
			{ parentId, pageId }
		);

		console.log('Created auto-layout child:', childId);

		// Create nested element inside the auto-layout child (small blue div)
		const nestedId = await page.evaluate(
			async ({ childId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: childId,
					pageId,
					position: { x: 20, y: 20 },
					size: { width: 50, height: 50 },
					styles: { backgroundColor: '#339af0', border: '2px solid #1864ab' }
				});
				return id;
			},
			{ childId, pageId }
		);

		console.log('Created nested element:', nestedId);

		await page.waitForTimeout(500);

		// Select nested element
		await page.evaluate(
			({ nestedId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(nestedId);
			},
			{ nestedId }
		);

		await page.waitForTimeout(100);

		// Get element center
		const nestedElement = await page.locator(`[data-element-id="${nestedId}"]`).first();
		const nestedRect = await nestedElement.boundingBox();
		if (!nestedRect) throw new Error('Could not get nested element');

		const startX = nestedRect.x + nestedRect.width / 2;
		const startY = nestedRect.y + nestedRect.height / 2;

		// Get position right before mousedown
		const beforeMousedownPos = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position before mousedown:', beforeMousedownPos);

		// Move to element and press down
		await page.mouse.move(startX, startY);
		await page.waitForTimeout(100);
		
		// Get position right before mousedown (after mouse move)
		const beforeMousedownPos2 = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);
		
		console.log('Position right before mousedown (after mouse move):', beforeMousedownPos2);
		
		await page.mouse.down();
		await page.waitForTimeout(100); // Wait longer for DOM update

		// Get position right after mousedown
		const afterMousedownPos = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after mousedown:', afterMousedownPos);

		// Check for jump on mousedown - MUST be zero
		if (beforeMousedownPos && afterMousedownPos) {
			const jumpX = afterMousedownPos.canvas.x - beforeMousedownPos.canvas.x;
			const jumpY = afterMousedownPos.canvas.y - beforeMousedownPos.canvas.y;
			const jumpDistance = Math.sqrt(jumpX * jumpX + jumpY * jumpY);
			console.log(`Jump on mousedown (vs initial): (${jumpX.toFixed(3)}, ${jumpY.toFixed(3)}) pixels, distance: ${jumpDistance.toFixed(3)}`);
			
			// Also check vs position right before mousedown
			if (beforeMousedownPos2) {
				const jumpX2 = afterMousedownPos.canvas.x - beforeMousedownPos2.canvas.x;
				const jumpY2 = afterMousedownPos.canvas.y - beforeMousedownPos2.canvas.y;
				const jumpDistance2 = Math.sqrt(jumpX2 * jumpX2 + jumpY2 * jumpY2);
				console.log(`Jump on mousedown (vs right before): (${jumpX2.toFixed(3)}, ${jumpY2.toFixed(3)}) pixels, distance: ${jumpDistance2.toFixed(3)}`);
				
				// Take screenshot for debugging
				await page.screenshot({
					path: 'test-results/rotated-auto-layout-drag-jump.png',
					fullPage: true
				});
				
				expect(jumpDistance2).toBeLessThan(0.1); // NO JUMP ALLOWED
			}
		}

		// Move mouse just 0.5 pixels first to catch any immediate jump
		await page.mouse.move(startX + 0.5, startY + 0.5);
		await page.waitForTimeout(50);

		// Get position after tiny move
		const afterTinyMove = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after 0.5px move:', afterTinyMove);

		// Check for jump on tiny move
		if (afterMousedownPos && afterTinyMove) {
			const moveX = afterTinyMove.canvas.x - afterMousedownPos.canvas.x;
			const moveY = afterTinyMove.canvas.y - afterMousedownPos.canvas.y;
			const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
			console.log(`Movement on 0.5px move: (${moveX.toFixed(3)}, ${moveY.toFixed(3)}) pixels, distance: ${moveDistance.toFixed(3)}`);
			
			// Should move very little, not jump
			if (moveDistance > 5) {
				console.error(`JUMP DETECTED! Element moved ${moveDistance.toFixed(3)} pixels when cursor moved only 0.5 pixels!`);
			}
			expect(moveDistance).toBeLessThan(5); // Allow some tolerance but catch big jumps
		}

		// Now move mouse 1 pixel more
		await page.mouse.move(startX + 1, startY + 1);
		await page.waitForTimeout(50);

		// Get position after 1px move
		const after1pxMove = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after 1px move:', after1pxMove);

		// Check for jump on first move - should move ~1 pixel, not jump
		if (afterMousedownPos && after1pxMove) {
			const moveX = after1pxMove.canvas.x - afterMousedownPos.canvas.x;
			const moveY = after1pxMove.canvas.y - afterMousedownPos.canvas.y;
			const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
			console.log(`Movement on first 1px move: (${moveX.toFixed(3)}, ${moveY.toFixed(3)}) pixels, distance: ${moveDistance.toFixed(3)}`);
			
			// Should move approximately 1 pixel (diagonal = ~1.41), not jump
			if (moveDistance > 5) {
				console.error(`JUMP DETECTED! Element moved ${moveDistance.toFixed(3)} pixels when cursor moved only 1 pixel!`);
			}
			expect(moveDistance).toBeLessThan(5); // Allow some tolerance but catch big jumps
			expect(Math.abs(moveX)).toBeLessThan(5);
			expect(Math.abs(moveY)).toBeLessThan(5);
		}

		await page.mouse.up();
	});
});

