# Documentation Index

## Specs
- [Layers Architecture](specs/layers-architecture.md): Manage the hierarchy and storage of page elements.
- [Page Builder](specs/page-builder.md): Visual interface for constructing and editing web pages.
- [Plugin System](specs/plugin-system.md): Extend system functionality without modifying core code.

## Design Decisions
- [Git Workflow](design-decisions/git-workflow.md): Adopt a strict Feature Branch workflow with Conventional Commits.
- [Plugin Architecture](design-decisions/plugin-architecture.md): Runtime plugin system with database schema composition.
- [Single View Concept](design-decisions/single-view-concept.md): Unify "View" and "Element" into a single data structure.

## Constraints
- [Commit Messages](constraints/commit-messages.md): All commit messages must strictly follow Conventional Commits.
- [Git Hooks](constraints/git-hooks.md): Automated pre-commit and pre-push checks must pass.
- [UI Development](constraints/ui-development.md): Strict separation of concerns between Logic and Design.

## Patterns
- [Plugin Lifecycle](patterns/plugin-lifecycle.md): Execute logic during specific system events via hooks.
- [Schema Composition](patterns/schema-composition.md): Merge plugin-defined database tables with the core schema.
- [UI Handoff](patterns/ui-handoff.md): Use comments to signal design intent to designers.

## Reference
- [Glossary](glossary.md): Definitions of domain-specific terms.
