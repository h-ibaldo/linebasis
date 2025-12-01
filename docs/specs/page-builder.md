# Purpose
Provide a visual interface for constructing and editing web pages.

# Responsibilities
- MUST render the current page's canvas and elements.
- MUST handle user interactions (drag, drop, select, resize).
- MUST synchronize visual state with the `DesignState`.
- MUST NOT directly mutate state; must dispatch events.

# Dependencies
- **Internal**: `Layers Architecture`, `DesignStore`.
- **UI**: `Canvas.svelte`, `LayersWindow.svelte`.

# Interface
- **Components**: `<Canvas />`, `<SelectionOverlay />`.
- **Events**: `on:drop`, `on:click`, `on:resize`.

# Tests
- **Success**: Drag a component from the toolbar to the canvas and verify a `CREATE_ELEMENT` event is dispatched.
- **Failure**: Drop an element outside the valid canvas area and verify no element is created.
