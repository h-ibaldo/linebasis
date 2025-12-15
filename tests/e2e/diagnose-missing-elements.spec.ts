import { test, expect } from '@playwright/test';

test.describe('Diagnose Missing Elements', () => {
	test('should check for invalid positions in all elements', async ({ page }) => {
		await page.goto('http://localhost:5175');
		await page.waitForSelector('.canvas', { timeout: 5000 });

		// Get all elements and check for invalid positions
		const diagnostics = await page.evaluate(() => {
			const state = (window as any).__designStore.designState;
			const invalidElements = [];

			for (const [id, element] of Object.entries(state.elements)) {
				const el = element as any;
				const pos = el.position;

				if (!pos) {
					invalidElements.push({
						id,
						issue: 'NO_POSITION',
						element: { id: el.id, type: el.type, parentId: el.parentId }
					});
					continue;
				}

				if (!isFinite(pos.x) || !isFinite(pos.y)) {
					invalidElements.push({
						id,
						issue: 'INFINITE_POSITION',
						position: pos,
						element: { id: el.id, type: el.type, parentId: el.parentId }
					});
				}

				if (isNaN(pos.x) || isNaN(pos.y)) {
					invalidElements.push({
						id,
						issue: 'NAN_POSITION',
						position: pos,
						element: { id: el.id, type: el.type, parentId: el.parentId }
					});
				}

				// Check for absurdly large values (likely off-screen)
				if (Math.abs(pos.x) > 100000 || Math.abs(pos.y) > 100000) {
					invalidElements.push({
						id,
						issue: 'HUGE_POSITION',
						position: pos,
						element: { id: el.id, type: el.type, parentId: el.parentId }
					});
				}
			}

			return {
				totalElements: Object.keys(state.elements).length,
				invalidElements
			};
		});

		console.log('=== ELEMENT DIAGNOSTICS ===');
		console.log(`Total elements: ${diagnostics.totalElements}`);
		console.log(`Invalid elements: ${diagnostics.invalidElements.length}`);

		if (diagnostics.invalidElements.length > 0) {
			console.log('\nInvalid elements found:');
			for (const invalid of diagnostics.invalidElements) {
				console.log(`  - ${invalid.issue}: Element ${invalid.element.id} (${invalid.element.type})`);
				if (invalid.position) {
					console.log(`    Position: (${invalid.position.x}, ${invalid.position.y})`);
				}
				console.log(`    Parent: ${invalid.element.parentId || 'ROOT'}`);
			}
		} else {
			console.log('✓ All elements have valid positions');
		}

		// This test always passes - it's just for diagnostics
		expect(diagnostics.totalElements).toBeGreaterThanOrEqual(0);
	});
});
