/**
 * Group bounding-box geometry.
 *
 * Pure helpers behind turning a selection into a real wrapper div: the wrapper
 * must cover every selected element's *visual* extent (rotation included), and
 * each child's position has to be rebased so it stays put once it is measured
 * from the wrapper's origin instead of the old parent's.
 *
 * Kept free of store and DOM access so the geometry can be tested directly.
 */

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
}

export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * The four corners of a rect after rotating it about its own center.
 */
export function getRotatedCorners(rect: Rect): Array<{ x: number; y: number }> {
	const { x, y, width, height } = rect;
	const rotation = rect.rotation ?? 0;

	const centerX = x + width / 2;
	const centerY = y + height / 2;
	const halfW = width / 2;
	const halfH = height / 2;

	const rad = (rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	const localCorners = [
		{ x: -halfW, y: -halfH },
		{ x: halfW, y: -halfH },
		{ x: halfW, y: halfH },
		{ x: -halfW, y: halfH }
	];

	return localCorners.map((corner) => ({
		x: centerX + corner.x * cos - corner.y * sin,
		y: centerY + corner.x * sin + corner.y * cos
	}));
}

/**
 * Axis-aligned bounding box covering every rect, including rotated ones.
 *
 * Returns a zero-size box at the origin for an empty selection, so callers can
 * treat the result uniformly instead of guarding against Infinity.
 */
export function calculateGroupBounds(rects: Rect[]): Bounds {
	if (rects.length === 0) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const rect of rects) {
		const width = rect.width || 0;
		const height = rect.height || 0;

		if (rect.rotation) {
			for (const corner of getRotatedCorners({ ...rect, width, height })) {
				minX = Math.min(minX, corner.x);
				minY = Math.min(minY, corner.y);
				maxX = Math.max(maxX, corner.x);
				maxY = Math.max(maxY, corner.y);
			}
		} else {
			minX = Math.min(minX, rect.x);
			minY = Math.min(minY, rect.y);
			maxX = Math.max(maxX, rect.x + width);
			maxY = Math.max(maxY, rect.y + height);
		}
	}

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Re-express a child position relative to the wrapper's origin.
 *
 * The wrapper is placed at the bounds origin, so subtracting that origin keeps
 * every child visually where the user left it.
 */
export function toWrapperRelativePosition(
	position: { x: number; y: number },
	bounds: Bounds
): { x: number; y: number } {
	return { x: position.x - bounds.x, y: position.y - bounds.y };
}
