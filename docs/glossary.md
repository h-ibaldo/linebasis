# Glossary

- **Canvas**: The visual design environment for a single Page, containing all elements and views.
- **DesignState**: The central state store containing all pages, elements, and editor status.
- **Element**: A node in the document tree (e.g., div, image, text) stored in `Page.canvasElements` or `Element.children`.
- **Manifest**: The `manifest.ts` file defining a plugin's metadata, dependencies, and configuration.
- **Page**: A distinct route (e.g., `/about`) in the application, containing exactly one Canvas.
- **Plugin**: An independent module that extends the core system via the Plugin Registry.
- **Schema Composition**: The build-time process of merging plugin-defined Prisma schemas into the core database schema.
- **View**: A specific type of Element (`div` with `isView: true`) representing a responsive breakpoint container.
