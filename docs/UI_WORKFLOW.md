# UI Development Workflow

**Process**: Claude builds unstyled functional HTML → Ibaldo adds styles and design

---

## Directory Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Generic UI components (Button, Input, Card)
│   │   │   └── *.svelte     # Claude: markup + logic | Ibaldo: styles
│   │   └── layout/          # Layout components (Header, Sidebar, Nav)
│   │       └── *.svelte     # Claude: structure | Ibaldo: design
│   ├── design/              # Design system (Ibaldo owns)
│   │   ├── tokens.ts        # Colors, spacing, typography, etc.
│   │   └── global.css       # Global styles, resets, utilities
│   ├── stores/              # State management (Claude handles)
│   └── server/              # Backend logic (Claude handles)
├── routes/
│   └── admin/               # Admin pages
│       ├── login/+page.svelte           # Claude: HTML + auth logic | Ibaldo: CSS
│       ├── designer/[pageId]/+page.svelte
│       └── ...
```

---

## Workflow Steps

### 1. Claude Creates Unstyled Page

**Principles:**
- Semantic HTML5 (proper tags: `<main>`, `<section>`, `<nav>`, etc.)
- Accessible (ARIA labels, keyboard navigation, form labels)
- Functional (all logic working, validation, error handling)
- Class names for styling hooks (descriptive, BEM-style if needed)
- NO inline styles, NO framework-specific classes (unless requested)

**Example:**
```svelte
<script lang="ts">
  // All TypeScript logic, validation, API calls
  let email = '';
  let password = '';
  // ...
</script>

<main class="login-page">
  <div class="login-container">
    <h1 class="login-title">Welcome to Linabasis</h1>
    <form class="login-form" on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="email" class="form-label">Email</label>
        <input type="email" id="email" class="form-input" bind:value={email} />
      </div>
      <!-- More fields... -->
      <button type="submit" class="button-primary">Login</button>
    </form>
  </div>
</main>

<!-- NO STYLES - Ibaldo adds these -->
```

### 2. Ibaldo Adds Styles

**Options:**
- Add `<style>` block in the same `.svelte` file (scoped)
- Create separate CSS files and import
- Use design tokens from `src/lib/design/tokens.ts`
- Any CSS approach (vanilla, Tailwind, CSS modules, etc.)

**Example:**
```svelte
<!-- Same file, add style block at bottom -->
<style>
  .login-page {
    /* Ibaldo's design */
  }

  .login-container {
    /* ... */
  }
</style>
```

Or create separate file:
```css
/* src/lib/design/pages/login.css */
.login-page { /* ... */ }
```

### 3. Iterate if Needed

- Markup adjustment for design needs
- Claude updates logic if structure changes
- Ibaldo refines styles

---

## Handoff Points (Comments in Code)

Claude will mark styling handoff points with comments:

```svelte
<!-- STYLE: Main login container - center on viewport -->
<div class="login-container">

  <!-- STYLE: Logo area - brand colors, spacing -->
  <div class="login-logo">
    <h1 class="login-title">Linabasis</h1>
  </div>

  <!-- STYLE: Form card - white background, shadow, rounded corners -->
  <form class="login-form">
    <!-- ... -->
  </form>
</div>
```

---

## Class Naming Convention

**Pattern**: `{component}-{element}` or `{page}-{section}-{element}`

**Examples:**
- `.login-container`, `.login-form`, `.login-title`
- `.designer-toolbar`, `.designer-canvas`, `.designer-sidebar`
- `.button-primary`, `.button-secondary`, `.form-input`, `.form-label`

Clear, descriptive, easy to style!

---

## Communication

**When Claude is done with a page:**
- ✅ Functionality is complete and tested
- ✅ HTML structure is semantic and accessible
- ✅ Class names are in place
- ✅ Comments mark styling areas
- 🎨 **Ready for Ibaldo's design!**

**When Ibaldo is done styling:**
- Can commit styles directly
- Or request markup adjustments if needed

---

## First Page: Login

**Status**: Next to be built
**Claude will create**: Unstyled HTML with full authentication logic
**Ibaldo will add**: Design, colors, spacing, typography

---

This workflow keeps concerns separated and lets each person focus on their expertise! 🚀
