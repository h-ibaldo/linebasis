import { test, expect, type Page } from '@playwright/test';

/**
 * Test group drag behavior inside rotated parent containers
 *
 * Issue: When dragging a group of elements inside a rotated parent container,
 * elements jump to incorrect positions on mousedown and during drag.
 *
 * Expected: Elements should stay under cursor and move smoothly without jumping.
 */

test.describe('Group Drag in Rotated Parents', () => {

	/**
	 * Helper: Create elements and set up scene via design store
	 */
	async function setupScene(page: Page, scenario: 'non-rotated' | 'rotated-45' | 'nested-rotated') {
		await page.evaluate((scen) => {
			// @ts-ignore - Access design store from window
			const { dispatch } = window.__designStore;

			// Import nanoid for ID generation
			const { nanoid } = window.__nanoid;

			if (scen === 'non-rotated') {
				// Create parent container (no rotation)
				const parentId = nanoid();
				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId: null,
					element: {
						id: parentId,
						type: 'div',
						position: { x: 200, y: 200 },
						size: { width: 400, height: 400 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#e5e7eb' }
					}
				});

				// Create two child elements
				const child1Id = nanoid();
				const child2Id = nanoid();

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child1Id,
						type: 'div',
						position: { x: 50, y: 50 },
						size: { width: 100, height: 100 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#3b82f6' }
					}
				});

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child2Id,
						type: 'div',
						position: { x: 200, y: 50 },
						size: { width: 100, height: 100 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#ef4444' }
					}
				});

				return { parentId, child1Id, child2Id };
			} else if (scen === 'rotated-45') {
				// Create parent container (rotated 45 degrees)
				const parentId = nanoid();
				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId: null,
					element: {
						id: parentId,
						type: 'div',
						position: { x: 300, y: 300 },
						size: { width: 400, height: 400 },
						rotation: 45,
						children: [],
						content: '',
						styles: { backgroundColor: '#fbbf24' }
					}
				});

				// Create two child elements
				const child1Id = nanoid();
				const child2Id = nanoid();

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child1Id,
						type: 'div',
						position: { x: 50, y: 50 },
						size: { width: 100, height: 100 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#3b82f6' }
					}
				});

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child2Id,
						type: 'div',
						position: { x: 200, y: 50 },
						size: { width: 100, height: 100 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#ef4444' }
					}
				});

				return { parentId, child1Id, child2Id };
			} else {
				// Create nested rotated parents
				const grandparent2Id = nanoid();
				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId: null,
					element: {
						id: grandparent2Id,
						type: 'div',
						position: { x: 100, y: 100 },
						size: { width: 700, height: 700 },
						rotation: 30,
						children: [],
						content: '',
						styles: { backgroundColor: '#dc2626', opacity: '0.3' }
					}
				});

				const grandparent1Id = nanoid();
				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId: grandparent2Id,
					element: {
						id: grandparent1Id,
						type: 'div',
						position: { x: 50, y: 50 },
						size: { width: 600, height: 600 },
						rotation: 20,
						children: [],
						content: '',
						styles: { backgroundColor: '#2563eb', opacity: '0.3' }
					}
				});

				const parentId = nanoid();
				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId: grandparent1Id,
					element: {
						id: parentId,
						type: 'div',
						position: { x: 100, y: 100 },
						size: { width: 400, height: 400 },
						rotation: 15,
						children: [],
						content: '',
						styles: { backgroundColor: '#fbbf24' }
					}
				});

				const child1Id = nanoid();
				const child2Id = nanoid();

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child1Id,
						type: 'div',
						position: { x: 50, y: 50 },
						size: { width: 80, height: 80 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#3b82f6' }
					}
				});

				dispatch({
					type: 'CREATE_ELEMENT',
					pageId: 'default',
					parentId,
					element: {
						id: child2Id,
						type: 'div',
						position: { x: 180, y: 50 },
						size: { width: 80, height: 80 },
						rotation: 0,
						children: [],
						content: '',
						styles: { backgroundColor: '#ef4444' }
					}
				});

				return { grandparent2Id, grandparent1Id, parentId, child1Id, child2Id };
			}
		}, scenario);

		// Wait for elements to render
		await page.waitForTimeout(500);

		// Return element IDs from the DOM
		const ids = await page.evaluate(() => {
			const elements = Array.from(document.querySelectorAll('[data-element-id]'));
			return elements.map(el => el.getAttribute('data-element-id')).filter(Boolean);
		});

		return ids;
	}

	/**
	 * Helper: Select multiple elements using Shift+Click
	 */
	async function selectMultiple(page: Page, elementIds: string[]) {
		// Click first element to select it
		await page.click(`[data-element-id="${elementIds[0]}"]`);
		await page.waitForTimeout(100);

		// Shift+Click to add others to selection
		for (let i = 1; i < elementIds.length; i++) {
			await page.click(`[data-element-id="${elementIds[i]}"]`, {
				modifiers: ['Shift']
			});
			await page.waitForTimeout(50);
		}
	}

	/**
	 * Helper: Get element's screen position
	 */
	async function getElementScreenBox(page: Page, elementId: string) {
		return await page.evaluate((id) => {
			const element = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
			if (!element) return null;

			const rect = element.getBoundingClientRect();
			return {
				x: rect.left,
				y: rect.top,
				width: rect.width,
				height: rect.height,
				centerX: rect.left + rect.width / 2,
				centerY: rect.top + rect.height / 2,
			};
		}, elementId);
	}

	test.beforeEach(async ({ page }) => {
		await page.goto('/');

		// Wait for page builder to load
		await page.waitForSelector('.canvas', { state: 'visible' });
		await page.waitForSelector('.toolbar', { state: 'visible' });

		// Expose design store and nanoid to window for easy manipulation
		await page.evaluate(() => {
			// @ts-ignore
			window.__designStore = require('$lib/stores/design-store');
			// @ts-ignore
			window.__nanoid = require('nanoid');
		});

		await page.waitForTimeout(500);
	});

	test('should not jump when dragging group inside non-rotated parent', async ({ page }) => {
		// Setup scene
		const ids = await setupScene(page, 'non-rotated');
		const [parentId, child1Id, child2Id] = ids;

		console.log('Created elements:', { parentId, child1Id, child2Id });

		// Take screenshot of initial state
		await page.screenshot({ path: 'test-results/non-rotated-initial.png', fullPage: true });

		// Select both children
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(200);

		// Get initial positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		const initialChild2 = await getElementScreenBox(page, child2Id);

		expect(initialChild1).not.toBeNull();
		expect(initialChild2).not.toBeNull();

		console.log('Initial child1 center:', initialChild1!.centerX, initialChild1!.centerY);

		// Drag the group
		await page.mouse.move(initialChild1!.centerX, initialChild1!.centerY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Check for jump on mousedown
		const afterMouseDown1 = await getElementScreenBox(page, child1Id);
		const jumpX = Math.abs(afterMouseDown1!.centerX - initialChild1!.centerX);
		const jumpY = Math.abs(afterMouseDown1!.centerY - initialChild1!.centerY);

		console.log('After mousedown:', afterMouseDown1!.centerX, afterMouseDown1!.centerY);
		console.log('Jump distance:', jumpX, jumpY);

		// Screenshot after mousedown
		await page.screenshot({ path: 'test-results/non-rotated-mousedown.png', fullPage: true });

		expect(jumpX).toBeLessThan(10);
		expect(jumpY).toBeLessThan(10);

		// Move cursor
		await page.mouse.move(initialChild1!.centerX + 100, initialChild1!.centerY + 50, { steps: 10 });
		await page.waitForTimeout(100);

		// Screenshot during drag
		await page.screenshot({ path: 'test-results/non-rotated-during.png', fullPage: true });

		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify both elements moved together
		const finalChild1 = await getElementScreenBox(page, child1Id);
		const finalChild2 = await getElementScreenBox(page, child2Id);

		const deltaX1 = finalChild1!.centerX - initialChild1!.centerX;
		const deltaY1 = finalChild1!.centerY - initialChild1!.centerY;
		const deltaX2 = finalChild2!.centerX - initialChild2!.centerX;
		const deltaY2 = finalChild2!.centerY - initialChild2!.centerY;

		console.log('Final deltas - child1:', deltaX1, deltaY1, 'child2:', deltaX2, deltaY2);

		expect(Math.abs(deltaX1 - deltaX2)).toBeLessThan(10);
		expect(Math.abs(deltaY1 - deltaY2)).toBeLessThan(10);

		// Screenshot final state
		await page.screenshot({ path: 'test-results/non-rotated-final.png', fullPage: true });
	});

	test('should not jump when dragging group inside rotated parent (45deg)', async ({ page }) => {
		// Setup scene
		const ids = await setupScene(page, 'rotated-45');
		const [parentId, child1Id, child2Id] = ids;

		console.log('Created elements:', { parentId, child1Id, child2Id });

		// Take screenshot of initial state
		await page.screenshot({ path: 'test-results/rotated-45-initial.png', fullPage: true });

		// Select both children
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(200);

		// Get initial positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		const initialChild2 = await getElementScreenBox(page, child2Id);

		expect(initialChild1).not.toBeNull();
		expect(initialChild2).not.toBeNull();

		console.log('Initial child1 center:', initialChild1!.centerX, initialChild1!.centerY);

		// Drag the group
		await page.mouse.move(initialChild1!.centerX, initialChild1!.centerY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// **CRITICAL CHECK**: Position after mousedown (should NOT jump)
		const afterMouseDown1 = await getElementScreenBox(page, child1Id);
		const jumpX = Math.abs(afterMouseDown1!.centerX - initialChild1!.centerX);
		const jumpY = Math.abs(afterMouseDown1!.centerY - initialChild1!.centerY);

		console.log('After mousedown:', afterMouseDown1!.centerX, afterMouseDown1!.centerY);
		console.log('Jump distance:', jumpX, jumpY);

		// Screenshot after mousedown to capture the bug
		await page.screenshot({ path: 'test-results/rotated-45-mousedown.png', fullPage: true });

		// This is the main bug check - if this fails, the bug is reproduced
		expect(jumpX).toBeLessThan(10);
		expect(jumpY).toBeLessThan(10);

		// Move cursor
		await page.mouse.move(initialChild1!.centerX + 100, initialChild1!.centerY + 50, { steps: 10 });
		await page.waitForTimeout(100);

		// Screenshot during drag
		await page.screenshot({ path: 'test-results/rotated-45-during.png', fullPage: true });

		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify both elements moved together
		const finalChild1 = await getElementScreenBox(page, child1Id);
		const finalChild2 = await getElementScreenBox(page, child2Id);

		const deltaX1 = finalChild1!.centerX - initialChild1!.centerX;
		const deltaY1 = finalChild1!.centerY - initialChild1!.centerY;
		const deltaX2 = finalChild2!.centerX - initialChild2!.centerX;
		const deltaY2 = finalChild2!.centerY - initialChild2!.centerY;

		console.log('Final deltas - child1:', deltaX1, deltaY1, 'child2:', deltaX2, deltaY2);

		expect(Math.abs(deltaX1 - deltaX2)).toBeLessThan(15);
		expect(Math.abs(deltaY1 - deltaY2)).toBeLessThan(15);

		// Screenshot final state
		await page.screenshot({ path: 'test-results/rotated-45-final.png', fullPage: true });
	});

	test('should not jump when dragging group inside nested rotated parents', async ({ page }) => {
		// Setup scene
		const ids = await setupScene(page, 'nested-rotated');
		const [grandparent2Id, grandparent1Id, parentId, child1Id, child2Id] = ids;

		console.log('Created elements:', { grandparent2Id, grandparent1Id, parentId, child1Id, child2Id });

		// Take screenshot of initial state
		await page.screenshot({ path: 'test-results/nested-rotated-initial.png', fullPage: true });

		// Select both children
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(200);

		// Get initial positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		const initialChild2 = await getElementScreenBox(page, child2Id);

		expect(initialChild1).not.toBeNull();
		expect(initialChild2).not.toBeNull();

		console.log('Initial child1 center:', initialChild1!.centerX, initialChild1!.centerY);

		// Drag the group
		await page.mouse.move(initialChild1!.centerX, initialChild1!.centerY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Check for jump on mousedown
		const afterMouseDown1 = await getElementScreenBox(page, child1Id);
		const jumpX = Math.abs(afterMouseDown1!.centerX - initialChild1!.centerX);
		const jumpY = Math.abs(afterMouseDown1!.centerY - initialChild1!.centerY);

		console.log('After mousedown:', afterMouseDown1!.centerX, afterMouseDown1!.centerY);
		console.log('Jump distance:', jumpX, jumpY);

		// Screenshot after mousedown
		await page.screenshot({ path: 'test-results/nested-rotated-mousedown.png', fullPage: true });

		expect(jumpX).toBeLessThan(10);
		expect(jumpY).toBeLessThan(10);

		// Move cursor
		await page.mouse.move(initialChild1!.centerX + 80, initialChild1!.centerY + 60, { steps: 10 });
		await page.waitForTimeout(100);

		// Screenshot during drag
		await page.screenshot({ path: 'test-results/nested-rotated-during.png', fullPage: true });

		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify both elements moved together
		const finalChild1 = await getElementScreenBox(page, child1Id);
		const finalChild2 = await getElementScreenBox(page, child2Id);

		const deltaX1 = finalChild1!.centerX - initialChild1!.centerX;
		const deltaY1 = finalChild1!.centerY - initialChild1!.centerY;
		const deltaX2 = finalChild2!.centerX - initialChild2!.centerX;
		const deltaY2 = finalChild2!.centerY - initialChild2!.centerY;

		console.log('Final deltas - child1:', deltaX1, deltaY1, 'child2:', deltaX2, deltaY2);

		expect(Math.abs(deltaX1 - deltaX2)).toBeLessThan(15);
		expect(Math.abs(deltaY1 - deltaY2)).toBeLessThan(15);

		// Screenshot final state
		await page.screenshot({ path: 'test-results/nested-rotated-final.png', fullPage: true });
	});

	test('selection UI should be correctly positioned for grouped elements in rotated parent', async ({ page }) => {
		// Setup scene with rotated parent
		const ids = await setupScene(page, 'rotated-45');
		const [parentId, child1Id, child2Id] = ids;

		console.log('Created elements:', { parentId, child1Id, child2Id });

		// Select both children to create a group
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(300);

		// Get the selection UI bounding box
		const selectionUI = await page.evaluate(() => {
			// Find the selection container element
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;

			const rect = selectionBox.getBoundingClientRect();
			return {
				x: rect.left,
				y: rect.top,
				width: rect.width,
				height: rect.height,
				centerX: rect.left + rect.width / 2,
				centerY: rect.top + rect.height / 2
			};
		});

		// Get the actual bounding box of the grouped elements
		const elementsBox = await page.evaluate(([id1, id2]) => {
			const el1 = document.querySelector(`[data-element-id="${id1}"]`) as HTMLElement;
			const el2 = document.querySelector(`[data-element-id="${id2}"]`) as HTMLElement;
			if (!el1 || !el2) return null;

			const rect1 = el1.getBoundingClientRect();
			const rect2 = el2.getBoundingClientRect();

			const minX = Math.min(rect1.left, rect2.left);
			const minY = Math.min(rect1.top, rect2.top);
			const maxX = Math.max(rect1.right, rect2.right);
			const maxY = Math.max(rect1.bottom, rect2.bottom);

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
				centerX: (minX + maxX) / 2,
				centerY: (minY + maxY) / 2
			};
		}, [child1Id, child2Id]);

		expect(selectionUI).not.toBeNull();
		expect(elementsBox).not.toBeNull();

		console.log('Selection UI box:', selectionUI);
		console.log('Elements box:', elementsBox);

		// The selection UI should closely match the elements' bounding box
		// Allow some tolerance for borders/padding
		const tolerance = 20; // pixels
		const centerXDiff = Math.abs(selectionUI!.centerX - elementsBox!.centerX);
		const centerYDiff = Math.abs(selectionUI!.centerY - elementsBox!.centerY);

		console.log('Center difference:', centerXDiff, centerYDiff);

		// Screenshot to verify visually
		await page.screenshot({ path: 'test-results/selection-ui-rotated-parent.png', fullPage: true });

		// The selection UI center should be within tolerance of the elements' center
		expect(centerXDiff).toBeLessThan(tolerance);
		expect(centerYDiff).toBeLessThan(tolerance);
	});

	test('selection UI should stay correctly positioned during drag of grouped elements in rotated parent', async ({ page }) => {
		// Setup scene with rotated parent
		const ids = await setupScene(page, 'rotated-45');
		const [parentId, child1Id, child2Id] = ids;

		// Select both children
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(300);

		// Get initial selection UI position
		const initialSelectionUI = await page.evaluate(() => {
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;
			const rect = selectionBox.getBoundingClientRect();
			return { x: rect.left, y: rect.top, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
		});

		// Get initial element positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		expect(initialChild1).not.toBeNull();
		expect(initialSelectionUI).not.toBeNull();

		// Start drag
		await page.mouse.move(initialChild1!.centerX, initialChild1!.centerY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Check selection UI position after mousedown (should not jump)
		const afterMouseDownSelectionUI = await page.evaluate(() => {
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;
			const rect = selectionBox.getBoundingClientRect();
			return { x: rect.left, y: rect.top, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
		});

		const afterMouseDownChild1 = await getElementScreenBox(page, child1Id);

		// Calculate jumps
		const selectionUIJumpX = Math.abs(afterMouseDownSelectionUI!.centerX - initialSelectionUI!.centerX);
		const selectionUIJumpY = Math.abs(afterMouseDownSelectionUI!.centerY - initialSelectionUI!.centerY);
		const elementJumpX = Math.abs(afterMouseDownChild1!.centerX - initialChild1!.centerX);
		const elementJumpY = Math.abs(afterMouseDownChild1!.centerY - initialChild1!.centerY);

		console.log('Selection UI jump:', selectionUIJumpX, selectionUIJumpY);
		console.log('Element jump:', elementJumpX, elementJumpY);

		// Screenshot after mousedown
		await page.screenshot({ path: 'test-results/selection-ui-drag-mousedown.png', fullPage: true });

		// Selection UI should not jump significantly on mousedown
		expect(selectionUIJumpX).toBeLessThan(15);
		expect(selectionUIJumpY).toBeLessThan(15);

		// Move during drag
		await page.mouse.move(initialChild1!.centerX + 50, initialChild1!.centerY + 30, { steps: 5 });
		await page.waitForTimeout(100);

		// Check selection UI position during drag
		const duringDragSelectionUI = await page.evaluate(() => {
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;
			const rect = selectionBox.getBoundingClientRect();
			return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
		});

		const duringDragChild1 = await getElementScreenBox(page, child1Id);

		// Selection UI should follow the elements during drag
		const selectionUIOffsetX = Math.abs(duringDragSelectionUI!.centerX - duringDragChild1!.centerX);
		const selectionUIOffsetY = Math.abs(duringDragSelectionUI!.centerY - duringDragChild1!.centerY);

		console.log('Selection UI offset during drag:', selectionUIOffsetX, selectionUIOffsetY);

		// Screenshot during drag
		await page.screenshot({ path: 'test-results/selection-ui-drag-during.png', fullPage: true });

		// Selection UI should stay aligned with elements (within tolerance)
		expect(selectionUIOffsetX).toBeLessThan(30);
		expect(selectionUIOffsetY).toBeLessThan(30);

		await page.mouse.up();
		await page.waitForTimeout(100);
	});

	test('group resize should not misplace nested grouped elements', async ({ page }) => {
		// Setup scene with nested grouped elements
		const ids = await setupScene(page, 'non-rotated');
		const [parentId, child1Id, child2Id] = ids;

		// Select both children to create a group
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(300);

		// Get initial positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		const initialChild2 = await getElementScreenBox(page, child2Id);
		expect(initialChild1).not.toBeNull();
		expect(initialChild2).not.toBeNull();

		// Get selection UI to find resize handle
		const selectionUI = await page.evaluate(() => {
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;
			const rect = selectionBox.getBoundingClientRect();
			return {
				x: rect.left,
				y: rect.top,
				width: rect.width,
				height: rect.height,
				right: rect.right,
				bottom: rect.bottom
			};
		});

		expect(selectionUI).not.toBeNull();

		// Click on bottom-right resize handle (se handle)
		const handleX = selectionUI!.right - 5;
		const handleY = selectionUI!.bottom - 5;

		await page.mouse.move(handleX, handleY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Resize by dragging
		await page.mouse.move(handleX + 50, handleY + 50, { steps: 5 });
		await page.waitForTimeout(100);

		await page.mouse.up();
		await page.waitForTimeout(200);

		// Get final positions
		const finalChild1 = await getElementScreenBox(page, child1Id);
		const finalChild2 = await getElementScreenBox(page, child2Id);

		// Elements should still be visible and reasonably positioned (not thousands of pixels away)
		// Check that elements are still within a reasonable distance from their initial positions
		const maxExpectedMovement = 200; // Allow for resize movement
		const child1Movement = Math.sqrt(
			Math.pow(finalChild1!.centerX - initialChild1!.centerX, 2) +
			Math.pow(finalChild1!.centerY - initialChild1!.centerY, 2)
		);
		const child2Movement = Math.sqrt(
			Math.pow(finalChild2!.centerX - initialChild2!.centerX, 2) +
			Math.pow(finalChild2!.centerY - initialChild2!.centerY, 2)
		);

		console.log('Child1 movement:', child1Movement);
		console.log('Child2 movement:', child2Movement);

		// Screenshot to verify
		await page.screenshot({ path: 'test-results/nested-group-resize-final.png', fullPage: true });

		// Elements should not have moved thousands of pixels
		expect(child1Movement).toBeLessThan(maxExpectedMovement);
		expect(child2Movement).toBeLessThan(maxExpectedMovement);
	});

	test('group rotate should not misplace nested grouped elements', async ({ page }) => {
		// Setup scene with nested grouped elements
		const ids = await setupScene(page, 'non-rotated');
		const [parentId, child1Id, child2Id] = ids;

		// Select both children to create a group
		await selectMultiple(page, [child1Id, child2Id]);
		await page.waitForTimeout(300);

		// Get initial positions
		const initialChild1 = await getElementScreenBox(page, child1Id);
		const initialChild2 = await getElementScreenBox(page, child2Id);
		expect(initialChild1).not.toBeNull();
		expect(initialChild2).not.toBeNull();

		// Get selection UI to find rotation handle
		const selectionUI = await page.evaluate(() => {
			const selectionBox = document.querySelector('.selection-container') as HTMLElement;
			if (!selectionBox) return null;
			const rect = selectionBox.getBoundingClientRect();
			return {
				x: rect.left,
				y: rect.top,
				width: rect.width,
				height: rect.height,
				centerX: rect.left + rect.width / 2,
				centerY: rect.top + rect.height / 2
			};
		});

		expect(selectionUI).not.toBeNull();

		// Click on rotation handle (above the selection box)
		const rotationHandleX = selectionUI!.centerX;
		const rotationHandleY = selectionUI!.y - 30; // Rotation handle is above the selection

		await page.mouse.move(rotationHandleX, rotationHandleY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Rotate by dragging
		await page.mouse.move(rotationHandleX + 50, rotationHandleY - 50, { steps: 5 });
		await page.waitForTimeout(100);

		await page.mouse.up();
		await page.waitForTimeout(200);

		// Get final positions
		const finalChild1 = await getElementScreenBox(page, child1Id);
		const finalChild2 = await getElementScreenBox(page, child2Id);

		// Elements should still be visible and reasonably positioned (not thousands of pixels away)
		// Check that elements are still within a reasonable distance from their initial positions
		const maxExpectedMovement = 300; // Allow for rotation movement
		const child1Movement = Math.sqrt(
			Math.pow(finalChild1!.centerX - initialChild1!.centerX, 2) +
			Math.pow(finalChild1!.centerY - initialChild1!.centerY, 2)
		);
		const child2Movement = Math.sqrt(
			Math.pow(finalChild2!.centerX - initialChild2!.centerX, 2) +
			Math.pow(finalChild2!.centerY - initialChild2!.centerY, 2)
		);

		console.log('Child1 movement:', child1Movement);
		console.log('Child2 movement:', child2Movement);

		// Screenshot to verify
		await page.screenshot({ path: 'test-results/nested-group-rotate-final.png', fullPage: true });

		// Elements should not have moved thousands of pixels
		expect(child1Movement).toBeLessThan(maxExpectedMovement);
		expect(child2Movement).toBeLessThan(maxExpectedMovement);
	});
});
