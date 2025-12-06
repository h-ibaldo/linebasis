import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper preservation when pasting into auto-layout container
 *
 * This test verifies that when a group is copied and pasted into an auto-layout
 * container, the group wrapper is preserved and children maintain their relative
 * positions within the wrapper.
 */

test.describe('Group Paste into Auto-Layout', () => {
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
		// 1. Create three divs in a triangle formation programmatically
		console.log('Creating three divs...');

		const { div1, div2, div3 } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0]; // Get first page ID

			// Create three divs in a triangle
			const div1Id = nanoid();
			const div2Id = nanoid();
			const div3Id = nanoid();

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

			return { div1: div1Id, div2: div2Id, div3: div3Id };
		});

		console.log('Created div1:', div1);
		console.log('Created div2:', div2);
		console.log('Created div3:', div3);
		await page.waitForTimeout(500);

		// 2. Group the three divs programmatically using CREATE_GROUP_WRAPPER
		console.log('Grouping elements...');
		await page.evaluate(async (ids) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			// Get the elements
			const div1 = state.elements[ids.div1];
			const div2 = state.elements[ids.div2];
			const div3 = state.elements[ids.div3];

			// Calculate bounding box
			const minX = Math.min(div1.position.x, div2.position.x, div3.position.x);
			const minY = Math.min(div1.position.y, div2.position.y, div3.position.y);
			const maxX = Math.max(
				div1.position.x + div1.size.width,
				div2.position.x + div2.size.width,
				div3.position.x + div3.size.width
			);
			const maxY = Math.max(
				div1.position.y + div1.size.height,
				div2.position.y + div2.size.height,
				div3.position.y + div3.size.height
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
					elementIds: [ids.div1, ids.div2, ids.div3],
					wrapperPosition: { x: minX, y: minY },
					wrapperSize: { width: maxX - minX, height: maxY - minY },
					memberOffsets: {
						[ids.div1]: { x: div1.position.x - minX, y: div1.position.y - minY },
						[ids.div2]: { x: div2.position.x - minX, y: div2.position.y - minY },
						[ids.div3]: { x: div3.position.x - minX, y: div3.position.y - minY }
					},
					parentId: null,
					pageId
				}
			});
		}, { div1, div2, div3 });
		await page.waitForTimeout(500);

		// Get the group wrapper ID
		const groupData = await page.evaluate(() => {
			const state = (window as any).__getDesignState();
			const groups = Object.values(state.groups);
			const group = groups[0] as any;
			return {
				groupId: group?.id,
				wrapperId: group?.wrapperId,
				memberIds: group?.elementIds
			};
		});
		console.log('Group created:', groupData);

		expect(groupData.wrapperId).toBeTruthy();
		expect(groupData.memberIds).toHaveLength(3);

		// Verify wrapper exists and has isGroupWrapper flag
		const wrapperData = await page.evaluate((wrapperId) => {
			const state = (window as any).__getDesignState();
			const wrapper = state.elements[wrapperId];
			return {
				exists: !!wrapper,
				isGroupWrapper: wrapper?.isGroupWrapper,
				children: wrapper?.children,
				position: wrapper?.position,
				size: wrapper?.size
			};
		}, groupData.wrapperId);
		console.log('Wrapper data:', wrapperData);

		expect(wrapperData.exists).toBe(true);
		expect(wrapperData.isGroupWrapper).toBe(true);
		expect(wrapperData.children).toHaveLength(3);

		// Store children positions relative to wrapper
		const childrenPositions = await page.evaluate((memberIds) => {
			const state = (window as any).__getDesignState();
			return memberIds.map((id: string) => ({
				id,
				position: state.elements[id]?.position,
				size: state.elements[id]?.size
			}));
		}, groupData.memberIds);
		console.log('Children positions (relative to wrapper):', childrenPositions);

		// 4. Select the wrapper and copy the group (Cmd+C)
		console.log('Copying group...');
		await page.evaluate(({ wrapperId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([wrapperId]);
		}, { wrapperId: groupData.wrapperId });
		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(300);

		// 5. Create an auto-layout container programmatically
		console.log('Creating auto-layout container...');

		const autoLayoutContainer = await page.evaluate(async () => {
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
					position: { x: 400, y: 300 },
					size: { width: 400, height: 400 },
					content: '',
					styles: { backgroundColor: '#e5e7eb' }
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
						direction: 'row',
						justifyContent: 'flex-start',
						alignItems: 'flex-start',
						gap: '16px'
					}
				}
			});

			return containerId;
		});
		console.log('Created auto-layout container:', autoLayoutContainer);
		await page.waitForTimeout(500);

		const containerData = await page.evaluate((containerId) => {
			const state = (window as any).__getDesignState();
			const container = state.elements[containerId];
			return {
				autoLayoutEnabled: container?.autoLayout?.enabled,
				children: container?.children
			};
		}, autoLayoutContainer);
		console.log('Container auto-layout enabled:', containerData);

		// 6. Select the container and paste into it (Cmd+Shift+V)
		console.log('Pasting group into auto-layout container...');
		await page.evaluate(({ containerId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([containerId]);
		}, { containerId: autoLayoutContainer });
		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+Shift+v');
		await page.waitForTimeout(1000);

		// 7. Verify the group wrapper was pasted
		const afterPaste = await page.evaluate((containerId) => {
			const state = (window as any).__getDesignState();
			const container = state.elements[containerId];
			const children = container.children.map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					type: child?.type,
					isGroupWrapper: child?.isGroupWrapper,
					groupId: child?.groupId,
					position: child?.position,
					size: child?.size,
					children: child?.children
				};
			});

			// Find groups
			const groups = Object.values(state.groups).filter((g: any) =>
				g.wrapperId && state.elements[g.wrapperId]?.parentId === containerId
			);

			return {
				containerChildren: children,
				groupsInContainer: groups.length,
				groups: groups
			};
		}, autoLayoutContainer);

		console.log('After paste:', JSON.stringify(afterPaste, null, 2));

		// ASSERTIONS
		// 1. Container should have exactly 1 child (the group wrapper)
		expect(afterPaste.containerChildren).toHaveLength(1);
		console.log('✓ Container has 1 child');

		// 2. That child should be a group wrapper
		const pastedWrapper = afterPaste.containerChildren[0];
		expect(pastedWrapper.isGroupWrapper).toBe(true);
		console.log('✓ Child is a group wrapper');

		// 3. The wrapper should have 3 children
		expect(pastedWrapper.children).toHaveLength(3);
		console.log('✓ Wrapper has 3 children');

		// 4. There should be 1 group in the container
		expect(afterPaste.groupsInContainer).toBe(1);
		console.log('✓ 1 group exists in container');

		// 5. Verify children maintained their relative positions
		const pastedChildrenPositions = await page.evaluate((wrapperId) => {
			const state = (window as any).__getDesignState();
			const wrapper = state.elements[wrapperId];
			return wrapper.children.map((id: string) => ({
				id,
				position: state.elements[id]?.position,
				size: state.elements[id]?.size
			}));
		}, pastedWrapper.id);

		console.log('Pasted children positions:', pastedChildrenPositions);

		// Children should have the same relative positions as before
		// (we can't compare IDs since they're new, but positions should match)
		for (let i = 0; i < childrenPositions.length; i++) {
			const original = childrenPositions[i];
			const pasted = pastedChildrenPositions[i];

			expect(pasted.position.x).toBeCloseTo(original.position.x, 0);
			expect(pasted.position.y).toBeCloseTo(original.position.y, 0);
			console.log(`✓ Child ${i} position preserved: (${pasted.position.x}, ${pasted.position.y})`);
		}

		console.log('✅ TEST PASSED: Group wrapper preserved with children positions intact!');
	});
});
