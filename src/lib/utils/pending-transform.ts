/**
 * Coordinate conversion against a parent whose transform is still pending.
 *
 * During a resize the parent's committed position and size in `state` are the
 * pre-drag ones — the new values only exist as pending interaction state until
 * mouse release. The regular `absoluteToRelative` cannot be told about them:
 * it delegates to `getAbsoluteTransform`, which caches by element id, so a copy
 * of the parent carrying pending values gets handed back the stale cached
 * result. On a rotated parent that means children are un-rotated about a centre
 * that has already moved, and they visibly swing off the selection box.
 *
 * This module does the same conversion but takes the parent's live transform as
 * an explicit override, consulting no cache.
 */

import type { DesignState, Element } from '$lib/types/events';
import { getAbsolutePosition, absoluteToRelative } from './coordinates';

export interface PendingTransform {
	position: { x: number; y: number };
	size: { width: number; height: number };
}

/**
 * Total rotation applied to `element`, including its own and every ancestor's.
 */
function cumulativeRotation(element: Element, state: DesignState): number {
	let total = element.rotation || 0;
	const visited = new Set<string>([element.id]);
	let current = element;

	while (current.parentId && !visited.has(current.parentId)) {
		visited.add(current.parentId);
		const parent = state.elements[current.parentId];
		if (!parent) break;
		total += parent.rotation || 0;
		current = parent;
	}

	return total;
}

/**
 * Convert an absolute canvas point into a position relative to `parent`.
 *
 * With `override` null this defers to the regular conversion. With an override
 * it uses those pending values for the parent's origin, size and centre, so the
 * result tracks what the user is dragging rather than what is committed.
 */
export function absoluteToRelativeWithOverride(
	absolutePos: { x: number; y: number },
	parent: Element | null,
	state: DesignState,
	override: PendingTransform | null
): { x: number; y: number } {
	if (!parent) return { x: absolutePos.x, y: absolutePos.y };
	if (!override) return absoluteToRelative(absolutePos, parent, state);

	const rotation = cumulativeRotation(parent, state);

	// The pending position is expressed in the parent's own coordinate space.
	// Anything above it in the tree is unchanged, so its committed offset still
	// applies; subtracting the committed origin yields that ancestor offset.
	const committedAbs = getAbsolutePosition(parent, state);
	const ancestorOffset = {
		x: committedAbs.x - parent.position.x,
		y: committedAbs.y - parent.position.y
	};

	const originAbs = {
		x: ancestorOffset.x + override.position.x,
		y: ancestorOffset.y + override.position.y
	};

	if (!rotation || Math.abs(rotation % 360) < 0.0001) {
		return {
			x: absolutePos.x - originAbs.x,
			y: absolutePos.y - originAbs.y
		};
	}

	// CSS rotates about the element's centre, so un-rotate around the pending
	// centre and then re-express the result from the pending top-left.
	const halfW = override.size.width / 2;
	const halfH = override.size.height / 2;
	const centreAbs = { x: originAbs.x + halfW, y: originAbs.y + halfH };

	const dx = absolutePos.x - centreAbs.x;
	const dy = absolutePos.y - centreAbs.y;

	const rad = (-rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	return {
		x: dx * cos - dy * sin + halfW,
		y: dx * sin + dy * cos + halfH
	};
}
