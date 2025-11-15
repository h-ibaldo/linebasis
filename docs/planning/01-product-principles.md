# Linabasis — “Unbreakable Site Builder” Requirements Specification
**Version:** 1.0  
**Author:** Henrique Ibaldo  

## Goal
Build a visual page builder (Linabasis) where **sites never break**, regardless of user mistakes, plugin bugs, layout changes, theme updates, or third-party integrations. Linabasis must become a deterministic, versioned, sandboxed, safe-update site builder that hosts can trust.

---

# 1. Deterministic Build System
**Requirement:**  
“Given the same content + configuration, Linabasis must always produce identical output.”

### Implementation Guidelines
- No randomness in builds.  
- No plugin code running during build that touches globals.  
- No nondeterministic operations inside rendering.  
- Build output must be serializable.  
- Build artifacts must be diff-friendly.  

**Why:** Ensures safe rollback, predictable updates, and stable deployments.

---

# 2. Atomic Publishing
**Requirement:**  
“Publishing replaces the entire site output in one atomic operation.”

### Implementation Guidelines
- Generate full build in a temporary directory.  
- Validate it.  
- Atomically switch the live directory to the new build.  
- Never expose partial builds.  

**Why:** Avoids half-deployed or corrupted states.

---

# 3. Versioned Layout & Content
**Requirement:**  
“Every change a user makes must be automatically versioned.”

### Implementation Guidelines
- Treat changes like “commits.”  
- Allow instant restore of any version.  
- Support drafts/branches.  
- Store metadata (user, timestamp, diff).  

**Why:** Enables quick rollback when something goes wrong.

---

# 4. Plugin Sandboxing
**Requirement:**  
“No plugin should be able to break the global site.”

### Implementation Guidelines
- Plugins run in iframes or virtualized JS contexts.  
- No access to `window` or global DOM.  
- Only communicate via a defined API.  
- No direct file writes.  
- Plugins use controlled API for DB access.  

**Why:** Prevents cross-plugin interference and global crashes.

---

# 5. Safe Mode (Recovery Mode)
**Requirement:**  
“If anything breaks, LB must boot into Safe Mode with the last working build.”

### Implementation Guidelines
- Detect failed builds automatically.  
- Auto-rollback to last healthy version.  
- Load editor without plugins.  
- Display error logs + diffs of changes.  

**Why:** Guarantees the site always loads.

---

# 6. Safe Updates Pipeline
**Requirement:**  
“All updates must run in a sandbox before affecting the real site.”

### Implementation Guidelines
- Test updates in isolation.  
- Run compatibility checks.  
- Compare output before/after (diff).  
- Create rollback version before update.  
- Block or warn about risky updates.  

**Why:** Updates are the #1 cause of broken sites.

---

# 7. Build-Time Integrity Checks
**Requirement:**  
“Before publishing, LB must validate the integrity of the entire build.”

### Checks to Implement
#### CSS Integrity
- Invalid selectors  
- Infinite cascade loops  
- Missing tokens  

#### JavaScript Integrity
- Infinite loops  
- Blocking code  
- Direct DOM manipulation outside sandbox  

#### Component Integrity
- Missing components  
- Invalid props  
- Unused dependencies  

#### Asset Integrity
- Missing images  
- Incorrect paths  
- Non-optimized files  

#### Performance Integrity
- Page load too heavy  
- Asset weight budget  
- Script execution time limit  

**Why:** Prevents shipping broken or slow pages.

---

# 8. Decoupled Data Layer (Headless-Friendly)
**Requirement:**  
“LB must not depend on a specific backend. All data access goes through unified APIs.”

### Implementation Guidelines
- CMS-agnostic data adapter system.  
- Adapters for: WordPress REST, Strapi, Sanity, Contentful, Ghost.  
- Frontend never directly uses backend SDKs.  

**Why:** Makes LB acquirable by any CMS company.

---

# 9. Layout Consistency & Drift Prevention
**Requirement:**  
“LB must detect broken layouts automatically.”

### Implementation Guidelines
- Screenshot comparison (optionally AI-assisted).  
- Detect missing elements.  
- Detect alignment issues and grid shifts.  
- Detect CSS specificity collisions.  

**Why:** Catches subtle visual regressions.

---

# 10. Rollback-First Philosophy
**Requirement:**  
“All destructive actions must be reversible.”

### Implementation Guidelines
- Soft-delete behaviors.  
- Safe-point snapshots before each update.  
- Rollback tags for every publish.  

**Why:** Ensures safety even for beginners.

---

# 11. Host Integration SDK
**Requirement:**  
“Hosts must be able to integrate Linabasis easily and safely.”

### Implementation Guidelines
- CLI for build/publish commands.  
- Hooks for safe-upgrade workflows.  
- Event logs for hosting dashboards.  
- Auto-fix suggestions for common issues.  

**Why:** Makes LB valuable to hosts and improves acquisition potential.

---

# 12. Optional: AI Auto-Fix Layer
**Requirement:**  
“When LB detects a broken layout or invalid code, AI can propose fixes.”

### Implementation Guidelines
- AI runs only after safety checks.  
- Must show diffs clearly.  
- User approval required.  
- AI cannot silently modify live sites.  

**Why:** Reduces support and gives a “magical” UX.

---

# Mission Summary for AI Agents
When building ANY part of Linabasis:

### Always Prioritize
1. Determinism  
2. Rollback safety  
3. Isolation  
4. Integrity validation  
5. Predictable rendering  
6. Safe updates  
7. No global side effects  
8. CMS headless compatibility  

### Core Principle
**If any choice could break the site → choose the safer alternative.  
If any operation is nondeterministic → make it deterministic.  
If any plugin touches globals → sandbox it.**

This is the foundational philosophy of Linabasis.

---

# End of Document
