# Linabasis - Complete Testing Guide

## 🚀 Server Status

**✅ Server is Running!**
- **URL:** http://localhost:5175
- **Status:** Ready for testing

---

## 📋 Quick Start Testing

### 1. Homepage
```
http://localhost:5175
```
**What to test:**
- Page loads correctly
- All demo links are visible
- Navigation works

---

## 🎨 Designer Tool - Feature Testing

### 2. Canvas Demo
```
http://localhost:5175/canvas-demo
```

**Test Checklist:**
- [ ] Canvas loads and displays
- [ ] Create new artboard button works
- [ ] Drag artboards around the canvas
- [ ] Select artboards (click)
- [ ] Multi-select artboards (Shift+click or Ctrl+click)
- [ ] Resize artboards with handles
- [ ] Baseline grid toggle (show/hide)
- [ ] Zoom controls work
- [ ] Pan the canvas by dragging

**Expected Features:**
- Infinite canvas
- Multiple artboards
- Visual feedback on selection
- Smooth drag and drop

---

### 3. Event Sourcing Demo
```
http://localhost:5175/event-sourcing-demo
```

**Test Checklist:**
- [ ] Make changes to elements
- [ ] Undo (Cmd+Z or Ctrl+Z)
- [ ] Redo (Cmd+Shift+Z or Ctrl+Shift+Z)
- [ ] View event history panel
- [ ] Each action creates an event
- [ ] Event count increases with actions
- [ ] Time-travel through history works

**Expected Features:**
- Perfect undo/redo
- Complete event history
- No lost state
- All actions are reversible

---

### 4. Persistence Demo
```
http://localhost:5175/persistence-demo
```

**Test Checklist:**
- [ ] "Create Project" button works
- [ ] Enter project name
- [ ] Project appears in project list
- [ ] Auto-save indicator appears when editing
- [ ] Make changes - watch auto-save trigger
- [ ] Refresh page - changes are persisted
- [ ] Load different project
- [ ] Delete project
- [ ] View storage statistics
- [ ] Export project as JSON
- [ ] Import project from JSON

**Expected Features:**
- Projects persist in browser (IndexedDB)
- Auto-save every 1 second (debounced)
- No data loss on refresh
- Fast load times

---

### 5. Components Demo
```
http://localhost:5175/components-demo
```

**Test Component Categories:**

#### Typography Components
- [ ] **Heading** - H1 through H6 levels
- [ ] **Paragraph** - Body text with baseline alignment
- [ ] **Text** - Inline text spans

#### Layout Components
- [ ] **Container** - Responsive width containers
- [ ] **Grid** - CSS Grid layout system
- [ ] **Flex** - Flexbox layout system

#### Form Components
- [ ] **Button** - Various button styles
- [ ] **Input** - Text input fields
- [ ] **Select** - Dropdown selections

**Test Baseline Grid:**
- [ ] Toggle baseline grid overlay
- [ ] Verify text aligns to grid lines
- [ ] Change baseline height setting
- [ ] Text snaps to new baseline

---

### 6. Code Generation Demo
```
http://localhost:5175/code-generation-demo
```

**Test Checklist:**
- [ ] Create a simple design
- [ ] Click "Generate Code"
- [ ] View HTML output
- [ ] View CSS output
- [ ] Copy code to clipboard
- [ ] Verify code is clean and valid
- [ ] Test semantic HTML structure
- [ ] Check CSS is properly formatted

**Expected Output:**
- Clean, semantic HTML
- Well-structured CSS
- Baseline grid CSS included
- Production-ready code

---

### 7. Export Demo
```
http://localhost:5175/export-demo
```

**Test Checklist:**
- [ ] Create a design with multiple components
- [ ] Click "Export as ZIP"
- [ ] Choose export preset (HTML/CSS, Svelte, etc.)
- [ ] Download completes
- [ ] Extract ZIP file
- [ ] Verify file structure:
  - `index.html`
  - `styles.css`
  - `README.md`
- [ ] Open HTML in browser
- [ ] Design renders correctly

**Export Presets to Test:**
- [ ] HTML/CSS (static)
- [ ] Svelte component (if available)
- [ ] React component (if available)

---

### 8. Publishing Demo
```
http://localhost:5175/publishing-demo
```

**Test Checklist:**
- [ ] Design a page in the editor
- [ ] Enter page metadata (title, slug, description)
- [ ] Click "Save to Database"
- [ ] Page appears in database
- [ ] Click "Publish"
- [ ] Visit published page
- [ ] Page renders live
- [ ] Unpublish page
- [ ] Verify page is no longer accessible

**Expected Flow:**
1. Design → Save → Publish → Live Page
2. Changes update in real-time
3. SEO metadata is preserved

---

## 🔐 CMS Admin Panel - Authentication & Management

### 9. Admin Login
```
http://localhost:5175/admin/login
```

**Default Credentials:**
- Email: `admin@linebasis.com`
- Password: `admin123`

**Test Checklist:**
- [ ] Login page displays correctly
- [ ] Enter credentials
- [ ] Click "Login"
- [ ] Successful login redirects to dashboard
- [ ] JWT token stored
- [ ] Test incorrect password (should fail)
- [ ] Test non-existent user (should fail)

**⚠️ IMPORTANT:** Change the default password after first login!

---

### 10. Admin Dashboard
```
http://localhost:5175/admin
```

**Test Checklist:**
- [ ] Dashboard loads
- [ ] Statistics displayed:
  - Total pages count
  - Published pages count
  - Total media files
  - Total users
- [ ] User info shows:
  - Name
  - Email
  - Role badge (Admin/Editor/Author)
- [ ] Quick action cards work:
  - Create New Page
  - Upload Media
  - Manage Users
  - View Settings
- [ ] Navigation menu present
- [ ] Logout button works

---

### 11. Page Manager
```
http://localhost:5175/admin/pages
```

**Test Checklist:**
- [ ] List of all pages displays
- [ ] Page statuses shown (draft/published)
- [ ] "Create New Page" button
- [ ] Edit existing page
- [ ] Delete page (with confirmation)
- [ ] Filter pages by status
- [ ] Search pages by title
- [ ] Sort pages by date
- [ ] Pagination works (if many pages)

---

### 12. Media Library
```
http://localhost:5175/admin/media
```

**Test Checklist:**
- [ ] Grid view of uploaded media
- [ ] "Upload Media" button
- [ ] Upload image file:
  - [ ] Accepts JPEG, PNG, GIF, WebP
  - [ ] Shows upload progress
  - [ ] Image appears in library
  - [ ] Thumbnail generated
- [ ] View media details:
  - [ ] Filename
  - [ ] File size
  - [ ] Dimensions (for images)
  - [ ] Upload date
  - [ ] Public URL
- [ ] Copy media URL
- [ ] Delete media file
- [ ] Storage statistics shown

**Test Image Optimization:**
- [ ] Upload large image (>2000px)
- [ ] Verify automatic resizing
- [ ] Check file size reduction

---

### 13. User Management
```
http://localhost:5175/admin/users
```

**Test Checklist:**
- [ ] List of all users
- [ ] User roles displayed
- [ ] "Create New User" button
- [ ] Create user with different roles:
  - [ ] Admin (full access)
  - [ ] Editor (can publish)
  - [ ] Author (can write)
- [ ] Edit user details
- [ ] Change user password
- [ ] Delete user (not self)
- [ ] Cannot delete own account

---

### 14. Plugin Management
```
http://localhost:5175/admin/plugins
```

**Test Checklist:**
- [ ] List of installed plugins
- [ ] Plugin status (Active/Inactive)
- [ ] Blog plugin shows:
  - [ ] Name: "Blog System"
  - [ ] Version number
  - [ ] Description
  - [ ] Settings button
- [ ] Activate plugin
- [ ] Deactivate plugin
- [ ] View plugin settings
- [ ] Update plugin settings

**Blog Plugin Navigation:**
When Blog plugin is active:
- [ ] Posts menu appears in admin
- [ ] Categories menu appears
- [ ] Tags menu appears

---

### 15. Blog System (Plugin)
```
http://localhost:5175/admin/posts
```

**Test Checklist:**

#### Posts Management
- [ ] Create new post
- [ ] Add post title
- [ ] Write post content (Markdown/HTML)
- [ ] Add excerpt
- [ ] Set featured image
- [ ] Assign categories
- [ ] Add tags
- [ ] Set post status:
  - [ ] Draft
  - [ ] Published
  - [ ] Scheduled
  - [ ] Archived
- [ ] Schedule post for future
- [ ] Add SEO metadata
- [ ] Save post
- [ ] Publish post
- [ ] View published post on frontend
- [ ] Edit existing post
- [ ] Delete post

#### Categories Management
```
http://localhost:5175/admin/categories
```
- [ ] Create category
- [ ] Set category slug
- [ ] Add description
- [ ] Create subcategory (hierarchical)
- [ ] Add SEO metadata
- [ ] Edit category
- [ ] Delete category

#### Tags Management
```
http://localhost:5175/admin/tags
```
- [ ] Create tag
- [ ] Set tag slug
- [ ] Edit tag
- [ ] Delete tag
- [ ] View posts with tag

---

### 16. Settings
```
http://localhost:5175/admin/settings
```

**Test Checklist:**
- [ ] Site settings form
- [ ] Update site title
- [ ] Update site description
- [ ] Update site URL
- [ ] Change contact email
- [ ] Toggle features on/off
- [ ] Save settings
- [ ] Verify settings persist

---

## 🧪 API Testing (Advanced)

### Authentication API

#### Register
```bash
curl -X POST http://localhost:5175/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User",
    "role": "author"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5175/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@linebasis.com",
    "password": "admin123"
  }'
```

#### Get Current User
```bash
curl http://localhost:5175/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### Pages API

#### List Pages
```bash
curl http://localhost:5175/api/pages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Create Page
```bash
curl -X POST http://localhost:5175/api/pages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-page",
    "title": "Test Page",
    "description": "A test page",
    "designEvents": "[]",
    "status": "draft"
  }'
```

#### Publish Page
```bash
curl -X POST http://localhost:5175/api/pages/{PAGE_ID}/publish \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### Media API

#### Upload Media
```bash
curl -X POST http://localhost:5175/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/image.jpg"
```

#### List Media
```bash
curl http://localhost:5175/api/media \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### Blog Plugin API

#### Create Post
```bash
curl -X POST http://localhost:5175/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "my-first-post",
    "title": "My First Post",
    "excerpt": "This is a test post",
    "content": "# Hello World\n\nThis is my first blog post!",
    "status": "published"
  }'
```

#### List Posts
```bash
curl http://localhost:5175/api/posts
```

---

## 🧩 Running Tests

### Unit Tests
```bash
npm run test
```

**Test Suites:**
- Event sourcing tests
- Event reducer tests
- Baseline grid tests
- Export service tests
- Component tests

### Run Tests with UI
```bash
npm run test:ui
```
Opens Vitest UI in browser for interactive testing.

### Run Tests Once
```bash
npm run test:run
```
Runs all tests once and exits.

---

## 🐛 Troubleshooting

### Issue: Port Already in Use
If you see "Port 5173 is in use", the server will automatically try the next port (5174, 5175, etc.).

Check the terminal output to see which port is actually being used.

### Issue: Database Errors
If you encounter database errors:

```bash
# Regenerate database
npm run db:compose
npm run db:migrate
npm run db:generate

# Or run full setup
npm run setup
```

### Issue: Schema Composition Errors
If you see duplicate model errors:

```bash
# Check what would be composed (dry-run)
npm run db:compose:check

# Restore core schema
cp prisma/schema.core.prisma prisma/schema.prisma

# Recompose
npm run db:compose
```

### Issue: Login Not Working
Reset admin user:

```bash
npm run setup
```

This will recreate the admin user with default credentials.

### Issue: Media Upload Fails
Check upload directory exists and is writable:

```bash
mkdir -p static/uploads
chmod 755 static/uploads
```

---

## 📊 Database Inspection

### View Database in Prisma Studio
```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555 where you can:
- View all tables
- Browse records
- Edit data directly
- Run queries
- View relationships

---

## ✅ Testing Checklist Summary

### Designer Tool (8 demos)
- [x] Homepage
- [ ] Canvas Demo
- [ ] Event Sourcing Demo
- [ ] Persistence Demo
- [ ] Components Demo
- [ ] Code Generation Demo
- [ ] Export Demo
- [ ] Publishing Demo

### CMS Admin (8 sections)
- [ ] Login
- [ ] Dashboard
- [ ] Page Manager
- [ ] Media Library
- [ ] User Management
- [ ] Plugin Management
- [ ] Blog System
- [ ] Settings

### API Testing
- [ ] Authentication endpoints
- [ ] Pages CRUD
- [ ] Media upload
- [ ] Blog posts
- [ ] Categories & tags

---

## 🎯 Feature Coverage

**Phase 1 - Designer Tool:** ✅ 100% Complete
- Canvas system
- Event sourcing
- Persistence
- Components
- Code generation
- Export system

**Phase 1.5 - CMS Foundation:** ✅ 100% Complete
- Authentication
- Database layer
- Publishing system
- Media management
- Admin panel

**Phase 2 - Plugin Architecture:** ✅ 100% Complete
- Plugin system
- Schema composition
- Blog plugin
- Lifecycle hooks
- Plugin management UI

---

## 📝 Test Results Template

Use this template to track your testing:

```
Testing Session: [DATE]
Tester: [YOUR NAME]

### Designer Tool
- Canvas Demo: ✅/❌ [Notes]
- Event Sourcing: ✅/❌ [Notes]
- Persistence: ✅/❌ [Notes]
- Components: ✅/❌ [Notes]
- Code Generation: ✅/❌ [Notes]
- Export: ✅/❌ [Notes]
- Publishing: ✅/❌ [Notes]

### CMS Admin
- Login: ✅/❌ [Notes]
- Dashboard: ✅/❌ [Notes]
- Pages: ✅/❌ [Notes]
- Media: ✅/❌ [Notes]
- Users: ✅/❌ [Notes]
- Plugins: ✅/❌ [Notes]
- Blog: ✅/❌ [Notes]
- Settings: ✅/❌ [Notes]

### Bugs Found
1. [Description]
2. [Description]

### Performance Notes
- Load times: [Good/Slow]
- Responsiveness: [Good/Poor]
- Memory usage: [Normal/High]
```

---

## 🚀 Next Steps After Testing

1. **Report Bugs:** Document any issues found
2. **Feature Requests:** Note missing features or improvements
3. **Performance:** Track slow pages or operations
4. **UX Improvements:** Suggest UI/UX enhancements
5. **Documentation:** Add missing documentation

---

**Happy Testing! 🎉**

For questions or issues, refer to:
- `README.md` - Project overview
- `docs/PLUGIN_DEVELOPMENT.md` - Plugin development
- `docs/development/setup.md` - Development setup
- `TROUBLESHOOTING.md` - Common issues

