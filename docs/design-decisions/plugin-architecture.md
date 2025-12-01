# Decision
Implement a runtime plugin system with database schema composition.

# Motivation
To allow users/developers to extend the CMS (new models, API routes, UI) without modifying the core codebase, enabling easy updates and modularity.

# Implications
- **Startup**: Slower startup due to schema composition and client generation steps.
- **Database**: Single shared database but with logically separated schemas merged at build time.
- **Isolation**: Plugins run in the same process; a crash in a plugin can affect the core.

# Alternatives considered
- **Microservices**: Too complex for the target deployment scale.
- **Webhooks only**: Insufficient for deep integration (custom database models).
