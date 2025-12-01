# Purpose
Manage the hierarchy and storage of page elements within the design system.

# Responsibilities
- MUST store root elements in `Page.canvasElements` (array of IDs).
- MUST store nested elements in `Element.children` (array of IDs).
- MUST maintain DOM order (index 0 = bottom/first).
- MUST NOT use a separate "View" data structure for storage.

# Dependencies
- **Store**: `design-store.ts`, `event-reducer.ts`.
- **Models**: `Page`, `Element`.

# Interface
- **Data**: `Page { canvasElements: string[] }`, `Element { id: string, children: string[], parentId: string | null }`.
- **Actions**: `CREATE_ELEMENT`, `REORDER_ELEMENT`, `DELETE_ELEMENT`.

# Tests
- **Success**: Create a new element on the canvas and verify it appears in `Page.canvasElements`.
- **Failure**: Attempt to move an element to be a child of itself and verify the operation is rejected.
