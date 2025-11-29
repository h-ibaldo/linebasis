# Linabasis Development Roadmap

**Last Updated**: November 29, 2024
**Current Phase**: Phase 1 - Core Page Builder MVP
**Current Milestone**: Milestone 6 - Page Builder UI (60% complete)
**Latest Feature**: ✨ Advanced Typography System with Presets (November 29, 2024)

---

## Current Status Summary

### Phase 1 Progress: 56% Complete

**Completed Milestones** (5/15):
- ✅ Milestone 1: Foundation & Database (100%)
- ✅ Milestone 2: Media Library (100%)
- ✅ Milestone 3: Design System (Tokens) (100%)
- ✅ Milestone 4: Event Sourcing Foundation (100%)
- ✅ Milestone 5: Page Builder Canvas (100%)

**In Progress**:
- 🚧 Milestone 6: Page Builder UI (60%) - Typography system complete, properties window enhanced, toolbar operational, layers/blocks/tokens windows not started

**Not Started**: Milestones 7-15

### What's Working Right Now

The page builder core is **production-ready** with:
- ✅ Professional-grade canvas with pan, zoom, infinite scrolling, baseline grid
- ✅ Three drawing tools (Div, Text, Media) with live preview and quadrant support
- ✅ Complete selection system (single, multi, selection box, Shift+click additive)
- ✅ Advanced transforms (drag, resize with 8 handles, rotate with Figma-style zones)
- ✅ Auto-layout child reordering with drag-and-drop ghost positioning
- ✅ Border radius editing (synchronized and independent corner modes with Alt key)
- ✅ Parent change detection during element drops
- ✅ Smart clipboard (copy, cut, paste, duplicate) with parent detection
- ✅ Text editing (inline editor with bold, italic, underline formatting)
- ✅ Group/ungroup operations with transaction batching
- ✅ Event sourcing with perfect undo/redo and transaction batching
- ✅ IndexedDB auto-save every 30 seconds
- ✅ 30+ comprehensive keyboard shortcuts with shortcuts modal (Cmd+/)
- ✅ Properties panel (background, border, opacity, radius with sync/independent modes)
- ✅ Multi-selection with "Mixed" value indicators for batch styling
- ✅ Visual feedback system (ghost positioning, selection indicators, interaction zones)
- ✅ **Advanced Typography System** (NEW - Nov 29, 2024):
  - 10 typography presets (H1-H6, Body, Caption, Small) with visual preview grid
  - 14 font families (system fonts + Google Fonts: Inter, Roboto, Open Sans, Lato, Montserrat, etc.)
  - Comprehensive controls: font size (17 options), weight (9 levels), style (italic/oblique)
  - Advanced spacing: line height, letter spacing, word spacing, text indent
  - Text formatting: alignment, decoration with style/color, text transform
  - Professional features: white space handling, word break, hyphenation
  - Smart preset system that auto-applies design token values
  - Full event sourcing support with APPLY_TYPOGRAPHY_PRESET event

### What's Missing

To complete Phase 1 MVP, we still need:
- ✅ ~~Advanced text properties (font family, size, weight, alignment)~~ **COMPLETED (Nov 29, 2024)**
- ❌ Layers window (hierarchy tree view with visibility/lock toggles)
- ❌ Blocks window (reusable components UI with master-instance system)
- ❌ Tokens window (quick access to design tokens)
- ❌ Publishing system (code generation, SSR rendering)
- ❌ Pages management (create, list, edit, delete)
- ❌ Preview mode
- ❌ Static export
- ❌ Team & user management
- ❌ Polish & testing

---

## Overview

Linabasis follows a **phased release strategy** to ship faster, validate architecture, and build in public:

- **Phase 1**: Core Page Builder MVP (this roadmap)
- **Phase 2**: Custom Blocks (developer extensibility)
- **Phase 3**: Plugin Ecosystem (blog, forms, marketplace)
- **Phase 4+**: Advanced Features (e-commerce, comments, collaboration)

**This document covers Phase 1 implementation milestones.**

---

## Phase 1: Core Page Builder MVP

**Goal**: Ship a working visual page builder with publishing, authentication, and design system.

**Timeline**: TBD (building in public, iterating based on feedback)

**Success Criteria**:
- ✅ Can design a multi-page website visually
- ✅ Can publish pages with SSR
- ✅ Can export as static HTML/CSS
- ✅ Design tokens work across all pages
- ✅ User blocks are reusable and update instances
- ✅ Multi-user teams with RBAC
- ✅ Local-first with auto-save (no data loss)

---

## Milestone 1: Foundation & Database

**Duration**: ~1-2 weeks
**Goal**: Set up project infrastructure, database, and core models

### Tasks

#### 1.1 Project Setup
- [x] Initialize SvelteKit project with TypeScript
- [x] Configure Prisma with SQLite (dev) and PostgreSQL (prod)
- [x] Set up Vitest for testing
- [x] Configure ESLint and TypeScript strict mode
- [x] Create `.env.example` with all required variables
- [x] Write setup script (`npm run setup`) for first-time installation

#### 1.2 Database Schema (Core Models)
- [x] Implement `User` model (email, password, role, teamId)
- [x] Implement `Team` model (name, slug, ownerId)
- [x] Implement `Session` model (userId, refreshToken, expiresAt)
- [x] Implement `Page` model (title, slug, designEvents, publishedCode, teamId, authorId)
- [x] Implement `Frame` model (pageId, name, breakpointWidth, designEvents, order)
- [x] Implement `Block` model (name, designEvents, sourcePageId, teamId)
- [x] Implement `BlockInstance` model (blockId, frameId, elementId, isDetached, overrideEvents)
- [x] Implement `Media` model (filename, url, mimeType, size, uploaderId, teamId)
- [x] Implement `Setting` model (key, value, type)
- [x] Create initial migration
- [x] Write seed script for development data

#### 1.3 Authentication Service
- [x] Install dependencies: `bcryptjs`, `jsonwebtoken`
- [x] Create `/src/lib/server/services/auth.ts`
  - [x] `register()` - Create user with hashed password
  - [x] `login()` - Verify credentials, issue JWT tokens
  - [x] `refresh()` - Refresh access token using refresh token
  - [x] `logout()` - Invalidate session
- [x] Create `/src/lib/server/middleware/auth.ts`
  - [x] `requireAuth()` - Verify JWT, attach user to locals
  - [x] `requireRole()` - Check user role (Owner/Manager/Designer/Editor)
- [x] Write unit tests for auth service

#### 1.4 API Routes: Authentication
- [x] `POST /api/auth/register` - User registration
- [x] `POST /api/auth/login` - User login (returns access + refresh tokens)
- [x] `POST /api/auth/refresh` - Refresh access token
- [x] `POST /api/auth/logout` - Logout and invalidate session
- [x] `GET /api/auth/me` - Get current user info

**Deliverable**: ✅ **COMPLETED** - Working database, authentication, and user management

---

## Milestone 2: Media Library

**Duration**: ~1 week
**Goal**: Upload, store, and manage images/videos

### Tasks

#### 2.1 Media Upload Service
- [x] Install `sharp` for image optimization
- [x] Create `/src/lib/server/services/media.ts`
  - [x] `uploadMedia()` - Handle file upload, optimize images, save to disk
  - [x] `getMedia()` - Retrieve media by ID
  - [x] `listMedia()` - List all media for a team (with pagination)
  - [x] `deleteMedia()` - Delete media file and database entry
  - [x] Image optimization: resize to max 2400px, compress to WebP
- [x] Configure upload directory: `static/uploads/`
- [x] Write unit tests for media service

#### 2.2 API Routes: Media
- [x] `POST /api/media/upload` - Upload file (multipart/form-data)
- [x] `GET /api/media` - List all media (with filters: type, date, search)
- [x] `GET /api/media/:id` - Get single media
- [x] `DELETE /api/media/:id` - Delete media (check permissions)

#### 2.3 Admin UI: Media Library
- [x] Create `/src/routes/admin/media/+page.svelte`
  - [x] Grid view of all media
  - [x] Upload button with drag-and-drop
  - [x] Search/filter by name, type, date
  - [x] Delete media with confirmation
  - [x] Media details modal (filename, size, dimensions, URL)
- [x] Create reusable `MediaPicker` component for designer

**Deliverable**: ✅ **COMPLETED** - Functional media library with upload, browse, and delete

---

## Milestone 3: Design System (Tokens)

**Duration**: ~1 week
**Goal**: Global design tokens for colors, typography, spacing, effects

### Tasks

#### 3.1 Token Data Model
- [x] Define token types: colors, typography, spacing, effects, baseline
- [x] Create `/src/lib/types/tokens.ts` with TypeScript interfaces
- [x] Implement token storage in `Setting` model (JSON format)
- [x] Default token presets (modern, minimal, classic themes)

#### 3.2 Token Service
- [x] Create `/src/lib/server/services/tokens.ts`
  - [x] `getTokens()` - Get all design tokens for team
  - [x] `updateTokens()` - Update design tokens
  - [x] `resetTokens()` - Reset to defaults

#### 3.3 API Routes: Tokens
- [x] `GET /api/tokens` - Get design tokens
- [x] `PUT /api/tokens` - Update design tokens
- [x] `POST /api/tokens/reset` - Reset to defaults

#### 3.4 Admin UI: Design System
- [x] Create `/src/routes/admin/styles/+page.svelte`
  - [x] **Colors**: Primary, Secondary, Accent, Text, Muted, Background
  - [x] **Typography**: Font families, Heading 1-6, Body, Caption, Small
  - [x] **Spacing**: Base unit, scale (4, 8, 16, 24, 32, 48, 64, 96)
  - [x] **Effects**: Border radius, shadows, transitions
  - [x] **Baseline Grid**: Grid unit (4-32px), line height multiplier
  - [x] Live preview of all tokens
  - [x] Export/import token JSON

**Deliverable**: ✅ **COMPLETED** - Working design system with token management UI

---

## Milestone 4: Event Sourcing Foundation

**Duration**: ~1-2 weeks
**Goal**: Event store, reducers, and undo/redo system

### Tasks

#### 4.1 Event Types
- [x] Create `/src/lib/types/events.ts`
  - [x] Define all event types (ELEMENT_ADDED, ELEMENT_MOVED, etc.)
  - [x] TypeScript discriminated unions for type safety
  - [x] Event metadata: id, timestamp, userId, frameId

#### 4.2 Event Store (IndexedDB)
- [x] Create `/src/lib/stores/event-store.ts`
  - [x] Initialize IndexedDB with `events` and `snapshots` stores
  - [x] `appendEvent()` - Add event to history
  - [x] `undo()` - Move cursor back
  - [x] `redo()` - Move cursor forward
  - [x] `getHistory()` - Get all events up to current cursor
  - [x] Auto-save to IndexedDB every 30 seconds
  - [x] Snapshot every 100 events for performance

#### 4.3 Event Reducer
- [x] Create `/src/lib/stores/event-reducer.ts`
  - [x] `applyEvent()` - Pure function: (state, event) => newState
  - [x] Handle all element events (add, move, resize, update, delete)
  - [x] Handle frame events (add, update, delete)
  - [x] Handle style events (update text, colors, spacing)
  - [x] Immutable state updates

#### 4.4 Design Store
- [x] Create `/src/lib/stores/design-store.ts`
  - [x] Derived store from event history
  - [x] Public API: `addElement()`, `moveElement()`, `updateElement()`, etc.
  - [x] All mutations dispatch events (never mutate state directly)
  - [x] Subscribe to changes for UI reactivity

#### 4.5 Testing
- [ ] Write comprehensive tests for event reducer
- [ ] Test undo/redo with complex event sequences
- [ ] Test state immutability

**Deliverable**: ✅ **COMPLETED** - Working event sourcing system with undo/redo (tests pending)

---

## Milestone 5: Page Builder Canvas (Advanced)

**Duration**: ~4-5 weeks ✅ **COMPLETE (100%)**
**Goal**: Professional-grade infinite canvas with comprehensive interactions, multi-selection, and transform tools

**Completion Date**: November 18, 2024

### Tasks

#### 5.1 Canvas Component ✅ COMPLETE
- [x] Create `/src/routes/+page.svelte` (main canvas page)
- [x] Infinite canvas with pan and zoom (mouse wheel, trackpad, keyboard)
- [x] Viewport transformation system with proper transform-origin
- [x] Grid background (baseline grid with 8px default, customizable)
- [x] Render all pages as artboards on canvas with frame labels
- [x] Page viewport with zoom range 0.1x to 4x
- [x] Zoom controls: Cmd/Ctrl + Plus/Minus/0 for zoom in/out/reset
- [x] Pan controls: Space + drag, Shift + wheel for horizontal panning
- [x] Visual artboard frames displayed on canvas

#### 5.2 Drawing Tools ✅ COMPLETE
- [x] **Div Tool** (`d` key) - Click or drag to create containers
  - [x] Click to create default 200×200 size
  - [x] Drag to custom size (supports all 4 quadrants)
  - [x] Live preview during drag with blue dashed border
  - [x] Minimum size threshold (10px) for click-to-create
- [x] **Text Tool** (`t` key) - Click or drag to create text elements
  - [x] Default 300×100 size with placeholder text
  - [x] Tool stays selected after creation (no auto-switch)
- [x] **Media Tool** (`m` key) - Click or drag to create image/video placeholders
  - [x] Default 200×200 size with SVG placeholder
  - [x] "Select Image" placeholder message

#### 5.3 Element Rendering (3 Components) ✅ COMPLETE
- [x] **Div Component**: Render with styles (background, border, opacity, border radius)
- [x] **Text Component**: Render as `<p>` with typography support
- [x] **Media Component**: Render as `<img>` placeholder with alt text support

**Implementation**: All in `/src/lib/components/canvas/CanvasElement.svelte`

#### 5.4 Selection System ✅ COMPLETE
- [x] **Individual Selection**:
  - [x] Click to select single element
  - [x] Shift+click to toggle element in/out of selection
  - [x] Click empty canvas to deselect all
  - [x] Selection highlighting with blue border
  - [x] Current selection stored in design-store
- [x] **Multi-Selection**:
  - [x] Drag selection box on canvas background
  - [x] Select all elements via Cmd/Ctrl+A
  - [x] Group transforms applied atomically as single event
  - [x] Multi-selection properties panel with "Mixed" indicators
  - [x] Escape key to deselect all
- [x] **Move Tool** (`v` key):
  - [x] Primary interaction tool for selection and dragging
  - [x] Smart multi-click detection with 3px dead zone
  - [x] Element-level selection based on click, not just drag area

#### 5.5 Transform Interactions ✅ COMPLETE
- [x] **Dragging** (single and multi-selection):
  - [x] Real-time position updates via pending transforms
  - [x] Broadcasts to interaction-store for live preview
  - [x] Group drag with offset preservation
  - [x] Atomic batch operations (GROUP_MOVE_ELEMENTS event)
- [x] **Resizing**:
  - [x] 8 resize handles: NW, N, NE, E, SE, S, SW, W
  - [x] Single element standard corner/edge drag
  - [x] Multi-selection bounding box handles
  - [x] Rotated element support with proper matrix math
  - [x] Maintain aspect ratio with Shift key
  - [x] Edge handles (N, S, E, W) for directional resize
  - [x] Live preview with pending sizes
  - [x] Position updates for corner handles
- [x] **Rotation** (Figma-style):
  - [x] Rotation zone: 15px extension around corners
  - [x] Center-point rotation for single and multi-selection
  - [x] Angle calculation from mouse to center point
  - [x] Full 360° rotation support
  - [x] Keyboard shortcuts: Cmd/Ctrl+[ for -15°, Cmd/Ctrl+] for +15°
  - [x] Individual element rotation preserved
  - [x] Multi-selection rotates all elements together
- [x] **Corner Radius Editing** (NEW FEATURE):
  - [x] Synchronized mode: All corners via single slider
  - [x] Independent mode: Alt+drag individual corners (NW, NE, SE, SW)
  - [x] Visual radius handles positioned at 45° diagonal
  - [x] Handle positioning scales with viewport zoom
  - [x] Constraint clamping: Max radius = 50% of smaller dimension
  - [x] Proper handle distance calculation during drag
  - [x] Initial value clamping to match handle position

#### 5.6 Tool System ✅ COMPLETE
- [x] **Move Tool** (`v` key) - Select and move elements
- [x] **Hand Tool** (`h` key) - Pan canvas (elements not selectable)
- [x] **Scale Tool** (`s` key) - Free-form proportional resize
- [x] Tool persistence (stays selected until changed)
- [x] Cursor changes per tool (crosshair, grab, etc.)

#### 5.7 Styling & Properties Panel ✅ COMPLETE
- [x] **Elements Supported**: div, p (text), img (media)
- [x] **Div Properties**:
  - [x] Frame toggle: Convert div to breakpoint frame
  - [x] Background color with color picker
  - [x] Border: width, color, style (solid/dashed/dotted)
  - [x] Opacity: Range slider 0-100%
  - [x] Border radius: Synchronized and independent corner editing
  - [x] Info display: Position (x,y) and Size (W×H)
- [x] **Media Properties**:
  - [x] Image source input
  - [x] Alt text field
- [x] **Multi-Selection Properties**:
  - [x] Background color with "Mixed" indicator
  - [x] Border properties with per-property "Mixed" handling
  - [x] Opacity with "Mixed" state
  - [x] Count of selected elements
  - [x] Batch update for unified styling

#### 5.8 Keyboard Shortcuts ✅ COMPLETE
- [x] **File Operations**: Cmd/Ctrl+S (save), Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
- [x] **Clipboard**: Cmd/Ctrl+C (copy), Cmd/Ctrl+V (paste), Cmd/Ctrl+D (duplicate)
- [x] **Selection**: Cmd/Ctrl+A (select all), Escape (deselect)
- [x] **Tools**: V (Move), H (Hand), S (Scale), D (Div), T (Text), M (Media)
- [x] **Transforms**: Cmd/Ctrl+[ (rotate -15°), Cmd/Ctrl+] (rotate +15°)
- [x] **Canvas**: Cmd/Ctrl + wheel (zoom), Cmd/Ctrl+0 (reset zoom to 100%)
- [x] **Delete**: Delete/Backspace keys

#### 5.9 Frame Management ✅ COMPLETE
- [x] Pages render as artboards with labels
- [x] Page switching (setCurrentPage)
- [x] Default "Untitled Page" auto-created on initialization
- [x] Frame to breakpoint conversion checkbox in properties
- [x] Frame data model and storage system complete

**Note**: Advanced frame UI controls (drag header, resize edges, etc.) deferred to future milestone as basic frame functionality is operational

**Deliverable**: ✅ **100% COMPLETE** - Professional-grade canvas with comprehensive Figma-style interactions.

**Major Achievements**:
- ✅ Full multi-selection support with group transforms and transaction batching
- ✅ Auto-layout child reordering with visual ghost positioning
- ✅ Parent change detection during element drops
- ✅ Figma-style rotation with keyboard shortcuts and 15px interaction zones
- ✅ Independent corner radius editing with Alt key modifier
- ✅ Smart clipboard operations (copy, cut, paste, duplicate) with parent detection
- ✅ Text editing with inline editor and formatting shortcuts
- ✅ Comprehensive keyboard shortcut system (30+ shortcuts)
- ✅ Three drawing tools (Div, Text, Media) with live preview and quadrant support
- ✅ Zoom/pan/viewport system with smooth transforms
- ✅ Live preview system with pending transforms for real-time feedback
- ✅ Event sourcing with optimized undo/redo and transaction batching
- ✅ Rotated element support in all operations (drag, resize, auto-layout)

**Completed Components** (13 components, 5,000+ lines):
- [x] Canvas.svelte (664 lines) - Main canvas with pan/zoom/grid
- [x] CanvasElement.svelte (772 lines) - Element renderer with live preview
- [x] SelectionUI.svelte (642 lines) - Visual handles (resize, rotate, radius)
- [x] SelectionOverlay.svelte (2,554 lines) - Complete interaction handling
- [x] SelectionBox.svelte (207 lines) - Multi-select box
- [x] BaselineGrid.svelte (79 lines) - Grid overlay
- [x] Toolbar.svelte (199 lines) - Tool selector with shortcuts
- [x] ShortcutsModal.svelte (241 lines) - Keyboard shortcuts reference
- [x] PropertiesWindow.svelte (82 lines) - Properties panel container
- [x] DivProperties.svelte (528 lines) - Div-specific properties
- [x] TextProperties.svelte (384 lines) - Text formatting properties
- [x] MediaProperties.svelte (219 lines) - Media properties
- [x] MultiSelectionProperties.svelte (282 lines) - Multi-selection properties

**Stores** (7,500+ lines total):
- [x] design-store.ts (1,450 lines) - Main API with 60+ exported functions
- [x] event-store.ts (331 lines) - IndexedDB persistence with snapshots
- [x] event-reducer.ts (488 lines) - Pure reducer handling all events
- [x] interaction-store.ts (58 lines) - Live preview state broadcast
- [x] tool-store.ts (36 lines) - Current tool state
- [x] viewport-store.ts (61 lines) - Canvas viewport management

---

## Advanced Features Implemented (Beyond Original Scope)

The following features were implemented during Milestone 5 that significantly expanded beyond the original roadmap specification:

### Auto-Layout Child Reordering (NEW)
- **Drag-and-drop reordering** for children inside auto-layout containers
- Visual ghost positioning showing where element will be inserted
- Support for rotated elements in reordering operations
- Proper handling of align-content-based layouts
- Real-time feedback during reorder operations

### Parent Change Detection (NEW)
- **Automatic parent detection** when dropping elements on other containers
- Smart reparenting with proper coordinate transformation
- Maintains element position visually while changing parent in DOM hierarchy
- Works seamlessly with rotated elements

### Smart Clipboard Operations (NEW)
- **Intelligent paste** with parent detection based on cursor position
- Cut support for move operations
- Duplicate with smart offset positioning
- Rotation preservation on paste operations

### Text Editing System (NEW)
- **Inline text editor** with immediate focus on double-click
- Bold, italic, underline formatting shortcuts (Cmd+B/I/U)
- Selection preservation during text editing
- Conflict avoidance with devtools shortcuts

### Group/Ungroup Operations (NEW)
- **Transaction batching** for atomic group operations
- Single undo/redo for grouped actions
- Proper event sequencing for complex operations

### Independent Corner Radius Editing
- **Alt + drag radius handles** to edit individual corners independently
- Visual handles positioned at 45° diagonal for each corner
- Proper constraint handling (max 50% of smaller dimension)
- Smooth transition between synchronized and independent modes
- Handle scaling with viewport zoom

### Figma-Style Rotation
- **15px rotation zones** around corners for intuitive rotation initiation
- Center-point rotation with angle display
- Multi-selection rotation (all elements rotate together)
- Keyboard shortcuts for precise 15° increments (Cmd+[/])
- Rotated element support in all operations

### Advanced Multi-Selection
- **Group transforms** as atomic events (single undo operation)
- "Mixed" value indicators in properties panel
- Batch property updates for multiple elements
- Offset preservation during group drag
- Shift+click additive selection

### Three Drawing Tools
- **Div, Text, and Media tools** with click-to-create and drag-to-size
- Live preview during creation with blue dashed border
- Support for all 4 quadrants when dragging
- Smart minimum size threshold

### Live Preview System
- **Pending transforms** broadcast via interaction-store
- Real-time visual feedback without event dispatch
- Separate UI state from persisted event state
- No DOM thrashing during drag/resize/rotate
- Ghost positioning for auto-layout reordering

### Professional Keyboard Shortcuts
- **Comprehensive shortcut system** matching Figma/Sketch patterns
- Tool switching (V, H, S, D, T, M keys)
- Transform shortcuts (Cmd+[/] for rotation, Cmd+G for group)
- Clipboard shortcuts (Cmd+C/X/V, Cmd+D for duplicate)
- Text formatting (Cmd+B/I/U)
- Canvas navigation (Cmd+0 for zoom reset, Space+drag for pan)
- Shortcuts modal (Cmd+/) for reference

### Zoom and Viewport
- **Advanced zoom system**: 0.1x to 4x range with smooth transitions
- Center-on-mouse zoom behavior
- Shift + wheel for horizontal panning
- Transform-origin optimization for performance
- Proper zoom reset preserving center position

---

## Milestone 6: Page Builder UI (Floating Windows)

**Duration**: ~2 weeks (PARTIALLY COMPLETE - 60%)
**Goal**: Illustrator-style floating windows for properties, layers, blocks, tokens
**Latest**: Advanced Typography System implemented (November 29, 2024)

### Tasks

#### 6.1 Window System 🚧 PARTIAL
- [x] Create `/src/lib/components/ui/FloatingWindow.svelte`
  - [x] Basic window structure
  - [ ] Draggable window header (not yet implemented)
  - [ ] Resizable window (drag edges)
  - [ ] Minimize/maximize/close buttons
  - [ ] Remember position in localStorage
  - [ ] Bring to front on click (window stacking management)
  - [ ] Snap to edges (optional)

#### 6.2 Toolbar (Fixed Top) ✅ COMPLETE
- [x] Component buttons: Div, Text, Media
- [x] Tool selector: Move, Hand, Scale
- [x] Undo/redo buttons (with keyboard shortcuts)
- [x] Zoom controls in canvas
- [x] Manual save button with timestamp display
- [ ] Preview button (toggle preview mode)
- [ ] Publish button (modal with settings)
- [ ] Page settings dropdown (title, slug, SEO)

**Note**: Basic toolbar operational, publish/preview workflow not yet implemented

#### 6.3 Layers Window ❌ NOT STARTED
- [ ] Tree view of all elements in current frame
- [ ] Nested structure (children indented)
- [ ] Click to select element
- [ ] Drag to reorder (change array position in DOM)
- [ ] Eye icon to hide/show element
- [ ] Lock icon to lock element (prevent editing)
- [ ] Rename element (double-click)

**Note**: Core functionality for layers exists in design-store (array-based stacking, visibility, locking), UI not built

#### 6.4 Properties Window ✅ ENHANCED (Typography Complete)
- [x] **Div Properties**: Background, border, opacity, border radius (sync + independent)
- [x] **Media Properties**: Source input, alt text
- [x] **Multi-Selection Properties**: All properties with "Mixed" indicators
- [x] **Position/Size Display**: X/Y position, W×H size
- [x] **Text Properties - Typography System**: ✨ **NEWLY IMPLEMENTED**
  - [x] Typography presets (H1-H6, Body, Caption, Small, Custom)
  - [x] Font family (System fonts + Google Fonts)
  - [x] Font size, weight, and style (normal, italic, oblique)
  - [x] Line height, letter spacing, word spacing, text indent
  - [x] Text alignment (left, center, right, justify)
  - [x] Text decoration (underline, strikethrough, overline) with style and color
  - [x] Text transform (uppercase, lowercase, capitalize)
  - [x] Advanced: white space handling, word break, hyphenation
  - [x] Text color with color picker
  - [x] Visual preset grid with previews
- [ ] **Layout Properties**: Position type, padding, margin
- [ ] **Effects**: Box shadows, filters
- [ ] Link to design tokens (e.g., select "Primary" color)

**Note**: Typography system COMPLETE with comprehensive controls and preset support

#### 6.5 Blocks Window ❌ NOT STARTED
- [ ] List all user blocks (grouped by source page)
- [ ] Search/filter blocks
- [ ] Drag block to canvas to create instance
- [ ] Edit master block button (opens in new tab)
- [ ] Delete block (with confirmation)

**Note**: Component system APIs exist in design-store but UI not built

#### 6.6 Tokens Window ❌ NOT STARTED
- [ ] Quick access to design tokens
- [ ] Edit tokens inline (opens modal)
- [ ] Apply token to selected element

**Deliverable**: 🚧 **60% COMPLETE** - Comprehensive typography system with presets, toolbar operational, properties window enhanced with advanced text controls

### Typography System Features (Newly Implemented - November 29, 2024)

**Professional Typography Controls**:
- ✅ **10 Typography Presets**: H1-H6, Body, Caption, Small, Custom with visual preview grid
- ✅ **Comprehensive Font Controls**: Family (14 fonts including Google Fonts), size (17 options), weight (9 levels), style (normal/italic/oblique)
- ✅ **Advanced Spacing**: Line height, letter spacing, word spacing, text indent with precise control
- ✅ **Text Formatting**: Alignment (4 modes), decoration (underline/strikethrough/overline with style and color), transform (4 modes)
- ✅ **Professional Features**: White space handling, word break control, hyphenation support
- ✅ **Event System**: APPLY_TYPOGRAPHY_PRESET event for preset application, UPDATE_TYPOGRAPHY for custom changes
- ✅ **Token Integration**: Presets automatically apply values from design tokens (defaultTokens)
- ✅ **Smart Preset Detection**: Automatically switches to "Custom" when manually editing properties
- ✅ **Full Rendering Support**: All typography properties render correctly on canvas via CanvasElement

**Implementation Details**:
- Extended `TypographyStyle` interface with 9 new properties (fontStyle, textDecorationColor, textDecorationStyle, textIndent, wordSpacing, whiteSpace, wordBreak, hyphens, preset)
- Added `TypographyPreset` type with 10 preset options
- Created `ApplyTypographyPresetEvent` for event sourcing
- Enhanced `TextProperties.svelte` with 626 lines of comprehensive UI (preset grid, font controls, spacing, formatting, advanced)
- Updated event reducer with `handleApplyTypographyPreset` function
- Added `applyTypographyPreset` function to design-store
- Updated `CanvasElement.svelte` to render all 16 typography CSS properties

**Code Statistics**:
- Types: +60 lines (TypographyStyle, TypographyPreset, ApplyTypographyPresetEvent)
- Event Reducer: +50 lines (preset handler with token mapping)
- Design Store: +15 lines (applyTypographyPreset function)
- TextProperties UI: 626 lines (complete rewrite with preset system)
- CanvasElement Rendering: +7 CSS properties (total 16 typography properties)

---

## Milestone 7: User Blocks System

**Duration**: ~1-2 weeks
**Goal**: Convert selections to reusable blocks with master-instance system

### Tasks

#### 7.1 Block Creation
- [ ] Right-click context menu: "Convert to Block"
- [ ] Modal: Name block, select source page
- [ ] Save block with design events (elements + styles)
- [ ] Update database: create `Block` entry
- [ ] Create `BlockInstance` linking to original elements

#### 7.2 Block Instances
- [ ] Drag block from Blocks window to canvas
- [ ] Create new `BlockInstance` entry
- [ ] Replay block's design events in target frame
- [ ] Link instance to master block

#### 7.3 Master-Instance Sync
- [ ] Edit master block → updates all instances
- [ ] Visual indicator on instances (e.g., dotted border)
- [ ] "Edit Master" button in properties (opens master in new tab)

#### 7.4 Detachment
- [ ] Edit instance element → auto-detach
- [ ] Update `BlockInstance.isDetached = true`
- [ ] Store override events in `BlockInstance.overrideEvents`
- [ ] Detached instances no longer receive master updates

#### 7.5 Push to Master
- [ ] "Push Changes to Master" button (only for detached instances)
- [ ] Modal: Confirm changes
- [ ] Update master block's design events
- [ ] Re-sync all non-detached instances

**Deliverable**: Working user blocks with master-instance system

---

## Milestone 8: Baseline Grid & Snapping

**Duration**: ~1 week
**Goal**: Baseline grid for typography alignment

### Tasks

#### 8.1 Baseline Grid Rendering
- [ ] Create `/src/lib/components/baseline/BaselineGrid.svelte`
- [ ] Render horizontal lines based on grid unit (from tokens)
- [ ] Show/hide grid toggle (in toolbar or settings)
- [ ] Grid opacity control (faint lines, not distracting)

#### 8.2 Snap to Baseline
- [ ] When moving/resizing elements, snap to baseline grid
- [ ] Visual feedback: show snap guides
- [ ] Enable/disable snapping (Shift key to temporarily disable)
- [ ] Snap to grid unit multiples (e.g., 4px, 8px, 16px)

#### 8.3 Typography Baseline Alignment
- [ ] Text elements align to baseline (not top)
- [ ] Calculate line height based on baseline unit
- [ ] Typography tokens enforce baseline multiples

**Deliverable**: Working baseline grid with snapping

---

## Milestone 9: Publishing System

**Duration**: ~2-3 weeks
**Goal**: Generate Svelte code, publish pages, and export static sites

### Tasks

#### 9.1 Code Generator
- [ ] Create `/src/lib/utils/code-generator.ts`
  - [ ] `generateSvelteComponent()` - Convert design events to Svelte code
  - [ ] Generate HTML structure from element tree
  - [ ] Generate CSS styles (classes or inline)
  - [ ] Handle responsive breakpoints (mobile-first media queries)
  - [ ] Apply design tokens (CSS custom properties)
  - [ ] Optimize output (minify, remove unused styles)

#### 9.2 Publishing Service
- [ ] Create `/src/lib/server/services/publish.ts`
  - [ ] `publishPage()` - Generate code, save to database, create route
  - [ ] Store `publishedCode` in `Page` model
  - [ ] Create dynamic route: `/src/routes/[slug]/+page.server.ts`
  - [ ] Server-side render published Svelte components
  - [ ] Handle 404 for unpublished pages

#### 9.3 API Routes: Publishing
- [ ] `POST /api/pages/:id/publish` - Publish page
- [ ] `POST /api/pages/:id/unpublish` - Unpublish page
- [ ] `GET /api/pages/:id/preview` - Preview without publishing

#### 9.4 Preview Mode
- [ ] Preview button in designer toolbar
- [ ] Render page without saving (use current events)
- [ ] Toggle between designer and preview (same tab)

#### 9.5 Static Export
- [ ] Create `/src/lib/server/services/export.ts`
  - [ ] `exportSite()` - Generate .zip with HTML/CSS/assets
  - [ ] Pure HTML/CSS (no Svelte runtime)
  - [ ] Include all media files
  - [ ] Generate index.html for navigation
- [ ] Export button in admin panel
- [ ] Download .zip file

**Deliverable**: Working publishing system with preview and static export

---

## Milestone 10: Pages Management

**Duration**: ~1 week
**Goal**: Create, list, edit, and delete pages

### Tasks

#### 10.1 Pages Service
- [ ] Create `/src/lib/server/services/pages.ts`
  - [ ] `createPage()` - Create new page with default frame
  - [ ] `listPages()` - Get all pages for team
  - [ ] `getPage()` - Get single page with frames
  - [ ] `updatePage()` - Update page metadata (title, slug, SEO)
  - [ ] `deletePage()` - Delete page and all frames/instances

#### 10.2 API Routes: Pages
- [ ] `POST /api/pages` - Create page
- [ ] `GET /api/pages` - List all pages (with filters, search)
- [ ] `GET /api/pages/:id` - Get single page
- [ ] `PUT /api/pages/:id` - Update page metadata
- [ ] `DELETE /api/pages/:id` - Delete page

#### 10.3 Admin UI: Pages List
- [ ] Create `/src/routes/admin/pages/+page.svelte`
  - [ ] Grid/list view of all pages
  - [ ] Create new page button
  - [ ] Edit page button (opens designer)
  - [ ] Delete page (with confirmation)
  - [ ] Publish/unpublish toggle
  - [ ] Search and filter (published, draft, by author)
  - [ ] Page preview thumbnails (optional)

**Deliverable**: Complete page management UI

---

## Milestone 11: Team & User Management

**Duration**: ~1-2 weeks
**Goal**: Multi-user teams with role-based access control

### Tasks

#### 11.1 Team Service
- [ ] Create `/src/lib/server/services/teams.ts`
  - [ ] `createTeam()` - Create team with owner
  - [ ] `getTeam()` - Get team details
  - [ ] `updateTeam()` - Update team name/slug
  - [ ] `deleteTeam()` - Delete team (cascade to pages, media, etc.)

#### 11.2 Team Members Service
- [ ] Create `/src/lib/server/services/team-members.ts`
  - [ ] `inviteMember()` - Send invite email (or generate invite link)
  - [ ] `acceptInvite()` - User joins team
  - [ ] `updateMemberRole()` - Change role (Owner/Manager/Designer/Editor)
  - [ ] `removeMember()` - Remove user from team

#### 11.3 API Routes: Teams
- [ ] `POST /api/teams` - Create team
- [ ] `GET /api/teams/:id` - Get team
- [ ] `PUT /api/teams/:id` - Update team
- [ ] `DELETE /api/teams/:id` - Delete team
- [ ] `GET /api/teams/:id/members` - List team members
- [ ] `POST /api/teams/:id/members/invite` - Invite member
- [ ] `PUT /api/teams/:id/members/:userId/role` - Update member role
- [ ] `DELETE /api/teams/:id/members/:userId` - Remove member

#### 11.4 Admin UI: Team Settings
- [ ] Create `/src/routes/admin/team/+page.svelte`
  - [ ] Team name and slug
  - [ ] Members list with roles
  - [ ] Invite member form (email + role)
  - [ ] Remove member button (with confirmation)
  - [ ] Change member role dropdown
  - [ ] Leave team button (if not owner)
  - [ ] Delete team button (owner only, with confirmation)

#### 11.5 Permissions Enforcement
- [ ] Middleware: Check user role before actions
  - [ ] **Owner**: Full access (all CRUD operations, delete team)
  - [ ] **Manager**: Manage pages, media, members (except owner operations)
  - [ ] **Designer**: Create/edit pages, upload media (cannot publish or manage team)
  - [ ] **Editor**: Edit content only (cannot create pages or upload media)
- [ ] UI: Hide buttons based on user role
- [ ] API: Return 403 Forbidden if insufficient permissions

**Deliverable**: Working team system with RBAC

---

## Milestone 12: Theme Export/Import

**Duration**: ~1 week
**Goal**: Export entire sites as .baseline-theme files or via API

### Tasks

#### 12.1 Theme Export Service
- [ ] Create `/src/lib/server/services/theme-export.ts`
  - [ ] `exportTheme()` - Generate JSON with all pages, blocks, media, tokens
  - [ ] Include design events, published code, and metadata
  - [ ] Package as `.baseline-theme` file (JSON)
  - [ ] Include all media files (embedded as base64 or separate folder)

#### 12.2 Theme Import Service
- [ ] Create `/src/lib/server/services/theme-import.ts`
  - [ ] `importTheme()` - Parse .baseline-theme file
  - [ ] Create pages, frames, blocks, media entries
  - [ ] Validate data (check for conflicts, missing references)
  - [ ] Option: Overwrite existing or merge
  - [ ] Return import report (success, warnings, errors)

#### 12.3 API Routes: Theme
- [ ] `POST /api/themes/export` - Export as file download
- [ ] `POST /api/themes/import` - Upload and import .baseline-theme file
- [ ] `GET /api/themes/remote/:url` - Import from remote URL (API transfer)

#### 12.4 Admin UI: Theme Import/Export
- [ ] Create `/src/routes/admin/themes/export/+page.svelte`
  - [ ] Export button (downloads .baseline-theme file)
  - [ ] Options: Include media, include unpublished pages
- [ ] Create `/src/routes/admin/themes/import/+page.svelte`
  - [ ] File upload form (.baseline-theme)
  - [ ] Remote URL input (import from another Linabasis instance)
  - [ ] Import preview (show what will be imported)
  - [ ] Import button (with confirmation)

**Deliverable**: Working theme export/import system

---

## Milestone 13: Admin Dashboard & Navigation

**Duration**: ~1 week
**Goal**: Admin panel home page and navigation

### Tasks

#### 13.1 Admin Layout
- [ ] Create `/src/routes/admin/+layout.svelte`
  - [ ] Sidebar navigation (Pages, Media, Styles, Team, Settings)
  - [ ] User menu (profile, logout)
  - [ ] Team switcher (if user belongs to multiple teams)
  - [ ] Responsive design (collapse sidebar on mobile)

#### 13.2 Admin Dashboard
- [ ] Create `/src/routes/admin/+page.svelte`
  - [ ] Quick stats: Total pages, published pages, media count, team members
  - [ ] Recent pages (last edited)
  - [ ] Quick actions: New page, upload media, view published site
  - [ ] System status (optional)

#### 13.3 Settings Page
- [ ] Create `/src/routes/admin/settings/+page.svelte`
  - [ ] Site settings: Site name, URL, timezone
  - [ ] SEO defaults: Meta description, social image
  - [ ] User profile: Name, email, password change
  - [ ] Delete account (with confirmation)

**Deliverable**: Complete admin panel with navigation

---

## Milestone 14: Polish & Testing

**Duration**: ~2-3 weeks
**Goal**: Bug fixes, performance optimization, and comprehensive testing

### Tasks

#### 14.1 Performance Optimization
- [ ] Lazy load frames (render only visible frames on canvas)
- [ ] Debounce auto-save (avoid excessive writes)
- [ ] Optimize event replay (use snapshots for large histories)
- [ ] Code splitting (lazy load admin routes)
- [ ] Image optimization (use WebP, responsive images)

#### 14.2 Error Handling
- [ ] Global error boundary (catch React/Svelte errors)
- [ ] API error handling (consistent error responses)
- [ ] User-friendly error messages (no stack traces in production)
- [ ] Retry logic for failed requests
- [ ] Offline mode detection (show banner when offline)

#### 14.3 Unit Testing
- [ ] Test all services (auth, media, pages, tokens, teams)
- [ ] Test event reducer (all event types)
- [ ] Test code generator (Svelte output)
- [ ] Test permissions middleware
- [ ] Aim for >80% code coverage

#### 14.4 Integration Testing
- [ ] Test complete workflows (register → create page → publish)
- [ ] Test team collaboration (multiple users)
- [ ] Test theme export/import
- [ ] Test block master-instance sync

#### 14.5 UI/UX Polish
- [ ] Loading states (spinners, skeletons)
- [ ] Empty states (no pages, no media, no blocks)
- [ ] Confirmation dialogs (delete, logout, etc.)
- [ ] Keyboard shortcuts help panel (Cmd/Ctrl + ?)
- [ ] Tooltips for all buttons
- [ ] Responsive design (mobile-friendly admin panel)

#### 14.6 Documentation
- [ ] Update README.md with installation instructions
- [ ] Write user guide (how to use the page builder)
- [ ] Write API documentation
- [ ] Create video tutorials (optional)
- [ ] Update CHANGELOG.md

**Deliverable**: Polished, tested, and documented Phase 1 MVP

---

## Milestone 15: Deployment & Launch

**Duration**: ~1 week
**Goal**: Deploy Phase 1 MVP and launch publicly

### Tasks

#### 15.1 Production Setup
- [ ] Set up production PostgreSQL database
- [ ] Configure environment variables (production)
- [ ] Set up SSL certificates (HTTPS)
- [ ] Configure domain and DNS
- [ ] Set up CDN for media files (optional)

#### 15.2 Deployment
- [ ] Deploy to production server (Vercel, Railway, DigitalOcean, etc.)
- [ ] Run database migrations
- [ ] Create first admin user
- [ ] Test all features in production
- [ ] Monitor for errors (Sentry, LogRocket, etc.)

#### 15.3 Launch Preparation
- [ ] Create demo site (showcase Linabasis features)
- [ ] Write launch blog post
- [ ] Prepare social media posts
- [ ] Create GitHub release (v1.0.0)
- [ ] Tag release: `git tag v1.0.0 && git push --tags`

#### 15.4 Launch
- [ ] Post on Hacker News, Reddit, Twitter, etc.
- [ ] Share in developer communities
- [ ] Collect feedback and bug reports
- [ ] Monitor analytics and usage
- [ ] Respond to GitHub issues

**Deliverable**: Linabasis Phase 1 MVP is live!

---

## Phase 1 Completion Checklist

Before moving to Phase 2, ensure:

- [ ] All 15 milestones completed
- [ ] All tests passing (>80% coverage)
- [ ] Production deployment is stable
- [ ] Documentation is complete and accurate
- [ ] At least 10 real users testing the platform
- [ ] No critical bugs or security issues
- [ ] Performance is acceptable (< 2s page load, < 100ms interactions)
- [ ] GitHub release v1.0.0 published
- [ ] Feedback collected and prioritized

**Once Phase 1 is complete, proceed to Phase 2: Custom Blocks**

---

## Notes

- **Flexibility**: This roadmap is a guide, not a contract. Milestones may be reordered or split based on feedback.
- **Building in Public**: Share progress on social media, blog, and GitHub discussions.
- **Community Feedback**: Actively listen to early adopters and iterate based on their needs.
- **Technical Debt**: Keep a backlog of technical debt items to address between phases.

---

## Next Steps

1. Review this roadmap and adjust milestones as needed
2. Break down Milestone 1 into daily tasks
3. Create feature branch: `git checkout -b feat/foundation-database`
4. Start implementing! 🚀
