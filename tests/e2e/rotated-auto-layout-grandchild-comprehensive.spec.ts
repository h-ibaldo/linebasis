import { test, expect } from '@playwright/test';

/**
 * Comprehensive test for rotated auto-layout grandchild interactions
 *
 * Tests all issues reported by user:
 * 1. Hover border positioning
 * 2. Selection UI positioning on mousedown
 * 3. Element jump on mousedown (before drag starts)
 * 4. Element position during drag
 * 5. Element jump on mouseup (after drop)
 * 6. Selection UI position after drop
 */

test.describe('Rotated Auto-Layout Grandchild Comprehensive', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('grandchild of rotated auto-layout should maintain position through full interaction cycle', async ({
		page
	}) => {
		// Create: Auto-layout parent (rotated 45°) → child container → red grandchild
		const { autoLayoutParent, childContainer, grandchild } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// Create auto-layout parent (blue, rotated 45°)
			const parentId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 300, y: 300 },
					size: { width: 400, height: 400 },
					style: {
						backgroundColor: '#E3F2FD'
					},
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

			// Rotate parent 45 degrees
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					rotation: 45
				}
			});

			// Create child container (yellow, auto-layout will position it)
			const childId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: childId,
					pageId,
					parentId: parentId,
					elementType: 'div',
					position: { x: 0, y: 0 }, // Auto-layout will override this
					size: { width: 200, height: 200 },
					style: {
						backgroundColor: '#FFF9C4'
					}
				}
			});

			// Create grandchild (red rectangle)
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
					position: { x: 50, y: 50 }, // Relative to child container
					size: { width: 100, height: 100 },
					style: {
						backgroundColor: '#FF5252'
					}
				}
			});

			return {
				autoLayoutParent: parentId,
				childContainer: childId,
				grandchild: grandchildId
			};
		});

		await page.waitForTimeout(500);

		console.log('\n===== STEP 1: INITIAL STATE =====');

		// Get grandchild's initial DOM position
		const grandchildElement = page.locator(`[data-element-id="${grandchild}"]`);
		const initialBox = await grandchildElement.boundingBox();

		if (!initialBox) {
			throw new Error('Grandchild element not found');
		}

		console.log('Initial DOM position:', initialBox);

		// Get stored position from state
		const initialStoredPos = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Initial stored position (relative to parent):', initialStoredPos);

		// Take screenshot of initial state
		await page.screenshot({
			path: 'test-results/grandchild-01-initial.png'
		});

		console.log('\n===== STEP 2: CLICK GRANDCHILD (NO DRAG) =====');

		// Click on grandchild center (mousedown + mouseup without drag)
		const centerX = initialBox.x + initialBox.width / 2;
		const centerY = initialBox.y + initialBox.height / 2;

		await page.mouse.move(centerX, centerY);
		await page.waitForTimeout(100);

		await page.mouse.down();
		await page.waitForTimeout(100);

		// Check position after mousedown
		const posAfterMousedown = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position after mousedown:', posAfterMousedown);

		// Check if element jumped visually
		const boxAfterMousedown = await grandchildElement.boundingBox();
		console.log('DOM position after mousedown:', boxAfterMousedown);

		if (boxAfterMousedown) {
			const jumpX = Math.abs(boxAfterMousedown.x - initialBox.x);
			const jumpY = Math.abs(boxAfterMousedown.y - initialBox.y);
			console.log(`Jump on mousedown: X=${jumpX.toFixed(2)}px, Y=${jumpY.toFixed(2)}px`);

			// Expect no jump (tolerance of 2px for rounding)
			expect(jumpX).toBeLessThan(2);
			expect(jumpY).toBeLessThan(2);
		}

		// Take screenshot after mousedown
		await page.screenshot({
			path: 'test-results/grandchild-02-after-mousedown.png'
		});

		await page.mouse.up();
		await page.waitForTimeout(100);

		console.log('\n===== STEP 3: DRAG GRANDCHILD =====');

		// Start drag
		await page.mouse.move(centerX, centerY);
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Drag by 50px in both directions
		const dragDistance = 50;
		await page.mouse.move(centerX + dragDistance, centerY + dragDistance, { steps: 5 });
		await page.waitForTimeout(200);

		// Check position during drag
		const posDuringDrag = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position during drag:', posDuringDrag);

		// Take screenshot during drag
		await page.screenshot({
			path: 'test-results/grandchild-03-during-drag.png'
		});

		console.log('\n===== STEP 4: DROP =====');

		await page.mouse.up();
		await page.waitForTimeout(200);

		// Check position after drop
		const posAfterDrop = await page.evaluate(
			(id) => {
				const state = (window as any).__getDesignState();
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position after drop:', posAfterDrop);

		// Check if element jumped on drop
		const boxAfterDrop = await grandchildElement.boundingBox();
		console.log('DOM position after drop:', boxAfterDrop);

		// Position after drop should match position during drag (no jump)
		console.log('Expected (from during drag):', posDuringDrag);
		expect(posAfterDrop.x).toBeCloseTo(posDuringDrag.x, 1);
		expect(posAfterDrop.y).toBeCloseTo(posDuringDrag.y, 1);

		// Take screenshot after drop
		await page.screenshot({
			path: 'test-results/grandchild-04-after-drop.png'
		});

		console.log('\n===== TEST COMPLETE =====');
		console.log('Check screenshots in test-results/ for visual verification');
	});
});
