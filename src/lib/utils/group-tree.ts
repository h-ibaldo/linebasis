/**
 * Group membership derived from the element tree.
 *
 * A group is a wrapper div marked with `isGroupWrapper` — a real node in the
 * tree, so flexbox lays it out as one item and the layers panel can show it at
 * any depth. That marking is what separates a group ("these move together")
 * from a plain container div ("things live inside me"), which is the same
 * distinction `isView` already draws for views.
 *
 * These helpers answer the questions the selection code asks, reading only
 * `parentId`/`children` so they work at any nesting depth. Legacy groups still
 * living in `state.groups` are handled by the callers, not here.
 */

export interface TreeElement {
	id: string;
	parentId: string | null;
	children: string[];
	isGroupWrapper?: boolean;
	isView?: boolean;
}

export type ElementMap = Record<string, TreeElement>;

/** True when this element is a group wrapper (and not a view). */
export function isGroupWrapper(element: TreeElement | undefined): boolean {
	return Boolean(element?.isGroupWrapper && !element.isView);
}

/**
 * The outermost group wrapper above `elementId`.
 *
 * Clicking a member selects the whole group, and for nested groups that means
 * the top of the chain — the same "traverse up to the root parent group" the
 * groupId code did, expressed over the tree. Stops at views so a group never
 * reaches past the page it belongs to. Returns null when the element is not in
 * a group.
 */
export function findRootGroupWrapper(elementId: string, elements: ElementMap): string | null {
	const start = elements[elementId];
	if (!start) return null;

	let rootGroupId: string | null = null;
	const visited = new Set<string>([elementId]);
	let current: TreeElement | undefined = start.parentId ? elements[start.parentId] : undefined;

	while (current) {
		if (current.isView) break;
		if (isGroupWrapper(current)) rootGroupId = current.id;

		if (!current.parentId || visited.has(current.parentId)) break;
		visited.add(current.parentId);
		current = elements[current.parentId];
	}

	return rootGroupId;
}

/**
 * The nearest group wrapper at or above `elementId`, inclusive.
 *
 * Drill-down works one level at a time, so it needs the closest group rather
 * than the outermost one.
 */
export function findNearestGroupWrapper(elementId: string, elements: ElementMap): string | null {
	const visited = new Set<string>();
	let current: TreeElement | undefined = elements[elementId];

	while (current && !visited.has(current.id)) {
		visited.add(current.id);
		if (current.isView) return null;
		if (isGroupWrapper(current)) return current.id;
		current = current.parentId ? elements[current.parentId] : undefined;
	}

	return null;
}

/**
 * Every descendant of `rootId`, excluding `rootId` itself.
 *
 * Guarded against cycles: circular parent references have shown up in stored
 * documents before and must not hang the selection path.
 */
export function collectDescendants(rootId: string, elements: ElementMap): string[] {
	const result: string[] = [];
	const visited = new Set<string>([rootId]);
	const queue = [...(elements[rootId]?.children ?? [])];

	while (queue.length > 0) {
		const id = queue.shift() as string;
		if (visited.has(id)) continue;
		visited.add(id);
		if (!elements[id]) continue;

		result.push(id);
		queue.push(...elements[id].children);
	}

	return result;
}

/**
 * What clicking `elementId` should select.
 *
 * In a group: the group wrapper itself, so the whole thing moves as a unit and
 * the selection UI frames it. Not in a group — a plain container div's child,
 * or a loose element: just the element clicked.
 *
 * `isolatedGroupId` is the group the user has drilled into. Inside it, clicking
 * selects members directly instead of re-selecting the group; a click that
 * lands outside it still resolves to a group as usual.
 */
export function resolveClickSelection(
	elementId: string,
	elements: ElementMap,
	isolatedGroupId: string | null = null
): string {
	if (!elements[elementId]) return elementId;

	if (isolatedGroupId && elements[isolatedGroupId]) {
		// Inside the isolated group, pick the child of that group that contains
		// the click, so nested groups within it still select as units.
		const visited = new Set<string>();
		let current: TreeElement | undefined = elements[elementId];

		while (current && !visited.has(current.id)) {
			visited.add(current.id);
			if (current.parentId === isolatedGroupId) return current.id;
			if (current.id === isolatedGroupId) return elementId;
			current = current.parentId ? elements[current.parentId] : undefined;
		}
		// Click landed outside the isolated group — fall through to normal rules.
	}

	return findRootGroupWrapper(elementId, elements) ?? elementId;
}
