import { test, expect } from '@playwright/test';

/**
 * Test: Grandchild of non-rotated auto-layout parent - resize should not jump
 *
 * Context:
 * - White div: non-rotated auto-layout parent
 * - Orange div: direct child of white (positioned by auto-layout)
 * - Blue div: grandchild (child of orange)
 *
 * Issue:
 * - When resizing blue div, it jumps to wrong position on mousedown
 * - The jump is proportional to orange's flexbox-determined position
 */

test.describe('Auto-Layout Grandchild Resize', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('grandchild should not jump during resize', async ({ page }) => {
		// Create: Auto-layout parent (white) → Child (orange) → Grandchild (blue)
		const { whiteDiv, orangeDiv, blueDiv } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// 1. Auto-layout parent (white, NOT rotated)
			const whiteId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: whiteId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 200, y: 200 },
					size: { width: 600, height: 600 },
					style: { backgroundColor: '#FFFFFF', border: '2px solid #000' },
					autoLayout: {
						enabled: true,
						direction: 'vertical',
						gap: 20,
						padding: { top: 20, right: 20, bottom: 20, left: 20 },
						alignItems: 'flex-start',
						justifyContent: 'flex-start'
					}
				}
			});

			// 2. Orange div (direct child of white, positioned by auto-layout)
			const orangeId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: orangeId,
					pageId,
					parentId: whiteId,
					elementType: 'div',
					position: { x: 0, y: 0 },
					size: { width: 400, height: 400 },
					style: { backgroundColor: '#FF9800' }
				}
			});

			// 3. Blue div (grandchild)
			const blueId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: blueId,
					pageId,
					parentId: orangeId,
					elementType: 'div',
					position: { x: 50, y: 50 },
					size: { width: 200, height: 200 },
					style: { backgroundColor: '#2196F3' }
				}
			});

			return {
				whiteDiv: whiteId,
				orangeDiv: orangeId,
				blueDiv: blueId
			};
		});

		await page.waitForTimeout(500);

		console.log('\n=== TESTING BLUE DIV RESIZE ===');

		const blueElement = page.locator(`[data-element-id="${blueDiv}"]`);
		const initialBox = await blueElement.boundingBox();

		if (!initialBox) {
			throw new Error('Blue element not found');
		}

		console.log('Blue initial DOM position:', initialBox);

		// Select the element first
		await page.mouse.click(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
		await page.waitForTimeout(200);

		// Get the bottom-right resize handle position
		// The handle should be at the bottom-right corner of the element
		const handleX = initialBox.x + initialBox.width;
		const handleY = initialBox.y + initialBox.height;

		// Start resize by dragging the bottom-right handle
		await page.mouse.move(handleX, handleY);
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Check position during resize (mousedown on handle)
		const boxDuringResize = await blueElement.boundingBox();
		if (boxDuringResize) {
			const jumpX = Math.abs(boxDuringResize.x - initialBox.x);
			const jumpY = Math.abs(boxDuringResize.y - initialBox.y);
			console.log(`Position change on resize start: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Top-left corner should not move when resizing from bottom-right
			expect(jumpX, 'Blue top-left should not move on resize start').toBeLessThan(2);
			expect(jumpY, 'Blue top-left should not move on resize start').toBeLessThan(2);
		}

		// Drag to resize (increase size by 50px)
		await page.mouse.move(handleX + 50, handleY + 50, { steps: 5 });
		await page.waitForTimeout(100);

		// Release mouse
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Check final position after resize
		const boxAfterResize = await blueElement.boundingBox();
		if (boxAfterResize) {
			const jumpX = Math.abs(boxAfterResize.x - initialBox.x);
			const jumpY = Math.abs(boxAfterResize.y - initialBox.y);
			console.log(`Position change after resize: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Top-left corner should not move when resizing from bottom-right
			expect(jumpX, 'Blue top-left should not move after resize').toBeLessThan(2);
			expect(jumpY, 'Blue top-left should not move after resize').toBeLessThan(2);

			// Size should have increased
			const sizeIncreaseW = boxAfterResize.width - initialBox.width;
			const sizeIncreaseH = boxAfterResize.height - initialBox.height;
			console.log(`Size increase: W=${sizeIncreaseW.toFixed(2)}px, H=${sizeIncreaseH.toFixed(2)}px`);

			// We dragged 50px, so size should increase by approximately 50px
			expect(sizeIncreaseW, 'Width should increase').toBeGreaterThan(40);
			expect(sizeIncreaseH, 'Height should increase').toBeGreaterThan(40);
		}

		console.log('\n✓ Test passed - no position jumps during resize');
	});
});
