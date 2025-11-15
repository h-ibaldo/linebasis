# Page Builder Specification

## Overview

The page builder is the core interface where users design and build all pages (admin, blog, landing pages). It's the only part of Linabasis NOT built with itself.

**Design**: Based on Ibaldo's designs
**Route**: `/builder` (or main `/`)

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (Top)                                               │
├──────────┬────────────────────────────────┬─────────────────┤
│          │                                │                 │
│  Left    │                                │     Right       │
│ Sidebar  │         Canvas Area            │    Sidebar      │
│          │                                │                 │
│ (Pages/  │     (Multi-page grid view)     │  (Properties)   │
│  Comps)  │                                │                 │
│          │                                │                 │
└──────────┴────────────────────────────────┴─────────────────┘
```

---

## Components

### 1. Toolbar (Top)
- Logo/Project name
- Undo/Redo buttons
- View controls (zoom, grid toggle)
- Preview/Publish button
- User menu

### 2. Left Sidebar
**Pages Panel**:
- List of all pages in the project
- Add new page button
- Page thumbnails/previews
- Current page indicator

**Components Panel**:
- Draggable component library
- Categories (Layout, Typography, Forms, etc.)
- Search/filter components

### 3. Canvas Area
**Multi-Page View** (Figma-style):
- Show multiple pages at once in a grid
- Zoom in/out
- Pan around canvas
- Grid overlay (toggleable)
- Baseline grid visible when enabled

**Per-Page Canvas**:
- Actual DOM elements (not Canvas API)
- Drag-and-drop components
- Resize handles
- Selection indicators
- Multi-select support

### 4. Right Sidebar
**Properties Panel**:
- Properties for selected element(s)
- Position (X, Y, Width, Height)
- Typography (if text element)
- Colors and backgrounds
- Spacing and alignment
- Component-specific properties

---

## Core Features

### Event Sourcing
- All actions dispatched as events
- Perfect undo/redo via event history
- Auto-save to IndexedDB
- Event replay for state reconstruction

### Component System
- Drag components from library to canvas
- Convert selections to reusable components
- Component library with categories
- Master component editing (update all instances)

### Baseline Grid
- InDesign-style typography alignment
- Configurable baseline height (4-32px)
- Visual grid overlay
- Snap-to-baseline toggle

### Multi-Page Management
- See all pages at once
- Add/remove/reorder pages visually
- Page state indicators (draft/published)
- Right-click context menu (publish, duplicate, delete)

### Keyboard Shortcuts
- Undo: Cmd/Ctrl + Z
- Redo: Cmd/Ctrl + Shift + Z
- Delete: Delete/Backspace
- Copy: Cmd/Ctrl + C
- Paste: Cmd/Ctrl + V
- Duplicate: Cmd/Ctrl + D
- Group: Cmd/Ctrl + G

---

## Technical Implementation

### Routes
- `/builder` - Main page builder interface
- `/builder/[pageId]` - Edit specific page (optional)

### Key Files
- `src/routes/builder/+page.svelte` - Main builder UI
- `src/lib/components/builder/Toolbar.svelte`
- `src/lib/components/builder/LeftSidebar.svelte`
- `src/lib/components/builder/Canvas.svelte`
- `src/lib/components/builder/RightSidebar.svelte`
- `src/lib/stores/builder-store.ts` - Builder state
- `src/lib/stores/event-store.ts` - Event sourcing (existing)

### State Management
```typescript
{
  currentPage: string;        // Current page ID
  pages: Page[];             // All pages in project
  selectedElements: string[]; // Selected element IDs
  clipboard: Element[];      // Copy/paste buffer
  gridVisible: boolean;      // Grid overlay toggle
  baselineEnabled: boolean;  // Baseline snap toggle
  zoom: number;              // Canvas zoom level
}
```

---

## Next Steps

1. Create `/builder` route and basic layout
2. Implement toolbar with basic controls
3. Add left sidebar with pages panel
4. Build canvas area with multi-page grid
5. Add right sidebar with properties
6. Integrate event sourcing
7. Add drag-and-drop for components
8. Implement keyboard shortcuts
9. Test and refine based on Ibaldo's designs

---

**Reference**: See [page-design-specifications.md](page-design-specifications.md) for detailed design specs.
