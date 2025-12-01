# Linabasis Quick Reference Card

**Keep this handy while developing!**

---

## 🚀 Daily Workflow

```bash
# Start new feature
git checkout main && git pull origin main
git checkout -b feat/my-feature

# Make changes, then commit
git add .
git commit -m "feat: add amazing feature"

# Push to remote
git push -u origin feat/my-feature

# Create PR on GitHub
```

---

## 📝 Commit Message Format

```
<type>(<scope>): <description>

Examples:
feat: add user authentication
fix: resolve memory leak in canvas
docs: update installation guide
refactor: simplify plugin loader
test: add integration tests
chore: update dependencies
```

**Types:** `feat` `fix` `docs` `style` `refactor` `test` `chore` `perf`

---

## 🌳 Branch Naming

```
Format: <type>/<description>

Examples:
feat/plugin-architecture      ✅
fix/export-zip-corruption     ✅
docs/api-documentation        ✅
my-feature                    ❌
```

---

## 🛠️ Common Commands

### Starting Work
```bash
# Update main
git checkout main && git pull origin main

# Create feature branch
git checkout -b feat/my-feature
```

### Making Changes
```bash
# Check status
git status

# See changes
git diff

# Stage all
git add .

# Stage specific file
git add path/to/file.ts

# Commit
git commit -m "feat: description"

# Push
git push origin feat/my-feature
```

### Updating Branch
```bash
# Get latest main
git checkout main && git pull origin main

# Update your branch
git checkout feat/my-feature
git rebase main

# Push (force with lease is safer than force)
git push --force-with-lease origin feat/my-feature
```

### Fixing Mistakes
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Amend last commit
git add forgotten-file.ts
git commit --amend --no-edit

# Discard all local changes
git reset --hard origin/your-branch
```

### Squashing Commits
```bash
# Squash last 5 commits
git rebase -i HEAD~5

# In editor: change 'pick' to 'squash'
# Save and edit final message
```

### Cleanup
```bash
# Delete local branch
git branch -d feat/my-feature

# Delete remote branch
git push origin --delete feat/my-feature

# List merged branches
git branch --merged main
```

---

## ✅ Pre-commit Checklist

Before committing:

- [ ] Code works locally
- [ ] Tests pass (`npm run test`)
- [ ] Linter clean (`npm run check`)
- [ ] No `console.log` statements
- [ ] No `any` types (use proper types)
- [ ] Comments added for complex logic
- [ ] Docs updated if needed

---

## 🔍 Before Creating PR

- [ ] Branch is up to date with main
- [ ] Clean commit history (squash if needed)
- [ ] All tests passing
- [ ] Production build works (`npm run build`)
- [ ] Self-reviewed all changes
- [ ] PR description is clear

---

## 🆘 Emergency Commands

### "Help, I'm in a weird state!"
```bash
git status                    # See what's happening
git log --oneline -5         # Recent commits
git diff                     # See changes
```

### "Undo everything!"
```bash
# Create backup first
git branch backup-$(date +%Y%m%d)

# Then reset
git reset --hard origin/main
git clean -fd
```

### "I committed to wrong branch!"
```bash
# Create correct branch (stays on current)
git branch feat/correct-branch

# Reset current branch
git reset --hard origin/main

# Switch to correct branch
git checkout feat/correct-branch
```

---

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Type checking
npm run check

# Type checking (watch mode)
npm run check:watch
```

---

## 🔨 Building

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 🗄️ Database

```bash
# Compose schemas (core + active plugins)
npm run db:compose

# Preview schema composition
npm run db:compose:check

# Create migration
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Open Prisma Studio
npm run db:studio

# Full setup (migrate + generate + create admin)
npm run setup
```

---

## 🔌 Plugins

```bash
# Migrate to plugin architecture
npm run migrate:plugins

# Preview migration (dry-run)
npm run migrate:plugins:check
```

---

## 📚 Documentation

- [`CONTRIBUTING.md`](../.github/CONTRIBUTING.md) - Complete contribution guide
- [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) - Detailed git workflow
- [`PLUGIN_DEVELOPMENT.md`](PLUGIN_DEVELOPMENT.md) - Plugin development guide
- [`README.md`](../README.md) - Project overview

---

## 🎨 Code Style

```typescript
// Use descriptive names
const pluginRegistry = getPluginRegistry()  ✅
const pr = getPluginRegistry()              ❌

// Prefer const
const items = []   ✅
let items = []     ❌ (unless you reassign)

// Type everything
function getUser(id: string): User | null  ✅
function getUser(id): any                  ❌

// No any
const data: PluginManifest = {}  ✅
const data: any = {}             ❌
```

---

## 💡 Pro Tips

1. **Commit often** - Small commits are easier to review/revert
2. **Pull frequently** - Stay up to date with main
3. **Test locally** - Don't rely on CI to find bugs
4. **Ask for help** - Better to ask than struggle
5. **Review others** - Learn and contribute
6. **Document as you code** - Future you will thank you
7. **Use git hooks** - Run `./scripts/setup-git-hooks.sh`

---

## 🔗 Quick Links

- [GitHub Repository](https://github.com/h-ibaldo/linebasis)
- [Issues](https://github.com/h-ibaldo/linebasis/issues)
- [Discussions](https://github.com/h-ibaldo/linebasis/discussions)
- [Pull Requests](https://github.com/h-ibaldo/linebasis/pulls)

---

**Happy Coding!** 🚀

*Keep this file open in a tab for quick reference.*
