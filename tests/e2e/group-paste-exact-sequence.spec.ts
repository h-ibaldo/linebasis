import { test, expect } from '@playwright/test';

/**
 * Test to verify the exact paste sequence and structure
 */

test.describe('Group Paste Exact Sequence', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('verify wrapper is in parent and children are in wrapper', async ({ page }) => {
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

		// 2. Copy the wrapper
		await page.evaluate(({ wrapperId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([wrapperId]);
		}, { wrapperId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(300);

		// 3. Create a regular parent div (NO auto-layout)
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
					// NO autoLayout
				}
			});

			return { parentDivId };
		});

		await page.waitForTimeout(500);

		// 4. Select parent and paste
		await page.evaluate(({ parentDivId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([parentDivId]);
		}, { parentDivId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+Shift+v');
		await page.waitForTimeout(1500);

		// 5. Check the EXACT structure
		const structure = await page.evaluate(({ parentDivId }) => {
			const state = (window as any).__getDesignState();
			const parent = state.elements[parentDivId];
			
			// Get all direct children of parent
			const parentDirectChildren = (parent?.children || []).map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					type: child?.type,
					isGroupWrapper: child?.isGroupWrapper,
					parentId: child?.parentId,
					children: child?.children || []
				};
			});

			// Find wrapper
			const wrapper = parentDirectChildren.find((c: any) => c.isGroupWrapper);
			
			// If wrapper exists, get its children
			const wrapperChildren = wrapper ? (wrapper.children || []).map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					parentId: child?.parentId,
					type: child?.type
				};
			}) : [];

			// Check if any elements are direct children of parent (should only be wrapper)
			const nonWrapperChildren = parentDirectChildren.filter((c: any) => !c.isGroupWrapper);

			return {
				parentId: parentDivId,
				parentChildrenCount: parentDirectChildren.length,
				parentDirectChildren: parentDirectChildren.map((c: any) => ({
					id: c.id,
					isGroupWrapper: c.isGroupWrapper,
					childrenCount: c.children.length
				})),
				hasWrapper: !!wrapper,
				wrapperId: wrapper?.id,
				wrapperChildrenCount: wrapperChildren.length,
				wrapperChildren: wrapperChildren,
				nonWrapperChildrenCount: nonWrapperChildren.length,
				nonWrapperChildren: nonWrapperChildren
			};
		}, { parentDivId });

		console.log('EXACT STRUCTURE:', JSON.stringify(structure, null, 2));

		// CRITICAL ASSERTIONS
		// Parent should have exactly 1 child
		expect(structure.parentChildrenCount).toBe(1);
		
		// That child MUST be the wrapper
		expect(structure.hasWrapper).toBe(true);
		expect(structure.wrapperId).toBeTruthy();
		
		// Wrapper should have 2 children
		expect(structure.wrapperChildrenCount).toBe(2);
		
		// No non-wrapper children in parent
		expect(structure.nonWrapperChildrenCount).toBe(0);
		
		// All wrapper children should have wrapper as parent
		for (const child of structure.wrapperChildren) {
			expect(child.parentId).toBe(structure.wrapperId);
		}
	});
});

