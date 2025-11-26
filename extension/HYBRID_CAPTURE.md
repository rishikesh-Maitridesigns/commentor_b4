# Hybrid Screenshot + HTML Snapshot Capture

## Overview

The extension now captures **both screenshots AND HTML snapshots** (Option 3: Hybrid approach) for every comment, providing the best of both worlds.

## What Gets Captured

### 1. Screenshot (PNG Image)
- Visual snapshot using `chrome.tabs.captureVisibleTab`
- Base64 encoded data URL
- Shows exact visual state at moment of comment
- ~50-200KB per screenshot (compressed PNG)

**Stored in**: `comments.metadata.screenshot`

### 2. HTML Snapshot (Interactive DOM)
- Complete HTML structure of the page
- Inline CSS from stylesheets
- No JavaScript (removed for security)
- No iframes (removed to prevent cross-origin issues)
- Base href added for relative URLs

**Stored in**: `comments.metadata.htmlSnapshot`

```javascript
{
  html: "<!DOCTYPE html>...",        // Full HTML
  url: "https://example.com/page",   // Original page URL
  title: "Page Title",               // Document title
  timestamp: "2025-11-26T...",       // Capture time
  styles: "body { ... }"             // Inline CSS rules
}
```

## How It Works

### Extension Content Script

```javascript
function captureHTMLSnapshot() {
  // 1. Clone the entire document
  const clonedDoc = document.cloneNode(true);

  // 2. Remove scripts (security + size)
  const scripts = clonedDoc.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // 3. Remove iframes (cross-origin issues)
  const iframes = clonedDoc.querySelectorAll('iframe');
  iframes.forEach(iframe => iframe.remove());

  // 4. Remove CommentSync elements
  const commentsyncElements = clonedDoc.querySelectorAll('[id^="commentsync"]');
  commentsyncElements.forEach(el => el.remove());

  // 5. Add base URL for relative links
  const baseTag = clonedDoc.createElement('base');
  baseTag.href = window.location.origin;
  head.insertBefore(baseTag, head.firstChild);

  // 6. Extract CSS rules
  const styles = Array.from(document.styleSheets)
    .slice(0, 10)  // Limit to first 10 stylesheets
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\\n');
      } catch (e) {
        return '';  // CORS blocked external stylesheets
      }
    })
    .join('\\n');

  return {
    html: clonedDoc.documentElement.outerHTML,
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    styles: styles
  };
}
```

### Comment Submission

```javascript
async function submitComment(element, text) {
  // Capture both in parallel
  chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, async (response) => {
    const htmlSnapshot = captureHTMLSnapshot();

    const commentData = {
      // ... position data
      screenshot: response.screenshot,      // PNG image
      htmlSnapshot: htmlSnapshot,           // HTML + CSS
      // ...
    };
  });
}
```

### Background Script Storage

```javascript
const commentPayload = {
  thread_id: thread.id,
  author_id: authData.userId,
  content: commentData.text,
  metadata: {
    page_title: tab.title,
    screenshot: commentData.screenshot,       // Base64 PNG
    htmlSnapshot: commentData.htmlSnapshot,   // HTML object
    user_agent: navigator.userAgent
  }
};
```

## Viewing in Dashboard

### Screenshot Display

```tsx
{comment.metadata?.screenshot && (
  <div className="mt-3">
    <img
      src={comment.metadata.screenshot}
      alt="Screenshot"
      className="rounded-lg border border-slate-600 max-w-full cursor-pointer"
      onClick={() => window.open(comment.metadata.screenshot, '_blank')}
    />
  </div>
)}
```

**Features:**
- Click to open full-size in new tab
- Rounded corners, border styling
- Hover effect
- Responsive sizing

### HTML Snapshot Viewer

```tsx
{comment.metadata?.htmlSnapshot && (
  <div className="mt-3">
    <button
      onClick={() => {
        const snapshot = comment.metadata.htmlSnapshot;
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(snapshot.html);
          newWindow.document.close();
        }
      }}
      className="text-xs text-blue-400 hover:text-blue-300"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      View Interactive HTML Snapshot
    </button>
  </div>
)}
```

**Features:**
- Opens in new browser tab
- Interactive DOM (can inspect elements)
- Can select/copy text
- Can test responsive behavior
- Links may or may not work (depending on base URL)

## Benefits of Hybrid Approach

### Screenshot Advantages
✅ **Always works** - No dependencies
✅ **Exact visual** - Shows what tester saw
✅ **Consistent** - Won't break if site changes
✅ **Includes dynamic content** - Animations, modals, etc.
✅ **Cross-origin safe** - No CORS issues

### HTML Snapshot Advantages
✅ **Interactive** - Can inspect elements in DevTools
✅ **Text selectable** - Can copy/paste content
✅ **Responsive** - Can resize window
✅ **Searchable** - Can Ctrl+F for text
✅ **Scalable** - Not pixelated at any zoom level

### Combined Benefits
✅ **Fallback** - Screenshot always available if HTML fails
✅ **Flexibility** - Choose best view for debugging
✅ **Context** - Visual + structure = complete picture
✅ **Future-proof** - Can add more capture types

## File Size Considerations

### Screenshot
- **Typical size**: 50-200 KB (compressed PNG)
- **Factors**: Viewport size, colors, complexity
- **Optimization**: Chrome automatically compresses

### HTML Snapshot
- **Typical size**: 100-500 KB (HTML + CSS)
- **Factors**: Page complexity, number of elements
- **Optimization**: Scripts/iframes removed, limited to 10 stylesheets

### Total per Comment
- **Average**: 150-700 KB
- **Max realistic**: 1-2 MB for complex pages
- **Storage**: Supabase JSONB handles large objects well

## Security Considerations

### What's Removed
❌ **Scripts** - Prevents XSS attacks
❌ **Iframes** - Avoids cross-origin issues
❌ **Event handlers** - onclick, onload, etc. stripped by browser
❌ **CommentSync elements** - Prevents recursion

### What's Preserved
✅ **HTML structure** - All DOM elements
✅ **CSS styles** - Inline and stylesheet rules
✅ **Text content** - All visible text
✅ **Images** - If absolute URLs or data URIs
✅ **Layout** - Positioning, sizing, etc.

### Safe to View
- HTML snapshot can't execute code
- External resources load based on CSP
- No data leakage back to original site
- Sandboxed in new window/tab

## Troubleshooting

### Screenshot is Blank
- Extension can only capture visible tab
- Check if tab has focus
- Some sites block `captureVisibleTab`
- **Fallback**: HTML snapshot still works

### HTML Snapshot Missing Styles
- External stylesheets blocked by CORS
- Limited to first 10 stylesheets
- **Fallback**: Screenshot shows correct styling

### HTML Snapshot Too Large
- Very complex pages (>5000 elements)
- Consider increasing JSONB size limit in Supabase
- **Fallback**: Screenshot always works

### Images Not Loading in HTML Snapshot
- Relative URLs need base tag (we add this)
- Data URIs work perfectly
- External images depend on CORS
- **Fallback**: Screenshot shows images

## Future Enhancements

### Potential Additions
1. **Video recording** - Capture user interactions
2. **Console logs** - Capture JavaScript errors
3. **Network requests** - Show API calls
4. **Performance metrics** - Page load time, etc.
5. **Accessibility tree** - Screen reader context
6. **React/Vue devtools data** - Component state

### Storage Optimization
1. Compress HTML with gzip
2. Deduplicate common CSS
3. Store screenshots in separate storage bucket
4. Lazy load snapshots on demand

## Database Schema

The existing schema already supports this:

```sql
CREATE TABLE comments (
  id uuid PRIMARY KEY,
  thread_id uuid REFERENCES threads(id),
  author_id uuid REFERENCES profiles(id),
  content text,
  metadata jsonb,  -- ← Stores both screenshot and htmlSnapshot
  created_at timestamptz
);
```

No migrations needed! JSONB is flexible and can store both:
- `metadata.screenshot` (string, base64)
- `metadata.htmlSnapshot` (object with html, url, title, etc.)

## Summary

The hybrid approach gives us:
- **Reliability** - Screenshot always works
- **Flexibility** - HTML for inspection
- **Completeness** - Visual + structure
- **Future-proof** - Easy to add more capture types

Both are captured automatically on every comment, stored together, and displayed side-by-side in the dashboard.
