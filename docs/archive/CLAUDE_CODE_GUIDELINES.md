# Claude Code Guidelines for Linabasis

> **IMPORTANT**: Read this file at the start of EVERY Claude Code session before making any changes!

This document ensures Claude Code follows Linabasis project rules from `.cursorrules` consistently.

---

## 🎯 COMMIT POLICY (MANDATORY)

### **Phase Completion Commit Strategy**

**RULE**: Every phase completion MUST have a commit and push to preserve stable checkpoints.

**Best Practice - Feature Commits + Phase Milestone**:

```
During Phase (feat branch):
├── feat(auth): add JWT authentication          [commit 1]
├── feat(media): implement file upload          [commit 2]
├── feat(admin): create admin panel             [commit 3]
├── chore(setup): add database setup            [commit 4]
├── docs: update documentation                  [commit 5]

Phase Complete:
└── docs: phase 1.5 complete [MILESTONE]        [commit 6]
    - Merge feat branch to main
    - Push to remote
    - Tag release (optional): v0.1.5
```

**Why this approach?**
- ✅ Fine-grained history (can bisect bugs)
- ✅ Each feature independently trackable
- ✅ Clear phase milestones in git history
- ✅ Easy rollback to stable checkpoints
- ✅ Better collaboration (pull stable phases)

**Mandatory Actions at Phase Completion:**
1. ✅ All features committed with proper messages
2. ✅ Documentation updated (roadmap, README, architecture)
3. ✅ Final milestone commit: `docs: phase X complete [MILESTONE]`
4. ✅ Push to remote: `git push origin main`
5. ✅ Optional: Tag release `git tag v0.X.0 && git push --tags`

---

## 🔴 MANDATORY WORKFLOW FOR ROADMAP TASKS

### Before Starting ANY Roadmap Task:

```bash
# 1. Check current branch
git branch

# 2. Create feature branch (REQUIRED!)
git checkout -b feat/task-name

# Example branch names:
# feat/cms-authentication
# feat/media-upload
# feat/admin-panel
# feat/page-manager-ui
# fix/baseline-snap-bug
```

### During Implementation:

1. ✅ **Write code** with proper TypeScript types
2. ✅ **Add error handling** and validation
3. ✅ **Write/update tests** for new functionality
4. ✅ **Follow naming conventions**:
   - Files: `kebab-case.ts`
   - Components: `PascalCase.svelte`
   - Functions: `camelCase()`
   - Types: `PascalCase`
   - Constants: `UPPER_SNAKE_CASE`

### After Implementation (BEFORE MERGING):

1. ✅ **Run tests**: `npm run test:run` - ALL must pass
2. ✅ **Update roadmap**: Mark tasks complete in `docs/planning/roadmap.md`
3. ✅ **Update README**: Add new features to `README.md`
4. ✅ **Update architecture**: If needed, update `docs/planning/architecture.md`
5. ✅ **Create proper commits** (see format below)
6. ✅ **Merge to main**: `git checkout main && git merge feat/task-name`
7. ✅ **Push to main**: `git push origin main`
8. ✅ **Delete branch**: `git branch -d feat/task-name`

---

## 📝 Commit Message Format

**Format**:
```
type(scope): short description

Optional body with more details.
Can mention AI assistance and technical decisions.

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples**:

```
feat(auth): add JWT authentication system

- User registration and login endpoints
- JWT token generation and validation
- bcrypt password hashing
- Session management in database
- Role-based access control middleware

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
feat(media): implement file upload with optimization

- File upload API with validation
- Sharp-based image optimization
- Auto-resize and quality compression
- Storage statistics tracking
- Support for images, PDFs, videos

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
feat(admin): create admin panel interface

- Login page with gradient design
- Admin dashboard with statistics
- Protected routes with auth checks
- User info display with roles

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📚 Documentation Update Checklist

### `docs/planning/roadmap.md`

Mark tasks as complete:

```markdown
### Phase 1.5: CMS Foundation (Months 3-4)

#### Authentication & Users ✅ **COMPLETED**
- [x] JWT-based authentication
- [x] User registration/login
- [x] Password hashing (bcrypt)
- [x] Session management
- [x] Role-based access control (Admin, Editor, Author)
- [x] Auth middleware

**Completed Features:**
- Complete JWT authentication system
- 6 API endpoints (register, login, logout, refresh, me)
- bcrypt password hashing (10 rounds)
- Session management with 30-day refresh tokens
- Role-based middleware (requireAuth, requireAdmin, requireEditor)
```

### `README.md`

Update current status and features:

```markdown
### Current Status

**✅ Phase 1.5 - CMS Foundation (COMPLETED):**
- ✅ **Authentication & JWT** - User auth, sessions, role-based access
- ✅ **Media Upload** - File upload with image optimization
- ✅ **Admin Panel** - Beautiful admin interface

**Features:**
- User authentication with JWT tokens
- File upload with automatic image optimization
- Admin panel with login and dashboard
```

### `docs/planning/architecture.md`

Add new components/services:

```markdown
### Authentication Service
- JWT token generation and validation
- Password hashing with bcrypt
- Session management
- Role-based access control

**Files:**
- `src/lib/server/services/auth.ts`
- `src/lib/server/middleware/auth.ts`
```

---

## 🎯 Code Quality Checklist

Before committing, verify:

- [ ] ✅ All TypeScript files have proper types (no `any`)
- [ ] ✅ Error handling in place (try-catch, validation)
- [ ] ✅ JSDoc comments on public functions
- [ ] ✅ Tests written and passing (`npm run test:run`)
- [ ] ✅ No console.log() in production code
- [ ] ✅ Proper HTTP status codes in API responses
- [ ] ✅ Input validation on all user inputs
- [ ] ✅ Security best practices (password hashing, JWT, etc.)

---

## 🔐 Security Checklist

For auth/security features:

- [ ] ✅ Passwords hashed with bcrypt (10+ rounds)
- [ ] ✅ JWT tokens signed with secure secret
- [ ] ✅ Refresh tokens in HTTP-only cookies
- [ ] ✅ Input validation and sanitization
- [ ] ✅ Rate limiting considered (future)
- [ ] ✅ SQL injection prevention (Prisma handles this)
- [ ] ✅ XSS prevention (framework handles this)

---

## 🧪 Testing Requirements

### Test Categories:

1. **Unit Tests**: For utilities, pure functions
2. **Integration Tests**: For API endpoints
3. **E2E Tests** (future): For user workflows

### When to Write Tests:

- ✅ **ALWAYS**: Utility functions (`baseline.ts`, `event-reducer.ts`)
- ✅ **RECOMMENDED**: Service functions (`auth.ts`, `upload.ts`)
- ⏳ **FUTURE**: API endpoint integration tests
- ⏳ **FUTURE**: E2E tests for user flows

### Test Commands:

```bash
npm run test        # Watch mode
npm run test:run    # Run once
npm run test:ui     # Visual UI
```

---

## 📁 File Organization Rules

### Naming & Location:

```
src/lib/server/
├── services/           # Business logic
│   ├── auth.ts         # Authentication service
│   ├── upload.ts       # File upload service
│   └── pages.ts        # Page service
├── middleware/         # Express-style middleware
│   └── auth.ts         # Auth middleware
└── db/
    └── client.ts       # Database client

src/routes/api/
├── auth/              # Auth endpoints
│   ├── login/+server.ts
│   └── register/+server.ts
├── media/             # Media endpoints
│   └── upload/+server.ts
└── pages/             # Page endpoints
    └── +server.ts
```

### Import Aliases:

```typescript
import { auth } from '$lib/server/services/auth';  // ✅ Good
import { auth } from '../../../lib/server/...';     // ❌ Bad
```

---

## 🚀 Starting a New Task - Step-by-Step

### Example: Adding a new "Blog System" feature

**Step 1: Create Branch**
```bash
git checkout main
git pull origin main
git checkout -b feat/blog-system
```

**Step 2: Plan Implementation**
```markdown
# Blog System Implementation Plan

## Files to Create:
- src/lib/server/services/blog.ts
- src/routes/api/blog/+server.ts
- src/routes/api/blog/[slug]/+server.ts

## Files to Update:
- prisma/schema.prisma (add Post model)
- docs/planning/roadmap.md
- README.md

## Tests:
- src/lib/server/services/blog.test.ts
```

**Step 3: Implement**
- Write code with proper types
- Add error handling
- Follow naming conventions

**Step 4: Test**
```bash
npm run test:run  # All tests must pass
```

**Step 5: Document**
- Update `roadmap.md` - mark Blog System complete
- Update `README.md` - add blog features
- Update `architecture.md` - add blog service docs

**Step 6: Commit**
```bash
git add .
git commit -m "feat(blog): implement blog system with posts and categories

- Add Post model to Prisma schema
- Create blog service with CRUD operations
- Add API endpoints for posts
- Support for categories and tags
- Markdown content support

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 7: Merge**
```bash
git checkout main
git merge feat/blog-system
git push origin main
git branch -d feat/blog-system
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ DON'T:
- Work directly on main branch
- Skip documentation updates
- Commit without testing
- Use `any` types
- Skip error handling
- Forget to update roadmap
- Use poor commit messages like "update code"

### ✅ DO:
- Create feature branches
- Update docs before merging
- Run tests before committing
- Use proper TypeScript types
- Add error handling everywhere
- Update roadmap with progress
- Write descriptive commit messages

---

## 📊 Phase-Specific Guidelines

### Phase 1.5 - CMS Foundation (Current)
**Focus**: Database, Auth, Media, Admin
**Branch prefix**: `feat/cms-*`
**Documentation emphasis**: API endpoints, database schema

### Phase 2 - CMS Core Features (Next)
**Focus**: Page manager UI, SEO, blog
**Branch prefix**: `feat/core-*`
**Documentation emphasis**: UI components, user workflows

### Phase 3 - WordPress Parity (Future)
**Focus**: Plugins, themes, migration
**Branch prefix**: `feat/wp-*`
**Documentation emphasis**: Plugin API, theme system

---

## 🔄 Session Start Checklist

At the beginning of EVERY Claude Code session:

- [ ] Read this file completely
- [ ] Check current branch: `git branch`
- [ ] Check git status: `git status`
- [ ] If on main and starting new task → create feature branch
- [ ] Review roadmap: `docs/planning/roadmap.md`
- [ ] Understand current phase and priorities

---

## 🎯 Session End Checklist

At the end of your work:

- [ ] All tests passing: `npm run test:run`
- [ ] Documentation updated (roadmap, README, architecture)
- [ ] Proper commits created
- [ ] Code pushed to appropriate branch
- [ ] If task complete: merged to main and branch deleted
- [ ] Summary document created (like `PHASE_1_5_COMPLETE.md`)

---

## 📞 Questions to Ask User

Before major decisions:

- "Should I create a new feature branch for this task?"
- "This will modify the database schema - should I proceed?"
- "This requires a breaking change - is this okay?"
- "Tests are failing - should I fix them first?"

---

## 🤖 AI-Specific Notes

### What Claude Code is Great At:
- ✅ Boilerplate generation
- ✅ Type definitions
- ✅ API endpoint scaffolding
- ✅ Documentation writing
- ✅ Test scaffolding
- ✅ Code organization

### What Needs Human Review:
- ⚠️ Architecture decisions
- ⚠️ Security implementations
- ⚠️ Performance optimizations
- ⚠️ API design choices
- ⚠️ Database schema changes

---

## 🎓 Learning from Mistakes

### Phase 1.5 Mistakes (Learn from these!):

1. ❌ **No feature branches created** → Should have had 3 separate branches
2. ❌ **Roadmap not updated** → Should mark tasks complete immediately
3. ❌ **No proper commit strategy** → Should commit after each feature
4. ✅ **Good code quality** → TypeScript, types, error handling all good!
5. ✅ **Good documentation** → Created comprehensive guides

**Lesson**: Process is as important as code quality!

---

## 📖 Quick Reference

### Common Commands:

```bash
# Branch management
git checkout -b feat/task-name
git checkout main
git merge feat/task-name
git branch -d feat/task-name

# Testing
npm run test:run

# Database
npm run db:migrate
npm run db:studio

# Development
npm run dev
npm run build
```

### File Paths to Remember:

- Roadmap: `docs/planning/roadmap.md`
- Architecture: `docs/planning/architecture.md`
- Main README: `README.md`
- Cursor rules: `.cursorrules`
- This guide: `CLAUDE_CODE_GUIDELINES.md`

---

## ✅ Success Criteria

You're following the guidelines correctly when:

1. ✅ Every task has its own feature branch
2. ✅ Documentation is updated before merging
3. ✅ All tests pass before committing
4. ✅ Commit messages follow conventions
5. ✅ Code has proper types and error handling
6. ✅ Roadmap reflects current progress accurately

---

**Last Updated**: Phase 1.5 Complete
**Next Phase**: Phase 2 - CMS Core Features
**Remember**: Read this file at the start of every session! 🎯
