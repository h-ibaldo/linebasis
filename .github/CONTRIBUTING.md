# Contributing to Linabasis

**Welcome!** Linabasis aims to be a reference implementation for:
- ✨ Vibe coding (fast, intuitive, flow-state development)
- 📚 Excellent documentation
- 🌳 Clean git practices
- 🔧 Open source best practices

---

## 🎯 The Linabasis Way

### Core Principles

1. **Vibe Coding** - Move fast, stay in flow, but maintain quality
2. **Git Discipline** - Every commit tells a story
3. **Documentation First** - Code is temporary, docs are forever
4. **Test Everything** - No surprises in production
5. **Review Friendly** - PRs should be a pleasure to review

---

## 🌳 Git Workflow (The Clean Way)

### Branch Naming Convention

**Format:** `<type>/<short-description>`

**Types:**
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

**Examples:**
```bash
feat/plugin-architecture      ✅ Good - clear, semantic
feat/add-blog-system          ✅ Good - describes feature
fix/export-zip-corruption     ✅ Good - specific issue

feat/page-manager-ui          ❌ Bad - didn't match actual work
feat/stuff                    ❌ Bad - too vague
my-changes                    ❌ Bad - no type prefix
```

### The Golden Rule: **One Branch = One Feature**

**Before starting work:**

```bash
# 1. Always start from main
git checkout main
git pull origin main

# 2. Create a descriptive branch
git checkout -b feat/your-feature-name

# 3. Commit often, with clear messages
git commit -m "feat: add user authentication"
git commit -m "test: add auth unit tests"
git commit -m "docs: document auth flow"

# 4. Push regularly
git push -u origin feat/your-feature-name
```

**Never:**
- ❌ Start work on an old branch
- ❌ Mix multiple features in one branch
- ❌ Let branches live for weeks
- ❌ Commit without a clear message

---

## 📝 Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance
- `perf:` - Performance improvement

### Examples

```bash
# Feature
git commit -m "feat: add plugin system core architecture"
git commit -m "feat(blog): extract blog to plugin"

# Fix
git commit -m "fix: resolve symlink import issues in plugins"
git commit -m "fix(export): handle spaces in filenames"

# Documentation
git commit -m "docs: add plugin development guide"
git commit -m "docs(readme): update installation steps"

# Refactor
git commit -m "refactor: simplify plugin loader logic"

# With body
git commit -m "feat: implement schema composition

- Auto-discovers active plugins
- Merges core + plugin schemas
- Handles model relations
- Includes dry-run mode"
```

### Commit Message Checklist

- [ ] Starts with type prefix
- [ ] Uses imperative mood ("add" not "added")
- [ ] Is concise but descriptive
- [ ] Explains **what** and **why**, not how
- [ ] Can standalone without reading code

---

## 🔄 Pull Request Workflow

### Before Creating a PR

**1. Self-Review Checklist:**
```bash
# Clean commit history?
git log --oneline

# All tests passing?
npm run test

# Linting clean?
npm run check

# No console.logs or TODOs?
grep -r "console.log" src/
grep -r "TODO" src/

# Documentation updated?
ls docs/
```

**2. Rebase if needed:**
```bash
# If main has moved ahead
git checkout main
git pull origin main
git checkout feat/your-feature
git rebase main

# Resolve conflicts, then
git push --force-with-lease origin feat/your-feature
```

**3. Squash if messy:**
```bash
# If you have 20 "fix typo" commits
git rebase -i HEAD~20

# In the editor:
# - Keep first commit as 'pick'
# - Change others to 'squash' or 'fixup'
# - Save and edit final commit message
```

### PR Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

<!-- What does this PR do? -->

## Type of Change

- [ ] feat - New feature
- [ ] fix - Bug fix
- [ ] docs - Documentation
- [ ] refactor - Code restructuring
- [ ] test - Adding tests
- [ ] chore - Maintenance

## Changes

<!-- List key changes -->

-
-
-

## Testing

<!-- How was this tested? -->

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Works in dev environment
- [ ] Works in production build

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Checklist

- [ ] Code follows project style guide
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.logs or debug code
- [ ] Tests pass locally
- [ ] Commit messages follow convention

## Related Issues

<!-- Link any related issues -->

Closes #
```

### PR Size Guidelines

**Ideal PR:**
- 📏 **200-400 lines** changed
- ⏱️ **15-30 minutes** to review
- 🎯 **1 feature/fix** only
- 📝 **Well documented**

**If your PR is too large:**
1. Break into smaller PRs
2. Create a parent issue to track
3. Reference parent in each PR

---

## 📚 Documentation Standards

### Every Feature Needs:

1. **Code Comments** - For complex logic
2. **README Update** - If it changes usage
3. **API Docs** - For new endpoints
4. **Examples** - Show it in action
5. **Migration Guide** - If breaking changes

### Documentation Structure

```
docs/
├── README.md                  # Overview
├── ARCHITECTURE.md            # System design
├── API.md                     # API reference
├── PLUGIN_DEVELOPMENT.md      # Plugin guide
├── DEPLOYMENT.md              # Production guide
└── CHANGELOG.md               # Version history
```

### Writing Good Docs

**Do:**
- ✅ Write for beginners
- ✅ Include code examples
- ✅ Explain the "why"
- ✅ Keep it up to date
- ✅ Use diagrams when helpful

**Don't:**
- ❌ Assume knowledge
- ❌ Skip the basics
- ❌ Use jargon without explanation
- ❌ Let docs go stale

---

## 🧪 Testing Philosophy

### Test Pyramid

```
     /\
    /  \     E2E Tests (Few)
   /----\
  /      \   Integration Tests (Some)
 /--------\
/__________\  Unit Tests (Many)
```

### What to Test

**Always test:**
- ✅ Business logic
- ✅ API endpoints
- ✅ Database operations
- ✅ Error handling
- ✅ Edge cases

**Don't need tests:**
- ❌ Simple getters/setters
- ❌ Framework code
- ❌ Configuration files

### Test Naming

```typescript
// Good
describe('PluginRegistry', () => {
  describe('activate', () => {
    it('should activate plugin when dependencies met', () => {})
    it('should throw error if dependency missing', () => {})
    it('should execute onActivate hook', () => {})
  })
})

// Bad
describe('test', () => {
  it('works', () => {}) // Too vague
})
```

---

## 🚀 Release Process

### Semantic Versioning

**Format:** `MAJOR.MINOR.PATCH`

- `MAJOR` - Breaking changes (2.0.0)
- `MINOR` - New features (1.1.0)
- `PATCH` - Bug fixes (1.0.1)

### Release Checklist

```bash
# 1. Update version
npm version minor  # or major, patch

# 2. Update CHANGELOG.md
# Add all changes since last release

# 3. Create release commit
git commit -am "chore: release v1.1.0"

# 4. Tag the release
git tag -a v1.1.0 -m "Release v1.1.0"

# 5. Push with tags
git push origin main --tags

# 6. Create GitHub release
# Use tag, add release notes, attach build artifacts

# 7. Publish (if public package)
npm publish
```

---

## 🔧 Code Review Guidelines

### As an Author

**Before requesting review:**
- Self-review every line
- Add comments for complex code
- Link to related issues
- Describe testing done
- Keep PR focused

### As a Reviewer

**Review for:**
- ✅ Correctness - Does it work?
- ✅ Design - Is it well-structured?
- ✅ Readability - Can others understand it?
- ✅ Tests - Is it tested?
- ✅ Docs - Is it documented?

**Review etiquette:**
- 🎯 Be specific with feedback
- 💡 Suggest improvements, don't just criticize
- 🤝 Assume good intent
- ⏰ Review within 24 hours
- ✅ Approve when ready

---

## 🎨 Code Style

### TypeScript Best Practices

```typescript
// Use descriptive names
const userAuthToken = '...'  // ✅ Good
const t = '...'              // ❌ Bad

// Prefer const
const items = []   // ✅ Good
let items = []     // ❌ Avoid if possible

// Type everything
function getUser(id: string): User | null  // ✅ Good
function getUser(id)                       // ❌ Bad

// Avoid any
const data: PluginManifest = {}  // ✅ Good
const data: any = {}             // ❌ Bad
```

### File Organization

```
src/
├── lib/
│   ├── components/     # Reusable UI
│   ├── core/          # Core business logic
│   ├── server/        # Server-side code
│   └── utils/         # Helper functions
├── routes/            # SvelteKit routes
└── tests/             # Test files
```

### Naming Conventions

- **Files:** `kebab-case.ts`
- **Components:** `PascalCase.svelte`
- **Functions:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Interfaces:** `PascalCase`
- **Types:** `PascalCase`

---

## 🐛 Bug Reports

### Good Bug Report Template

```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: macOS 14.0
- Browser: Chrome 120
- Version: 1.0.0

## Screenshots
If applicable

## Logs
```
Error message here
```

## Additional Context
Any other details
```

---

## 📊 Project Health Metrics

### What We Track

- 📈 **Test Coverage** - Keep above 80%
- 🐛 **Open Issues** - Triage weekly
- ⏱️ **PR Review Time** - Under 24 hours
- 📚 **Documentation** - Always up to date
- 🔄 **Dependencies** - Update monthly

### GitHub Insights

Check regularly:
- Pulse (weekly activity)
- Code frequency
- Contributors
- Dependency graph

---

## 🎓 Learning Resources

### Git
- [Pro Git Book](https://git-scm.com/book)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flight Rules](https://github.com/k88hudson/git-flight-rules)

### Testing
- [Testing Library](https://testing-library.com/)
- [Vitest Docs](https://vitest.dev/)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Open Source
- [Open Source Guide](https://opensource.guide/)

---

## 💡 Tips for Success

1. **Commit often** - Small commits are easier to review and revert
2. **Write tests first** - TDD leads to better design
3. **Document as you code** - Future you will thank you
4. **Ask for help** - Better to ask than guess
5. **Review others' code** - You'll learn and help the team
6. **Keep learning** - Technology evolves, we evolve with it

---

## 🆘 Common Scenarios

### "I committed to the wrong branch"

```bash
# Move last commit to new branch
git checkout -b correct-branch
git checkout wrong-branch
git reset --hard HEAD~1
```

### "I need to undo my last commit"

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes and commit
git reset --hard HEAD~1
```

### "My branch is behind main"

```bash
git checkout main
git pull origin main
git checkout your-branch
git rebase main
# Resolve conflicts if any
git push --force-with-lease origin your-branch
```

### "I have too many commits"

```bash
# Squash last 5 commits
git rebase -i HEAD~5

# In editor: change 'pick' to 'squash' for commits to merge
# Save and edit final commit message
```

---

## 🎯 Quick Reference

### Daily Workflow

```bash
# Start work
git checkout main
git pull origin main
git checkout -b feat/my-feature

# Work and commit
git add .
git commit -m "feat: add feature"
git push -u origin feat/my-feature

# Create PR on GitHub
# Address review feedback
# Merge when approved

# Cleanup
git checkout main
git pull origin main
git branch -d feat/my-feature
```

### Pre-commit Checklist

- [ ] Tests pass
- [ ] Linter clean
- [ ] No debug code
- [ ] Docs updated
- [ ] Commit message follows convention

---

**Remember: Great code is about communication, not just functionality.**

Let's build something amazing together! 🚀
