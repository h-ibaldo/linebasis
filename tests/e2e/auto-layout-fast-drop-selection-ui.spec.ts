import { test, expect } from '@playwright/test';

/**
 * Test: Auto-layout fast drop - Selection UI alignment
 * 
 * Issue: When dropping elements in auto-layout parent too fast, the element ends up
 * in the correct final position (position B) but the selection UI stays at the old
 * position (position A) until the element is clicked again.
 * 
 * Expected: Selection UI should be perfectly aligned with the element after drop,
 * even with fast drag-and-drop operations.
 */

test.describe('Auto-layout fast drop - Selection UI alignment', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		
		// Wait for canvas to be ready
		await page.waitForSelector('.canvas', { state: 'visible' });
	});

	test('selection UI aligns correctly after fast drop in auto-layout', async ({ page }) => {
		// 1. Create an auto-layout parent
		const canvas = page.locator('.canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		
		// Create a rectangle (will be the auto-layout container)
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 400 } });
		
		// Enable auto-layout on this element
		// (Assuming there's a way to do this via UI - adjust as needed)
		await page.keyboard.press('Shift+A'); // Or whatever the shortcut is
		
		// 2. Create a child element inside the auto-layout
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 220, y: 220 } });
		await canvas.click({ position: { x: 320, y: 320 } });
		
		// Get the child element's data-element-id
		const childElement = page.locator('[data-element-id]').nth(1);
		const childId = await childElement.getAttribute('data-element-id');
		
		// 3. Get initial position of child element
		const initialRect = await childElement.boundingBox();
		console.log('Initial child position:', initialRect);
		
		// 4. Perform a FAST drag-and-drop (simulate fast user action)
		// Start drag
		await childElement.hover();
		await page.mouse.down();
		
		// Move quickly (small delay between movements)
		await page.mouse.move(initialRect!.x + 50, initialRect!.y + 100, { steps: 5 });
		await page.waitForTimeout(10); // Very short delay to simulate fast drop
		
		// Drop
		await page.mouse.up();
		
		// 5. Wait for reorder to complete
		await page.waitForTimeout(100);
		
		// 6. Get final positions
		const finalChildRect = await childElement.boundingBox();
		console.log('Final child position:', finalChildRect);
		
		// Get selection UI position
		const selectionUI = page.locator('.selection-container').first();
		const selectionRect = await selectionUI.boundingBox();
		console.log('Selection UI position:', selectionRect);
		
		// 7. Verify alignment
		// The selection UI should be at the same position as the element
		expect(Math.abs(selectionRect!.x - finalChildRect!.x)).toBeLessThan(2); // Allow 2px tolerance
		expect(Math.abs(selectionRect!.y - finalChildRect!.y)).toBeLessThan(2);
		expect(Math.abs(selectionRect!.width - finalChildRect!.width)).toBeLessThan(2);
		expect(Math.abs(selectionRect!.height - finalChildRect!.height)).toBeLessThan(2);
		
		// Take a screenshot for visual verification
		await page.screenshot({ path: 'tests/screenshots/auto-layout-fast-drop.png' });
	});

	test('selection UI updates after zoom (workaround verification)', async ({ page }) => {
		// This test verifies that zooming fixes the alignment issue
		// (which was the clue that led to the fix)
		
		// 1. Set up auto-layout with child (same as above)
		const canvas = page.locator('.canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.keyboard.press('Shift+A');
		
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 220, y: 220 } });
		await canvas.click({ position: { x: 320, y: 320 } });
		
		const childElement = page.locator('[data-element-id]').nth(1);
		
		// 2. Fast drop
		const initialRect = await childElement.boundingBox();
		await childElement.hover();
		await page.mouse.down();
		await page.mouse.move(initialRect!.x + 50, initialRect!.y + 100, { steps: 5 });
		await page.waitForTimeout(10);
		await page.mouse.up();
		await page.waitForTimeout(100);
		
		// 3. Get misaligned positions (if bug exists)
		const childRectBeforeZoom = await childElement.boundingBox();
		const selectionRectBeforeZoom = await page.locator('.selection-container').first().boundingBox();
		
		console.log('Before zoom - Child:', childRectBeforeZoom);
		console.log('Before zoom - Selection:', selectionRectBeforeZoom);
		
		// 4. Zoom in (trigger viewport change)
		await page.keyboard.press('Control+='); // Or Command+= on Mac
		await page.waitForTimeout(200);
		
		// 5. Get positions after zoom
		const childRectAfterZoom = await childElement.boundingBox();
		const selectionRectAfterZoom = await page.locator('.selection-container').first().boundingBox();
		
		console.log('After zoom - Child:', childRectAfterZoom);
		console.log('After zoom - Selection:', selectionRectAfterZoom);
		
		// 6. Verify that after zoom, they're aligned
		// (This verifies the workaround works, confirming our understanding of the bug)
		const alignmentAfterZoom = Math.abs(selectionRectAfterZoom!.x - childRectAfterZoom!.x);
		expect(alignmentAfterZoom).toBeLessThan(2);
	});

	test('debug: log positions at each step', async ({ page }) => {
		// Detailed debugging test that logs everything
		
		page.on('console', msg => {
			if (msg.text().includes('🎯') || msg.text().includes('MOUSEUP') || msg.text().includes('CLEANUP')) {
				console.log('Browser console:', msg.text());
			}
		});
		
		const canvas = page.locator('.canvas');
		
		// Create auto-layout container
		await canvas.click({ position: { x: 200, y: 200 } });
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.keyboard.press('Shift+A');
		
		// Create child
		await page.keyboard.press('r');
		await canvas.click({ position: { x: 220, y: 220 } });
		await canvas.click({ position: { x: 320, y: 320 } });
		
		const childElement = page.locator('[data-element-id]').nth(1);
		const childId = await childElement.getAttribute('data-element-id');
		
		console.log('\n=== Starting drag ===');
		const initialRect = await childElement.boundingBox();
		console.log('Initial position:', initialRect);
		
		await childElement.hover();
		await page.mouse.down();
		console.log('Mouse down');
		
		await page.mouse.move(initialRect!.x + 50, initialRect!.y + 100, { steps: 5 });
		console.log('Mouse moved');
		
		await page.waitForTimeout(10);
		
		console.log('\n=== Dropping ===');
		await page.mouse.up();
		console.log('Mouse up');
		
		// Log positions at different intervals
		for (let i = 0; i < 5; i++) {
			await page.waitForTimeout(50);
			const rect = await childElement.boundingBox();
			const selectionRect = await page.locator('.selection-container').first().boundingBox();
			console.log(`\nAfter ${(i + 1) * 50}ms:`);
			console.log('  Child:', rect);
			console.log('  Selection:', selectionRect);
			console.log('  Offset:', {
				x: selectionRect!.x - rect!.x,
				y: selectionRect!.y - rect!.y
			});
		}
		
		await page.screenshot({ path: 'tests/screenshots/debug-positions.png' });
	});
});
