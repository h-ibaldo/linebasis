# Linabasis Plugin Development Guide

**Version:** 1.0.0
**Last Updated:** October 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Plugin Architecture](#plugin-architecture)
3. [Getting Started](#getting-started)
4. [Plugin Structure](#plugin-structure)
5. [Plugin Manifest](#plugin-manifest)
6. [Database Schema](#database-schema)
7. [API Routes](#api-routes)
8. [Admin UI](#admin-ui)
9. [Lifecycle Hooks](#lifecycle-hooks)
10. [Best Practices](#best-practices)
11. [Example: Blog Plugin](#example-blog-plugin)
12. [Publishing Plugins](#publishing-plugins)

---

## Introduction

Linabasis uses a powerful plugin architecture that allows you to extend functionality without modifying the core codebase. Plugins can:

- Add new database models
- Register API endpoints
- Add admin pages
- Extend the UI
- Hook into core events
- Add settings and configuration

---

## Plugin Architecture

### Core Concepts

1. **Plugin Registry**: Singleton that manages all loaded plugins
2. **Plugin Loader**: Discovers and validates plugins from disk
3. **Hooks Manager**: Executes plugin lifecycle and event hooks
4. **Schema Composition**: Merges plugin database schemas with core

### Plugin Lifecycle

```
Discovery → Registration → Installation → Activation → (Use) → Deactivation → Uninstallation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- TypeScript knowledge
- Familiarity with SvelteKit and Prisma

### Create a New Plugin

1. **Create plugin directory:**
   ```bash
   mkdir -p plugins/my-plugin
   cd plugins/my-plugin
   ```

2. **Initialize plugin structure:**
   ```bash
   mkdir -p server/services server/routes admin prisma
   touch manifest.ts index.ts package.json README.md
   ```

3. **Create manifest.ts:**
   ```typescript
   import type { PluginManifest } from '../../src/lib/core/plugins/types';

   export const manifest: PluginManifest = {
     id: '@linebasis/my-plugin',
     name: 'My Plugin',
     version: '1.0.0',
     description: 'Description of what your plugin does',
     author: 'Your Name',
     requires: {
       core: '^1.0.0',
       plugins: {}
     }
   };
   ```

---

## Plugin Structure

### Recommended Directory Layout

```
plugins/my-plugin/
├── manifest.ts          # Plugin configuration
├── index.ts             # Plugin entry point
├── package.json         # NPM package definition
├── README.md            # Plugin documentation
│
├── prisma/
│   └── schema.prisma    # Database models
│
├── server/
│   ├── services/        # Business logic
│   │   └── myService.ts
│   └── routes/          # API endpoints
│       └── myRoute/
│           └── +server.ts
│
└── admin/               # Admin UI pages
    └── my-page/
        └── +page.svelte
```

---

## Plugin Manifest

The manifest is the heart of your plugin. It defines all metadata, dependencies, routes, settings, and hooks.

### Full Manifest Example

```typescript
import type { PluginManifest } from '$lib/core/plugins/types';

export const manifest: PluginManifest = {
  // Basic info
  id: '@linebasis/my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'A great plugin that does amazing things',
  author: 'Your Name <you@example.com>',

  // Dependencies
  requires: {
    core: '^1.0.0',           // Linabasis core version
    plugins: {
      '@linebasis/other': '^2.0.0'  // Optional: other plugins
    }
  },

  // Database
  prismaSchema: './prisma/schema.prisma',

  // API Routes
  apiRoutes: [
    { path: '/api/my-plugin', method: 'GET' },
    { path: '/api/my-plugin/:id', method: ['GET', 'PUT', 'DELETE'] }
  ],

  // Admin Pages
  adminPages: [
    { path: '/admin/my-plugin', component: './admin/my-page/+page.svelte' }
  ],

  // Admin Navigation
  adminNav: [
    { label: 'My Plugin', path: '/admin/my-plugin', icon: '🔌', order: 30 }
  ],

  // Settings
  settings: [
    {
      key: 'my_plugin_enabled',
      type: 'boolean',
      label: 'Enable My Plugin',
      description: 'Turn the plugin on or off',
      default: 'true'
    },
    {
      key: 'my_plugin_api_key',
      type: 'string',
      label: 'API Key',
      description: 'Your API key for external service',
      default: ''
    }
  ],

  // Lifecycle Hooks
  hooks: {
    onInstall: async () => {
      console.log('Plugin installed!');
    },
    onUninstall: async () => {
      console.log('Plugin uninstalled!');
    },
    onActivate: async () => {
      console.log('Plugin activated!');
    },
    onDeactivate: async () => {
      console.log('Plugin deactivated!');
    }
  },

  // Capabilities (for filtering/searching)
  capabilities: ['api', 'admin', 'database'],

  // Permissions
  permissions: ['database:write', 'files:read', 'api:write']
};
```

### Manifest Fields Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique plugin ID (format: `@org/name`) |
| `name` | string | ✅ | Human-readable name |
| `version` | string | ✅ | Semantic version (e.g., `1.0.0`) |
| `description` | string | ✅ | Short description |
| `author` | string | ✅ | Author name/email |
| `requires` | object | ✅ | Version dependencies |
| `prismaSchema` | string | ❌ | Path to schema file |
| `apiRoutes` | array | ❌ | API endpoint definitions |
| `adminPages` | array | ❌ | Admin page definitions |
| `adminNav` | array | ❌ | Admin navigation items |
| `settings` | array | ❌ | Plugin settings |
| `hooks` | object | ❌ | Lifecycle hooks |
| `capabilities` | array | ❌ | Feature tags |
| `permissions` | array | ❌ | Required permissions |

---

## Database Schema

### Creating Models

Create `prisma/schema.prisma` in your plugin:

```prisma
// Note: Do NOT include datasource or generator blocks
// These are managed by the core schema

model MyPluginItem {
  id          String   @id @default(uuid())
  name        String
  description String?
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

### Extending Core Models

To add relations to core models, you need to extend them:

**In your plugin schema:**
```prisma
model MyPluginItem {
  userId  String
  user    User   @relation(fields: [userId], references: [id])
}
```

**Note:** The `User` model's relation array is automatically handled during schema composition.

### Schema Composition Process

1. Core schema is loaded
2. Active plugins are detected from database
3. Plugin schemas are loaded and cleaned (datasource/generator removed)
4. Schemas are merged with plugin section headers
5. Composed schema is written to `prisma/schema.prisma`
6. Migrations can be created from the composed schema

**Run composition:**
```bash
npm run db:compose        # Compose and write
npm run db:compose:check  # Preview without writing
```

---

## API Routes

### Creating API Endpoints

API routes follow SvelteKit conventions. Create files in `server/routes/`:

**`server/routes/items/+server.ts`:**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/middleware/auth';
import * as itemsService from '../../services/items';

export const GET: RequestHandler = async (event) => {
  const user = await requireAuth(event);
  const items = await itemsService.getItems(user.id);
  return json({ items });
};

export const POST: RequestHandler = async (event) => {
  const user = await requireAuth(event);
  const data = await event.request.json();
  const item = await itemsService.createItem(user.id, data);
  return json({ item }, { status: 201 });
};
```

**`server/routes/items/[id]/+server.ts`:**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/middleware/auth';
import * as itemsService from '../../../services/items';

export const GET: RequestHandler = async (event) => {
  const { id } = event.params;
  const item = await itemsService.getItem(id);
  return json({ item });
};

export const PUT: RequestHandler = async (event) => {
  const user = await requireAuth(event);
  const { id } = event.params;
  const data = await event.request.json();
  const item = await itemsService.updateItem(id, data, user.id);
  return json({ item });
};

export const DELETE: RequestHandler = async (event) => {
  const user = await requireAuth(event);
  const { id } = event.params;
  await itemsService.deleteItem(id, user.id);
  return json({ success: true });
};
```

### Service Layer

Create business logic in `server/services/`:

**`server/services/items.ts`:**
```typescript
import { db } from '$lib/server/db/client';

export async function getItems(userId: string) {
  return db.myPluginItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getItem(id: string) {
  return db.myPluginItem.findUnique({
    where: { id },
    include: { user: true }
  });
}

export async function createItem(userId: string, data: any) {
  return db.myPluginItem.create({
    data: {
      ...data,
      userId
    }
  });
}

export async function updateItem(id: string, data: any, userId: string) {
  // Verify ownership
  const item = await db.myPluginItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) {
    throw new Error('Not authorized');
  }

  return db.myPluginItem.update({
    where: { id },
    data
  });
}

export async function deleteItem(id: string, userId: string) {
  // Verify ownership
  const item = await db.myPluginItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) {
    throw new Error('Not authorized');
  }

  return db.myPluginItem.delete({ where: { id } });
}
```

---

## Admin UI

### Creating Admin Pages

Admin pages use Svelte components:

**`admin/items/+page.svelte`:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  interface Item {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  }

  let items: Item[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    await loadItems();
  });

  async function loadItems() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      error = 'Not authenticated';
      loading = false;
      return;
    }

    try {
      const response = await fetch('/api/my-plugin/items', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load items');

      const data = await response.json();
      items = data.items;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function deleteItem(id: string) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`/api/my-plugin/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      await loadItems();
    }
  }
</script>

<div class="page">
  <header>
    <h1>My Plugin Items</h1>
    <button on:click={() => {/* navigate to create */}}>Create New</button>
  </header>

  {#if loading}
    <div>Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if items.length === 0}
    <div class="empty">No items yet</div>
  {:else}
    <div class="items-grid">
      {#each items as item}
        <div class="item-card">
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          <div class="actions">
            <button on:click={() => deleteItem(item.id)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .item-card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style>
```

---

## Lifecycle Hooks

### Available Hooks

```typescript
export interface PluginHooks {
  // Installation
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;

  // Activation
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;

  // Page events
  beforePagePublish?: (page: any) => Promise<any>;
  afterPagePublish?: (page: any) => Promise<void>;
  beforePageDelete?: (page: any) => Promise<void>;
  afterPageDelete?: (page: any) => Promise<void>;

  // User events
  onUserCreate?: (user: any) => Promise<void>;
  onUserUpdate?: (user: any) => Promise<void>;
  onUserDelete?: (user: any) => Promise<void>;

  // SEO hooks
  getSitemapEntries?: () => Promise<Array<{
    url: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
  }>>;
}
```

### Using Hooks

```typescript
export const manifest: PluginManifest = {
  // ...
  hooks: {
    onActivate: async () => {
      console.log('📝 My plugin activated');
      // Initialize data, check dependencies, etc.
    },

    beforePagePublish: async (page) => {
      // Modify page before publishing
      page.customField = 'Added by plugin';
      return page;
    },

    afterPagePublish: async (page) => {
      // React to page publication
      // e.g., send notification, update index, etc.
      await sendNotification(`Page published: ${page.title}`);
    },

    onUserCreate: async (user) => {
      // React to new user
      await createUserDefaults(user.id);
    },

    getSitemapEntries: async () => {
      // Provide sitemap entries for your plugin's content
      const { prisma } = await import('../../src/lib/server/db/client');
      const { getSetting } = await import('../../src/lib/server/services/settings');

      const siteSetting = await getSetting('site_url');
      const baseUrl = siteSetting?.value || 'http://localhost:5173';

      const items = await (prisma as any).myPluginItem.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true }
      });

      return items.map((item: any) => ({
        url: `${baseUrl}/my-plugin/${item.slug}`,
        lastmod: item.updatedAt.toISOString(),
        changefreq: 'weekly' as const,
        priority: 0.7
      }));
    }
  }
};
```

#### SEO Hook: `getSitemapEntries`

The `getSitemapEntries` hook allows your plugin to contribute entries to the site's XML sitemap (`/sitemap.xml`).

**Purpose:** Automatically include your plugin's content in search engine sitemaps for better SEO.

**Contract:**
- Must return an array of `SitemapEntry` objects
- Each entry must have a `url` (relative path like `/blog/post` **strongly preferred**, or absolute URL)
- Optional fields: `lastmod` (ISO date string), `changefreq`, `priority` (0.0-1.0)
- Hook is called every time the sitemap is generated
- Should only return publicly accessible, published content
- **Core normalization:** The sitemap service automatically:
  - Removes trailing slashes from base URLs
  - Prefixes relative paths with the normalized base URL
  - Removes double slashes (e.g., `//blog` → `/blog`)
  - Encodes URL paths for special characters

**Example (Blog Plugin):**

```typescript
getSitemapEntries: async () => {
  const { prisma } = await import('../../src/lib/server/db/client');

  // Cast to unknown, then narrow to typed interface
  const postModel = (prisma as unknown as Record<string, unknown>).post;
  if (!postModel || typeof postModel !== 'object') {
    return [];
  }

  const findMany = (postModel as Record<string, unknown>).findMany as
    | ((args: unknown) => Promise<unknown[]>)
    | undefined;

  if (!findMany) {
    return [];
  }

  // Query published posts
  const posts = await findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });

  // Return relative paths (preferred); core will normalize
  return posts.map((post) => {
    const p = post as { slug: string; updatedAt: Date };
    return {
      url: `/blog/${encodeURIComponent(p.slug)}`,
      lastmod: p.updatedAt.toISOString(),
      changefreq: 'monthly' as const,
      priority: 0.7
    };
  });
}
```

**Best Practices:**
- **Prefer relative URLs** (`/blog/post`) over absolute; core handles base domain
- Encode slugs with `encodeURIComponent()` for special characters
- Set appropriate `changefreq` based on content update patterns
- Set `priority` relative to other content (homepage = 1.0, blog posts ≈ 0.6-0.8)
- Only include public, SEO-friendly URLs
- Keep queries efficient (select only needed fields, add where clauses)
- Handle errors gracefully (return empty array on failure)
- Avoid `any` types; cast to `unknown` then narrow

---

## Best Practices

### 1. **Naming Conventions**

- Plugin ID: `@organization/plugin-name`
- Database models: Prefix with plugin name (e.g., `BlogPost`, `BlogCategory`)
- API routes: Namespace under plugin (e.g., `/api/blog/...`)
- Admin routes: Namespace under plugin (e.g., `/admin/blog/...`)

### 2. **Version Management**

- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Document breaking changes
- Provide migration guides for major versions

### 3. **Error Handling**

```typescript
export const GET: RequestHandler = async (event) => {
  try {
    const user = await requireAuth(event);
    const items = await getItems(user.id);
    return json({ items });
  } catch (error) {
    console.error('Failed to get items:', error);
    return json(
      { error: 'Failed to load items' },
      { status: 500 }
    );
  }
};
```

### 4. **TypeScript Types**

Define and export types for your plugin:

```typescript
// types.ts
export interface MyPluginItem {
  id: string;
  name: string;
  description: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemData {
  name: string;
  description?: string;
}
```

### 5. **Testing**

Create tests for your plugin:

```typescript
// tests/items.test.ts
import { describe, it, expect } from 'vitest';
import * as itemsService from '../server/services/items';

describe('Items Service', () => {
  it('should create item', async () => {
    const item = await itemsService.createItem('user-1', {
      name: 'Test Item',
      description: 'Test'
    });
    expect(item.name).toBe('Test Item');
  });
});
```

### 6. **Documentation**

Every plugin should have:
- README.md with installation/usage instructions
- API documentation
- Configuration examples
- Changelog

---

## Example: Blog Plugin

The blog plugin is a complete reference implementation. Study it at `plugins/blog/`.

**Key files:**
- `manifest.ts` - Full manifest configuration
- `prisma/schema.prisma` - Blog data models
- `server/services/posts.ts` - Post management logic
- `server/routes/posts/+server.ts` - Post API
- `admin/posts/+page.svelte` - Admin UI

---

## Publishing Plugins

### 1. **Prepare for Publication**

```json
// package.json
{
  "name": "@linebasis/my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.ts",
  "repository": "https://github.com/org/my-plugin",
  "keywords": ["linebasis", "plugin", "cms"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 2. **Test Thoroughly**

```bash
npm run db:compose:check  # Check schema composition
npm run test              # Run tests
npm run build             # Build plugin
```

### 3. **Publish to NPM**

```bash
npm publish --access public
```

### 4. **Installation**

Users can install via:

```bash
npm install @linebasis/my-plugin
```

Then copy to `plugins/` directory and activate via admin UI.

---

## Support

- **Documentation:** https://docs.linebasis.com
- **GitHub:** https://github.com/linebasis/linebasis
- **Discord:** https://discord.gg/linebasis

---

**Happy Plugin Development!** 🔌
