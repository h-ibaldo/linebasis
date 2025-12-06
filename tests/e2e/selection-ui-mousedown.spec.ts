import { test, expect } from '@playwright/test';

test.describe('Selection UI on mouse down', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('selection UI should appear on mouse down for single element', async ({ page }) => {
		// Create a div element
		const { divId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const divId = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: divId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 100, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#3b82f6' }
				}
			});

			return { divId };
		});

		await page.waitForTimeout(200);

		// Find the element
		const element = page.locator(`[data-element-id="${divId}"]`).first();
		await expect(element).toBeVisible();

		// Get element bounding box
		const box = await element.boundingBox();
		if (!box) throw new Error('Element not found');

		// Check that selection UI is NOT visible before clicking
		const selectionUIBefore = await page.evaluate(() => {
			// Look for selection border (blue border)
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			return selectionBorders.length > 0;
		});
		expect(selectionUIBefore).toBe(false);

		// Mouse down on the element (but don't move - just press)
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down({ button: 'left' });
		await page.waitForTimeout(100);

		// Selection UI should NOW be visible on mouse down
		const selectionUIOnMouseDown = await page.evaluate(() => {
			// Look for selection border (blue border)
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			// Also check for resize handles
			const resizeHandles = Array.from(document.querySelectorAll('.resize-handle'));
			return {
				hasBorder: selectionBorders.length > 0,
				hasHandles: resizeHandles.length > 0,
				borderCount: selectionBorders.length,
				handleCount: resizeHandles.length
			};
		});

		expect(selectionUIOnMouseDown.hasBorder).toBe(true);
		expect(selectionUIOnMouseDown.hasHandles).toBe(true);

		// Now move mouse to start dragging
		await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
		await page.waitForTimeout(100);

		// After moving beyond threshold, selection UI should be hidden
		const selectionUIAfterDrag = await page.evaluate(() => {
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			return selectionBorders.length > 0;
		});

		expect(selectionUIAfterDrag).toBe(false);

		// Release mouse
		await page.mouse.up({ button: 'left' });
		await page.waitForTimeout(100);

		// After mouse up, selection UI should be visible again
		const selectionUIAfterMouseUp = await page.evaluate(() => {
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			return selectionBorders.length > 0;
		});

		expect(selectionUIAfterMouseUp).toBe(true);
	});

	test('selection UI should appear on mouse down for grouped elements', async ({ page }) => {
		// Create a group with two elements
		const { div1Id, div2Id } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();

			// Create first div
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div1Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 100, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#ff0000' }
				}
			});

			// Create second div
			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div2Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 250, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#00ff00' }
				}
			});

			// Group the elements
			const groupId = nanoid();
			await dispatch({
				id: nanoid(),
				type: 'GROUP_ELEMENTS',
				timestamp: Date.now(),
				payload: {
					groupId,
					elementIds: [div1Id, div2Id]
				}
			});

			return { div1Id, div2Id };
		});

		await page.waitForTimeout(200);

		// Find the first element
		const element = page.locator(`[data-element-id="${div1Id}"]`).first();
		await expect(element).toBeVisible();

		// Get element bounding box
		const box = await element.boundingBox();
		if (!box) throw new Error('Element not found');

		// Check that selection UI is NOT visible before clicking
		const selectionUIBefore = await page.evaluate(() => {
			// Look for group selection UI (multiple elements selected)
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			return selectionBorders.length > 0;
		});
		expect(selectionUIBefore).toBe(false);

		// Mouse down on the element (but don't move - just press)
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down({ button: 'left' });
		await page.waitForTimeout(100);

		// Selection UI should NOW be visible on mouse down (group selection)
		const selectionUIOnMouseDown = await page.evaluate(() => {
			// Look for selection border (blue border) - should show group bounds
			const selectionBorders = Array.from(document.querySelectorAll('.selection-border'));
			// Also check for resize handles
			const resizeHandles = Array.from(document.querySelectorAll('.resize-handle'));
			return {
				hasBorder: selectionBorders.length > 0,
				hasHandles: resizeHandles.length > 0,
				borderCount: selectionBorders.length,
				handleCount: resizeHandles.length
			};
		});

		expect(selectionUIOnMouseDown.hasBorder).toBe(true);
		expect(selectionUIOnMouseDown.hasHandles).toBe(true);

		// Release mouse
		await page.mouse.up({ button: 'left' });
	});
});

