import { test, expect } from '@playwright/test';

/**
 * Test: Deep nesting with auto-layout ancestors
 *
 * Structure:
 * - Auto-layout parent (rotated)
 *   - Child (auto-layout child, positioned by flexbox)
 *     - Grandchild (NOT in auto-layout, but parent IS)
 *       - Great-grandchild (THIS is where the bug occurs)
 */

test.describe('Auto-Layout Deep Nesting', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('great-grandchild with auto-layout ancestor should not jump on interaction', async ({ page }) => {
		// Create: Auto-layout parent → child → grandchild → great-grandchild (blue div)
		const { greatGrandchild } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// 1. Create auto-layout parent (rotated)
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
					position: { x: 300, y: 300 },
					size: { width: 500, height: 500 },
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

			// Rotate parent to test rotated case
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: { elementId: autoLayoutId, rotation: 30 }
			});

			// 2. Create child (auto-layout will position it)
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
					size: { width: 300, height: 300 },
					style: { backgroundColor: '#FFF9C4' }
				}
			});

			// 3. Create grandchild (NOT in auto-layout, positioned normally)
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
					size: { width: 200, height: 200 },
					style: { backgroundColor: '#E1F5FE' }
				}
			});

			// 4. Create great-grandchild (BLUE DIV - this is where the bug occurs)
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
					position: { x: 40, y: 40 },
					size: { width: 120, height: 120 },
					style: { backgroundColor: '#2196F3' }
				}
			});

			return { greatGrandchild: greatGrandchildId };
		});

		await page.waitForTimeout(500);

		console.log('\n=== INITIAL STATE ===');
		const greatGrandchildElement = page.locator(`[data-element-id="${greatGrandchild}"]`);
		const initialBox = await greatGrandchildElement.boundingBox();

		if (!initialBox) {
			throw new Error('Great-grandchild element not found');
		}

		console.log('Initial DOM position:', initialBox);

		const initialPos = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			greatGrandchild
		);
		console.log('Initial stored position:', initialPos);

		console.log('\n=== MOUSEDOWN TEST ===');
		const centerX = initialBox.x + initialBox.width / 2;
		const centerY = initialBox.y + initialBox.height / 2;

		await page.mouse.move(centerX, centerY);
		await page.mouse.down();
		await page.waitForTimeout(100);

		const posAfterMousedown = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			greatGrandchild
		);
		console.log('Position after mousedown:', posAfterMousedown);

		const boxAfterMousedown = await greatGrandchildElement.boundingBox();
		console.log('DOM position after mousedown:', boxAfterMousedown);

		if (boxAfterMousedown) {
			const jumpX = Math.abs(boxAfterMousedown.x - initialBox.x);
			const jumpY = Math.abs(boxAfterMousedown.y - initialBox.y);
			console.log(`Jump on mousedown: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px)
			expect(jumpX).toBeLessThan(2);
			expect(jumpY).toBeLessThan(2);
		}

		await page.mouse.up();
		await page.waitForTimeout(100);

		console.log('\n✓ Great-grandchild interaction test complete');
	});
});
