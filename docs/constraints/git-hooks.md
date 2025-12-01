# Constraint
Automated pre-commit and pre-push checks must pass for all operations.

# Rationale
To enforce code quality standards and prevent broken builds or "messy" code from entering the repository.

# Rules
- **Pre-commit**:
  - No `console.log` or `debugger` statements.
  - No `any` types in TypeScript.
  - Linter (`npm run check`) must pass.
  - Tests (`npm run test`) must pass.
- **Pre-push**:
  - Branch name must follow convention.
  - Full test suite and production build must pass.
