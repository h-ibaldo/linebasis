# Pattern
UI Handoff Comments

# When to use
When a developer has implemented the logic/structure of a component and is handing it off to a designer for styling.

# How it works
Place descriptive HTML comments in the markup indicating the intended design structure, grouping, or specific styling requirements.

# Example
```svelte
<!-- STYLE: Main container - needs to be centered on viewport -->
<div class="login-container">
  <!-- STYLE: Brand header with logo -->
  <header class="login-header">...</header>
  
  <!-- STYLE: Form card with shadow and rounded corners -->
  <form class="login-form">...</form>
</div>
```
