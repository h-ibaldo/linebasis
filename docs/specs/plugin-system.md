# Purpose
Extend system functionality (models, APIs, UI) without modifying core code.

# Responsibilities
- MUST load plugins from disk and validate manifests.
- MUST merge plugin database schemas with the core schema.
- MUST execute lifecycle hooks (install, activate, etc.).
- MUST NOT allow plugins to directly modify core source files.

# Dependencies
- **Core**: `PluginRegistry`, `PluginLoader`, `HooksManager`.
- **External**: Prisma (schema composition), SvelteKit (routes).

# Interface
- **Manifest**: `id`, `version`, `requires`, `apiRoutes`, `adminPages`.
- **Hooks**: `onInstall`, `onActivate`, `beforePagePublish`, `getSitemapEntries`.
- **Registry**: `getPlugin(id)`, `getAllPlugins()`.

# Tests
- **Success**: Load a valid plugin with a manifest and verify it appears in the registry.
- **Failure**: Attempt to load a plugin with a missing `id` in `manifest.ts` and verify it throws a validation error.
