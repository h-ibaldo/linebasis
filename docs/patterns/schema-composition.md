# Pattern
Database Schema Composition

# When to use
When a plugin requires its own database tables or needs to extend core models.

# How it works
1. Create a `prisma/schema.prisma` in your plugin folder.
2. Define models *without* datasource/generator blocks.
3. Run `npm run db:compose`.
4. The system merges your partial schema into the core `schema.prisma`.

# Example
```prisma
// plugins/my-plugin/prisma/schema.prisma
model MyPluginItem {
  id     String @id @default(uuid())
  name   String
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```
