# LineBasis User Workflows

This document details the key user workflows and journeys through the LineBasis application. Each workflow describes step-by-step how users accomplish common tasks.

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Creating and Publishing a Page](#creating-and-publishing-a-page)
3. [Adding Responsive Breakpoints](#adding-responsive-breakpoints)
4. [Creating Reusable Blocks](#creating-reusable-blocks)
5. [Editing Master Blocks](#editing-master-blocks)
6. [Creating and Publishing a Blog Post](#creating-and-publishing-a-blog-post)
7. [Setting Up Blog Templates](#setting-up-blog-templates)
8. [Exporting a Theme](#exporting-a-theme)
9. [Importing a Theme](#importing-a-theme)
10. [Managing Team Members](#managing-team-members)
11. [Configuring Design Tokens](#configuring-design-tokens)
12. [Media Library Management](#media-library-management)

---

## First-Time Setup

**Goal**: Install LineBasis and create the first admin account.

### Prerequisites
- Server with Node.js installed
- Domain or subdomain configured (optional)

### Steps

1. **Install LineBasis**
   ```bash
   git clone https://github.com/linebasis/linebasis
   cd linebasis
   npm install
   ```

2. **Configure Environment**
   - Create `.env` file
   ```bash
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-secure-random-string"
   ```

3. **Run Setup Script**
   ```bash
   npm run setup
   ```
   - Script creates database schema
   - Prompts for admin account details:
     - Name
     - Email
     - Password
   - Creates first team/site
   - Creates owner user

4. **Start Server**
   ```bash
   npm run dev
   ```
   - Server starts at `http://localhost:5173`

5. **First Login**
   - Visit `http://localhost:5173/login`
   - Enter admin credentials
   - Redirected to `/admin/dashboard`

6. **Configure Site Settings**
   - Click "Settings" in sidebar
   - **General Tab**:
     - Set site name (e.g., "My Website")
     - Upload site logo
     - Upload favicon
   - **SEO Tab**:
     - Set default SEO title template
     - Set default meta description
   - Click "Save changes"

7. **Configure Design Tokens** (Optional)
   - Click "Styles" in sidebar
   - **Colors Tab**: Set primary, secondary, accent colors
   - **Typography Tab**: Select fonts, set heading sizes
   - **Spacing Tab**: Configure baseline grid (default: 8px)
   - Click "Save changes"

**Result**: LineBasis is installed and configured, ready for page design.

---

## Creating and Publishing a Page

**Goal**: Design a new page in the page builder and publish it to a URL.

**User**: Designer or above

### Steps

1. **Create New Page**
   - Navigate to `/admin/pages`
   - Click "New Page" button
   - System creates new page record
   - Designer opens at `/admin/designer/{page-id}`
   - Empty canvas with one frame (Desktop, 1920px)

2. **Design the Page**

   **Add Components**:
   - Click "Div" button in toolbar
   - Click on canvas to place Div
   - Div appears with selection handles

   **Set Properties**:
   - With Div selected, Properties window shows
   - Set Layout:
     - Type: Stack
     - Direction: Vertical
     - Distribute: Center
     - Align: Center
     - Gap: 24px
   - Set Background:
     - Type: Color
     - Color: #f5f5f5
   - Set Size:
     - Width: 100%
     - Height: 600px

   **Add Text**:
   - Click "Text" button in toolbar
   - Click or drag on canvas to place Text
   - Clicking will create a text element with auto width
   - Draggin will create a text element with fixed width and height
   - The caret appears, blinking
   - User can start typing
   - While editing, verify formatting shortcuts: `Cmd/Ctrl+B` (bold), `Cmd/Ctrl+I` (italic), `Cmd/Ctrl+U` (underline), `Cmd/Ctrl+Shift+X` (strikethrough), `Cmd/Ctrl+Shift+7/8` (ordered/bulleted lists), `Opt+Cmd+L/T/R` or `Alt+Ctrl+L/T/R` (alignment) and `Opt+Cmd+Shift+J` / `Alt+Ctrl+Shift+J` (justify), plus `Shift+Cmd+./>` or `Shift+Ctrl+./>` with `Shift+Cmd+,/<` or `Shift+Ctrl+,/<` (font size tweaks)
   - To wrap grouped content, select multiple elements and press `Opt+Cmd+G` (Mac) / `Alt+Ctrl+G` (Windows); the elements nest in a new div container
   - If user clicks outside a selected EMPTY text element, delete the element
   - In Properties window:
     - Style Preset: paragraph
     - Alignment: Start
     - Color default: #000000

   **Add Media**:
   - Click "Media" button in toolbar
   - Click below text to place Media
   - Upload dialog opens
   - Select image or drag & drop
   - Image uploads and appears
   - In Properties window:
     - Display Fit: Cover
     - Aspect Ratio: 16:9

3. **Preview Page**
   - Click "Preview" button in toolbar
   - OR toggle "Preview Mode" in designer
   - Canvas hides editor UI, shows live rendering
   - Check responsive behavior (resize browser)
   - Click "Back to Editor" or toggle back

4. **Publish Page**
   - Click "Publish" button in toolbar
   - Publish modal opens

   **Configure Publishing**:
   - **Page Slug**: `about-us` (auto-generated from page name)
     - Preview shows: `yourdomain.com/about-us`
   - **Breakpoints to Publish**: ✓ Desktop (1920px)
   - **SEO Settings**:
     - SEO Title: "About Us | My Website"
     - SEO Description: "Learn more about our company..."
     - Social Preview Image: Upload or select from media
   - **Advanced Settings**:
     - ☐ Set as homepage (optional)
     - Template Type: None (regular page)

   - Click "Publish" button

5. **Publishing Process** (System)
   - Client sends design events to server
   - Server stores events in database
   - Server generates Svelte component code
   - Server stores code in `Page.publishedCode`
   - Page status changes to "published"
   - Success message appears: "Page published successfully!"
   - Link provided: "View live page"

6. **View Published Page**
   - Click "View live page" link
   - Opens `yourdomain.com/about-us` in new tab
   - Page renders server-side (SSR)
   - Clean HTML/CSS output, no editor UI

**Result**: Page is live at `/about-us` and accessible to visitors.

**Auto-Save**: During design, changes auto-save to IndexedDB every 30 seconds. No manual saving needed.

---

## Adding Responsive Breakpoints

**Goal**: Create tablet and mobile versions of a page for responsive design.

**User**: Designer or above

### Prerequisites
- Existing page with desktop design

### Steps

1. **Open Page in Designer**
   - Navigate to `/admin/pages`
   - Find page in list
   - Click "Edit" button
   - Designer opens with desktop frame

2. **Add Tablet Breakpoint**
   - Right-click on frame header
   - Select "Add Breakpoint"
   - Modal opens:
     - Select breakpoint: "Tablet (768px)" OR enter custom width
     - Click "Create"

   **System Behavior**:
   - New frame created on canvas
   - Content copied from desktop frame
   - New frame named: "Homepage - Tablet"
   - Positioned next to desktop frame on canvas

3. **Adjust Tablet Design**
   - Select elements in tablet frame
   - Modify properties for tablet:
     - **Hero Div**:
       - Height: 400px (was 600px)
       - Padding: 40px (was 60px)
     - **Heading Text**:
       - Font Size: 32px (was 48px)
     - **Media**:
       - Height: 300px (was 400px)

   **Note**: Only change what needs to differ from desktop

4. **Add Mobile Breakpoint**
   - Right-click on frame header (any frame)
   - Select "Add Breakpoint"
   - Select: "Mobile (375px)"
   - Click "Create"

   New frame created with content copied

5. **Adjust Mobile Design**
   - Modify for mobile:
     - **Hero Div**:
       - Height: 300px
       - Padding: 20px
     - **Layout**:
       - Direction: Vertical (if was horizontal)
     - **Heading Text**:
       - Font Size: 24px
     - **Media**:
       - Height: 200px

6. **Set Default Breakpoint**
   - Right-click desktop frame header
   - Select "Set as Default Breakpoint"
   - This frame shows first when page loads

7. **Publish Page**
   - Click "Publish" button
   - In publish modal:
     - Enter page slug
     - Configure SEO settings
     - Click "Publish"
   - All breakpoints (frames) are published together as responsive design

8. **System Generates Responsive CSS**
   ```css
   /* Mobile (base) */
   .hero { height: 300px; padding: 20px; }

   /* Tablet */
   @media (min-width: 768px) {
     .hero { height: 400px; padding: 40px; }
   }

   /* Desktop */
   @media (min-width: 1024px) {
     .hero { height: 600px; padding: 60px; }
   }
   ```

9. **Test Responsiveness**
   - View live page
   - Resize browser window
   - Layout adjusts at breakpoints

**Result**: Page responds to different screen sizes with optimized layouts.

---

## Creating Reusable Blocks

**Goal**: Convert a designed element into a reusable block that can be used across multiple pages.

**User**: Designer or above

### Scenario
You've designed a "Call-to-Action" section (Div with heading, text, and button) and want to reuse it on multiple pages.

### Steps

1. **Design the Element**
   - In designer, create your CTA section:
     - Div container (background: blue, padding: 60px)
       - Text: Heading "Ready to Get Started?"
       - Text: Body "Join thousands of happy users today."
       - Div: Button-styled (background: white, padding: 16px 32px)
         - Text: "Sign Up Now"

2. **Select Elements**
   - Click and drag to select all elements
   - OR Click parent Div → selects entire CTA section
   - Selection handles appear around all selected elements

3. **Convert to Block**
   - Right-click on selection
   - Select "Convert to Block" from context menu

   **Modal Opens**:
   - **Block Name**: "CTA Section"
   - **Preview**: Shows thumbnail of selected design
   - Click "Create Block" button

4. **System Creates Block**
   - Block saved to database
   - Block appears in Blocks window
   - Organized under current page folder (e.g., "Homepage" folder)
   - Original elements replaced with block instance
   - Block instance looks identical but marked as instance

5. **View in Blocks Window**
   - Open Blocks window (`Cmd+Shift+B`)
   - Expand "Homepage" folder
   - See "CTA Section" block:
     - Thumbnail preview
     - Name: "CTA Section"
     - Used in: 1 page

6. **Use Block on Another Page**
   - Open different page in designer
   - Open Blocks window
   - Find "CTA Section" under "Homepage" folder
   - **Method 1**: Drag block onto canvas
   - **Method 2**: Click block → Click "Insert to Canvas"

   Block instance appears on new page

7. **Verify Instance Link**
   - Both instances (original page + new page) linked to master
   - Edit master → both update
   - Instances shown in Blocks window: "Used in: 2 pages"

**Result**: Reusable block created and can be inserted on any page. Changes to master block propagate to all instances.

**Folder Organization**: Blocks organized by source page. If you create a block on "Homepage", it appears in "Homepage" folder in Blocks window.

---

## Editing Master Blocks

**Goal**: Update a master block so changes propagate to all instances across all pages.

**User**: Designer or above

### Scenario
You have a "CTA Section" block used on 5 pages. You want to change the button color from white to yellow.

### Steps

1. **Locate Block**
   - Navigate to `/admin/blocks`
   - OR Open Blocks window in designer (`Cmd+Shift+B`)
   - Find "CTA Section" block
   - Shows "Used in: 5 pages"

2. **Edit Master Block**
   - Right-click on "CTA Section"
   - Select "Edit Block"

   **System Behavior**:
   - Opens the original page where block was created
   - Designer loads: `/admin/designer/{source-page-id}`
   - Block instance on source page automatically highlighted
   - Selection handles appear around block

3. **Modify Block**
   - Select button Div within block
   - In Properties window:
     - Background: Change from white (#ffffff) to yellow (#ffeb3b)
   - Change reflects immediately in canvas

4. **Save Changes** (Auto)
   - Changes auto-save to IndexedDB
   - After 30 seconds, changes persist

5. **Publish Page** (Optional)
   - If source page is published, click "Publish" to update live version
   - If source page is just a "blocks library" page, no need to publish

6. **Changes Propagate**
   - All 5 instances across all pages now have yellow button
   - Next time those pages publish, they include updated block

7. **Verify Changes**
   - Navigate to one of the pages using the block
   - Open in designer
   - Confirm button is now yellow

**Result**: Master block updated, all instances reflect changes.

**Important**: Editing the master block updates the block definition. Pages using the block must be re-published for live sites to show changes.

---

## Detaching and Resyncing Blocks

**Scenario**: You have a block instance but want to customize it for one specific page without affecting other instances.

### Detaching a Block Instance

1. **Direct Edit on Instance**
   - Open page with block instance in designer
   - Click on block instance (shows as single unit)
   - Edit any property (e.g., change button text)

   **System Behavior**:
   - Block automatically detaches
   - Badge appears: "Detached"
   - Override events stored separately
   - Other instances unaffected

2. **Detached Block Behavior**
   - This instance no longer updates from master
   - Independent from other instances
   - Can make any changes

3. **Push Changes to Master** (Optional)
   - Right-click detached instance
   - Select "Push to Master"
   - Confirmation dialog: "This will update all other instances. Continue?"
   - Click "Confirm"

   **Result**: Master block updates with your changes, all non-detached instances update

4. **Reset to Master**
   - Right-click detached instance
   - Select "Reset to Master"
   - Confirmation dialog: "This will discard your changes. Continue?"
   - Click "Confirm"

   **Result**: Instance reverts to master block design, no longer detached

**Use Cases**:
- **Detach**: One-off customization for specific page
- **Push to Master**: Your customization should be the new default
- **Reset to Master**: Undo your customization, return to standard

---

## Creating and Publishing a Blog Post

**Goal**: Write and publish a blog post using LineBasis's blog system.

**User**: Editor or above

### Prerequisites
- Blog plugin installed and active
- Blog templates configured (see "Setting Up Blog Templates")

### Steps

1. **Navigate to Blog Dashboard**
   - Click "Blog" in admin sidebar
   - Opens `/admin/blog`
   - Shows Posts, Categories, Tags, Templates tabs

2. **Create New Post**
   - Click "New Post" button
   - Redirects to `/admin/blog/posts/new`
   - Rich text editor (Notion-like) appears

3. **Write Post Content**

   **Post Title**:
   - Large input field at top
   - Enter: "How to Build a Website with LineBasis"

   **Post Content**:
   - Rich text editor with formatting tools
   - Use slash commands:
     - `/h1` → Heading 1
     - `/h2` → Heading 2
     - `/p` → Paragraph
     - `/image` → Insert image
     - `/code` → Code block

   **Example Content**:
   ```
   # Introduction
   
   LineBasis is a powerful CMS that makes website building easy.
   
   ## Getting Started
   
   First, install LineBasis on your server...
   
   ![Screenshot](/media/screenshot.png)
   
   ## Conclusion
   
   With LineBasis, you can...
   ```

4. **Configure Post Settings** (Right Sidebar)

   **Status**:
   - Dropdown: Draft (default)
   - Options: Draft, Published, Scheduled

   **Template Selection**:
   - Dropdown: Select "Single Post Template"
   - Note: "Post content will render in the Post Content component"

   **SEO Settings**:
   - SEO Title: "How to Build a Website | My Blog"
   - SEO Description: "Learn how to build..."
   - URL Slug: `how-to-build-website` (auto-generated)
   - Social Preview Image: Upload

   **Organization**:
   - Categories: Check "Tutorials", "Web Development"
   - Tags: Type "linebasis, tutorial, cms" (autocomplete)
   - Publish Date: Select date/time
   - Author: Current user (auto-selected)

5. **Save Draft**
   - Click "Save Draft" button
   - Post saved to database
   - Status: Draft (not visible on site)
   - Can return later to continue editing

6. **Preview Post**
   - Click "Preview" button
   - Opens preview in new tab
   - Shows post rendered in selected template
   - Post content appears in PostContent component area

7. **Publish Post**
   - Click "Publish" button (or "Update" if already published)

   **System Behavior**:
   - Post status changes to "Published"
   - `publishedAt` timestamp set
   - Post appears on blog homepage
   - Post accessible at `/blog/how-to-build-website`

8. **View Live Post**
   - Click "View Post" link (appears after publish)
   - Opens `/blog/how-to-build-website`
   - Post renders in Single Post Template:
     - Template layout (header, sidebar, footer)
     - PostContent component shows rich text
     - SEO metadata in HTML head

9. **Edit Published Post**
   - Make changes in editor
   - Click "Update" button
   - Changes immediately live

**Result**: Blog post published and visible at `/blog/{slug}` with SEO metadata and template styling.

**Scheduling**: Set Status to "Scheduled" and choose future date to publish automatically later.

---

## Setting Up Blog Templates

**Goal**: Design templates for blog pages (blog homepage, single post, category archive) using the page builder.

**User**: Designer or above

### Overview
Blog templates are regular pages marked with special template types. They use the PostContent block to render blog content.

### Steps

#### 1. Create Blog Homepage Template

1. **Create New Page**
   - Go to `/admin/pages`
   - Click "New Page"
   - Designer opens

2. **Design Blog Homepage**
   - Add header (logo, navigation)
   - Add main section:
     - Heading: "Latest Posts"
     - Grid of post cards (placeholders)
   - Add sidebar (categories, tags)
   - Add footer

3. **Mark as Template**
   - Click "Publish"
   - In publish modal:
     - **Assign as Template**: Select "Blog Homepage Template"
     - Slug: `blog` (required)
   - Click "Publish"

   **System Behavior**:
   - Page.templateType = 'blog-homepage'
   - Blog plugin uses this page for `/blog`
   - Dynamically populates with actual posts

#### 2. Create Single Post Template

1. **Create New Page**
   - New page in designer

2. **Design Post Layout**
   - Add header
   - Add post metadata section:
     - Post title (dynamic, from Post.title)
     - Author, date, categories (dynamic)
   - **Add PostContent Block**:
     - Drag "PostContent" from Blocks window (Default Blocks)
     - Place in main content area
     - This is where blog post rich text renders
   - Add sidebar:
     - Related posts
     - Share buttons
   - Add footer

3. **Style PostContent Block**
   - Select PostContent block
   - Set typography styles for post content:
     - Paragraph spacing
     - Heading styles
     - Code block styles
     - Image alignment

4. **Mark as Template**
   - Click "Publish"
   - **Assign as Template**: "Single Post Template"
   - Slug: `post-template` (any slug, not used for routing)
   - Click "Publish"

   **System Behavior**:
   - Page.templateType = 'single-post'
   - Blog plugin uses this for all `/blog/{post-slug}` pages
   - PostContent component replaced with actual post content

#### 3. Create Category Archive Template

1. **Create New Page**
   - Design similar to blog homepage
   - Add heading: "Category: {category-name}" (dynamic)
   - Grid of posts filtered by category

2. **Mark as Template**
   - **Assign as Template**: "Category Archive Template"
   - Slug: `category-template`
   - Publish

#### 4. Assign Templates in Blog Settings

1. **Navigate to Blog Dashboard**
   - Click "Blog" in sidebar
   - Go to "Templates" tab

2. **Assign Templates**
   - **Blog Homepage Template**: Dropdown → Select "Blog" page
   - **Single Post Template**: Dropdown → Select "Post Template" page
   - **Category Archive Template**: Dropdown → Select "Category Template" page
   - Click "Save template assignments"

**Result**: Blog system configured with custom templates. All blog pages render with your designs.

**Dynamic Content**: Blog plugin automatically:
- Populates post lists on homepage and archives
- Renders post content in PostContent block
- Generates pagination
- Filters posts by category/tag

---

## Exporting a Theme

**Goal**: Package your site design (pages, blocks, tokens, media) for sharing or backup.

**User**: Designer or above

### Scenario
You've designed a complete website and want to:
- Share it with a client
- Use it on another LineBasis installation
- Create a backup
- Publish it in the theme marketplace (future)

### Steps

#### Method 1: Export as .zip File

1. **Navigate to Themes**
   - Click "Themes" in admin sidebar
   - Opens `/admin/themes`

2. **Click Export**
   - Click "Export Site as Theme" button
   - Redirects to `/admin/themes/export`

3. **Configure Export**

   **Export Options Tab**: "Download File"

   **Theme Metadata**:
   - Theme Name: "Modern Business Theme"
   - Description: "Clean, professional theme for businesses"
   - Author Name: "Your Name"
   - Version: "1.0.0" (default)

   **Select Content**:
   - **Pages**:
     - ☐ Select all pages
     - OR individually select:
       - ✓ Homepage
       - ✓ About
       - ✓ Contact
       - ✓ Blog
   - **Blocks**:
     - ✓ Select all blocks
     - Includes: CTA Section, Feature Card, Testimonial, etc.
   - **Tokens**:
     - ✓ Include style libraries
     - Colors, typography, spacing, effects

4. **Generate Theme**
   - Click "Generate & Download .baseline-theme file"

   **System Behavior**:
   - Collects selected pages (with designEvents)
   - Collects frames (with breakpoints)
   - Collects blocks
   - Collects design tokens
   - Downloads media files (images referenced in designs)
   - Packages template assignments
   - Creates JSON manifest
   - Generates .zip file

5. **Download**
   - File downloads: `modern-business-theme.baseline-theme`
   - Save to computer

**Theme File Contents**:
```
modern-business-theme.baseline-theme (ZIP)
├── theme.json
├── README.md
└── media/
    ├── logo.png
    ├── hero-image.jpg
    └── ...
```

#### Method 2: Share via API (Remote Import)

1. **Navigate to Export**
   - `/admin/themes/export`

2. **Select Tab**: "Share via API"

3. **Generate API Key**
   - Click "Generate new API key"
   - New API key appears:
     - Key: `lb_abc123def456...` (long random string)
     - Created: Just now
     - Last used: Never
   - Click "Copy key" button

4. **Share Credentials**
   - **Your Site URL**: `https://yourdomain.com`
   - **API Key**: `lb_abc123def456...`
   - Share these with the person who will import

   **Instructions Display**:
   ```
   To import this theme remotely:
   1. Go to their LineBasis site
   2. Navigate to Themes → Import
   3. Select "Remote Import (API)" tab
   4. Enter:
      - Remote Site URL: https://yourdomain.com
      - API Key: lb_abc123def456...
   5. Click "Connect & Preview"
   ```

5. **Revoke API Key** (Optional)
   - When done sharing, click "Revoke key"
   - API key becomes invalid
   - Remote imports no longer work

**Result**: Theme exported as .zip file OR available for remote API import.

**Use Cases**:
- **.zip file**: Send to client, publish in marketplace, backup
- **API sharing**: Quick transfer between your own LineBasis installations

---

## Importing a Theme

**Goal**: Import a theme (pages, blocks, tokens) into your LineBasis site.

**User**: Manager or above

### Scenario
You received a theme file or API credentials and want to import it into your site.

### Steps

#### Method 1: Import from .zip File

1. **Navigate to Themes**
   - Click "Themes" in sidebar
   - Click "Import Theme" button
   - Redirects to `/admin/themes/import`

2. **Select Method**
   - Tab: "File Upload" (default)

3. **Upload Theme File**
   - Drop `.baseline-theme` file into upload area
   - OR Click "Browse files" and select file

4. **Preview Theme**
   - System reads theme.json
   - Preview displays:
     - **Theme Info**:
       - Name: "Modern Business Theme"
       - Author: "Designer Name"
       - Version: "1.0.0"
       - Description: "Clean, professional theme..."
     - **Included Content**:
       - 5 pages (Homepage, About, Contact, Blog, Post Template)
       - 8 blocks (CTA Section, Feature Card, etc.)
       - Style library (colors, typography, spacing)
       - 12 media files
     - **Thumbnail Previews**: Screenshots of pages

5. **Configure Import**
   - **Conflict Resolution**:
     - ☐ Overwrite existing pages with same slug
     - OR Default: Rename (append "-2", "-3")

6. **Import Theme**
   - Click "Import Theme" button

   **System Process**:
   - Uploads media files to `/static/uploads/`
   - Creates Media records
   - Creates Page records with designEvents
   - Creates Frame records
   - Creates Block records
   - Imports design tokens to Settings
   - Assigns template types

   **Progress Bar**:
   - "Importing media files... (5/12)"
   - "Creating pages... (2/5)"
   - "Creating blocks... (4/8)"
   - "Importing tokens..."
   - "Complete!"

7. **Success**
   - Success message: "Theme imported successfully!"
   - Summary:
     - 5 pages created
     - 8 blocks created
     - 12 media files uploaded
     - Design tokens updated

8. **Review Imported Content**
   - Navigate to `/admin/pages`
   - See newly imported pages (marked "Draft" by default)
   - Navigate to `/admin/blocks`
   - See imported blocks organized by source page

9. **Publish Imported Pages** (Optional)
   - Open each page in designer
   - Review design
   - Click "Publish" to make live

#### Method 2: Import via API

1. **Navigate to Import**
   - `/admin/themes/import`
   - Tab: "Remote Import (API)"

2. **Enter Remote Credentials**
   - **Remote Site URL**: `https://sourcesite.com`
   - **API Key**: `lb_abc123def456...`
   - Click "Connect & Preview"

3. **System Fetches Theme**
   - Makes API request to remote site
   - Remote site validates API key
   - Returns theme data (JSON)

4. **Preview Theme**
   - Same preview as file upload
   - Shows pages, blocks, tokens, media

5. **Import**
   - Click "Import Theme"
   - Same process as file import

**Result**: Theme content imported into your site. Pages available to publish, blocks ready to use, tokens applied.

### Handling Conflicts

**Scenario**: Importing theme with page slug "about" but you already have `/about`

**Conflict Resolution Options**:

1. **Skip** - Don't import this page, keep existing
2. **Rename** - Import as `about-2`
3. **Overwrite** - Replace existing page with imported one (destructive!)

**Dialog Prompt**:
```
Conflict detected: Page with slug "about" already exists.

Existing: About Us (created 2 weeks ago)
Importing: About (from Modern Business Theme)

Choose action:
○ Skip this page
○ Rename to "about-2"
○ Overwrite existing page (cannot be undone)

[Cancel] [Apply]
```

User selects option, import continues.

---

## Managing Team Members

**Goal**: Invite team members and assign roles for collaboration.

**User**: Manager or Owner

### Steps

1. **Navigate to Team Management**
   - Click "Team" in admin sidebar
   - Opens `/admin/team`

2. **View Current Team**
   - **Team Members List**:
     - Shows all members
     - Each member shows:
       - Profile picture
       - Name
       - Email
       - Role (Owner, Manager, Designer, Editor)

3. **Add New Member**

   **Method 1: Email Invitation**
   - Click "Add new member" button
   - Modal opens:
     - **Email**: Enter member's email
     - **Role**: Select from dropdown
       - Manager (can manage team)
       - Designer (can design & publish)
       - Editor (can edit content only)
     - Click "Send invitation"

   **System Behavior**:
   - Creates pending user account
   - Sends email invitation with link
   - Link: `yourdomain.com/invite/{token}`
   - User clicks link → completes registration → joins team

   **Method 2: Invitation Link**
   - Click "Copy invitation link" button
   - Generated link: `yourdomain.com/invite/{token}`
   - Share link via Slack, messaging, etc.
   - Anyone with link can join
   - Default role: Designer (can change after joining)

4. **Change Member Role**
   - Find member in list
   - Click role dropdown
   - Select new role:
     - Owner → Cannot change (only one owner)
     - Manager → Can do everything except transfer ownership
     - Designer → Can create/edit/publish pages, blocks, posts
     - Editor → Can edit content, cannot publish or delete
   - Role updates immediately

5. **Remove Member**
   - Find member in list
   - Click "Remove" button (disabled for Owner)
   - Confirmation dialog: "Remove [Name] from team?"
   - Click "Confirm"
   - Member removed, loses access

6. **Save Changes**
   - If using inline editing, click "Save changes"
   - Team configuration updated

**Result**: Team members can collaborate with appropriate access levels.

### Role Permissions Summary

| Action | Owner | Manager | Designer | Editor |
|--------|-------|---------|----------|--------|
| Add/remove members | ✓ | ✓ | ✗ | ✗ |
| Change roles | ✓ | ✓ | ✗ | ✗ |
| Delete team | ✓ | ✗ | ✗ | ✗ |
| Create/edit pages | ✓ | ✓ | ✓ | ✗ |
| Publish pages | ✓ | ✓ | ✓ | ✗ |
| Delete pages | ✓ | ✓ | ✓ | ✗ |
| Create blocks | ✓ | ✓ | ✓ | ✗ |
| Edit page content | ✓ | ✓ | ✓ | ✓ |
| Upload media | ✓ | ✓ | ✓ | ✓ |
| Edit blog posts | ✓ | ✓ | ✓ | ✓ |
| Manage settings | ✓ | ✓ | ✗ | ✗ |

---

## Configuring Design Tokens

**Goal**: Set up global design system (colors, typography, spacing) that applies across all pages.

**User**: Designer or above

### Steps

1. **Navigate to Styles**
   - Click "Styles" in admin sidebar
   - Opens `/admin/styles`
   - Shows tabs: Colors, Typography, Spacing, Effects

#### Configure Colors

1. **Select Colors Tab**

2. **Set Theme Colors**
   - **Primary Color**:
     - Click color picker
     - Choose brand color (e.g., #007bff blue)
   - **Secondary Color**: #6c757d (gray)
   - **Accent Color**: #28a745 (green)
   - **Text Color**: #212529 (dark gray)
   - **Muted Color**: #6c757d (light gray)

3. **Add Custom Colors** (Optional)
   - Click "Add custom color"
   - Name: "Brand Red"
   - Color: #dc3545
   - Click "Save"

   Can reference as `var(--color-brand-red)` in components

#### Configure Typography

1. **Select Typography Tab**

2. **Set Font Families**
   - **Primary Font**:
     - Dropdown: Google Fonts list
     - Select: "Inter"
   - **Secondary Font**: "Merriweather" (for headings)
   - **Monospace Font**: "Fira Code" (for code)

3. **Configure Typography Presets**
   - **Heading 1**:
     - Font Family: Secondary (Merriweather)
     - Font Size: 48px
     - Font Weight: Bold
     - Line Height: 1.2 (57.6px - snaps to baseline)
     - Letter Spacing: -0.02em

   - **Heading 2**: 40px, Bold, 1.25 line-height
   - **Heading 3**: 32px, Semibold, 1.3
   - **Heading 4**: 24px, Semibold, 1.4
   - **Heading 5**: 20px, Medium, 1.5
   - **Heading 6**: 18px, Medium, 1.5

   - **Body**: 16px, Normal, 1.6 (25.6px baseline)
   - **Caption**: 14px, Normal, 1.5
   - **Small**: 12px, Normal, 1.4

4. **Configure Baseline Grid**
   - **Baseline Unit**: 8px (default)
   - ✓ Enable baseline grid by default
   - Preview shows grid visualization

   All line-heights should be multiples of 8px for baseline alignment

#### Configure Spacing

1. **Select Spacing Tab**

2. **Set Base Unit**
   - Base spacing unit: 8px (matches baseline)

3. **Spacing Scale** (predefined)
   - 4px (0.5× base)
   - 8px (1× base)
   - 16px (2× base)
   - 24px (3× base)
   - 32px (4× base)
   - 40px (5× base)
   - 48px (6× base)
   - 64px (8× base)
   - 80px (10× base)
   - 96px (12× base)

4. **Add Custom Value** (Optional)
   - Click "Add custom spacing value"
   - Enter: 72px
   - Saved as preset

#### Configure Effects

1. **Select Effects Tab**

2. **Shadow Presets**
   - **Small**: 0 1px 3px rgba(0,0,0,0.12)
   - **Medium**: 0 4px 6px rgba(0,0,0,0.15)
   - **Large**: 0 10px 20px rgba(0,0,0,0.20)
   - **XL**: 0 20px 40px rgba(0,0,0,0.25)

3. **Border Radius Presets**
   - None: 0px
   - Small: 4px
   - Medium: 8px
   - Large: 16px
   - Full: 9999px (pill shape)

4. **Blur Presets**
   - Small: 4px
   - Medium: 8px
   - Large: 16px

5. **Save All Changes**
   - Click "Save changes" button
   - Design tokens saved to database
   - Available across all pages

#### Using Tokens in Components

**In Designer**:
- When selecting colors, "Theme Colors" section appears at top of color picker
- Click "Primary" → Uses theme color
- When changed globally, all components using "Primary" update

**In Component Properties**:
```typescript
// Instead of hardcoded color
background: { color: "#007bff" }

// Use theme token
background: { color: "var(--color-primary)" }
```

**Result**: Global design system configured. Consistent colors, typography, and spacing across all pages. One-click global updates.

---

## Media Library Management

**Goal**: Upload, organize, and manage media files (images, videos, documents).

**User**: Editor or above

### Steps

1. **Navigate to Media Library**
   - Click "Media" in admin sidebar
   - Opens `/admin/media`

2. **View Media**
   - **Grid View** (default):
     - Thumbnail grid of all media
     - Shows filename, type, size
   - **List View**:
     - Detailed list with columns
     - Sortable by name, date, size

3. **Upload New Media**

   **Method 1: Click Upload**
   - Click "Upload Files" button
   - File picker opens
   - Select files (single or multiple)
   - Click "Open"

   **Method 2: Drag & Drop**
   - Drag files from computer
   - Drop onto media library grid
   - Upload starts automatically

   **Upload Process**:
   - Progress bars show for each file
   - System:
     - Validates file type and size
     - Generates unique filename
     - Optimizes images (Sharp):
       - Resizes large images
       - Generates WebP versions
       - Creates thumbnails
     - Saves to `/static/uploads/`
     - Creates Media database record

4. **View Media Details**
   - Click on media item
   - Details panel opens (right side)

   **Details Panel**:
   - **Large Preview**
   - **Metadata**:
     - Filename (editable)
     - Alt text (input field)
     - Title (input)
     - Caption (textarea)
     - File size: 2.4 MB
     - Dimensions: 1920×1080
     - Upload date: 2 hours ago
     - Uploaded by: Your Name
   - **Usage**: Used in 3 pages (clickable links)
   - **Actions**:
     - Button: Update (saves metadata changes)
     - Button: Download
     - Button: Replace file
     - Button: Delete

5. **Edit Media Metadata**
   - In details panel:
     - **Filename**: Change to "hero-image.jpg"
     - **Alt Text**: "Hero image showing modern office"
     - **Title**: "Modern Office"
     - **Caption**: "Our beautiful new workspace"
   - Click "Update" button
   - Metadata saved

6. **Replace File**
   - Click "Replace file" button
   - File picker opens
   - Select new file
   - System:
     - Uploads new file
     - Replaces old file
     - Updates Media record
     - All pages using this media show new file

7. **Delete Media**
   - Click "Delete" button
   - Confirmation dialog: "Delete hero-image.jpg?"
   - Warning: "This file is used in 3 pages. Those pages will show broken images."
   - Click "Delete" or "Cancel"
   - If confirmed, file deleted from disk and database

8. **Filter and Search**
   - **Search**: Type in search box → filters by filename
   - **Filter Dropdown**:
     - All
     - Images (jpeg, png, webp, gif)
     - Videos (mp4, webm)
     - Documents (pdf, doc)
   - **Sort Dropdown**:
     - Recent (newest first)
     - Name (A-Z)
     - Size (largest first)

9. **Use Media in Designer**
   - In page builder, add Media component
   - Click to select media
   - Media library modal opens
   - Select from uploaded files
   - OR Upload new file directly

**Result**: Organized media library with metadata, easy search, and usage tracking.

**Tips**:
- Add alt text for SEO and accessibility
- Use descriptive filenames
- Delete unused media to save space
- Check "Used in X pages" before deleting

---

## Summary

These workflows cover the essential user journeys in LineBasis:

1. **Setup**: First-time installation and configuration
2. **Design**: Creating and publishing pages with responsive breakpoints
3. **Reusability**: Creating and managing reusable blocks
4. **Content**: Writing and publishing blog posts
5. **Templates**: Designing blog templates with PostContent blocks
6. **Sharing**: Exporting and importing themes
7. **Collaboration**: Managing team members and roles
8. **Branding**: Configuring global design tokens
9. **Assets**: Managing media library

Each workflow is designed to be intuitive and efficient, minimizing clicks and maximizing designer productivity.

For technical implementation details, see [architecture.md](./architecture.md).  
For complete UI specifications, see [app.md](./app.md) and [page-builder-spec.md](./page-builder-spec.md).
