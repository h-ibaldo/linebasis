# Linabasis Architecture

This document defines the technical architecture for Linabasis - a modern CMS with a professional page builder. The architecture is designed to support local-first design workflows, event sourcing for perfect undo/redo, and dynamic code generation for published pages.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [System Architecture](#system-architecture)
4. [Data Flow](#data-flow)
5. [Event Sourcing System](#event-sourcing-system)
6. [Database Schema](#database-schema)
7. [Component Architecture](#component-architecture)
8. [Code Generation Pipeline](#code-generation-pipeline)
9. [Responsive Design Strategy](#responsive-design-strategy)
10. [Block System](#block-system)
11. [Theme System](#theme-system)
12. [Authentication & Authorization](#authentication--authorization)
13. [Plugin Architecture](#plugin-architecture)
14. [File Structure](#file-structure)
15. [Technology Stack](#technology-stack)
16. [Performance Optimizations](#performance-optimizations)
17. [Security Considerations](#security-considerations)
18. [Deployment Architecture](#deployment-architecture)

---

## System Overview

Linabasis is a **local-first, event-sourced CMS** with a professional page builder that generates production-ready Svelte components.

### Key Characteristics

- **Local-First Design**: Designer works entirely client-side with IndexedDB storage
- **Event Sourcing**: All design actions stored as immutable events for perfect undo/redo
- **Dynamic Code Generation**: Events replay to generate Svelte components on publish
- **SSR Publishing**: Published pages rendered server-side for optimal performance and SEO
- **Component-Based**: Only 3 atomic components (Div, Text, Media) + user-created blocks
- **Plugin-Extensible**: Core system extended via plugin architecture

### Architecture Goals

1. **Designer Performance**: Instant interactions, zero server latency during design
2. **Perfect Undo/Redo**: Complete design history via event sourcing
3. **Code Quality**: Generated code is clean, semantic, performant
4. **Flexibility**: Support both dynamic sites (Linabasis-hosted) and static exports
5. **Scalability**: Handle thousands of pages and media files
6. **Security**: Role-based access, secure authentication, input validation

---

## Architecture Principles

### 1. Local-First

The page builder operates entirely in the browser without server communication until the user publishes. This provides:
- **Zero latency** during design
- **Offline capability** (design without internet)
- **No server load** during design sessions
- **Auto-save** to IndexedDB every 30 seconds

### 2. Event Sourcing

All design actions are stored as append-only events:
- **Immutable history**: Events never deleted, only appended
- **Time travel**: Replay events to any point in time
- **Perfect undo/redo**: Navigate event history forward/backward
- **Audit trail**: Complete record of who changed what and when

### 3. Separation of Concerns

**Designer (Client)**:
- User interface and interactions
- Event creation and storage
- Local state management
- Real-time preview

**Server (API)**:
- Authentication and authorization
- Database operations
- Code generation
- SSR rendering
- Media storage

### 4. Component Simplicity

Only 3 atomic components (Div, Text, Media) provide maximum flexibility:
- **Div**: Layout container with Framer-style controls
- **Text**: Rich text with typography presets
- **Media**: Images and videos with responsive support

Complexity emerges from composition, not component variety.

### 5. Progressive Enhancement

- **Core functionality** works without JavaScript (published pages)
- **Enhanced experience** with JavaScript (interactive elements)
- **Graceful degradation** for older browsers

---

## System Architecture

Linabasis uses a **client-server architecture** with clear separation between design-time (client) and runtime (server).

### High-Level Architecture

```

High-Level System Architecture

```
+-------------------------------+   (Design Session on Client)    +-------------------------------------+
|        Browser Client         |-------------------------------->|         SvelteKit Server            |
+-------------------------------+                                 +-------------------------------------+
|  - Page Builder UI (Svelte)   |                                 |  - API Routes (src/routes/api)      |
|    - Toolbar, Canvas, Windows |                                 |    - POST /api/pages/publish        |
|    - Event creation           |                                 |    - GET/POST /api/blocks           |
|    - Real-time preview        |                                 |    - GET/POST /api/media            |
|                               |                                 |    - POST /api/auth/login           |
|  - IndexedDB (Local Storage)  |         (On Publish)            |                                     |
|    - Events (append-only)     |-------------------------------> |  - Services Layer                   |
|    - Current design state     |                                 |    - Page, Block, Codegen, Media,   |
|    - Auto-save every 30s      |                                 |      Auth services                  |
|    - Project metadata         |                                 |  - Database (Prisma ORM)            |
+-------------------------------+                                 |    - SQLite (development)           |
       |    |                                                     |    - Pages, Frames, Blocks, Media   |
       |    |                                                     |    - PostgreSQL (production)        |
       v    v                                                     |      Users, etc.                    |
  (User clicks "Publish")                                         +-------------------------------------+
         |                                                                     |
         v                                                           (SSR Render on Request)
+-----------------------------+                             +-----------------------------------------+
| SSR Published Pages         |<----------------------------|  - Dynamic routes: /[slug]              |
|  - /[slug], /blog/[slug]    |    (Render from DB)         |  - Rendered as Svelte code from DB      |
+-----------------------------+                             +-----------------------------------------+
```
```

### Component Communication

**During Design (Client-Side)**:
1. User action (e.g., add component) � Event created
2. Event appended to IndexedDB
3. Event applied to in-memory state
4. UI re-renders from new state
5. Auto-save timer persists to IndexedDB

**On Publish (Client � Server)**:
1. User clicks "Publish"
2. Client sends design events to server
3. Server validates and stores events
4. Server generates Svelte code from events
5. Server stores generated code in database
6. Page becomes live at `/{slug}`

**On Page View (Server-Side)**:
1. User visits `/{slug}`
2. SvelteKit route handler loads page from database
3. Renders Svelte component server-side
4. Returns HTML to browser
5. Hydrates client-side for interactivity

---

## Data Flow

### Design Workflow

```
User Action
    |
Event Created (e.g., {type: 'ADD_COMPONENT', ...})
    |
Event Appended to IndexedDB
    |
Event Applied to Design State
    |
UI Re-renders
    |
[After 30s] Auto-save to IndexedDB
```

### Publish Workflow

```
User Clicks "Publish"
    |
Publish Modal Opens (slug, SEO)
    |
Client Sends: POST /api/pages/publish
    {
      pageId: 'uuid',
      slug: 'about-us',
      designEvents: [...],
      frames: [{breakpoint: 1920, events: [...]}],
      seo: {...}
    }
    |
Server Validates Input
    |
Server Stores Events in Database
    |
Server Generates Svelte Code
    Events | Component Tree | AST | Svelte Code
    |
Server Stores Generated Code
    Page.publishedCode = '<script>...</script><div>...</div>'
    |
Server Returns Success
    |
Client Shows Success Message + Live URL
    |
Page Available at /{slug}
```

### Page Rendering Workflow

```
User Visits /{slug}
    |
SvelteKit Route: src/routes/[slug]/+page.server.ts
    |
Load Function:
    - Query database for page by slug
    - Check if published
    - Load publishedCode
    |
Render Svelte Component (SSR)
    - Execute component code
    - Generate HTML
    - Extract CSS
    |
Return HTML + CSS + SEO metadata
    |
Browser Receives Page
    |
[Optional] Hydrate for Interactivity
```

---

## Event Sourcing System

Event sourcing is at the core of Linabasis's architecture. All design actions are represented as events.

### Event Structure

```typescript
interface DesignEvent {
  id: string;              // Unique event ID
  type: string;            // Event type (e.g., 'ADD_COMPONENT')
  timestamp: number;       // Unix timestamp
  userId?: string;         // User who created event (future: collaboration)
  payload: Record<string, any>; // Event-specific data
}
```

### Event Types

**Component Management**:
- `ADD_COMPONENT` - Add new component to canvas
- `DELETE_COMPONENT` - Remove component
- `MOVE_COMPONENT` - Change position
- `RESIZE_COMPONENT` - Change size

**Property Updates**:
- `UPDATE_PROPERTY` - Change component property (e.g., background color)
- `UPDATE_LAYOUT` - Change layout settings (alignment, gap, etc.)
- `UPDATE_TYPOGRAPHY` - Change text properties

**Hierarchy**:
- `REORDER_CHILDREN` - Change DOM order
- `NEST_COMPONENT` - Move component inside another
- `UNNEST_COMPONENT` - Move component out of parent

**Frame Management**:
- `CREATE_FRAME` - Add new artboard
- `DELETE_FRAME` - Remove artboard
- `RENAME_FRAME` - Change frame name
- `SET_BREAKPOINT` - Set frame breakpoint width

**Block Operations**:
- `CREATE_BLOCK` - Convert selection to reusable block
- `INSERT_BLOCK` - Add block instance to canvas
- `DETACH_BLOCK` - Convert block instance to regular elements
- `UPDATE_BLOCK_MASTER` - Push changes to master block

### Event Storage

**Client-Side (IndexedDB)**:
```javascript
// Database: linebasis
// Store: events
{
  projectId: 'uuid',
  events: [
    {id: '1', type: 'ADD_COMPONENT', timestamp: 1234567890, payload: {...}},
    {id: '2', type: 'MOVE_COMPONENT', timestamp: 1234567891, payload: {...}},
    // ... append-only
  ],
  currentIndex: 2  // For undo/redo navigation
}
```

**Server-Side (Database)**:
```typescript
Page {
  designEvents: string  // JSON.stringify(events)
}

Frame {
  designEvents: string  // JSON.stringify(events for this frame)
}
```

### Event Replay

To reconstruct design state from events:

```typescript
function replayEvents(events: DesignEvent[]): DesignState {
  let state = createEmptyState();

  for (const event of events) {
    state = applyEvent(state, event);
  }

  return state;
}
```

### Undo/Redo

```typescript
// Undo: Move index backward
currentIndex--;
state = replayEvents(events.slice(0, currentIndex));

// Redo: Move index forward
currentIndex++;
state = replayEvents(events.slice(0, currentIndex));
```

### Event Compaction (Future Optimization)

When event list grows large (>10,000 events), compact into snapshots:

```typescript
{
  snapshot: {state: {...}, timestamp: 1234560000}, // State at event 10000
  events: [...events from 10001 onwards]  // Only recent events
}
```

This reduces replay time while preserving recent history.

---

## Database Schema

Linabasis uses Prisma ORM with SQLite (development) and PostgreSQL (production). The schema is designed to support the event-sourced architecture while maintaining queryability.

### Core Models

#### Page

Represents a design file that can contain multiple frames (breakpoints).

```prisma
model Page {
  id          String   @id @default(uuid())
  slug        String   @unique
  title       String
  description String?
  
  // Template assignment (for blog)
  templateType String  @default("none") 
  // Options: 'none', 'blog-homepage', 'single-post', 'category-archive', 'author-archive'
  
  // Design data
  designEvents String  // JSON: Design events array (historical record)
  
  // Published output
  publishedCode String? // Generated Svelte component code
  status        String  @default("draft") // 'draft', 'published', 'archived'
  
  // SEO metadata
  metaTitle       String?
  metaDescription String?
  metaImage       String?
  
  // Ownership
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  
  // Timestamps
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  publishedAt DateTime?
  
  // Relations
  frames    Frame[]
  revisions PageRevision[]
  
  @@index([slug])
  @@index([status])
  @@index([authorId])
  @@index([teamId])
  @@index([templateType])
}
```

#### Frame

Represents an artboard on the canvas. Each frame is one breakpoint of a page.

```prisma
model Frame {
  id              String  @id @default(uuid())
  pageId          String
  page            Page    @relation(fields: [pageId], references: [id], onDelete: Cascade)
  
  name            String  // e.g., "Homepage - Desktop"
  breakpointWidth Int     // Pixel width (1920, 768, 375, etc.)
  order           Int     // Display order on canvas
  
  // Design data specific to this breakpoint
  designEvents    String  // JSON: Events for this frame
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  blockInstances  BlockInstance[]
  
  @@index([pageId])
  @@index([breakpointWidth])
}
```

#### Block

Master block definition. Blocks are reusable design elements.

```prisma
model Block {
  id           String   @id @default(uuid())
  name         String
  description  String?
  
  // Source tracking
  sourcePageId String   // Page where block was created
  sourcePage   Page     @relation(fields: [sourcePageId], references: [id])
  
  // Design data
  designEvents String   // JSON: Master block design events
  thumbnail    String?  // Preview image URL
  
  // Metadata
  createdBy    String
  creator      User     @relation(fields: [createdBy], references: [id])
  teamId       String
  team         Team     @relation(fields: [teamId], references: [id])
  
  // Timestamps
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  // Relations
  instances    BlockInstance[]
  
  @@index([sourcePageId])
  @@index([createdBy])
  @@index([teamId])
}
```

#### BlockInstance

Instance of a block on a specific frame. Tracks detachment and overrides.

```prisma
model BlockInstance {
  id        String  @id @default(uuid())
  
  // References
  blockId   String
  block     Block   @relation(fields: [blockId], references: [id], onDelete: Cascade)
  
  frameId   String
  frame     Frame   @relation(fields: [frameId], references: [id], onDelete: Cascade)
  
  elementId String  // ID of element in frame's design tree
  
  // Detachment tracking
  isDetached     Boolean @default(false)
  overrideEvents String? // JSON: Events applied after block insertion (if detached)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([blockId])
  @@index([frameId])
  @@index([isDetached])
}
```

#### Media

Uploaded media files (images, videos, documents).

```prisma
model Media {
  id          String   @id @default(uuid())
  filename    String
  path        String   // Server file path
  url         String   // Public URL
  mimeType    String
  size        Int      // Bytes
  
  // Image/Video dimensions
  width       Int?
  height      Int?
  
  // Metadata
  altText     String?
  title       String?
  caption     String?
  
  // Ownership
  uploadedBy  String
  uploader    User     @relation(fields: [uploadedBy], references: [id])
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  
  createdAt   DateTime @default(now())
  
  @@index([uploadedBy])
  @@index([teamId])
  @@index([mimeType])
}
```

#### PageRevision

Version history for pages. Stores snapshots of design events.

```prisma
model PageRevision {
  id           String   @id @default(uuid())
  pageId       String
  page         Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  
  version      Int      // Incremental version number
  title        String?  // Optional revision description
  
  // Snapshot
  designEvents String   // JSON: Complete event history at this revision
  metadata     String?  // JSON: Page metadata snapshot (title, slug, SEO)
  
  // Tracking
  createdBy    String
  creator      User     @relation(fields: [createdBy], references: [id])
  createdAt    DateTime @default(now())
  
  @@index([pageId])
  @@index([version])
  @@index([createdBy])
}
```

### Team & User Models

#### Team

Represents a Linabasis site installation. One site = one team.

```prisma
model Team {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique // Subdomain or identifier
  
  // Ownership
  ownerId   String   // User who owns this team/site
  owner     User     @relation("TeamOwner", fields: [ownerId], references: [id])
  
  // Settings
  settings  String?  // JSON: Site settings (logo, theme colors, etc.)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  members   User[]   @relation("TeamMembers")
  pages     Page[]
  blocks    Block[]
  media     Media[]
  themes    Theme[]
  
  @@index([slug])
  @@index([ownerId])
}
```

#### User

User accounts with role-based permissions.

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  
  // Team membership
  teamId       String
  team         Team     @relation("TeamMembers", fields: [teamId], references: [id])
  
  // Role within team
  role         String   @default("designer")
  // Options: 'owner', 'manager', 'designer', 'editor'
  
  // Status
  status       String   @default("active") // 'active', 'suspended', 'pending'
  
  // Timestamps
  createdAt    DateTime  @default(now())
  lastLoginAt  DateTime?
  
  // Relations
  ownedTeams    Team[]          @relation("TeamOwner")
  pages         Page[]
  blocks        Block[]
  media         Media[]
  pageRevisions PageRevision[]
  sessions      Session[]
  posts         Post[]          // Blog plugin
  
  @@index([email])
  @@index([teamId])
  @@index([role])
  @@index([status])
}
```

#### Session

JWT refresh token storage for authentication.

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token     String   @unique // Refresh token
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
```

### Configuration Models

#### Setting

Global site configuration (key-value store).

```prisma
model Setting {
  key         String   @id
  value       String   // JSON or string value
  type        String   @default("string") // 'string', 'number', 'boolean', 'json'
  description String?
  teamId      String?  // Optional: team-specific settings
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
}
```

#### Plugin

Installed plugin registry.

```prisma
model Plugin {
  id          String   @id // Plugin ID (e.g., '@linebasis/blog')
  name        String
  version     String
  description String?
  
  isActive    Boolean  @default(false)
  settings    String?  // JSON: Plugin-specific settings
  
  teamId      String?  // Optional: team-specific plugin installation
  
  installedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([isActive])
  @@index([teamId])
}
```

#### Theme

Stored themes (imported or created for export).

```prisma
model Theme {
  id          String   @id @default(uuid())
  name        String
  description String?
  author      String
  version     String   @default("1.0.0")
  
  // Theme content
  content     String   // JSON: {pages, blocks, tokens, media, templates}
  thumbnail   String?  // Preview image URL
  
  // Ownership
  teamId      String?
  team        Team?    @relation(fields: [teamId], references: [id])
  createdBy   String?
  
  // Metadata
  isPublic    Boolean  @default(false) // Share in marketplace (future)
  downloadCount Int    @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
  @@index([isPublic])
}
```

### Blog Plugin Models

These models are added by the blog plugin via Prisma schema composition.

#### Post

Blog post content.

```prisma
model Post {
  id          String   @id @default(uuid())
  slug        String   @unique
  title       String
  excerpt     String?
  content     String   // Rich text content (JSON or HTML)
  
  // Template
  templateId  String?  // References Page.id (page marked as 'single-post' template)
  
  // Media
  featuredImage String?
  
  // Status
  status      String   @default("draft") // 'draft', 'published', 'scheduled', 'archived'
  
  // Authorship
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  
  // SEO
  metaTitle       String?
  metaDescription String?
  metaImage       String?
  
  // Timestamps
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  publishedAt  DateTime?
  scheduledFor DateTime?
  
  // Relations
  categories   PostCategory[]
  tags         PostTag[]
  
  @@index([slug])
  @@index([status])
  @@index([authorId])
  @@index([publishedAt])
}
```

#### Category

Blog post categories.

```prisma
model Category {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  description String?
  
  // Relations
  posts       PostCategory[]
  
  createdAt   DateTime @default(now())
  
  @@index([slug])
}
```

#### Tag

Blog post tags.

```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  
  // Relations
  posts     PostTag[]
  
  createdAt DateTime @default(now())
  
  @@index([slug])
}
```

#### PostCategory (Join Table)

```prisma
model PostCategory {
  postId     String
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([postId, categoryId])
  @@index([postId])
  @@index([categoryId])
}
```

#### PostTag (Join Table)

```prisma
model PostTag {
  postId String
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  
  @@id([postId, tagId])
  @@index([postId])
  @@index([tagId])
}
```

### Schema Relationships Summary

```
Team
  ├─ Users (members)
  ├─ Pages
  │   ├─ Frames
  │   │   └─ BlockInstances
  │   └─ PageRevisions
  ├─ Blocks
  │   └─ BlockInstances
  ├─ Media
  └─ Themes

User
  ├─ Pages (authored)
  ├─ Blocks (created)
  ├─ Media (uploaded)
  ├─ Sessions
  └─ Posts (blog)

Plugin (Blog)
  ├─ Posts
  │   ├─ PostCategory
  │   └─ PostTag
  ├─ Categories
  └─ Tags
```

---

## Component Architecture

Linabasis components have a unique dual-mode design: they function both as **editor components** (design-time) and **live components** (runtime).

### Dual-Mode Components

Every component supports two states:

#### 1. Editor Mode (Design-Time)

Components in the page builder show additional UI for editing:

```svelte
<script>
  export let mode = 'live'; // 'editor' | 'live'
  export let isSelected = false;
  export let properties = {}; // Component properties from component-properties.md
</script>

{#if mode === 'editor'}
  <div class="editor-wrapper">
    <!-- Selection handles -->
    {#if isSelected}
      <div class="selection-handles">
        <div class="handle nw"></div>
        <div class="handle ne"></div>
        <div class="handle sw"></div>
        <div class="handle se"></div>
      </div>
    {/if}
    
    <!-- Component boundary indicator -->
    <div class="component-boundary">
      <!-- Actual component content -->
      <div class="component-content" style={computedStyles}>
        <slot />
      </div>
    </div>
  </div>
{:else}
  <!-- Live mode: Pure output, no editor UI -->
  <div class="component-content" style={computedStyles}>
    <slot />
  </div>
{/if}
```

**Editor Mode Features**:
- Selection handles (resize, rotate)
- Hover outlines
- Component type badge
- Drag-to-move functionality
- Click-to-select
- Context menu (right-click)

#### 2. Live Mode (Runtime)

Components in preview and published pages render clean output:

```svelte
<!-- No editor UI, just the component -->
<div class="hero-section" style="...">
  <h1>Welcome</h1>
</div>
```

**Live Mode Features**:
- Clean HTML output
- Semantic markup
- Optimized CSS
- Responsive behavior
- SEO-friendly structure

### The 3 Atomic Components

#### Div Component

Layout container with Framer-style controls.

```svelte
<!-- src/lib/components/primitives/Div.svelte -->
<script lang="ts">
  import type { DivProperties } from '$lib/types/components';
  
  export let mode: 'editor' | 'live' = 'live';
  export let properties: DivProperties;
  export let isSelected = false;
  
  // Compute styles from properties
  $: styles = generateDivStyles(properties);
</script>

{#if mode === 'editor'}
  <div class="div-editor" class:selected={isSelected} style={styles}>
    <slot />
  </div>
{:else}
  <!-- Determine semantic element based on properties -->
  <svelte:element this={properties.semantic?.element || 'div'} style={styles}>
    <slot />
  </svelte:element>
{/if}

<style>
  .div-editor.selected {
    outline: 2px solid var(--color-primary);
  }
</style>
```

**Properties**: See `docs/planning/component-properties.md` for complete list.

**Key Features**:
- Flexbox/Grid layout controls
- Spacing (padding, margin)
- Background (color, image, gradient)
- Border and effects
- Transform (rotate, scale, move)
- Can be set as **Frame** (special div state)

#### Text Component

Rich text with typography presets.

```svelte
<!-- src/lib/components/primitives/Text.svelte -->
<script lang="ts">
  import type { TextProperties } from '$lib/types/components';
  
  export let mode: 'editor' | 'live' = 'live';
  export let properties: TextProperties;
  export let isSelected = false;
  
  $: styles = generateTextStyles(properties);
  $: element = determineElement(properties.style.preset);
  // preset 'heading-1' → 'h1', 'body' → 'p', etc.
</script>

{#if mode === 'editor'}
  <div class="text-editor" class:selected={isSelected}>
    <svelte:element this={element} style={styles} contenteditable="true">
      {properties.content}
    </svelte:element>
  </div>
{:else}
  <svelte:element this={element} style={styles}>
    {@html properties.content}
  </svelte:element>
{/if}
```

**Properties**: Typography, alignment, formatting, color, inline styles.

**Key Features**:
- Typography presets (heading-1 through heading-6, body, caption, small)
- Rich text formatting (bold, italic, underline, color)
- Baseline grid snapping
- Semantic HTML (h1-h6, p, span based on preset)
- Inline links

#### Media Component

Images and videos with responsive support.

```svelte
<!-- src/lib/components/primitives/Media.svelte -->
<script lang="ts">
  import type { MediaProperties } from '$lib/types/components';
  
  export let mode: 'editor' | 'live' = 'live';
  export let properties: MediaProperties;
  export let isSelected = false;
  
  $: styles = generateMediaStyles(properties);
  $: isVideo = properties.mediaType === 'video';
</script>

{#if mode === 'editor'}
  <div class="media-editor" class:selected={isSelected}>
    {#if isVideo}
      <video src={properties.source.file} style={styles} />
    {:else}
      <img src={properties.source.file} alt={properties.source.altText} style={styles} />
    {/if}
  </div>
{:else}
  {#if isVideo}
    <video 
      src={properties.source.file} 
      style={styles}
      controls={properties.video.showControls}
      autoplay={properties.video.autoplay}
      loop={properties.video.loop}
      muted={properties.video.muted}
      playsinline={properties.video.playsInline}
    />
  {:else}
    <img 
      src={properties.source.file} 
      alt={properties.source.altText || ''}
      loading={properties.loading.behavior === 'lazy' ? 'lazy' : 'eager'}
      style={styles}
    />
  {/if}
{/if}
```

**Properties**: Source, display style, loading behavior, video settings, SEO metadata.

**Key Features**:
- Image/video support
- Responsive images (srcset generation in live mode)
- Lazy loading
- Object-fit positioning
- Alt text and SEO metadata

### Default Blocks

Blocks are pre-built combinations of components. Two default blocks ship with Linabasis:

#### Form Builder Block

Complex form builder with multiple field types.

```svelte
<!-- src/lib/components/blocks/FormBuilder.svelte -->
<script lang="ts">
  export let mode: 'editor' | 'live' = 'live';
  export let properties = {
    fields: [],
    submitButton: {},
    apiEndpoint: ''
  };
</script>

<!-- Renders form with fields based on properties -->
<form on:submit={handleSubmit}>
  {#each properties.fields as field}
    <!-- Render field based on type -->
  {/each}
  <button type="submit">{properties.submitButton.text}</button>
</form>
```

#### PostContent Block

Blog post content area (for templates).

```svelte
<!-- src/lib/components/blocks/PostContent.svelte -->
<script lang="ts">
  export let mode: 'editor' | 'live' = 'live';
  export let postContent = ''; // Rich text content from Post
</script>

{#if mode === 'editor'}
  <div class="post-content-placeholder">
    <p>Blog post content will render here</p>
  </div>
{:else}
  <div class="post-content">
    {@html postContent}
  </div>
{/if}
```

### Component Property System

Components receive properties defined in `component-properties.md`. Properties are structured data that maps to CSS:

```typescript
// Example: Div properties
{
  id: 'div-123',
  name: 'Hero Section',
  type: 'div',
  size: {
    width: '100%',
    height: 'auto'
  },
  layout: {
    type: 'stack',
    direction: 'vertical',
    distribute: 'center',
    align: 'center',
    gap: 24
  },
  background: {
    type: 'gradient',
    gradient: {
      type: 'linear',
      direction: 180,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#0000ff', position: 100 }
      ]
    }
  }
}
```

The component generates CSS from these properties:

```css
.hero-section {
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
  background: linear-gradient(180deg, #ff0000 0%, #0000ff 100%);
}
```

### Responsive Handling

Components handle all breakpoints via CSS media queries, NOT conditional rendering.

Single component instance with responsive CSS:

```svelte
<Div properties={{
  size: { width: '100%' },
  /* ... other properties */
}} />
```

Generated CSS:

```css
/* Mobile (base) */
.hero { padding: 20px; }

/* Tablet */
@media (min-width: 768px) {
  .hero { padding: 40px; }
}

/* Desktop */
@media (min-width: 1024px) {
  .hero { padding: 60px; }
}
```

This approach ensures:
- Single HTML structure
- CSS-only responsiveness
- Better SEO (no JS required)
- Faster rendering

---

## Code Generation Pipeline

The code generation pipeline transforms design events into production-ready Svelte components.

### Pipeline Overview

```
Design Events
    ↓
Event Replay
    ↓
Component Tree
    ↓
AST Generation
    ↓
Svelte Code
    ↓
Storage (Database)
```

### Step 1: Event Replay

Replay events to build current design state:

```typescript
function replayEvents(events: DesignEvent[]): DesignState {
  const state = {
    components: new Map(),
    hierarchy: [],
    properties: new Map()
  };
  
  for (const event of events) {
    applyEvent(state, event);
  }
  
  return state;
}
```

### Step 2: Build Component Tree

Convert flat state to hierarchical tree:

```typescript
interface ComponentNode {
  id: string;
  type: 'div' | 'text' | 'media' | 'block';
  properties: ComponentProperties;
  children: ComponentNode[];
}

function buildComponentTree(state: DesignState): ComponentNode {
  // Build tree from hierarchy and properties
  return constructTree(state.hierarchy, state.properties);
}
```

### Step 3: Generate AST

Create Abstract Syntax Tree for code generation:

```typescript
interface ASTNode {
  type: 'component' | 'element' | 'text';
  tag?: string;
  props?: Record<string, any>;
  children?: ASTNode[];
  content?: string;
}

function generateAST(tree: ComponentNode): ASTNode {
  return {
    type: 'component',
    tag: tree.type,
    props: serializeProperties(tree.properties),
    children: tree.children.map(generateAST)
  };
}
```

### Step 4: Generate Svelte Code

Convert AST to Svelte component code:

```typescript
function generateSvelteCode(ast: ASTNode, frames: Frame[]): string {
  const script = generateScript(ast);
  const template = generateTemplate(ast);
  const styles = generateStyles(ast, frames); // Includes responsive CSS
  
  return `
<script>
${script}
</script>

${template}

<style>
${styles}
</style>
  `.trim();
}
```

### Example Output

**Input Events**:
```javascript
[
  {type: 'ADD_COMPONENT', componentType: 'div', id: 'hero', ...},
  {type: 'UPDATE_PROPERTY', id: 'hero', property: 'background.color', value: '#ff0000'},
  {type: 'ADD_COMPONENT', componentType: 'text', parentId: 'hero', id: 'heading', ...},
  {type: 'UPDATE_PROPERTY', id: 'heading', property: 'content', value: 'Welcome'}
]
```

**Generated Svelte Component**:
```svelte
<script>
  // Component logic
</script>

<div class="hero" style="background-color: #ff0000;">
  <h1 class="heading">Welcome</h1>
</div>

<style>
  .hero {
    background-color: #ff0000;
    /* ... other styles ... */
  }
  
  .heading {
    /* ... text styles ... */
  }
  
  /* Responsive styles */
  @media (min-width: 768px) {
    .hero {
      /* Tablet styles */
    }
  }
  
  @media (min-width: 1024px) {
    .hero {
      /* Desktop styles */
    }
  }
</style>
```

### Responsive CSS Generation

When multiple frames exist for different breakpoints, generate media queries:

```typescript
function generateResponsiveStyles(frames: Frame[]): string {
  // Sort frames by breakpoint (mobile-first)
  const sortedFrames = frames.sort((a, b) => a.breakpointWidth - b.breakpointWidth);
  
  let css = '';
  
  // Base styles (smallest breakpoint)
  css += generateFrameStyles(sortedFrames[0]);
  
  // Media queries for larger breakpoints
  for (let i = 1; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i];
    css += `
@media (min-width: ${frame.breakpointWidth}px) {
  ${generateFrameStyles(frame)}
}
    `;
  }
  
  return css;
}
```

### Code Storage

Generated code stored in database:

```typescript
// After code generation
await db.page.update({
  where: { id: pageId },
  data: {
    publishedCode: svelteCode,
    status: 'published',
    publishedAt: new Date()
  }
});
```

### Static Export (Download)

For static HTML/CSS export:

```typescript
function generateStaticHTML(ast: ASTNode, frames: Frame[]): string {
  const html = generateHTML(ast); // Pure HTML, no Svelte
  const css = generateStyles(ast, frames);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style>${css}</style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();
}
```

Package as .zip with assets:

```
exported-site.zip
├── index.html
├── about.html
├── contact.html
├── css/
│   └── styles.css (if separate)
└── assets/
    ├── logo.png
    └── hero-image.jpg
```

---

## Responsive Design Strategy

Linabasis uses **mobile-first CSS media queries** for responsive design, not conditional component rendering.

### Design Workflow

1. User creates Desktop frame (1920px) with design
2. User adds Tablet frame (768px) - content copied, layout adjusted
3. User adds Mobile frame (375px) - content copied, layout adjusted
4. User publishes → system generates responsive CSS

### Frame Comparison Algorithm

When generating CSS, compare frames to find property differences:

```typescript
function compareFrames(frames: Frame[]): ResponsiveProperties {
  const responsiveProps = new Map();
  
  for (const elementId of allElementIds) {
    const mobileProps = getElementProps(frames[0], elementId); // Base
    const tabletProps = getElementProps(frames[1], elementId);
    const desktopProps = getElementProps(frames[2], elementId);
    
    // Find differences
    const diffs = {
      tablet: diffProperties(mobileProps, tabletProps),
      desktop: diffProperties(tabletProps, desktopProps)
    };
    
    responsiveProps.set(elementId, diffs);
  }
  
  return responsiveProps;
}
```

### Generated CSS Structure

```css
/* Base (Mobile - 375px) */
.hero {
  padding: 20px;
  font-size: 24px;
  height: 300px;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .hero {
    padding: 40px;  /* Only changed properties */
    font-size: 32px;
    height: 400px;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .hero {
    padding: 60px;
    font-size: 48px;
    height: 600px;
  }
}
```

### Breakpoint Strategy

**Standard Breakpoints** (user can customize):
- Mobile: 375px (base, no media query)
- Tablet: 768px (`@media (min-width: 768px)`)
- Desktop: 1024px (`@media (min-width: 1024px)`)
- Large Desktop: 1920px (`@media (min-width: 1920px)`)

**Custom Breakpoints**: Users can define any pixel value.

---

## Block System

Blocks are user-created reusable design elements with master-instance relationships.

### Block Creation

**User workflow**:
1. User designs elements on canvas
2. Selects elements → Right-click → "Convert to Block"
3. Modal prompts for block name
4. System creates Block with designEvents

**Database operations**:
```typescript
// Create master block
const block = await db.block.create({
  data: {
    name: blockName,
    sourcePageId: currentPageId,
    designEvents: JSON.stringify(selectedEvents),
    createdBy: userId,
    teamId: user.teamId
  }
});

// Replace selected elements with block instance
const instance = await db.blockInstance.create({
  data: {
    blockId: block.id,
    frameId: currentFrameId,
    elementId: generateId(),
    isDetached: false
  }
});
```

### Block Usage

**User workflow**:
1. User drags block from Blocks window to canvas
2. Block instance created on target frame

**System operations**:
```typescript
// Insert block instance
const instance = await db.blockInstance.create({
  data: {
    blockId: selectedBlockId,
    frameId: targetFrameId,
    elementId: generateId(),
    isDetached: false
  }
});

// During rendering, fetch master block events and merge
const block = await db.block.findUnique({ where: { id: instance.blockId }});
const blockEvents = JSON.parse(block.designEvents);

// Inject block events into frame's event stream at element position
const mergedEvents = injectBlockEvents(frameEvents, blockEvents, instance.elementId);
```

### Block Editing

**Editing Master**:
1. User right-clicks block in Blocks window → "Edit Block"
2. Designer opens source page
3. Block instance highlighted
4. User makes changes
5. Changes saved to master block
6. All instances across all pages update

**Auto-Detachment**:
1. User directly edits a block instance on canvas
2. System automatically detaches instance:
```typescript
await db.blockInstance.update({
  where: { id: instanceId },
  data: {
    isDetached: true,
    overrideEvents: JSON.stringify(newEvents)
  }
});
```

**Push to Master**:
```typescript
// User clicks "Push to Master" on detached instance
await db.block.update({
  where: { id: block.id },
  data: {
    designEvents: JSON.stringify(instanceEvents)
  }
});

// Reset all other instances (they'll pull new master)
await db.blockInstance.updateMany({
  where: { blockId: block.id, id: { not: instanceId }},
  data: { isDetached: false, overrideEvents: null }
});
```

**Reset to Master**:
```typescript
// User clicks "Reset to Master"
await db.blockInstance.update({
  where: { id: instanceId },
  data: {
    isDetached: false,
    overrideEvents: null
  }
});
```

### Block Rendering

**During design**: Blocks render from master + overrides
**During publish**: Blocks expanded inline into page code

```typescript
function expandBlocks(events: DesignEvent[], instances: BlockInstance[]): DesignEvent[] {
  let expandedEvents = [...events];
  
  for (const instance of instances) {
    const block = await db.block.findUnique({ where: { id: instance.blockId }});
    const blockEvents = JSON.parse(block.designEvents);
    
    if (instance.isDetached) {
      const overrideEvents = JSON.parse(instance.overrideEvents);
      expandedEvents = mergeEvents(expandedEvents, blockEvents, overrideEvents, instance.elementId);
    } else {
      expandedEvents = injectEvents(expandedEvents, blockEvents, instance.elementId);
    }
  }
  
  return expandedEvents;
}
```

---

## Theme System

Themes package pages, blocks, design tokens, media, and template assignments for portability between Linabasis installations.

### Theme Structure

```typescript
interface Theme {
  name: string;
  version: string;
  author: string;
  description: string;
  
  pages: Array<{
    slug: string;
    title: string;
    templateType: string;
    designEvents: DesignEvent[];
    frames: Array<{
      breakpointWidth: number;
      designEvents: DesignEvent[];
    }>;
    seo: {metaTitle, metaDescription, metaImage};
  }>;
  
  blocks: Array<{
    name: string;
    sourcePageSlug: string;
    designEvents: DesignEvent[];
    thumbnail: string;
  }>;
  
  tokens: {
    colors: {...},
    typography: {...},
    spacing: {...},
    effects: {...}
  };
  
  media: Array<{
    filename: string;
    data: string; // Base64 or URL
    metadata: {altText, caption, etc.}
  }>;
  
  templates: {
    blogHomepage: string; // Page slug
    singlePost: string;
    categoryArchive: string;
    authorArchive: string;
  };
}
```

### Theme Export

**File Export** (.zip):

```typescript
async function exportThemeAsZip(themeData: Theme): Promise<Blob> {
  const zip = new JSZip();
  
  // Add theme.json
  zip.file('theme.json', JSON.stringify(themeData, null, 2));
  
  // Add media files
  for (const media of themeData.media) {
    zip.file(`media/${media.filename}`, media.data, {base64: true});
  }
  
  // Add README
  zip.file('README.md', generateReadme(themeData));
  
  return await zip.generateAsync({type: 'blob'});
}
```

**API Export** (for remote import):

```typescript
// Server exposes API endpoint
// GET /api/themes/export?apiKey=xxx
export async function GET({ url, locals }) {
  const apiKey = url.searchParams.get('apiKey');
  
  // Validate API key
  if (!validateApiKey(apiKey, locals.team.id)) {
    return json({error: 'Invalid API key'}, {status: 401});
  }
  
  // Build theme data
  const themeData = await buildThemeData(locals.team.id);
  
  return json(themeData);
}
```

### Theme Import

**File Import**:

```typescript
async function importThemeFromZip(zipFile: File): Promise<void> {
  const zip = await JSZip.loadAsync(zipFile);
  
  // Read theme.json
  const themeJson = await zip.file('theme.json').async('string');
  const theme: Theme = JSON.parse(themeJson);
  
  // Import in order:
  // 1. Media files
  for (const mediaEntry of theme.media) {
    await importMedia(mediaEntry);
  }
  
  // 2. Pages and frames
  for (const page of theme.pages) {
    await importPage(page);
  }
  
  // 3. Blocks
  for (const block of theme.blocks) {
    await importBlock(block);
  }
  
  // 4. Tokens
  await importTokens(theme.tokens);
  
  // 5. Template assignments
  await assignTemplates(theme.templates);
}
```

**API Import**:

```typescript
async function importThemeFromAPI(remoteUrl: string, apiKey: string): Promise<void> {
  // Fetch theme from remote Linabasis installation
  const response = await fetch(`${remoteUrl}/api/themes/export?apiKey=${apiKey}`);
  const theme: Theme = await response.json();
  
  // Import (same as file import)
  await importThemeData(theme);
}
```

### Conflict Resolution

When importing, handle conflicts:

```typescript
async function importPage(pageData: ThemePageData): Promise<void> {
  // Check if slug exists
  const existing = await db.page.findUnique({ where: { slug: pageData.slug }});
  
  if (existing) {
    // Prompt user:
    // - Skip
    // - Rename (append "-2", "-3", etc.)
    // - Overwrite
    const action = await promptConflictResolution(pageData.slug);
    
    if (action === 'skip') return;
    if (action === 'rename') pageData.slug = generateUniqueSlug(pageData.slug);
    if (action === 'overwrite') await db.page.delete({ where: { id: existing.id }});
  }
  
  // Create page
  await db.page.create({ data: pageData });
}
```

---

## Authentication & Authorization

Linabasis uses JWT-based authentication with role-based access control (RBAC).

### Authentication Flow

**Registration**:
```typescript
// POST /api/auth/register
{
  email: string,
  password: string,
  name: string
}

// Server:
1. Validate input
2. Hash password (bcrypt)
3. Create user
4. Create team (if first user) OR add to existing team (if invited)
5. Generate JWT access token (15min expiry)
6. Generate refresh token (30 days expiry)
7. Store refresh token in Session table
8. Return tokens + user data
```

**Login**:
```typescript
// POST /api/auth/login
{
  email: string,
  password: string
}

// Server:
1. Find user by email
2. Verify password (bcrypt.compare)
3. Generate access token (15min)
4. Generate refresh token (30 days)
5. Store refresh token
6. Return tokens + user data
```

**Token Refresh**:
```typescript
// POST /api/auth/refresh
{
  refreshToken: string
}

// Server:
1. Validate refresh token
2. Check if exists in Session table
3. Generate new access token
4. Return new access token
```

### JWT Structure

```typescript
// Access Token Payload
{
  userId: string,
  email: string,
  role: string,
  teamId: string,
  exp: number // 15 minutes from now
}

// Refresh Token (stored in DB)
{
  userId: string,
  token: string (random),
  expiresAt: Date // 30 days from now
}
```

### Authorization (RBAC)

Four roles with hierarchical permissions:

**Owner** (team owner):
- All Manager permissions
- Delete team
- Transfer ownership
- Cannot be removed

**Manager**:
- All Designer permissions
- Add/remove team members
- Change member roles
- Manage billing (future)
- Access team settings

**Designer**:
- All Editor permissions
- Create/edit/delete pages
- Create/edit/delete blocks
- Manage media library
- Publish pages
- Create/edit/delete blog posts

**Editor**:
- Edit page content (limited properties)
- Edit blog posts
- Upload media
- Cannot publish pages
- Cannot delete pages/blocks

### Middleware

```typescript
// src/lib/server/middleware/auth.ts

export function requireAuth(handler: RequestHandler): RequestHandler {
  return async (event) => {
    const token = event.cookies.get('access_token');
    
    if (!token) {
      throw redirect(302, '/login');
    }
    
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      event.locals.user = await db.user.findUnique({ where: { id: payload.userId }});
      return await handler(event);
    } catch (err) {
      throw redirect(302, '/login');
    }
  };
}

export function requireRole(role: string, handler: RequestHandler): RequestHandler {
  return requireAuth(async (event) => {
    const userRole = event.locals.user.role;
    
    if (!hasPermission(userRole, role)) {
      throw error(403, 'Insufficient permissions');
    }
    
    return await handler(event);
  });
}

// Role hierarchy check
function hasPermission(userRole: string, requiredRole: string): boolean {
  const hierarchy = ['owner', 'manager', 'designer', 'editor'];
  return hierarchy.indexOf(userRole) <= hierarchy.indexOf(requiredRole);
}
```

### Protected Routes

```typescript
// src/routes/admin/pages/+page.server.ts
import { requireRole } from '$lib/server/middleware/auth';

export const load = requireRole('designer', async ({ locals }) => {
  // Only designers and above can access
  const pages = await db.page.findMany({ where: { teamId: locals.user.teamId }});
  return { pages };
});
```

### API Route Protection

```typescript
// src/routes/api/pages/[id]/+server.ts

// GET: Read (all authenticated users)
export const GET = requireAuth(async ({ params, locals }) => {
  const page = await db.page.findUnique({ where: { id: params.id }});
  return json(page);
});

// PUT: Update (designers only)
export const PUT = requireRole('designer', async ({ params, request, locals }) => {
  const data = await request.json();
  const page = await db.page.update({ where: { id: params.id }, data });
  return json(page);
});

// DELETE: Delete (designers only)
export const DELETE = requireRole('designer', async ({ params, locals }) => {
  await db.page.delete({ where: { id: params.id }});
  return json({ success: true });
});
```

---

## Plugin Architecture

Linabasis supports plugins via Prisma schema composition and dynamic route/hook registration.

### Plugin Structure

```
plugins/
└── blog/
    ├── manifest.ts          # Plugin metadata
    ├── prisma/
    │   └── schema.prisma    # Plugin-specific models
    ├── server/
    │   ├── routes/          # API routes
    │   └── hooks.ts         # Lifecycle hooks
    └── admin/
        └── pages/           # Admin UI pages
```

### Plugin Manifest

```typescript
// plugins/blog/manifest.ts
import type { Plugin } from '$lib/core/plugins/types';

export const manifest: Plugin = {
  id: '@linebasis/blog',
  name: 'Blog',
  version: '1.0.0',
  description: 'Blog functionality with posts, categories, and tags',
  
  // Database models
  schema: './prisma/schema.prisma',
  
  // API routes
  routes: [
    { path: '/api/posts', handler: './server/routes/posts.ts' },
    { path: '/api/categories', handler: './server/routes/categories.ts' },
    { path: '/api/tags', handler: './server/routes/tags.ts' }
  ],
  
  // Admin pages
  adminPages: [
    { path: '/admin/blog', component: './admin/pages/Blog.svelte' },
    { path: '/admin/blog/posts/new', component: './admin/pages/NewPost.svelte' }
  ],
  
  // Lifecycle hooks
  hooks: {
    'page:publish': './server/hooks.ts#onPagePublish',
    'user:create': './server/hooks.ts#onUserCreate'
  },
  
  // Settings
  settings: {
    postsPerPage: { type: 'number', default: 10 },
    enableComments: { type: 'boolean', default: false }
  }
};
```

### Schema Composition

```bash
# Build process
npm run db:compose

# Merges schemas:
prisma/schema.core.prisma (core models)
+ plugins/blog/prisma/schema.prisma (blog models)
= prisma/schema.prisma (final composed schema)
```

### Plugin Hooks

Plugins can hook into core events:

```typescript
// plugins/blog/server/hooks.ts

export function onPagePublish(page: Page): void {
  // React to page publish event
  console.log(`Page published: ${page.slug}`);
  
  // Example: Update sitemap
  regenerateSitemap();
}

export function onUserCreate(user: User): void {
  // React to user creation
  console.log(`New user: ${user.email}`);
  
  // Example: Send welcome email
  sendWelcomeEmail(user);
}
```

### Plugin Installation

```typescript
// Install plugin
await db.plugin.create({
  data: {
    id: '@linebasis/blog',
    name: 'Blog',
    version: '1.0.0',
    isActive: true,
    teamId: currentTeam.id
  }
});

// Run schema composition
await exec('npm run db:compose');

// Run migration
await exec('npm run db:migrate');

// Plugin is now active
```

---

## File Structure

Complete project organization:

```
linebasis/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte                    # Root layout
│   │   ├── +page.svelte                      # Homepage (designer or custom)
│   │   │
│   │   ├── [slug]/
│   │   │   └── +page.server.ts               # Published pages (SSR)
│   │   │
│   │   ├── login/
│   │   │   └── +page.svelte
│   │   ├── register/
│   │   │   └── +page.svelte
│   │   │
│   │   ├── blog/
│   │   │   ├── +page.server.ts               # Blog homepage
│   │   │   ├── [slug]/+page.server.ts        # Blog post
│   │   │   └── category/
│   │   │       └── [slug]/+page.server.ts    # Category archive
│   │   │
│   │   ├── admin/
│   │   │   ├── +layout.svelte                # Admin layout (navbar, sidebar)
│   │   │   ├── dashboard/+page.svelte
│   │   │   │
│   │   │   ├── pages/
│   │   │   │   ├── +page.svelte              # Pages list
│   │   │   │   └── [id]/+page.svelte         # Page details
│   │   │   │
│   │   │   ├── designer/
│   │   │   │   └── [pageId]/
│   │   │   │       └── +page.svelte          # Page builder UI
│   │   │   │
│   │   │   ├── preview/
│   │   │   │   └── [pageId]/
│   │   │   │       └── +page.svelte          # Preview page
│   │   │   │
│   │   │   ├── blocks/+page.svelte
│   │   │   ├── styles/+page.svelte
│   │   │   │
│   │   │   ├── blog/
│   │   │   │   ├── +page.svelte              # Blog dashboard
│   │   │   │   └── posts/
│   │   │   │       ├── new/+page.svelte
│   │   │   │       └── [id]/
│   │   │   │           └── edit/+page.svelte
│   │   │   │
│   │   │   ├── media/+page.svelte
│   │   │   ├── themes/
│   │   │   │   ├── +page.svelte
│   │   │   │   ├── import/+page.svelte
│   │   │   │   └── export/+page.svelte
│   │   │   │
│   │   │   ├── team/+page.svelte
│   │   │   ├── settings/+page.svelte
│   │   │   └── account/+page.svelte
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/+server.ts
│   │       │   ├── register/+server.ts
│   │       │   └── refresh/+server.ts
│   │       │
│   │       ├── pages/
│   │       │   ├── +server.ts                # GET, POST
│   │       │   ├── [id]/+server.ts           # GET, PUT, DELETE
│   │       │   └── publish/+server.ts        # POST publish
│   │       │
│   │       ├── frames/
│   │       │   └── [id]/+server.ts
│   │       │
│   │       ├── blocks/
│   │       │   ├── +server.ts
│   │       │   └── [id]/+server.ts
│   │       │
│   │       ├── media/
│   │       │   ├── upload/+server.ts
│   │       │   └── [id]/+server.ts
│   │       │
│   │       ├── themes/
│   │       │   ├── export/+server.ts
│   │       │   └── import/+server.ts
│   │       │
│   │       └── settings/
│   │           └── +server.ts
│   │
│   ├── lib/
│   │   ├── components/
│   │   │   ├── primitives/            # Atomic components
│   │   │   │   ├── Div.svelte
│   │   │   │   ├── Text.svelte
│   │   │   │   └── Media.svelte
│   │   │   │
│   │   │   ├── blocks/                # Default blocks
│   │   │   │   ├── FormBuilder.svelte
│   │   │   │   └── PostContent.svelte
│   │   │   │
│   │   │   ├── designer/              # Page builder UI
│   │   │   │   ├── Toolbar.svelte
│   │   │   │   ├── Canvas.svelte
│   │   │   │   ├── BlocksWindow.svelte
│   │   │   │   ├── LayersWindow.svelte
│   │   │   │   ├── PropertiesWindow.svelte
│   │   │   │   ├── TokensWindow.svelte
│   │   │   │   └── FloatingToolbar.svelte
│   │   │   │
│   │   │   ├── admin/                 # Admin UI
│   │   │   │   ├── Navbar.svelte
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   └── ... (various admin components)
│   │   │   │
│   │   │   └── ui/                    # Shared UI components
│   │   │       ├── Button.svelte
│   │   │       ├── Input.svelte
│   │   │       ├── Modal.svelte
│   │   │       └── ...
│   │   │
│   │   ├── stores/
│   │   │   ├── event-store.ts         # Event sourcing
│   │   │   ├── design-store.ts        # Current design state
│   │   │   ├── auth-store.ts          # Auth state
│   │   │   └── ui-store.ts            # UI state (windows, etc.)
│   │   │
│   │   ├── utils/
│   │   │   ├── ast.ts                 # AST generation
│   │   │   ├── codegen.ts             # Code generation
│   │   │   ├── baseline.ts            # Baseline grid calculations
│   │   │   ├── events.ts              # Event helpers
│   │   │   └── validation.ts          # Input validation
│   │   │
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   └── client.ts          # Prisma client
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── auth.ts            # Auth logic
│   │   │   │   ├── pages.ts           # Page CRUD
│   │   │   │   ├── blocks.ts          # Block management
│   │   │   │   ├── media.ts           # Media upload/optimization
│   │   │   │   ├── codegen.ts         # Code generation
│   │   │   │   └── theme.ts           # Theme import/export
│   │   │   │
│   │   │   └── middleware/
│   │   │       └── auth.ts            # Auth middleware
│   │   │
│   │   ├── types/
│   │   │   ├── components.ts          # Component properties types
│   │   │   ├── events.ts              # Event types
│   │   │   ├── ast.ts                 # AST types
│   │   │   └── api.ts                 # API types
│   │   │
│   │   └── core/
│   │       └── plugins/
│   │           ├── types.ts
│   │           ├── registry.ts
│   │           ├── loader.ts
│   │           └── hooks.ts
│   │
│   ├── app.d.ts
│   └── app.css
│
├── prisma/
│   ├── schema.core.prisma             # Core models
│   ├── schema.prisma                  # Composed schema (generated)
│   └── migrations/
│
├── plugins/
│   └── blog/
│       ├── manifest.ts
│       ├── prisma/schema.prisma
│       ├── server/
│       └── admin/
│
├── static/
│   ├── uploads/                       # Uploaded media
│   ├── favicon.png
│   └── ...
│
├── docs/
│   └── planning/
│       ├── app.md
│       ├── page-builder-spec.md
│       ├── architecture.md
│       ├── component-properties.md
│       └── ...
│
├── scripts/
│   └── build-schema.ts                # Schema composition script
│
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
└── .env
```

---

## Technology Stack

### Frontend

- **SvelteKit** - Full-stack framework
- **Svelte** - UI components
- **TypeScript** - Type safety (strict mode)
- **Vite** - Build tool
- **IndexedDB** (via Dexie.js) - Local storage
- **Tailwind CSS** - Utility-first CSS (optional)

### Backend

- **SvelteKit** - Server-side rendering and API
- **Node.js** - Runtime
- **Prisma ORM** - Database abstraction
- **SQLite** - Development database
- **PostgreSQL** - Production database
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication

### Media

- **Sharp** - Image optimization
- **FFmpeg** - Video processing (future)

### Testing

- **Vitest** - Unit and integration tests
- **Testing Library** - Component testing
- **Playwright** - E2E testing (future)

### Development

- **ESLint** - Linting
- **Prettier** - Code formatting
- **Husky** - Git hooks (future)

---

## Performance Optimizations

### Client-Side

**IndexedDB Caching**:
- Design events cached locally
- Instant load on return visits
- Auto-save reduces data loss

**Event Replay Optimization**:
```typescript
// Cache computed state to avoid full replay
let stateCache: DesignState | null = null;
let lastEventIndex = 0;

function replayEvents(events: DesignEvent[]): DesignState {
  if (stateCache && events.length === lastEventIndex) {
    return stateCache; // Use cache
  }
  
  // Only replay new events
  let state = stateCache || createEmptyState();
  for (let i = lastEventIndex; i < events.length; i++) {
    state = applyEvent(state, events[i]);
  }
  
  stateCache = state;
  lastEventIndex = events.length;
  return state;
}
```

**Virtual Scrolling**:
- Layers window uses virtual scrolling for large hierarchies
- Blocks window virtualizes long lists

### Server-Side

**Database Indexing**:
- All foreign keys indexed
- Slug fields indexed
- Status fields indexed
- Composite indexes for common queries

**Code Generation Caching**:
```typescript
// Cache generated Svelte code
const codeCache = new Map<string, string>();

function getPublishedCode(pageId: string): string {
  if (codeCache.has(pageId)) {
    return codeCache.get(pageId);
  }
  
  const page = db.page.findUnique({ where: { id: pageId }});
  codeCache.set(pageId, page.publishedCode);
  return page.publishedCode;
}

// Invalidate cache on publish
function onPagePublish(pageId: string): void {
  codeCache.delete(pageId);
}
```

**Image Optimization**:
- Sharp auto-generates responsive images
- WebP format with fallbacks
- Lazy loading by default

**SSR Caching** (future):
```typescript
// Cache rendered HTML for published pages
const htmlCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 5 }); // 5min

export const load = async ({ params }) => {
  const cacheKey = `page:${params.slug}`;
  
  if (htmlCache.has(cacheKey)) {
    return htmlCache.get(cacheKey);
  }
  
  const html = await renderPage(params.slug);
  htmlCache.set(cacheKey, html);
  return html;
};
```

---

## Security Considerations

### Input Validation

All user inputs validated:

```typescript
import { z } from 'zod';

const PageSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  designEvents: z.array(z.object({...}))
});

export const POST = async ({ request }) => {
  const data = await request.json();
  const validated = PageSchema.parse(data); // Throws if invalid
  // ... proceed
};
```

### SQL Injection Prevention

Prisma ORM parameterizes all queries automatically.

### XSS Prevention

- All user content sanitized
- Rich text content uses DOMPurify
- Svelte escapes by default

### CSRF Protection

- SvelteKit CSRF protection enabled
- API endpoints require CSRF token

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to sensitive routes
app.use('/api/auth/', limiter);
```

### File Upload Security

```typescript
// Validate file type
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validateUpload(file: File): void {
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    throw new Error('File too large');
  }
}

// Store with random filename
const filename = `${crypto.randomUUID()}.${ext}`;
```

### JWT Security

- Short-lived access tokens (15min)
- Refresh tokens stored server-side
- HTTPS-only cookies
- httpOnly flag set

---

## Deployment Architecture

### Development

```
Local Machine
├── npm run dev (SvelteKit dev server)
├── SQLite database (dev.db)
└── IndexedDB (browser)
```

### Production

```
┌─────────────────────────────────────────┐
│  CDN (Cloudflare, CloudFront)           │
│  - Static assets (/static)              │
│  - Media files (/uploads)               │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  SvelteKit App (Node.js)                │
│  - SSR rendering                        │
│  - API endpoints                        │
│  - Authentication                       │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  PostgreSQL Database                    │
│  - Pages, Users, Media, etc.            │
└─────────────────────────────────────────┘
```

### Hosting Options

**Option 1: VPS (DigitalOcean, Linode, etc.)**
```bash
# Install Node.js
# Install PostgreSQL
# Clone repo
git clone https://github.com/linebasis/linebasis
cd linebasis
npm install
npm run build
npm run setup  # Create DB, admin user
node build/index.js  # Start server (or use PM2)
```

**Option 2: Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "build/index.js"]
```

```yaml
# docker-compose.yml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/linebasis
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: linebasis
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Option 3: Vercel/Netlify (Serverless)**
- SvelteKit adapts to serverless
- Use external PostgreSQL (Supabase, Neon)
- Limited plugin support (no file system writes)

### Scaling Strategy

**Horizontal Scaling**:
- Multiple app instances behind load balancer
- Shared PostgreSQL database
- Shared media storage (S3, R2)

**Vertical Scaling**:
- Increase VPS resources
- Optimize database (indexes, caching)
- Add Redis for session/cache storage

---

## Summary

Linabasis architecture is designed for:

1. **Local-first design** with IndexedDB and auto-save
2. **Event sourcing** for perfect undo/redo and audit trails
3. **Dynamic code generation** from events to Svelte components
4. **Responsive design** via mobile-first CSS media queries
5. **Block system** with master-instance relationships
6. **Theme portability** between installations
7. **Plugin extensibility** via schema composition
8. **Role-based security** with JWT authentication
9. **Performance** through caching and optimization
10. **Scalability** via horizontal and vertical scaling

The architecture supports both Linabasis-hosted sites (dynamic Svelte components) and static exports (HTML/CSS download), providing maximum flexibility for users.

---

**Next Steps**: See `workflows.md` for detailed user workflows and `page-builder-spec.md` for complete page builder interface specification.

## Custom Block System (Phase 2)

**Status**: Planned for Phase 2 release (after core page builder)

Custom blocks allow developers to create coded Svelte components that appear in the designer alongside user-created blocks. This enables advanced features like carousels, animations, interactive elements, and client-specific functionality.

### Overview

Linabasis supports three types of blocks:

1. **User Blocks** - Created in designer by selecting elements → "Convert to Block"
2. **Custom Blocks** - Developer-coded Svelte components (local or plugin-provided)
3. **Plugin Blocks** - Custom blocks distributed via plugins (Phase 3)

### Block Types Comparison

| Type | How Created | Properties | Use Case |
|------|-------------|------------|----------|
| User Blocks | Designer UI | General properties | Reusable design patterns |
| Custom Blocks | Coded (Svelte) | Custom schema | Complex interactions, animations |
| Plugin Blocks | Plugin manifest | Custom schema | Distributable features (blog, forms) |

---

### Custom Block Structure

Custom blocks are Svelte components with metadata that define their appearance and editable properties.

#### Location Options

**Option A: Local Blocks** (Quick, client-specific)
```
src/lib/components/blocks/
├── Carousel.svelte
├── FadeInSection.svelte
└── CustomHero.svelte
```

**Option B: Plugin Blocks** (Recommended, portable)
```
plugins/
└── custom-blocks/
    ├── manifest.ts
    └── blocks/
        ├── Carousel.svelte
        └── FadeInSection.svelte
```

**Recommendation**: Use plugins for:
- Distributable blocks (marketplace, sharing)
- Client projects (portability, versioning)
- Best practices reference

Use local blocks for:
- Quick prototypes
- One-off client-specific features
- Testing before creating plugin

---

### Defining Custom Blocks

Two methods supported:

#### Method A: Manifest-Based (Separation of Concerns)

```typescript
// plugins/my-blocks/manifest.ts
export const manifest: Plugin = {
  id: '@myagency/custom-blocks',
  name: 'Custom Blocks',
  version: '1.0.0',
  
  blocks: [
    {
      id: 'carousel',
      name: 'Image Carousel',
      category: 'interactive',
      component: './blocks/Carousel.svelte',
      thumbnail: './assets/carousel.png',
      description: 'Responsive image carousel with autoplay',
      
      // Property schema (auto-generates UI in Properties window)
      properties: {
        images: {
          type: 'array',
          itemType: 'media',
          label: 'Carousel Images',
          default: [],
          description: 'Images to display in carousel'
        },
        autoplay: {
          type: 'boolean',
          label: 'Auto Play',
          default: true
        },
        interval: {
          type: 'number',
          label: 'Slide Interval (ms)',
          min: 1000,
          max: 10000,
          step: 1000,
          default: 5000,
          control: 'slider' // 'slider' or 'input'
        },
        transitionType: {
          type: 'select',
          label: 'Transition Effect',
          options: ['fade', 'slide', 'zoom'],
          default: 'slide'
        }
      },
      
      // Optional: Custom property editor component
      propertyEditor: './editors/CarouselEditor.svelte'
    }
  ]
};
```

#### Method B: Component-Based (All-in-One)

```svelte
<!-- plugins/my-blocks/blocks/Carousel.svelte -->
<script context="module" lang="ts">
  // Block metadata exported for designer
  export const blockMeta = {
    id: 'carousel',
    name: 'Image Carousel',
    category: 'interactive',
    thumbnail: '../assets/carousel.png',
    description: 'Responsive image carousel'
  };
  
  // Property schema (generates UI automatically)
  export const blockProperties = {
    images: {
      type: 'array',
      itemType: 'media',
      label: 'Images',
      default: []
    },
    autoplay: {
      type: 'boolean',
      label: 'Auto Play',
      default: true
    },
    interval: {
      type: 'number',
      label: 'Interval (ms)',
      min: 1000,
      max: 10000,
      default: 5000
    }
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  
  // Mode prop (all blocks must support this)
  export let mode: 'editor' | 'live' = 'live';
  
  // Editable properties (match blockProperties schema)
  export let images: string[] = [];
  export let autoplay: boolean = true;
  export let interval: number = 5000;
  
  // Internal state (not editable)
  let currentSlide = 0;
  let intervalId: number;
  
  onMount(() => {
    if (autoplay && mode === 'live') {
      intervalId = setInterval(() => {
        currentSlide = (currentSlide + 1) % images.length;
      }, interval);
    }
    
    return () => clearInterval(intervalId);
  });
</script>

{#if mode === 'editor'}
  <!-- Editor preview (simplified) -->
  <div class="carousel-editor">
    {#if images.length === 0}
      <div class="placeholder">Add images to carousel</div>
    {:else}
      <img src={images[0]} alt="Preview" />
      <div class="badge">{images.length} images</div>
    {/if}
  </div>
{:else}
  <!-- Live production carousel -->
  <div class="carousel">
    {#each images as image, i}
      <div class="slide" class:active={i === currentSlide}>
        <img src={image} alt="Slide {i + 1}" />
      </div>
    {/each}
    <!-- Carousel controls -->
  </div>
{/if}
```

---

### Property Types

Custom blocks can define various property types:

```typescript
interface PropertySchema {
  // Basic types
  text: { type: 'text', label: string, default?: string };
  richtext: { type: 'richtext', label: string, default?: string };
  number: { type: 'number', label: string, min?: number, max?: number, step?: number, default?: number };
  boolean: { type: 'boolean', label: string, default?: boolean };
  
  // Selection
  select: { type: 'select', label: string, options: string[], default?: string };
  
  // Media
  media: { type: 'media', mediaType?: 'image' | 'video' | 'document', label: string };
  
  // Color
  color: { type: 'color', label: string, default?: string };
  
  // URL
  url: { type: 'url', label: string, default?: string };
  
  // Complex types
  array: { type: 'array', itemType: PropertyType, label: string, default?: any[] };
  object: { type: 'object', properties: Record<string, PropertyType>, label: string };
}
```

**Auto-Generated UI**:
- `text` → Text input
- `richtext` → Rich text editor
- `number` → Number input or slider (if control: 'slider')
- `boolean` → Toggle switch
- `select` → Dropdown
- `media` → Media picker (opens media library)
- `color` → Color picker
- `url` → URL input with validation
- `array` → List with add/remove buttons
- `object` → Nested property group

---

### Custom Property Editors

For complex property UI, blocks can define custom property editor components:

```svelte
<!-- plugins/my-blocks/editors/CarouselEditor.svelte -->
<script lang="ts">
  import type { CarouselProperties } from '../types';
  import { createEventDispatcher } from 'svelte';
  
  // Current property values
  export let properties: CarouselProperties;
  
  // Emit property updates
  const dispatch = createEventDispatcher<{
    update: { key: string; value: any };
  }>();
  
  function updateProperty(key: string, value: any) {
    dispatch('update', { key, value });
  }
  
  function addImage() {
    // Open media picker
    openMediaPicker((media) => {
      updateProperty('images', [...properties.images, media.url]);
    });
  }
  
  function removeImage(index: number) {
    const newImages = properties.images.filter((_, i) => i !== index);
    updateProperty('images', newImages);
  }
  
  function reorderImages(fromIndex: number, toIndex: number) {
    const newImages = [...properties.images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    updateProperty('images', newImages);
  }
</script>

<div class="carousel-property-editor">
  <h4>Carousel Configuration</h4>
  
  <!-- Visual image grid with drag & drop -->
  <div class="image-grid">
    {#each properties.images as image, i (image)}
      <div 
        class="image-item" 
        draggable="true"
        on:dragstart={(e) => handleDragStart(e, i)}
        on:drop={(e) => handleDrop(e, i)}
      >
        <img src={image} alt="Slide {i + 1}" />
        <button class="remove" on:click={() => removeImage(i)}>×</button>
        <div class="order">{i + 1}</div>
      </div>
    {/each}
    
    <button class="add-image" on:click={addImage}>
      + Add Image
    </button>
  </div>
  
  <!-- Settings -->
  <div class="settings">
    <label class="toggle">
      <input 
        type="checkbox" 
        checked={properties.autoplay}
        on:change={(e) => updateProperty('autoplay', e.target.checked)}
      />
      <span>Auto Play</span>
    </label>
    
    <div class="slider-control">
      <label>Slide Interval: {properties.interval}ms</label>
      <input 
        type="range" 
        min="1000" 
        max="10000" 
        step="1000"
        value={properties.interval}
        on:input={(e) => updateProperty('interval', +e.target.value)}
      />
      <!-- Live preview animation -->
      <div 
        class="interval-preview" 
        style="animation-duration: {properties.interval}ms"
      />
    </div>
  </div>
</div>

<style>
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
  
  .image-item {
    position: relative;
    aspect-ratio: 16/9;
    cursor: move;
  }
  
  .image-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }
  
  .remove {
    position: absolute;
    top: 4px;
    right: 4px;
    /* ... */
  }
</style>
```

---

### Block Registration

**For Local Blocks** (`src/lib/components/blocks/`):

System automatically discovers blocks with `blockMeta` export:

```typescript
// src/lib/core/blocks/loader.ts
export async function loadLocalBlocks(): Promise<CustomBlock[]> {
  const blockModules = import.meta.glob('/src/lib/components/blocks/*.svelte', {
    eager: true
  });
  
  const blocks: CustomBlock[] = [];
  
  for (const [path, module] of Object.entries(blockModules)) {
    if (module.blockMeta) {
      blocks.push({
        ...module.blockMeta,
        component: module.default,
        properties: module.blockProperties || {},
        propertyEditor: module.propertyEditor
      });
    }
  }
  
  return blocks;
}
```

**For Plugin Blocks**:

Loaded when plugin activated:

```typescript
// src/lib/core/plugins/loader.ts
export async function loadPluginBlocks(plugin: Plugin): Promise<CustomBlock[]> {
  if (!plugin.blocks) return [];
  
  const blocks: CustomBlock[] = [];
  
  for (const blockDef of plugin.blocks) {
    // Load component
    const component = await import(blockDef.component);
    
    // Load property editor (if specified)
    const propertyEditor = blockDef.propertyEditor 
      ? await import(blockDef.propertyEditor)
      : null;
    
    blocks.push({
      id: blockDef.id,
      name: blockDef.name,
      category: blockDef.category,
      component: component.default,
      properties: blockDef.properties,
      propertyEditor: propertyEditor?.default,
      thumbnail: blockDef.thumbnail,
      pluginId: plugin.id
    });
  }
  
  return blocks;
}
```

---

### Using Custom Blocks in Designer

**Blocks Window**:

```
┌─────────────────────────────┐
│ Blocks                      │
├─────────────────────────────┤
│                             │
│ ▼ Default Blocks            │
│   [No default blocks yet]   │ ← Phase 1: Empty
│                             │
│ ▼ Custom Blocks             │
│   📦 Carousel               │ ← Phase 2: Local blocks
│   📦 Fade In Section        │
│   📦 Custom Hero            │
│                             │
│ ▼ Blog Plugin               │ ← Phase 3: Plugin blocks
│   📝 Post Content           │
│                             │
│ ▼ Forms Plugin              │
│   📋 Form Builder           │
│                             │
│ ▼ User Blocks               │
│   └─ Homepage               │
│       📦 CTA Section        │ ← User-created blocks
│       📦 Feature Card       │
└─────────────────────────────┘
```

**Properties Window**:

When custom block selected:

```
┌─────────────────────────────┐
│ Properties                  │
│ Carousel                    │
├─────────────────────────────┤
│                             │
│ [Auto-generated from schema]│
│                             │
│ OR                          │
│                             │
│ [Custom property editor]    │
│                             │
└─────────────────────────────┘
```

---

### Code Generation for Custom Blocks

When page published, custom blocks are inlined into generated code:

**Design Events**:
```javascript
[
  {type: 'ADD_COMPONENT', componentType: 'div', id: 'hero'},
  {type: 'INSERT_BLOCK', blockType: 'custom', blockId: 'carousel', id: 'carousel-1', 
   properties: {images: [...], autoplay: true, interval: 5000}}
]
```

**Generated Svelte Code**:
```svelte
<script>
  import Carousel from '$lib/components/blocks/Carousel.svelte';
</script>

<div class="hero">
  <Carousel 
    mode="live"
    images={['image1.jpg', 'image2.jpg']}
    autoplay={true}
    interval={5000}
  />
</div>
```

**For Plugin Blocks**:
```svelte
<script>
  import PostContent from '$lib/plugins/blog/blocks/PostContent.svelte';
</script>

<PostContent mode="live" postContent={post.content} />
```

---

### Development Workflow

**Creating a Custom Block**:

1. **Create Svelte Component**:
   ```bash
   # For local block
   touch src/lib/components/blocks/Carousel.svelte
   
   # OR for plugin block
   mkdir -p plugins/my-blocks/blocks
   touch plugins/my-blocks/blocks/Carousel.svelte
   ```

2. **Define Block Metadata**:
   ```svelte
   <script context="module">
     export const blockMeta = { /* ... */ };
     export const blockProperties = { /* ... */ };
   </script>
   ```

3. **Implement Component**:
   - Add `mode` prop (editor/live)
   - Add property exports matching schema
   - Implement editor preview
   - Implement live version

4. **Test in Designer**:
   - Open designer
   - Block appears in Blocks window
   - Drag to canvas
   - Edit properties
   - Preview and publish

5. **Optional: Create Custom Property Editor**:
   - Create separate editor component
   - Reference in `blockMeta.propertyEditor`

---

### Plugin-Provided Blocks (Phase 3)

**Blog Plugin Example**:

```typescript
// plugins/blog/manifest.ts
export const manifest: Plugin = {
  id: '@linebasis/blog',
  name: 'Blog',
  version: '1.0.0',
  isCore: true, // Ships with Linabasis but can be disabled
  
  // Database models
  schema: './prisma/schema.prisma',
  
  // Blocks
  blocks: [
    {
      id: 'post-content',
      name: 'Post Content',
      category: 'blog',
      component: './blocks/PostContent.svelte',
      thumbnail: './assets/post-content.png',
      description: 'Renders blog post rich text content (use in blog templates)',
      
      properties: {
        // PostContent doesn't need user-editable properties
        // Content comes from Post model at runtime
      }
    },
    {
      id: 'post-meta',
      name: 'Post Metadata',
      category: 'blog',
      component: './blocks/PostMeta.svelte',
      
      properties: {
        showAuthor: { type: 'boolean', label: 'Show Author', default: true },
        showDate: { type: 'boolean', label: 'Show Date', default: true },
        showCategories: { type: 'boolean', label: 'Show Categories', default: true },
        dateFormat: { 
          type: 'select', 
          label: 'Date Format',
          options: ['short', 'long', 'relative'],
          default: 'short'
        }
      }
    }
  ],
  
  // Other plugin config (routes, admin pages, etc.)
  // ...
};
```

---

### Release Strategy

**Phase 1: Core (MVP)**
- Page builder (designer UI)
- 3 atomic components (Div, Text, Media)
- User-created blocks (from design selections)
- Publishing system (events → Svelte code)
- Authentication & teams

**Phase 2: Custom Blocks**
- Custom block system
- Local blocks support (`src/lib/components/blocks/`)
- Property schema system
- Auto-generated property UI
- Custom property editors
- Plugin block registration API

**Phase 3: Default Plugins**
- Blog plugin (@linebasis/blog)
  - PostContent block
  - PostMeta block
  - Blog admin UI
  - Post, Category, Tag models
- Forms plugin (@linebasis/forms)
  - FormBuilder block
  - Custom form editor UI
  - Form submission handling

**Benefits of Phased Approach**:
- ✅ Ship core faster (build in public, gather feedback)
- ✅ Validate architecture before adding complexity
- ✅ Blog/forms become examples of "how to build plugins"
- ✅ Users can build custom blocks even before Phase 3
- ✅ Core remains minimal and focused

---

## Summary: Custom Blocks

Custom blocks enable developers to extend Linabasis with coded Svelte components while maintaining the visual editing experience:

- **Two methods**: Manifest-based OR component-based metadata
- **Two locations**: Local (`/blocks/`) OR plugin (`plugins/*/blocks/`)
- **Auto-generated UI**: Property schema → automatic property editor
- **Custom UI**: Optional custom property editor for complex controls
- **Plugin support**: Blocks can be part of plugins for distribution
- **Phase 2 feature**: Coming after core page builder release

For complete development guide, see [custom-blocks.md](./custom-blocks.md) (Phase 2).

