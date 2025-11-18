# Page Design Specifications

Detailed specifications for all pages in Linabasis.

## Design Philosophy

- **Typography oriented** inspired by the International Design Style
- **Minimalist** aesthetic with clean, uncluttered interfaces
- **Detail-oriented** interactions with precise micro-interactions

## Page Specifications

### **1. Home Dashboard** (`/admin`)
**Purpose:** Overview and quick actions for the entire system
**Layout:** Lists, text only.

#### **Stats List:**
- **Total Pages** (published + draft count)
- **Blog Posts** (published + draft count) 
- **Media Files** (total count)
- **Components** (public + private count)
- **Stylesheets** (active count)
- **Recent Activity** (last 5 actions with timestamps), e.g.:
  1. Published "About Us" page (2024-06-13 10:22)
  2. Uploaded "brand-logo.png" to Media (2024-06-13 09:58)
  3. Edited "Home" page title (2024-06-13 09:35)
  4. Created new Blog Post "Introducing Linebasis" (2024-06-13 08:47)
  5. Deleted draft "Untitled Page" (2024-06-13 08:22)

#### **Quick Actions (4 buttons):**
- **New Page** (primary CTA)
- **New Blog Post** 

#### **Additional Elements:**
- **Recent Activity Feed** (scrollable list with timestamps)
- **System Status** (database, plugins, etc.)
- **Welcome message** with user name

---

### **2. Pages Management** (`/admin/pages`)
**Purpose:** CRUD operations for website pages
**Layout:** List view with filters and search

#### **Header Section:**
- **Page Title** + **Description**
- **Search Bar** (by title/slug with real-time filtering)
- **Filter Dropdowns** (Status: All/Draft/Published, Type: All/Page/Blog Template)
- **Create New Page** button (primary CTA)

#### **Pages List:**
- **Page Card** showing:
  - Page title (editable inline)
  - Slug (editable inline) 
  - Status badge (Draft/Published)
  - Type badge (Page/Blog Template)
  - Last updated date
  - Actions menu (Edit, Duplicate, Delete, Publish/Unpublish)

#### **Empty State:**
- **Illustration** + **Message**
- **Create First Page** button

---

### **3. Templates Management** (`/admin/templates`)
**Purpose:** Manage page templates and themes
**Layout:** Grid view with template cards

#### **Header Section:**
- **Templates Title** + **Description**
- **Filter by Category** (Landing Pages, Blog Layouts, Components, etc.)
- **Create New Template** button (primary)

#### **Template Cards:**
- **Template Preview** (screenshot/thumbnail)
- **Template Name** + **Description**
- **Category Badge**
- **Actions Menu** (Use Template, Edit, Duplicate, Delete, Export)

#### **Template Detail Modal:**
- **Full Preview** of template
- **Template Info** (name, description, category, created date)
- **Use Template** button (primary)

---

### **4. Stylesheets List** (`/admin/styleguides`)
**Purpose:** Manage design systems and style libraries
**Layout:** List view with Stylesheet cards

#### **Header Section:**
- **Stylesheets Title** + **Description**
- **Create New Stylesheet** button (primary)

#### **Stylesheet Cards:**
- **Stylesheet Name** + **Description**
- **Design Token Preview** (color swatches, typography samples)
- **Component Count** (X components)
- **Last Modified** date
- **Actions Menu** (Edit, Duplicate, Delete, Export)

---

### **5. Stylesheet Editor** (`/admin/styleguides/[id]`)
**Purpose:** Edit design tokens and component library
**Layout:** Split view with sidebar + main content

#### **Sidebar Navigation:**
- **Design Tokens** (Colors, Typography, Spacing, Shadows)
- **Components** (Button, Card, Input, etc.)
- **Settings** (Name, Description, Inheritance)

#### **Main Content Areas:**

**Design Tokens Tab:**
- **Colors Section:**
  - Color palette with hex values
  - Add/Edit/Delete colors
  - Color picker integration
- **Typography Section:**
  - Font families, sizes, weights, line heights
  - Live preview of text samples
- **Spacing Section:**
  - Spacing scale (4px, 8px, 16px, 24px, 32px, etc.)
  - Visual spacing guide
- **Shadows Section:**
  - Shadow presets (small, medium, large)
  - Custom shadow builder

**Components Tab:**
- **Component Library** with live previews
- **Component Details** (props, variants, usage)
- **Edit Component** functionality

---

### **6. Blog Management** (`/admin/blog`)
**Purpose:** Manage blog posts and content
**Layout:** List view with post cards

#### **Header Section:**
- **Blog Title** + **Description**
- **Search Bar** (by title/content)
- **Filter Dropdowns** (Status: All/Draft/Published, Category: All/News/Tutorials/etc.)
- **Create New Post** button (primary)

#### **Posts List:**
- **Post Card** showing:
  - Post title (editable)
  - Excerpt preview
  - Status badge (Draft/Published)
  - Category + Tags
  - Author + Date
  - Actions menu (Edit, Delete, Publish/Unpublish)

---

### **7. Theme Management** (`/admin/themes`)
**Purpose:** Multi-theme management for client projects
**Layout:** Grid view with theme cards

#### **Header Section:**
- **Themes Title** + **Description**
- **Import Theme** button
- **Create New Theme** button (primary)

#### **Theme List:**
- **Theme Preview** (screenshot/thumbnail)
- **Theme Name** + **Description**
- **Client/Project** name
- **Status Badge** (Active, Modified, Saved)
- **Last Modified** date
- **Actions Menu** (Switch to, Edit, Duplicate, Export, Delete)

#### **Theme Switcher:**
- **Current Theme** indicator in sidebar
- **Quick Switch** dropdown
- **Theme Status** (Active, Modified, Saved)

---

## 🎨 **Design System Requirements**

### **Color Palette:**
- **Primary:** Blue (#2563eb)
- **Secondary:** Gray (#6b7280)
- **Success:** Green (#10b981)
- **Warning:** Yellow (#f59e0b)
- **Error:** Red (#ef4444)
- **Background:** Light gray (#f9fafb)
- **Surface:** White (#ffffff)

### **Typography Scale:**
- **H1:** 2.25rem (36px) / 700 weight
- **H2:** 1.875rem (30px) / 600 weight
- **H3:** 1.5rem (24px) / 600 weight
- **H4:** 1.25rem (20px) / 600 weight
- **Body:** 1rem (16px) / 400 weight
- **Small:** 0.875rem (14px) / 400 weight
- **Caption:** 0.75rem (12px) / 400 weight

### **Spacing System:**
- **xs:** 4px
- **sm:** 8px
- **md:** 16px
- **lg:** 24px
- **xl:** 32px
- **2xl:** 48px
- **3xl:** 64px

---

## 🚀 **Implementation Priority**

1. **Home Dashboard** - Core overview page
2. **Pages Management** - Primary content management
3. **Stylesheets List** - Design system foundation
4. **Stylesheet Editor** - Most complex, core functionality
5. **Templates Management** - Template system
6. **Blog Management** - Content management
7. **Theme Management** - Multi-theme system

---

## 📱 **Responsive Breakpoints**

- **Mobile:** 320px - 767px
- **Tablet:** 768px - 1023px
- **Desktop:** 1024px+

### **Mobile Adaptations:**
- **Single column** layout for all pages
- **Collapsible** sidebar navigation
- **Stacked** card layouts
- **Touch-friendly** button sizes (44px minimum)
- **Swipe gestures** for actions where appropriate

---

## 🎯 **Accessibility Requirements**

- **WCAG 2.1 AA** compliance
- **Keyboard navigation** support
- **Screen reader** compatibility
- **High contrast** mode support
- **Focus indicators** for all interactive elements
- **Alt text** for all images and icons
- **Semantic HTML** structure

---

## 🔄 **User Flow Considerations**

### **Primary User Flows:**
1. **Create New Page** → Design → Publish
2. **Manage Stylesheet** → Edit Tokens → Apply to Components
3. **Switch Theme** → Edit Stylesheet → Save Changes
4. **Create Blog Post** → Write Content → Publish

### **Secondary User Flows:**
1. **Import Theme** → Customize → Export
2. **Duplicate Template** → Modify → Use
3. **Manage Media** → Upload → Use in Design

---

This specification serves as the foundation for all admin page designs in Linebasis, ensuring consistency and user experience across the entire application.
