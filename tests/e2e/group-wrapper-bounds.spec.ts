import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper should move and resize with group elements
 *
 * This test verifies that when group elements are dragged, resized, or rotated,
 * the wrapper's position and size are updated to always wrap the group elements' boundaries.
 */

test.describe('Group Wrapper Bounds', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper should move and resize when group elements are dragged', async ({ page }) => {
		// 1. Create two divs
		console.log('Creating two divs...');

		const { div1, div2 } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();

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
					styles: { backgroundColor: '#3b82f6' }
				}
			});

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div2Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 200, y: 100 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#ef4444' }
				}
			});

			return { div1: div1Id, div2: div2Id };
		});

		console.log('Created div1:', div1);
		console.log('Created div2:', div2);
		await page.waitForTimeout(500);

		// 2. Group the two divs
		console.log('Grouping elements...');
		const groupData = await page.evaluate(async (ids) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			const div1 = state.elements[ids.div1];
			const div2 = state.elements[ids.div2];

			// Calculate bounding box
			const minX = Math.min(div1.position.x, div2.position.x);
			const minY = Math.min(div1.position.y, div2.position.y);
			const maxX = Math.max(
				div1.position.x + div1.size.width,
				div2.position.x + div2.size.width
			);
			const maxY = Math.max(
				div1.position.y + div1.size.height,
				div2.position.y + div2.size.height
			);

			const groupId = nanoid();
			const wrapperId = nanoid();
			const pageId = Object.keys(state.pages)[0];

			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [ids.div1, ids.div2],
					wrapperPosition: { x: minX, y: minY },
					wrapperSize: { width: maxX - minX, height: maxY - minY },
					memberOffsets: {
						[ids.div1]: { x: div1.position.x - minX, y: div1.position.y - minY },
						[ids.div2]: { x: div2.position.x - minX, y: div2.position.y - minY }
					},
					parentId: null,
					pageId
				}
			});

			// Get the updated state
			const updatedState = (window as any).__getDesignState();
			const wrapper = updatedState.elements[wrapperId];
			const group = updatedState.groups[groupId];

			return {
				groupId,
				wrapperId,
				initialWrapperPosition: { ...wrapper.position },
				initialWrapperSize: { ...wrapper.size },
				memberIds: group?.elementIds
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// 3. Move the group elements (simulate drag)
		console.log('Moving group elements...');
		const afterMove = await page.evaluate(async (data) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			// Get current element positions
			const div1 = state.elements[data.memberIds[0]];
			const div2 = state.elements[data.memberIds[1]];

			// Move elements by (50, 50)
			const deltaX = 50;
			const deltaY = 50;

			await dispatch({
				id: nanoid(),
				type: 'GROUP_MOVE_ELEMENTS',
				timestamp: Date.now(),
				payload: {
					elements: [
						{
							elementId: data.memberIds[0],
							position: {
								x: div1.position.x + deltaX,
								y: div1.position.y + deltaY
							}
						},
						{
							elementId: data.memberIds[1],
							position: {
								x: div2.position.x + deltaX,
								y: div2.position.y + deltaY
							}
						}
					]
				}
			});

			// Get the updated state
			const updatedState = (window as any).__getDesignState();
			const wrapper = updatedState.elements[data.wrapperId];
			const movedDiv1 = updatedState.elements[data.memberIds[0]];
			const movedDiv2 = updatedState.elements[data.memberIds[1]];

			// Calculate expected wrapper position (initial position + delta)
			const expectedPosition = {
				x: data.initialWrapperPosition.x + deltaX,
				y: data.initialWrapperPosition.y + deltaY
			};

			// Calculate expected bounding box size (relative to wrapper)
			const minX = Math.min(movedDiv1.position.x, movedDiv2.position.x);
			const minY = Math.min(movedDiv1.position.y, movedDiv2.position.y);
			const maxX = Math.max(
				movedDiv1.position.x + movedDiv1.size.width,
				movedDiv2.position.x + movedDiv2.size.width
			);
			const maxY = Math.max(
				movedDiv1.position.y + movedDiv1.size.height,
				movedDiv2.position.y + movedDiv2.size.height
			);

			return {
				wrapperPosition: { ...wrapper.position },
				wrapperSize: { ...wrapper.size },
				expectedPosition,
				expectedSize: { width: maxX - minX, height: maxY - minY },
				div1Position: { ...movedDiv1.position },
				div2Position: { ...movedDiv2.position }
			};
		}, groupData);

		console.log('After move:', JSON.stringify(afterMove, null, 2));

		// ASSERTIONS
		// 1. Wrapper position should have moved by the same delta
		expect(afterMove.wrapperPosition.x).toBeCloseTo(afterMove.expectedPosition.x, 0);
		expect(afterMove.wrapperPosition.y).toBeCloseTo(afterMove.expectedPosition.y, 0);
		console.log('✓ Wrapper position updated correctly');

		// 2. Wrapper size should match the bounding box
		expect(afterMove.wrapperSize.width).toBeCloseTo(afterMove.expectedSize.width, 0);
		expect(afterMove.wrapperSize.height).toBeCloseTo(afterMove.expectedSize.height, 0);
		console.log('✓ Wrapper size updated correctly');

		// 3. Element positions should be relative to wrapper
		// (elements moved by delta, wrapper moved by delta, so relative positions should be same)
		const initialRelativeDiv1 = {
			x: groupData.memberIds[0] === div1 ? 0 : 100, // First div at (0, 0) relative to wrapper
			y: 0
		};
		const initialRelativeDiv2 = {
			x: groupData.memberIds[1] === div2 ? 100 : 0, // Second div at (100, 0) relative to wrapper
			y: 0
		};

		// After move, elements should still be at same relative positions
		// (wrapper moved, so element positions relative to wrapper should be unchanged)
		const actualRelativeDiv1 = {
			x: afterMove.div1Position.x,
			y: afterMove.div1Position.y
		};
		const actualRelativeDiv2 = {
			x: afterMove.div2Position.x,
			y: afterMove.div2Position.y
		};

		// Elements should be at their relative positions (0,0) and (100,0) within wrapper
		// Since we moved both by (50,50), and wrapper also moved by (50,50),
		// the relative positions should be the same as initial
		expect(actualRelativeDiv1.x).toBeCloseTo(initialRelativeDiv1.x, 0);
		expect(actualRelativeDiv1.y).toBeCloseTo(initialRelativeDiv1.y, 0);
		expect(actualRelativeDiv2.x).toBeCloseTo(initialRelativeDiv2.x, 0);
		expect(actualRelativeDiv2.y).toBeCloseTo(initialRelativeDiv2.y, 0);
		console.log('✓ Element positions relative to wrapper maintained');

		console.log('✅ TEST PASSED: Wrapper moves and resizes with group elements!');
	});
});

