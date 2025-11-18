#!/bin/bash

# Linabasis Git Hooks Setup
# Run: chmod +x scripts/setup-git-hooks.sh && ./scripts/setup-git-hooks.sh

echo "🔧 Setting up Linabasis git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# ============================================
# Pre-commit Hook
# ============================================
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Pre-commit checks running..."

# 1. Check for console.log
if git diff --cached --name-only | grep -E '\.(ts|js|svelte)$' | xargs grep -n "console\.log" 2>/dev/null; then
    echo ""
    echo "❌ ERROR: console.log() found in staged files"
    echo "   Please remove console.log() statements before committing"
    echo "   (or use console.error/warn if intentional)"
    exit 1
fi

# 2. Check for TODO without issue number
if git diff --cached --name-only | grep -E '\.(ts|js|svelte)$' | xargs grep -n "TODO" 2>/dev/null | grep -v "TODO(#[0-9]"; then
    echo ""
    echo "⚠️  WARNING: TODO found without issue number"
    echo "   Consider: TODO(#123): description"
    echo "   Continuing anyway..."
fi

# 3. Check for any/unknown types in TypeScript
if git diff --cached --name-only | grep -E '\.ts$' | xargs grep -n ": any\|: unknown" 2>/dev/null; then
    echo ""
    echo "⚠️  WARNING: 'any' or 'unknown' types found"
    echo "   Consider using proper types for better type safety"
    echo "   Continuing anyway..."
fi

# 4. Run linter on staged files
echo "🔍 Running TypeScript check..."
if ! npm run check --silent 2>/dev/null; then
    echo ""
    echo "❌ ERROR: TypeScript check failed"
    echo "   Run 'npm run check' to see errors"
    exit 1
fi

# 5. Run tests
echo "🧪 Running tests..."
if ! npm run test:run --silent 2>/dev/null; then
    echo ""
    echo "❌ ERROR: Tests failed"
    echo "   Run 'npm run test' to see failures"
    exit 1
fi

echo "✅ Pre-commit checks passed!"
exit 0
EOF

chmod +x .git/hooks/pre-commit
echo "✅ Pre-commit hook installed"

# ============================================
# Commit Message Hook
# ============================================
cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Check conventional commit format
# Format: type(scope): description
# type: feat, fix, docs, style, refactor, test, chore, perf
# scope: optional
# description: required

conventional_pattern="^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?: .{1,}"

if ! echo "$commit_msg" | grep -qE "$conventional_pattern"; then
    echo ""
    echo "❌ ERROR: Commit message doesn't follow Conventional Commits"
    echo ""
    echo "Format: <type>(<scope>): <description>"
    echo ""
    echo "Examples:"
    echo "  feat: add user authentication"
    echo "  fix(export): resolve zip corruption"
    echo "  docs: update plugin development guide"
    echo "  refactor(core): simplify plugin loader"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, test, chore, perf"
    echo ""
    echo "Your message:"
    echo "  $commit_msg"
    echo ""
    exit 1
fi

# Check message length (first line should be <= 72 chars)
first_line=$(echo "$commit_msg" | head -n 1)
if [ ${#first_line} -gt 72 ]; then
    echo ""
    echo "⚠️  WARNING: Commit message first line is ${#first_line} characters"
    echo "   Consider keeping it under 72 characters for better readability"
    echo "   Continuing anyway..."
fi

echo "✅ Commit message format valid"
exit 0
EOF

chmod +x .git/hooks/commit-msg
echo "✅ Commit-msg hook installed"

# ============================================
# Pre-push Hook
# ============================================
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

echo "🚀 Pre-push checks running..."

# Get current branch name
branch=$(git symbolic-ref --short HEAD)

# Prevent pushing to main directly
if [ "$branch" = "main" ]; then
    echo ""
    echo "❌ ERROR: Direct push to 'main' is not allowed"
    echo "   Please create a feature branch and open a Pull Request"
    echo ""
    echo "   Steps:"
    echo "   1. git checkout -b feat/your-feature"
    echo "   2. git cherry-pick <commits>"
    echo "   3. git push -u origin feat/your-feature"
    echo "   4. Create PR on GitHub"
    echo ""
    exit 1
fi

# Check branch naming convention
if ! echo "$branch" | grep -qE "^(feat|fix|docs|refactor|test|chore)/"; then
    echo ""
    echo "⚠️  WARNING: Branch name doesn't follow convention"
    echo "   Format: <type>/<description>"
    echo "   Examples: feat/plugin-system, fix/export-bug"
    echo "   Your branch: $branch"
    echo ""
    echo "   Continuing anyway..."
fi

# Run full test suite before push
echo "🧪 Running full test suite..."
if ! npm run test:run --silent; then
    echo ""
    echo "❌ ERROR: Tests failed"
    echo "   Fix tests before pushing"
    exit 1
fi

# Run build to ensure it compiles
echo "🔨 Testing production build..."
if ! npm run build --silent 2>/dev/null; then
    echo ""
    echo "❌ ERROR: Production build failed"
    echo "   Fix build errors before pushing"
    exit 1
fi

echo "✅ Pre-push checks passed!"
exit 0
EOF

chmod +x .git/hooks/pre-push
echo "✅ Pre-push hook installed"

# ============================================
# Complete
# ============================================
echo ""
echo "🎉 Git hooks installed successfully!"
echo ""
echo "Installed hooks:"
echo "  • pre-commit  - Checks for console.log, runs linter and tests"
echo "  • commit-msg  - Validates conventional commit format"
echo "  • pre-push    - Prevents direct push to main, runs full tests"
echo ""
echo "To skip hooks (not recommended):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
