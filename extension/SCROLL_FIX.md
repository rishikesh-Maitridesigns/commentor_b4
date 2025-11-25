# Scroll Position & DOM Selector Fix

## Problem

When testers added comments on scrolled pages using the Chrome extension:
1. Comments appeared at the top of the page in the dashboard (wrong position)
2. The author couldn't see where the comment was actually made
3. DOM selectors were captured but not properly utilized

## Root Cause

The extension was capturing the **absolute position** (x, y with scroll offset) but:
- Screenshots only capture the **visible viewport** (not the full page)
- The dashboard was displaying pins using absolute coordinates on viewport-sized screenshots
- This caused a mismatch: pins showed where comments were on the full page, but screenshots only showed the visible area

## Solution Implemented

### 1. Capture Scroll Position in Extension

**File: `/extension/content.js`**

Now captures both absolute position AND scroll offset:

```javascript
const commentData = {
  domSelector: getOptimalSelector(element),
  text: text.trim(),
  x: rect.left + window.scrollX,      // Absolute X position on page
  y: rect.top + window.scrollY,       // Absolute Y position on page
  scrollX: window.scrollX,             // ✨ NEW: Scroll offset X
  scrollY: window.scrollY,             // ✨ NEW: Scroll offset Y
  screenshot: response.screenshot,
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight
};
```

### 2. Store Scroll Data in Database

**File: `/extension/background.js`**

Now stores scroll position in the `position_data` JSONB field:

```javascript
const threadPayload = {
  app_id: session.activeSession.appId,
  page_url: tab.url,
  dom_selector: commentData.domSelector ? { selector: commentData.domSelector } : null,
  position_data: {
    x: commentData.x,                  // Absolute position
    y: commentData.y,
    scrollX: commentData.scrollX || 0, // ✨ NEW: Scroll offset
    scrollY: commentData.scrollY || 0, // ✨ NEW: Scroll offset
    viewportWidth: commentData.viewportWidth,
    viewportHeight: commentData.viewportHeight
  },
  status: 'open'
};
```

### 3. Calculate Viewport-Relative Positions in Dashboard

**Files: `/src/pages/AppDetails.tsx` and `/src/pages/PublicReview.tsx`**

When displaying pins on screenshots, we now subtract the scroll offset to get viewport-relative coordinates:

```javascript
const updateCommentPins = (threadsData: ThreadWithComments[]) => {
  const pins: CommentPin[] = threadsData
    .filter(thread => thread.position_data)
    .map(thread => {
      const pos = typeof thread.position_data === 'string'
        ? JSON.parse(thread.position_data)
        : thread.position_data;

      const scrollX = pos.scrollX || 0;
      const scrollY = pos.scrollY || 0;

      return {
        threadId: thread.id,
        x: (pos.x || 0) - scrollX,     // ✨ Viewport-relative position
        y: (pos.y || 0) - scrollY,     // ✨ Viewport-relative position
      };
    });
  setCommentPins(pins);
};
```

## DOM Selector Storage

### How It Works

1. **Element Selection**: When a tester clicks an element, `getOptimalSelector()` generates a CSS selector:
   ```javascript
   function getOptimalSelector(element) {
     if (element.id) return `#${element.id}`;

     // Builds path like: div.container > button.primary:nth-of-type(2)
     // Uses IDs, classes, and nth-of-type for precision
   }
   ```

2. **Storage**: Stored in `threads.dom_selector` as JSONB:
   ```json
   {
     "selector": "div.main-content > section.hero:nth-of-type(1) > button.cta-button"
   }
   ```

3. **Benefits**:
   - Authors can see exactly which element was commented on
   - Could enable "jump to element" functionality in future
   - Helps with responsive design debugging (same element, different viewport sizes)

## Database Schema

### threads.position_data (JSONB)

```json
{
  "x": 450,              // Absolute X on full page
  "y": 1250,             // Absolute Y on full page (e.g., user scrolled down)
  "scrollX": 0,          // How far scrolled horizontally
  "scrollY": 800,        // How far scrolled vertically
  "viewportWidth": 1920,
  "viewportHeight": 1080
}
```

### threads.dom_selector (JSONB)

```json
{
  "selector": "#hero-section > div.container > button.primary"
}
```

## Example Scenario

**Tester's Action:**
1. Opens maitridesigns.com
2. Scrolls down 800px
3. Clicks on a button at viewport position (450, 450)

**What Gets Stored:**
- `x`: 450 (viewport X)
- `y`: 1250 (viewport Y + scroll = 450 + 800)
- `scrollX`: 0
- `scrollY`: 800
- `screenshot`: Base64 image of visible viewport (not full page)
- `dom_selector`: "button.cta-primary"

**What Author Sees:**
- Screenshot showing exactly what tester saw (viewport at 800px scroll)
- Pin at position (450, 450) on that screenshot - exactly where tester clicked
- DOM selector in thread details

## Benefits

✅ **Accurate Pin Placement**: Pins appear exactly where testers clicked
✅ **Context Preservation**: Screenshots show what tester actually saw
✅ **Element Tracking**: DOM selectors enable precise element identification
✅ **Responsive Design**: Works across different viewport sizes
✅ **Deep Scrolls**: Works on long pages with multiple screens of content

## Testing Checklist

- [ ] Add comment at top of page (scrollY = 0)
- [ ] Add comment after scrolling down 1000px
- [ ] Add comment on mobile viewport (narrow width)
- [ ] Add comment on element with ID
- [ ] Add comment on element with classes only
- [ ] Verify pins appear in correct location on dashboard
- [ ] Verify DOM selector is visible in thread details
- [ ] Test on multiple different websites

## Future Enhancements

- **Element Highlighting**: Use DOM selector to highlight the exact element in dashboard
- **Jump to Element**: Click pin to auto-navigate and highlight element on live site
- **Responsive Previews**: Show how comment location looks on different viewport sizes
- **Full Page Screenshots**: Capture entire page scroll height (requires different approach)
