# Linabasis - Quick Test Reference

## 🚀 Server Running on: http://localhost:5175

---

## 🎨 Designer Tool Demos

| Demo | URL | Test |
|------|-----|------|
| **Homepage** | http://localhost:5175 | Overview & navigation |
| **Canvas** | http://localhost:5175/canvas-demo | Drag, drop, artboards |
| **Undo/Redo** | http://localhost:5175/event-sourcing-demo | Cmd+Z / Cmd+Shift+Z |
| **Auto-Save** | http://localhost:5175/persistence-demo | Projects & storage |
| **Components** | http://localhost:5175/components-demo | 9 design components |
| **Code Gen** | http://localhost:5175/code-generation-demo | HTML/CSS output |
| **Export** | http://localhost:5175/export-demo | Download ZIP |
| **Publish** | http://localhost:5175/publishing-demo | Design → Live |

---

## 🔐 Admin Panel

| Section | URL | Credentials |
|---------|-----|-------------|
| **Login** | http://localhost:5175/admin/login | admin@linebasis.com / admin123 |
| **Dashboard** | http://localhost:5175/admin | Statistics & overview |
| **Pages** | http://localhost:5175/admin/pages | Manage pages |
| **Media** | http://localhost:5175/admin/media | Upload & manage files |
| **Users** | http://localhost:5175/admin/users | User management |
| **Plugins** | http://localhost:5175/admin/plugins | Plugin system |
| **Settings** | http://localhost:5175/admin/settings | Site configuration |

---

## 📝 Blog Plugin (when active)

| Section | URL | Feature |
|---------|-----|---------|
| **Posts** | http://localhost:5175/admin/posts | Create & manage posts |
| **Categories** | http://localhost:5175/admin/categories | Organize posts |
| **Tags** | http://localhost:5175/admin/tags | Tag system |

---

## 🛠️ Useful Commands

```bash
# Start server
npm run dev

# Run tests
npm run test
npm run test:ui

# Database
npm run db:studio     # View database at http://localhost:5555
npm run db:compose    # Compose plugin schemas
npm run db:migrate    # Run migrations
npm run db:generate   # Generate Prisma client

# Setup
npm run setup         # Full setup (DB + admin user)
```

---

## ⚡ Quick Test Flow

### 1. Designer Tool (5 min)
1. Visit http://localhost:5175/canvas-demo
2. Create artboard, drag it around
3. Try undo/redo (Cmd+Z)
4. Visit /persistence-demo
5. Create a project, see auto-save

### 2. CMS Admin (5 min)
1. Login at http://localhost:5175/admin/login
2. View dashboard statistics
3. Go to Pages, create a new page
4. Go to Media, upload an image
5. Go to Plugins, check Blog plugin status

### 3. Blog Plugin (3 min)
1. Ensure Blog plugin is active
2. Visit /admin/posts
3. Create a test post
4. Add categories and tags
5. Publish the post

---

## 🐛 Quick Fixes

### Schema Error?
```bash
cp prisma/schema.core.prisma prisma/schema.prisma
npm run db:compose
npm run db:generate
```

### Login Not Working?
```bash
npm run setup  # Recreates admin user
```

### Port Conflict?
Check terminal for actual port (might be 5174, 5175, etc.)

---

## 📊 What to Look For

**✅ Working:**
- Smooth drag and drop
- Instant undo/redo
- Auto-save (watch for indicator)
- Fast page loads
- No console errors

**❌ Issues:**
- Lag or stuttering
- Data not persisting
- 404 errors
- Console errors
- Broken images

---

**See TESTING_GUIDE.md for comprehensive testing checklist**

