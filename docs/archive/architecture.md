# System Architecture

## Overview

Linabasis is a page builder-first CMS where **everything is built using the page builder** (admin pages, blog pages, landing pages) except the page builder itself, which is designed by Ibaldo.

## Technology Stack

### Frontend
- **Framework**: SvelteKit
- **Language**: TypeScript
- **Styling**: CSS with CSS Variables
- **Build Tool**: Vite
- **Package Manager**: npm

### Backend
- **Runtime**: Node.js (via SvelteKit adapter-node)
- **Database**: SQLite or PostgreSQL (via Prisma ORM)
- **Storage**: Database + `static/uploads/` for media
- **Authentication**: JWT-based with role-based access
- **Media Management**: File upload with Sharp optimization
- **Publishing**: Pages designed in builder → live on site
- **Plugin System**: Extensible via plugins

### Development Tools
- **Version Control**: Git
- **Testing**: Vitest
- **Documentation**: Markdown

## Project Structure

```
src/
├── routes/
│   ├── builder/              # Page builder interface (PRIORITY)
│   ├── [slug]/               # Published pages
│   ├── admin/                # Admin pages (built with builder)
│   └── api/                  # API endpoints
├── lib/
│   ├── components/builder/   # Builder UI components
│   ├── stores/               # Event sourcing, design state
│   ├── utils/                # Baseline, AST, export
│   ├── core/plugins/         # Plugin system
│   └── server/               # Auth, media, services

prisma/
├── schema.core.prisma        # Core models
└── schema.prisma             # Composed schema

plugins/
└── blog/                     # Example plugin

docs/planning/
├── page-builder-spec.md      # START HERE
├── page-design-specifications.md
└── roadmap.md
```

## Core Systems

### 1. Page Builder (Priority)
Single interface for designing and building all pages. See [page-builder-spec.md](page-builder-spec.md).

**Features**: Multi-page canvas, component system, baseline grid, event sourcing, instant publishing

**Files**: `src/routes/builder/`, `src/lib/components/builder/`, `src/lib/stores/`

### 2. Code Generator
AST-based code generation for exporting designs to production code.

**Features**: HTML/CSS/Svelte output, semantic markup, optimized CSS

**Files**: `src/lib/utils/ast.ts`, `src/lib/utils/export.ts`

### 3. Theme Export System
Export designs as `.baseline-theme` files (ZIP with JSON + Svelte components).

**Use Case**: Share themes like WordPress themes, professional client delivery

### 4. Baseline Grid System
InDesign-style typography alignment system for precise layouts.

**Files**: `src/lib/utils/baseline.ts`, `src/lib/stores/baseline.ts`

### 5. Authentication System
JWT-based auth with role-based access control (admin/editor/author).

**Features**: User registration, login, password hashing (bcrypt), refresh tokens, session management

**Files**: `src/lib/server/services/auth.ts`, `src/lib/server/middleware/auth.ts`

### 6. Media Management
File upload with Sharp image optimization to `static/uploads/`.

**Features**: Image optimization, metadata tracking, support for images/PDFs/videos

**Files**: `src/lib/server/services/upload.ts`, `src/lib/server/services/media.ts`

### 7. Admin Panel
Web interface for CMS management (built with page builder eventually).

**Current**: Login, dashboard, page manager, media library, user management

**Files**: `src/routes/admin/`

### 8. Plugin System
Extensible architecture allowing plugins to add database models, API routes, and pages.

**Features**: Schema composition, lifecycle hooks, plugin registry

**Files**: `src/lib/core/plugins/`, `scripts/build-schema.ts`

## Event Sourcing

All design changes are captured as events for perfect undo/redo:

```typescript
dispatch({ type: 'MOVE_ELEMENT', elementId: id, position: { x, y } });
```

State is derived from events via reducer. Events stored in IndexedDB with auto-save.

**Files**: `src/lib/stores/event-store.ts`, `src/lib/stores/design-store.ts`

## Database Schema

See `prisma/schema.core.prisma` for core models:
- **Page**: Published pages with design events and HTML/CSS output
- **PageRevision**: Version history
- **Media**: Uploaded files with metadata
- **User**: Authentication with roles
- **Session**: JWT refresh tokens
- **Setting**: Global configuration
- **Plugin**: Installed plugins registry

Plugins can add their own models via schema composition.

---

**For detailed specs, see**:
- [page-builder-spec.md](page-builder-spec.md) - Page builder specification
- [page-design-specifications.md](page-design-specifications.md) - Page design specs
- [roadmap.md](roadmap.md) - Development roadmap
