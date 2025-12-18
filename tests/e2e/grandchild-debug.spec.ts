import { test, expect } from '@playwright/test';

test.describe('Debug Grandchild Position Issues', () => {
	test('debug grandchild position calculations', async ({ page }) => {
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

		// Get debug info
		const debugInfo = await page.evaluate(
			({ grandchildId, parentId, grandparentId }) => {
				const state = (window as any).__designStore.designState;
				const grandchild = state.elements[grandchildId];
				const parent = state.elements[parentId];
				const grandparent = state.elements[grandparentId];
				
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;
				const grandparentEl = document.querySelector(`[data-element-id="${grandparentId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				
				if (!grandchildEl || !parentEl || !grandparentEl || !canvasEl) return null;
				
				const canvasRect = canvasEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };
				
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const parentRect = parentEl.getBoundingClientRect();
				const grandparentRect = grandparentEl.getBoundingClientRect();
				
				// Get computed styles
				const grandchildStyle = window.getComputedStyle(grandchildEl);
				const parentStyle = window.getComputedStyle(parentEl);
				
				return {
					stored: {
						grandchild: grandchild.position,
						parent: parent.position,
						grandparent: grandparent.position
					},
					dom: {
						grandchild: {
							left: grandchildRect.left,
							top: grandchildRect.top,
							width: grandchildRect.width,
							height: grandchildRect.height,
							canvas: {
								x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
								y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
							}
						},
						parent: {
							left: parentRect.left,
							top: parentRect.top,
							width: parentRect.width,
							height: parentRect.height,
							canvas: {
								x: (parentRect.left - canvasRect.left - viewport.x) / viewport.scale,
								y: (parentRect.top - canvasRect.top - viewport.y) / viewport.scale
							}
						},
						grandparent: {
							left: grandparentRect.left,
							top: grandparentRect.top,
							width: grandparentRect.width,
							height: grandparentRect.height,
							canvas: {
								x: (grandparentRect.left - canvasRect.left - viewport.x) / viewport.scale,
								y: (grandparentRect.top - canvasRect.top - viewport.y) / viewport.scale
							}
						}
					},
					styles: {
						grandchild: {
							position: grandchildStyle.position,
							left: grandchildStyle.left,
							top: grandchildStyle.top
						},
						parent: {
							position: parentStyle.position,
							left: parentStyle.left,
							top: parentStyle.top
						}
					},
					rotations: {
						grandchild: grandchild.rotation || 0,
						parent: parent.rotation || 0,
						grandparent: grandparent.rotation || 0
					}
				};
			},
			{ grandchildId, parentId, grandparentId }
		);

		console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));
		
		// Select grandchild
		await page.evaluate(
			({ grandchildId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(grandchildId);
			},
			{ grandchildId }
		);

		await page.waitForTimeout(200);

		// Get selection UI position
		const selectionInfo = await page.evaluate(
			({ grandchildId }) => {
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				
				if (!grandchildEl || !canvasEl) return null;
				
				const canvasRect = canvasEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };
				
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const selectionRect = selectionBorder?.getBoundingClientRect();
				
				return {
					element: {
						screen: { x: grandchildRect.left, y: grandchildRect.top },
						canvas: {
							x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
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
			{ grandchildId }
		);

		console.log('Selection Info:', JSON.stringify(selectionInfo, null, 2));
		
		if (selectionInfo && selectionInfo.selectionUI) {
			const mismatchX = Math.abs(selectionInfo.selectionUI.canvas.x - selectionInfo.element.canvas.x);
			const mismatchY = Math.abs(selectionInfo.selectionUI.canvas.y - selectionInfo.element.canvas.y);
			console.log(`Selection UI mismatch: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels`);
		}
	});
});



