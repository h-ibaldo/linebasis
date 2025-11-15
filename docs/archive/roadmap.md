# Linabasis Development Roadmap

## Current Priority: Page Builder

**Architecture Shift**: Everything is built with the page builder (admin pages, blog pages, landing pages) except the page builder itself, which is designed by Ibaldo.

**Focus**: Build the page builder based on Ibaldo's designs before anything else.

---

## Immediate Next Steps

### Page Builder Implementation (Based on Ibaldo's Designs)
- [ ] Create page builder interface route (`/builder` or `/`)
- [ ] Implement toolbar (top)
- [ ] Implement left sidebar (pages/components panel)
- [ ] Implement right sidebar (properties panel)
- [ ] Implement canvas area with grid
- [ ] Implement multi-page canvas view
- [ ] Implement component drag-and-drop
- [ ] Integrate event sourcing for undo/redo
- [ ] Add keyboard shortcuts

**Reference**: See [docs/planning/page-design-specifications.md](docs/planning/page-design-specifications.md) for design specs.

---

## Completed Foundations ✅

### Core Infrastructure
- [x] Project setup with SvelteKit and TypeScript
- [x] Git repository and GitHub integration
- [x] Documentation structure
- [x] Testing framework setup (Vitest)

### DOM-Based Canvas ✅ **COMPLETED**
- [x] Infinite canvas with multiple artboards (Figma/Illustrator style)
- [x] Artboard component with per-artboard grid settings
- [x] Element component (box) using actual DOM elements
- [x] Drag-and-drop functionality with live coordinates
- [x] Selection state with visual feedback
- [x] Resize handles (4 corners with live dimensions)
- [x] Multi-select capability (Shift+click)
- [x] Real-time editing of live components
- [x] Performance monitoring (10 artboard limit with warning)

**Future Enhancements:**
- [ ] Click-and-drag selection box (marquee select)
- [ ] Group drag/resize for multiple selected elements
- [ ] Move elements between artboards
- [ ] Keyboard shortcuts (Delete, Arrow keys, etc.)
- [ ] Copy/paste functionality
- [ ] Alignment guides and snapping

### Baseline Grid System ✅ **COMPLETED**
- [x] Baseline grid calculation engine (7 core functions)
- [x] User-defined baseline height configuration (4-32px)
- [x] Visual grid overlay (toggleable, customizable color/opacity)
- [x] Global snap-to-baseline toggle
- [x] Per-component baseline override
- [x] Fractional spacing system (pixels ↔ baseline units conversion)
- [x] Real-time snapping during drag operations
- [x] Comprehensive test suite (10 tests passing)

**Future Enhancements:**
- [ ] Snap indicators with visual feedback
- [ ] Baseline alignment validation warnings
- [ ] Snap to baseline during resize operations
- [ ] Keyboard shortcuts for baseline adjustments

### State Management (Event Sourcing) ✅ **COMPLETED**
- [x] Event sourcing architecture implementation
- [x] Design event types (add, update, delete, move)
- [x] Event store with Svelte stores
- [x] Undo/redo functionality via event history
- [x] IndexedDB persistence layer
- [x] Event replay for state reconstruction

**Completed Features:**
- Event sourcing with 14+ event types
- Perfect undo/redo via event history navigation
- IndexedDB persistence with auto-save
- Project management (create, save, load, delete)
- Event replay for state reconstruction
- 40+ comprehensive tests
- Complete UI with ProjectManager component

**Future Enhancements:**
- [ ] Event compression for large histories
- [ ] Snapshots for faster replay
- [ ] Cloud sync (optional, future phase)

### Component Library Foundation ✅ **COMPLETED**
- [x] Basic component structure
- [x] Typography components (baseline-aware)
- [x] Layout components (container, grid, flex)
- [x] Form components (input, button, select)
- [x] TypeScript interfaces for all components
- [x] Component registry system
- [x] Interactive demo page
- [ ] Component property system (pending - needs visual inspector UI)

**Completed Features:**
- 9 baseline-aware design components
- Comprehensive type system with 20+ interfaces
- Component registry with metadata and defaults
- Typography: Heading, Paragraph, Text
- Layout: Container, Grid, Flex
- Forms: Button, Input, Select
- Demo page showcasing all components
- Full TypeScript type safety

**Future Enhancements:**
- [ ] Component property inspector UI
- [ ] More component types (Image, Video, Icon, etc.)
- [ ] Component variants and states
- [ ] Component composition tools

### AST-Based Code Generation ✅ **COMPLETED**
- [x] AST parser for design tree
- [x] HTML generation from AST
- [x] CSS generation with optimization
- [x] TypeScript type generation
- [x] Multiple output formats (HTML/CSS)
- [x] Export functionality (ZIP download)
- [x] Interactive code generation demo
- [ ] Web Worker for code generation (future optimization)
- [ ] Code preview panel (future enhancement)
- [ ] Svelte/React/Vue output formats (future)

**Completed Features:**
- Complete AST-based code generation pipeline
- Clean, semantic HTML5 output
- Optimized CSS with baseline grid support
- ZIP export with JSZip
- Export configuration UI
- Multiple export presets (Minimal, Standard, Optimized)
- Size estimation and validation
- README generation for exported projects
- 44 tests passing

**Future Enhancements:**
- [ ] Web Worker for non-blocking generation
- [ ] Live code preview panel in canvas
- [ ] Framework-specific output (Svelte, React, Vue)
- [ ] Advanced CSS optimization (tree-shaking)

---

## Phase 1.5: CMS Foundation (Months 3-4)

**Goal**: Enable self-hosted CMS mode for publishing pages directly

### Database Layer ✅ **COMPLETED**
- [x] SQLite integration (simple, file-based)
- [x] Database schema design (pages, media, users, settings)
- [x] Prisma ORM setup
- [x] Migration system
- [x] Database utilities and helpers

**Completed Features:**
- Complete Prisma schema with 6 models (Page, PageRevision, Media, User, Session, Setting)
- Database client with singleton pattern
- Page service with CRUD, publish/unpublish, revisions, search
- User service with bcrypt authentication and role-based permissions
- Media service with type filtering and storage quotas
- Settings service with type-safe value parsing
- Comprehensive indexes for performance
- All services fully typed with TypeScript

**Future Enhancements:**
- [ ] Database connection pooling for scale
- [ ] PostgreSQL support for larger installations
- [ ] Database query optimization
- [ ] Automated backup system

### Publishing System ✅ **COMPLETED**
- [x] Design → HTML/CSS generation pipeline
- [x] Page storage in database
- [x] URL routing system (SvelteKit dynamic routes)
- [x] SSR rendering for published pages
- [x] Publish/unpublish workflow
- [x] Draft vs published states

**Completed Features:**
- Complete publishing service with design-to-live-page workflow
- API endpoints for all page operations (CRUD + publish)
- SSR routes for published pages (/[slug])
- Preview functionality without publishing
- Bulk publishing support
- SEO metadata rendering (title, description, OG tags)
- Error handling and validation throughout
- Interactive publishing demo

**Future Enhancements:**
- [ ] Live preview during editing
- [ ] Scheduled publishing
- [ ] A/B testing for published pages
- [ ] Analytics integration

### Authentication & Users ✅ **COMPLETED**
- [x] JWT-based authentication
- [x] User registration/login
- [x] Password hashing (bcrypt)
- [x] Session management
- [x] Role-based access control (Admin, Editor, Author)
- [x] Auth middleware

**Completed Features:**
- Complete JWT authentication system with access tokens (7-day) and refresh tokens (30-day)
- 6 API endpoints: register, login, logout, refresh, me, logout-all
- bcrypt password hashing (10 rounds)
- Database session management with automatic cleanup
- Comprehensive auth middleware (requireAuth, requireRole, requireAdmin, requireEditor, requireOwnership)
- HTTP-only cookies for refresh tokens with CSRF protection

**Files Created:**
- `src/lib/server/services/auth.ts` - Auth service (~250 lines)
- `src/lib/server/middleware/auth.ts` - Auth middleware (~120 lines)
- `src/routes/api/auth/register/+server.ts`
- `src/routes/api/auth/login/+server.ts`
- `src/routes/api/auth/logout/+server.ts`
- `src/routes/api/auth/refresh/+server.ts`
- `src/routes/api/auth/me/+server.ts`

### Media Library (Basic) ✅ **COMPLETED**
- [x] File upload system
- [x] Media storage (filesystem)
- [x] Image optimization (resize, compress)
- [x] Media metadata (filename, size, type)
- [x] Media deletion

**Completed Features:**
- File upload with validation (type, size limits)
- Sharp-based image optimization (auto-resize > 2000px, quality optimization)
- Storage to `static/uploads/` with unique filenames
- Media metadata tracking (dimensions, size, mime type)
- Storage statistics per user
- Support for images (JPEG, PNG, GIF, WebP, SVG), PDFs, and videos

**Files Created:**
- `src/lib/server/services/upload.ts` - Upload service with optimization (~220 lines)
- `src/routes/api/media/upload/+server.ts`
- `src/routes/api/media/+server.ts`
- `src/routes/api/media/stats/+server.ts`

### Admin Panel (Basic) ✅ **COMPLETED**
- [x] Admin layout and navigation
- [x] Login/logout pages
- [x] Basic page manager (list, create, edit) - API ready, UI pending Phase 2
- [x] Basic media manager - API ready, UI pending Phase 2
- [x] User profile page - Pending Phase 2

**Completed Features:**
- Beautiful gradient login page with modern design
- Admin dashboard with statistics (pages, media, storage)
- User info display with role badges
- Quick action cards for common tasks
- Responsive layout
- Protected routes with automatic redirect
- Local storage auth state management

**Files Created:**
- `src/routes/admin/login/+page.svelte` - Login page (~170 lines)
- `src/routes/admin/+page.svelte` - Dashboard (~250 lines)

### API Layer ✅ **COMPLETED**
- [x] REST API structure
- [x] Pages endpoints (CRUD) - Protected with auth
- [x] Media endpoints (upload, delete)
- [x] Auth endpoints (login, logout, refresh)
- [x] Error handling and validation

**Completed Features:**
- All API endpoints protected with authentication middleware
- Comprehensive error handling and validation
- Proper HTTP status codes
- Role-based authorization checks
- Input validation on all endpoints

### Installation & Setup ✅ **COMPLETED**
- [x] Setup script (database, admin user)
- [x] Environment configuration
- [ ] Docker support - Pending Phase 2
- [x] Documentation for self-hosting

**Completed Features:**
- Automated setup script (`npm run setup`)
- Database migration and Prisma generation
- Admin user creation script (`scripts/setup-admin.ts`)
- Environment configuration (`.env`, `.env.example`)
- NPM scripts for common tasks
- Comprehensive documentation (Phase 1.5 complete guide, troubleshooting guide)

**Files Created:**
- `scripts/setup-admin.ts` - Admin creation script
- `.env` - Environment configuration
- `.env.example` - Example configuration
- `PHASE_1_5_COMPLETE.md` - Implementation guide
- `IMPLEMENTATION_SUMMARY.md` - Quick reference
- `TROUBLESHOOTING.md` - Debug guide
- `CLAUDE_CODE_GUIDELINES.md` - Guidelines for Claude Code sessions

---

## Phase 2: CMS Core Features (Months 5-7)

**Goal**: Complete CMS functionality for production use

**Service Test Coverage Added** - Unit test scaffolds created for core server services (auth, media, settings) with Prisma mocking. Tests demonstrate proper structure and cover happy paths + error cases. Requires refactoring to align with actual service exports.

### Admin Panel (Advanced)
- [x] Enhanced page manager (search, filter, bulk actions) ✅ **COMPLETED** - Basic UI complete
- [x] Enhanced media library (folders, tags, search) ✅ **COMPLETED** - Basic UI complete (grid/list view, search, filters, bulk delete, upload progress, storage quota). Advanced features (folders, tags) pending.
- [x] User management interface (CRUD users) ✅ **COMPLETED** - Full CRUD with role badges (admin=purple, editor=blue, author=green), status indicators, search/filter, suspend/activate, delete confirmation
- [x] Site settings page (SEO, general settings) ✅ **COMPLETED** - Multi-section form (General, SEO, Robots, Appearance) with validation, admin-only access
- [ ] Analytics dashboard (page views, popular pages)
- [ ] Activity log (audit trail)

### Content Management
- [x] Page templates system ✅ **COMPLETED** - Full template system with JSON storage, CRUD, admin UI, versioning, template application. Fixed: schema composition bug resolved, "Use Template" working. Advanced features (template marketplace) pending.
- [x] Reusable content blocks ✅ **COMPLETED** - Full block system with database, CRUD API, admin UI (list/create/edit/delete), categories, public/private sharing, usage tracking, version control, JSON editor. **Page editor integration complete**: BlockPanel component, BLOCK_INSERTED event sourcing, insertBlock() design action, canvas integration with undo/redo support.
- [x] Draft autosave ✅ **COMPLETED** - Automatic draft saving with debounced saves every 30s, visual status indicator (saving/unsaved/saved), last saved timestamp, non-blocking UX, draft loading on editor open, integration with event sourcing. Database: draftContent/lastSavedAt/hasUnsavedChanges fields. Service: drafts.ts with autosave/getDraft/clearDraft. API: /api/pages/[id]/autosave endpoints.

### 🚀 **ARCHITECTURAL PIVOT** - Component System (Replacing Content Blocks)
- [ ] **Component System** - Convert designs to reusable components (replaces content blocks)
  - [ ] Component creation from design selections
  - [ ] Component library with drag-and-drop
  - [ ] Component inheritance from style libraries
  - [ ] Master component editing (update all instances)
- [ ] **Unified Designer Interface** - Single interface for design, editing, and publishing
  - [ ] Multi-page canvas (see all pages at once)
  - [ ] Visual page management (add/remove/reorder)
  - [ ] Instant publishing workflow (Figma-style)
  - [ ] Page state indicators (draft/published)
- [ ] **Blog Template System** - Design blog templates with Notion-like editor
  - [ ] Mark pages as blog templates
  - [ ] Rich text component (Novel Svelte)
  - [ ] Blog content management
  - [ ] Publish as page OR blog template
- [ ] **Style Libraries** - Figma-style design system management
  - [ ] Color palettes and typography
  - [ ] Spacing and component styles
  - [ ] Library sharing and import/export
  - [ ] Global style updates
- [ ] **Theme Export System** - Professional theme sharing
  - [ ] JSON + Svelte component export
  - [ ] .baseline-theme ZIP format
  - [ ] Theme installation and management
  - [ ] Version control and sharing

### Legacy Content Management (To Be Replaced)
- [ ] Page revisions/version history
- [ ] Scheduled publishing
- [ ] Page duplication

### SEO & Performance
- [x] SEO metadata editor (title, description, OG tags) ✅ **COMPLETED** - Tabbed editor (Page, Open Graph, Twitter, Advanced) with live search preview, validation, schema markup
- [x] Sitemap generation (XML) ✅ **COMPLETED**
- [x] Robots.txt management ✅ **COMPLETED**
- [ ] Page caching system
- [ ] Image optimization and lazy loading
- [ ] Performance monitoring

**Sitemap Generation - COMPLETED:**
- Automatic XML sitemap at `/sitemap.xml`
- Includes all published pages and plugin content via hooks
- SEO-optimized with priority and changefreq
- Admin API to view sitemap statistics
- Configurable base URL via site settings
- Plugin hook system: `getSitemapEntries` allows plugins to contribute URLs
- Blog plugin integrated via hook (no core coupling)

**Robots.txt Management - COMPLETED:**
- Automatic robots.txt generation at `/robots.txt`
- Configurable via settings: allow/disallow paths, crawl delay
- Always includes sitemap reference for SEO
- Cached responses with ETag for performance
- Falls back gracefully on errors

### Advanced Features
- [ ] Multi-language support (i18n)
- [ ] Custom post types (blog posts, portfolio items)
- [ ] Taxonomies (categories, tags)
- [ ] Search functionality
- [ ] Navigation menu builder
- [ ] Form builder

### Developer Tools
- [ ] Keyboard shortcuts system
- [ ] Advanced AST optimization
- [ ] Multiple framework outputs (React, Vue, Svelte)
- [ ] Code style customization
- [ ] Semantic HTML generation
- [ ] CSS optimization (deduplication, minification)
- [ ] Accessibility attributes generation

### Designer Experience
- [ ] Advanced component library (50+ components)
- [ ] Typography system with advanced baseline features
- [ ] Color palette and theme management
- [ ] Responsive design tools (breakpoints)
- [ ] Layout constraints and auto-layout
- [ ] Component variants and states
- [ ] Design templates and presets
- [ ] Command palette

## Phase 3: WordPress Parity & Ecosystem (Months 8-12)

**Goal**: Feature parity with WordPress + modern advantages

### Blog System
- [ ] Blog post type with rich editor
- [ ] Categories and tags
- [ ] Author pages
- [ ] Archive pages (by date, category, tag)
- [ ] RSS/Atom feeds
- [ ] Comments system (optional)
- [ ] Related posts

### E-commerce Foundation (Optional)
- [ ] Product custom post type
- [ ] Shopping cart
- [ ] Payment integration (Stripe, PayPal)
- [ ] Order management
- [ ] Inventory tracking
- [ ] Shipping calculator

### Plugin System
- [ ] Plugin architecture (trusted plugins only initially)
- [ ] Plugin API and hooks
- [ ] Plugin sandboxing (Web Workers/iframes)
- [ ] Plugin marketplace (when contributions open)
- [ ] Official plugins (analytics, SEO, forms, etc.)
- [ ] Third-party integrations

### Theme System
- [ ] Theme structure and API
- [ ] Theme templates
- [ ] Theme customizer
- [ ] Theme marketplace
- [ ] Default themes (5+ professional themes)

### Migration Tools
- [ ] WordPress import plugin
- [ ] Figma import (basic)
- [ ] HTML/CSS import
- [ ] Export to static site
- [ ] Backup and restore

### Advanced Designer Features
- [ ] Animation system (CSS animations, transitions)
- [ ] Advanced layout tools (absolute positioning, z-index)
- [ ] Custom component creation
- [ ] Design system management
- [ ] Accessibility tools and validation
- [ ] Component documentation generation

### Developer Experience
- [ ] Comprehensive API documentation
- [ ] Developer SDK
- [ ] CLI tools
- [ ] Custom export templates
- [ ] Webhooks
- [ ] REST API extensions

## Phase 4: Cloud Sync & Collaboration (Months 13-18)

**Note**: Cloud features are optional. Baseline works fully offline and self-hosted.

### Cloud Sync (Optional)
- [ ] Event-based sync protocol
- [ ] CRDT implementation for conflict resolution
- [ ] Cloud storage option (alternative to self-hosting)
- [ ] Multi-device sync
- [ ] Automatic cloud backups

### Real-time Collaboration (Optional)
- [ ] Multi-user editing
- [ ] Live cursors and selections
- [ ] Commenting system
- [ ] Activity feed
- [ ] Conflict resolution
- [ ] Version history (cloud-based)

## Phase 5: Scale & Ecosystem (Months 13-18)

### Performance at Scale
- [ ] Virtual canvas (100+ components)
- [ ] Layer culling
- [ ] Incremental rendering
- [ ] Web Workers for heavy operations
- [ ] Performance optimization based on metrics

### Advanced Features
- [ ] Mobile app (PWA)
- [ ] Desktop application (Tauri/Electron)
- [ ] Browser extensions
- [ ] Advanced export options
- [ ] Integration APIs

### Community (When Contributions Open)
- [ ] Open external contributions
- [ ] Community forum
- [ ] Tutorial system
- [ ] Design showcase
- [ ] Contributor guidelines refinement

## Long-term Vision (Years 2-5)

### Technology Evolution
- [ ] AI-powered design assistance
- [ ] Natural language to design
- [ ] Advanced automation
- [ ] Machine learning for optimization
- [ ] WebAssembly for performance

### Market Leadership
- [ ] Industry partnerships
- [ ] Educational programs
- [ ] Design community building
- [ ] Conference presence
- [ ] Thought leadership

### Global Impact
- [ ] Internationalization (i18n)
- [ ] Advanced accessibility features
- [ ] Open source ecosystem growth
- [ ] Social impact initiatives

## Success Metrics

### Phase 1-2 (Months 1-6)
- Working MVP with core features
- 100+ GitHub stars
- Basic design tool functionality
- Positive user feedback from early adopters

### Phase 3-4 (Months 7-12)
- 1,000+ active users
- 1,000+ GitHub stars
- Full local-first functionality
- Optional cloud sync working

### Phase 5+ (Months 13+)
- 10,000+ active users
- 5,000+ GitHub stars
- Open to external contributions
- Market recognition

## Current Status

### Completed ✅
- [x] Project initialization
- [x] SvelteKit + TypeScript setup
- [x] Git repository and GitHub
- [x] Documentation structure
- [x] Architecture documentation
- [x] Cursor AI guidelines
- [x] Contributing guidelines
- [x] Project vision document

### In Progress 🚧
- [ ] Development environment setup
- [ ] Testing framework
- [ ] Core canvas implementation

### Next Immediate Steps (Week 1-2)

1. **Development Environment**
   - Set up Vitest for testing
   - Configure ESLint and Prettier
   - Set up development workflow

2. **Core Canvas Component**
   - Create basic DOM-based canvas
   - Implement element selection
   - Basic drag-and-drop

3. **Baseline Grid Foundation**
   - Implement baseline calculation utilities
   - Create visual grid overlay
   - Basic snap-to-baseline functionality

4. **State Management**
   - Set up event sourcing structure
   - Implement basic event types
   - IndexedDB wrapper

## Dependencies & Risks

### Technical Dependencies
- SvelteKit stability (mature)
- Browser IndexedDB support (excellent)
- Web Workers support (excellent)
- Modern browser features (CSS Grid, Flexbox)

### Risks & Mitigation

**Performance Risks**
- Risk: Large designs may be slow
- Mitigation: Architected for virtual canvas, performance monitoring

**Complexity Risks**
- Risk: Event sourcing adds complexity
- Mitigation: Start simple, iterate based on needs

**Adoption Risks**
- Risk: Users prefer familiar tools
- Mitigation: Focus on unique value (baseline grid, code ownership)

**Technical Risks**
- Risk: DOM-based approach may have limitations
- Mitigation: Prototype early, validate approach

## Milestone Tracking

### Month 1
- [ ] Development environment complete
- [ ] Basic canvas working
- [ ] Element selection working
- [ ] Basic baseline grid visible

### Month 2
- [ ] Drag-and-drop working
- [ ] Event sourcing implemented
- [ ] Undo/redo working
- [ ] IndexedDB persistence

### Month 3
- [ ] Basic components library
- [ ] Code generation working
- [ ] Export functionality
- [ ] MVP feature-complete

### Month 4-6
- [ ] Advanced components
- [ ] Multiple output formats
- [ ] Responsive design tools
- [ ] Polish and refinement

---

**Note**: This roadmap is flexible and will be adjusted based on user feedback, technical discoveries, and market conditions. The focus is on building a solid foundation before adding advanced features.