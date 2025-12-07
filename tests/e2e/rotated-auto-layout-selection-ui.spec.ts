import { test, expect } from '@playwright/test';

test.describe('Selection UI Position for Rotated Auto-Layout Parent', () => {
	test('selection UI should match element position and not jump on mousedown', async ({ page }) => {
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

		// Create auto-layout child
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

		// Create nested element
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

		await page.waitForTimeout(500);

		// Select nested element
		await page.evaluate(
			({ nestedId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(nestedId);
			},
			{ nestedId }
		);

		await page.waitForTimeout(200);

		// Get element and selection UI positions before mousedown
		const beforeMousedown = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				// Find selection border - it's inside a selection-container or parent-wrapper
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				const selectionContainer = selectionBorder?.closest('.selection-container') as HTMLElement;
				const parentWrapper = selectionBorder?.closest('.parent-wrapper') as HTMLElement;
				
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				const elementPos = {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};

				let selectionUIPos = null;
				if (selectionBorder) {
					// Get the actual position of the selection border
					const selectionRect = selectionBorder.getBoundingClientRect();
					selectionUIPos = {
						screen: { x: selectionRect.left, y: selectionRect.top },
						canvas: {
							x: (selectionRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionRect.top - canvasRect.top - viewport.y) / viewport.scale
						},
						hasParentWrapper: !!parentWrapper,
						hasSelectionContainer: !!selectionContainer
					};
				}

				return {
					element: elementPos,
					selectionUI: selectionUIPos
				};
			},
			{ nestedId }
		);

		console.log('Before mousedown:', beforeMousedown);

		// Get element center for mousedown
		const nestedElement = await page.locator(`[data-element-id="${nestedId}"]`).first();
		const nestedRect = await nestedElement.boundingBox();
		if (!nestedRect) throw new Error('Could not get nested element');

		const startX = nestedRect.x + nestedRect.width / 2;
		const startY = nestedRect.y + nestedRect.height / 2;

		// Move to element and press down
		await page.mouse.move(startX, startY);
		await page.waitForTimeout(100);
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Get positions after mousedown
		const afterMousedown = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				// Find selection border - it's inside a selection-container or parent-wrapper
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				const selectionContainer = selectionBorder?.closest('.selection-container') as HTMLElement;
				const parentWrapper = selectionBorder?.closest('.parent-wrapper') as HTMLElement;
				
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				const elementPos = {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};

				let selectionUIPos = null;
				if (selectionBorder) {
					// Get the actual position of the selection border
					const selectionRect = selectionBorder.getBoundingClientRect();
					selectionUIPos = {
						screen: { x: selectionRect.left, y: selectionRect.top },
						canvas: {
							x: (selectionRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionRect.top - canvasRect.top - viewport.y) / viewport.scale
						},
						hasParentWrapper: !!parentWrapper,
						hasSelectionContainer: !!selectionContainer
					};
				}

				return {
					element: elementPos,
					selectionUI: selectionUIPos
				};
			},
			{ nestedId }
		);

		console.log('After mousedown:', afterMousedown);

		// Check for jumps
		if (beforeMousedown && afterMousedown) {
			// Check element jump
			const elementJumpX = afterMousedown.element.canvas.x - beforeMousedown.element.canvas.x;
			const elementJumpY = afterMousedown.element.canvas.y - beforeMousedown.element.canvas.y;
			const elementJumpDistance = Math.sqrt(elementJumpX * elementJumpX + elementJumpY * elementJumpY);
			console.log(`Element jump on mousedown: (${elementJumpX.toFixed(3)}, ${elementJumpY.toFixed(3)}) pixels, distance: ${elementJumpDistance.toFixed(3)}`);
			
			// Check selection UI jump
			if (beforeMousedown.selectionUI && afterMousedown.selectionUI) {
				const selectionJumpX = afterMousedown.selectionUI.canvas.x - beforeMousedown.selectionUI.canvas.x;
				const selectionJumpY = afterMousedown.selectionUI.canvas.y - beforeMousedown.selectionUI.canvas.y;
				const selectionJumpDistance = Math.sqrt(selectionJumpX * selectionJumpX + selectionJumpY * selectionJumpY);
				console.log(`Selection UI jump on mousedown: (${selectionJumpX.toFixed(3)}, ${selectionJumpY.toFixed(3)}) pixels, distance: ${selectionJumpDistance.toFixed(3)}`);
				
				// Check if selection UI matches element position
				const mismatchX = Math.abs(afterMousedown.selectionUI.canvas.x - afterMousedown.element.canvas.x);
				const mismatchY = Math.abs(afterMousedown.selectionUI.canvas.y - afterMousedown.element.canvas.y);
				const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
				console.log(`Selection UI mismatch with element: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels, distance: ${mismatchDistance.toFixed(3)}`);
				
				// Take screenshot
				await page.screenshot({
					path: 'test-results/rotated-auto-layout-selection-ui-mismatch.png',
					fullPage: true
				});
				
				// Assertions
				expect(elementJumpDistance).toBeLessThan(0.1); // NO JUMP ALLOWED
				expect(selectionJumpDistance).toBeLessThan(0.1); // NO JUMP ALLOWED
				expect(mismatchDistance).toBeLessThan(1); // Selection UI should match element position
			}
		}

		await page.mouse.up();
	});

	test('selection UI should stay aligned during small drag', async ({ page }) => {
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

		// Create auto-layout child
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

		// Create nested element
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

		await page.waitForTimeout(500);

		// Select nested element
		await page.evaluate(
			({ nestedId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(nestedId);
			},
			{ nestedId }
		);

		await page.waitForTimeout(200);

		// Get element center for mousedown
		const nestedElement = await page.locator(`[data-element-id="${nestedId}"]`).first();
		const nestedRect = await nestedElement.boundingBox();
		if (!nestedRect) throw new Error('Could not get nested element');

		const startX = nestedRect.x + nestedRect.width / 2;
		const startY = nestedRect.y + nestedRect.height / 2;

		// Move to element and press down
		await page.mouse.move(startX, startY);
		await page.waitForTimeout(100);
		
		// Get positions before mousedown
		const beforeMousedown = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const selectionRect = selectionBorder?.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					element: {
						screen: { x: nestedRect.left, y: nestedRect.top },
						canvas: {
							x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					},
					selectionUI: selectionBorder ? {
						screen: { x: selectionRect!.left, y: selectionRect!.top },
						canvas: {
							x: (selectionRect!.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionRect!.top - canvasRect.top - viewport.y) / viewport.scale
						}
					} : null
				};
			},
			{ nestedId }
		);

		await page.mouse.down();
		await page.waitForTimeout(50);

		// Get positions after mousedown
		const afterMousedown = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const selectionRect = selectionBorder?.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					element: {
						screen: { x: nestedRect.left, y: nestedRect.top },
						canvas: {
							x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					},
					selectionUI: selectionBorder ? {
						screen: { x: selectionRect!.left, y: selectionRect!.top },
						canvas: {
							x: (selectionRect!.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionRect!.top - canvasRect.top - viewport.y) / viewport.scale
						}
					} : null
				};
			},
			{ nestedId }
		);

		// Move mouse 2 pixels
		await page.mouse.move(startX + 2, startY + 2);
		await page.waitForTimeout(50);

		// Get positions after small move
		const afterMove = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const selectionRect = selectionBorder?.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					element: {
						screen: { x: nestedRect.left, y: nestedRect.top },
						canvas: {
							x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					},
					selectionUI: selectionBorder ? {
						screen: { x: selectionRect!.left, y: selectionRect!.top },
						canvas: {
							x: (selectionRect!.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionRect!.top - canvasRect.top - viewport.y) / viewport.scale
						}
					} : null
				};
			},
			{ nestedId }
		);

		console.log('Before mousedown:', beforeMousedown);
		console.log('After mousedown:', afterMousedown);
		console.log('After 2px move:', afterMove);

		if (beforeMousedown && afterMousedown && afterMove) {
			// Check mousedown jump
			const mousedownJumpX = afterMousedown.element.canvas.x - beforeMousedown.element.canvas.x;
			const mousedownJumpY = afterMousedown.element.canvas.y - beforeMousedown.element.canvas.y;
			const mousedownJumpDistance = Math.sqrt(mousedownJumpX * mousedownJumpX + mousedownJumpY * mousedownJumpY);
			console.log(`Element jump on mousedown: ${mousedownJumpDistance.toFixed(3)}px`);

			// Check selection UI alignment
			if (afterMousedown.selectionUI) {
				const mismatchX = Math.abs(afterMousedown.selectionUI.canvas.x - afterMousedown.element.canvas.x);
				const mismatchY = Math.abs(afterMousedown.selectionUI.canvas.y - afterMousedown.element.canvas.y);
				const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
				console.log(`Selection UI mismatch after mousedown: ${mismatchDistance.toFixed(3)}px`);
				expect(mismatchDistance).toBeLessThan(1);
			}

			// Check movement
			const moveX = afterMove.element.canvas.x - afterMousedown.element.canvas.x;
			const moveY = afterMove.element.canvas.y - afterMousedown.element.canvas.y;
			const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
			console.log(`Element moved: ${moveDistance.toFixed(3)}px (expected ~2.83px for 2px diagonal)`);

			// Check selection UI alignment after move
			if (afterMove.selectionUI) {
				const mismatchX = Math.abs(afterMove.selectionUI.canvas.x - afterMove.element.canvas.x);
				const mismatchY = Math.abs(afterMove.selectionUI.canvas.y - afterMove.element.canvas.y);
				const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
				console.log(`Selection UI mismatch after move: ${mismatchDistance.toFixed(3)}px`);
				expect(mismatchDistance).toBeLessThan(1);
			}

			expect(mousedownJumpDistance).toBeLessThan(0.1);
		}

		await page.mouse.up();
	});
});

