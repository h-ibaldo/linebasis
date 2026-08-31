import { describe, it, expect } from 'vitest';
import {
	collectDescendants,
	findNearestGroupWrapper,
	findRootGroupWrapper,
	isGroupWrapper,
	resolveClickSelection,
	type ElementMap,
	type TreeElement
} from './group-tree';

/** Build an element map from a compact spec, filling in children from parentId. */
function buildTree(
	spec: Array<{ id: string; parent?: string | null; group?: boolean; view?: boolean }>
): ElementMap {
	const elements: ElementMap = {};

	for (const { id, parent = null, group, view } of spec) {
		elements[id] = {
			id,
			parentId: parent,
			children: [],
			...(group ? { isGroupWrapper: true } : {}),
			...(view ? { isView: true } : {})
		};
	}

	for (const el of Object.values(elements)) {
		if (el.parentId && elements[el.parentId]) elements[el.parentId].children.push(el.id);
	}

	return elements;
}

/**
 * The shape from the reported case: a view holding a plain container div, which
 * holds a group of two nested groups, each with two leaves.
 *
 *   view
 *   └── container (plain div)
 *       └── outer (group)
 *           ├── innerA (group) → a1, a2
 *           └── innerB (group) → b1, b2
 */
const nested = buildTree([
	{ id: 'view', view: true },
	{ id: 'container', parent: 'view' },
	{ id: 'outer', parent: 'container', group: true },
	{ id: 'innerA', parent: 'outer', group: true },
	{ id: 'a1', parent: 'innerA' },
	{ id: 'a2', parent: 'innerA' },
	{ id: 'innerB', parent: 'outer', group: true },
	{ id: 'b1', parent: 'innerB' },
	{ id: 'b2', parent: 'innerB' }
]);

describe('isGroupWrapper', () => {
	it('is true only for a div flagged as a group', () => {
		expect(isGroupWrapper(nested.outer)).toBe(true);
		expect(isGroupWrapper(nested.container)).toBe(false);
		expect(isGroupWrapper(undefined)).toBe(false);
	});

	it('never treats a view as a group, even if flagged', () => {
		const el: TreeElement = {
			id: 'v',
			parentId: null,
			children: [],
			isGroupWrapper: true,
			isView: true
		};

		expect(isGroupWrapper(el)).toBe(false);
	});
});

describe('findRootGroupWrapper', () => {
	it('returns the outermost group, not the nearest one', () => {
		expect(findRootGroupWrapper('a1', nested)).toBe('outer');
	});

	it('returns null for a child of a plain container div', () => {
		// This is the group-vs-plain-div distinction: a container is not a unit.
		const tree = buildTree([
			{ id: 'container' },
			{ id: 'child', parent: 'container' }
		]);

		expect(findRootGroupWrapper('child', tree)).toBeNull();
	});

	it('returns null for a loose top-level element', () => {
		const tree = buildTree([{ id: 'solo' }]);

		expect(findRootGroupWrapper('solo', tree)).toBeNull();
	});

	it('does not escape past a view boundary', () => {
		const tree = buildTree([
			{ id: 'outerGroup', group: true },
			{ id: 'view', parent: 'outerGroup', view: true },
			{ id: 'inner', parent: 'view' }
		]);

		expect(findRootGroupWrapper('inner', tree)).toBeNull();
	});

	it('returns null for an unknown element instead of throwing', () => {
		expect(findRootGroupWrapper('ghost', nested)).toBeNull();
	});

	it('terminates on a circular parent chain', () => {
		const tree = buildTree([{ id: 'x' }, { id: 'y', parent: 'x' }]);
		tree.x.parentId = 'y'; // cycle

		expect(() => findRootGroupWrapper('y', tree)).not.toThrow();
	});
});

describe('findNearestGroupWrapper', () => {
	it('returns the closest enclosing group, not the outermost', () => {
		expect(findNearestGroupWrapper('a1', nested)).toBe('innerA');
	});

	it('returns the element itself when it is a group', () => {
		expect(findNearestGroupWrapper('innerB', nested)).toBe('innerB');
	});

	it('returns null when nothing above is a group', () => {
		expect(findNearestGroupWrapper('container', nested)).toBeNull();
	});
});

describe('collectDescendants', () => {
	it('collects the whole subtree, excluding the root', () => {
		expect(collectDescendants('outer', nested).sort()).toEqual(
			['a1', 'a2', 'b1', 'b2', 'innerA', 'innerB'].sort()
		);
	});

	it('returns an empty list for a leaf', () => {
		expect(collectDescendants('a1', nested)).toEqual([]);
	});

	it('terminates on a cycle instead of hanging', () => {
		const tree = buildTree([{ id: 'p' }, { id: 'c', parent: 'p' }]);
		tree.c.children.push('p'); // cycle back to the root

		expect(() => collectDescendants('p', tree)).not.toThrow();
		expect(collectDescendants('p', tree)).toEqual(['c']);
	});
});

describe('resolveClickSelection', () => {
	it('selects the whole group when clicking a member', () => {
		expect(resolveClickSelection('a1', nested)).toBe('outer');
	});

	it('selects only the element when clicking inside a plain container div', () => {
		const tree = buildTree([
			{ id: 'container' },
			{ id: 'child', parent: 'container' }
		]);

		expect(resolveClickSelection('child', tree)).toBe('child');
	});

	it('selects the direct child of the group being drilled into', () => {
		// Drilled into `outer`: clicking a1 selects innerA, so nested groups
		// inside the isolated one still behave as units.
		expect(resolveClickSelection('a1', nested, 'outer')).toBe('innerA');
	});

	it('selects the member itself at the deepest isolation level', () => {
		expect(resolveClickSelection('a1', nested, 'innerA')).toBe('a1');
	});

	it('falls back to group rules for a click outside the isolated group', () => {
		const tree = buildTree([
			{ id: 'groupA', group: true },
			{ id: 'a1', parent: 'groupA' },
			{ id: 'groupB', group: true },
			{ id: 'b1', parent: 'groupB' }
		]);

		// Isolated in groupA, but the click landed in groupB.
		expect(resolveClickSelection('b1', tree, 'groupA')).toBe('groupB');
	});

	it('returns the id unchanged for an unknown element', () => {
		expect(resolveClickSelection('ghost', nested)).toBe('ghost');
	});
});
