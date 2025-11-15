# Linabasis Application Structure

This document defines the complete application routing, page structure, and UI organization for Linabasis.

## Terminology

- **Components**: The 4 primary building blocks (Div, Text, Media, Form) used in the page builder
- **Blocks**: User-created reusable design elements (converted from designs in the page builder)
- **Templates**: Pages designated as blog layouts (article page, blog homepage, etc.)
- **Pages**: Design files that can be published to the website or used as templates

---

## Public Routes

### `/` - Homepage
- **Description**: The root route of the Linabasis website. Shows a default Linebasis homepage until user defines a custom one.
- **Configuration**: User can define homepage from designer or from `/admin/settings`
- **Rendering**: SSR rendering from published page design events

### `/{slug}` - Published Pages
- **Description**: Dynamically rendered published pages
- **Rendering**: SSR rendering from design events stored in database
- **Includes**: SEO metadata, Open Graph tags, structured data
- **Example**: `/about`, `/contact`, `/services`, etc.

### `/blog` - Blog Homepage
- **Description**: Blog homepage displaying posts list
- **Rendering**: Uses the page designated as "Blog Homepage Template"
- **Features**: Pagination, category filtering, search

### `/blog/{post-slug}` - Blog Post
- **Description**: Individual blog post page
- **Rendering**: Uses the page designated as "Single Post Template"
- **Features**: Rich text content, SEO metadata, social sharing

### `/blog/category/{category-slug}` - Category Archive
- **Description**: Posts filtered by category
- **Rendering**: Uses "Blog Homepage Template" with category filter

### `/login` - User Login
- **UI Elements**:
  - Input: Email
  - Input: Password
  - Button: Login
  - Link: Register
  - Link: Forgot password (future)
- **Behavior**: On success, redirect to `/admin/dashboard`

### `/register` - User Registration
- **UI Elements**:
  - Input: Name
  - Input: Email
  - Input: Password
  - Input: Confirm password
  - Button: Register
  - Link: Login
- **Behavior**: On success, create account and redirect to `/admin/dashboard`

---

## Admin Routes

**Authentication**: All `/admin/*` routes require authentication. Unauthenticated users redirect to `/login`.

### Admin Layout Structure

**Navbar** (appears on all admin pages):
- Linebasis brandmark
- Current page title
- Link: View site (opens homepage in new tab)

**Sidebar Navigation**:
- Dashboard
- Pages
- Blocks
- Styles
- Blog
- Media
- Themes
- Plugins
- Team
- Settings

**Alert Toast** (global):
- Error messages
- Success messages
- Incoming theme requests:
  - "Theme from {author_username}"
  - Button: Accept
  - Button: Reject

**User Menu**:
- Link: Profile (`/admin/account`)
- Link: Logout

**Footer**:
- "Made with Linebasis"
- Link: www.linebasis.org

---

### `/admin` - Admin Root
- **Behavior**: Redirects to `/admin/dashboard`

### `/admin/dashboard` - Dashboard
- **Description**: Main admin landing page with overview and quick actions

**UI Elements**:
- **Quick Stats Cards**:
  - Total pages (published/draft)
  - Total blog posts
  - Total media files
  - Site traffic (future)

- **Quick Actions**:
  - Button: New Page (creates new page and opens designer)
  - Button: New Post (opens `/admin/blog/posts/new`)
  - Button: View Site

- **Latest Activity Feed**:
  - Activity items (last 10):
    - Activity type (Created/Edited/Deleted/Published)
    - Resource type (Page/Post/Block/Member)
    - Resource title
    - User who performed action
    - Timestamp

---

### `/admin/pages` - Pages Management
- **Description**: Manage all pages (published, drafts, templates)

**UI Elements**:
- **Toolbar**:
  - Button: New Page (creates new page and opens `/admin/designer/{page-id}`)
  - Button: Export as Theme
  - Search input
  - Filter dropdown: All / Published / Drafts / Templates

- **Pages List** (table or grid view):
  - **Page Item**:
    - Thumbnail preview (canvas screenshot)
    - Page title
    - Status badge (Published / Draft / Template)
    - URL (if published): `/{slug}`
    - Template type (if template): "Blog Homepage" / "Single Post" / etc.
    - Created timestamp
    - Last edited timestamp
    - Created by (user)
    - Last edited by (user)
    - **Actions**:
      - Button: Edit (opens `/admin/designer/{page-id}`)
      - Button: Duplicate
      - Button: Preview (opens `/admin/preview/{page-id}`)
      - Button: Copy URL (if published)
      - Button: Set as Homepage
      - Dropdown: Define as Template
        - Blog Homepage Template
        - Single Post Template
        - Category Archive Template
        - Author Archive Template
        - Clear Template Assignment
      - Button: Delete

---

### `/admin/designer/{page-id}` - Page Builder
- **Description**: The core page builder interface where users design pages
- **Full Specification**: See `page-builder-spec.md`

**Brief Overview**:
- **Multi-Page Canvas**: Figma-style artboards, multiple pages in one view
- **Left Panel**: Component library (Div, Text, Media, Form) + Blocks library
- **Right Panel**: Properties editor for selected element
- **Bottom Panel**: Layers tree
- **Top Toolbar**:
  - Button: Save (auto-save enabled)
  - Button: Preview (opens `/admin/preview/{page-id}`)
  - Button: Publish (opens publish modal)
  - Dropdown: Select artboard/page
  - Button: Add artboard
  - Undo/Redo buttons
  - Zoom controls

**Publish Modal**:
- Input: Page slug
- Input: SEO title
- Textarea: SEO description
- Image upload: Social preview image
- Checkbox: Set as homepage
- Dropdown: Assign as template (optional)
- Button: Publish
- Button: Cancel

---

### `/admin/preview/{page-id}` - Page Preview
- **Description**: Preview page before publishing in isolated view

**UI Elements**:
- **Top Bar**:
  - Label: "Preview Mode - Not Published"
  - Button: Back to Designer
  - Button: Publish (opens publish modal)
  - Responsive preview toggles: Desktop / Tablet / Mobile

- **Preview Area**:
  - Renders page from design events
  - Isolated iframe with actual HTML/CSS output
  - No admin UI visible

---

### `/admin/blocks` - Blocks Library
- **Description**: User-created reusable design elements (formerly called "components")
- **How Blocks Work**:
  1. In designer, select elements → Right-click → "Convert to Block"
  2. Block appears in this library
  3. Drag from library into any page design
  4. Editing master block updates all instances

**UI Elements**:
- **Toolbar**:
  - Search input
  - Sort dropdown: Recent / Name / Most Used

- **Blocks Grid**:
  - **Block Item**:
    - Thumbnail preview
    - Block name
    - Used in X pages
    - Created timestamp
    - **Actions**:
      - Button: Edit (opens designer with block isolated)
      - Button: Duplicate
      - Button: Rename
      - Button: Delete
      - Button: Add to Theme

**Block Editor Modal** (when editing):
- Opens designer in "block mode"
- Single artboard with block design
- Save updates all instances across pages

---

### `/admin/styles` - Design System
- **Description**: Manage global design tokens, CSS variables, and typography presets

**UI Elements**:
- **Tabs**:
  - Colors
  - Typography
  - Spacing
  - Effects

- **Colors Tab**:
  - **Theme Colors**:
    - Primary color picker
    - Secondary color picker
    - Accent color picker
    - Text color picker
    - Muted color picker
  - **Custom Colors**:
    - Add custom color variables
    - Color name input
    - Color picker
    - Delete button
  - Button: Import color palette
  - Button: Export color palette

- **Typography Tab**:
  - **Font Families**:
    - Primary font dropdown (Google Fonts + custom uploads)
    - Secondary font dropdown
    - Monospace font dropdown
  - **Typography Presets**:
    - Heading 1 through Heading 6 settings:
      - Font family
      - Font size
      - Font weight
      - Line height
      - Letter spacing
    - Body text settings
    - Caption settings
    - Small text settings
  - **Baseline Grid**:
    - Input: Baseline unit (4-32px)
    - Checkbox: Enable baseline grid by default
    - Preview: Grid visualization

- **Spacing Tab**:
  - Input: Base spacing unit (default: 8px)
  - Spacing scale presets (4, 8, 16, 24, 32, 40, 48, 64, 80, 96)
  - Custom spacing values

- **Effects Tab**:
  - Shadow presets (small, medium, large, xl)
  - Border radius presets
  - Blur presets

- **Actions**:
  - Button: Reset to defaults
  - Button: Import style library
  - Button: Export style library
  - Button: Save changes

---

### `/admin/blog` - Blog Management
- **Description**: Manage blog posts, categories, and templates

**UI Elements**:
- **Tabs**:
  - Posts
  - Categories
  - Tags
  - Templates

- **Posts Tab**:
  - Button: New Post
  - Search input
  - Filter dropdown: All / Published / Drafts
  - **Posts List** (table):
    - Post title
    - Status (Published / Draft)
    - Author
    - Categories (badges)
    - Published date
    - Views (future)
    - **Actions**:
      - Button: Edit
      - Button: View (if published)
      - Button: Duplicate
      - Button: Delete

- **Categories Tab**:
  - Button: New Category
  - Categories list:
    - Category name
    - Slug
    - Post count
    - Actions: Edit / Delete

- **Tags Tab**:
  - Button: New Tag
  - Tags list:
    - Tag name
    - Slug
    - Post count
    - Actions: Edit / Delete

- **Templates Tab**:
  - **Template Assignment**:
    - Blog Homepage Template:
      - Dropdown: Select page OR Button: Design New
      - Preview thumbnail
    - Single Post Template:
      - Dropdown: Select page OR Button: Design New
      - Preview thumbnail
    - Category Archive Template:
      - Dropdown: Select page OR Button: Design New
      - Preview thumbnail
    - Author Archive Template:
      - Dropdown: Select page OR Button: Design New
      - Preview thumbnail
  - Button: Save template assignments

---

### `/admin/blog/posts/new` - New Blog Post
### `/admin/blog/posts/{post-id}/edit` - Edit Blog Post
- **Description**: Rich text editor for creating/editing blog posts (Notion-like experience)

**UI Elements**:
- **Post Settings Sidebar**:
  - Status dropdown: Draft / Published
  - Button: Publish / Update
  - **Template Selection**:
    - Dropdown: Select template (from pages marked as "Single Post Template")
    - Note: "Post content will render in the Post Content component of this template"
  - **SEO Section**:
    - Input: SEO title (auto-fills from post title)
    - Textarea: SEO description
    - Input: URL slug
    - Image upload: Social preview image
  - **Organization**:
    - Multi-select: Categories
    - Input: Tags (autocomplete)
    - Date picker: Publish date
    - Dropdown: Author

- **Editor Area**:
  - Input: Post title (large, prominent)
  - Rich text editor (Novel Svelte):
    - Slash commands (/, #, etc.)
    - Inline formatting (bold, italic, underline, etc.)
    - Headings (H2, H3, H4, H5, H6)
    - Lists (bullet, numbered, checklist)
    - Quotes
    - Code blocks
    - Images (drag & drop from media library)
    - Embeds (YouTube, Vimeo, etc.)
    - Dividers
    - Tables

- **Top Toolbar**:
  - Button: Save Draft
  - Button: Preview (shows post rendered in selected template)
  - Button: Publish / Update
  - Button: Discard changes

---

### `/admin/media` - Media Library
- **Description**: Manage uploaded images, videos, and files

**UI Elements**:
- **Toolbar**:
  - Button: Upload Files
  - Search input
  - Filter dropdown: All / Images / Videos / Documents
  - Sort dropdown: Recent / Name / Size
  - View toggle: Grid / List

- **Upload Modal**:
  - Drag & drop area
  - Button: Browse files
  - Upload progress bars
  - Batch upload support

- **Media Grid/List**:
  - **Media Item**:
    - Thumbnail preview
    - Filename
    - File type icon/badge
    - File size
    - Dimensions (for images/videos)
    - Upload date
    - Uploaded by (user)
    - **Actions**:
      - Button: View details
      - Button: Copy URL
      - Button: Download
      - Button: Replace file
      - Button: Delete

- **Media Details Panel** (side drawer):
  - Large preview
  - **Metadata**:
    - Filename (editable)
    - Input: Alt text
    - Input: Title
    - Textarea: Caption
    - File size
    - Dimensions
    - Upload date
    - Uploaded by
    - Used in X pages (clickable list)
  - Button: Update
  - Button: Delete

---

### `/admin/themes` - Theme Management
- **Description**: Import, export, and manage themes. Themes package pages, blocks, and styles for transfer between Linabasis installations.

**UI Elements**:
- **Toolbar**:
  - Button: Import Theme
  - Button: Export Site as Theme

- **Installed Themes List** (if we support theme storage):
  - Theme item:
    - Theme name
    - Author
    - Version
    - Installed date
    - Actions:
      - Button: Download .zip
      - Button: Delete

---

### `/admin/themes/import` - Import Theme
- **Description**: Import themes via file upload OR remote API

**UI Elements**:
- **Method Tabs**:
  - File Upload
  - Remote Import (API)

- **File Upload Tab**:
  - Drag & drop area: "Drop .baseline-theme file here"
  - Button: Browse files
  - **After file selected**:
    - Theme preview:
      - Theme name
      - Author
      - Version
      - Description
      - Included items:
        - X pages
        - X blocks
        - X style libraries
      - Thumbnail previews
    - Checkbox: Overwrite existing pages/blocks with same names
    - Button: Import Theme
    - Button: Cancel

- **Remote Import Tab**:
  - **Description**: Import theme from another Linabasis installation via API
  - Input: Remote site URL (e.g., `https://example.com`)
  - Input: API key (from remote site)
  - Button: Connect & Preview
  - **After connection**:
    - Shows same theme preview as file upload
    - Button: Import Theme
    - Button: Cancel

---

### `/admin/themes/export` - Export Theme
- **Description**: Export site as theme via file download OR generate API endpoint for remote imports

**UI Elements**:
- **Export Options Tabs**:
  - Download File
  - Share via API

- **Download File Tab**:
  - Input: Theme name
  - Textarea: Theme description
  - Input: Author name
  - Input: Version (default: 1.0.0)
  - **Select Content**:
    - Checkbox: Select all pages / Select specific pages
    - Pages checklist
    - Checkbox: Select all blocks / Select specific blocks
    - Blocks checklist
    - Checkbox: Include style libraries
  - Button: Generate & Download .baseline-theme file

- **Share via API Tab**:
  - **Description**: Allow other Linabasis sites to import from this site remotely
  - **Your API Credentials**:
    - Display: Your site URL (read-only)
    - **API Keys List**:
      - API key item:
        - Key string (truncated, click to reveal)
        - Created date
        - Last used
        - Button: Copy key
        - Button: Revoke key
    - Button: Generate new API key
  - **Instructions**:
    - "Share your site URL and an API key with others"
    - "They can use these credentials to import your theme remotely"

---

### `/admin/plugins` - Plugins Management
- **Description**: Manage installed plugins
- **Status**: TBD (to be defined in plugin system spec)

**Placeholder UI**:
- Installed plugins list
- Button: Install plugin
- Plugin settings

---

### `/admin/team` - Team Management
- **Description**: Manage team members and roles

**UI Elements**:
- **Team Members List**:
  - **Member Item**:
    - Profile picture thumbnail
    - Input: Name
    - Input: Email
    - Dropdown: Role
      - Owner (can't be removed, can do everything)
      - Manager (can do everything including managing members)
      - Designer (can create/edit/delete pages/blocks/posts)
      - Editor (can edit page content and posts only)
    - Button: Remove member (disabled for Owner)

- **Add Member Section**:
  - Button: Add new member
    - Opens modal:
      - Input: Email
      - Dropdown: Role
      - Button: Send invitation
      - Button: Cancel
  - **Invitation Link** (alternative to email):
    - Generated link: `{site-url}/invite/{token}`
    - Button: Copy link
    - Note: "Anyone with this link can join as Designer (role can be changed after)"

- **Actions**:
  - Button: Save changes (if inline editing)

---

### `/admin/settings` - Site Settings
- **Description**: Global site configuration

**UI Elements**:
- **Tabs**:
  - General
  - SEO
  - Domain
  - Advanced

- **General Tab**:
  - Input: Site name
  - Textarea: Site description
  - Image upload: Site logo
  - Image upload: Site favicon
  - Dropdown: Homepage (select from published pages)
  - Dropdown: Timezone
  - Dropdown: Date format
  - Dropdown: Time format

- **SEO Tab**:
  - Input: Default SEO title template (e.g., "{page-title} | {site-name}")
  - Textarea: Default SEO description
  - Image upload: Default social preview image
  - Textarea: Google Analytics ID (future)
  - Textarea: Google Search Console verification code (future)

- **Domain Tab**:
  - Display: Current domain (read-only)
  - Input: Custom domain
  - Instructions for DNS configuration
  - Checkbox: Force HTTPS
  - Button: Verify domain

- **Advanced Tab**:
  - Input: API key for AI features (future)
  - Checkbox: Enable XML sitemap (auto-generated)
  - Checkbox: Enable robots.txt (auto-generated)
  - Textarea: Custom robots.txt rules
  - Button: Clear cache
  - Button: Regenerate sitemap

- **Footer Actions**:
  - Button: Save changes
  - Button: Discard changes

---

### `/admin/account` - User Account
- **Description**: Current user's profile and preferences

**UI Elements**:
- **Profile Section**:
  - Image upload: Profile picture
  - Input: Name
  - Input: Email
  - Display: Role (read-only)
  - Display: Member since (read-only)

- **Password Section**:
  - Input: Current password
  - Input: New password
  - Input: Confirm new password
  - Button: Update password

- **Preferences Section**:
  - Checkbox: Enable email notifications
  - Checkbox: Enable desktop notifications (future)
  - Dropdown: Language preference (future)

- **Sessions Section** (future):
  - Active sessions list
  - Button: Revoke all sessions

- **Actions**:
  - Button: Save changes
  - Button: Delete account (with confirmation)

---

## Workflows

Key user workflows will be documented separately in `workflows.md`:
- First-time setup and onboarding
- Creating and publishing a page
- Creating and publishing a blog post
- Converting design to reusable block
- Exporting and importing themes
- Managing team members

---

## Error Pages

### `/404` - Page Not Found
- Custom 404 page (user can design in page builder, future)
- Default: Simple "Page not found" with link to homepage

### `/500` - Server Error
- Generic error page
- "Something went wrong" message
- Link to homepage
- Link to contact support (future)

---

## Notes

- All admin routes require authentication (JWT-based)
- Unauthenticated users redirect to `/login`
- After login, redirect to originally requested route (or `/admin/dashboard` if direct login)
- All timestamps display in user's timezone (from settings)
- All forms have proper validation and error handling
- All delete actions require confirmation
- Auto-save enabled in designer and post editor (every 30 seconds + on blur)
