# Linabasis Git Workflow Guide

**The complete guide to maintaining a clean, professional git history.**

---

## 🎯 Our Philosophy

> "Every commit should tell a story. Every branch should have a purpose. Every PR should be a joy to review."

Linabasis aims to be a **reference implementation** for:
- Clean git history
- Professional workflows
- Open source best practices
- Excellent documentation

---

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/h-ibaldo/linebasis.git
cd linebasis

# 2. Install dependencies
npm install

# 3. Setup git hooks (IMPORTANT!)
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh

# 4. Create your feature branch
git checkout -b feat/your-feature-name

# 5. Start coding!
npm run dev
```

---

## 📋 Daily Workflow

### Starting New Work

```bash
# Always start fresh from main
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feat/descriptive-name

# Examples:
git checkout -b feat/user-authentication
git checkout -b fix/export-zip-corruption
git checkout -b docs/plugin-development-guide
```

### Making Changes

```bash
# Make your changes
# ... code code code ...

# Check what changed
git status
git diff

# Stage your changes
git add .
# or stage specific files
git add src/lib/components/Button.svelte

# Commit with conventional message
git commit -m "feat: add user authentication system"

# Push to remote
git push -u origin feat/your-feature-name
```

### Creating a Pull Request

```bash
# 1. Ensure you're up to date
git checkout main
git pull origin main
git checkout feat/your-feature-name
git rebase main

# 2. Push your branch
git push origin feat/your-feature-name

# 3. Go to GitHub and create PR
# The PR template will guide you through the checklist
```

---

## 🌳 Branch Strategy

### Branch Naming Convention

**Format:** `<type>/<short-description>`

**Types:**
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

**Examples:**

```bash
✅ GOOD:
feat/plugin-architecture
feat/add-blog-system
fix/export-zip-corruption
fix/prisma-connection-leak
docs/update-installation-guide
refactor/simplify-canvas-logic
test/add-integration-tests
chore/update-dependencies

❌ BAD:
feature-plugin-system          # No type prefix
feat/page-manager-ui          # Didn't match actual work
my-changes                     # Too vague
fix-stuff                      # Not descriptive
```

### Branch Lifecycle

```
create → develop → review → merge → delete
  ↓         ↓         ↓        ↓        ↓
main    feature   PR open   merged   cleanup
```

**Rules:**
1. **Always start from main**
2. **One feature per branch**
3. **Keep branches short-lived** (days, not weeks)
4. **Delete after merge**
5. **Never reuse old branches**

---

## 💬 Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) strictly.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add plugin system` |
| `fix` | Bug fix | `fix: resolve memory leak` |
| `docs` | Documentation | `docs: update README` |
| `style` | Formatting | `style: fix indentation` |
| `refactor` | Code restructure | `refactor: simplify loader` |
| `test` | Add/update tests | `test: add unit tests` |
| `chore` | Maintenance | `chore: update deps` |
| `perf` | Performance | `perf: optimize rendering` |

### Examples

**Good commits:**

```bash
feat: implement plugin architecture foundation
fix: resolve symlink import issues in blog plugin
docs: add comprehensive plugin development guide
refactor: simplify schema composition logic
test: add integration tests for plugin lifecycle
chore: update dependencies to latest versions
perf: optimize canvas rendering performance
```

**With scope:**

```bash
feat(blog): extract blog system to plugin
fix(export): handle spaces in filenames correctly
docs(api): document new plugin endpoints
refactor(core): simplify plugin registry
```

**With body:**

```bash
feat: implement schema composition system

- Auto-discovers active plugins from database
- Merges core + plugin Prisma schemas
- Removes duplicate datasource/generator blocks
- Includes dry-run mode for testing
- Adds npm scripts: db:compose and db:compose:check
```

**Bad commits:**

```bash
❌ update stuff
❌ fix bug
❌ WIP
❌ asdf
❌ fixed the thing
❌ more changes
```

### Commit Message Checklist

Before committing, ensure:

- [ ] Starts with valid type (`feat`, `fix`, etc.)
- [ ] Uses imperative mood ("add" not "added")
- [ ] First line is under 72 characters
- [ ] Description is clear and specific
- [ ] Explains **what** and **why**, not **how**
- [ ] Can be understood without reading code

---

## 🔄 Common Workflows

### Scenario: Update Your Branch

```bash
# When main has moved ahead

# Save your work
git add .
git commit -m "wip: save progress"

# Get latest main
git checkout main
git pull origin main

# Rebase your branch
git checkout feat/your-feature
git rebase main

# If conflicts, resolve them, then:
git add .
git rebase --continue

# Force push (your branch only!)
git push --force-with-lease origin feat/your-feature
```

### Scenario: Fix Your Last Commit

```bash
# Oops, forgot to add a file
git add forgotten-file.ts
git commit --amend --no-edit

# Oops, bad commit message
git commit --amend -m "feat: correct commit message"

# Push the amendment
git push --force-with-lease origin feat/your-feature
```

### Scenario: Squash Multiple Commits

```bash
# You have 10 "fix typo" commits

# Squash last 10 commits
git rebase -i HEAD~10

# In the editor that opens:
# - Keep first commit as 'pick'
# - Change all others to 'squash' (or 's')
# - Save and close

# Edit the final commit message
# Save and close

# Force push
git push --force-with-lease origin feat/your-feature
```

### Scenario: Split a Commit

```bash
# Your commit did too many things

# Undo last commit but keep changes
git reset --soft HEAD~1

# Stage and commit in smaller chunks
git add src/auth/
git commit -m "feat: add authentication system"

git add src/middleware/
git commit -m "feat: add auth middleware"

git add docs/
git commit -m "docs: document auth flow"
```

### Scenario: Committed to Wrong Branch

```bash
# Oh no, I committed to main!

# Create the correct branch (stays on main)
git branch feat/my-feature

# Reset main to match origin
git reset --hard origin/main

# Switch to your feature branch
git checkout feat/my-feature

# Your commit is now on the right branch!
```

### Scenario: Undo Everything

```bash
# Nuclear option - start over

# Discard ALL local changes
git reset --hard origin/main

# Remove untracked files
git clean -fd
```

---

## 🔍 Code Review Process

### Before Requesting Review

**Self-Review Checklist:**

```bash
# 1. Review your own changes
git diff main...your-branch

# 2. Check commit history is clean
git log --oneline

# 3. Ensure tests pass
npm run test

# 4. Ensure linting passes
npm run check

# 5. Check for debugging code
grep -r "console.log" src/
grep -r "debugger" src/

# 6. Ensure docs are updated
git diff main...your-branch -- docs/ README.md
```

**If history is messy, clean it up:**

```bash
# Interactive rebase to squash/reorder
git rebase -i main

# Tips:
# - Squash "fix typo" commits into main commits
# - Reorder commits to be logical
# - Edit commit messages for clarity
```

### As a Reviewer

**What to check:**

1. **Functionality**
   - Does it work as intended?
   - Are there edge cases not handled?
   - Are there security concerns?

2. **Code Quality**
   - Is it readable and maintainable?
   - Are there any code smells?
   - Does it follow project conventions?

3. **Testing**
   - Are there tests?
   - Do tests cover edge cases?
   - Do tests actually test the right thing?

4. **Documentation**
   - Is complex logic commented?
   - Are docs updated?
   - Is the PR description clear?

**Review etiquette:**

```markdown
✅ GOOD:
"Consider extracting this into a helper function for better reusability."
"This could lead to a race condition if X happens. What do you think about adding a lock?"
"Nice solution! I learned something new from this."

❌ BAD:
"This is wrong." (not specific)
"Why did you do it this way?" (sounds accusatory)
"Just rewrite it." (not helpful)
```

---

## 🚨 Git Hooks

Our automated git hooks prevent common mistakes:

### Pre-commit Hook

Runs before every commit:

```bash
✓ Checks for console.log statements
✓ Warns about TODO without issue numbers
✓ Warns about 'any' types in TypeScript
✓ Runs TypeScript check
✓ Runs test suite
```

### Commit-msg Hook

Validates commit message format:

```bash
✓ Ensures conventional commit format
✓ Checks message length
✓ Suggests improvements
```

### Pre-push Hook

Runs before pushing:

```bash
✓ Prevents direct push to main
✓ Checks branch naming convention
✓ Runs full test suite
✓ Tests production build
```

**To bypass hooks (not recommended):**

```bash
git commit --no-verify
git push --no-verify
```

---

## 📊 Measuring Success

### Good PR Metrics

- **Size:** 200-400 lines changed
- **Review time:** < 30 minutes
- **Commits:** 1-5 logical commits
- **Time to merge:** < 24 hours

### Bad PR Signs

- ❌ 2000+ lines changed
- ❌ 30+ commits
- ❌ Multiple features mixed
- ❌ No tests
- ❌ No description

### Repository Health

Check regularly:

```bash
# Branches that need cleanup
git branch --merged main | grep -v "main"

# Stale branches (>30 days old)
git for-each-ref --sort=-committerdate refs/heads/ --format='%(committerdate:short) %(refname:short)'

# Large commits (>500 lines)
git log --all --pretty=format: --name-only | sort | uniq -c | sort -rg | head -10
```

---

## 🎓 Learning More

### Recommended Reading

- [Pro Git Book](https://git-scm.com/book) - Complete git reference
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit format
- [Git Flight Rules](https://github.com/k88hudson/git-flight-rules) - Git problem solutions
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)

### Interactive Tutorials

- [Learn Git Branching](https://learngitbranching.js.org/) - Visual, interactive
- [Git Katas](https://github.com/eficode-academy/git-katas) - Practice exercises

---

## 🆘 Getting Help

### Common Issues

**"I'm in a weird state, help!"**
```bash
# See what's happening
git status

# See recent commits
git log --oneline -5

# See what changed
git diff

# Ask in Discussions or Discord
```

**"I messed up, how do I undo?"**
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard ALL changes (dangerous!)
git reset --hard origin/your-branch

# Create backup first!
git branch backup-$(date +%Y%m%d)
```

### Where to Ask

- 💬 [GitHub Discussions](https://github.com/h-ibaldo/linebasis/discussions)
- 🐛 [Issues](https://github.com/h-ibaldo/linebasis/issues)
- 📧 Email maintainers

---

## ✨ Best Practices Summary

1. **Start from main** - Always branch from latest main
2. **Name branches clearly** - Use type/description format
3. **Commit often** - Small, focused commits
4. **Write good messages** - Follow conventional commits
5. **Test before push** - Hooks will enforce this
6. **Keep PRs small** - Easier to review
7. **Document everything** - Future you will thank you
8. **Ask for help** - Better to ask than guess
9. **Review others' code** - Learn and contribute
10. **Clean up after merge** - Delete merged branches

---

**Remember: A clean git history is not about perfection, it's about communication.**

Happy coding! 🚀
