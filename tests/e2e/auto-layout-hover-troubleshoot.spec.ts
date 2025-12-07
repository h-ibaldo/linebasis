import { test, expect } from '@playwright/test';

/**
 * Detailed troubleshooting test for hover border positioning
 * This test creates various scenarios and measures the exact misplacement
 */

test.describe('Auto Layout Hover Border Troubleshooting', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:5173');
		await page.waitForLoadState('networkidle');
		await page.waitForFunction(() => typeof (window as any).__getDesignState === 'function');
		await page.waitForTimeout(1000);
	});

	test('measure exact misplacement for different rotation angles', async ({ page }) => {
		const results: any[] = [];

		for (const rotation of [15, 30, 45, 60, 90]) {
			console.log(`\n=== Testing rotation: ${rotation}° ===`);

			// Create rotated auto-layout parent with child
			const { parentId, childId } = await page.evaluate(async (rot) => {
				const dispatch = (window as any).__dispatch;
				const nanoid = (window as any).__nanoid;
				const state = (window as any).__getDesignState();
				const pageId = Object.keys(state.pages)[0];

				const parentId = nanoid();
				const childId = nanoid();

				await dispatch({
					id: nanoid(),
					type: 'CREATE_ELEMENT',
					timestamp: Date.now(),
					payload: {
						elementId: parentId,
						pageId,
						parentId: null,
						elementType: 'div',
						position: { x: 300, y: 300 },
						size: { width: 400, height: 300 },
						content: '',
						styles: { backgroundColor: '#ffffff' },
						autoLayout: { enabled: true, direction: 'horizontal', justify: 'start', align: 'start', gap: 10 }
					}
				});

				await dispatch({
					id: nanoid(),
					type: 'ROTATE_ELEMENT',
					timestamp: Date.now(),
					payload: { elementId: parentId, rotation: rot }
				});

				await dispatch({
					id: nanoid(),
					type: 'CREATE_ELEMENT',
					timestamp: Date.now(),
					payload: {
						elementId: childId,
						pageId,
						parentId: parentId,
						elementType: 'div',
						position: { x: 50, y: 50 },
						size: { width: 100, height: 100 },
						content: '',
						styles: { backgroundColor: '#3b82f6' }
					}
				});

				return { parentId, childId };
			}, rotation);

			await page.waitForTimeout(500);

			// Hover over child
			const childSelector = `[data-element-id="${childId}"]`;
			await page.locator(childSelector).first().hover();
			await page.waitForTimeout(300);

			// Measure misplacement
			const measurement = await page.evaluate(({ childId, parentId, rotation }) => {
				// Find hover border
				const allDivs = Array.from(document.querySelectorAll('div'));
				let hoverBorder: HTMLElement | null = null;
				
				for (const div of allDivs) {
					const style = window.getComputedStyle(div);
					const borderColor = style.borderColor;
					const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
					const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)');
					
					if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
					    !(div as HTMLElement).closest('.toolbar, .layers-panel, .properties-panel')) {
						hoverBorder = div as HTMLElement;
						break;
					}
				}

				if (!hoverBorder) return { error: 'Hover border not found', rotation };

				const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
				const parentEl = document.querySelector(`[data-element-id="${parentId}"]`) as HTMLElement;
				if (!childEl || !parentEl) return { error: 'Element not found', rotation };

				// Get all corners
				const borderRect = hoverBorder.getBoundingClientRect();
				const childRect = childEl.getBoundingClientRect();

				// Get corners in screen space
				const borderCorners = [
					{ x: borderRect.left, y: borderRect.top },
					{ x: borderRect.right, y: borderRect.top },
					{ x: borderRect.right, y: borderRect.bottom },
					{ x: borderRect.left, y: borderRect.bottom }
				];

				const childCorners = [
					{ x: childRect.left, y: childRect.top },
					{ x: childRect.right, y: childRect.top },
					{ x: childRect.right, y: childRect.bottom },
					{ x: childRect.left, y: childRect.bottom }
				];

				// Calculate distances for each corner
				const cornerDistances = borderCorners.map((bc, i) => {
					const cc = childCorners[i];
					const dx = bc.x - cc.x;
					const dy = bc.y - cc.y;
					return Math.sqrt(dx * dx + dy * dy);
				});

				// Calculate center distances
				const borderCenter = { x: borderRect.left + borderRect.width / 2, y: borderRect.top + borderRect.height / 2 };
				const childCenter = { x: childRect.left + childRect.width / 2, y: childRect.top + childRect.height / 2 };
				const centerDistance = Math.sqrt(
					Math.pow(borderCenter.x - childCenter.x, 2) + Math.pow(borderCenter.y - childCenter.y, 2)
				);

				// Get transforms
				const parseRotation = (transform: string): number => {
					if (!transform || transform === 'none') return 0;
					const matrix = transform.match(/matrix\(([^)]+)\)/);
					if (!matrix) return 0;
					const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
					if (values.length < 4) return 0;
					return (Math.atan2(values[1], values[0]) * 180) / Math.PI;
				};

				let borderParentWrapper = hoverBorder.parentElement;
				while (borderParentWrapper && borderParentWrapper !== document.body) {
					const style = window.getComputedStyle(borderParentWrapper);
					if (style.position === 'fixed' && style.transform && style.transform !== 'none') break;
					borderParentWrapper = borderParentWrapper.parentElement;
				}

				const borderTransform = window.getComputedStyle(hoverBorder).transform;
				const borderWrapperTransform = borderParentWrapper ? window.getComputedStyle(borderParentWrapper).transform : 'none';
				const borderRotation = parseRotation(borderTransform) + parseRotation(borderWrapperTransform);
				const childRotation = parseRotation(window.getComputedStyle(childEl).transform);
				const parentRotation = parseRotation(window.getComputedStyle(parentEl).transform);

				return {
					rotation,
					borderRect: { left: borderRect.left, top: borderRect.top, width: borderRect.width, height: borderRect.height },
					childRect: { left: childRect.left, top: childRect.top, width: childRect.width, height: childRect.height },
					borderCenter,
					childCenter,
					centerDistance,
					cornerDistances,
					maxCornerDistance: Math.max(...cornerDistances),
					borderRotation,
					childRotation,
					parentRotation,
					rotationDiff: Math.abs(borderRotation - parentRotation)
				};
			}, { childId, parentId, rotation });

			results.push(measurement);
			console.log(`Rotation ${rotation}°: Center distance: ${measurement.centerDistance?.toFixed(2)}px, Max corner: ${measurement.maxCornerDistance?.toFixed(2)}px, Rotation diff: ${measurement.rotationDiff?.toFixed(2)}°`);

			// Take screenshot for this rotation
			await page.screenshot({ 
				path: `test-results/hover-troubleshoot-${rotation}deg.png`, 
				fullPage: true 
			});

			// Clean up for next iteration
			await page.evaluate(({ parentId }) => {
				const dispatch = (window as any).__dispatch;
				const nanoid = (window as any).__nanoid;
				dispatch({
					id: nanoid(),
					type: 'DELETE_ELEMENT',
					timestamp: Date.now(),
					payload: { elementId: parentId }
				});
			}, { parentId });
			await page.waitForTimeout(200);
		}

		// Output summary
		console.log('\n=== SUMMARY ===');
		results.forEach(r => {
			if (r.error) {
				console.log(`Rotation ${r.rotation}°: ERROR - ${r.error}`);
			} else {
				console.log(`Rotation ${r.rotation}°: Center=${r.centerDistance?.toFixed(2)}px, Corner=${r.maxCornerDistance?.toFixed(2)}px, Rot=${r.rotationDiff?.toFixed(2)}°`);
			}
		});

		// Check if any have significant misplacement
		const hasMisplacement = results.some(r => !r.error && (r.centerDistance > 5 || r.maxCornerDistance > 5 || r.rotationDiff > 2));
		if (hasMisplacement) {
			console.log('\n⚠️  MISPLACEMENT DETECTED!');
			results.filter(r => !r.error && (r.centerDistance > 5 || r.maxCornerDistance > 5 || r.rotationDiff > 2)).forEach(r => {
				console.log(`  Rotation ${r.rotation}°: Center=${r.centerDistance.toFixed(2)}px, Corner=${r.maxCornerDistance.toFixed(2)}px, Rot=${r.rotationDiff.toFixed(2)}°`);
			});
		}
	});

	test('measure misplacement for child with own rotation', async ({ page }) => {
		// Test case: child has its own rotation inside rotated auto-layout parent
		const { parentId, childId } = await page.evaluate(async () => {
			const dispatch = (window as any).__dispatch;
			const nanoid = (window as any).__nanoid;
			const state = (window as any).__getDesignState();
			const pageId = Object.keys(state.pages)[0];

			const parentId = nanoid();
			const childId = nanoid();

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: parentId,
					pageId,
					parentId: null,
					elementType: 'div',
					position: { x: 300, y: 300 },
					size: { width: 400, height: 300 },
					content: '',
					styles: { backgroundColor: '#ffffff' },
					autoLayout: { enabled: true, direction: 'horizontal', justify: 'start', align: 'start', gap: 10 }
				}
			});

			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: { elementId: parentId, rotation: 45 }
			});

			await dispatch({
				id: nanoid(),
				type: 'CREATE_ELEMENT',
				timestamp: Date.now(),
				payload: {
					elementId: childId,
					pageId,
					parentId: parentId,
					elementType: 'div',
					position: { x: 50, y: 50 },
					size: { width: 100, height: 100 },
					content: '',
					styles: { backgroundColor: '#10b981' }
				}
			});

			// Rotate child 30 degrees
			await dispatch({
				id: nanoid(),
				type: 'ROTATE_ELEMENT',
				timestamp: Date.now(),
				payload: { elementId: childId, rotation: 30 }
			});

			return { parentId, childId };
		});

		await page.waitForTimeout(500);
		await page.locator(`[data-element-id="${childId}"]`).first().hover();
		await page.waitForTimeout(300);

		const measurement = await page.evaluate(({ childId }) => {
			const allDivs = Array.from(document.querySelectorAll('div'));
			let hoverBorder: HTMLElement | null = null;
			
			for (const div of allDivs) {
				const style = window.getComputedStyle(div);
				const borderColor = style.borderColor;
				const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
				const isBlue = borderColor.includes('59, 130, 246') || borderColor.includes('rgb(59, 130, 246)');
				
				if (hasBorder && isBlue && !div.classList.contains('selection-border') && 
				    !(div as HTMLElement).closest('.toolbar, .layers-panel, .properties-panel')) {
					hoverBorder = div as HTMLElement;
					break;
				}
			}

			if (!hoverBorder) return { error: 'Hover border not found' };

			const childEl = document.querySelector(`[data-element-id="${childId}"]`) as HTMLElement;
			if (!childEl) return { error: 'Child not found' };

			const borderRect = hoverBorder.getBoundingClientRect();
			const childRect = childEl.getBoundingClientRect();

			const borderCenter = { x: borderRect.left + borderRect.width / 2, y: borderRect.top + borderRect.height / 2 };
			const childCenter = { x: childRect.left + childRect.width / 2, y: childRect.top + childRect.height / 2 };
			const centerDistance = Math.sqrt(
				Math.pow(borderCenter.x - childCenter.x, 2) + Math.pow(borderCenter.y - childCenter.y, 2)
			);

			const parseRotation = (transform: string): number => {
				if (!transform || transform === 'none') return 0;
				const matrix = transform.match(/matrix\(([^)]+)\)/);
				if (!matrix) return 0;
				const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
				if (values.length < 4) return 0;
				return (Math.atan2(values[1], values[0]) * 180) / Math.PI;
			};

			let borderParentWrapper = hoverBorder.parentElement;
			while (borderParentWrapper && borderParentWrapper !== document.body) {
				const style = window.getComputedStyle(borderParentWrapper);
				if (style.position === 'fixed' && style.transform && style.transform !== 'none') break;
				borderParentWrapper = borderParentWrapper.parentElement;
			}

			const borderTransform = window.getComputedStyle(hoverBorder).transform;
			const borderWrapperTransform = borderParentWrapper ? window.getComputedStyle(borderParentWrapper).transform : 'none';
			// Calculate total rotation by walking up DOM tree and combining all transforms
			let totalBorderRotation = 0;
			let current: HTMLElement | null = hoverBorder;
			while (current && current !== document.body) {
				const transform = window.getComputedStyle(current).transform;
				if (transform && transform !== 'none') {
					totalBorderRotation += parseRotation(transform);
				}
				current = current.parentElement as HTMLElement | null;
			}
			const borderRotation = totalBorderRotation;
			const childRotation = parseRotation(window.getComputedStyle(childEl).transform);

			const state = (window as any).__getDesignState();
			const childData = state.elements[childId];
			const parentData = state.elements[childData.parentId];

			// Check what rotation is actually applied to the border's parent div (Selection container)
			const borderParentDiv = hoverBorder.parentElement;
			const borderParentDivStyle = borderParentDiv ? window.getComputedStyle(borderParentDiv).transform : 'none';
			const borderParentDivRotation = parseRotation(borderParentDivStyle);

			// Check the border's own transform
			const borderOwnTransform = window.getComputedStyle(hoverBorder).transform;
			const borderOwnRotation = parseRotation(borderOwnTransform);

			// Check the parent wrapper (grandparent of border)
			const parentWrapper = borderParentDiv?.parentElement;
			const parentWrapperStyle = parentWrapper ? window.getComputedStyle(parentWrapper).transform : 'none';
			const parentWrapperRotation = parseRotation(parentWrapperStyle);
			const parentWrapperPosition = parentWrapper ? window.getComputedStyle(parentWrapper).position : 'none';

			return {
				centerDistance,
				borderRotation,
				borderParentDivRotation,
				borderOwnRotation,
				parentWrapperRotation,
				parentWrapperPosition,
				childRotation,
				childStoredRotation: childData.rotation || 0,
				parentStoredRotation: parentData.rotation || 0,
				expectedBorderRotation: (parentData.rotation || 0) + (childData.rotation || 0),
				rotationDiff: Math.abs(borderRotation - ((parentData.rotation || 0) + (childData.rotation || 0))),
				borderParentDivStyle,
				borderOwnTransform
			};
		}, { childId });

		console.log('Child with own rotation:', JSON.stringify(measurement, null, 2));
		await page.screenshot({ path: 'test-results/hover-troubleshoot-child-rotated.png', fullPage: true });

		expect(measurement.centerDistance).toBeLessThan(10);
		expect(measurement.rotationDiff).toBeLessThan(2);
	});
});

