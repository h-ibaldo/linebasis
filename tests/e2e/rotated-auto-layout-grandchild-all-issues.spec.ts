import { test, expect } from '@playwright/test';

test.describe('Rotated Auto-Layout Grandchild Issues', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('grandchild of rotated auto-layout should have correct hover, selection, and drag behavior', async ({
		page
	}) => {
		// Create auto-layout parent (rotated 45deg), child, and grandchild
		const { autoLayoutParent, childContainer, grandchild } = await page.evaluate(async () => {
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
					position: { x: 400, y: 300 },
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
					position: { x: 50, y: 50 },
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

		await page.waitForTimeout(200);

		// Get the grandchild element's actual DOM position
		const grandchildElement = page.locator(`[data-element-id="${grandchild}"]`);
		const grandchildBox = await grandchildElement.boundingBox();

		if (!grandchildBox) {
			throw new Error('Grandchild element not found');
		}

		console.log('\n=== INITIAL STATE ===');
		console.log('Grandchild DOM bounding box:', grandchildBox);

		// Get initial stored position
		const initialPosition = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Grandchild stored position:', initialPosition);

		// ISSUE 1: Check hover border position
		console.log('\n=== ISSUE 1: HOVER BORDER ===');
		await page.mouse.move(grandchildBox.x + grandchildBox.width / 2, grandchildBox.y + grandchildBox.height / 2);
		await page.waitForTimeout(100);

		const hoverBorder = page.locator('.hover-border').first();
		const hoverBorderBox = await hoverBorder.boundingBox();

		if (hoverBorderBox) {
			console.log('Hover border position:', hoverBorderBox);
			console.log('Expected position (should match grandchild):', grandchildBox);

			const hoverOffsetX = Math.abs(hoverBorderBox.x - grandchildBox.x);
			const hoverOffsetY = Math.abs(hoverBorderBox.y - grandchildBox.y);

			console.log(`Hover border offset: X=${hoverOffsetX.toFixed(2)}px, Y=${hoverOffsetY.toFixed(2)}px`);

			expect(hoverOffsetX).toBeLessThan(2);
			expect(hoverOffsetY).toBeLessThan(2);
		}

		// ISSUE 2 & 3: Check selection UI on mousedown and element jump
		console.log('\n=== ISSUE 2 & 3: SELECTION UI AND MOUSEDOWN JUMP ===');
		await page.mouse.down();
		await page.waitForTimeout(100);

		// Check if element jumped
		const positionAfterMousedown = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position after mousedown:', positionAfterMousedown);
		console.log('Expected (should match initial):', initialPosition);

		expect(positionAfterMousedown.x).toBeCloseTo(initialPosition.x, 1);
		expect(positionAfterMousedown.y).toBeCloseTo(initialPosition.y, 1);

		// Check selection UI position
		const selectionBorder = page.locator('.selection-border').first();
		const selectionBox = await selectionBorder.boundingBox();

		if (selectionBox) {
			console.log('Selection border position:', selectionBox);
			console.log('Expected position (should match grandchild):', grandchildBox);

			const selectionOffsetX = Math.abs(selectionBox.x - grandchildBox.x);
			const selectionOffsetY = Math.abs(selectionBox.y - grandchildBox.y);

			console.log(
				`Selection border offset: X=${selectionOffsetX.toFixed(2)}px, Y=${selectionOffsetY.toFixed(2)}px`
			);

			expect(selectionOffsetX).toBeLessThan(2);
			expect(selectionOffsetY).toBeLessThan(2);
		}

		await page.mouse.up();
		await page.waitForTimeout(100);

		// ISSUE 4: Second mousedown before dragging
		console.log('\n=== ISSUE 4: SECOND MOUSEDOWN ===');
		const positionBeforeSecondClick = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position before second mousedown:', positionBeforeSecondClick);

		await page.mouse.down();
		await page.waitForTimeout(100);

		const positionAfterSecondMousedown = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position after second mousedown:', positionAfterSecondMousedown);
		console.log('Expected (should match before click):', positionBeforeSecondClick);

		expect(positionAfterSecondMousedown.x).toBeCloseTo(positionBeforeSecondClick.x, 1);
		expect(positionAfterSecondMousedown.y).toBeCloseTo(positionBeforeSecondClick.y, 1);

		// ISSUE 5 & 6: Drag and drop
		console.log('\n=== ISSUE 5 & 6: DRAG AND DROP ===');
		const dragDistance = 50;
		await page.mouse.move(
			grandchildBox.x + grandchildBox.width / 2 + dragDistance,
			grandchildBox.y + grandchildBox.height / 2 + dragDistance,
			{ steps: 5 }
		);
		await page.waitForTimeout(100);

		const positionDuringDrag = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position during drag:', positionDuringDrag);

		await page.mouse.up();
		await page.waitForTimeout(100);

		const positionAfterDrop = await page.evaluate(
			(id) => {
				const state = (window as any).__designStore.designState;
				return state.elements[id].position;
			},
			grandchild
		);
		console.log('Position after drop:', positionAfterDrop);
		console.log('Expected (should match during drag):', positionDuringDrag);

		expect(positionAfterDrop.x).toBeCloseTo(positionDuringDrag.x, 1);
		expect(positionAfterDrop.y).toBeCloseTo(positionDuringDrag.y, 1);

		// Check selection UI after drop
		const grandchildBoxAfterDrop = await grandchildElement.boundingBox();
		if (!grandchildBoxAfterDrop) {
			throw new Error('Grandchild element not found after drop');
		}

		const selectionBoxAfterDrop = await selectionBorder.boundingBox();
		if (selectionBoxAfterDrop) {
			console.log('Selection border position after drop:', selectionBoxAfterDrop);
			console.log('Expected position (should match grandchild):', grandchildBoxAfterDrop);

			const selectionOffsetXAfterDrop = Math.abs(selectionBoxAfterDrop.x - grandchildBoxAfterDrop.x);
			const selectionOffsetYAfterDrop = Math.abs(selectionBoxAfterDrop.y - grandchildBoxAfterDrop.y);

			console.log(
				`Selection border offset after drop: X=${selectionOffsetXAfterDrop.toFixed(2)}px, Y=${selectionOffsetYAfterDrop.toFixed(2)}px`
			);

			expect(selectionOffsetXAfterDrop).toBeLessThan(2);
			expect(selectionOffsetYAfterDrop).toBeLessThan(2);
		}

		console.log('\n=== ALL ISSUES RESOLVED ===');
	});
});
