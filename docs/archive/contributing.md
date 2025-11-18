# Contributing to Linabasis

**⚠️ IMPORTANT: Linabasis is currently in early development and is NOT accepting external contributions at this time.**

This document outlines our future contribution guidelines. We will open contributions once the core foundation is established.

## Project Philosophy

Linabasis is a **highly vibe-coded, AI-friendly project** that will embrace both human and AI contributions while maintaining human authorship for all commits. We believe in transparent AI usage and human accountability.

## When Will Contributions Open?

We will accept contributions once we have:
- ✅ Stable core architecture
- ✅ Basic design tool functionality
- ✅ Component library foundation
- ✅ Testing framework
- ✅ Complete documentation

## Future Contribution Workflow

### 1. Setup
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/linebasis.git
cd linebasis

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Development
- Create a feature branch: `git checkout -b feature/your-feature`
- Write clean, typed TypeScript code
- Follow existing code patterns
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Guidelines

Format:
```
type(scope): description

[optional body with AI assistance details if applicable]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ai`

Examples:
```
feat(canvas): add drag and drop functionality
ai(components): generate button component with Claude assistance
fix(types): correct TypeScript interface definitions
```

### 4. Code Standards

**TypeScript**
- Use strict typing, avoid `any`
- Define interfaces for all data structures
- Export types from `src/lib/types/`

**Svelte Components**
- PascalCase for components: `MyComponent.svelte`
- kebab-case for files: `my-component.svelte`
- Type all props with TypeScript

**Naming Conventions**
- Files: `kebab-case.ts`
- Functions: `camelCase()`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

### 5. AI Contributions

**Encouraged:**
- Use AI for code generation, documentation, testing
- Document AI tool usage in commit messages
- Example: `ai(utils): generate validation helpers with ChatGPT`

**Required:**
- Human review and refinement of all AI code
- Human authorship for all commits
- Understanding of what the code does
- Thorough testing before committing

### 6. Testing

```bash
# Run type checking
npm run check

# Run tests (when available)
npm test

# Build project
npm run build
```

### 7. Pull Request Process

- Ensure all tests pass
- Update relevant documentation
- Write clear commit messages
- Reference related issues
- Respond to review feedback

## Code Quality Checklist

- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No linter errors
- [ ] Follows existing patterns
- [ ] AI assistance documented (if used)

## Project Structure

```
src/
├── routes/           # SvelteKit pages
├── lib/
│   ├── components/   # Reusable components
│   ├── stores/       # State management
│   ├── utils/        # Utility functions
│   └── types/        # TypeScript types
```

## Getting Help

- Read the [setup guide](setup.md)
- Check the [project roadmap](../planning/roadmap.md)
- Review the [architecture docs](../planning/architecture.md)
- Watch the repository for updates

## Current Status

**What we're building:**
- Core design canvas functionality
- Component library foundation
- Code generation system
- Theme and styling system

**Stay updated:**
- Watch the repository
- Check the roadmap for progress
- Follow project announcements

## Contact

- Project maintainer: [@h-ibaldo](https://github.com/h-ibaldo)
- Email: [ibaldostudio@gmail.com](mailto:ibaldostudio@gmail.com)

---

Thank you for your interest in Linabasis! We look forward to collaborating with you once contributions open.