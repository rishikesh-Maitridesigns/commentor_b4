# Chrome Extension Data Flow

## Comment Creation Flow

```
1. TESTER CLICKS ELEMENT
   ↓
   content.js: getOptimalSelector(element)
   → Generates CSS selector like "div.header > button#login"

2. CAPTURE POSITION
   ↓
   content.js: submitComment()
   → x = rect.left + window.scrollX (absolute page position)
   → y = rect.top + window.scrollY
   → scrollX = window.scrollX (current scroll offset)
   → scrollY = window.scrollY
   → viewportWidth/Height = window.inner dimensions

3. CAPTURE SCREENSHOT
   ↓
   background.js: chrome.tabs.captureVisibleTab()
   → Returns base64 image of VISIBLE VIEWPORT only
   → NOT the full page, just what's currently on screen

4. CREATE THREAD
   ↓
   background.js → Supabase: POST /threads
   {
     app_id: "uuid",
     page_url: "https://example.com/page",
     dom_selector: { selector: "div.header > button#login" },
     position_data: {
       x: 450,              // Absolute position on page
       y: 1250,
       scrollX: 0,          // How far user scrolled
       scrollY: 800,
       viewportWidth: 1920,
       viewportHeight: 1080
     },
     status: "open"
   }

5. CREATE COMMENT
   ↓
   background.js → Supabase: POST /comments
   {
     thread_id: "thread-uuid",
     author_id: "user-uuid",
     content: "Button text is too small",
     metadata: {
       page_title: "Home Page",
       screenshot: "data:image/png;base64,iVBOR...",
       user_agent: "Mozilla/5.0..."
     }
   }
```

## Dashboard Display Flow

```
1. FETCH THREADS
   ↓
   AppDetails.tsx: fetchThreads()
   → SELECT threads with comments and position_data

2. EXTRACT SCREENSHOT
   ↓
   → First comment.metadata.screenshot
   → This is what tester saw at scroll position

3. CALCULATE PIN POSITION
   ↓
   updateCommentPins()
   → pinX = position_data.x - position_data.scrollX
   → pinY = position_data.y - position_data.scrollY
   → This gives position RELATIVE TO SCREENSHOT

4. RENDER
   ↓
   → <img src={screenshot} />
   → <pin style={{ left: pinX, top: pinY }} />
   → Pin appears exactly where tester clicked on screenshot
```

## Data Storage Summary

| Field | Location | Type | Purpose | Example |
|-------|----------|------|---------|---------|
| **dom_selector** | threads | JSONB | CSS path to element | `{"selector":"button.cta"}` |
| **position_data** | threads | JSONB | Position & viewport info | See below |
| **screenshot** | comments.metadata | Base64 | What tester saw | PNG image string |
| **page_title** | comments.metadata | String | Page name | "Home - Maitri Designs" |
| **page_url** | threads | String | Full URL | "https://example.com/page" |

### position_data Structure

```json
{
  "x": 450,                    // Absolute X coordinate on full page
  "y": 1250,                   // Absolute Y coordinate on full page
  "scrollX": 0,                // Horizontal scroll offset
  "scrollY": 800,              // Vertical scroll offset (user scrolled down 800px)
  "viewportWidth": 1920,       // Browser window width
  "viewportHeight": 1080       // Browser window height
}
```

## Key Insights

### Why Store Both Absolute and Scroll?

**Absolute Position (x, y)**:
- Where the element is on the full page
- Includes scroll offset
- Consistent regardless of viewport

**Scroll Offset (scrollX, scrollY)**:
- Where the user had scrolled to
- Needed to calculate viewport-relative position
- Essential for matching screenshot

### Formula

```
Viewport Position = Absolute Position - Scroll Offset

pinX = x - scrollX
pinY = y - scrollY
```

### Example

Tester scrolls down 800px and clicks a button:

```
Element rect.top = 450 (relative to viewport)
window.scrollY = 800 (scrolled down)

Stored:
  x = 450 (viewport relative, will add scroll in real implementation)
  y = 450 + 800 = 1250 (absolute)
  scrollY = 800

Display:
  pinY = 1250 - 800 = 450 ✓ Matches where tester clicked
```

## Code References

- **Element Selection**: `/extension/content.js` → `getOptimalSelector()`
- **Position Capture**: `/extension/content.js` → `submitComment()`
- **Screenshot**: `/extension/background.js` → `CAPTURE_SCREENSHOT`
- **Thread Creation**: `/extension/background.js` → `handleSaveComment()`
- **Pin Display**: `/src/pages/AppDetails.tsx` → `updateCommentPins()`

## Debugging Tips

1. **Pins in wrong location?**
   - Check if scrollX/scrollY are being captured
   - Verify subtraction in updateCommentPins()
   - Console.log position_data to see raw values

2. **DOM selector not showing?**
   - Check threads.dom_selector field in database
   - Verify getOptimalSelector() is returning string
   - Ensure it's wrapped in {selector: "..."} object

3. **Screenshot doesn't match?**
   - captureVisibleTab only captures viewport
   - Full page screenshots need different approach
   - Screenshots are stored in comments.metadata

4. **Multiple pages?**
   - Each page URL gets its own screenshot
   - Filter threads by page_url to show correct pins
   - Use page pills to switch between pages
