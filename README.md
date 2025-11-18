# Linabasis

**A self-hosted visual website builder with professional design tools and modern technology.**

Design websites visually with real web components. Own your code, your data, your platform. No monthly fees. 100% open source.

---

## The Problem

After shipping successful products like TidyCal, SendFox, and BreezeDoc at AppSumo Originals, I kept hitting the same wall when building websites:

**WordPress?** Free and self-hosted, but Gutenberg is a nightmare. You build React blocks that convert to PHP. It breaks constantly.

**Visual builders (Webflow, Framer)?** Beautiful editors, but you're paying $15-30/month per site to rent your own website. The code isn't really yours. You can't customize the platform.

**Figma + code it yourself?** Figma components aren't real web components. Divs aren't divs. The design-to-code handoff adds unnecessary abstraction layers.

And here's what really bugs me: graphic designers figured out typography and layout 100 years ago. Baseline grids, vertical rhythm, proper alignment—these aren't new problems. But most web design tools ignore them.

## The Solution

Linabasis is the tool I wish existed:

✅ **Visual website builder** with polished, modern UX
✅ **Self-hosted and 100% open source** - Install once, use forever
✅ **Design with real web elements** - Divs are divs, components are components
✅ **Own everything** - Your code, your data, your platform
✅ **No monthly fees** - Pay once for hosting, that's it
✅ **Modern tech stack** - SvelteKit, TypeScript, Prisma
✅ **Baseline grid support** - Because typography matters

Build sites for friends, side projects, product landing pages—whatever you need. Customize it if you want. It's your platform.

---

## Key Features

### 🎨 Professional Page Builder
- **Illustrator-style interface**: Floating windows, infinite canvas, keyboard shortcuts
- **3 atomic components**: Div (layout), Text (typography), Media (images/videos)
- **Frames**: Multi-artboard canvas like Figma - design desktop, tablet, mobile in one view
- **Baseline grid**: InDesign-style typography alignment with snap-to-grid
- **Event sourcing**: Perfect undo/redo with complete design history
- **Local-first**: Design in browser with IndexedDB, auto-save every 30 seconds

### 🧩 Reusable Blocks
- **Convert designs to blocks**: Select elements → right-click → "Convert to Block"
- **Master-instance system**: Edit master block → updates all instances across all pages
- **Auto-detachment**: Edit an instance → automatically detaches for one-off customization
- **Push to master**: Like your changes? Push them back to the master block
- **Organized by source page**: Blocks grouped by the page where they were created

### 📐 Design System (Tokens)
- **Global tokens**: Colors, typography, spacing, effects
- **Typography presets**: Heading 1-6, Body, Caption, Small
- **Theme colors**: Primary, Secondary, Accent, Text, Muted
- **Baseline grid**: Configure grid unit (4-32px), snap elements to rhythm
- **One-click updates**: Change token → all components using it update

### 📝 Blog System (Plugin)
- **Design blog templates**: Create layouts in page builder for homepage, single post, archives
- **Notion-like editor**: Rich text with slash commands, inline formatting, media embeds
- **PostContent block**: Special block that renders blog post content in templates
- **Categories & Tags**: Organize posts with flexible taxonomy
- **SEO-ready**: Meta tags, social preview images, automatic sitemaps

### 🚀 Publishing & Export
- **Server-side rendering**: Published pages render as Svelte components with SSR
- **Responsive CSS**: Design breakpoints → generates mobile-first media queries
- **Static export**: Download pages as pure HTML/CSS .zip for hosting anywhere
- **Theme sharing**: Export/import entire sites (.baseline-theme files or API transfer)

### 👥 Multi-User & Permissions
- **Role-based access**: Owner, Manager, Designer, Editor
- **Team collaboration**: Invite members, assign roles, manage access
- **JWT authentication**: Secure login with refresh tokens
- **Per-resource permissions**: Fine-grained control over who can edit/publish/delete

### 🔌 Plugin Architecture
- **Extensible core**: Add features without touching core code
- **Database integration**: Plugins add Prisma models via schema composition
- **API routes**: Plugins register custom endpoints
- **Admin UI**: Plugins add pages to admin panel
- **Lifecycle hooks**: React to events (page publish, user create, etc.)

---

## Current Status

**🚀 Phase 1 Development - Milestone 5 Nearly Complete (47% Overall)**

Linabasis has made significant progress from design-focused planning to a working, professional-grade page builder.

### ✅ Completed (Nov 2024)

**Milestones 1-4 COMPLETE** (4/15 - 27%):
- ✅ **Milestone 1**: Foundation & Database - User auth, database schema, JWT
- ✅ **Milestone 2**: Media Library - Upload, storage, media management
- ✅ **Milestone 3**: Design System (Tokens) - Global design tokens, typography, spacing
- ✅ **Milestone 4**: Event Sourcing Foundation - Perfect undo/redo with IndexedDB persistence

**Milestone 5 NEARLY COMPLETE** (95% - 6% overall):
- ✅ **Canvas Component**: Infinite pan/zoom (0.1x-4x), baseline grid, artboard rendering
- ✅ **Drawing Tools**: Div, Text, Media tools with live preview during creation
- ✅ **Selection System**: Single selection, multi-selection box, Shift+click toggle
- ✅ **Transforms**: Drag, resize (8 handles), rotate (Figma-style with 15px zones), corner radius
- ✅ **Advanced Features** (beyond original scope):
  - Independent corner radius editing (Alt + drag)
  - Figma-style rotation with keyboard shortcuts (Cmd+[/])
  - Group transforms as atomic events
  - Multi-selection with "Mixed" value indicators
  - 30+ keyboard shortcuts (V, H, S, D, T, M tools + transforms)
  - Live preview system with pending transforms
  - All stored in IndexedDB with auto-save every 30s
- 🚧 **Frame Management UI**: Data model complete, UI controls remaining (5%)

**Code Statistics**:
- **5,903+ lines** of core store code (design-store, event-store, event-reducer)
- **1,000+ lines** in SelectionOverlay for complete interaction handling
- **10 React/Svelte components** for canvas UI
- **49 exported functions** in design-store API

### 🚧 In Progress (Milestone 6 - 40%)
- ✅ Toolbar (component buttons, tools, undo/redo, zoom)
- ✅ Properties window (background, border, opacity, radius with sync + independent modes)
- ❌ Layers window (UI not started, APIs exist)
- ❌ Blocks window (UI not started, APIs exist)
- ❌ Text editing (content & typography properties)
- ❌ Tokens window (not started)

### 📋 Roadmap: What's Next

**Priority 1 - Complete Milestone 5** (2-3 days):
- Frame name and width editing
- Frame drag/resize on canvas
- Frame deletion and duplication

**Priority 2 - Text System** (1 week):
- Inline text editing (double-click to edit)
- Typography properties (font, size, weight, color, alignment)

**Priority 3 - Layers Window** (1 week):
- Hierarchical tree view with collapse/expand
- Element visibility and lock toggles
- Drag to reorder (z-index changes)
- Rename via double-click

**Priority 4 - Publishing System** (2 weeks):
- Code generator (events → HTML/CSS)
- Publishing service and API
- Publish modal with SEO settings

**Priority 5 - Pages Management** (3-4 days):
- Create/edit/delete pages
- Pages list with search/filter
- Publish toggle per page

**See [roadmap.md](docs/planning/roadmap.md) for complete breakdown of all 15 milestones with status.**

### 🚀 Phased Release Strategy

**Phase 1: Core Page Builder (MVP)** - Build in Public ⬅️ **Currently 47% Complete**
- ✅ **Milestone 1-4**: Foundation, Media, Tokens, Event Sourcing
- 🚧 **Milestone 5**: Page Builder Canvas (95%)
- 🚧 **Milestone 6**: Page Builder UI (40%)
- ⏳ **Milestone 7-15**: Blocks, Snapping, Publishing, Pages, Team, Theme, Polish, Deploy

**Focus**: Ship core builder fast, validate architecture, gather feedback

**Phase 2: Custom Blocks** - Developer Extensibility
- 🔲 Custom block system (coded Svelte components)
- 🔲 Property schema (auto-generated UI)
- 🔲 Custom property editors
- 🔲 Local blocks (`/blocks/` folder)
- 🔲 Plugin block registration API

**Focus**: Enable developers to build coded blocks (carousels, animations, client-specific features)

**Phase 3: Plugin Ecosystem** - Community Growth
- 🔲 Blog plugin (@linebasis/blog - PostContent block, admin UI, Post/Category/Tag models)
- 🔲 Forms plugin (@linebasis/forms - FormBuilder block, submission handling)
- 🔲 Plugin marketplace
- 🔲 Plugin browser in admin
- 🔲 Community plugins

**Focus**: Blog/forms as example plugins, plugin marketplace, ecosystem

**Phase 4+: Advanced Features** - Long-term Vision
- 🔲 E-commerce plugin
- 🔲 Comments system
- 🔲 Multi-language support
- 🔲 Advanced analytics
- 🔲 A/B testing
- 🔲 Collaboration (multi-user editing)

**Benefits of Phased Approach**:
- ✅ Ship Phase 1 faster (build momentum, early feedback)
- ✅ Validate architecture before adding complexity
- ✅ Blog/forms become "how to build plugins" examples
- ✅ Developers can build custom blocks for client work
- ✅ Core stays minimal and focused

**Not accepting external contributions yet.** Will open contributions once Phase 1 is stable.

---

## Quick Start (For Developers)

**⚠️ Phase 1 in active development - page builder works, publishing system not yet implemented**

The page builder canvas is functional with professional-grade interactions. You can design pages, but cannot yet publish them (publishing is Priority 4).

### Prerequisites

- Node.js 18+
- npm or yarn
- SQLite (dev) or PostgreSQL (production)

### Installation

```bash
# Clone repository
git clone https://github.com/linebasis/linebasis.git
cd linebasis

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL (default: SQLite at prisma/dev.db) and JWT secret

# Setup database and create admin user
npm run setup

# Start development server
npm run dev
```

Visit `http://localhost:5173` to access the page builder.

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests once (CI mode)
npm run test:run

# Watch mode for type checking
npm run check:watch

# Open test UI
npm run test:ui
```

### Database Commands

```bash
# Compose schemas from core + plugins
npm run db:compose

# Create and apply migration
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Open Prisma Studio (database GUI)
npm run db:studio

# Complete setup (first time)
npm run setup
```

### Current Capabilities

**What Works:**
- ✅ Page builder canvas (pan, zoom, infinite scroll, baseline grid)
- ✅ Three drawing tools (Div, Text, Media) with live preview
- ✅ Transform tools (drag, resize, rotate with 15px zones, corner radius)
- ✅ Multi-selection with group transforms as atomic events
- ✅ Properties panel (background, border, opacity, independent corner radius)
- ✅ Undo/redo with perfect history and event replay
- ✅ 30+ keyboard shortcuts (Figma-style)
- ✅ Auto-save to IndexedDB every 30s
- ✅ User authentication (register, login, JWT)
- ✅ Media library (upload, storage, management)
- ✅ Design tokens (colors, typography, spacing)

**What Doesn't Work Yet (Next Priorities):**
- ❌ **Priority 1**: Frame management UI (remaining 5% of Milestone 5)
- ❌ **Priority 2**: Text content editing (inline edit + typography properties)
- ❌ **Priority 3**: Layers window (hierarchy tree view)
- ❌ **Priority 4**: Publishing system (code generation + SSR)
- ❌ **Priority 5**: Pages management (create, edit, delete, list)
- ❌ Blocks window (reusable components)

**See the [Roadmap: What's Next](#roadmap-whats-next) section above for detailed development priorities.**

---

## Technology Stack

**Core Framework:**
- **SvelteKit** - Full-stack framework (SSR, routing, API)
- **Svelte** - Reactive UI components
- **TypeScript** - Type safety (strict mode enabled)
- **Vite** - Build tool and dev server

**Database (Milestone 1):**
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Production database (recommended)
- **SQLite** - Development database

**Client-Side (Milestone 4):**
- **IndexedDB** - Local-first storage for design events
- **Event Sourcing** - Append-only event log with undo/redo

**Authentication (Milestone 1):**
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication

**Media (Milestone 2):**
- **Sharp** - Image optimization and processing

**Testing:**
- **Vitest** - Unit and integration tests
- **@testing-library/svelte** - Component testing

---

## Architecture Highlights

### Local-First Design
- Designer works entirely client-side (IndexedDB)
- Zero server latency during design
- Auto-save every 30 seconds
- Publish when ready → sends events to server

### Event Sourcing
- Every design action is an event
- Append-only event log
- Perfect undo/redo (time travel through history)
- Events replay to build current state

### Code Generation
- Design events → Component tree → AST → Svelte code
- Clean, semantic HTML output
- Mobile-first CSS with media queries
- SEO-friendly structure

### Plugin System
- Prisma schema composition (plugins add models)
- Dynamic route registration
- Lifecycle hooks
- Admin UI extensions

See **[architecture.md](docs/planning/architecture.md)** for complete technical details.

---

## Documentation

### Planning Docs (8,051 lines total)
- **[roadmap.md](docs/planning/roadmap.md)** - Phase 1 implementation roadmap (15 milestones, 721 lines)
- **[app.md](docs/planning/app.md)** - Application structure and routing (720 lines)
- **[page-builder-spec.md](docs/planning/page-builder-spec.md)** - Designer interface (1,196 lines)
- **[architecture.md](docs/planning/architecture.md)** - Technical architecture (3,426 lines)
- **[workflows.md](docs/planning/workflows.md)** - User workflows and journeys (1,321 lines)
- **[component-properties.md](docs/planning/components-properties.md)** - Component property specs (667 lines)
- **[custom-blocks.md](docs/planning/custom-blocks.md)** - Custom block developer guide (Phase 2)
- **[project-vision.md](docs/planning/project-vision.md)** - Why Linabasis exists

### Developer Docs
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines and project overview
- **[GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)** - Git workflow and best practices
- **[PLUGIN_DEVELOPMENT.md](docs/PLUGIN_DEVELOPMENT.md)** - Plugin development guide (Phase 3)

---

## Project Philosophy

This is a solo project by Ibaldo, built with deep focus on complex problems. I'm autistic, so I work best solo with sustained concentration. That's how Linux started. That's how Laravel started. And that's how I'm building this—one focused sprint at a time.

The goal isn't just to build another website builder. It's to create a tool that respects designers' expertise (baseline grids, typography), respects developers' needs (real code, modern stack), and respects users' freedom (self-hosted, open source, no lock-in).

It's ambitious. It's early. But after shipping multiple successful products, I know what it takes to build something people actually use.

---

## Contributing

**Not accepting external contributions at this time.**

Linabasis is in active early development with frequent architectural changes. External contributions would create coordination overhead that slows progress.

Once the core foundation is stable and well-tested, contributions will be welcome. Watch the repository for updates.

**Ways to help right now:**
- ⭐ Star the repository to show support
- 👀 Watch for release announcements
- 💬 Share feedback in Discussions (coming soon)
- 🐛 Report bugs in Issues (when alpha releases)

---

## License

MIT License - See [LICENSE](LICENSE) for details.

**You own everything you create with Linabasis.** The platform is yours to modify, extend, or fork.

---

## Contact

- **Author**: Ibaldo
- **Website**: [linebasis.org](https://linebasis.org)
- **Repository**: [github.com/linebasis/linebasis](https://github.com/linebasis/linebasis)

---

Built with focus, shipped with care.
