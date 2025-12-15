import { test, expect } from '@playwright/test';

test.describe('Nested Element in Auto-Layout Child Drag', () => {
	test('should not jump when dragging nested element inside auto-layout child', async ({ page }) => {
		await page.goto('http://localhost:5175');

		// Wait for canvas to be ready
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get the actual page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0];
		});

		console.log('Using page ID:', pageId);

		// Create auto-layout parent
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 500, height: 500 },
					styles: {
						backgroundColor: '#e0e0e0',
						border: '2px solid #333'
					},
					autoLayout: {
						enabled: true,
						direction: 'row',
						gap: '20px',
						justifyContent: 'flex-start',
						alignItems: 'flex-start'
					}
				});

				return id;
			},
			{ pageId }
		);

		console.log('Created auto-layout parent:', parentId);

		// Create auto-layout child (the blue div)
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 }, // Auto-layout children should have (0,0)
					size: { width: 150, height: 150 },
					styles: {
						backgroundColor: '#4dabf7',
						border: '2px solid #1971c2'
					}
				});

				return id;
			},
			{ parentId, pageId }
		);

		console.log('Created auto-layout child:', childId);

		// Create nested element inside the auto-layout child (small blue div)
		const nestedId = await page.evaluate(
			async ({ childId, pageId }) => {
				const { createElement } = (window as any).__designStore;

				const id = await createElement({
					elementType: 'div',
					parentId: childId,
					pageId,
					position: { x: 20, y: 20 }, // Position relative to parent
					size: { width: 50, height: 50 },
					styles: {
						backgroundColor: '#339af0',
						border: '2px solid #1864ab'
					}
				});

				return id;
			},
			{ childId, pageId }
		);

		console.log('Created nested element:', nestedId);

		// Wait for rendering
		await page.waitForTimeout(500);

		// Get initial DOM positions
		const initialPositions = await page.evaluate(
			({ nestedId, childId, parentId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
				const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;

				if (!nestedEl || !childEl || !parentEl || !canvasEl) {
					return null;
				}

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const childRect = childEl.getBoundingClientRect();
				const parentRect = parentEl.getBoundingClientRect();

				// Get viewport from store
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				// Convert to canvas coordinates
				const nestedCanvasX = (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale;
				const nestedCanvasY = (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale;

				const childCanvasX = (childRect.left - canvasRect.left - viewport.x) / viewport.scale;
				const childCanvasY = (childRect.top - canvasRect.top - viewport.y) / viewport.scale;

				const parentCanvasX = (parentRect.left - canvasRect.left - viewport.x) / viewport.scale;
				const parentCanvasY = (parentRect.top - canvasRect.top - viewport.y) / viewport.scale;

				// Get stored positions
				const state = (window as any).__designStore.designState;
				const nestedStored = state.elements[nestedId].position;
				const childStored = state.elements[childId].position;

				return {
					nested: {
						dom: { x: nestedCanvasX, y: nestedCanvasY },
						stored: nestedStored,
						screen: { x: nestedRect.left, y: nestedRect.top, width: nestedRect.width, height: nestedRect.height }
					},
					child: {
						dom: { x: childCanvasX, y: childCanvasY },
						stored: childStored,
						screen: { x: childRect.left, y: childRect.top, width: childRect.width, height: childRect.height }
					},
					parent: {
						dom: { x: parentCanvasX, y: parentCanvasY },
						screen: { x: parentRect.left, y: parentRect.top, width: parentRect.width, height: parentRect.height }
					},
					viewport
				};
			},
			{ nestedId, childId, parentId }
		);

		if (!initialPositions) {
			throw new Error('Could not get initial positions');
		}

		console.log('Initial positions:', JSON.stringify(initialPositions, null, 2));

		// Select the nested element
		await page.evaluate(
			({ nestedId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(nestedId);
			},
			{ nestedId }
		);

		await page.waitForTimeout(100);

		// Get the nested element's center in screen coordinates
		const nestedElement = await page.locator(`[data-element-id="${nestedId}"]`).first();
		const nestedRect = await nestedElement.boundingBox();

		if (!nestedRect) {
			throw new Error('Could not get nested element bounding box');
		}

		const startX = nestedRect.x + nestedRect.width / 2;
		const startY = nestedRect.y + nestedRect.height / 2;

		console.log(`Starting drag at screen position: (${startX}, ${startY})`);

		// Move mouse to element center
		await page.mouse.move(startX, startY);
		await page.waitForTimeout(100); // Wait for hover effects

		// Get position right before mousedown
		const beforeMousedownPosition = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position before mousedown:', beforeMousedownPosition);

		// Press mouse down
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Get position right after mousedown (before any movement)
		const afterMousedownPosition = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after mousedown:', afterMousedownPosition);

		// Check for jump on mousedown
		if (beforeMousedownPosition && afterMousedownPosition) {
			const mousedownJumpX = afterMousedownPosition.canvas.x - beforeMousedownPosition.canvas.x;
			const mousedownJumpY = afterMousedownPosition.canvas.y - beforeMousedownPosition.canvas.y;
			const mousedownJumpDistance = Math.sqrt(mousedownJumpX * mousedownJumpX + mousedownJumpY * mousedownJumpY);
			console.log(`Jump on mousedown: (${mousedownJumpX.toFixed(2)}, ${mousedownJumpY.toFixed(2)}) pixels, distance: ${mousedownJumpDistance.toFixed(2)}`);
			
			// There should be NO jump on mousedown
			expect(mousedownJumpDistance).toBeLessThan(0.1);
		}

		// Now move mouse just 1 pixel
		await page.mouse.move(startX + 1, startY + 1);
		await page.waitForTimeout(50);

		// Get position after 1 pixel movement
		const after1pxMove = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after 1px move:', after1pxMove);

		// Check for jump on first movement
		if (afterMousedownPosition && after1pxMove) {
			const moveJumpX = after1pxMove.canvas.x - afterMousedownPosition.canvas.x;
			const moveJumpY = after1pxMove.canvas.y - afterMousedownPosition.canvas.y;
			const moveJumpDistance = Math.sqrt(moveJumpX * moveJumpX + moveJumpY * moveJumpY);
			console.log(`Jump on first move: (${moveJumpX.toFixed(2)}, ${moveJumpY.toFixed(2)}) pixels, distance: ${moveJumpDistance.toFixed(2)}`);
			
			// The element should move exactly 1 pixel (or very close to it)
			// Allow small tolerance for rounding
			expect(moveJumpDistance).toBeLessThan(2); // Should be ~1.41 pixels for diagonal movement
			expect(Math.abs(moveJumpX)).toBeLessThan(2);
			expect(Math.abs(moveJumpY)).toBeLessThan(2);
		}

		// Get position right before drag starts (after mousedown, before movement)
		const beforeDragPosition = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position before drag start:', beforeDragPosition);

		// Start drag
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Get position right after drag starts (this is where the jump happens)
		const afterDragStartPosition = await page.evaluate(
			({ nestedId, childId, parentId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
				const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !childEl || !parentEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const childRect = childEl.getBoundingClientRect();
				const parentRect = parentEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				// Also get pending position from interaction state
				const interactionState = (window as any).__interactionStore?.interactionState;
				const pendingPosition = interactionState?.pendingPosition;
				const dragOffset = (window as any).__selectionOverlay?.dragOffsetCanvas;

				// Get stored positions
				const state = (window as any).__designStore.designState;
				const nestedStored = state.elements[nestedId].position;
				const childStored = state.elements[childId].position;

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					},
					pendingPosition,
					dragOffset,
					activeElementId: interactionState?.activeElementId,
					stored: {
						nested: nestedStored,
						child: childStored
					},
					parentDom: {
						x: (parentRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (parentRect.top - canvasRect.top - viewport.y) / viewport.scale
					},
					childDom: {
						x: (childRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (childRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId, childId, parentId }
		);

		console.log('Position after drag start:', afterDragStartPosition);

		// Calculate the jump
		if (beforeDragPosition && afterDragStartPosition) {
			const jumpX = afterDragStartPosition.canvas.x - beforeDragPosition.canvas.x;
			const jumpY = afterDragStartPosition.canvas.y - beforeDragPosition.canvas.y;
			const jumpDistance = Math.sqrt(jumpX * jumpX + jumpY * jumpY);

			console.log(`Jump detected: (${jumpX.toFixed(2)}, ${jumpY.toFixed(2)}) pixels, distance: ${jumpDistance.toFixed(2)}`);

			// Take screenshot for debugging
			await page.screenshot({
				path: 'test-results/nested-auto-layout-drag-jump.png',
				fullPage: true
			});

			// The jump should be minimal (less than 5 pixels)
			expect(jumpDistance).toBeLessThan(5);
		}

		// Continue dragging a bit - move cursor 30 pixels
		const endX = startX + 30;
		const endY = startY + 30;
		
		// Move cursor in small steps and check position at each step
		const steps = 5;
		const stepX = 30 / steps;
		const stepY = 30 / steps;
		
		for (let i = 1; i <= steps; i++) {
			const currentX = startX + stepX * i;
			const currentY = startY + stepY * i;
			await page.mouse.move(currentX, currentY);
			await page.waitForTimeout(20);
			
			// Get position during drag
			const duringDragPosition = await page.evaluate(
				({ nestedId, currentX, currentY }) => {
					const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
					const canvasEl = document.querySelector('.canvas') as HTMLElement;
					if (!nestedEl || !canvasEl) return null;

					const canvasRect = canvasEl.getBoundingClientRect();
					const nestedRect = nestedEl.getBoundingClientRect();
					const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

					// Convert cursor position to canvas coordinates
					const cursorCanvasX = (currentX - canvasRect.left - viewport.x) / viewport.scale;
					const cursorCanvasY = (currentY - canvasRect.top - viewport.y) / viewport.scale;

					// Get element center in canvas coordinates
					const elementCenterCanvasX = (nestedRect.left + nestedRect.width / 2 - canvasRect.left - viewport.x) / viewport.scale;
					const elementCenterCanvasY = (nestedRect.top + nestedRect.height / 2 - canvasRect.top - viewport.y) / viewport.scale;

					return {
						cursor: { x: cursorCanvasX, y: cursorCanvasY },
						elementCenter: { x: elementCenterCanvasX, y: elementCenterCanvasY },
						elementTopLeft: {
							x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
							y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
						},
						offset: {
							x: elementCenterCanvasX - cursorCanvasX,
							y: elementCenterCanvasY - cursorCanvasY
						}
					};
				},
				{ nestedId, currentX, currentY }
			);

			if (i === 1 || i === steps) {
				console.log(`Position at step ${i}:`, duringDragPosition);
				
				// Check if element center follows cursor (should maintain the same offset as drag start)
				if (duringDragPosition) {
					const offsetDistance = Math.sqrt(
						duringDragPosition.offset.x * duringDragPosition.offset.x +
						duringDragPosition.offset.y * duringDragPosition.offset.y
					);
					
					// The offset should be consistent (within 2 pixels tolerance)
					if (i === 1) {
						console.log(`Initial drag offset: ${offsetDistance.toFixed(2)} pixels`);
					} else {
						console.log(`Final drag offset: ${offsetDistance.toFixed(2)} pixels`);
					}
				}
			}
		}

		// Release mouse
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Get final position
		const finalPosition = await page.evaluate(
			({ nestedId }) => {
				const state = (window as any).__designStore.designState;
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					dom: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					},
					stored: state.elements[nestedId].position
				};
			},
			{ nestedId }
		);

		console.log('Final position:', finalPosition);
	});

	test('should not misplace element on very small drag (1-2 pixels)', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const pages = state.pages;
			return Object.keys(pages)[0];
		});

		// Create auto-layout parent
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 200, y: 200 },
					size: { width: 500, height: 500 },
					styles: { backgroundColor: '#e0e0e0', border: '2px solid #333' },
					autoLayout: { enabled: true, direction: 'row', gap: '20px', justifyContent: 'flex-start', alignItems: 'flex-start' }
				});
				return id;
			},
			{ pageId }
		);

		// Create auto-layout child
		const childId = await page.evaluate(
			async ({ parentId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId,
					pageId,
					position: { x: 0, y: 0 },
					size: { width: 150, height: 150 },
					styles: { backgroundColor: '#4dabf7', border: '2px solid #1971c2' }
				});
				return id;
			},
			{ parentId, pageId }
		);

		// Create nested element
		const nestedId = await page.evaluate(
			async ({ childId, pageId }) => {
				const { createElement } = (window as any).__designStore;
				const id = await createElement({
					elementType: 'div',
					parentId: childId,
					pageId,
					position: { x: 20, y: 20 },
					size: { width: 50, height: 50 },
					styles: { backgroundColor: '#339af0', border: '2px solid #1864ab' }
				});
				return id;
			},
			{ childId, pageId }
		);

		await page.waitForTimeout(500);

		// Get initial position
		const initialPos = await page.evaluate(
			({ nestedId }) => {
				const state = (window as any).__designStore.designState;
				return state.elements[nestedId].position;
			},
			{ nestedId }
		);

		console.log('Initial stored position:', initialPos);

		// Select nested element
		await page.evaluate(
			({ nestedId }) => {
				const { selectElement } = (window as any).__designStore;
				selectElement(nestedId);
			},
			{ nestedId }
		);

		await page.waitForTimeout(100);

		// Get element center
		const nestedElement = await page.locator(`[data-element-id="${nestedId}"]`).first();
		const nestedRect = await nestedElement.boundingBox();
		if (!nestedRect) throw new Error('Could not get nested element');

		const startX = nestedRect.x + nestedRect.width / 2;
		const startY = nestedRect.y + nestedRect.height / 2;

		// Get position right before mousedown
		const beforeMousedownPos = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position before mousedown:', beforeMousedownPos);

		// Move to element and press down
		await page.mouse.move(startX, startY);
		await page.waitForTimeout(50);
		await page.mouse.down();
		await page.waitForTimeout(50);

		// Get position right after mousedown
		const afterMousedownPos = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after mousedown:', afterMousedownPos);

		// Check for jump on mousedown - MUST be zero
		if (beforeMousedownPos && afterMousedownPos) {
			const jumpX = afterMousedownPos.canvas.x - beforeMousedownPos.canvas.x;
			const jumpY = afterMousedownPos.canvas.y - beforeMousedownPos.canvas.y;
			const jumpDistance = Math.sqrt(jumpX * jumpX + jumpY * jumpY);
			console.log(`Jump on mousedown: (${jumpX.toFixed(3)}, ${jumpY.toFixed(3)}) pixels, distance: ${jumpDistance.toFixed(3)}`);
			expect(jumpDistance).toBeLessThan(0.1); // NO JUMP ALLOWED
		}

		// Move mouse just 1 pixel
		await page.mouse.move(startX + 1, startY + 1);
		await page.waitForTimeout(50);

		// Get position after 1px move
		const after1pxMove = await page.evaluate(
			({ nestedId }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !canvasEl) return null;

				const canvasRect = canvasEl.getBoundingClientRect();
				const nestedRect = nestedEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				return {
					screen: { x: nestedRect.left, y: nestedRect.top },
					canvas: {
						x: (nestedRect.left - canvasRect.left - viewport.x) / viewport.scale,
						y: (nestedRect.top - canvasRect.top - viewport.y) / viewport.scale
					}
				};
			},
			{ nestedId }
		);

		console.log('Position after 1px move:', after1pxMove);

		// Check for jump on first move - should move ~1 pixel, not jump
		if (afterMousedownPos && after1pxMove) {
			const moveX = after1pxMove.canvas.x - afterMousedownPos.canvas.x;
			const moveY = after1pxMove.canvas.y - afterMousedownPos.canvas.y;
			const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
			console.log(`Movement on first 1px move: (${moveX.toFixed(3)}, ${moveY.toFixed(3)}) pixels, distance: ${moveDistance.toFixed(3)}`);
			
			// Should move approximately 1 pixel (diagonal = ~1.41), not jump
			expect(moveDistance).toBeLessThan(2); // Should be ~1.41 for diagonal
			expect(Math.abs(moveX)).toBeLessThan(2);
			expect(Math.abs(moveY)).toBeLessThan(2);
		}

		// Continue dragging to 2 pixels total
		await page.mouse.move(startX + 2, startY + 2);
		await page.waitForTimeout(50);
		await page.mouse.up();

		await page.waitForTimeout(200);

		// Get final position
		const finalPos = await page.evaluate(
			({ nestedId }) => {
				const state = (window as any).__designStore.designState;
				return state.elements[nestedId].position;
			},
			{ nestedId }
		);

		console.log('Final stored position after 2px drag:', finalPos);

		// Get actual DOM position
		const finalDomPos = await page.evaluate(
			({ nestedId, childId, finalPos }) => {
				const nestedEl = document.querySelector(`[data-element-id="${nestedId}"]`) as HTMLElement;
				const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
				const canvasEl = document.querySelector('.canvas') as HTMLElement;
				if (!nestedEl || !childEl || !canvasEl) return null;

				const nestedRect = nestedEl.getBoundingClientRect();
				const childRect = childEl.getBoundingClientRect();
				const viewport = (window as any).__viewportStore?.viewport || { x: 0, y: 0, scale: 1 };

				// Calculate relative to parent
				const nestedScreenX = nestedRect.left;
				const nestedScreenY = nestedRect.top;
				const childScreenX = childRect.left;
				const childScreenY = childRect.top;

				return {
					relativeToParent: {
						x: (nestedScreenX - childScreenX) / viewport.scale,
						y: (nestedScreenY - childScreenY) / viewport.scale
					},
					stored: finalPos
				};
			},
			{ nestedId, childId, finalPos }
		);

		console.log('Final DOM position relative to parent:', finalDomPos);

		// The element should have moved slightly (about 2 pixels relative to parent)
		// But it shouldn't have jumped far away
		if (finalDomPos) {
			const expectedX = initialPos.x + 2;
			const expectedY = initialPos.y + 2;
			const actualX = finalDomPos.relativeToParent.x;
			const actualY = finalDomPos.relativeToParent.y;

			const errorX = Math.abs(actualX - expectedX);
			const errorY = Math.abs(actualY - expectedY);

			console.log(`Expected: (${expectedX}, ${expectedY}), Actual: (${actualX}, ${actualY}), Error: (${errorX}, ${errorY})`);

			// Allow some tolerance (5 pixels) for rounding and coordinate conversion
			expect(errorX).toBeLessThan(5);
			expect(errorY).toBeLessThan(5);
		}
	});
});

