import { test, expect } from '@playwright/test';

test.describe('Duplicate Missing Elements Bug', () => {
	test('should not lose elements after duplicate and refresh', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get page ID
		const pageId = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			return Object.keys(state.pages)[0];
		});

		console.log('Using page ID:', pageId);

		// Create parent div
		const parentId = await page.evaluate(
			async ({ pageId }) => {
				const { createElement } = (window as any).__designStore;
				return await createElement({
					elementType: 'div',
					parentId: null,
					pageId,
					position: { x: 100, y: 100 },
					size: { width: 300, height: 300 },
					styles: {
						backgroundColor: '#e0e0e0',
						border: '2px solid black'
					}
				});
			},
			{ pageId }
		);

		// Create 3 children inside parent
		const childIds = [];
		for (let i = 0; i < 3; i++) {
			const childId = await page.evaluate(
				async ({ parentId, pageId, index }) => {
					const { createElement } = (window as any).__designStore;
					return await createElement({
						elementType: 'div',
						parentId,
						pageId,
						position: { x: 20 + index * 80, y: 20 + index * 80 },
						size: { width: 60, height: 60 },
						styles: {
							backgroundColor: `hsl(${index * 120}, 70%, 60%)`,
							border: '2px solid rgba(0,0,0,0.3)'
						}
					});
				},
				{ parentId, pageId, index: i }
			);
			childIds.push(childId);
		}

		console.log('Created parent:', parentId);
		console.log('Created children:', childIds);

		await page.waitForTimeout(500);

		// Get positions BEFORE duplicate
		const positionsBeforeDuplicate = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const elements = {};
			for (const [id, el] of Object.entries(state.elements)) {
				const element = el as any;
				elements[id] = {
					id: id.slice(0, 8),
					type: element.type,
					position: element.position,
					parentId: element.parentId?.slice(0, 8) || 'ROOT'
				};
			}
			return elements;
		});

		console.log('\n=== BEFORE DUPLICATE ===');
		console.table(Object.values(positionsBeforeDuplicate));

		// Select parent and duplicate it
		await page.evaluate(
			({ parentId }) => {
				const { selectElement, duplicateElements } = (window as any).__designStore;
				selectElement(parentId);
			},
			{ parentId }
		);

		await page.waitForTimeout(100);

		// Duplicate (Cmd+D)
		await page.evaluate(() => {
			(window as any).__designStore.duplicateElements();
		});

		await page.waitForTimeout(500);

		// Get positions AFTER duplicate
		const positionsAfterDuplicate = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const elements = {};
			const invalidElements = [];

			for (const [id, el] of Object.entries(state.elements)) {
				const element = el as any;
				const pos = element.position;

				elements[id] = {
					id: id.slice(0, 8),
					type: element.type,
					x: pos.x,
					y: pos.y,
					parentId: element.parentId?.slice(0, 8) || 'ROOT'
				};

				// Check for invalid positions
				if (!isFinite(pos.x) || !isFinite(pos.y) || isNaN(pos.x) || isNaN(pos.y)) {
					invalidElements.push({
						id: id.slice(0, 8),
						issue: isNaN(pos.x) || isNaN(pos.y) ? 'NaN' : 'Infinity',
						position: pos
					});
				}

				// Check for absurdly large values
				if (Math.abs(pos.x) > 10000 || Math.abs(pos.y) > 10000) {
					invalidElements.push({
						id: id.slice(0, 8),
						issue: 'HUGE_POSITION',
						position: pos
					});
				}
			}

			return { elements, invalidElements };
		});

		console.log('\n=== AFTER DUPLICATE ===');
		console.table(Object.values(positionsAfterDuplicate.elements));

		if (positionsAfterDuplicate.invalidElements.length > 0) {
			console.log('\n⚠️  INVALID ELEMENTS FOUND:');
			console.table(positionsAfterDuplicate.invalidElements);
		}

		const elementCountAfterDuplicate = Object.keys(positionsAfterDuplicate.elements).length;
		console.log(`\nTotal elements after duplicate: ${elementCountAfterDuplicate}`);

		// Should have doubled (parent + 3 children = 4, duplicated = 8 total)
		expect(elementCountAfterDuplicate).toBe(8);

		// No elements should have invalid positions
		expect(positionsAfterDuplicate.invalidElements.length).toBe(0);

		// NOW REFRESH THE PAGE
		console.log('\n=== REFRESHING PAGE ===');
		await page.reload();
		await page.waitForSelector('.canvas', { timeout: 5000 });
		await page.waitForTimeout(500);

		// Get positions AFTER refresh
		const positionsAfterRefresh = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const elements = {};
			const invalidElements = [];

			for (const [id, el] of Object.entries(state.elements)) {
				const element = el as any;
				const pos = element.position;

				elements[id] = {
					id: id.slice(0, 8),
					type: element.type,
					x: pos.x,
					y: pos.y,
					parentId: element.parentId?.slice(0, 8) || 'ROOT'
				};

				// Check for invalid positions
				if (!isFinite(pos.x) || !isFinite(pos.y) || isNaN(pos.x) || isNaN(pos.y)) {
					invalidElements.push({
						id: id.slice(0, 8),
						issue: isNaN(pos.x) || isNaN(pos.y) ? 'NaN' : 'Infinity',
						position: pos
					});
				}

				// Check for absurdly large values
				if (Math.abs(pos.x) > 10000 || Math.abs(pos.y) > 10000) {
					invalidElements.push({
						id: id.slice(0, 8),
						issue: 'HUGE_POSITION',
						position: pos
					});
				}
			}

			return { elements, invalidElements, totalCount: Object.keys(state.elements).length };
		});

		console.log('\n=== AFTER REFRESH ===');
		console.table(Object.values(positionsAfterRefresh.elements));

		if (positionsAfterRefresh.invalidElements.length > 0) {
			console.log('\n⚠️  INVALID ELEMENTS FOUND AFTER REFRESH:');
			console.table(positionsAfterRefresh.invalidElements);
		}

		console.log(`\nTotal elements after refresh: ${positionsAfterRefresh.totalCount}`);

		// Should still have 8 elements
		expect(positionsAfterRefresh.totalCount).toBe(8);

		// No elements should have invalid positions after refresh
		expect(positionsAfterRefresh.invalidElements.length).toBe(0);

		// Compare positions before and after refresh
		const positionChanges = [];
		for (const id in positionsAfterDuplicate.elements) {
			const before = positionsAfterDuplicate.elements[id];
			const after = positionsAfterRefresh.elements[id];

			if (after) {
				const deltaX = Math.abs(after.x - before.x);
				const deltaY = Math.abs(after.y - before.y);

				if (deltaX > 0.1 || deltaY > 0.1) {
					positionChanges.push({
						id: before.id,
						type: before.type,
						beforeX: before.x,
						beforeY: before.y,
						afterX: after.x,
						afterY: after.y,
						deltaX,
						deltaY
					});
				}
			} else {
				console.log(`⚠️  Element ${id.slice(0, 8)} DISAPPEARED after refresh!`);
			}
		}

		if (positionChanges.length > 0) {
			console.log('\n⚠️  POSITIONS CHANGED AFTER REFRESH:');
			console.table(positionChanges);
		} else {
			console.log('\n✓ All positions remained stable after refresh');
		}

		// Positions should NOT change after refresh (allow tiny floating point tolerance)
		expect(positionChanges.length).toBe(0);

		console.log('\n✓ Test passed - no missing elements and positions stable');
	});
});
