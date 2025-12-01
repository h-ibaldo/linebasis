# Architecture Refactor Status - View System Simplification

**Branch**: `fix/layer-reordering-canvas-children`
**Date**: 2025-11-27
**Status**: IN PROGRESS - Documentation complete, code changes pending

## Problem Summary

The codebase had TWO conflicting data structures for "View":
1. **Separate `View` interface** - A data structure in `designState.views` with its own `elements[]` array
2. **Element with `isView: true`** - A div element with view properties

This was wrong. There should only be ONE concept.

## Correct Architecture (Per User Requirements)

### Core Concepts

**PAGE**:
- A route (e.g., `/homepage`, `/about`)
- Has ONE canvas
- URL that users visit to see the published webpage

**CANVAS**:
- The design environment for ONE page
- Opens when you click "Edit Page"
- Contains all elements for that page, including views

**VIEW**:
- A div element with `isView = true`
- Represents a responsive breakpoint (e.g., Desktop 1920px, Mobile 375px)
- Created by drawing a div and converting it to a view
- The view's width = breakpoint width
- The view's children = content visible at that breakpoint
- Multiple views on one canvas = multiple responsive breakpoints for the same page

**PUBLISHING**:
- Takes all views (elements with `isView = true`) from the canvas
- Generates responsive code with media queries based on view widths
- Creates the actual webpage for the route

### Data Structure

```typescript
Page {
  id: string
  name: string  // "Homepage"
  slug: string  // "homepage"
  canvasElements: string[]  // Root element IDs (DOM order, index 0 = bottom)
}

Element {
  id: string
  type: 'div' | 'p' | 'img' | ...
  pageId: string  // Elements belong to a page's canvas
  parentId: string | null  // null = root canvas element
  children: string[]  // Child element IDs (DOM order)

  // If this is a view (breakpoint container):
  isView?: boolean
  viewName?: string  // "Desktop", "Mobile"
  breakpointWidth?: number  // 1920, 375
}

DesignState {
  pages: Record<string, Page>
  elements: Record<string, Element>
  currentPageId: string | null
  // NO views object
  // NO currentViewId
}
```

## Changes Completed

### 1. Documentation ✅

**Files updated**:
- `docs/planning/LAYERS-ARCHITECTURE.md` - Completely rewritten to reflect single View concept
- `docs/planning/page-builder-spec.md` - "Views and Breakpoints" section replaced with "Canvas, Pages, and Views"
- `.cursorrules` - Updated critical architectural principles

**Key changes**:
- Removed all references to "View Object" as separate data structure
- Clarified that views are just div elements with `isView = true`
- Updated all examples to use `page.canvasElements[]` instead of `view.elements[]`
- Explained canvas = ONE page, multiple views = multiple breakpoints

### 2. Type System Cleanup ✅

**File**: `src/lib/types/events.ts`

**Changes**:
- ❌ REMOVED `View` interface (lines 571-579)
- ❌ REMOVED from `EventType`: `CREATE_VIEW`, `UPDATE_VIEW`, `DELETE_VIEW`, `RESIZE_VIEW`
- ❌ REMOVED from `DesignEvent` union: `CreateViewEvent`, `UpdateViewEvent`, `DeleteViewEvent`, `ResizeViewEvent`
- ❌ REMOVED event interfaces: `CreateViewEvent`, `UpdateViewEvent`, `DeleteViewEvent`, `ResizeViewEvent`
- ✅ UPDATED `Page` interface: replaced `views: string[]` with `canvasElements: string[]`
- ✅ UPDATED `DesignState` interface: removed `views` and `currentViewId`
- ✅ UPDATED `CreateElementEvent.payload`: changed `viewId` to `pageId`

## Changes Pending (Next Agent Tasks)

### 3. Fix Remaining viewId References in events.ts

**File**: `src/lib/types/events.ts`
**Line**: 492 - Element interface still has `viewId: string`

**Action needed**:
```typescript
// FIND THIS (around line 492):
viewId: string; // Elements belong to views (breakpoint views)

// CHANGE TO:
pageId: string; // Elements belong to a page's canvas
```

### 4. Update Event Reducer

**File**: `src/lib/stores/event-reducer.ts`

**Actions needed**:
1. Remove View event handlers (lines ~174-181):
   - Remove `case 'CREATE_VIEW':`
   - Remove `case 'UPDATE_VIEW':`
   - Remove `case 'DELETE_VIEW':`
   - Remove `case 'RESIZE_VIEW':`

2. Remove View handler functions (lines ~938-1050):
   - Remove `handleCreateView()`
   - Remove `handleUpdateView()`
   - Remove `handleDeleteView()`
   - Remove `handleResizeView()`

3. Update `handleCreateElement()`:
   - Change parameter from `viewId` to `pageId`
   - Remove element from adding to `view.elements[]`
   - ADD element to `page.canvasElements[]` if `parentId === null`
   - Update element object to use `pageId` instead of `viewId`

4. Update `handleReorderElement()`:
   - Change from using `view.elements[]` to `page.canvasElements[]`
   - Update all references

5. Update `handleShiftElementLayer()`:
   - Change from using `view.elements[]` to `page.canvasElements[]`
   - Update all references

6. Update `handleDeleteElement()`:
   - Remove from `page.canvasElements[]` if root element
   - Remove from `parent.children[]` if nested

### 5. Update Design Store

**File**: `src/lib/stores/design-store.ts`

**Actions needed**:
1. Fix `createPage()` function (lines ~416-456):
   - Remove the `CREATE_VIEW` event dispatch entirely
   - Remove `viewId` variable
   - Don't set `currentViewId`
   - Page starts with empty `canvasElements[]`

2. Update `createElement()` function:
   - Change `viewId` parameter to `pageId`
   - Pass `pageId` to `CREATE_ELEMENT` event

3. Update `setCurrentPage()` function (lines ~496-521):
   - Remove logic for setting `currentViewId`
   - Only set `currentPageId`

4. Remove or update any functions that reference `currentViewId` or `views`

### 6. Update Layer Ordering Components

**Files**:
- `src/lib/components/canvas/LayersWindow.svelte`
- `src/lib/components/canvas/LayerTreeItem.svelte`

**Actions needed**:

**LayersWindow.svelte** (lines ~28-39):
```typescript
// CURRENT (WRONG):
$: rootElements = $designState.currentViewId && $designState.views[$designState.currentViewId]
  ? $designState.views[$designState.currentViewId].elements
      .map(id => $designState.elements[id])
      .filter(Boolean)
      .reverse()
  : Object.values($designState.elements)
      .filter(el => !el.parentId)
      .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

// CHANGE TO:
$: currentPage = $designState.currentPageId
  ? $designState.pages[$designState.currentPageId]
  : null;

$: rootElements = currentPage
  ? currentPage.canvasElements
      .map(id => $designState.elements[id])
      .filter(Boolean)
      .reverse() // Reverse for display: top layers first
  : [];
```

**LayersWindow.svelte** `handleDrop()` (lines ~168-180):
```typescript
// CURRENT (WRONG):
const viewId = $designState.currentViewId;
if (!viewId || !$designState.views[viewId]) {
  console.error('❌ CRITICAL: No view found...');
  return;
}
siblings = $designState.views[viewId].elements;

// CHANGE TO:
if (!currentPage) {
  console.error('❌ CRITICAL: No page found for root elements');
  handleDragEnd();
  return;
}
siblings = currentPage.canvasElements;
```

### 7. Update Canvas Component

**File**: `src/lib/components/canvas/Canvas.svelte`

**Actions needed**:
- Update any references to `currentViewId` to use `currentPageId`
- Update `handleMouseUp()` to pass `pageId` instead of `viewId` when creating elements

### 8. Update All Other Components

**Search for**:
- `currentViewId` - Replace with `currentPageId` where appropriate
- `view.elements` - Replace with `page.canvasElements`
- `viewId` in element creation - Replace with `pageId`

**Files likely affected**:
- Any component that creates elements
- Any component that displays layers
- Any component that reorders elements

### 9. Database Migration (If Needed)

If there's existing data in IndexedDB with the old structure:
- May need to write a migration to convert `viewId` to `pageId` in elements
- May need to move elements from `view.elements[]` to `page.canvasElements[]`
- User may need to clear IndexedDB again for clean slate

## Testing Checklist

After all code changes:
1. ✅ Create a new page - should open canvas
2. ✅ Draw a div on canvas - should create element with `pageId`
3. ✅ Draw multiple divs - should appear in Layers panel
4. ✅ Drag to reorder in Layers panel - should modify `page.canvasElements[]`
5. ✅ Keyboard shortcuts (Cmd+]) - should shift layers
6. ✅ Convert div to view - should set `isView = true`
7. ✅ Add children to view - should appear in `view.children[]`
8. ✅ Publish page - should find all views and generate responsive code

## Files Modified So Far

1. `docs/planning/LAYERS-ARCHITECTURE.md` - ✅ Documentation updated
2. `docs/planning/page-builder-spec.md` - ✅ Documentation updated
3. `.cursorrules` - ✅ Documentation updated
4. `src/lib/types/events.ts` - ⚠️ Partially updated (need to fix Element.viewId)

## Files That Need Changes

1. `src/lib/types/events.ts` - Fix Element interface `viewId` field
2. `src/lib/stores/event-reducer.ts` - Remove View handlers, update element handlers
3. `src/lib/stores/design-store.ts` - Fix createPage, createElement, setCurrentPage
4. `src/lib/components/canvas/LayersWindow.svelte` - Update layer display logic
5. `src/lib/components/canvas/Canvas.svelte` - Update element creation
6. Search all files for `currentViewId`, `view.elements`, `viewId` references

## Important Notes for Next Agent

1. **Read the updated documentation first**: `docs/planning/LAYERS-ARCHITECTURE.md` and `docs/planning/page-builder-spec.md`

2. **Key principle**: Views are NOT a separate data structure. They are div elements with `isView = true`.

3. **Root element storage**: Root elements go in `page.canvasElements[]`, NOT in a separate view structure.

4. **Layer ordering**: Still uses arrays, just `page.canvasElements[]` instead of `view.elements[]`.

5. **Breaking changes**: This is a major refactor. Existing data in IndexedDB may be incompatible.

6. **Test thoroughly**: Layer reordering is critical functionality. Test all scenarios after changes.

## Questions for User (If Needed)

1. Should we write a migration for existing IndexedDB data?
2. Or should we just require clearing IndexedDB for this refactor?
3. What should happen when creating a new page - should it auto-create a default view element?
