# Component Properties Specification

This document defines the **user-controllable properties** for all components in the Linabasis page builder. These properties represent what users can adjust in the design interface, not the underlying technical implementation.

## Design Principles

- **User-Centric**: Properties reflect what users actually control in the design interface
- **Design-First**: Properties are organized by design decisions, not technical implementation
- **Baseline Grid Integration**: Numeric values snap to baseline grid when `snapToBaseline: true`
- **CSS Variables**: Global theme tokens available via CSS variable references
- **No Inheritance**: Each component has independent properties; no automatic CSS inheritance
- **Component Wrapping**: Text and media components are always wrapped by divs

## Important Note

These are **user-defined properties** that represent design choices. How the component handles these properties (CSS generation, layout algorithms, etc.) is handled by the component implementation layer, not by the user interface.

## General Properties

*Note: These properties represent what users control in the design interface*

```typescript
general {
    // Identification
    id: string                    // Unique identifier
    name: string                  // Display name for the component
    type: string                  // Component type identifier
    order: number                 // Visual order from top to bottom
    
    // Position & Layout
    position: {
        // User chooses how element behaves in layout
        behavior: "normal" | "floating" | "sticky" | "fixed"
        // User sets distances from edges (visual positioning)
        from-top: number + unit
        from-bottom: number + unit
        from-left: number + unit
        from-right: number + unit
        // User controls stacking order (which elements appear on top)
        layer: number
    }
    
    // Size
    size: {
        // User sets width behavior
        width: "auto" | "fit-content" | "fill-parent" | number + unit | "%"
        // User sets height behavior  
        height: "auto" | "fit-content" | "fill-parent" | number + unit | "%"
        // User sets size constraints
        min-width: "none" | number + unit
        max-width: "none" | number + unit
        min-height: "none" | number + unit
        max-height: "none" | number + unit
    }
    
    // Spacing
    spacing: {
        // User sets internal spacing (space inside the element)
        padding: number | {top: number, right: number, bottom: number, left: number}
        // User sets external spacing (space around the element)
        margin: number | {top: number, right: number, bottom: number, left: number}
    }
    
    // Transform
    transform: {
        // User rotates the element
        rotation: number          // Degrees (0-360)
        // User scales the element
        scale: number             // Scale factor (1.0 = 100%)
        // User moves the element
        move-x: number            // Horizontal movement in pixels
        move-y: number            // Vertical movement in pixels
    }
    
    // Visual Style
    visual: {
        // User sets transparency
        opacity: number           // 0-100 percentage
        // User chooses blend mode
        blend-mode: "normal" | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" | "color-dodge" | "color-burn" | "darken" | "lighten" | "difference" | "exclusion"
        // User rounds corners
        corner-radius: number | {top-left: number, top-right: number, bottom-right: number, bottom-left: number}
    }
    
    // Background
    background: {
        // User chooses background type
        type: "color" | "image" | "gradient" | "none"
        // Color background
        color: string             // Color picker value or theme color
        // Image background
        image: string             // Media library selection
        image-fit: "cover" | "contain" | "fill" | "scale-down"
        image-position: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right" | "custom"
        image-repeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y"
        // Gradient background
        gradient: {
            type: "linear" | "radial" | "conic"
            direction: number     // For linear gradients (0-360 degrees)
            stops: Array<{
                color: string
                opacity: number   // 0-100 percentage
                position: number  // 0-100 percentage
            }>
        }
    }
    
    // Border
    border: {
        // User enables/disables border
        enabled: boolean
        // User sets border appearance
        color: string             // Color picker value or theme color
        width: number | {top: number, right: number, bottom: number, left: number}
        style: "solid" | "dashed" | "dotted"
    }
    
    // Effects
    effects: Array<{
        // User adds visual effects
        type: "drop-shadow" | "inner-shadow" | "blur" | "brightness" | "contrast" | "saturate"
        // Shadow effects
        shadow-x?: number         // Horizontal offset
        shadow-y?: number         // Vertical offset
        shadow-blur?: number      // Blur radius
        shadow-spread?: number    // Spread radius
        shadow-color?: string     // Shadow color
        // Filter effects
        filter-amount?: number    // For brightness, contrast, saturate (0-200%)
    }>
    
    // Responsive Design
    responsive: {
        // User sets different properties for different screen sizes
        mobile: object            // Properties for mobile screens
        tablet: object            // Properties for tablet screens
        desktop: object           // Properties for desktop screens
    }
    
    // Baseline Grid Integration
    snapToBaseline: boolean      // User chooses to snap to baseline grid
    baselineOffset: number       // User sets baseline offset
}
```

## Div Component

*Container component for layout and grouping other components*

```typescript
div {
    // Layout Controls (Framer-style)
    layout: {
        // Type: Stack or Grid (segmented control)
        type: "stack" | "grid"
        
        // Direction: Horizontal or Vertical (icon-based segmented control)
        direction: "horizontal" | "vertical"
        
        // Distribute: How items are spaced along main axis (dropdown)
        distribute: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly"
        
        // Align: How items align along cross axis (icon-based segmented control)
        align: "start" | "center" | "end" | "stretch"
        
        // Wrap: Whether items wrap (Yes/No segmented control)
        wrap: "yes" | "no"
        
        // Gap: Spacing between items (slider + input)
        gap: number              // In pixels or baseline units
    }
    
    // Grid-specific (only shown when type = "grid")
    grid: {
        // Columns: Number of columns (input field)
        columns: number | "auto"
        
        // Rows: Number of rows (input field, optional)
        rows: number | "auto"
    }
    
    // Content Behavior
    content: {
        // Overflow behavior
        overflow: "visible" | "hidden" | "scroll" | "auto"
        
        // Fill available space
        fill-space: boolean
    }
    
    // Link Behavior
    // User can make the entire div clickable
    link: {
        // Enable link behavior
        enabled: boolean
        
        // Link destination
        url: string
        
        // Where link opens
        target: "same-tab" | "new-tab"
        
        // Link relationship
        relationship: "none" | "noopener" | "noreferrer" | "noopener-noreferrer"
    }
    
    // SEO & Semantic
    // User sets semantic HTML and accessibility
    semantic: {
        // HTML element type
        element: "div" | "section" | "article" | "aside" | "header" | "footer" | "main" | "nav"
        
        // Accessibility
        aria-label: string
        aria-role: string
        aria-labelledby: string
        aria-describedby: string
        
        // SEO importance
        importance: "normal" | "high" | "low"
    }
    
    // Children
    children: string[]           // Array of child component IDs
    
    // Implementation Note:
    // The component intelligently maps user choices to CSS:
    // - type: "stack" + direction: "vertical" → display: flex, flex-direction: column
    // - type: "stack" + direction: "horizontal" → display: flex, flex-direction: row
    // - type: "grid" → display: grid, grid-template-columns: repeat(columns, 1fr)
    // - distribute: "space-between" → justify-content: space-between
    // - align: "center" → align-items: center
    // - wrap: "yes" → flex-wrap: wrap
    // - gap: 60 → gap: 60px (or baseline units if snapToBaseline = true)
    // - link.enabled: true → wraps content in <a> tag or adds click handler
    // - semantic.element: "section" → renders as <section> instead of <div>
}
```

## Text Component

*Text content with rich formatting capabilities*

```typescript
text {
    // Content
    content: string | RichTextStructure
    
    // Text Style
    // User chooses from predefined styles or custom
    style: {
        // Predefined text styles (like design system tokens)
        preset: "heading-1" | "heading-2" | "heading-3" | "heading-4" | "heading-5" | "heading-6" | "body" | "caption" | "small" | "custom"
        
        // Custom typography (when preset = "custom")
        custom: {
            font-family: string      // Font family or theme font
            font-size: number + unit
            font-weight: "light" | "normal" | "medium" | "semibold" | "bold" | "black"
            font-style: "normal" | "italic"
            line-height: number | "auto"
            letter-spacing: number + unit
        }
    }
    
    // Text Alignment
    // User chooses how text aligns
    alignment: "left" | "center" | "right" | "justify"
    
    // Text Formatting
    // User applies formatting to text
    formatting: {
        // Text transformation
        transform: "none" | "uppercase" | "lowercase" | "capitalize"
        
        // Text decoration
        decoration: "none" | "underline" | "line-through" | "overline"
        decoration-color: string
        decoration-style: "solid" | "double" | "dotted" | "dashed" | "wavy"
    }
    
    // Color
    // User chooses text color
    color: {
        type: "theme" | "custom"
        theme-color: "primary" | "secondary" | "accent" | "text" | "muted"
        custom-color: string
    }
    
    // Link Behavior (when text contains links)
    link: {
        href: string
        target: "same-tab" | "new-tab"
        style: "default" | "custom"  // Whether to use default link styling
    }
    
    // Rich Text Formatting (for inline styles)
    // User applies formatting to specific parts of text
    inline-formatting: Array<{
        start: number            // Character index start
        end: number              // Character index end
        styles: {
            bold: boolean
            italic: boolean
            underline: boolean
            color: string
            background-color: string
            font-size: number + unit
            font-family: string
        }
    }>
    
    // SEO & Accessibility
    // User sets accessibility and SEO properties
    accessibility: {
        // Screen reader label
        screen-reader-label: string
        
        // Semantic importance
        importance: "normal" | "high" | "low"
        
        // Rich snippet type
        rich-snippet-type: "article" | "faq" | "product" | "none"
        
        // Rich snippet content
        rich-snippet: string
        
        // Language (if different from page)
        language: string
        
        // Tab order (if interactive)
        tab-order: number
        
        // Hide from screen readers
        hidden-from-screen-readers: boolean
    }
    
    // Implementation Note:
    // The component intelligently determines HTML element type based on style preset:
    // - "heading-1" through "heading-6" → h1 through h6
    // - "body" → p
    // - "caption" → small
    // - "custom" → span (or user-specified element)
    // Link behavior is handled automatically when href is provided
}
```

## Media Component

*Images and videos with responsive support*

```typescript
media {
    // Media Source
    // User chooses where media comes from
    source: {
        type: "upload" | "library" | "url"
        file: string             // File path, library ID, or URL
        alt-text: string         // Required for accessibility
    }
    
    // Media Type
    // User specifies what type of media
    media-type: "image" | "video"
    
    // Display Style
    // User chooses how media displays
    display: {
        // How media fits in container
        fit: "cover" | "contain" | "fill" | "original" | "scale-down"
        
        // Position of media within container
        position: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right" | "custom"
        
        // Custom position (when position = "custom")
        custom-position: {x: number, y: number}
        
        // Aspect ratio behavior
        aspect-ratio: "auto" | "16:9" | "4:3" | "1:1" | "3:2" | "custom"
        custom-aspect-ratio: number  // When aspect-ratio = "custom"
    }
    
    // Loading Behavior
    // User chooses how media loads
    loading: {
        // When to load the media
        behavior: "immediate" | "lazy" | "on-scroll"
        
        // Placeholder while loading
        placeholder: "none" | "blur" | "color" | "custom"
        placeholder-color: string
        placeholder-image: string
    }
    
    // Video-specific settings
    // User controls video playback
    video: {
        // Thumbnail image
        thumbnail: string
        
        // Playback controls
        show-controls: boolean
        autoplay: boolean
        loop: boolean
        muted: boolean
        plays-inline: boolean
    }
    
    // Responsive Behavior
    // User sets how media adapts to different screens
    responsive: {
        // Enable responsive behavior
        enabled: boolean
        
        // Different images for different screen sizes
        mobile-image: string
        tablet-image: string
        desktop-image: string
        
        // Different display settings per screen size
        mobile-display: object
        tablet-display: object
        desktop-display: object
    }
    
    // SEO & Accessibility
    // User sets metadata and accessibility
    metadata: {
        // Title for SEO
        title: string
        
        // Caption for display
        caption: string
        
        // Alt text for accessibility
        alt-text: string
        
        // Copyright information
        copyright: string
    }
    
    // Implementation Note:
    // The component intelligently handles:
    // - Responsive image generation (srcset, sizes)
    // - Lazy loading implementation
    // - Video optimization and fallbacks
    // - Accessibility attributes
    // - SEO metadata
}
```

## Form Component

*Complete form with fields, validation, and submission*

```typescript
form {
    // Form Configuration
    // User sets form behavior and API integration
    config: {
        name: string             // Form identifier
        api-endpoint: string     // POST endpoint URL
        method: "POST" | "GET"
        success-message: string
        error-message: string
        redirect-url: string     // Optional redirect after success
    }
    
    // Form Layout (Framer-style)
    // User chooses how fields are arranged
    layout: {
        // Layout type
        type: "stack" | "grid"
        
        // For stack layouts
        direction: "vertical" | "horizontal"
        
        // For grid layouts
        columns: number
        
        // Spacing between fields
        field-spacing: number
        
        // Label position
        label-position: "top" | "left" | "inline"
    }
    
    // Form Fields
    // User adds fields via [+ Add Field] button
    // Dropdown shows: Text, Email, Password, Textarea, Select, Checkbox, Radio, File, Date, Time, Number
    fields: Array<{
        id: string
        type: "text" | "email" | "password" | "textarea" | "select" | "checkbox" | "radio" | "file" | "date" | "time" | "number"
        
        // Field content
        label: string
        placeholder: string
        help-text: string
        required: boolean
        default-value: string
        
        // Type-specific properties
        options: string[]        // For select, radio, checkbox
        min: number              // For number, date, time
        max: number              // For number, date, time
        rows: number             // For textarea
        accept: string           // For file (e.g., "image/*")
        multiple: boolean        // For select, file
        
        // Validation
        validation: {
            pattern: string      // Regex pattern
            min-length: number
            max-length: number
            error-message: string
        }
        
        // Layout
        width: "full" | "half" | "third" | "custom"
    }>
    
    // Submit Button
    // User customizes submit button
    submit: {
        text: string
        position: "left" | "center" | "right"
        style: "primary" | "secondary" | "outline"
        size: "small" | "medium" | "large"
        loading-text: string
        full-width: boolean
    }
    
    // Validation Behavior
    // User sets when validation occurs
    validation: {
        mode: "on-submit" | "on-blur" | "on-change"
        show-errors: "inline" | "summary" | "both"
    }
    
    // Field Styling
    // User sets consistent styling for all fields
    style: {
        field-style: "default" | "outline" | "filled" | "underline"
        field-size: "small" | "medium" | "large"
        label-style: "default" | "bold" | "uppercase"
    }
    
    // Implementation Note:
    // The component intelligently handles:
    // - Form submission to API endpoint
    // - Field validation (client-side)
    // - Error state management
    // - Loading states during submission
    // - Success/error message display
    // - Accessibility (form semantics, ARIA labels)
    // - Default template: Name (text) + Email (email) + Submit button
}
```


## Rich Text Structure

*For advanced text formatting*

```typescript
RichTextStructure {
    type: "rich-text"
    content: Array<RichTextNode>
}

RichTextNode {
    type: "text" | "bold" | "italic" | "underline" | "link" | "line-break"
    content: string | RichTextNode[]
    styles?: {
        color: string
        background-color: string
        font-size: number + unit
        font-family: string
    }
    href?: string                // For link nodes
    target?: string              // For link nodes
}
```

## CSS Variable Integration

All components can reference CSS variables defined in the global theme:

```css
/* Example theme variables */
:root {
    --color-primary: #007bff;
    --color-secondary: #6c757d;
    --font-family-primary: 'Inter', sans-serif;
    --font-size-base: 16px;
    --spacing-unit: 8px;         /* Baseline grid unit */
    --border-radius: 4px;
}
```

Components can reference these variables in their properties:

```typescript
// Example component using CSS variables
{
    background: {
        color: "var(--color-primary)"
    },
    typography: {
        font-family: "var(--font-family-primary)",
        font-size: "var(--font-size-base)"
    }
}
```

## Baseline Grid Integration

When `snapToBaseline: true` is set on a component:

- All numeric values (spacing, sizing, typography) snap to the nearest baseline unit
- The baseline unit is defined in the global theme (e.g., `--spacing-unit: 8px`)
- Typography line-height should be multiples of the baseline unit
- Spacing values (padding, margin) should align to baseline grid
- Component heights should align to baseline grid when possible


---

## Summary

This component properties specification has been designed from a **user interface perspective**, focusing on what users actually control in the design interface rather than technical implementation details.

### Core Components

Linabasis uses a minimal, powerful component set:

1. **Div** - Layout container with Framer-style controls, link behavior, and semantic HTML options
2. **Text** - Rich text with typography presets and inline formatting
3. **Media** - Images and videos with responsive support
4. **Form** - Complete form builder with field management and API integration

### Key Design Principles

1. **User-Centric Language**: Properties use design terminology (alignment, distribution, spacing) rather than CSS properties
2. **Component Intelligence**: Components intelligently determine technical implementation based on user choices
3. **Design-First Approach**: Properties are organized by design decisions, not technical structure
4. **Minimal Component Set**: Consolidated functionality into fewer, more powerful components
5. **Clear Separation**: User properties are clearly separated from implementation notes

### Component Intelligence Examples

- **Div Component**: User chooses "stack" + "horizontal" + "space-between" → Component uses `display: flex` + `flex-direction: row` + `justify-content: space-between`
- **Div as Link**: User enables link → Component wraps content in `<a>` tag or adds click handler
- **Div Semantic**: User chooses "section" → Component renders as `<section>` instead of `<div>`
- **Text Component**: User chooses "heading-1" preset → Component uses `h1` element + appropriate typography
- **Text Link**: User adds link in rich text → Component handles inline link with proper attributes
- **Media Component**: User chooses "cover" fit → Component uses `object-fit: cover`
- **Form Component**: User adds fields via dropdown → Component manages validation, submission, and styling

### Benefits

- **Intuitive Interface**: Users think in design terms, not CSS terms
- **Flexible Implementation**: Components can optimize technical implementation
- **Consistent Experience**: Design language is consistent across all components
- **Reduced Complexity**: Fewer components with more capabilities
- **Future-Proof**: Technical implementation can evolve without changing user interface

*This specification aligns with the TypeScript types defined in `src/lib/types/components.ts` and supports the Linabasis page builder architecture.*