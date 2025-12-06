import { test, expect } from '@playwright/test';

test.describe('Debug Rotated Drag Jump', () => {
	test('debug jump on first drag for children and grandchildren', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			return Object.keys(state.pages)[0];
		});

		console.log('=== SETUP ===');
		
		// Create rotated parent (45 degrees)
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement, rotateElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 400, height: 400 },
					styles: { backgroundColor: '#e0e0e0', border: '2px solid black' }
				});
				await rotateElement(id, 45);
				return id;
			},
			{ pageId }
		);

		// Create child inside rotated parent
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 50, y: 50 },
					size: { width: 150, height: 150 },
					styles: { backgroundColor: '#ff6b6b', border: '2px solid darkred' }
				});
			},
			{ parentId, pageId }
		);

		// Create grandchild inside child
		const grandchildId = await page.evaluate(
			async ({ childId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId: childId,
					pageId,
					position: { x: 25, y: 25 },
					size: { width: 100, height: 100 },
					styles: { backgroundColor: '#4ecdc4', border: '2px solid darkblue' }
				});
			},
			{ childId, pageId }
		);

		await page.waitForTimeout(500);

		// Helper to get detailed position info
		const getPositionInfo = async (elementId: string, label: string) => {
			return await page.evaluate(
				({ id, label }) => {
					const state = (window as any).__designStore.designState;
					const element = state.elements[id];
					const { getAbsolutePosition, getAbsoluteTransform } = (window as any).__coordinates;
					
					const absPos = getAbsolutePosition(element, state);
					const absTransform = getAbsoluteTransform(element, state);
					
					// Get DOM position
					const domEl = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
					let domRect = null;
					if (domEl) {
						domRect = domEl.getBoundingClientRect();
					}
					
					// Get pending position from interaction state
					// Try multiple ways to access the store
					let interactionState = null;
					if ((window as any).__interactionStore) {
						const store = (window as any).__interactionStore;
						interactionState = typeof store.get === 'function' ? store.get() : store;
					} else if ((window as any).interactionState) {
						interactionState = (window as any).interactionState;
					}
					const pendingPos = interactionState?.activeElementId === id ? interactionState.pendingPosition : null;
					
					return {
						label,
						storedPosition: element.position,
						absolutePosition: absPos,
						absoluteTransform: absTransform,
						domRect: domRect ? {
							left: domRect.left,
							top: domRect.top,
							width: domRect.width,
							height: domRect.height,
							centerX: domRect.left + domRect.width / 2,
							centerY: domRect.top + domRect.height / 2
						} : null,
						pendingPosition: pendingPos,
						parentId: element.parentId,
						rotation: element.rotation
					};
				},
				{ id: elementId, label }
			);
		};

		// Test CHILD drag
		console.log('\n=== TESTING CHILD DRAG ===');
		const childInitial = await getPositionInfo(childId, 'CHILD - Initial');
		console.log('Child initial:', JSON.stringify(childInitial, null, 2));

		const childElement = await page.locator(`[data-element-id="${childId}"]`).first();
		const childRect = await childElement.boundingBox();
		if (!childRect) throw new Error('Child element not found');

		const childCenterX = childRect.x + childRect.width / 2;
		const childCenterY = childRect.y + childRect.height / 2;

		// Click to select child first
		await childElement.click();
		await page.waitForTimeout(100);

		// Move to child and mousedown
		await page.mouse.move(childCenterX, childCenterY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		const childAfterMouseDown = await getPositionInfo(childId, 'CHILD - After mousedown');
		console.log('Child after mousedown:', JSON.stringify(childAfterMouseDown, null, 2));

		// Log interaction state after mousedown
		const interactionStateAfterMouseDown = await page.evaluate(() => {
			const interactionStore = (window as any).__interactionStore;
			return interactionStore ? interactionStore.get() : null;
		});
		console.log('Interaction state after mousedown:', JSON.stringify(interactionStateAfterMouseDown, null, 2));

		// Move beyond threshold (2px) to trigger drag
		await page.mouse.move(childCenterX + 5, childCenterY + 5, { steps: 1 });
		await page.waitForTimeout(100);

		const childAfterFirstMove = await getPositionInfo(childId, 'CHILD - After first pixel move');
		console.log('Child after first move:', JSON.stringify(childAfterFirstMove, null, 2));

		// Log interaction state after first move
		const interactionStateAfterFirstMove = await page.evaluate(() => {
			const interactionStore = (window as any).__interactionStore;
			return interactionStore ? interactionStore.get() : null;
		});
		console.log('Interaction state after first move:', JSON.stringify(interactionStateAfterFirstMove, null, 2));

		// Calculate jumps
		const childJumpOnMouseDown = {
			x: Math.abs(childAfterMouseDown.storedPosition.x - childInitial.storedPosition.x),
			y: Math.abs(childAfterMouseDown.storedPosition.y - childInitial.storedPosition.y)
		};
		const childJumpOnFirstMove = {
			x: Math.abs(childAfterFirstMove.storedPosition.x - childInitial.storedPosition.x),
			y: Math.abs(childAfterFirstMove.storedPosition.y - childInitial.storedPosition.y)
		};

		console.log(`Child jump on mousedown: (${childJumpOnMouseDown.x}, ${childJumpOnMouseDown.y})`);
		console.log(`Child jump on first move: (${childJumpOnFirstMove.x}, ${childJumpOnFirstMove.y})`);

		await page.mouse.up();
		await page.waitForTimeout(200);

		// Reset: move child back - just reload page for simplicity
		// (We'll test grandchild separately)

		// Test GRANDCHILD drag
		console.log('\n=== TESTING GRANDCHILD DRAG ===');
		const grandchildInitial = await getPositionInfo(grandchildId, 'GRANDCHILD - Initial');
		console.log('Grandchild initial:', JSON.stringify(grandchildInitial, null, 2));
		
		// Check if grandchild position is already wrong
		if (grandchildInitial.storedPosition.y < 0) {
			console.error('❌ GRANDCHILD POSITION IS ALREADY WRONG ON CREATION!');
			console.error('Expected y to be positive, got:', grandchildInitial.storedPosition.y);
		}

		const grandchildElement = await page.locator(`[data-element-id="${grandchildId}"]`).first();
		const grandchildRect = await grandchildElement.boundingBox();
		if (!grandchildRect) throw new Error('Grandchild element not found');

		const grandchildCenterX = grandchildRect.x + grandchildRect.width / 2;
		const grandchildCenterY = grandchildRect.y + grandchildRect.height / 2;

		// Click to select grandchild first
		await grandchildElement.click();
		await page.waitForTimeout(100);

		// Move to grandchild and mousedown
		await page.mouse.move(grandchildCenterX, grandchildCenterY);
		await page.mouse.down();
		await page.waitForTimeout(50);

		const grandchildAfterMouseDown = await getPositionInfo(grandchildId, 'GRANDCHILD - After mousedown');
		console.log('Grandchild after mousedown:', JSON.stringify(grandchildAfterMouseDown, null, 2));

		// Log interaction state after mousedown
		const grandchildInteractionStateAfterMouseDown = await page.evaluate(() => {
			const interactionStore = (window as any).__interactionStore;
			return interactionStore ? interactionStore.get() : null;
		});
		console.log('Grandchild interaction state after mousedown:', JSON.stringify(grandchildInteractionStateAfterMouseDown, null, 2));

		// Move beyond threshold (2px) to trigger drag
		await page.mouse.move(grandchildCenterX + 5, grandchildCenterY + 5, { steps: 1 });
		await page.waitForTimeout(100);

		const grandchildAfterFirstMove = await getPositionInfo(grandchildId, 'GRANDCHILD - After first pixel move');
		console.log('Grandchild after first move:', JSON.stringify(grandchildAfterFirstMove, null, 2));

		// Calculate jumps
		const grandchildJumpOnMouseDown = {
			x: Math.abs(grandchildAfterMouseDown.storedPosition.x - grandchildInitial.storedPosition.x),
			y: Math.abs(grandchildAfterMouseDown.storedPosition.y - grandchildInitial.storedPosition.y)
		};
		const grandchildJumpOnFirstMove = {
			x: Math.abs(grandchildAfterFirstMove.storedPosition.x - grandchildInitial.storedPosition.x),
			y: Math.abs(grandchildAfterFirstMove.storedPosition.y - grandchildInitial.storedPosition.y)
		};

		console.log(`Grandchild jump on mousedown: (${grandchildJumpOnMouseDown.x}, ${grandchildJumpOnMouseDown.y})`);
		console.log(`Grandchild jump on first move: (${grandchildJumpOnFirstMove.x}, ${grandchildJumpOnFirstMove.y})`);

		// Log conversion details
		console.log('\n=== CONVERSION DEBUG ===');
		const conversionDebug = await page.evaluate(
			({ childId, grandchildId }) => {
				const state = (window as any).__designStore.designState;
				const interactionStore = (window as any).__interactionStore;
				const interactionState = interactionStore ? interactionStore.get() : null;
				const { getAbsolutePosition, absoluteToRelative } = (window as any).__coordinates;

				const child = state.elements[childId];
				const grandchild = state.elements[grandchildId];
				const parent = state.elements[child.parentId];

				const childPending = interactionState?.activeElementId === childId ? interactionState.pendingPosition : null;
				const grandchildPending = interactionState?.activeElementId === grandchildId ? interactionState.pendingPosition : null;

				return {
					child: {
						pendingPosition: childPending,
						parentCenter: parent ? (() => {
							const parentAbs = getAbsolutePosition(parent, state);
							return {
								x: parentAbs.x + parent.size.width / 2,
								y: parentAbs.y + parent.size.height / 2
							};
						})() : null,
						converted: childPending && parent ? absoluteToRelative(childPending, parent, state) : null
					},
					grandchild: {
						pendingPosition: grandchildPending,
						parentCenter: child ? (() => {
							const childAbs = getAbsolutePosition(child, state);
							return {
								x: childAbs.x + child.size.width / 2,
								y: childAbs.y + child.size.height / 2
							};
						})() : null,
						converted: grandchildPending && child ? absoluteToRelative(grandchildPending, child, state) : null
					}
				};
			},
			{ childId, grandchildId }
		);
		console.log('Conversion debug:', JSON.stringify(conversionDebug, null, 2));

		await page.mouse.up();

		// Take screenshots
		await page.screenshot({ path: 'test-results/debug-rotated-drag-initial.png', fullPage: true });
	});
});

