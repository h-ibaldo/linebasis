import { test, expect } from '@playwright/test';

test.describe('Rotated Auto-Layout Child Press Debug', () => {
	test('pressing child of rotated auto-layout should not misplace element', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForSelector('.canvas', { timeout: 10000 });

		// Get page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			return Object.keys(state.pages)[0];
		});

		// Create auto-layout parent
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 400, y: 300 },
					size: { width: 400, height: 200 },
					styles: {
						backgroundColor: 'rgba(135, 206, 250, 0.5)',
						border: '2px solid blue'
					},
					autoLayout: {
						enabled: true,
						direction: 'horizontal',
						gap: 20,
						padding: { top: 20, right: 20, bottom: 20, left: 20 },
						justifyContent: 'flex-start',
						alignItems: 'flex-start'
					}
				});

				// Rotate the parent after creation
				await rotateElement(id, 45);

				return id;
			},
			{ pageId }
		);

		// Create first child (red)
		const redChildId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 100, height: 100 },
					styles: { backgroundColor: 'red', border: '3px solid darkred' }
				});
			},
			{ parentId, pageId }
		);

		// Create second child (green)
		const greenChildId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 100, height: 100 },
					styles: { backgroundColor: 'green', border: '3px solid darkgreen' }
				});
			},
			{ parentId, pageId }
		);

		// Wait for rendering
		await page.waitForTimeout(500);

		// Take a screenshot of the initial state
		await page.screenshot({ path: 'test-results/rotated-autolayout-initial.png' });

		// Get diagnostic info about the layout
		const layoutInfo = await page.evaluate(
			({ redChildId, greenChildId, parentId }) => {
				const state = (window as any).__designStore.designState;
				const parent = state.elements[parentId];
				const red = state.elements[redChildId];
				const green = state.elements[greenChildId];

				return {
					parent: {
						rotation: parent.rotation,
						autoLayout: parent.autoLayout,
						children: parent.children,
						size: parent.size
					},
					red: {
						position: red.position,
						size: red.size,
						rotation: red.rotation,
						positionMode: red.positionMode
					},
					green: {
						position: green.position,
						size: green.size,
						rotation: green.rotation,
						positionMode: green.positionMode
					}
				};
			},
			{ redChildId, greenChildId, parentId }
		);

		console.log('Layout info:', JSON.stringify(layoutInfo, null, 2));

		// Get initial position of green child
		const initialGreenPosition = await page.evaluate(
			({ greenChildId }) => {
				const element = document.querySelector(`[data-element-id="${greenChildId}"]`);
				if (!element) return null;
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				};
			},
			{ greenChildId }
		);

		console.log('Initial green position:', initialGreenPosition);

		// Also get red child position for comparison
		const initialRedPosition = await page.evaluate(
			({ redChildId }) => {
				const element = document.querySelector(`[data-element-id="${redChildId}"]`);
				if (!element) return null;
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				};
			},
			{ redChildId }
		);

		console.log('Initial red position:', initialRedPosition);

		// Mousedown on the green child (don't release - keep it pressed)
		const greenElement = page.locator(`[data-element-id="${greenChildId}"]`);

		// Get the element's center position for clicking
		const box = await greenElement.boundingBox();
		if (!box) throw new Error('Could not get green element bounding box');

		// Start mousedown and hold
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();

		// Wait a tiny bit for the pressed state to apply
		await page.waitForTimeout(50);

		// Take screenshot during pressed state
		await page.screenshot({ path: 'test-results/rotated-autolayout-pressed.png' });

		// Get position during pressed state
		const pressedGreenPosition = await page.evaluate(
			({ greenChildId }) => {
				const element = document.querySelector(`[data-element-id="${greenChildId}"]`);
				if (!element) return null;
				const rect = element.getBoundingClientRect();

				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				};
			},
			{ greenChildId }
		);

		console.log('Pressed green position:', pressedGreenPosition);

		// The element should stay in approximately the same position when pressed
		// Allow for some tolerance (10px) due to viewport/scale differences
		if (initialGreenPosition && pressedGreenPosition) {
			const deltaX = Math.abs(pressedGreenPosition.left - initialGreenPosition.left);
			const deltaY = Math.abs(pressedGreenPosition.top - initialGreenPosition.top);

			console.log(`Position delta: X=${deltaX}, Y=${deltaY}`);

			// If the element moved significantly, the bug is present
			if (deltaX > 10 || deltaY > 10) {
				console.log('❌ BUG DETECTED: Element moved significantly when pressed');
				console.log('Initial:', initialGreenPosition);
				console.log('After press:', pressedGreenPosition);
			} else {
				console.log('✓ Element stayed in place when pressed');
			}

			expect(deltaX).toBeLessThan(10);
			expect(deltaY).toBeLessThan(10);
		}

		// Release mouse
		await page.mouse.up();

		// Wait a bit
		await page.waitForTimeout(500);

		// Now test with red child
		console.log('\n--- Testing RED child ---');
		const redElement = page.locator(`[data-element-id="${redChildId}"]`);
		const redBox = await redElement.boundingBox();
		if (!redBox) throw new Error('Could not get red element bounding box');

		await page.mouse.move(redBox.x + redBox.width / 2, redBox.y + redBox.height / 2);
		await page.mouse.down();
		await page.waitForTimeout(50);

		const pressedRedPosition = await page.evaluate(
			({ redChildId }) => {
				const element = document.querySelector(`[data-element-id="${redChildId}"]`);
				if (!element) return null;
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				};
			},
			{ redChildId }
		);

		console.log('Pressed red position:', pressedRedPosition);

		if (initialRedPosition && pressedRedPosition) {
			const deltaX = Math.abs(pressedRedPosition.left - initialRedPosition.left);
			const deltaY = Math.abs(pressedRedPosition.top - initialRedPosition.top);

			console.log(`Red position delta: X=${deltaX}, Y=${deltaY}`);

			if (deltaX > 10 || deltaY > 10) {
				console.log('❌ BUG DETECTED: Red element moved significantly when pressed');
				console.log('Initial:', initialRedPosition);
				console.log('After press:', pressedRedPosition);
			} else {
				console.log('✓ Red element stayed in place when pressed');
			}

			expect(deltaX).toBeLessThan(10);
			expect(deltaY).toBeLessThan(10);
		}

		await page.mouse.up();
	});
});
