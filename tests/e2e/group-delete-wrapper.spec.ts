import { test, expect } from '@playwright/test';

/**
 * Test: Group wrapper should be deleted when group elements are deleted
 *
 * This test verifies that when all group elements are deleted, the wrapper
 * is also deleted and doesn't remain as an orphaned element in the layers panel.
 */

test.describe('Group Delete Wrapper', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('wrapper should be deleted when all group elements are deleted', async ({ page }) => {
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
				wrapperExists: !!wrapper,
				groupExists: !!group,
				memberIds: group?.elementIds
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// Verify group was created
		expect(groupData.wrapperExists).toBe(true);
		expect(groupData.groupExists).toBe(true);
		expect(groupData.memberIds).toHaveLength(2);

		// 3. Delete the group elements (not the wrapper directly)
		console.log('Deleting group elements...');
		const afterDelete = await page.evaluate(async (data) => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();

			// Delete the group elements (not the wrapper)
			await dispatch({
				id: nanoid(),
				type: 'GROUP_DELETE_ELEMENTS',
				timestamp: Date.now(),
				payload: {
					elementIds: data.memberIds
				}
			});

			// Get the updated state
			const updatedState = (window as any).__getDesignState();
			const wrapper = updatedState.elements[data.wrapperId];
			const group = updatedState.groups[data.groupId];
			const div1 = updatedState.elements[data.memberIds[0]];
			const div2 = updatedState.elements[data.memberIds[1]];

			// Check if wrapper is in page's canvasElements
			const pageId = Object.keys(updatedState.pages)[0];
			const page = updatedState.pages[pageId];
			const wrapperInCanvas = page?.canvasElements?.includes(data.wrapperId) || false;

			return {
				wrapperExists: !!wrapper,
				groupExists: !!group,
				div1Exists: !!div1,
				div2Exists: !!div2,
				wrapperInCanvas,
				canvasElements: page?.canvasElements || []
			};
		}, groupData);

		console.log('After delete:', JSON.stringify(afterDelete, null, 2));

		// ASSERTIONS
		// 1. Wrapper should be deleted
		expect(afterDelete.wrapperExists).toBe(false);
		console.log('✓ Wrapper was deleted');

		// 2. Group record should be deleted
		expect(afterDelete.groupExists).toBe(false);
		console.log('✓ Group record was deleted');

		// 3. Group elements should be deleted
		expect(afterDelete.div1Exists).toBe(false);
		expect(afterDelete.div2Exists).toBe(false);
		console.log('✓ Group elements were deleted');

		// 4. Wrapper should not be in page's canvasElements
		expect(afterDelete.wrapperInCanvas).toBe(false);
		console.log('✓ Wrapper removed from canvas');

		// 5. Verify wrapper doesn't appear in layers panel
		const layerTreeStructure = await page.evaluate(() => {
			const layersPanel = document.querySelector('.layers-panel');
			if (!layersPanel) return null;

			const layerItems = Array.from(layersPanel.querySelectorAll('.layer-item, .group-item'));
			
			const structure: Array<{
				type: 'element' | 'group';
				name: string;
				isGroupWrapper?: boolean;
			}> = [];

			function getElementName(element: Element): string {
				const nameSpan = element.querySelector('.element-name, .group-name');
				return nameSpan?.textContent?.trim() || '';
			}

			function isGroupItem(element: Element): boolean {
				return element.classList.contains('group-item');
			}

			for (const item of layerItems) {
				if (isGroupItem(item)) {
					const groupHeader = item.querySelector('.group-header');
					const groupName = groupHeader?.querySelector('.group-name')?.textContent?.trim() || 'Group';
					structure.push({
						type: 'group',
						name: groupName
					});
				} else {
					const name = getElementName(item);
					structure.push({
						type: 'element',
						name
					});
				}
			}

			return structure;
		});

		console.log('Layer tree structure:', JSON.stringify(layerTreeStructure, null, 2));

		// Should have no group items and no "Group" div elements
		const hasGroup = layerTreeStructure?.some(item => item.type === 'group' || item.name === 'Group');
		expect(hasGroup).toBe(false);
		console.log('✓ No group or wrapper in layers panel');

		console.log('✅ TEST PASSED: Wrapper is deleted when group elements are deleted!');
	});
});

