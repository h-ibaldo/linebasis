import { describe, it, expect } from 'vitest';
import {
	calculateGroupBounds,
	getRotatedCorners,
	toWrapperRelativePosition,
	type Rect
} from './group-bounds';

describe('getRotatedCorners', () => {
	it('returns the rect corners unchanged at 0 degrees', () => {
		const corners = getRotatedCorners({ x: 10, y: 20, width: 100, height: 50, rotation: 0 });

		expect(corners).toEqual([
			{ x: 10, y: 20 },
			{ x: 110, y: 20 },
			{ x: 110, y: 70 },
			{ x: 10, y: 70 }
		]);
	});

	it('rotates about the rect center, not the origin', () => {
		// A square at the origin rotated 90° maps onto itself.
		const corners = getRotatedCorners({ x: 0, y: 0, width: 100, height: 100, rotation: 90 });

		for (const corner of corners) {
			expect(corner.x).toBeGreaterThanOrEqual(-0.0001);
			expect(corner.x).toBeLessThanOrEqual(100.0001);
			expect(corner.y).toBeGreaterThanOrEqual(-0.0001);
			expect(corner.y).toBeLessThanOrEqual(100.0001);
		}
	});
});

describe('calculateGroupBounds', () => {
	it('returns a zero box for an empty selection rather than Infinity', () => {
		expect(calculateGroupBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});

	it('wraps a single unrotated rect exactly', () => {
		const bounds = calculateGroupBounds([{ x: 10, y: 20, width: 100, height: 50 }]);

		expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
	});

	it('spans several unrotated rects', () => {
		const rects: Rect[] = [
			{ x: 0, y: 0, width: 50, height: 50 },
			{ x: 100, y: 80, width: 50, height: 20 }
		];

		expect(calculateGroupBounds(rects)).toEqual({ x: 0, y: 0, width: 150, height: 100 });
	});

	it('covers the swept extent of a rotated rect, not just its unrotated box', () => {
		// A 100x100 square rotated 45° sweeps a box of 100*sqrt(2) per side.
		const bounds = calculateGroupBounds([{ x: 0, y: 0, width: 100, height: 100, rotation: 45 }]);

		const expected = 100 * Math.SQRT2;
		expect(bounds.width).toBeCloseTo(expected, 4);
		expect(bounds.height).toBeCloseTo(expected, 4);
		// The sweep overhangs the original box on every side, centred on it.
		expect(bounds.x).toBeCloseTo((100 - expected) / 2, 4);
		expect(bounds.y).toBeCloseTo((100 - expected) / 2, 4);
	});

	it('covers a mix of rotated and unrotated rects', () => {
		// This is the shape from the reported case: four square-on tiles beside
		// four rotated ones. The wrapper has to clear the rotated sweep, which is
		// what the auto-layout run was failing to reserve room for.
		const rects: Rect[] = [
			{ x: 0, y: 0, width: 100, height: 100 },
			{ x: 200, y: 0, width: 100, height: 100, rotation: 45 }
		];

		const bounds = calculateGroupBounds(rects);
		const overhang = (100 * Math.SQRT2 - 100) / 2;

		expect(bounds.x).toBe(0);
		expect(bounds.y).toBeCloseTo(-overhang, 4);
		expect(bounds.width).toBeCloseTo(300 + overhang, 4);
		expect(bounds.height).toBeCloseTo(100 + 2 * overhang, 4);
	});

	it('treats missing width/height as zero instead of producing NaN', () => {
		const bounds = calculateGroupBounds([
			{ x: 10, y: 10 } as Rect,
			{ x: 50, y: 50, width: 10, height: 10 }
		]);

		expect(bounds).toEqual({ x: 10, y: 10, width: 50, height: 50 });
	});
});

describe('toWrapperRelativePosition', () => {
	it('rebases a child against the wrapper origin', () => {
		const bounds = { x: 100, y: 50, width: 200, height: 200 };

		expect(toWrapperRelativePosition({ x: 120, y: 70 }, bounds)).toEqual({ x: 20, y: 20 });
	});

	it('keeps every child visually put when the whole group is rebased', () => {
		const rects: Rect[] = [
			{ x: 300, y: 200, width: 50, height: 50 },
			{ x: 400, y: 260, width: 50, height: 50 }
		];
		const bounds = calculateGroupBounds(rects);

		// Wrapper origin + relative child offset must land back on the original
		// absolute position, or the group would visibly jump on grouping.
		for (const rect of rects) {
			const relative = toWrapperRelativePosition(rect, bounds);
			expect(bounds.x + relative.x).toBeCloseTo(rect.x, 6);
			expect(bounds.y + relative.y).toBeCloseTo(rect.y, 6);
		}
	});
});
