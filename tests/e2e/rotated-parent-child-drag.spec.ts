import { test, expect } from '@playwright/test';

/**
 * Test: Child of rotated parent (without auto-layout)
 *
 * Context:
 * - White div: auto-layout parent
 * - Green div: child of white div, rotated, NOT in auto-layout
 * - Purple div: child of green div
 *
 * Issue: Purple div jumps on mousedown/mouseup
 */

test.describe('Rotated Parent Child Drag', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('child of rotated parent should not jump during drag', async ({ page }) => {
		// Create: Auto-layout parent → Rotated child (green) → Grandchild (purple)
		const { greenDiv, purpleDiv } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// 1. Auto-layout parent (white)
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

			// 2. Green div (child of white, rotated)
			const greenId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: greenId,
					pageId,
					parentId: whiteId,
					elementType: 'div',
					position: { x: 0, y: 0 },
					size: { width: 300, height: 300 },
					style: { backgroundColor: '#4CAF50' }
				}
			});

			// Rotate green div
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: greenId,
					rotation: 25
				}
			});

			// 3. Purple div (child of green)
			const purpleId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: purpleId,
					pageId,
					parentId: greenId,
					elementType: 'div',
					position: { x: 50, y: 50 },
					size: { width: 150, height: 150 },
					style: { backgroundColor: '#9C27B0' }
				}
			});

			return {
				greenDiv: greenId,
				purpleDiv: purpleId
			};
		});

		await page.waitForTimeout(500);

		console.log('\n=== TESTING PURPLE DIV (child of rotated green) ===');

		const purpleElement = page.locator(`[data-element-id="${purpleDiv}"]`);
		const initialBox = await purpleElement.boundingBox();

		if (!initialBox) {
			throw new Error('Purple element not found');
		}

		console.log('Purple initial DOM position:', initialBox);

		const initialPos = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			purpleDiv
		);
		console.log('Purple initial stored position:', initialPos);

		// Mousedown
		const centerX = initialBox.x + initialBox.width / 2;
		const centerY = initialBox.y + initialBox.height / 2;

		await page.mouse.move(centerX, centerY);
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Check position during mousedown
		const boxDuringMousedown = await purpleElement.boundingBox();
		if (boxDuringMousedown) {
			const jumpX = Math.abs(boxDuringMousedown.x - initialBox.x);
			const jumpY = Math.abs(boxDuringMousedown.y - initialBox.y);
			console.log(`Jump on mousedown: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px)
			expect(jumpX, 'Purple should not jump horizontally on mousedown').toBeLessThan(2);
			expect(jumpY, 'Purple should not jump vertically on mousedown').toBeLessThan(2);
		}

		// Mouseup
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Check position after mouseup
		const boxAfterMouseup = await purpleElement.boundingBox();
		if (boxAfterMouseup) {
			const jumpX = Math.abs(boxAfterMouseup.x - initialBox.x);
			const jumpY = Math.abs(boxAfterMouseup.y - initialBox.y);
			console.log(`Jump after mouseup: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px)
			expect(jumpX, 'Purple should not jump horizontally after mouseup').toBeLessThan(2);
			expect(jumpY, 'Purple should not jump vertically after mouseup').toBeLessThan(2);
		}

		console.log('\n✓ Test passed - no jumps detected');
	});
});
