# Layers Architecture - CRITICAL DESIGN PRINCIPLE

## THE FUNDAMENTAL RULE

**LAYERS ARE DOM POSITION. NEVER Z-INDEX.**

This is not a suggestion. This is not negotiable. This is the core architectural principle of the page builder.

## What Layers Represent

Layers represent the **position of elements in the DOM tree**. When you see layers in the Layers panel, you are seeing the actual DOM structure:

```
View (DOM root)
├── Element A (index 0 - bottom layer, renders first)
├── Element B (index 1 - middle layer)
└── Element C (index 2 - top layer, renders last)
```

The visual layer order you see in the Layers panel **IS** the DOM render order.

## Why This Matters

1. **This is a page builder** - Users must understand the DOM structure they're creating
2. **What you see is what you export** - The layer order directly maps to HTML output
3. **No magic, no surprises** - Layer order = DOM order = render order
4. **Accessibility** - Screen readers and keyboard navigation follow DOM order
5. **Predictability** - Moving a layer changes DOM position, exactly as expected

## How Layers Are Stored

### Understanding the Canvas and Views

**Canvas**: The design environment for ONE page. When you click "Edit Page", you open the page's canvas.

**View**: A div element with `isView = true` that represents a breakpoint (e.g., Desktop 1920px, Mobile 375px). Views are created by drawing a div and converting it to a view. A canvas can have multiple views for different breakpoints.

### For Root Canvas Elements
Root elements (elements not inside any parent) belong to the **Page's canvas** and their order is stored in `page.canvasElements[]`:

```typescript
{
  pages: {
    'page-id': {
      id: 'page-id',
      name: 'Homepage',
      slug: 'homepage',
      canvasElements: ['elem-a', 'elem-b', 'elem-c']  // DOM order, index 0 = bottom
    }
  }
}
```

**Important**: Elements with `isView = true` are ALSO stored in `canvasElements[]` - they are regular elements on the canvas, just with special properties that mark them as breakpoint containers.

### For Nested Elements
Nested elements belong to a **parent element** (which could be a regular div, a view div, or an auto-layout div) and their order is stored in `parent.children[]`:

```typescript
{
  elements: {
    'parent-id': {
      children: ['child-a', 'child-b', 'child-c']  // DOM order, index 0 = bottom
    }
  }
}
```

This works the same whether the parent is:
- A regular div
- A view div (`isView = true`) - represents a breakpoint
- An auto-layout div (`autoLayout.enabled = true`)

## What Z-Index Is For

Z-index is **ONLY** for:
- CSS visual stacking context (rare edge cases)
- User-applied positioning styles

Z-index is **NEVER** for:
- ❌ Determining layer order
- ❌ Fallback when view doesn't exist
- ❌ Temporary storage of position
- ❌ Reordering elements

## Critical Requirements

### When Adding Root Canvas Elements
- **MUST** belong to a page
- **MUST** be added to `page.canvasElements[]` array
- **MUST NOT** use z-index as a position indicator

### When Reordering Layers
- **MUST** modify the array (page.canvasElements[] for root, or parent.children[] for nested)
- **MUST NOT** change z-index values
- **MUST** use `REORDER_ELEMENT` event for moving between parents
- **MUST** use array splicing to change position within same parent/canvas

### When Displaying Layers
- **MUST** show layers in reversed array order (top layers first in UI)
- **MUST** reflect actual DOM order
- **MUST** make it clear this is the DOM tree

## Error Conditions

If you encounter any of these, **STOP AND FIX THE ROOT CAUSE**:

1. **No page exists for canvas elements** → Elements must belong to a page
2. **Using z-index for layer ordering** → Refactor to use arrays
3. **Fallback to z-index** → There is no fallback. Fix the data structure.

## For AI Agents

If you are an AI agent working on this codebase:

1. **READ THIS FILE FIRST** before touching anything layer-related
2. **NEVER suggest using z-index for layers**
3. **NEVER create a "zIndex fallback system"**
4. **ALWAYS use DOM arrays** (page.canvasElements[] or parent.children[])
5. **If there's no page, something is very wrong** - elements must belong to a page's canvas

## Examples of Correct Implementation

### Moving a Layer Up (Forward)
```typescript
// Get siblings array
const siblings = parent ? parent.children : page.canvasElements;

// Find current position
const currentIndex = siblings.indexOf(elementId);

// Remove from current position
siblings.splice(currentIndex, 1);

// Insert at new position (one higher)
siblings.splice(currentIndex + 1, 0, elementId);
```

### Moving Between Parents
```typescript
// Remove from old parent/canvas array
if (oldParent) {
  oldParent.children = oldParent.children.filter(id => id !== elementId);
} else {
  page.canvasElements = page.canvasElements.filter(id => id !== elementId);
}

// Add to new parent/canvas array at specific index
if (newParent) {
  newParent.children.splice(newIndex, 0, elementId);
} else {
  page.canvasElements.splice(newIndex, 0, elementId);
}
```

## Examples of WRONG Implementation

### ❌ WRONG - Using Z-Index
```typescript
// THIS IS WRONG - DO NOT DO THIS
element.zIndex = calculateZIndex(position);
```

### ❌ WRONG - Z-Index Fallback
```typescript
// THIS IS WRONG - DO NOT DO THIS
if (!page) {
  // Use z-index as fallback
  elements.sort((a, b) => a.zIndex - b.zIndex);
}
```

### ❌ WRONG - Mixing Systems
```typescript
// THIS IS WRONG - DO NOT DO THIS
if (hasPage) {
  usePageCanvasArray();
} else {
  useZIndex(); // NO! Elements must belong to a page!
}
```

## Conclusion

**LAYERS = DOM POSITION**

Not z-index. Not visual stacking. Not CSS order. **DOM POSITION**.

If you find yourself thinking about z-index in the context of layers, **STOP**. You're going down the wrong path.

---

*This document is intentionally emphatic because this principle is absolutely critical to the architecture of the page builder. Violating it breaks the fundamental contract with users about what they're building.*
