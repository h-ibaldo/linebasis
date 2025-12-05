# REFACTOR PLAN: Unified Positioning Model

## DIAGNOSIS

### Current State
- **Dual group systems**: Old (groupId) + New (wrapper-based) running in parallel
- **Coordinate chaos**: Absolute/relative conversions everywhere, code duplication
- **No validation**: Orphans, circular refs possible
- **Auto-layout conflicts**: Flexbox vs absolute positioning incompatible
- **Massive complexity**: 17+ state vars, 491-line paste function, 147-line delete

### What Works
- Parent-child data model (parentId + children[])
- Relative positioning concept
- Recursive operations
- DOM-first principle (mostly)

### Critical Issues
1. **Groups**: 2 systems → every op handles both → code explosion
2. **Coordinates**: Absolute/relative mixing → bugs with rotated parents
3. **Auto-layout + Groups**: position:relative vs position:absolute → 18 test files
4. **State**: No validation, manual sync everywhere
5. **Performance**: O(depth) recalculations, no caching

## OPTIONS

### A: Conservative Cleanup (3-4 weeks)
- Remove old groups, unify coordinates, add validation
- **Pros**: Low risk, incremental
- **Cons**: UX still complex, debt remains

### B: Unified Positioning Model (6-8 weeks) ⭐ CHOSEN
- Element-level position modes (absolute|flex-item)
- Groups = regular divs
- Auto-layout can contain absolute elements
- **Pros**: Solves root cause, dramatic simplification
- **Cons**: 6-8 week effort

### C: Transform Matrices (10-14 weeks)
- DOMMatrix-based positioning
- **Pros**: Mathematically perfect, extensible
- **Cons**: Overkill, high learning curve

## ROADMAP: OPTION B

### Phase 1: Add Position Mode (Week 1-2)
**Goal**: Element decides its positioning, not parent type

```typescript
interface Element {
  positionMode: 'absolute' | 'flex-item';  // NEW
  position: { x: number; y: number };      // Relative to parent
  autoLayout?: {                           // Parent's layout settings
    enabled: boolean;
    direction: 'horizontal' | 'vertical';
    gap: number;
  };
}
```

**Tasks**:
- [ ] Update Element interface in events.ts
- [ ] Update CanvasElement rendering (respect positionMode)
- [ ] Add MIGRATE_TO_POSITION_MODE event
- [ ] Run migration on app load

**Rendering logic**:
```typescript
// CanvasElement.svelte
if (element.positionMode === 'absolute') {
  styles.push('position: absolute');
  styles.push(`left: ${position.x}px; top: ${position.y}px`);
} else {
  styles.push('position: relative');  // flex-item: CSS handles positioning
}
```

---

### Phase 2: Remove Group System (Week 3-4)
**Goal**: Groups = regular divs, no special logic

**Remove**:
- `interface Group` (events.ts)
- `state.groups` object (design-store.ts)
- `element.groupId` property
- `element.isGroupWrapper` property
- `clipboardGroups` (design-store.ts)
- Isolation state (interaction-state.ts)

**Convert**:
- Group wrappers → regular `type: 'div'` elements
- Group children → already have parentId (no change needed)

**Tasks**:
- [ ] Remove Group interface from events.ts
- [ ] Remove state.groups from design-store.ts
- [ ] Remove groupId, isGroupWrapper from Element interface
- [ ] Update SelectionOverlay (remove isolation logic)
- [ ] Update LayersWindow (remove group folder logic)
- [ ] Update CanvasElement (remove group selection special cases)
- [ ] Remove group event handlers (GROUP_ELEMENTS, UNGROUP_ELEMENTS)

**Selection changes**:
```typescript
// OLD: Click grouped element → select group, double-click → isolate
// NEW: Click div → select div, double-click → select first child
```

---

### Phase 3: Simplify Operations (Week 5-6)
**Goal**: Remove group-specific complexity from operations

**Copy/Paste** (design-store.ts):
- Before: 491 lines with group reconstruction
- After: ~150 lines - just copy tree structure
```typescript
function pasteElements() {
  // 1. Collect elements + descendants
  // 2. Generate new IDs (oldToNewIdMap)
  // 3. Clone elements, update parentId refs
  // 4. Paste tree recursively
  // NO group logic!
}
```

**Delete** (event-reducer.ts):
- Before: 147 lines with wrapper checks
- After: ~50 lines - recursive delete
```typescript
function handleDeleteElements(state, event) {
  function deleteRecursive(id: string) {
    const el = state.elements[id];
    el.children.forEach(deleteRecursive);
    delete state.elements[id];
  }
  event.elementIds.forEach(deleteRecursive);
}
```

**Tasks**:
- [ ] Refactor pasteElements (remove group reconstruction)
- [ ] Refactor handleGroupDeleteElements → handleDeleteElements
- [ ] Refactor move operations (remove groupPendingTransforms)
- [ ] Update updateWrapperBounds (remove wrapper-specific logic)
- [ ] Remove group-related clipboard management

---

### Phase 4: Coordinate Unification (Week 7)
**Goal**: Single conversion function, memoized

**Create** `src/lib/utils/coordinates.ts`:
```typescript
const transformCache = new Map<string, AbsoluteTransform>();

export function getAbsoluteTransform(element: Element, state: DesignState) {
  if (transformCache.has(element.id)) return transformCache.get(element.id);

  let x = element.position.x;
  let y = element.position.y;
  let rotation = element.rotation || 0;

  let current = element;
  while (current.parentId) {
    const parent = state.elements[current.parentId];

    // Apply parent rotation to position
    if (parent.rotation) {
      const rad = parent.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      x = x * cos - y * sin;
      y = x * sin + y * cos;
      rotation += parent.rotation;
    }

    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }

  const result = { x, y, rotation };
  transformCache.set(element.id, result);
  return result;
}

export function invalidateTransformCache(elementId: string, state: DesignState) {
  transformCache.delete(elementId);
  const el = state.elements[elementId];
  el.children.forEach(childId => invalidateTransformCache(childId, state));
}
```

**Remove**:
- `absoluteToRelativePosition` (SelectionOverlay.svelte)
- `absoluteToParentSpace` (SelectionOverlay.svelte)
- `getAbsolutePosition` (SelectionOverlay.svelte)
- `absoluteToRelativePosition` (CanvasElement.svelte) - duplicate

**Tasks**:
- [ ] Create coordinates.ts utility
- [ ] Add transform cache
- [ ] Replace all conversion functions with getAbsoluteTransform
- [ ] Add cache invalidation on move/resize/rotate events
- [ ] Test with rotated parent chains

---

### Phase 5: State Machine (Week 8)
**Goal**: Explicit states, clear transitions

**Create** `src/lib/stores/interaction-mode.ts`:
```typescript
type InteractionMode =
  | { type: 'idle' }
  | { type: 'hovering'; elementId: string }
  | { type: 'dragging'; elementId: string; startPos: Point; startTime: number }
  | { type: 'resizing'; elementId: string; handle: ResizeHandle; startSize: Size }
  | { type: 'rotating'; elementId: string; startAngle: number }
  | { type: 'radius-editing'; elementId: string };

export const interactionMode = writable<InteractionMode>({ type: 'idle' });

export function startDrag(elementId: string, startPos: Point) {
  interactionMode.set({ type: 'dragging', elementId, startPos, startTime: Date.now() });
}

export function endInteraction() {
  interactionMode.set({ type: 'idle' });
}
```

**Replace** (SelectionOverlay.svelte):
- 17 state variables → 1 state machine
- Scattered transitions → explicit transition functions

**Tasks**:
- [ ] Create interaction-mode.ts
- [ ] Define all states and transitions
- [ ] Refactor SelectionOverlay to use state machine
- [ ] Remove redundant state variables
- [ ] Test state transitions

---

### Phase 6: Validation & Optimization (Week 9-10)
**Goal**: Prevent corruption, optimize performance

**Validation Layer**:
```typescript
// design-store.ts
function validateState(state: DesignState): string[] {
  const errors: string[] = [];

  for (const [id, el] of Object.entries(state.elements)) {
    // Check orphans
    if (el.parentId && !state.elements[el.parentId]) {
      errors.push(`Element ${id} has invalid parentId ${el.parentId}`);
    }

    // Check circular refs (DFS)
    if (hasCircularReference(id, state)) {
      errors.push(`Element ${id} has circular parent reference`);
    }

    // Check parent/children sync
    if (el.parentId) {
      const parent = state.elements[el.parentId];
      if (!parent.children.includes(id)) {
        errors.push(`Element ${id} not in parent.children`);
      }
    }
  }

  return errors;
}
```

**Tasks**:
- [ ] Add validateState function
- [ ] Run validation on app load
- [ ] Add orphan detection
- [ ] Add circular reference check
- [ ] Add parent/children consistency check
- [ ] Cache invalidation on state updates
- [ ] Performance test: 1000 elements, 10 levels deep
- [ ] E2E test suite (nested drag/drop, copy/paste, delete)

---

## ACCEPTANCE CRITERIA

After completion:
- [ ] Zero group-specific code (groups are divs)
- [ ] Single coordinate function (memoized)
- [ ] State machine for interactions
- [ ] Copy/paste < 200 lines
- [ ] Auto-layout + absolute children works
- [ ] 20+ nesting levels tested
- [ ] Position queries < 1ms
- [ ] State validation on updates
- [ ] Zero zIndex usage
- [ ] Text elements cannot have children

## FILES TO MODIFY

### Core Types
- `src/lib/types/events.ts` - Element interface, remove Group

### Stores
- `src/lib/stores/design-store.ts` - Remove groups, refactor paste
- `src/lib/stores/event-reducer.ts` - Remove group handlers, simplify delete
- `src/lib/stores/interaction-state.ts` - Remove isolation state

### Components
- `src/lib/components/canvas/CanvasElement.svelte` - positionMode rendering, remove group selection
- `src/lib/components/canvas/SelectionOverlay.svelte` - Remove group state, use state machine
- `src/lib/components/canvas/SelectionUI.svelte` - Remove group-specific UI
- `src/lib/components/canvas/LayersWindow.svelte` - Remove group folders
- `src/lib/components/canvas/LayerTreeItem.svelte` - Simplify nesting display

### New Files
- `src/lib/utils/coordinates.ts` - Unified coordinate system
- `src/lib/stores/interaction-mode.ts` - State machine

## MIGRATION STRATEGY

```typescript
// Run once on app load
function migrateToUnifiedPositioning(state: DesignState): DesignState {
  const newElements = { ...state.elements };

  // Convert groupId references
  for (const [id, el] of Object.entries(newElements)) {
    if (el.groupId) {
      // Child of old-style group → absolute position mode
      newElements[id] = {
        ...el,
        positionMode: 'absolute',
        groupId: undefined  // Remove
      };
    } else if (el.isGroupWrapper) {
      // Old wrapper → regular div
      newElements[id] = {
        ...el,
        isGroupWrapper: undefined  // Remove
      };
    } else {
      // Default position mode
      newElements[id] = {
        ...el,
        positionMode: el.positionMode || 'absolute'
      };
    }
  }

  return {
    ...state,
    elements: newElements,
    groups: {}  // Remove all groups
  };
}
```

## ROLLBACK PLAN

If issues arise:
1. Feature flag: `ENABLE_UNIFIED_POSITIONING` (default: false)
2. Keep old code path for 1 release
3. A/B test with subset of users
4. Full rollout after 1 week of testing

## BRANCH STRATEGY

```bash
feat/unified-positioning-model
├── feat/position-mode           # Phase 1
├── feat/remove-groups           # Phase 2
├── feat/simplify-operations     # Phase 3
├── feat/coordinate-unification  # Phase 4
├── feat/state-machine           # Phase 5
└── feat/validation-optimization # Phase 6
```

Merge to main after each phase passes tests.
