import { test, expect } from '@playwright/test';

/**
 * Debug test to see what's actually happening during paste
 */

test.describe('Group Paste Debug', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('debug paste structure step by step', async ({ page }) => {
		// 1. Create a group with 2 elements
		const { wrapperId, div1Id, div2Id } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();
			const groupId = nanoid();
			const wrapperId = nanoid();

			// Create two divs
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

			// Group them
			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [div1Id, div2Id],
					wrapperPosition: { x: 100, y: 100 },
					wrapperSize: { width: 200, height: 100 },
					memberOffsets: {
						[div1Id]: { x: 0, y: 0 },
						[div2Id]: { x: 100, y: 0 }
					},
					parentId: null,
					pageId
				}
			});

			return { wrapperId, div1Id, div2Id };
		});

		await page.waitForTimeout(500);

		// 2. Verify structure before copy
		const beforeCopy = await page.evaluate(({ wrapperId, div1Id, div2Id }) => {
			const state = (window as any).__getDesignState();
			const wrapper = state.elements[wrapperId];
			const div1 = state.elements[div1Id];
			const div2 = state.elements[div2Id];
			const group = Object.values(state.groups).find((g: any) => g.wrapperId === wrapperId);

			return {
				wrapperParentId: wrapper?.parentId,
				wrapperChildren: wrapper?.children || [],
				div1ParentId: div1?.parentId,
				div2ParentId: div2?.parentId,
				groupElementIds: group ? group.elementIds : []
			};
		}, { wrapperId, div1Id, div2Id });

		console.log('BEFORE COPY:', JSON.stringify(beforeCopy, null, 2));
		expect(beforeCopy.wrapperChildren.length).toBe(2);
		expect(beforeCopy.div1ParentId).toBe(wrapperId);
		expect(beforeCopy.div2ParentId).toBe(wrapperId);

		// 3. Copy the wrapper
		await page.evaluate(({ wrapperId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([wrapperId]);
		}, { wrapperId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(300);

		// 4. Create a regular parent div
		const { parentDivId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const parentDivId = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentDivId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 500, y: 100 },
					size: { width: 400, height: 400 },
					content: '',
					styles: { backgroundColor: '#e5e7eb', border: '2px solid #9ca3af' }
				}
			});

			return { parentDivId };
		});

		await page.waitForTimeout(500);

		// 5. Select parent and paste
		await page.evaluate(({ parentDivId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([parentDivId]);
		}, { parentDivId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+Shift+v');
		await page.waitForTimeout(1500);

		// 6. Check structure after paste
		const afterPaste = await page.evaluate(({ parentDivId, wrapperId, div1Id, div2Id }) => {
			const state = (window as any).__getDesignState();
			const parent = state.elements[parentDivId];
			
			// Get all children of parent
			const parentChildren = (parent?.children || []).map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					type: child?.type,
					isGroupWrapper: child?.isGroupWrapper,
					parentId: child?.parentId,
					children: child?.children || [],
					childrenDetails: (child?.children || []).map((childId: string) => {
						const c = state.elements[childId];
						return {
							id: childId,
							parentId: c?.parentId
						};
					})
				};
			});

			// Check if original IDs are in parent's children
			const originalIds = new Set([wrapperId, div1Id, div2Id]);
			const parentHasOriginalIds = parentChildren.some((c: any) => originalIds.has(c.id));

			// Find wrapper
			const wrapper = parentChildren.find((c: any) => c.isGroupWrapper);

			// Get all groups
			const allGroups = Object.values(state.groups);
			const pastedGroup = allGroups.find((g: any) => {
				if (!g.wrapperId) return false;
				const wrapperEl = state.elements[g.wrapperId];
				return wrapperEl?.parentId === parentDivId;
			});

			return {
				parentChildrenCount: parentChildren.length,
				parentChildren: parentChildren,
				parentHasOriginalIds,
				hasWrapper: !!wrapper,
				wrapperDetails: wrapper,
				pastedGroupExists: !!pastedGroup,
				pastedGroupWrapperId: pastedGroup ? (pastedGroup as any).wrapperId : null,
				pastedGroupElementIds: pastedGroup ? (pastedGroup as any).elementIds : []
			};
		}, { parentDivId, wrapperId, div1Id, div2Id });

		console.log('AFTER PASTE:', JSON.stringify(afterPaste, null, 2));

		// ASSERTIONS
		expect(afterPaste.parentChildrenCount).toBe(1);
		expect(afterPaste.hasWrapper).toBe(true);
		expect(afterPaste.wrapperDetails.children.length).toBe(2);
		expect(afterPaste.pastedGroupExists).toBe(true);
		
		// Verify children are children of wrapper, not parent
		for (const childId of afterPaste.wrapperDetails.children) {
			const child = afterPaste.wrapperDetails.childrenDetails.find((c: any) => c.id === childId);
			expect(child?.parentId).toBe(afterPaste.wrapperDetails.id);
		}
	});
});

