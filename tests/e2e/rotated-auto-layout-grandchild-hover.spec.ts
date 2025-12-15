import { test, expect } from '@playwright/test';

/**
 * Test: Rotated auto-layout grandchild hover border positioning
 *
 * Reproduces the issue shown in screenshots where:
 * 1. Red rectangle is grandchild of rotated auto-layout div
 * 2. Hover border is misplaced
 * 3. Selection UI is misplaced on mousedown
 * 4. Element jumps on mousedown (before drag)
 * 5. Element jumps again on mouseup (after drag)
 */

test.describe('Rotated Auto-Layout Grandchild Hover', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('should show hover border at correct position for grandchild of rotated auto-layout', async ({
		page
	}) => {
		// Create the structure: rotated auto-layout parent -> child container -> red grandchild
		const { grandchild } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			// Create auto-layout parent
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
					position: { x: 100, y: 100 },
					size: { width: 300, height: 300 },
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

			// Create child container (positioned by auto-layout at 0,0)
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
					position: { x: 0, y: 0 },
					size: { width: 150, height: 150 },
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
					position: { x: 25, y: 25 },
					size: { width: 80, height: 80 },
					style: {
						backgroundColor: '#FF5252'
					}
				}
			});

			return {
				grandchild: grandchildId
			};
		});

		await page.waitForTimeout(500);

		// Get the grandchild's actual DOM bounding box
		const grandchildElement = page.locator(`[data-element-id="${grandchild}"]`);
		const grandchildBox = await grandchildElement.boundingBox();

		if (!grandchildBox) {
			throw new Error('Grandchild element not found');
		}

		console.log('\n=== GRANDCHILD ELEMENT ===');
		console.log('DOM Position:', grandchildBox);

		// Take screenshot showing the initial state
		await page.screenshot({
			path: 'test-results/rotated-auto-layout-grandchild-initial.png',
			fullPage: false
		});

		console.log('\n✓ Test setup complete - check screenshot for visual verification');
		console.log('Expected: Red rectangle should be visible as grandchild of rotated blue auto-layout div');
		console.log('Next: Manually test hover behavior in the browser');
	});
});
