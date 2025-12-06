import { test, expect } from '@playwright/test';

/**
 * Test: Layer tree should not show extra div layer for groups
 *
 * This test verifies that when a group is created, the layer tree shows:
 * - Group layer (with expand/collapse)
 *   - Group elements (children)
 *
 * NOT:
 * - Div layer (the wrapper)
 *   - Group layer
 *     - Group elements
 */

test.describe('Layer Tree Group Display', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');

		// Wait for design store to be exposed on window
		await page.waitForFunction(() => {
			return typeof (window as any).__getDesignState === 'function';
		}, { timeout: 10000 });

		await page.waitForTimeout(1000);
	});

	test('should show group layer without extra div layer in layer tree', async ({ page }) => {
		// 1. Create two divs programmatically
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

		// 2. Group the two divs programmatically using CREATE_GROUP_WRAPPER
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
				wrapperIsGroupWrapper: wrapper?.isGroupWrapper,
				wrapperType: wrapper?.type,
				groupExists: !!group,
				memberIds: group?.elementIds
			};
		}, { div1, div2 });

		console.log('Group created:', groupData);
		await page.waitForTimeout(500);

		// Verify group was created correctly
		expect(groupData.wrapperExists).toBe(true);
		expect(groupData.wrapperIsGroupWrapper).toBe(true);
		expect(groupData.wrapperType).toBe('div');
		expect(groupData.groupExists).toBe(true);
		expect(groupData.memberIds).toHaveLength(2);

		// 3. Check the layer tree structure by examining the DOM
		console.log('Checking layer tree structure...');

		// Wait for layers window to be visible (it should be by default)
		const layersWindow = page.locator('text=Layers').locator('..');
		await expect(layersWindow).toBeVisible();

		// Get the layer tree structure from the DOM
		const layerTreeStructure = await page.evaluate(() => {
			// Find the layers panel
			const layersPanel = document.querySelector('.layers-panel');
			if (!layersPanel) return null;

			// Find all layer items
			const layerItems = Array.from(layersPanel.querySelectorAll('.layer-item, .group-item'));
			
			const structure: Array<{
				type: 'element' | 'group';
				name: string;
				depth: number;
				children?: Array<{ type: string; name: string; depth: number }>;
			}> = [];

			function getDepth(element: Element): number {
				let depth = 0;
				let current = element.parentElement;
				while (current && current !== layersPanel) {
					if (current.classList.contains('layer-item') || current.classList.contains('group-item')) {
						depth++;
					}
					current = current.parentElement;
				}
				return depth;
			}

			function getElementName(element: Element): string {
				const nameSpan = element.querySelector('.element-name, .group-name');
				return nameSpan?.textContent?.trim() || '';
			}

			function isGroupHeader(element: Element): boolean {
				return element.classList.contains('group-header');
			}

			function isGroupItem(element: Element): boolean {
				return element.classList.contains('group-item');
			}

			// Process each layer item
			for (const item of layerItems) {
				const depth = getDepth(item);
				
				// Check if it's a group item
				if (isGroupItem(item)) {
					const groupHeader = item.querySelector('.group-header');
					const groupName = groupHeader?.querySelector('.group-name')?.textContent?.trim() || 'Group';
					
					// Get children from group-children
					const groupChildren = item.querySelector('.group-children');
					const children: Array<{ type: string; name: string; depth: number }> = [];
					
					if (groupChildren) {
						const childItems = groupChildren.querySelectorAll('.layer-item');
						for (const child of childItems) {
							const childName = getElementName(child);
							const childDepth = getDepth(child);
							children.push({
								type: 'element',
								name: childName,
								depth: childDepth
							});
						}
					}

					structure.push({
						type: 'group',
						name: groupName,
						depth,
						children
					});
				} else {
					// Regular element
					const name = getElementName(item);
					structure.push({
						type: 'element',
						name,
						depth
					});
				}
			}

			return structure;
		});

		console.log('Layer tree structure:', JSON.stringify(layerTreeStructure, null, 2));

		// ASSERTIONS
		// 1. Should have exactly one root-level item (the group)
		expect(layerTreeStructure).toBeTruthy();
		const rootItems = layerTreeStructure?.filter(item => item.depth === 0) || [];
		expect(rootItems.length).toBe(1);
		console.log('✓ Found exactly one root-level item');

		// 2. The root item should be a group, not a div
		const rootItem = rootItems[0];
		expect(rootItem.type).toBe('group');
		expect(rootItem.name).toBe('Group');
		console.log('✓ Root item is a group, not a div');

		// 3. The group should have 2 children (the two divs)
		expect(rootItem.children).toBeDefined();
		expect(rootItem.children?.length).toBe(2);
		console.log('✓ Group has 2 children');

		// 4. The children should be divs (not another group layer)
		const children = rootItem.children || [];
		for (const child of children) {
			expect(child.type).toBe('element');
			expect(child.name).toBe('Div');
			console.log(`✓ Child "${child.name}" is an element, not a group`);
		}

		// 5. Verify there's NO div layer at the root level
		const rootDivs = rootItems.filter(item => item.type === 'element' && item.name === 'Div');
		expect(rootDivs.length).toBe(0);
		console.log('✓ No extra div layer at root level');

		// 6. Verify the wrapper div is NOT shown in the layer tree
		// (it should be hidden because isGroupWrapper is true)
		const allItems = layerTreeStructure || [];
		const wrapperDivs = allItems.filter(
			item => item.type === 'element' && item.name === 'Group' && item.depth === 0
		);
		expect(wrapperDivs.length).toBe(0);
		console.log('✓ Wrapper div is not shown in layer tree');

		console.log('✅ TEST PASSED: Layer tree shows group correctly without extra div layer!');
	});
});

