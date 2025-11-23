# Performance Optimization Analysis

## 🎯 CRITICAL FIX APPLIED (O(n²) → O(n))

### Problem Found:
During transactions, `dispatch()` was calling `reduceEvents()` **on every single event**:
- Event 1: Reduce 1 event
- Event 2: Reduce 2 events
- Event 3: Reduce 3 events
- Event 18: Reduce 18 events
- **Total: 1+2+3+...+18 = 171 reductions** (O(n²) complexity!)

### Fix Applied:
```typescript
// BEFORE (O(n²) - SLOW):
if (isInTransaction) {
  transactionEvents.push(event);
  const tempEvents = [...state.events, ...transactionEvents];
  const newDesignState = reduceEvents(tempEvents); // ← Called N times!
  storeState.update(...);
}

// AFTER (O(n) - FAST):
if (isInTransaction) {
  transactionEvents.push(event);
  // Skip state rebuild - will happen once in commitTransaction()
  return;
}
```

### Expected Impact:
**Before:** 519ms for 18 events (paste element tree)
**After:** ~1ms for 18 events (just pushing to array)

**Speedup:** ~500x faster! ⚡

**Actual results:** 566ms → 74ms (87% improvement)

---

## 🚀 SECOND OPTIMIZATION: Incremental State Updates

### Problem:
Even after fixing O(n²), `commitTransaction()` still called `reduceEvents(ALL events)`:
- Rebuilds entire state from scratch
- For 18 new events + 100 existing = processes 118 events
- Takes ~51ms for moderate-sized projects

### Solution: Apply Only New Events

```typescript
// BEFORE (rebuilds everything):
const newDesignState = reduceEvents(newEvents); // All events!

// AFTER (incremental update):
const newDesignState = applyEventsIncremental(currentState, transactionEvents); // Only new!
```

Uses **Immer.js** for efficient structural sharing:
- Only mutates changed parts of state
- Shares unchanged parts (memory efficient)
- 5-10x faster than full rebuild

### Expected Impact:
**Before:** 51ms (reduce all events)
**After:** ~5-10ms (apply only 18 new events incrementally)

**Total duplication:** 74ms → **~20-30ms** 🎯

---

## Current Implementation with Performance Logging

All duplication operations now have **detailed, non-collapsible performance logging** to identify bottlenecks:

### Performance Logging Added

```
[PERF] 🔄 Duplicate: START
[PERF] ✅ Duplicate: Copy completed in Xms
[PERF] 📋 Paste: START (N elements)
[PERF]   Clear selection: Xms
[PERF]   Begin transaction: Xms
[PERF]   Paste element tree (N elements, M events): Xms
[PERF]     commitTransaction: START (M events)
[PERF]       Clean old events: Xms
[PERF]       Merge events: Xms
[PERF]       Reduce events (rebuild state): Xms  ← LIKELY BOTTLENECK
[PERF]       Update store: Xms
[PERF]       IndexedDB batch write: Xms
[PERF]   Commit transaction: Xms
[PERF]   Select elements: Xms
[PERF] 📋 Paste: TOTAL Xms
[PERF] 🎯 Duplicate: TOTAL Xms
```

## Identified Bottleneck: `reduceEvents()`

The `reduceEvents()` function **rebuilds the entire design state** from scratch by replaying ALL events (not just new ones). This is the primary bottleneck.

### Why It's Slow:
1. **Full state rebuild** - Processes all events in history, not just the new transaction events
2. **JSON operations** - Deep cloning and merging of element properties
3. **Array operations** - Rebuilding children arrays, parent-child relationships
4. **Single-threaded** - JavaScript runs on main thread, blocking UI

### Current Flow:
```typescript
// In commitTransaction()
const newDesignState = reduceEvents(newEvents); // ← Replays ALL events!
```

For a project with 100 existing events + 30 new paste events:
- Must process 130 events total
- Each event mutates a large state object
- No incremental updates

## Optimization Strategies

### 1. **Incremental State Updates** (Highest Impact) ⚡

Instead of replaying all events, apply only the new transaction events to the current state.

**Implementation:**
```typescript
// Option A: Incremental reduction (best for transactions)
const newDesignState = { ...currentDesignState };
for (const event of transactionEvents) {
  applyEventToState(newDesignState, event);
}

// Option B: Structural sharing with Immer.js
import produce from 'immer';
const newDesignState = produce(currentDesignState, draft => {
  for (const event of transactionEvents) {
    applyEventToState(draft, event);
  }
});
```

**Expected improvement:** 5-10x faster for large projects

---

### 2. **WASM for Event Reduction** (Medium Impact)

Compile event reduction logic to WebAssembly for raw speed.

**Pros:**
- 2-5x faster execution for compute-heavy operations
- No GC pauses during reduction
- Can run in parallel with Web Workers

**Cons:**
- Complex implementation (Rust/AssemblyScript → WASM)
- Memory overhead (copying state to/from WASM)
- Overkill unless state is massive (1000+ elements)

**Recommendation:** Only consider if incremental updates aren't enough.

**Implementation sketch (Rust):**
```rust
#[wasm_bindgen]
pub fn reduce_events(events_json: &str) -> String {
    let events: Vec<DesignEvent> = serde_json::from_str(events_json)?;
    let state = events.into_iter().fold(DesignState::new(), |state, event| {
        apply_event(state, event)
    });
    serde_json::to_string(&state)?
}
```

---

### 3. **Optimistic UI + Background Commit** (Best UX)

Make UI updates instant, persist to IndexedDB in background.

**Current flow:**
```
User presses Cmd+D
  → pasteElements()
  → reduceEvents() [BLOCKS]
  → Update Svelte store [UI UPDATES]
  → appendEvents() [BLOCKS]
  → Done
```

**Optimized flow:**
```
User presses Cmd+D
  → Update UI immediately (optimistic)
  → Background: reduceEvents() + IndexedDB write
  → Done (user sees instant result)
```

**Implementation:**
```typescript
// Optimistic update
storeState.update(s => ({
  ...s,
  designState: optimisticallyApplyEvents(s.designState, transactionEvents)
}));

// Background commit (won't block UI)
setTimeout(async () => {
  const correctState = reduceEvents(allEvents);
  await appendEvents(transactionEvents);
  storeState.update(s => ({ ...s, designState: correctState }));
}, 0);
```

---

### 4. **Virtual DOM Diffing** (Minimal Impact)

Current: Svelte reactively re-renders entire component tree.
Optimization: Only update changed elements.

**Not worth it** - Svelte is already very efficient with fine-grained reactivity.

---

### 5. **IndexedDB Optimization** (Already Done ✅)

We already batch writes with `appendEvents()`. Further optimizations:
- Use IndexedDB cursors for bulk reads (if needed)
- Compress events with LZ4/Brotli before storage
- Periodic compaction (snapshot current state, clear old events)

---

## Recommended Implementation Plan

### Phase 1: Incremental State Updates (DO THIS FIRST) ⚡
**Impact:** Massive (5-10x faster)
**Effort:** Medium
**Files:** `event-reducer.ts`

```typescript
// New function in event-reducer.ts
export function applyEventIncremental(state: DesignState, event: DesignEvent): DesignState {
  // Use Immer for structural sharing
  return produce(state, draft => {
    switch (event.type) {
      case 'CREATE_ELEMENT':
        draft.elements[event.payload.elementId] = createElementFromPayload(event.payload);
        break;
      case 'UPDATE_ELEMENT':
        Object.assign(draft.elements[event.payload.elementId], event.payload.changes);
        break;
      // ... handle all event types
    }
  });
}

// In commitTransaction()
let newDesignState = state.designState;
for (const event of transactionEvents) {
  newDesignState = applyEventIncremental(newDesignState, event);
}
```

### Phase 2: Optimistic UI Updates
**Impact:** High (instant perceived performance)
**Effort:** Low
**Files:** `design-store.ts`

Move IndexedDB write to background, update UI immediately.

### Phase 3: Event Log Compaction
**Impact:** Medium (keeps event log small)
**Effort:** Medium
**Files:** `event-store.ts`

Periodically snapshot state and clear old events.

---

## WASM: When to Consider

**Use WASM if:**
- Event reduction takes >50ms even after incremental updates
- Project has 1000+ elements
- Complex mathematical operations (transform matrices, bezier curves)

**Don't use WASM for:**
- Simple CRUD operations (JS is fast enough)
- Small projects (<100 elements)
- Operations that need DOM access

**Better alternatives to WASM:**
1. Incremental updates (no downsides)
2. Web Workers (parallel processing without WASM complexity)
3. Indexed data structures (Map/Set instead of arrays)

---

## Expected Results After Phase 1

**Current (before incremental updates):**
- 5 elements → ~20ms
- 50 elements → ~100ms
- 100 elements → ~200ms

**After Phase 1 (incremental updates):**
- 5 elements → ~2ms (10x faster)
- 50 elements → ~10ms (10x faster)
- 100 elements → ~15ms (13x faster)

**After Phase 2 (optimistic UI):**
- Perceived: ~0ms (instant)
- Actual: background processing

---

## Performance Testing Checklist

Use the console logs to measure:

1. ✅ Paste element tree - should be <5ms for 50 elements
2. ❌ Reduce events - currently slow, optimize with incremental updates
3. ✅ IndexedDB batch write - already optimized
4. ✅ Update store - fast (<1ms)

## Conclusion

**Immediate action:** Implement incremental state updates (Phase 1)
**WASM verdict:** Not needed unless incremental updates aren't enough
**Priority:** Incremental > Optimistic UI > Compaction > WASM
