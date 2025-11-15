# Custom Blocks Developer Guide

**Status**: Phase 2 Feature (Planned)

This guide explains how to create custom coded blocks for Linabasis - Svelte components that appear in the designer with editable properties.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Block Structure](#block-structure)
4. [Property Schemas](#property-schemas)
5. [Custom Property Editors](#custom-property-editors)
6. [Editor vs Live Mode](#editor-vs-live-mode)
7. [Plugin Blocks](#plugin-blocks)
8. [Examples](#examples)
9. [Best Practices](#best-practices)
10. [API Reference](#api-reference)

---

## Overview

Custom blocks enable developers to extend Linabasis with coded Svelte components while maintaining the visual editing experience for users.

### Use Cases

- **Interactive elements**: Carousels, accordions, tabs, modals
- **Animations**: Fade-in sections, scroll-triggered effects, parallax
- **Client-specific features**: Custom contact forms, product showcases, pricing tables
- **Advanced layouts**: Masonry grids, infinite scroll, filterable galleries
- **Integrations**: Embed widgets, social media feeds, map components

### Block Types

| Type | Created By | Editable | Use Case |
|------|------------|----------|----------|
| **User Blocks** | Designer (select → convert) | Properties only | Reusable design patterns |
| **Custom Blocks** | Code (Svelte component) | Via schema | Complex interactions |
| **Plugin Blocks** | Plugin manifest | Via schema | Distributable features |

---

## Quick Start

### 1. Create Block Component

```bash
# For local block
touch src/lib/components/blocks/Carousel.svelte
```

### 2. Define Block Metadata

```svelte
<!-- src/lib/components/blocks/Carousel.svelte -->
<script context="module" lang="ts">
  // Block metadata (required)
  export const blockMeta = {
    id: 'carousel',
    name: 'Image Carousel',
    category: 'interactive',
    thumbnail: '/thumbnails/carousel.png', // Optional
    description: 'Responsive image carousel with autoplay'
  };

  // Property schema (optional, but recommended)
  export const blockProperties = {
    images: {
      type: 'array',
      itemType: 'media',
      label: 'Carousel Images',
      default: []
    },
    autoplay: {
      type: 'boolean',
      label: 'Auto Play',
      default: true
    },
    interval: {
      type: 'number',
      label: 'Slide Interval (ms)',
      min: 1000,
      max: 10000,
      step: 1000,
      default: 5000
    }
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  // Mode prop (REQUIRED for all custom blocks)
  export let mode: 'editor' | 'live' = 'live';

  // Properties (match blockProperties schema)
  export let images: string[] = [];
  export let autoplay: boolean = true;
  export let interval: number = 5000;

  // Internal state
  let currentSlide = 0;

  onMount(() => {
    if (autoplay && mode === 'live') {
      const id = setInterval(() => {
        currentSlide = (currentSlide + 1) % images.length;
      }, interval);
      return () => clearInterval(id);
    }
  });
</script>

{#if mode === 'editor'}
  <!-- Simplified preview for designer -->
  <div class="carousel-preview">
    {#if images.length === 0}
      <p>Add images in Properties panel</p>
    {:else}
      <img src={images[0]} alt="Preview" />
      <span class="badge">{images.length} images</span>
    {/if}
  </div>
{:else}
  <!-- Full carousel for live pages -->
  <div class="carousel">
    {#each images as image, i}
      <div class="slide" class:active={i === currentSlide}>
        <img src={image} alt="Slide {i + 1}" />
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Your styles */
</style>
```

### 3. Use in Designer

1. Open designer
2. Blocks window shows "Carousel" under "Custom Blocks"
3. Drag to canvas
4. Edit properties in Properties window
5. Preview and publish

---

## Block Structure

### Required Exports

#### `blockMeta` (Required)

Defines block identity and appearance in designer:

```typescript
export const blockMeta = {
  id: string;              // Unique identifier (e.g., 'carousel')
  name: string;            // Display name in Blocks window
  category: string;        // 'layout' | 'content' | 'interactive' | 'media' | 'custom'
  thumbnail?: string;      // Path to preview image
  description?: string;    // Tooltip text
};
```

#### `blockProperties` (Optional but Recommended)

Defines editable properties:

```typescript
export const blockProperties = {
  [propName]: PropertyDefinition;
};
```

See [Property Schemas](#property-schemas) for details.

#### `propertyEditor` (Optional)

Custom property editor component:

```typescript
export const propertyEditor = CustomEditorComponent;
```

### Required Props

#### `mode` (Required)

All custom blocks MUST accept a `mode` prop:

```svelte
<script>
  export let mode: 'editor' | 'live' = 'live';
</script>
```

- `editor`: Simplified preview in designer
- `live`: Full functionality in published pages

#### Property Props

Exported variables matching `blockProperties` schema:

```svelte
<script>
  // These match blockProperties keys
  export let images: string[] = [];
  export let autoplay: boolean = true;
  export let interval: number = 5000;
</script>
```

---

## Property Schemas

Property schemas define editable fields in the Properties window and auto-generate UI.

### Basic Types

#### Text

```typescript
{
  type: 'text',
  label: 'Title',
  default: 'Hello World',
  placeholder: 'Enter title...',
  maxLength: 100
}
```

**Generates**: Text input

#### Rich Text

```typescript
{
  type: 'richtext',
  label: 'Description',
  default: '<p>Formatted text</p>',
  toolbar: ['bold', 'italic', 'link'] // Optional: limit toolbar
}
```

**Generates**: Rich text editor

#### Number

```typescript
{
  type: 'number',
  label: 'Width',
  default: 800,
  min: 100,
  max: 2000,
  step: 10,
  control: 'slider' // or 'input' (default)
}
```

**Generates**: Number input or slider

#### Boolean

```typescript
{
  type: 'boolean',
  label: 'Enable Feature',
  default: true
}
```

**Generates**: Toggle switch

### Selection Types

#### Select (Dropdown)

```typescript
{
  type: 'select',
  label: 'Animation Type',
  options: ['fade', 'slide', 'zoom'],
  default: 'fade'
}
```

**Generates**: Dropdown menu

#### Radio

```typescript
{
  type: 'radio',
  label: 'Alignment',
  options: [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
  ],
  default: 'left'
}
```

**Generates**: Radio button group

### Media Types

#### Media (Image/Video/Document)

```typescript
{
  type: 'media',
  mediaType: 'image', // 'image' | 'video' | 'document' | 'any'
  label: 'Background Image',
  default: ''
}
```

**Generates**: Media picker button (opens media library)

#### Color

```typescript
{
  type: 'color',
  label: 'Background Color',
  default: '#ffffff',
  showAlpha: true // Optional: include opacity
}
```

**Generates**: Color picker

### URL

```typescript
{
  type: 'url',
  label: 'Link',
  default: '',
  placeholder: 'https://...',
  validate: true // Optional: URL validation
}
```

**Generates**: URL input with validation

### Complex Types

#### Array

```typescript
{
  type: 'array',
  itemType: 'media', // or any property type
  label: 'Carousel Images',
  default: [],
  minItems: 1,
  maxItems: 10
}
```

**Generates**: List with add/remove buttons

#### Object

```typescript
{
  type: 'object',
  label: 'Button Settings',
  properties: {
    text: { type: 'text', label: 'Text', default: 'Click me' },
    url: { type: 'url', label: 'URL', default: '' },
    style: { type: 'select', options: ['primary', 'secondary'], default: 'primary' }
  }
}
```

**Generates**: Nested property group

---

## Custom Property Editors

For complex UI needs, create custom property editor components.

### When to Use

- **Visual reordering**: Drag & drop image grid
- **Live previews**: Show animation timing visually
- **Complex inputs**: Multi-field configurations
- **Special workflows**: Custom media selectors, color palette builders

### Creating Custom Editor

```svelte
<!-- src/lib/components/blocks/editors/CarouselEditor.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CarouselProperties } from '../types';

  // Receives current property values
  export let properties: CarouselProperties;

  // Dispatch property updates
  const dispatch = createEventDispatcher<{
    update: { key: string; value: any };
  }>();

  function updateProperty(key: string, value: any) {
    dispatch('update', { key, value });
  }

  function addImage(url: string) {
    updateProperty('images', [...properties.images, url]);
  }

  function removeImage(index: number) {
    const newImages = properties.images.filter((_, i) => i !== index);
    updateProperty('images', newImages);
  }

  function reorderImages(fromIndex: number, toIndex: number) {
    const newImages = [...properties.images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    updateProperty('images', newImages);
  }

  // Media picker integration
  import { openMediaPicker } from '$lib/utils/media-picker';

  async function selectImage() {
    const media = await openMediaPicker({ type: 'image' });
    if (media) addImage(media.url);
  }
</script>

<div class="carousel-editor">
  <h4>Carousel Images</h4>

  <!-- Draggable image grid -->
  <div class="image-grid">
    {#each properties.images as image, i (image)}
      <div
        class="image-item"
        draggable="true"
        on:dragstart={(e) => e.dataTransfer.setData('index', i.toString())}
        on:drop={(e) => {
          e.preventDefault();
          const from = parseInt(e.dataTransfer.getData('index'));
          reorderImages(from, i);
        }}
        on:dragover={(e) => e.preventDefault()}
      >
        <img src={image} alt="Slide {i + 1}" />
        <button class="remove" on:click={() => removeImage(i)}>×</button>
        <div class="order">{i + 1}</div>
      </div>
    {/each}

    <button class="add-btn" on:click={selectImage}>
      + Add Image
    </button>
  </div>

  <!-- Autoplay toggle -->
  <label class="setting">
    <input
      type="checkbox"
      checked={properties.autoplay}
      on:change={(e) => updateProperty('autoplay', e.target.checked)}
    />
    <span>Auto Play</span>
  </label>

  <!-- Interval slider with live preview -->
  <div class="setting">
    <label>Slide Interval: {properties.interval}ms</label>
    <input
      type="range"
      min="1000"
      max="10000"
      step="1000"
      value={properties.interval}
      on:input={(e) => updateProperty('interval', +e.target.value)}
    />
    <div
      class="interval-indicator"
      style="animation-duration: {properties.interval}ms"
    />
  </div>
</div>

<style>
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .image-item {
    position: relative;
    aspect-ratio: 16/9;
    cursor: move;
  }

  .image-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }

  .remove {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0,0,0,0.7);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
  }

  .order {
    position: absolute;
    bottom: 4px;
    left: 4px;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 2px 6px;
    border-radius: 2px;
    font-size: 12px;
  }

  .interval-indicator {
    height: 4px;
    background: var(--color-primary);
    animation: slide infinite linear;
  }

  @keyframes slide {
    from { width: 0%; }
    to { width: 100%; }
  }
</style>
```

### Registering Custom Editor

```svelte
<!-- Carousel.svelte -->
<script context="module">
  import CarouselEditor from './editors/CarouselEditor.svelte';

  export const blockMeta = { /* ... */ };
  export const blockProperties = { /* ... */ };
  export const propertyEditor = CarouselEditor; // ← Register here
</script>
```

---

## Editor vs Live Mode

Custom blocks must handle two modes:

### Editor Mode

Simplified preview in designer:

```svelte
{#if mode === 'editor'}
  <div class="block-editor-preview">
    <!-- Lightweight preview -->
    <!-- No heavy JavaScript -->
    <!-- Show placeholder if no content -->
    <!-- Visual indication of block type -->
  </div>
{/if}
```

**Guidelines**:
- Keep it simple (performance)
- Show placeholder if empty
- Avoid expensive operations
- No autoplay/animations
- Static preview preferred

### Live Mode

Full functionality in published pages:

```svelte
{:else}
  <div class="block-live">
    <!-- Full interactive component -->
    <!-- All JavaScript active -->
    <!-- Animations, event handlers, etc. -->
  </div>
{/if}
```

**Guidelines**:
- Full interactivity
- Production-ready code
- Performance optimized
- Accessibility compliant

---

## Plugin Blocks

Distribute blocks via plugins for portability and sharing.

### Plugin Structure

```
plugins/
└── my-blocks/
    ├── manifest.ts
    ├── blocks/
    │   ├── Carousel.svelte
    │   ├── FadeIn.svelte
    │   └── Tabs.svelte
    ├── editors/
    │   └── CarouselEditor.svelte
    ├── assets/
    │   └── thumbnails/
    │       ├── carousel.png
    │       ├── fadein.png
    │       └── tabs.png
    └── README.md
```

### Plugin Manifest

```typescript
// plugins/my-blocks/manifest.ts
import type { Plugin } from '$lib/core/plugins/types';

export const manifest: Plugin = {
  id: '@myagency/custom-blocks',
  name: 'Custom Blocks Collection',
  version: '1.0.0',
  description: 'Professional interactive blocks',
  author: 'Your Agency',

  blocks: [
    {
      id: 'carousel',
      name: 'Image Carousel',
      category: 'interactive',
      component: './blocks/Carousel.svelte',
      thumbnail: './assets/thumbnails/carousel.png',
      description: 'Responsive carousel with autoplay and touch support',

      properties: {
        images: {
          type: 'array',
          itemType: 'media',
          label: 'Images',
          default: []
        },
        autoplay: {
          type: 'boolean',
          label: 'Auto Play',
          default: true
        },
        interval: {
          type: 'number',
          label: 'Interval (ms)',
          min: 1000,
          max: 10000,
          default: 5000
        }
      },

      propertyEditor: './editors/CarouselEditor.svelte'
    },
    {
      id: 'fade-in',
      name: 'Fade In Section',
      category: 'interactive',
      component: './blocks/FadeIn.svelte',
      // ... more blocks
    }
  ]
};
```

### Installing Plugin

```bash
# Development: Symlink local plugin
cd plugins
ln -s /path/to/my-blocks my-blocks

# Or: Copy to plugins folder
cp -r /path/to/my-blocks plugins/

# Activate in admin
# /admin/plugins → Enable "Custom Blocks Collection"
```

---

## Examples

### Example 1: Fade In Section

Simple scroll-triggered fade-in animation:

```svelte
<script context="module">
  export const blockMeta = {
    id: 'fade-in-section',
    name: 'Fade In Section',
    category: 'interactive'
  };

  export const blockProperties = {
    triggerPoint: {
      type: 'number',
      label: 'Trigger Point (%)',
      min: 0,
      max: 100,
      default: 75,
      description: 'Scroll percentage before animation triggers'
    },
    duration: {
      type: 'number',
      label: 'Duration (ms)',
      min: 100,
      max: 2000,
      default: 600
    },
    direction: {
      type: 'select',
      label: 'Direction',
      options: ['up', 'down', 'left', 'right'],
      default: 'up'
    }
  };
</script>

<script>
  import { onMount } from 'svelte';

  export let mode = 'live';
  export let triggerPoint = 75;
  export let duration = 600;
  export let direction = 'up';

  let element: HTMLElement;
  let visible = false;

  onMount(() => {
    if (mode === 'live') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visible = true;
          }
        },
        { threshold: triggerPoint / 100 }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }
  });

  $: transform = {
    up: 'translateY(50px)',
    down: 'translateY(-50px)',
    left: 'translateX(50px)',
    right: 'translateX(-50px)'
  }[direction];
</script>

{#if mode === 'editor'}
  <div class="fade-preview" bind:this={element}>
    <slot />
    <div class="badge">Fades in on scroll</div>
  </div>
{:else}
  <div
    bind:this={element}
    class="fade-section"
    class:visible
    style="
      transition-duration: {duration}ms;
      transform: {visible ? 'none' : transform};
      opacity: {visible ? 1 : 0};
    "
  >
    <slot />
  </div>
{/if}
```

### Example 2: Testimonial Carousel

```svelte
<script context="module">
  export const blockMeta = {
    id: 'testimonials',
    name: 'Testimonials Carousel',
    category: 'content'
  };

  export const blockProperties = {
    testimonials: {
      type: 'array',
      itemType: 'object',
      label: 'Testimonials',
      default: [],
      itemSchema: {
        quote: { type: 'richtext', label: 'Quote' },
        author: { type: 'text', label: 'Author' },
        role: { type: 'text', label: 'Role' },
        avatar: { type: 'media', mediaType: 'image', label: 'Avatar' }
      }
    },
    autoRotate: {
      type: 'boolean',
      label: 'Auto Rotate',
      default: true
    },
    interval: {
      type: 'number',
      label: 'Interval (sec)',
      min: 3,
      max: 10,
      default: 5
    }
  };
</script>

<script>
  export let mode = 'live';
  export let testimonials = [];
  export let autoRotate = true;
  export let interval = 5;

  let current = 0;

  // Implementation...
</script>
```

---

## Best Practices

### Performance

- ✅ Use `{#if mode === 'editor'}` for lightweight previews
- ✅ Avoid heavy computations in editor mode
- ✅ Lazy load images in live mode
- ✅ Clean up timers/observers in `onDestroy`
- ❌ Don't run animations in editor mode

### Accessibility

- ✅ Include ARIA labels
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ Screen reader friendly
- ✅ Semantic HTML

### User Experience

- ✅ Provide sensible defaults
- ✅ Show placeholders when empty
- ✅ Clear property labels
- ✅ Helpful descriptions
- ✅ Validate inputs

### Code Quality

- ✅ TypeScript for type safety
- ✅ Comment complex logic
- ✅ Consistent naming
- ✅ Reusable utilities
- ✅ Test thoroughly

---

## API Reference

### Block Meta API

```typescript
interface BlockMeta {
  id: string;              // Unique ID
  name: string;            // Display name
  category: string;        // Category
  thumbnail?: string;      // Preview image path
  description?: string;    // Tooltip/help text
}
```

### Property Definition API

```typescript
type PropertyType =
  | 'text' | 'richtext' | 'number' | 'boolean'
  | 'select' | 'radio' | 'media' | 'color' | 'url'
  | 'array' | 'object';

interface PropertyDefinition {
  type: PropertyType;
  label: string;
  default?: any;
  description?: string;

  // Type-specific options
  min?: number;            // For number
  max?: number;            // For number
  step?: number;           // For number
  control?: 'input' | 'slider'; // For number

  options?: string[] | {value: string, label: string}[]; // For select/radio

  mediaType?: 'image' | 'video' | 'document' | 'any'; // For media
  showAlpha?: boolean;     // For color
  validate?: boolean;      // For url

  itemType?: PropertyType | PropertyDefinition; // For array
  minItems?: number;       // For array
  maxItems?: number;       // For array

  properties?: Record<string, PropertyDefinition>; // For object
}
```

### Custom Editor API

```typescript
interface CustomEditorProps {
  properties: Record<string, any>; // Current values
}

interface CustomEditorEvents {
  update: { key: string; value: any }; // Property update
}
```

---

## Next Steps

1. **Read**: [architecture.md](./architecture.md) for system overview
2. **See**: [page-builder-spec.md](./page-builder-spec.md) for UI details
3. **Try**: Create your first custom block (Phase 2)
4. **Share**: Publish plugin to marketplace (Phase 4)

---

**Phase 2 Status**: Custom block system coming after core page builder release. Documentation prepared for implementation.
