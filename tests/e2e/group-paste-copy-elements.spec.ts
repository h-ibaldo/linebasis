import { test, expect } from '@playwright/test';

/**
 * Test to verify that when copying group elements (not the wrapper), the wrapper is still included
 */

test.describe('Group Paste Copy Elements', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper should be included when copying group elements (not wrapper)', async ({ page }) => {
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

		// 2. Select the GROUP ELEMENTS (not the wrapper)
		await page.evaluate(({ div1Id, div2Id }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([div1Id, div2Id]);
		}, { div1Id, div2Id });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+c');
		await page.waitForTimeout(300);

		// 3. Create a regular parent div
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

		// 4. Select parent and paste
		await page.evaluate(({ parentDivId }) => {
			const selectElements = (window as any).__selectElements;
			selectElements([parentDivId]);
		}, { parentDivId });

		await page.waitForTimeout(200);
		await page.keyboard.press('Meta+Shift+v');
		await page.waitForTimeout(1500);

		// 5. Check structure
		const structure = await page.evaluate(({ parentDivId }) => {
			const state = (window as any).__getDesignState();
			const parent = state.elements[parentDivId];
			
			const parentChildren = (parent?.children || []).map((id: string) => {
				const child = state.elements[id];
				return {
					id,
					isGroupWrapper: child?.isGroupWrapper,
					children: child?.children || []
				};
			});

			const wrapper = parentChildren.find((c: any) => c.isGroupWrapper);

			return {
				parentChildrenCount: parentChildren.length,
				hasWrapper: !!wrapper,
				wrapperChildrenCount: wrapper?.children.length || 0
			};
		}, { parentDivId });

		console.log('STRUCTURE:', JSON.stringify(structure, null, 2));

		// ASSERTIONS
		expect(structure.parentChildrenCount).toBe(1);
		expect(structure.hasWrapper).toBe(true);
		expect(structure.wrapperChildrenCount).toBe(2);
	});
});

