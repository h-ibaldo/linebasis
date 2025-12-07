import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper should resize when a single element in the group is moved
 *
 * This test verifies that when dragging an individual element from a group,
 * the wrapper resizes to always wrap the boundaries of all group elements.
 */

test.describe('Group Single Element Move', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper should resize when a single group element is moved', async ({ page }) => {
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
			const groupedDiv1 = updatedState.elements[ids.div1];
			const groupedDiv2 = updatedState.elements[ids.div2];

			return {
				groupId,
				wrapperId,
				initialWrapperPosition: { ...wrapper.position },
				initialWrapperSize: { ...wrapper.size },
				memberIds: group?.elementIds,
				div1Position: { ...groupedDiv1.position },
				div2Position: { ...groupedDiv2.position }
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// Verify initial state
		expect(groupData.initialWrapperSize.width).toBe(200); // 100 (div1) + 100 (div2)
		expect(groupData.initialWrapperSize.height).toBe(100);

		// 3. Move only the first element (simulate dragging individual element)
		console.log('Moving single element...');
		const afterMove = await page.evaluate(async (data) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			// Get current element positions
			const div1 = state.elements[data.memberIds[0]];

			// Move div1 by (50, 50) relative to wrapper
			await dispatch({
				id: nanoid(),
				type: 'MOVE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: data.memberIds[0],
					position: {
						x: div1.position.x + 50,
						y: div1.position.y + 50
					}
				}
			});

			// Get the updated state
			const updatedState = (window as any).__getDesignState();
			const wrapper = updatedState.elements[data.wrapperId];
			const movedDiv1 = updatedState.elements[data.memberIds[0]];
			const div2 = updatedState.elements[data.memberIds[1]];

			// Calculate expected bounding box
			const minX = Math.min(movedDiv1.position.x, div2.position.x);
			const minY = Math.min(movedDiv1.position.y, div2.position.y);
			const maxX = Math.max(
				movedDiv1.position.x + movedDiv1.size.width,
				div2.position.x + div2.size.width
			);
			const maxY = Math.max(
				movedDiv1.position.y + movedDiv1.size.height,
				div2.position.y + div2.size.height
			);

			return {
				wrapperPosition: { ...wrapper.position },
				wrapperSize: { ...wrapper.size },
				expectedSize: { width: maxX - minX, height: maxY - minY },
				div1Position: { ...movedDiv1.position },
				div2Position: { ...div2.position }
			};
		}, groupData);

		console.log('After move:', JSON.stringify(afterMove, null, 2));

		// ASSERTIONS
		// 1. Wrapper size should match the expected bounding box
		// When div1 moves by (50, 50), the bounding box changes
		expect(afterMove.wrapperSize.width).toBeCloseTo(afterMove.expectedSize.width, 0);
		expect(afterMove.wrapperSize.height).toBeCloseTo(afterMove.expectedSize.height, 0);
		console.log('✓ Wrapper size updated correctly');

		// 2. Wrapper should have resized to fit all elements
		// The wrapper size should match the calculated bounding box
		expect(afterMove.wrapperSize.width).toBe(afterMove.expectedSize.width);
		expect(afterMove.wrapperSize.height).toBe(afterMove.expectedSize.height);
		console.log('✓ Wrapper resized to fit all elements');

		// 3. Element positions should be relative to wrapper
		// Both elements should still be within the wrapper bounds
		expect(afterMove.div1Position.x).toBeGreaterThanOrEqual(0);
		expect(afterMove.div1Position.y).toBeGreaterThanOrEqual(0);
		expect(afterMove.div2Position.x).toBeGreaterThanOrEqual(0);
		expect(afterMove.div2Position.y).toBeGreaterThanOrEqual(0);
		console.log('✓ Element positions relative to wrapper maintained');

		console.log('✅ TEST PASSED: Wrapper resizes when single element is moved!');
	});
});

