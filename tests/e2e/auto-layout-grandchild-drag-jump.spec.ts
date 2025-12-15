import { test, expect } from '@playwright/test';

/**
 * Test for the issue where grandchild/great-grandchild jumps during drag
 *
 * Context: Non-rotated auto-layout parent with grandchild AND great-grandchild
 *
 * Issue:
 * - ORIGINAL POSITION: Element is at correct position
 * - MOUSE DOWN: Element jumps to wrong position
 * - MOUSE UP: Element returns to original position, but selection UI is stuck at wrong position
 */

test.describe('Auto-Layout Grandchild Drag Jump', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('grandchild should not jump during drag with non-rotated auto-layout ancestor', async ({ page }) => {
		// Create: Auto-layout parent (NOT rotated) → Child → Grandchild → Great-grandchild
		const { grandchild, greatGrandchild } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// 1. Auto-layout parent (NOT rotated)
			const autoLayoutId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: autoLayoutId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 200, y: 200 },
					size: { width: 600, height: 600 },
					style: { backgroundColor: '#FFEBEE' },
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

			// 2. Child (auto-layout positions it)
			const childId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: childId,
					pageId,
					parentId: autoLayoutId,
					elementType: 'div',
					position: { x: 0, y: 0 },
					size: { width: 400, height: 400 },
					style: { backgroundColor: '#FFF9C4' }
				}
			});

			// 3. Grandchild
			const grandchildId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: grandchildId,
					pageId,
					parentId: childId,
					elementType: 'div',
					position: { x: 30, y: 30 },
					size: { width: 250, height: 250 },
					style: { backgroundColor: '#E1F5FE' }
				}
			});

			// 4. Great-grandchild (blue div)
			const greatGrandchildId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: greatGrandchildId,
					pageId,
					parentId: grandchildId,
					elementType: 'div',
					position: { x: 50, y: 50 },
					size: { width: 150, height: 150 },
					style: { backgroundColor: '#2196F3' }
				}
			});

			return {
				grandchild: grandchildId,
				greatGrandchild: greatGrandchildId
			};
		});

		await page.waitForTimeout(500);

		// Test BOTH grandchild and great-grandchild
		for (const { name, elementId } of [
			{ name: 'Grandchild', elementId: grandchild },
			{ name: 'Great-grandchild', elementId: greatGrandchild }
		]) {
			console.log(`\n=== TESTING ${name.toUpperCase()} ===`);

			const element = page.locator(`[data-element-id="${elementId}"]`);
			const initialBox = await element.boundingBox();

			if (!initialBox) {
				throw new Error(`${name} element not found`);
			}

			console.log(`${name} initial DOM position:`, initialBox);

			const initialPos = await page.evaluate(
				(id) => {
					const state = (window as any).__getDesignState();
					return state.elements[id].position;
				},
				elementId
			);
			console.log(`${name} initial stored position:`, initialPos);

			// Click and hold (mousedown)
			const centerX = initialBox.x + initialBox.width / 2;
			const centerY = initialBox.y + initialBox.height / 2;

			await page.mouse.move(centerX, centerY);
			await page.mouse.down();
			await page.waitForTimeout(100);

			// Check position during mousedown (before drag)
			const boxDuringMousedown = await element.boundingBox();
			if (boxDuringMousedown) {
				const jumpX = Math.abs(boxDuringMousedown.x - initialBox.x);
				const jumpY = Math.abs(boxDuringMousedown.y - initialBox.y);
				console.log(`${name} jump on mousedown: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

				// Expect no jump (tolerance of 2px)
				expect(jumpX, `${name} should not jump horizontally on mousedown`).toBeLessThan(2);
				expect(jumpY, `${name} should not jump vertically on mousedown`).toBeLessThan(2);
			}

			// Release mouse
			await page.mouse.up();
			await page.waitForTimeout(100);

			// Deselect for next test
			await page.mouse.click(100, 100);
			await page.waitForTimeout(200);
		}

		console.log('\n✓ All tests passed - no jumps detected');
	});
});
