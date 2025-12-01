# Constraint
Strict separation of concerns between HTML/Logic (Developer) and CSS/Design (Designer).

# Rationale
To allow developers and designers to work in parallel without conflicts, and to ensure semantic, accessible markup.

# Rules
- **HTML**: Must be semantic (e.g., `<main>`, `<nav>`) and accessible (ARIA).
- **Styling**: NO inline styles. NO framework-specific utility classes (unless requested).
- **Classes**: Must use descriptive, BEM-style naming (e.g., `.login-form`, `.button-primary`).
- **Handoff**: Developers must leave comments marking styling hooks.
