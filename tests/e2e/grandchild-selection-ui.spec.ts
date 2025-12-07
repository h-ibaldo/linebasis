import { test, expect } from '@playwright/test';

test.describe('Selection UI for Grandchildren of Rotated Auto-Layout', () => {
	test('selection UI should match element position for grandchildren when selected', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0];
		});

		// Create rotated auto-layout grandparent
		const grandparentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 500, height: 500 },
					rotation: 45, // ROTATED GRANDPARENT
					styles: { backgroundColor: '#e0e0e0', border: '2px solid #333' },
					autoLayout: { enabled: true, direction: 'row', gap: '20px', justifyContent: 'flex-start', alignItems: 'flex-start' }
				});
				return id;
			},
			{ pageId }
		);

		// Create auto-layout parent (child of grandparent)
		const parentId = await page.evaluate(
			async ({ grandparentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: grandparentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 150, height: 150 },
					styles: { backgroundColor: '#4dabf7', border: '2px solid #1971c2' }
				});
				return id;
			},
			{ grandparentId, pageId }
		);

		// Create grandchild (NOT in auto-layout, but parent IS)
		const grandchildId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: parentId,
					pageId,
					position: { x: 20, y: 20 },
					size: { width: 50, height: 50 },
					styles: { backgroundColor: '#339af0', border: '2px solid #1864ab' }
				});
				return id;
			},
			{ parentId, pageId }
		);

		await page.waitForTimeout(500);

		// Select grandchild
		await page.evaluate(
			({ grandchildId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(grandchildId);
			},
			{ grandchildId }
		);

		await page.waitForTimeout(200);

		// Get element and selection UI positions
		const positions = await page.evaluate(
			({ grandchildId }) => {
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				
				if (!grandchildEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				const elementPos = {
					screen: { x: grandchildRect.left, y: grandchildRect.top },
					canvas: {
						x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};

				let selectionUIPos = null;
				if (selectionBorder) {
					const borderRect = selectionBorder.getBoundingClientRect();
					selectionUIPos = {
						screen: { x: borderRect.left, y: borderRect.top },
						canvas: {
							x: (borderRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (borderRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					};
				}

				return {
					element: elementPos,
					selectionUI: selectionUIPos,
					foundSelectionUI: !!selectionBorder
				};
			},
			{ grandchildId }
		);

		console.log('Positions:', positions);

		if (positions && positions.selectionUI) {
			const mismatchX = Math.abs(positions.selectionUI.canvas.x - positions.element.canvas.x);
			const mismatchY = Math.abs(positions.selectionUI.canvas.y - positions.element.canvas.y);
			const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
			console.log(`Selection UI mismatch: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels, distance: ${mismatchDistance.toFixed(3)}`);
			
			// Take screenshot for debugging
			await page.screenshot({
				path: 'test-results/grandchild-selection-ui.png',
				fullPage: true
			});
			
			expect(mismatchDistance).toBeLessThan(1); // Selection UI should match element position
		} else {
			console.log('Selection UI not found!');
			await page.screenshot({
				path: 'test-results/grandchild-selection-ui-not-found.png',
				fullPage: true
			});
			expect(positions?.foundSelectionUI).toBe(true);
		}
	});
});


