import { test, expect } from '@playwright/test';

test.describe('Hover Border for Rotated Grandchildren of Rotated Auto-Layout', () => {
	test('hover border should match element position for rotated grandchildren', async ({ page }) => {
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

		// Create rotated grandchild (NOT in auto-layout, but parent IS)
		const grandchildId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: parentId,
					pageId,
					position: { x: 20, y: 20 },
					size: { width: 50, height: 50 },
					rotation: 30, // ROTATED GRANDCHILD
					styles: { backgroundColor: '#339af0', border: '2px solid #1864ab' }
				});
				return id;
			},
			{ parentId, pageId }
		);

		await page.waitForTimeout(500);

		// Hover over grandchild
		const grandchildElement = await page.locator(`[data-element-id="${grandchildId}"]`).first();
		const grandchildRect = await grandchildElement.boundingBox();
		if (!grandchildRect) throw new Error('Could not get grandchild element');

		const hoverX = grandchildRect.x + grandchildRect.width / 2;
		const hoverY = grandchildRect.y + grandchildRect.height / 2;

		await page.mouse.move(hoverX, hoverY);
		await page.waitForTimeout(200);

		// Get element and hover border positions
		const positions = await page.evaluate(
			({ grandchildId }) => {
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				
				// Find hover border - it's inside a parent wrapper, so we need to find it by its structure
				// Look for a div with border that's inside a parent wrapper (fixed position with transform)
				const allDivs = Array.from(document.querySelectorAll('div'));
				const hoverBorder = allDivs.find(div => {
					const style = window.getComputedStyle(div);
					// Hover border has border, is absolute positioned, and is inside a parent wrapper
					return style.position === 'absolute' && 
						style.border.includes('rgb(59, 130, 246)') && 
						style.pointerEvents === 'none' &&
						div !== grandchildEl &&
						div.parentElement?.style.position === 'absolute' && // Inside selection container
						div.parentElement?.parentElement?.style.position === 'fixed'; // Inside parent wrapper
				}) as HTMLElement | undefined;
				
				if (!grandchildEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				// For rotated elements, we need to get the actual bounding box corners
				// The element's top-left might not match the visual top-left due to rotation
				const elementCorners = [
					{ x: grandchildRect.left, y: grandchildRect.top },
					{ x: grandchildRect.right, y: grandchildRect.top },
					{ x: grandchildRect.right, y: grandchildRect.bottom },
					{ x: grandchildRect.left, y: grandchildRect.bottom }
				];

				const elementPos = {
					screen: { x: grandchildRect.left, y: grandchildRect.top },
					canvas: {
						x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
					},
					center: {
						screen: {
							x: grandchildRect.left + grandchildRect.width / 2,
							y: grandchildRect.top + grandchildRect.height / 2
						},
						canvas: {
							x: (grandchildRect.left + grandchildRect.width / 2 - canvasRect.left - viewport.x) / viewport.scale,
							y: (grandchildRect.top + grandchildRect.height / 2 - canvasRect.top - viewport.y) / viewport.scale
						}
					}
				};

				let hoverBorderPos = null;
				if (hoverBorder) {
					// Get the actual screen position of the hover border (accounting for parent transforms)
					const borderRect = hoverBorder.getBoundingClientRect();
					hoverBorderPos = {
						screen: { x: borderRect.left, y: borderRect.top },
						canvas: {
							x: (borderRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (borderRect.top - canvasRect.top - viewport.y) / viewport.scale
						},
						center: {
							screen: {
								x: borderRect.left + borderRect.width / 2,
								y: borderRect.top + borderRect.height / 2
							},
							canvas: {
								x: (borderRect.left + borderRect.width / 2 - canvasRect.left - viewport.x) / viewport.scale,
								y: (borderRect.top + borderRect.height / 2 - canvasRect.top - viewport.y) / viewport.scale
							}
						}
					};
				}

				return {
					element: elementPos,
					hoverBorder: hoverBorderPos,
					foundHoverBorder: !!hoverBorder
				};
			},
			{ grandchildId }
		);

		console.log('Positions:', JSON.stringify(positions, null, 2));

		if (positions && positions.hoverBorder) {
			// Compare centers for rotated elements (more accurate)
			const mismatchX = Math.abs(positions.hoverBorder.center.canvas.x - positions.element.center.canvas.x);
			const mismatchY = Math.abs(positions.hoverBorder.center.canvas.y - positions.element.center.canvas.y);
			const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
			console.log(`Hover border center mismatch: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels, distance: ${mismatchDistance.toFixed(3)}`);
			
			// Also check top-left for reference
			const topLeftMismatchX = Math.abs(positions.hoverBorder.canvas.x - positions.element.canvas.x);
			const topLeftMismatchY = Math.abs(positions.hoverBorder.canvas.y - positions.element.canvas.y);
			const topLeftMismatchDistance = Math.sqrt(topLeftMismatchX * topLeftMismatchX + topLeftMismatchY * topLeftMismatchY);
			console.log(`Hover border top-left mismatch: (${topLeftMismatchX.toFixed(3)}, ${topLeftMismatchY.toFixed(3)}) pixels, distance: ${topLeftMismatchDistance.toFixed(3)}`);
			
			// Take screenshot for debugging
			await page.screenshot({
				path: 'test-results/rotated-grandchild-hover-border.png',
				fullPage: true
			});
			
			// For rotated elements, we should check center position (more accurate)
			expect(mismatchDistance).toBeLessThan(2); // Allow some tolerance for rotated elements
		} else {
			console.log('Hover border not found!');
			await page.screenshot({
				path: 'test-results/rotated-grandchild-hover-border-not-found.png',
				fullPage: true
			});
			expect(positions?.foundHoverBorder).toBe(true);
		}
	});
});

