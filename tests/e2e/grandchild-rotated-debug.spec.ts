import { test, expect } from '@playwright/test';

test.describe('Debug Grandchild of Rotated Auto-Layout', () => {
	test('debug selection UI and hover border alignment', async ({ page }) => {
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

		// Test 1: Selection UI when selected
		console.log('=== TEST 1: Selection UI ===');
		await page.evaluate(
			({ grandchildId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(grandchildId);
			},
			{ grandchildId }
		);

		await page.waitForTimeout(300);

		const selectionDebug = await page.evaluate(
			({ grandchildId }) => {
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				const selectionBorder = document.querySelector('.selection-border') as HTMLElement;
				const selectionContainer = document.querySelector('.selection-container') as HTMLElement;
				
				if (!grandchildEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				// Get element's actual position (accounting for rotation)
				const elementStyle = window.getComputedStyle(grandchildEl);
				const elementTransform = elementStyle.transform;
				
				// Calculate element center
				const elementCenterX = grandchildRect.left + grandchildRect.width / 2;
				const elementCenterY = grandchildRect.top + grandchildRect.height / 2;

				let selectionUIRect = null;
				let selectionContainerRect = null;
				if (selectionBorder) {
					selectionUIRect = selectionBorder.getBoundingClientRect();
				}
				if (selectionContainer) {
					selectionContainerRect = selectionContainer.getBoundingClientRect();
				}

				return {
					element: {
						boundingBox: {
							left: grandchildRect.left,
							top: grandchildRect.top,
							width: grandchildRect.width,
							height: grandchildRect.height,
							centerX: elementCenterX,
							centerY: elementCenterY
						},
						style: {
							position: elementStyle.position,
							left: elementStyle.left,
							top: elementStyle.top,
							transform: elementTransform
						},
						canvas: {
							x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					},
					selectionUI: selectionUIRect ? {
						boundingBox: {
							left: selectionUIRect.left,
							top: selectionUIRect.top,
							width: selectionUIRect.width,
							height: selectionUIRect.height
						},
						canvas: {
							x: (selectionUIRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (selectionUIRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					} : null,
					selectionContainer: selectionContainerRect ? {
						boundingBox: {
							left: selectionContainerRect.left,
							top: selectionContainerRect.top,
							width: selectionContainerRect.width,
							height: selectionContainerRect.height
						},
						style: {
							position: window.getComputedStyle(selectionContainer).position,
							left: window.getComputedStyle(selectionContainer).left,
							top: window.getComputedStyle(selectionContainer).top,
							transform: window.getComputedStyle(selectionContainer).transform
						}
					} : null,
					foundSelectionUI: !!selectionBorder
				};
			},
			{ grandchildId }
		);

		console.log('Selection UI Debug:', JSON.stringify(selectionDebug, null, 2));
		
		// Always take screenshot for visual inspection
		await page.screenshot({
			path: 'test-results/grandchild-selection-ui-debug.png',
			fullPage: true
		});
		
		if (selectionDebug && selectionDebug.selectionUI) {
			const mismatchX = Math.abs(selectionDebug.selectionUI.canvas.x - selectionDebug.element.canvas.x);
			const mismatchY = Math.abs(selectionDebug.selectionUI.canvas.y - selectionDebug.element.canvas.y);
			const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
			console.log(`Selection UI mismatch: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels, distance: ${mismatchDistance.toFixed(3)}`);
			
			// Check if transforms match
			const elementTransform = selectionDebug.element.style.transform;
			const selectionTransform = selectionDebug.selectionContainer?.style.transform;
			console.log(`Element transform: ${elementTransform}`);
			console.log(`Selection transform: ${selectionTransform}`);
			
			if (mismatchDistance > 1) {
				await page.screenshot({
					path: 'test-results/grandchild-selection-ui-misaligned.png',
					fullPage: true
				});
			}
		}

		// Test 2: Hover border
		console.log('\n=== TEST 2: Hover Border ===');
		await page.evaluate(
			({ grandchildId }) => {
				// Click outside to deselect
				document.body.click();
			},
			{ grandchildId }
		);

		await page.waitForTimeout(200);

		const grandchildElement = await page.locator(`[data-element-id="${grandchildId}"]`).first();
		const grandchildRect = await grandchildElement.boundingBox();
		if (!grandchildRect) throw new Error('Could not get grandchild element');

		const hoverX = grandchildRect.x + grandchildRect.width / 2;
		const hoverY = grandchildRect.y + grandchildRect.height / 2;

		await page.mouse.move(hoverX, hoverY);
		await page.waitForTimeout(300);

		const hoverDebug = await page.evaluate(
			({ grandchildId }) => {
				const grandchildEl = document.querySelector(`[data-element-id="${grandchildId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				
				// Find hover border
				const allDivs = Array.from(document.querySelectorAll('div'));
				const hoverBorder = allDivs.find(div => {
					const style = window.getComputedStyle(div);
					return style.position === 'absolute' && 
						style.border.includes('rgb(59, 130, 246)') && 
						style.pointerEvents === 'none' &&
						div !== grandchildEl &&
						div.parentElement?.style.position === 'absolute' &&
						div.parentElement?.parentElement?.style.position === 'fixed';
				}) as HTMLElement | undefined;
				
				if (!grandchildEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const grandchildRect = grandchildEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				let hoverBorderRect = null;
				let hoverBorderStyle = null;
				let hoverBorderParent = null;
				if (hoverBorder) {
					hoverBorderRect = hoverBorder.getBoundingClientRect();
					hoverBorderStyle = {
						position: window.getComputedStyle(hoverBorder).position,
						left: window.getComputedStyle(hoverBorder).left,
						top: window.getComputedStyle(hoverBorder).top,
						transform: window.getComputedStyle(hoverBorder).transform
					};
					if (hoverBorder.parentElement) {
						hoverBorderParent = {
							position: window.getComputedStyle(hoverBorder.parentElement).position,
							left: window.getComputedStyle(hoverBorder.parentElement).left,
							top: window.getComputedStyle(hoverBorder.parentElement).top,
							transform: window.getComputedStyle(hoverBorder.parentElement).transform
						};
					}
				}

				return {
					element: {
						boundingBox: {
							left: grandchildRect.left,
							top: grandchildRect.top,
							width: grandchildRect.width,
							height: grandchildRect.height
						},
						canvas: {
							x: (grandchildRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (grandchildRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					},
					hoverBorder: hoverBorderRect ? {
						boundingBox: {
							left: hoverBorderRect.left,
							top: hoverBorderRect.top,
							width: hoverBorderRect.width,
							height: hoverBorderRect.height
						},
						style: hoverBorderStyle,
						parentStyle: hoverBorderParent,
						canvas: {
							x: (hoverBorderRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (hoverBorderRect.top - canvasRect.top - viewport.y) / viewport.scale
						}
					} : null,
					foundHoverBorder: !!hoverBorder
				};
			},
			{ grandchildId }
		);

		console.log('Hover Border Debug:', JSON.stringify(hoverDebug, null, 2));
		
		// Always take screenshot for visual inspection
		await page.screenshot({
			path: 'test-results/grandchild-hover-border-debug.png',
			fullPage: true
		});
		
		if (hoverDebug && hoverDebug.hoverBorder) {
			const mismatchX = Math.abs(hoverDebug.hoverBorder.canvas.x - hoverDebug.element.canvas.x);
			const mismatchY = Math.abs(hoverDebug.hoverBorder.canvas.y - hoverDebug.element.canvas.y);
			const mismatchDistance = Math.sqrt(mismatchX * mismatchX + mismatchY * mismatchY);
			console.log(`Hover border mismatch: (${mismatchX.toFixed(3)}, ${mismatchY.toFixed(3)}) pixels, distance: ${mismatchDistance.toFixed(3)}`);
			
			// Check if transforms match
			console.log(`Hover border transform: ${hoverDebug.hoverBorder.style?.transform}`);
			console.log(`Hover border parent transform: ${hoverDebug.hoverBorder.parentStyle?.transform}`);
			
			if (mismatchDistance > 1) {
				await page.screenshot({
					path: 'test-results/grandchild-hover-border-misaligned.png',
					fullPage: true
				});
			}
		} else {
			console.log('WARNING: Hover border not found! This might indicate the element is still selected or the hover border is not rendering.');
		}

		// Take final screenshot
		await page.screenshot({
			path: 'test-results/grandchild-rotated-debug.png',
			fullPage: true
		});
	});
});

