/**
 * Migration utility to convert old-style groups (metadata-only) to new wrapper-based groups
 *
 * Old-style groups: Elements have groupId but no wrapper div
 * New-style groups: Elements are children of a wrapper div with isGroupWrapper flag
 */

import type { DesignState, Element } from '$lib/types/events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Migrate all old-style groups to wrapper-based groups
 * @param state - Current design state
 * @returns Updated design state with wrapper-based groups
 */
export function migrateGroupsToWrappers(state: DesignState): DesignState {
	const newElements = { ...state.elements };
	const newGroups = { ...state.groups };
	let newPages = { ...state.pages };

	// Find all groups that don't have wrappers yet
	const groupsToMigrate = Object.entries(newGroups).filter(([_, group]) => !group.wrapperId);

	if (groupsToMigrate.length === 0) {
		// No migration needed
		return state;
	}

	console.log(`Migrating ${groupsToMigrate.length} old-style groups to wrapper-based groups...`);

	for (const [groupId, group] of groupsToMigrate) {
		// Get all group members
		const members = group.elementIds
			.map(id => newElements[id])
			.filter(Boolean);

		if (members.length === 0) {
			console.warn(`Group ${groupId} has no valid members, skipping migration`);
			continue;
		}

		// Calculate bounding box of group members (accounting for rotation)
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const member of members) {
			const rotation = member.rotation || 0;

			if (rotation !== 0) {
				// For rotated elements, calculate all four corners
				const corners = getRotatedCorners({
					x: member.position.x,
					y: member.position.y,
					width: member.size.width || 0,
					height: member.size.height || 0,
					rotation
				});

				for (const corner of corners) {
					minX = Math.min(minX, corner.x);
					minY = Math.min(minY, corner.y);
					maxX = Math.max(maxX, corner.x);
					maxY = Math.max(maxY, corner.y);
				}
			} else {
				// Non-rotated elements use simple bounds
				minX = Math.min(minX, member.position.x);
				minY = Math.min(minY, member.position.y);
				maxX = Math.max(maxX, member.position.x + (member.size.width || 0));
				maxY = Math.max(maxY, member.position.y + (member.size.height || 0));
			}
		}

		const wrapperWidth = maxX - minX;
		const wrapperHeight = maxY - minY;

		// All members should have the same parent and page
		const parentId = members[0].parentId;
		const pageId = members[0].pageId;

		// Create wrapper element
		const wrapperId = uuidv4();
		const wrapper: Element = {
			id: wrapperId,
			type: 'div',
			name: 'Group',
			isGroupWrapper: true,
			parentId,
			pageId,
			groupId: null,
			position: { x: minX, y: minY },
			size: { width: wrapperWidth, height: wrapperHeight },
			rotation: 0,
			visible: true,
			locked: false,
			styles: { display: 'block' },
			typography: {},
			spacing: {},
			children: group.elementIds
		};

		newElements[wrapperId] = wrapper;

		// Update each member to be relative to wrapper
		for (const member of members) {
			const relativePos = {
				x: member.position.x - minX,
				y: member.position.y - minY
			};

			newElements[member.id] = {
				...member,
				parentId: wrapperId,
				position: relativePos
				// Keep groupId - members still belong to the group
			};
		}

		// Update parent's children array or page's canvasElements
		if (parentId && newElements[parentId]) {
			const parent = newElements[parentId];
			// Remove member elements from parent's children
			const filteredChildren = parent.children.filter(id => !group.elementIds.includes(id));

			// Add wrapper at the position where the first member was
			const firstMemberIndex = parent.children.indexOf(group.elementIds[0]);
			const insertIndex = firstMemberIndex >= 0 ? firstMemberIndex : filteredChildren.length;

			const newChildren = [
				...filteredChildren.slice(0, insertIndex),
				wrapperId,
				...filteredChildren.slice(insertIndex)
			];

			newElements[parentId] = {
				...parent,
				children: newChildren
			};
		} else {
			// Root level - update page's canvasElements
			const page = newPages[pageId];
			if (page) {
				// Remove member elements from page's canvasElements
				const filteredElements = page.canvasElements.filter(id => !group.elementIds.includes(id));

				// Add wrapper at the position where the first member was
				const firstMemberIndex = page.canvasElements.indexOf(group.elementIds[0]);
				const insertIndex = firstMemberIndex >= 0 ? firstMemberIndex : filteredElements.length;

				const newCanvasElements = [
					...filteredElements.slice(0, insertIndex),
					wrapperId,
					...filteredElements.slice(insertIndex)
				];

				newPages = {
					...newPages,
					[pageId]: {
						...page,
						canvasElements: newCanvasElements
					}
				};
			}
		}

		// Update group record with wrapperId
		newGroups[groupId] = {
			...group,
			wrapperId
		};
	}

	console.log(`Migration complete: ${groupsToMigrate.length} groups migrated to wrapper-based system`);

	return {
		...state,
		elements: newElements,
		groups: newGroups,
		pages: newPages
	};
}

/**
 * Helper function to calculate rotated corners of a rectangle
 * (Copied from design-store.ts to avoid circular dependencies)
 */
function getRotatedCorners(rect: {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}): Array<{ x: number; y: number }> {
	const { x, y, width, height, rotation } = rect;
	const centerX = x + width / 2;
	const centerY = y + height / 2;
	const angleRad = (rotation * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);

	// Four corners of the rectangle (before rotation)
	const corners = [
		{ x, y }, // Top-left
		{ x: x + width, y }, // Top-right
		{ x: x + width, y: y + height }, // Bottom-right
		{ x, y: y + height } // Bottom-left
	];

	// Rotate each corner around the center point
	return corners.map(corner => {
		const relX = corner.x - centerX;
		const relY = corner.y - centerY;
		const rotatedX = relX * cos - relY * sin;
		const rotatedY = relX * sin + relY * cos;
		return {
			x: centerX + rotatedX,
			y: centerY + rotatedY
		};
	});
}
