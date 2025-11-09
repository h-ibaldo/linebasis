# Page Builder Specification

This document defines the complete specification for the LineBasis page builder interface - the core design tool where users create and edit pages.

## Terminology

- **Components**: The 3 atomic building blocks (Div, Text, Media) available in the toolbar
- **Blocks**: User-created reusable design elements organized by source page
- **Canvas**: The design file for a page (each page has one canvas containing all breakpoints)
- **Frames**: Artboards on the canvas representing breakpoints within a page
- **Breakpoints**: Different frame sizes for responsive design (desktop, tablet, mobile)
- **Properties**: Configurable attributes of components and blocks (see component-properties.md)

---

## Interface Overview

The page builder uses a **floating windows system** (Illustrator-style) with a fixed top toolbar and infinite canvas. All windows are movable, resizable, collapsible, and can auto-organize.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR (Fixed)                                                 │
│ [Move ▼] [Div] [Text] [Media] │ [Save] [Preview] [Publish]    │
│ [↶] [↷] [100% ▼] [Page: Homepage ▼]                           │
└─────────────────────────────────────────────────────────────────┘
                    Infinite Canvas
        ┌─────────────────────────┐
        │  Frame (Desktop)        │
        │  Breakpoint: 1920px     │
        │  ┌───────────────────┐  │
        │  │ Div               │  │
        │  │   └─ Text         │  │
        │  │   └─ Media        │  │
        │  └───────────────────┘  │
        └─────────────────────────┘

┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ Blocks      │  │ Layers       │  │ Properties   │
│ Window      │  │ Window       │  │ Window       │
│ (Floating)  │  │ (Floating)   │  │ (Floating)   │
└─────────────┘  └──────────────┘  └──────────────┘
```

---

## Top Toolbar (Fixed)

The toolbar is **fixed at the top** and contains all primary tools and actions.

### Left Section - Tools

**Tool Selector (Dropdown)**:
- **Move** (default) - Select and move elements
- **Hand** - Pan around canvas
- **Scale** - Resize elements

**Component Tools** (Direct buttons):
- Button: **Div** - Insert Div component
- Button: **Text** - Insert Text component (rich text)
- Button: **Media** - Insert Media component (images/videos)

**Note**: Form Builder is available as a default block, not a component tool.

### Middle Section - Canvas Controls

- Button: **Undo** (↶) - Undo last action (Cmd+Z)
- Button: **Redo** (↷) - Redo last action (Cmd+Shift+Z)
- Dropdown: **Zoom** (100% ▼) - Canvas zoom level
  - 25%, 50%, 75%, 100%, 125%, 150%, 200%, Fit to screen
- Dropdown: **Page Selector** (Page: Homepage ▼) - Switch between design files
  - Lists all pages in project
  - Click to switch active page
  - Shows current page name

### Right Section - Actions

- Button: **Save** - Manual save (auto-save enabled)
  - Shows save status: "Saved" / "Saving..." / "Unsaved changes"
- Button: **Preview** - Preview page before publishing
  - Opens `/admin/preview/{page-id}` in new tab
- Button: **Publish** - Publish page to live site
  - Opens Publish Modal (see below)

### Window Menu (Dropdown)

- Checkbox: Show Blocks Window
- Checkbox: Show Layers Window
- Checkbox: Show Properties Window
- Checkbox: Show Tokens Window
- Checkbox: Show Code Window (future)
- Separator
- Action: Auto-Organize Windows (Illustrator-style layout)
- Action: Reset Window Positions

---

## Infinite Canvas

The infinite canvas is where frames and design elements live. Users can pan, zoom, and organize multiple frames.

### Canvas Features

- **Infinite Panning**: Drag with Hand tool or Space + drag
- **Zoom**: Mouse wheel, pinch gesture, or zoom dropdown
- **Grid Overlay** (optional): Shows baseline grid when enabled
  - Toggle: Cmd+' (quote)
  - Customizable grid size (from Tokens/Baseline settings)
- **Snap-to-Baseline** (optional): Elements snap to baseline grid when dragging
  - Toggle: Cmd+Shift+'
  - Respects component `snapToBaseline` property
- **Multi-selection**: Click + drag to select multiple elements
  - Or Shift+click to add to selection

### Canvas Context Menu (Right-click on canvas)

- New Frame (creates new frame on canvas)
- Paste (if clipboard has copied elements)
- Select All (Cmd+A)
- Zoom to Fit All Frames
- Show/Hide Grid
- Show/Hide Rulers (future)

---

## Frames

Frames are artboards on the canvas that represent different breakpoints of a page. A canvas contains multiple frames, each representing a different responsive breakpoint. Frames are special Div components with additional properties.

### Frame Appearance

```
┌─────────────────────────────┐
│ Homepage - Desktop          │ ← Frame header
│ Breakpoint: 1920px          │
├─────────────────────────────┤
│                             │
│   [Design content here]     │
│                             │
│                             │
└─────────────────────────────┘
```

### Frame Header

- **Frame Name**: Editable name (click to rename)
- **Breakpoint Size**: Shows current breakpoint width (e.g., "1920px")

### Frame Actions (Right-click on frame header)

- Rename Frame
- Duplicate Frame
- Add Breakpoint (creates new frame with different width)
- Set as Default Breakpoint (which frame shows by default)
- Delete Frame (requires confirmation)
- Frame Settings:
  - Input: Frame width (px)
  - Input: Frame height (auto or fixed px)

### Creating Frames

**Method 1**: From toolbar
- Click "New Frame" button (or Cmd+N)
- Drag to define size on canvas
- Frame created with default breakpoint (1920px desktop)

**Method 2**: From existing frame
- Right-click frame header → "Add Breakpoint"
- Creates new frame for different screen size
- Auto-links frames as breakpoints of same page

**Method 3**: From Pages list
- Click "New Page" in `/admin/pages`
- Opens designer with blank frame

### Frame Types & Breakpoints

**Desktop Frames**: 1920px, 1440px, 1366px (default: 1920px)
**Tablet Frames**: 1024px, 768px
**Mobile Frames**: 375px, 414px

Users can define custom breakpoint sizes.

**Note**: Publishing happens at the page level, not the frame level. When a page is published, all its frames (breakpoints) are published together as a responsive design.

---

## Floating Windows

All windows use an **Illustrator-style floating system**: movable, resizable, collapsible, dockable.

### Window Controls (All windows)

**Title Bar**:
- Window name (e.g., "Blocks", "Layers", "Properties")
- Button: Collapse/Expand (▼/▶)
- Button: Close (×)

**Interactions**:
- **Move**: Drag title bar to move window
- **Resize**: Drag edges or corners to resize
- **Collapse**: Click collapse button to minimize to title bar only
- **Close**: Click × to close (re-open via Window menu)
- **Dock**: Drag window to edge of screen to dock (snaps to side)
- **Auto-Organize**: Window menu → "Auto-Organize Windows" arranges all windows neatly

---

## Blocks Window

Displays user-created reusable blocks organized by source page.

### UI Elements

**Header**:
- Title: "Blocks"
- Button: Toggle grid/list view (icon)
- Search input: Filter blocks by name

**Default Blocks Section** (always visible):
- **Form Builder** block
  - Description: Drag to canvas to insert form builder
  - Thumbnail preview
  - Name: "Form Builder"
- **PostContent** block
  - Description: Blog post content area (for templates)
  - Thumbnail preview
  - Name: "Post Content"

**User Blocks Section** (organized by folders):

**Folder Structure**:
- Folders named after source page (e.g., "Homepage", "About Page")
- Collapsible folders (click to expand/collapse)
- If block has no source page, shows in "Unsorted" folder

**Block Item**:
- Thumbnail preview (screenshot of block design)
- Block name
- "Used in X pages" count

**Block Actions** (right-click on block):
- Insert to Canvas (same as drag)
- Edit Block (opens source page where block was created)
- Rename Block
- Duplicate Block
- Delete Block (requires confirmation)
- View Usage (shows list of pages using this block)

### Creating Blocks

**Method 1**: From canvas selection
1. Select element(s) on canvas
2. Right-click → "Convert to Block"
3. Modal appears:
   - Input: Block name
   - Preview: Shows selected elements
   - Button: Create Block
4. Block appears in Blocks window under current page folder

**Method 2**: From Layers window
1. Right-click layer → "Convert to Block"
2. Same modal as Method 1

### Editing Blocks

**To edit a block**:
1. Right-click block in Blocks window → "Edit Block"
2. Opens the source page where block was originally created
3. Find block instance on that page (highlighted automatically)
4. Edit the block
5. Changes propagate to all instances across all pages

**Note**: Blocks are **linked instances**. Editing the master updates all copies.

---

## Layers Window

Hierarchical tree view of all elements on the current frame.

### UI Elements

**Header**:
- Title: "Layers"
- Button: Collapse all layers
- Button: Expand all layers

**Layers Tree**:
- Displays nested hierarchy of elements
- Mirrors DOM structure of selected frame

**Layer Item**:
```
[▼] 🔲 Div Container           👁 🔒
    [▼] 📝 Heading Text        👁 🔒
    [ ] 🖼 Hero Image          👁 🔒
```

**Elements**:
- **Collapse Button** (▼/▶): Show/hide children
- **Icon**: Component type (🔲 Div, 📝 Text, 🖼 Media, 📦 Block)
- **Name**: Element name (editable, double-click to rename)
- **Visibility Toggle** (👁): Show/hide element on canvas
- **Lock Toggle** (🔒): Lock element (prevents selection/editing)

**Interactions**:
- **Click**: Select element (highlights on canvas)
- **Shift+Click**: Multi-select elements
- **Drag**: Reorder elements (changes DOM order)
- **Double-click name**: Rename element
- **Right-click**: Context menu

**Layer Context Menu** (Right-click):
- Rename Layer
- Duplicate Layer
- Convert to Block
- Delete Layer
- Separator
- Lock/Unlock Layer
- Show/Hide Layer
- Separator
- Expand All Children
- Collapse All Children

### Layer Auto-Highlighting

- When element selected on canvas → layer highlighted in tree
- When layer clicked → element highlighted on canvas
- Hovering layer → element outlined on canvas

---

## Properties Window

Displays editable properties for the currently selected element. Properties change based on component type.

### UI Elements

**Header**:
- Title: "Properties"
- Current selection name (e.g., "Div Container")

**Properties Sections** (collapsible accordions):

**See `component-properties.md` for complete property definitions.**

The Properties window displays sections based on component type:

**For Div**:
- General (ID, name, type, order)
- Position (behavior, positioning, layer)
- Size (width, height, constraints)
- Layout (Framer-style: distribute, align, gap, grid settings)
- Spacing (padding, margin)
- Transform (rotation, scale, move)
- Visual (opacity, blend mode, corner radius)
- Background (color, image, gradient)
- Border (color, width, style)
- Effects (shadows, filters)
- Baseline Grid (snap toggle, offset)

**For Text**:
- All general properties
- Typography (presets, font family, size, weight, line height, etc.)
- Text Formatting (alignment, transform, decoration)
- Color (theme or custom)
- Baseline Grid

**For Media**:
- All general properties
- Media Source (upload, library, URL)
- Display Style (fit, position, aspect ratio)
- Loading Behavior (lazy, eager, placeholder)
- Video Settings (if video)
- SEO & Accessibility (alt text, title, caption)

**For Blocks**:
- Block instance properties (if block exposes editable properties)
- Option to "Detach from Block" (converts to regular elements)

### Property Controls

Controls match the property type:
- **Text inputs**: For names, IDs, custom values
- **Number inputs**: For sizes, spacing, opacity (with unit selector)
- **Sliders**: For opacity, rotation, scale
- **Dropdowns**: For enums (position behavior, alignment, etc.)
- **Color pickers**: For colors (with theme color shortcuts)
- **Toggles**: For boolean values (snap to baseline, enabled/disabled)
- **Image uploads**: For backgrounds, media sources
- **Segmented controls**: For icon-based choices (alignment, direction)

### Responsive Properties (Future)

Properties can be set differently per breakpoint:
- Dropdown at top: "Apply to: This breakpoint / All breakpoints"
- Properties show breakpoint-specific overrides

---

## Tokens Window

Manage global design tokens (CSS variables) available to all pages.

### UI Elements

**Header**:
- Title: "Tokens"
- Button: Import tokens
- Button: Export tokens

**Tabs**:
- Colors
- Typography
- Spacing
- Effects

### Colors Tab

**Theme Colors**:
- Primary (color picker)
- Secondary (color picker)
- Accent (color picker)
- Text (color picker)
- Muted (color picker)

**Custom Colors** (list):
- Color item:
  - Color swatch
  - Input: Color name
  - Color picker: Value
  - Button: Delete
- Button: Add custom color

### Typography Tab

**Font Families**:
- Dropdown: Primary font (Google Fonts + custom uploads)
- Dropdown: Secondary font
- Dropdown: Monospace font

**Typography Presets**:
- Heading 1 through Heading 6 (each with):
  - Font family
  - Font size
  - Font weight
  - Line height
  - Letter spacing
- Body text settings
- Caption settings
- Small text settings

**Baseline Grid**:
- Input: Baseline unit (4-32px, default: 8px)
- Checkbox: Enable baseline grid by default
- Preview: Grid visualization

### Spacing Tab

- Input: Base spacing unit (default: 8px)
- Spacing scale presets (4, 8, 16, 24, 32, 40, 48, 64, 80, 96)
- Button: Add custom spacing value

### Effects Tab

**Shadow Presets**:
- Small, Medium, Large, XL shadow definitions
- Each with: offset X, offset Y, blur, spread, color

**Border Radius Presets**:
- None, Small, Medium, Large, Full (rounded)

**Blur Presets**:
- Small, Medium, Large blur amounts

### Using Tokens

In Properties window, users can reference tokens:
- Color picker shows "Theme Colors" section at top
- Font family dropdown shows "Primary Font" option
- Spacing inputs have "Use token" button

---

## Code Window (Future/Advanced)

**Status**: Future feature, not in MVP

Displays generated HTML/CSS code for selected element or entire frame.

### UI Elements (Planned)

**Header**:
- Title: "Code"
- Dropdown: View mode (HTML / CSS / Both / Svelte)
- Button: Open in separate window
- Checkbox: Live sync (bidirectional editing)

**Code Editor**:
- Syntax-highlighted code
- Line numbers
- Editable (if live sync enabled)

**Features**:
- View generated code from design
- Copy code to clipboard
- Export code
- (Advanced) Edit code and sync back to visual design

**Note**: This is a power-user feature. Most users will never need this.

---

## Floating Toolbar (Context Menu)

Appears when element(s) selected on canvas. Shows quick-access buttons for common actions based on selected component type.

### Appearance

```
┌─────────────────────────────────────────┐
│ [×] │ [Copy] [Paste] [Delete] │ [More] │
└─────────────────────────────────────────┘
```

Floats near selected element(s), follows selection.

### Common Actions (All component types)

- Button: Close (×) - Hide floating toolbar
- Button: Copy - Copy selection (Cmd+C)
- Button: Paste - Paste from clipboard (Cmd+V)
- Button: Duplicate - Duplicate selection (Cmd+D)
- Button: Delete - Delete selection (Delete/Backspace)
- Button: Lock - Lock selection
- Button: Hide - Hide selection
- Button: Convert to Block
- Dropdown: More (additional actions)

### Text-Specific Actions

When Text component selected, shows additional formatting buttons:

- Dropdown: Font size (14px, 16px, 18px, 24px, etc.)
- Button group: Bold, Italic, Underline
- Color picker: Text color
- Dropdown: Line height
- Button group: Align left, center, right, justify

### Div-Specific Actions

When Div component selected:

- Button group: Align children (start, center, end, space-between)
- Button group: Direction (horizontal, vertical)
- Button: Set as Frame (converts Div to Frame - creates a breakpoint)

### Media-Specific Actions

When Media component selected:

- Button: Replace image/video
- Dropdown: Image fit (cover, contain, fill, etc.)
- Button: Edit alt text

### Customization (Future)

**Customization Mode**:
- Right-click floating toolbar → "Customize"
- Allows users to:
  - Add favorite actions
  - Remove unwanted buttons
  - Reorder buttons
  - Reset to defaults

**Status**: Future feature, not in MVP. For now, use fixed button set.

---

## Publish Modal

Appears when user clicks "Publish" button in toolbar.

### UI Elements

**Modal Title**: "Publish Page"

**Settings**:

**Publish Options**:
- Checkbox: Publish this page
- Input: Page slug (URL path, e.g., "about-us")
  - Auto-generated from page name
  - Validation: lowercase, hyphens only, no special chars
  - Shows preview: `yourdomain.com/{slug}`

**SEO Settings**:
- Input: SEO title (default: page name)
  - Character count: 0/60
- Textarea: SEO description
  - Character count: 0/160
- Image upload: Social preview image (Open Graph)
  - Recommended size: 1200×630px

**Advanced Settings** (collapsible):
- Checkbox: Set as homepage
- Dropdown: Assign as template type
  - None (regular page)
  - Blog Homepage Template
  - Single Post Template
  - Category Archive Template
  - Author Archive Template
- Input: Custom meta tags (future)

**Actions**:
- Button: Publish (primary)
- Button: Save as Draft
- Button: Cancel

**Behavior**:
- On publish: Saves design events to database, generates HTML/CSS, publishes to `/{slug}`
- Shows success message: "Page published successfully!"
- Provides link: "View live page" (opens `/{slug}` in new tab)

---

## Keyboard Shortcuts

### General

- `Cmd+S` - Save
- `Cmd+Z` - Undo
- `Cmd+Shift+Z` - Redo
- `Cmd+C` - Copy
- `Cmd+V` - Paste
- `Cmd+D` - Duplicate
- `Delete` / `Backspace` - Delete selection
- `Cmd+A` - Select all
- `Esc` - Deselect all

### Tools

- `V` - Move tool
- `H` - Hand tool
- `D` - Div tool
- `T` - Text tool
- `M` - Media tool
- `Space` (hold) - Temporarily switch to Hand tool

### Canvas

- `Cmd+'` - Toggle baseline grid
- `Cmd+Shift+'` - Toggle snap to baseline
- `Cmd++` - Zoom in
- `Cmd+-` - Zoom out
- `Cmd+0` - Zoom to 100%
- `Cmd+1` - Fit all frames
- `Cmd+2` - Fit selected frame

### Text Editing

- `Cmd/Ctrl+B` - Toggle bold
- `Cmd/Ctrl+I` - Toggle italic
- `Cmd/Ctrl+U` - Toggle underline
- `Cmd/Ctrl+Shift+X` - Toggle strikethrough
- `Cmd/Ctrl+Shift+7` - Toggle ordered list
- `Cmd/Ctrl+Shift+8` - Toggle unordered list
- Align left: `Opt+Cmd+L` (Mac) / `Alt+Ctrl+L` (Windows)
- Align center: `Opt+Cmd+T` (Mac) / `Alt+Ctrl+T` (Windows)
- Align right: `Opt+Cmd+R` (Mac) / `Alt+Ctrl+R` (Windows)
- Align justified: `Opt+Cmd+Shift+J` (Mac) / `Alt+Ctrl+Shift+J` (Windows)
- Increase font size: `Shift+Cmd+.` or `Shift+Cmd+>` (Mac) / `Shift+Ctrl+.` or `Shift+Ctrl+>` (Windows)
- Decrease font size: `Shift+Cmd+,` or `Shift+Cmd+<` (Mac) / `Shift+Ctrl+,` or `Shift+Ctrl+<` (Windows)

### Layout & Structure

- Wrap selection in div: `Opt+Cmd+G` (Mac) / `Alt+Ctrl+G` (Windows)

### Layers

- `Cmd+G` - Group selection (wrap in Div)
- `Cmd+Shift+G` - Ungroup
- `Cmd+[` - Send backward
- `Cmd+]` - Bring forward
- `Cmd+Shift+[` - Send to back
- `Cmd+Shift+]` - Bring to front

### Windows

- `Cmd+Shift+B` - Toggle Blocks window
- `Cmd+Shift+L` - Toggle Layers window
- `Cmd+Shift+P` - Toggle Properties window
- `Cmd+Shift+T` - Toggle Tokens window

### Navigation

- `Tab` - Select next element
- `Shift+Tab` - Select previous element
- Arrow keys - Nudge selected element (1px)
- `Shift+Arrow` - Nudge selected element (10px)

---

## Design Workflows

### Creating a New Page

1. Click "New Page" in `/admin/pages` OR `Cmd+N` in designer
2. New frame appears on canvas (default: 1920px desktop)
3. Name the frame (double-click header)
4. Start designing: drag components from toolbar, add blocks, edit properties
5. Auto-save active (saves every 30 seconds)
6. Click "Preview" to see live preview
7. Click "Publish" to publish page

### Adding Responsive Breakpoints

1. Right-click frame header → "Add Breakpoint"
2. Select breakpoint size (Desktop/Tablet/Mobile or custom)
3. New frame created with same content
4. Adjust layout for new breakpoint size
5. Publish specific breakpoints or all

### Creating Reusable Blocks

1. Design elements on canvas
2. Select elements to convert
3. Right-click → "Convert to Block"
4. Name the block
5. Block appears in Blocks window under current page folder
6. Drag block into other pages to reuse

### Editing a Block

1. Find block in Blocks window
2. Right-click → "Edit Block"
3. Designer opens source page with block highlighted
4. Edit the block design
5. Changes auto-propagate to all instances

### Using Baseline Grid

1. Open Tokens window → Typography tab
2. Set baseline unit (default: 8px)
3. Enable "Enable baseline grid by default"
4. Toggle grid visibility: `Cmd+'`
5. Toggle snap to baseline: `Cmd+Shift+'`
6. Design elements snap to grid when snap enabled
7. Set per-component snap in Properties → Baseline Grid section

### Publishing a Page

1. Click "Publish" in toolbar
2. Set page slug (URL)
3. Select breakpoints to publish
4. Set SEO metadata (title, description, image)
5. Optional: Set as homepage or assign template type
6. Click "Publish"
7. Page goes live at `/{slug}`

---

## Technical Notes

### Event Sourcing

All design actions are stored as events in the event store. This enables:
- **Perfect undo/redo**: Time-travel through design history
- **Auto-save**: Events saved to IndexedDB every 30 seconds
- **Version control**: Each save creates a snapshot
- **Collaboration** (future): Multi-user editing with event synchronization

### Code Generation

When page is published:
1. Design events replayed to build component tree
2. AST generated from component tree
3. HTML/CSS generated from AST
4. Code saved to database
5. Page rendered server-side on request

### Responsive Design

Breakpoints generate media queries:
```css
/* Desktop (default) */
.element { width: 1200px; }

/* Tablet */
@media (max-width: 1024px) {
  .element { width: 768px; }
}

/* Mobile */
@media (max-width: 768px) {
  .element { width: 100%; }
}
```

### Baseline Grid Implementation

- Grid rendered as CSS overlay (position: fixed)
- Snap calculation: `Math.round(value / baselineUnit) * baselineUnit`
- Applied to: spacing, sizing, typography line-height
- Per-component override via `snapToBaseline` property

---

## Future Features (Not in MVP)

- **Code Window**: Live editable code view
- **Collaboration**: Multi-user editing with cursors
- **Comments**: Design feedback system
- **Version History**: Browse and restore previous versions
- **Component Variants**: Multiple states of same component
- **Auto-Layout**: Figma-style auto-layout constraints
- **Prototyping**: Interactive prototype mode with transitions
- **Plugins**: Extend page builder with custom tools
- **AI Assistant**: AI-powered design suggestions

---

## Summary

The LineBasis page builder is a **professional design tool** combining:
- **Simplicity**: Only 3 atomic components (Div, Text, Media)
- **Power**: Blocks, frames, responsive breakpoints, design tokens
- **Flexibility**: Floating windows, customizable toolbar, keyboard shortcuts
- **Precision**: Baseline grid, snap-to-grid, pixel-perfect alignment
- **Modern UX**: Event sourcing, auto-save, undo/redo, live preview

The interface prioritizes **designer workflows** while generating **production-ready code** automatically.

---

## Custom Blocks (Phase 2)

**Status**: Planned for Phase 2 release

Custom blocks are developer-coded Svelte components that appear in the designer alongside user-created blocks.

### Blocks Window with Custom Blocks

When custom blocks are available, they appear in organized sections:

```
┌─────────────────────────────────────┐
│ Blocks                      [≡][×] │
├─────────────────────────────────────┤
│ [Search blocks...]                  │
├─────────────────────────────────────┤
│                                     │
│ ▼ Custom Blocks                     │
│   ┌─────┐                          │
│   │[img]│  Carousel                │
│   └─────┘                          │
│   ┌─────┐                          │
│   │[img]│  Fade In Section         │
│   └─────┘                          │
│   ┌─────┐                          │
│   │[img]│  Custom Hero             │
│   └─────┘                          │
│                                     │
│ ▼ User Blocks                       │
│   └─ Homepage                       │
│       ┌─────┐                      │
│       │[img]│  CTA Section          │
│       └─────┘                      │
│       ┌─────┐                      │
│       │[img]│  Feature Card         │
│       └─────┘                      │
│                                     │
└─────────────────────────────────────┘
```

**Phase 1**: Only "User Blocks" section (blocks created from selections)

**Phase 2**: Add "Custom Blocks" section (coded Svelte blocks from `/blocks/` folder)

**Phase 3**: Add plugin-provided blocks (e.g., "Blog Plugin", "Forms Plugin" sections)

### Custom Block Appearance

**Block Item** (in Blocks window):
- Thumbnail image (defined in block metadata)
- Block name
- Optional: Category badge ("Interactive", "Content", etc.)
- Hover shows description tooltip

### Using Custom Blocks

**Drag to Canvas**:
1. Find custom block in Blocks window
2. Drag thumbnail to canvas
3. Block instance appears at drop position
4. Properties window shows block-specific properties

**Properties Window for Custom Blocks**:

When custom block selected, Properties window shows:

**Auto-Generated UI** (from property schema):
```
┌─────────────────────────────────────┐
│ Properties                          │
│ Carousel                            │
├─────────────────────────────────────┤
│                                     │
│ ▼ General                          │
│   Name: Carousel                    │
│   ID: carousel-1                    │
│                                     │
│ ▼ Carousel Settings                │
│   Images:                           │
│   ┌─────┐ ┌─────┐ ┌─────┐         │
│   │[img]│ │[img]│ │[img]│ [+ Add] │
│   └─────┘ └─────┘ └─────┘         │
│                                     │
│   Auto Play:  [✓]                  │
│                                     │
│   Interval: 5000ms                  │
│   ┣━━━━━━━━━━━━━┫                 │
│   1000        10000                 │
│                                     │
│   Transition:                       │
│   [Slide      ▼]                   │
│                                     │
└─────────────────────────────────────┘
```

**OR Custom Property Editor** (if block provides one):
```
┌─────────────────────────────────────┐
│ Properties                          │
│ Carousel                            │
├─────────────────────────────────────┤
│                                     │
│ [Custom UI designed by developer]   │
│                                     │
│ Visual image grid with drag & drop  │
│ Live preview of interval timing     │
│ Transition effect previews          │
│ etc.                                │
│                                     │
└─────────────────────────────────────┘
```

### Custom Block Context Menu

Right-click on custom block instance:

- Rename
- Duplicate
- Delete
- **Convert to User Block** (future) - Breaks link, becomes editable design
- Copy/Paste
- Lock/Unlock
- Show/Hide

**Note**: Cannot "Edit Block" like user blocks (custom blocks are coded, not designed)

### Custom Block in Editor Mode

Custom blocks render in editor mode with simplified preview:

```svelte
<!-- Carousel in editor mode -->
<div class="carousel-editor-preview">
  <img src={images[0]} alt="Preview" />
  <div class="overlay">
    <span>Carousel ({images.length} images)</span>
  </div>
</div>
```

**Editor Mode Features**:
- Selection outline when clicked
- Resize handles (if block supports resizing)
- Drag to move
- Properties editable in Properties window

### Custom Block in Live Mode

When user clicks "Preview" or publishes page, blocks render in live mode:

```svelte
<!-- Carousel in live mode -->
<div class="carousel">
  <!-- Full interactive carousel -->
  <div class="slides">...</div>
  <button class="prev">‹</button>
  <button class="next">›</button>
  <div class="dots">...</div>
</div>
```

**Live Mode Features**:
- Full interactivity (animations, transitions, events)
- JavaScript functionality active
- Production-ready code

---

## Phase 1 vs Phase 2 vs Phase 3 UI

### Phase 1 (MVP): Core Page Builder

**Toolbar**:
- Tools: Move, Hand, Scale
- **Components**: Div, Text, Media ← Only 3 atomic components
- Actions: Save, Preview, Publish

**Blocks Window**:
```
┌─────────────────────────────┐
│ Blocks                      │
├─────────────────────────────┤
│ [Search blocks...]          │
├─────────────────────────────┤
│                             │
│ ▼ User Blocks               │
│   (Created from selections) │
│                             │
│   [Empty initially]         │
│                             │
└─────────────────────────────┘
```

**Properties Window**:
- Shows properties for: Div, Text, Media, User Blocks

**Focus**: Ship core designer, validate architecture

### Phase 2: Custom Blocks

**Toolbar**: Same as Phase 1

**Blocks Window**:
```
┌─────────────────────────────┐
│ Blocks                      │
├────────────────────────���────┤
│ ▼ Custom Blocks             │ ← NEW
│   📦 Carousel               │
│   📦 Fade In Section        │
│                             │
│ ▼ User Blocks               │
│   ...                       │
└─────────────────────────────┘
```

**Properties Window**:
- Add: Auto-generated UI from property schemas
- Add: Support for custom property editors

**Focus**: Enable developers to create coded blocks

### Phase 3: Plugin Ecosystem

**Toolbar**: Same

**Blocks Window**:
```
┌─────────────────────────────┐
│ Blocks                      │
├─────────────────────────────┤
│ ▼ Blog Plugin               │ ← NEW (plugin blocks)
│   📝 Post Content           │
│   📊 Post Meta              │
│                             │
│ ▼ Forms Plugin              │ ← NEW (plugin blocks)
│   📋 Form Builder           │
│                             │
│ ▼ Custom Blocks             │
│   ...                       │
│                             │
│ ▼ User Blocks               │
│   ...                       │
└─────────────────────────────┘
```

**Admin Sidebar**:
```
Sidebar Navigation:
- Dashboard
- Pages
- Blocks
- Styles
- Blog        ← NEW (from plugin)
- Media
- Themes
- Plugins     ← NEW
- Team
- Settings
```

**Focus**: Plugin marketplace, blog/forms plugins, ecosystem growth

---

## Custom Block Development Experience

**Developer Workflow** (Phase 2):

1. **Create Block Component**:
   ```bash
   touch src/lib/components/blocks/Carousel.svelte
   ```

2. **Define Metadata & Properties**:
   ```svelte
   <script context="module">
     export const blockMeta = {
       id: 'carousel',
       name: 'Carousel',
       category: 'interactive'
     };
     
     export const blockProperties = {
       images: { type: 'array', itemType: 'media', ... },
       autoplay: { type: 'boolean', ... }
     };
   </script>
   ```

3. **Implement Component**:
   ```svelte
   <script>
     export let mode = 'live';
     export let images = [];
     export let autoplay = true;
     // ... component logic
   </script>
   ```

4. **Refresh Designer**:
   - Block automatically appears in Blocks window
   - Drag to canvas to test
   - Edit properties
   - Preview

5. **Publish & Use**:
   - Block inlined into generated code
   - Works in published pages

**No build step needed** - Hot module reload shows changes immediately

---

## Future: Plugin Marketplace (Phase 4+)

**Plugin Browser** (in admin):
```
/admin/plugins/browse

┌─────────────────────────────────────┐
│ Plugin Marketplace                  │
├─────────────────────────────────────┤
│                                     │
│ [Search plugins...]                 │
│                                     │
│ Featured Plugins:                   │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ E-commerce Plugin            │   │
│ │ by @linebasis               │   │
│ │                             │   │
│ │ Blocks: ProductGrid,        │   │
│ │   CartButton, Checkout      │   │
│ │                             │   │
│ │ [Install]                   │   │
│ └─────────────────────────────┘   │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ Advanced Forms               │   │
│ │ by @developer               │   │
│ │                             │   │
│ │ Blocks: MultiStepForm,      │   │
│ │   ConditionalFields         │   │
│ │                             │   │
│ │ [Install]                   │   │
│ └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Installing a Plugin**:
1. Browse marketplace
2. Click "Install"
3. Plugin downloads
4. Database schema composed
5. Migrations run
6. Blocks appear in Blocks window
7. Admin pages added to sidebar

---

This completes the custom block system UI specification for the page builder.

