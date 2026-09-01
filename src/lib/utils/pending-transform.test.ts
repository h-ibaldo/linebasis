import { describe, it, expect } from 'vitest';
import { absoluteToRelativeWithOverride } from './pending-transform';
import type { DesignState, Element } from '$lib/types/events';

function makeElement(partial: Partial<Element> & { id: string }): Element {
	return {
		type: 'div',
		parentId: null,
		pageId: 'page',
		position: { x: 0, y: 0 },
		size: { width: 100, height: 100 },
		styles: {},
		typography: {},
		spacing: {},
		autoLayout: {},
		children: [],
		...partial
	} as Element;
}

function makeState(elements: Element[]): DesignState {
	return {
		pages: {},
		elements: Object.fromEntries(elements.map((el) => [el.id, el])),
		groups: {},
		components: {},
		pageOrder: [],
		currentPageId: 'page',
		selectedElementIds: []
	} as DesignState;
}

describe('absoluteToRelativeWithOverride', () => {
	it('matches a plain conversion when no override is supplied', () => {
		const parent = makeElement({ id: 'p', position: { x: 100, y: 100 } });
		const state = makeState([parent]);

		const relative = absoluteToRelativeWithOverride({ x: 150, y: 130 }, parent, state, null);

		expect(relative.x).toBeCloseTo(50, 6);
		expect(relative.y).toBeCloseTo(30, 6);
	});

	it('uses the override position instead of the stale one in state', () => {
		// The parent is mid-resize from a NW handle: state still says (100,100)
		// but it has already moved to (60,60) for this frame.
		const parent = makeElement({ id: 'p', position: { x: 100, y: 100 } });
		const state = makeState([parent]);

		const relative = absoluteToRelativeWithOverride({ x: 150, y: 130 }, parent, state, {
			position: { x: 60, y: 60 },
			size: { width: 100, height: 100 }
		});

		expect(relative.x).toBeCloseTo(90, 6);
		expect(relative.y).toBeCloseTo(70, 6);
	});

	it('rotates about the override centre, not the stale one', () => {
		// A parent rotated 90° about its own centre. With the override the centre
		// is (110,110); reading the stale state would place it at (150,150) and
		// swing every child away from the box — the reported bug.
		const parent = makeElement({
			id: 'p',
			position: { x: 100, y: 100 },
			size: { width: 100, height: 100 },
			rotation: 90
		});
		const state = makeState([parent]);

		const override = {
			position: { x: 60, y: 60 },
			size: { width: 100, height: 100 }
		};
		const centre = { x: 110, y: 110 };

		// A point sitting exactly on the override centre must map to the parent's
		// local centre regardless of rotation.
		const atCentre = absoluteToRelativeWithOverride(centre, parent, state, override);
		expect(atCentre.x).toBeCloseTo(50, 6);
		expect(atCentre.y).toBeCloseTo(50, 6);

		// A point 30px right of the centre in world space is, after un-rotating
		// by 90°, 30px *below* the centre in the parent's local frame.
		const offCentre = absoluteToRelativeWithOverride(
			{ x: centre.x + 30, y: centre.y },
			parent,
			state,
			override
		);
		expect(offCentre.x).toBeCloseTo(50, 6);
		expect(offCentre.y).toBeCloseTo(20, 6);
	});

	it('honours a resized override, so the local frame grows with the parent', () => {
		const parent = makeElement({
			id: 'p',
			position: { x: 100, y: 100 },
			size: { width: 100, height: 100 },
			rotation: 90
		});
		const state = makeState([parent]);

		// Same origin, but twice the size: the centre moves to (200,200).
		const relative = absoluteToRelativeWithOverride({ x: 200, y: 200 }, parent, state, {
			position: { x: 100, y: 100 },
			size: { width: 200, height: 200 }
		});

		expect(relative.x).toBeCloseTo(100, 6);
		expect(relative.y).toBeCloseTo(100, 6);
	});

	it('is unaffected by a cached transform for the same element id', () => {
		// The whole point of the override path: getAbsoluteTransform caches by id,
		// so a copy of the parent carrying pending values silently gets the stale
		// cached result. This path must not consult that cache at all.
		const parent = makeElement({ id: 'p', position: { x: 100, y: 100 } });
		const state = makeState([parent]);

		const first = absoluteToRelativeWithOverride({ x: 150, y: 130 }, parent, state, null);
		expect(first.x).toBeCloseTo(50, 6);

		const moved = absoluteToRelativeWithOverride({ x: 150, y: 130 }, parent, state, {
			position: { x: 0, y: 0 },
			size: { width: 100, height: 100 }
		});
		expect(moved.x).toBeCloseTo(150, 6);
		expect(moved.y).toBeCloseTo(130, 6);
	});
});
