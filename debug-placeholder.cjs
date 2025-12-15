// Quick debug script to check placeholder rendering
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:5176');
  await page.waitForTimeout(2000);

  console.log('=== Checking interaction state store ===');

  // Log what we can access from the page
  const storeCheck = await page.evaluate(() => {
    // Try to access Svelte stores from window
    return {
      hasStores: typeof window.$interactionState !== 'undefined',
      elementCount: document.querySelectorAll('[data-element-id]').length
    };
  });

  console.log('Store check:', storeCheck);

  // Check if there's an auto-layout parent using computed styles
  const autoLayoutParents = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[data-element-id]'));
    return elements
      .filter(el => window.getComputedStyle(el).display === 'flex')
      .map(el => ({
        id: el.getAttribute('data-element-id'),
        childCount: Array.from(el.children).filter(c => c.hasAttribute('data-element-id')).length,
        display: window.getComputedStyle(el).display
      }));
  });

  console.log('Auto-layout parents found:', autoLayoutParents.length);
  if (autoLayoutParents.length > 0) {
    console.log('Parents:', JSON.stringify(autoLayoutParents, null, 2));
  }

  // Try to drag an element if exists
  if (autoLayoutParents.length > 0) {
    const parentId = autoLayoutParents[0].id;
    console.log('Testing drag on parent:', parentId);

    const firstChild = await page.locator(`[data-element-id="${parentId}"] > [data-element-id]`).first();
    if (await firstChild.count() > 0) {
      const box = await firstChild.boundingBox();
      console.log('Child box:', box);

      // Start drag
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2 + 100, { steps: 10 });

      await page.waitForTimeout(500);

      // Check for placeholder
      const placeholder = await page.locator('.auto-layout-placeholder').count();
      console.log('Placeholder count:', placeholder);

      if (placeholder === 0) {
        console.log('NO PLACEHOLDER FOUND!');

        // Debug interaction state
        const state = await page.evaluate(() => {
          return {
            activeElement: window.document.querySelector('[data-element-id]')?.getAttribute('data-element-id'),
            hasInteractionStore: typeof window !== 'undefined'
          };
        });
        console.log('Debug state:', state);
      }

      await page.mouse.up();
    }
  }

  await page.waitForTimeout(5000);
  await browser.close();
})();
