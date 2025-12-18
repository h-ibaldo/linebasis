/**
 * Tests for Figma-style drill-down isolation logic
 */

import { describe, it, expect } from 'vitest';
import {
	buildHierarchy,
	getAllElementsInGroup,
	handleDoubleClick,
	handleSingleClick,
	findChildAtIsolationLevel
} from './drill-down-figma-logic';
import type { Group } from '$lib/stores/design-store';

// Test data structure: ga(gb(gba(a,b), gbb(c,d)), gc(gca(e,f), gcb(g,h)))
const testGroups: Record<string, Group> = {
	ga: {
		id: 'ga',
		name: 'Group A',
		parentGroupId: null,
		elementIds: [],
		isAutoLayout: false
	},
	gb: {
		id: 'gb',
		name: 'Group B',
		parentGroupId: 'ga',
		elementIds: [],
		isAutoLayout: false
	},
	gc: {
		id: 'gc',
		name: 'Group C',
		parentGroupId: 'ga',
		elementIds: [],
		isAutoLayout: false
	},
	gba: {
		id: 'gba',
		name: 'Group BA',
		parentGroupId: 'gb',
		elementIds: ['a', 'b'],
		isAutoLayout: false
	},
	gbb: {
		id: 'gbb',
		name: 'Group BB',
		parentGroupId: 'gb',
		elementIds: ['c', 'd'],
		isAutoLayout: false
	},
	gca: {
		id: 'gca',
		name: 'Group CA',
		parentGroupId: 'gc',
		elementIds: ['e', 'f'],
		isAutoLayout: false
	},
	gcb: {
		id: 'gcb',
		name: 'Group CB',
		parentGroupId: 'gc',
		elementIds: ['g', 'h'],
		isAutoLayout: false
	}
};

describe('buildHierarchy', () => {
	it('builds hierarchy from leaf to root', () => {
		const hierarchy = buildHierarchy('gba', testGroups);
		expect(hierarchy).toEqual(['ga', 'gb', 'gba']);
	});

	it('builds hierarchy for root group', () => {
		const hierarchy = buildHierarchy('ga', testGroups);
		expect(hierarchy).toEqual(['ga']);
	});
});

describe('getAllElementsInGroup', () => {
	it('gets elements from leaf group', () => {
		const elements = getAllElementsInGroup('gba', testGroups);
		expect(elements).toEqual(['a', 'b']);
	});

	it('gets all elements from parent group recursively', () => {
		const elements = getAllElementsInGroup('gb', testGroups);
		expect(elements).toEqual(['a', 'b', 'c', 'd']);
	});

	it('gets all elements from root group', () => {
		const elements = getAllElementsInGroup('ga', testGroups);
		expect(elements).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
	});
});

describe('findChildAtIsolationLevel', () => {
	it('finds child of isolated group', () => {
		const child = findChildAtIsolationLevel('gba', 'ga', testGroups);
		expect(child).toBe('gb');
	});

	it('returns null if element not in isolation', () => {
		const child = findChildAtIsolationLevel('gca', 'gb', testGroups);
		expect(child).toBe(null);
	});
});

describe('handleDoubleClick - Figma behavior', () => {
	it('Step 1: Double-click elem.a from root → isolates ga, selects gb', () => {
		const result = handleDoubleClick('gba', 'a', [], testGroups);

		expect(result.newIsolationStack).toEqual(['ga']);
		expect(result.groupToSelect).toBe('gb');
		expect(result.elementsToSelect).toEqual(['a', 'b', 'c', 'd']); // All of gb
	});

	it('Step 2: While gb/gc isolated, double-click gb → isolates gb, selects gba', () => {
		const result = handleDoubleClick('gba', 'a', ['ga'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gb']);
		expect(result.groupToSelect).toBe('gba');
		expect(result.elementsToSelect).toEqual(['a', 'b']); // All of gba
	});

	it('Step 3: While gba/gbb isolated, double-click gba → isolates gba, selects elem.a', () => {
		const result = handleDoubleClick('gba', 'a', ['ga', 'gb'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gb', 'gba']);
		expect(result.groupToSelect).toBe('a');
		expect(result.elementsToSelect).toEqual(['a']); // Single element
	});
});

describe('handleSingleClick - Figma behavior', () => {
	it('From root: click elem.a → selects all of ga', () => {
		const result = handleSingleClick('gba', 'a', [], testGroups);

		expect(result.newIsolationStack).toEqual([]);
		expect(result.elementsToSelect).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']); // All of ga
		expect(result.shouldDismantle).toBe(false);
	});

	it('While ga isolated: click between gb and gc switches selection', () => {
		// Click elem from gc
		const result = handleSingleClick('gca', 'e', ['ga'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga']); // Isolation unchanged
		expect(result.elementsToSelect).toEqual(['e', 'f', 'g', 'h']); // All of gc
		expect(result.shouldDismantle).toBe(false);
	});

	it('While gb isolated: click gc → dismantles gb isolation, selects gc', () => {
		// gb is isolated (stack: [ga, gb]), click elem from gc
		const result = handleSingleClick('gca', 'e', ['ga', 'gb'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga']); // Dismantled gb isolation
		expect(result.elementsToSelect).toEqual(['e', 'f', 'g', 'h']); // All of gc
		expect(result.shouldDismantle).toBe(true);
	});

	it('While gba isolated: click gbb → dismantles gba isolation, selects gbb', () => {
		// gba is isolated (stack: [ga, gb, gba]), click elem from gbb
		const result = handleSingleClick('gbb', 'c', ['ga', 'gb', 'gba'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gb']); // Dismantled gba isolation
		expect(result.elementsToSelect).toEqual(['c', 'd']); // All of gbb
		expect(result.shouldDismantle).toBe(true);
	});

	it('While gba isolated: click gc → dismantles gb and gba isolation, selects gc', () => {
		// gba is isolated (stack: [ga, gb, gba]), click elem from gc
		const result = handleSingleClick('gca', 'e', ['ga', 'gb', 'gba'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga']); // Dismantled to common ancestor (ga)
		expect(result.elementsToSelect).toEqual(['e', 'f', 'g', 'h']); // All of gc
		expect(result.shouldDismantle).toBe(true);
	});

	it('While ga isolated: click ungrouped element → dismantles all isolation', () => {
		const result = handleSingleClick(null, 'ungrouped', ['ga'], testGroups);

		expect(result.newIsolationStack).toEqual([]); // All isolation cleared
		expect(result.elementsToSelect).toEqual(['ungrouped']);
		expect(result.shouldDismantle).toBe(true);
	});

	it('While gcb isolated (element level): click between elem.e and elem.f switches selection', () => {
		// gcb is isolated (stack: [ga, gc, gcb]), click elem.f after elem.e was selected
		const result = handleSingleClick('gca', 'f', ['ga', 'gc', 'gca'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gc', 'gca']); // Isolation maintained
		expect(result.elementsToSelect).toEqual(['f']); // Just elem.f, not both e and f
		expect(result.shouldDismantle).toBe(false);
	});

	it('While gcb isolated (element level): click elem.g switches to elem.g', () => {
		// gca is isolated (stack: [ga, gc, gca]), click elem.e
		const result = handleSingleClick('gca', 'e', ['ga', 'gc', 'gca'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gc', 'gca']); // Isolation maintained
		expect(result.elementsToSelect).toEqual(['e']); // Just elem.e
		expect(result.shouldDismantle).toBe(false);
	});

	it('While gba isolated (element level): click elem.c in gbb → dismantles to gb level', () => {
		// gba is isolated (stack: [ga, gb, gba]), showing elem.a and elem.b
		// Click elem.c which is in gbb
		const result = handleSingleClick('gbb', 'c', ['ga', 'gb', 'gba'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gb']); // Dismantle to gb level
		expect(result.elementsToSelect).toEqual(['c', 'd']); // Select gbb's elements
		expect(result.shouldDismantle).toBe(true);
	});

	it('While gba isolated (element level): click between elem.a and elem.b stays in gba', () => {
		// gba is isolated (stack: [ga, gb, gba]), showing elem.a and elem.b
		// Click elem.b after elem.a was selected
		const result = handleSingleClick('gba', 'b', ['ga', 'gb', 'gba'], testGroups);

		expect(result.newIsolationStack).toEqual(['ga', 'gb', 'gba']); // Stay isolated in gba
		expect(result.elementsToSelect).toEqual(['b']); // Just elem.b
		expect(result.shouldDismantle).toBe(false);
	});
});
