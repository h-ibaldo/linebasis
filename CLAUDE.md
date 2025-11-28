# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Linabasis** is an open-source design and CMS platform to replace WordPress, Figma (for web), and Webflow.

**Architecture**: All app pages are built using the page builder itself. The only exception is the page builder interface, which is designed externally by Ibaldo.

**Tech Stack**: SvelteKit, TypeScript (strict mode), Prisma ORM, SQLite/PostgreSQL, Vitest

**Current Priority**: Building the page builder based on Ibaldo's designs. Everything else depends on this foundation.

**See**: [docs/planning/page-builder-spec.md](docs/planning/page-builder-spec.md) for page builder specification.

**Status**: Early development - NOT accepting external contributions yet.

---

## ⚠️ CRITICAL ARCHITECTURAL PRINCIPLE

**LAYERS ARE DOM POSITION, NOT Z-INDEX**

This is the single most important principle in the page builder architecture:

- **Layers represent DOM structure** - The layer order IS the HTML render order
- **NEVER use z-index for layer ordering** - Z-index is only for CSS stacking context
- **Root elements MUST have a view** - No view = no DOM array = cannot exist
- **Nested elements MUST have a parent** - Stored in parent.children[] array
- **Reordering = array manipulation** - splice(), not z-index changes

**If you're working on anything layer-related, READ [docs/planning/LAYERS-ARCHITECTURE.md](docs/planning/LAYERS-ARCHITECTURE.md) FIRST.**

Violating this principle breaks the fundamental contract with users about what they're building. Users must see and understand the actual DOM tree they're creating.

---

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Development server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Open Vitest UI
npm run test:ui
```

### Type Checking
```bash
# Run type check
npm run check

# Watch mode
npm run check:watch
```

### Database Management

**IMPORTANT**: Linabasis uses a **plugin-based schema composition system**. The main schema is split into:
- `prisma/schema.core.prisma` - Core CMS models
- `plugins/*/prisma/schema.prisma` - Plugin-specific models

**Always use `npm run db:compose` before migrations** to merge schemas:

```bash
# Compose schemas from core + plugins
npm run db:compose

# Check schema composition without writing
npm run db:compose:check

# Create and apply migration
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Open Prisma Studio
npm run db:studio

# Complete setup (first time)
npm run setup
```

### Plugin Management
```bash
# Migrate blog posts to plugin system
npm run migrate:plugins

# Dry-run migration (check without applying)
npm run migrate:plugins:check
```

---

## Architecture Overview

### Page Builder-First Architecture

**Everything is built in the page builder** - admin pages, blog pages, landing pages - except the page builder itself.

**Page Builder** (designed in Figma):
- DOM-based canvas with actual web components
- Event sourcing for undo/redo
- Local-first using IndexedDB
- Multi-page canvas (Figma-style)
- Component system with reusable elements
- Export to production code

**CMS Backend**:
- SvelteKit + TypeScript
- JWT authentication
- Prisma ORM (SQLite/PostgreSQL)
- Media management with Sharp
- Plugin architecture

### Core Systems

#### 1. Page Builder (Priority)
- DOM-based canvas with multi-page support
- Event sourcing for undo/redo
- Component system (convert designs to reusable components)
- Baseline grid for typography alignment
- IndexedDB persistence with auto-save
- Code generation (HTML/CSS/Svelte)

**Key files**: `src/lib/stores/event-store.ts`, `src/lib/stores/design-store.ts`

#### 2. Plugin System
Plugins add database models, API routes, and admin pages without touching core code.

**Plugin Development**:
1. Create `plugins/[name]/` with `manifest.ts`
2. Add `prisma/schema.prisma` for models
3. Run `npm run db:compose` to merge schemas
4. Add API routes and admin pages

**Key files**: `src/lib/core/plugins/`, `scripts/build-schema.ts`

#### 3. Authentication
JWT-based auth with role-based access (admin/editor/author).

**Key files**: `src/lib/server/services/auth.ts`, `src/lib/server/middleware/auth.ts`

#### 4. Media Management
File upload with Sharp image optimization to `static/uploads/`.

**Key files**: `src/lib/server/services/upload.ts`, `src/lib/server/services/media.ts`

### Project Structure

```
src/
├── routes/
│   ├── +page.svelte          # Page builder interface
│   ├── [slug]/               # Published pages
│   ├── admin/                # Admin pages (built with page builder)
│   └── api/                  # API endpoints
├── lib/
│   ├── components/           # UI components
│   ├── stores/               # Svelte stores (event-store, design-store)
│   ├── utils/                # Utilities (baseline, ast, export)
│   ├── core/plugins/         # Plugin system
│   └── server/               # Server-side (services, middleware)

prisma/
├── schema.core.prisma        # Core models
└── schema.prisma             # Generated (composed from core + plugins)

plugins/
└── blog/                     # Example plugin

docs/
└── planning/                 # Roadmap, architecture
```

---

## Database Schema (Core)

**Models**:
- `Page` - Published pages with design events, HTML/CSS output, SEO metadata
- `PageRevision` - Version history with event snapshots
- `Media` - Uploaded files with metadata
- `User` - Authentication with roles (admin/editor/author)
- `Session` - JWT refresh tokens
- `Setting` - Global configuration
- `Plugin` - Installed plugins registry

**Relations**:
- Page → User (author)
- Page → PageRevision[] (versions)
- Media → User (uploader)
- User → Session[] (active sessions)
- Plugin: Self-contained (no relations)

**Plugin Models** (via composition):
- Blog plugin adds: `Post`, `Category`, `Tag`
- Future plugins add their own models

---

## Git Workflow (MANDATORY)

### Branch Strategy
**ALWAYS create a feature branch for roadmap tasks**:

```bash
# Create branch before starting
git checkout -b feat/task-name

# Branch naming conventions:
feat/cms-authentication    # New features
feat/media-upload
feat/blog-system
fix/baseline-snap-bug      # Bug fixes
docs/update-readme         # Documentation
```

**NEVER work directly on main branch for roadmap tasks!**

### Workflow Steps
1. Create feature branch: `git checkout -b feat/task-name`
2. Implement with proper TypeScript types and error handling
3. Write/update tests - **ALL tests must pass**
4. **Update documentation BEFORE merging**:
   - Mark tasks complete in `docs/planning/roadmap.md`
   - Add features to `README.md`
   - Update `docs/planning/architecture.md` if needed
5. Commit with proper message format (see below)
6. Merge to main: `git checkout main && git merge feat/task-name`
7. Push: `git push origin main`
8. Delete branch: `git branch -d feat/task-name`

### Commit Message Format
```
type(scope): short description

[optional body with details]

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Example**:
```
feat(blog): implement blog plugin with posts and categories

- Add Post, Category, Tag models to plugin schema
- Create blog API endpoints with CRUD operations
- Add admin pages for blog management
- Implement SEO metadata for posts
- Add pagination and filtering

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Code Quality Standards

### TypeScript
- **Strict mode enabled** - No `any` types
- Define types for all functions and variables
- Use `unknown` instead of `any` when type is truly unknown
- Leverage path aliases: `$lib/*` for imports

### Error Handling
- **Always use try-catch** for async operations
- Validate all user inputs
- Return proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Include error messages in API responses

### Testing
- Write tests for all utility functions
- Test complex business logic in services
- Use Vitest with jsdom environment
- Run `npm run test:run` before committing

**Test files**: Co-locate with source (e.g., `baseline.ts` → `baseline.test.ts`)

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `auth-service.ts`)
- **Components**: `PascalCase.svelte` (e.g., `UserProfile.svelte`)
- **Functions**: `camelCase()` (e.g., `getUserData()`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Types/Interfaces**: `PascalCase` (e.g., `UserData`)

### Documentation
- JSDoc comments for public APIs
- Inline comments for complex logic
- Update `docs/` before merging to main

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create route file: `src/routes/api/[resource]/+server.ts`
2. Import services and middleware:
   ```typescript
   import { json } from '@sveltejs/kit';
   import { requireAuth } from '$lib/server/middleware/auth';
   import { someService } from '$lib/server/services/some-service';
   ```
3. Export handler with auth:
   ```typescript
   export const GET = requireAuth(async ({ locals }) => {
     const data = await someService.getAll();
     return json(data);
   });
   ```
4. Add error handling and validation

### Creating a New Service

1. Create file: `src/lib/server/services/[name].ts`
2. Import Prisma client: `import { db } from '$lib/server/db/client';`
3. Export service functions:
   ```typescript
   export const myService = {
     async create(data: CreateData) {
       // Validation
       // Database operation
       // Return result
     }
   };
   ```
4. Write tests: `[name].test.ts`

### Adding a New Plugin

1. Create directory: `plugins/[plugin-name]/`
2. Create `manifest.ts`:
   ```typescript
   import type { Plugin } from '$lib/core/plugins/types';

   export const manifest: Plugin = {
     id: '@linebasis/plugin-name',
     name: 'Plugin Name',
     version: '1.0.0',
     // ... routes, pages, hooks
   };
   ```
3. Add `prisma/schema.prisma` for models
4. Run `npm run db:compose` to merge schemas
5. Run `npm run db:migrate` to apply changes
6. Add API routes in `server/routes/`
7. Add admin pages in `admin/`

### Running Tests for Specific File

```bash
# Single file
npm test -- src/lib/utils/baseline.test.ts

# Watch mode for file
npm test -- src/lib/utils/baseline.test.ts --watch

# Pattern matching
npm test -- baseline
```

### Database Schema Changes

**CRITICAL**: Always compose schemas before migrations!

```bash
# 1. Edit schema.core.prisma OR plugin schema
# 2. Compose schemas
npm run db:compose

# 3. Create migration
npm run db:migrate

# 4. Generate Prisma client
npm run db:generate
```

---

## Key Patterns

### Event Sourcing
Dispatch events, don't mutate state:
```typescript
dispatch({ type: 'MOVE_ELEMENT', elementId: id, position: { x, y } });
```

### Auth Middleware
```typescript
export const GET = requireAuth(async ({ locals }) => { /* locals.user available */ });
export const DELETE = requireAdmin(async ({ locals }) => { /* admin only */ });
```

---

## Environment Configuration

### Required Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL="file:./dev.db"  # SQLite for local dev
# DATABASE_URL="postgresql://user:pass@localhost:5432/linebasis"  # PostgreSQL for production

# JWT Secret (generate secure random string)
JWT_SECRET="your-secure-random-string-here"

# Optional
NODE_ENV="development"
```

### First-Time Setup

```bash
# Install dependencies
npm install

# Setup database and create admin user
npm run setup

# Follow prompts to create admin account
# Default: admin@linebasis.com / admin123

# Start development server
npm run dev

# Visit http://localhost:5173/admin/login
```

---

## Testing Strategy

### What to Test
✅ **Always test**:
- Utility functions (baseline calculations, AST generation)
- Business logic in services
- Event reducers and state management

⏳ **Future**:
- API endpoint integration tests
- E2E tests for user workflows

❌ **Don't test**:
- Simple Svelte components (visual testing preferred)
- Third-party library wrappers
- Database queries (covered by service tests)

### Test File Location
Co-locate tests with source files:
```
src/lib/utils/
├── baseline.ts
└── baseline.test.ts
```

---

## Resources

- [docs/planning/page-builder-spec.md](docs/planning/page-builder-spec.md) - Page builder specification (START HERE)
- [docs/planning/page-design-specifications.md](docs/planning/page-design-specifications.md) - Detailed page specs
- [docs/planning/roadmap.md](docs/planning/roadmap.md) - Development roadmap

---

**Current Phase**: Page Builder Development
**Remember**: Everything is built with the page builder except the page builder itself!
