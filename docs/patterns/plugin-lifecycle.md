# Pattern
Plugin Lifecycle Hooks

# When to use
When a plugin needs to execute logic during specific system events (installation, activation, page publishing, user creation).

# How it works
Define async functions in the `hooks` object of your `manifest.ts`. The `HooksManager` detects these and executes them at the appropriate time.

# Example
```typescript
// manifest.ts
export const manifest: PluginManifest = {
  // ...
  hooks: {
    onActivate: async () => {
      console.log('Plugin activated');
      await seedDatabase();
    },
    onUserCreate: async (user) => {
      await sendWelcomeEmail(user.email);
    }
  }
};
```
