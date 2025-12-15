import { test, expect } from '@playwright/test';

/**
 * Test: Grandchild of non-rotated auto-layout parent jumps on mousedown
 *
 * Context:
 * - White div: non-rotated auto-layout parent
 * - Orange div: direct child of white (positioned by auto-layout)
 * - Blue div: grandchild (child of orange)
 *
 * Issue:
 * - HOVER: Hover border is correct ✓
 * - MOUSE DOWN: Blue element jumps to wrong position, but selection UI stays at correct position
 * - MOUSE UP: Blue element returns to original position, selection UI is stuck at wrong position
 */

test.describe('Auto-Layout Grandchild Mousedown Jump', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('grandchild should not jump on mousedown/mouseup', async ({ page }) => {
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

		console.log('\n=== TESTING BLUE DIV (grandchild of auto-layout) ===');

		const blueElement = page.locator(`[data-element-id="${blueDiv}"]`);
		const initialBox = await blueElement.boundingBox();

		if (!initialBox) {
			throw new Error('Blue element not found');
		}

		console.log('Blue initial DOM position:', initialBox);

		const initialPos = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			blueDiv
		);
		console.log('Blue initial stored position:', initialPos);

		// Mousedown
		const centerX = initialBox.x + initialBox.width / 2;
		const centerY = initialBox.y + initialBox.height / 2;

		await page.mouse.move(centerX, centerY);
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Check position during mousedown
		const boxDuringMousedown = await blueElement.boundingBox();
		if (boxDuringMousedown) {
			const jumpX = Math.abs(boxDuringMousedown.x - initialBox.x);
			const jumpY = Math.abs(boxDuringMousedown.y - initialBox.y);
			console.log(`Jump on mousedown: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px)
			expect(jumpX, 'Blue should not jump horizontally on mousedown').toBeLessThan(2);
			expect(jumpY, 'Blue should not jump vertically on mousedown').toBeLessThan(2);
		}

		// Mouseup
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Check position after mouseup
		const boxAfterMouseup = await blueElement.boundingBox();
		if (boxAfterMouseup) {
			const jumpX = Math.abs(boxAfterMouseup.x - initialBox.x);
			const jumpY = Math.abs(boxAfterMouseup.y - initialBox.y);
			console.log(`Jump after mouseup: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px)
			expect(jumpX, 'Blue should not jump horizontally after mouseup').toBeLessThan(2);
			expect(jumpY, 'Blue should not jump vertically after mouseup').toBeLessThan(2);
		}

		console.log('\n✓ Test passed - no jumps detected');
	});
});
