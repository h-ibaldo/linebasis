import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper preservation when pasting into auto-layout container
 *
 * This test verifies that when a group is copied and pasted into an auto-layout
 * container, the group wrapper is preserved with:
 * - display: block
 * - Original dimensions
 * - Element positions within the wrapper maintained
 */

test.describe('Group Paste Wrapper Preservation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('should preserve group wrapper when pasting into auto-layout container', async ({ page }) => {
		// 1. Create three divs in a triangle formation
		const { div1Id, div2Id, div3Id } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();
			const div3Id = nanoid();

			// Create three divs in a triangle
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

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: div3Id,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 150, y: 200 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#10b981' }
				}
			});

			return { div1Id, div2Id, div3Id };
		});

		await page.waitForTimeout(500);

		// 2. Group the three divs
		const { groupId, wrapperId } = await page.evaluate(async ({ div1Id, div2Id, div3Id }) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const groupId = nanoid();
			const wrapperId = nanoid();

			// Calculate wrapper bounds
			const elements = [div1Id, div2Id, div3Id].map(id => state.elements[id]);
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const el of elements) {
				minX = Math.min(minX, el.position.x);
				minY = Math.min(minY, el.position.y);
				maxX = Math.max(maxX, el.position.x + el.size.width);
				maxY = Math.max(maxY, el.position.y + el.size.height);
			}

			const wrapperPosition = { x: minX, y: minY };
			const wrapperSize = { width: maxX - minX, height: maxY - minY };

			// Calculate member offsets (relative to wrapper)
			const memberOffsets: Record<string, { x: number; y: number }> = {};
			for (const el of elements) {
				memberOffsets[el.id] = {
					x: el.position.x - wrapperPosition.x,
					y: el.position.y - wrapperPosition.y
				};
			}

			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [div1Id, div2Id, div3Id],
					wrapperPosition,
					wrapperSize,
					memberOffsets,
					parentId: null,
					pageId
				}
			});

			return { groupId, wrapperId };
		}, { div1Id, div2Id, div3Id });

		await page.waitForTimeout(500);

		// 3. Get wrapper properties before copy (including relative positions)
		const beforeCopy = await page.evaluate(({ wrapperId }) => {
			const state = (window as any).__getDesignState();
			const wrapper = state.elements[wrapperId];
			const group = Object.values(state.groups).find((g: any) => g.wrapperId === wrapperId);
			const members = group ? group.elementIds.map((id: string) => {
				const el = state.elements[id];
				return {
					id,
					position: el?.position, // This is already relative to wrapper
					size: el?.size
				};
			}) : [];

			return {
				wrapperSize: wrapper.size,
				wrapperPosition: wrapper.position,
				wrapperStyles: wrapper.styles,
				wrapperIsGroupWrapper: wrapper.isGroupWrapper,
				memberPositions: members.map(m => m.position), // Relative positions
				memberSizes: members.map(m => m.size)
			};
		}, { wrapperId });

		// 4. Select the wrapper and copy
		await page.evaluate(({ wrapperId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([wrapperId]);
		}, { wrapperId });

		await page.waitForTimeout(200);

		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(200);

		// 5. Create an auto-layout container
		const { autoLayoutContainerId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const containerId = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: containerId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 500, y: 100 },
					size: { width: 400, height: 400 },
					content: '',
					styles: { backgroundColor: '#e5e7eb', border: '2px solid #9ca3af' }
				}
			});

			// Enable auto-layout
			await dispatch({
				id: nanoid(),
				type: 'UPDATE_AUTO_LAYOUT',
				timestamp: Date.now(),
				payload: {
					elementId: containerId,
					autoLayout: {
						enabled: true,
						direction: 'column',
						justifyContent: 'flex-start',
						alignItems: 'flex-start',
						gap: '10px'
					}
				}
			});

			return { autoLayoutContainerId: containerId };
		});

		await page.waitForTimeout(500);

		// 6. Select the auto-layout container and paste
		await page.evaluate(({ autoLayoutContainerId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([autoLayoutContainerId]);
		}, { autoLayoutContainerId });

		await page.waitForTimeout(200);

		await page.keyboard.press('Meta+Shift+v');
		await page.waitForTimeout(1000);

		// 7. Verify the group wrapper was preserved
		const afterPaste = await page.evaluate(({ autoLayoutContainerId }) => {
			const state = (window as any).__getDesignState();
			const container = state.elements[autoLayoutContainerId];
			const children = container.children.map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					type: child?.type,
					isGroupWrapper: child?.isGroupWrapper,
					size: child?.size,
					styles: child?.styles,
					position: child?.position,
					children: child?.children
				};
			});

			// Find the pasted group wrapper
			const pastedWrapper = children.find((c: any) => c.isGroupWrapper);
			if (!pastedWrapper) {
				return { error: 'No wrapper found' };
			}

			// Get the group
			const group = Object.values(state.groups).find((g: any) => g.wrapperId === pastedWrapper.id);
			if (!group) {
				return { error: 'No group found' };
			}

			// Get member positions
			const members = group.elementIds.map((id: string) => ({
				id,
				position: state.elements[id]?.position,
				size: state.elements[id]?.size
			}));

			return {
				wrapperFound: true,
				wrapperSize: pastedWrapper.size,
				wrapperStyles: pastedWrapper.styles,
				wrapperPosition: pastedWrapper.position,
				memberCount: members.length,
				memberPositions: members.map(m => m.position),
				memberSizes: members.map(m => m.size)
			};
		}, { autoLayoutContainerId });

		// ASSERTIONS
		expect(afterPaste.error).toBeUndefined();
		expect(afterPaste.wrapperFound).toBe(true);
		expect(afterPaste.memberCount).toBe(3);

		// Wrapper should have display: block
		expect(afterPaste.wrapperStyles?.display).toBe('block');

		// Wrapper dimensions should be preserved
		expect(afterPaste.wrapperSize.width).toBe(beforeCopy.wrapperSize.width);
		expect(afterPaste.wrapperSize.height).toBe(beforeCopy.wrapperSize.height);

		// Member positions within wrapper should be preserved (relative positions)
		// Note: In auto-layout, wrapper position is (0,0), so member positions should match original relative positions
		// The member positions in beforeCopy are already relative to the wrapper
		// So we can directly compare them
		expect(afterPaste.memberPositions[0].x).toBe(beforeCopy.memberPositions[0].x);
		expect(afterPaste.memberPositions[0].y).toBe(beforeCopy.memberPositions[0].y);
		expect(afterPaste.memberPositions[1].x).toBe(beforeCopy.memberPositions[1].x);
		expect(afterPaste.memberPositions[1].y).toBe(beforeCopy.memberPositions[1].y);
		expect(afterPaste.memberPositions[2].x).toBe(beforeCopy.memberPositions[2].x);
		expect(afterPaste.memberPositions[2].y).toBe(beforeCopy.memberPositions[2].y);

		// Member sizes should be preserved
		expect(afterPaste.memberSizes[0].width).toBe(beforeCopy.memberSizes[0].width);
		expect(afterPaste.memberSizes[0].height).toBe(beforeCopy.memberSizes[0].height);
	});
});

