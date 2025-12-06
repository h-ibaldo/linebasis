# E2E Tests with Playwright

This directory contains end-to-end tests for the Linebasis page builder using Playwright.

## Setup

Playwright is already installed and configured. To get started:

```bash
# Install browser binaries (already done during setup)
npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e -- group-drag-rotated-parent.spec.ts

# Debug tests
npm run test:e2e:debug
```

## Test Structure

### Current Tests

#### `group-drag-rotated-parent.spec.ts`
Tests group drag behavior inside rotated parent containers.

**Issue being tested**: When dragging a group of elements inside a rotated parent, elements should not jump on mousedown and should move smoothly with the cursor.

**Key scenarios**:
1. Group drag inside non-rotated parent (baseline)
2. Group drag inside 45° rotated parent (main bug)
3. Group drag inside nested rotated parents (complex case)

## Writing New Tests

### Helper Functions Pattern

The test files include helper functions for common operations:

```typescript
// Create an element by selecting tool and clicking
async function createElement(
    page: Page,
    type: 'div' | 'text',
    canvasX: number,
    canvasY: number
): Promise<string>

// Get element's screen position
async function getElementScreenBox(
    page: Page,
    elementId: string
)

// Set element rotation via properties panel
async function setRotation(
    page: Page,
    elementId: string,
    rotation: number
)

// Select multiple elements (Cmd+Click)
async function selectMultiple(
    page: Page,
    elementIds: string[]
)
```

### Page Builder Workflow

1. **Creating Elements**:
   - Click toolbar button (e.g., "Div", "Text")
   - Click on canvas at desired position
   - Element is created and automatically selected
   - **Important**: Switch back to "Move" tool before creating next element

2. **Selecting Elements**:
   - Single select: Click element
   - Multi-select: Cmd+Click (Meta key modifier)
   - Group select: Drag selection box (not yet implemented in tests)

3. **Rotating Elements**:
   - Select element
   - Find rotation input in Properties panel
   - Enter rotation value and press Enter

4. **Dragging Elements**:
   - Move cursor to element center
   - Mouse down
   - Move cursor (use `steps` parameter for smooth drag)
   - Mouse up

### Testing Coordinate Transforms

When testing rotated elements, use **screen coordinates** (from `getBoundingClientRect()`) rather than trying to calculate canvas coordinates. This matches what the user sees.

```typescript
// Good: Use actual screen positions
const box = await getElementScreenBox(page, elementId);
await page.mouse.move(box.centerX, box.centerY);

// Bad: Trying to calculate transformed coordinates
// const transformedPos = calculateRotation(pos, rotation); // Don't do this
```

### Screenshots and Videos

Tests automatically capture:
- Screenshots on failure
- Videos of failed tests
- Custom screenshots during test (use `await page.screenshot()`)

All test artifacts are saved to:
- `test-results/[test-name]/test-failed-1.png`
- `test-results/[test-name]/video.webm`

## Configuration

See `playwright.config.ts` in the project root for:
- Test directory location
- Browser configuration
- Viewport settings
- Timeout values
- Dev server configuration

## Current Test Status

### Known Issues

The initial test implementation needs fixes:
1. **Element creation**: Need to switch to "Move" tool between creating elements
2. **Rotation input**: Need to find correct selector for rotation input in Properties panel
3. **Parent-child relationships**: Elements don't automatically nest - need to implement parenting logic

### Next Steps

1. Fix element creation workflow
2. Implement helper for setting parent-child relationships
3. Add test for the actual group drag bug with rotated parents
4. Once tests pass, they can be used to verify the fix

## Benefits of E2E Testing

With Playwright, we can:
- **Actually see** the bug in action (screenshots/videos)
- **Measure** exact jump distances in pixels
- **Verify** fixes work across different scenarios
- **Prevent regressions** by running tests on every change
- **Debug visually** with headed mode and trace viewer

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Page Object Model](https://playwright.dev/docs/pom) - For organizing larger test suites
