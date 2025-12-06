import { test, expect } from '@playwright/test';

/**
 * Comprehensive test to verify wrapper is preserved when pasting group into any div
 * This test verifies the exact structure the user expects:
 * <parent-div><group-wrapper><element /><element />...</group-wrapper></parent-div>
 * NOT: <parent-div><element /><element />...</parent-div>
 */

test.describe('Group Paste Wrapper Verification', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper MUST be in parent div after paste - NOT just the elements', async ({ page }) => {
		// 1. Create a group with 3 elements
		const { wrapperId, div1Id, div2Id, div3Id } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const div1Id = nanoid();
			const div2Id = nanoid();
			const div3Id = nanoid();
			const groupId = nanoid();
			const wrapperId = nanoid();

			// Create three divs
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

			// Group them
			await dispatch({
				id: nanoid(),
				type: 'CREATE_GROUP_WRAPPER',
				timestamp: Date.now(),
				payload: {
					groupId,
					wrapperId,
					elementIds: [div1Id, div2Id, div3Id],
					wrapperPosition: { x: 100, y: 100 },
					wrapperSize: { width: 200, height: 200 },
					memberOffsets: {
						[div1Id]: { x: 0, y: 0 },
						[div2Id]: { x: 100, y: 0 },
						[div3Id]: { x: 50, y: 100 }
					},
					parentId: null,
					pageId
				}
			});

			return { wrapperId, div1Id, div2Id, div3Id };
		});

		await page.waitForTimeout(500);

		// 2. Verify group structure before copy
		const beforeCopy = await page.evaluate(({ wrapperId, div1Id, div2Id, div3Id }) => {
			const state = (window as any).__getDesignState();
			const wrapper = state.elements[wrapperId];
			const group = Object.values(state.groups).find((g: any) => g.wrapperId === wrapperId);
			
			return {
				wrapperExists: !!wrapper,
				wrapperIsGroupWrapper: wrapper?.isGroupWrapper,
				wrapperChildren: wrapper?.children || [],
				groupExists: !!group,
				groupElementIds: group ? group.elementIds : [],
				allElementsInGroup: [div1Id, div2Id, div3Id].every(id => group?.elementIds.includes(id))
			};
		}, { wrapperId, div1Id, div2Id, div3Id });

		expect(beforeCopy.wrapperExists).toBe(true);
		expect(beforeCopy.wrapperIsGroupWrapper).toBe(true);
		expect(beforeCopy.groupExists).toBe(true);
		expect(beforeCopy.allElementsInGroup).toBe(true);
		expect(beforeCopy.wrapperChildren.length).toBe(3);

		// 3. Copy the wrapper
		await page.evaluate(({ wrapperId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([wrapperId]);
		}, { wrapperId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(300);

		// 4. Create a parent div (NOT auto-layout, just a regular div)
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
		await page.waitForTimeout(1000);

		// 6. CRITICAL VERIFICATION: Check the exact structure
		const afterPaste = await page.evaluate(({ parentDivId, div1Id, div2Id, div3Id }) => {
			const state = (window as any).__getDesignState();
			const parent = state.elements[parentDivId];
			
			// Get all children of parent
			const parentChildren = (parent?.children || []).map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					type: child?.type,
					isGroupWrapper: child?.isGroupWrapper,
					children: child?.children || []
				};
			});

			// Find the wrapper (if it exists)
			const wrapper = parentChildren.find((c: any) => c.isGroupWrapper);
			
			// Check if any of the original element IDs are direct children of parent
			const originalElementIds = new Set([div1Id, div2Id, div3Id]);
			const directChildrenAreOriginalElements = parentChildren.some((c: any) => 
				originalElementIds.has(c.id) && !c.isGroupWrapper
			);

			// Get all groups to find the pasted group
			const allGroups = Object.values(state.groups);
			const pastedGroup = allGroups.find((g: any) => {
				if (!g.wrapperId) return false;
				const wrapperEl = state.elements[g.wrapperId];
				return wrapperEl?.parentId === parentDivId;
			});

			return {
				parentChildrenCount: parentChildren.length,
				hasWrapper: !!wrapper,
				wrapperId: wrapper?.id,
				wrapperChildrenCount: wrapper?.children.length || 0,
				directChildrenAreOriginalElements,
				parentChildren: parentChildren.map((c: any) => ({
					id: c.id,
					isGroupWrapper: c.isGroupWrapper,
					childrenCount: c.children.length
				})),
				pastedGroupExists: !!pastedGroup,
				pastedGroupWrapperId: pastedGroup ? (pastedGroup as any).wrapperId : null,
				pastedGroupElementIds: pastedGroup ? (pastedGroup as any).elementIds : []
			};
		}, { parentDivId, div1Id, div2Id, div3Id });

		console.log('AFTER PASTE STRUCTURE:', JSON.stringify(afterPaste, null, 2));

		// CRITICAL ASSERTIONS
		// 1. Parent should have exactly 1 child (the wrapper)
		expect(afterPaste.parentChildrenCount).toBe(1);
		
		// 2. That child MUST be a group wrapper
		expect(afterPaste.hasWrapper).toBe(true);
		expect(afterPaste.wrapperId).toBeTruthy();
		
		// 3. The wrapper should have 3 children (the group elements)
		expect(afterPaste.wrapperChildrenCount).toBe(3);
		
		// 4. The original elements should NOT be direct children of parent
		expect(afterPaste.directChildrenAreOriginalElements).toBe(false);
		
		// 5. A group record should exist with the wrapper
		expect(afterPaste.pastedGroupExists).toBe(true);
		expect(afterPaste.pastedGroupWrapperId).toBe(afterPaste.wrapperId);
		expect(afterPaste.pastedGroupElementIds.length).toBe(3);
	});
});

