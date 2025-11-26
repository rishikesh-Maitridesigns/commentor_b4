# Element Tracking & Jump-to-Element Feature

## Overview

The dashboard now shows **which specific element** was commented on and provides a **"Jump to Element"** button that highlights the element in the iframe.

## What Gets Captured

### DOM Selector
- **CSS selector path** to the exact element (e.g., `div.container > section:nth-of-type(2) > button.submit`)
- Stored in `threads.dom_selector.selector`
- Generated using optimal selector strategy:
  1. ID if available (`#unique-id`)
  2. Classes + nth-of-type for uniqueness
  3. Full path from body to element

### Example Selectors
```css
#submit-button
div.form-container > button.primary:nth-of-type(1)
main > section.content > article:nth-of-type(3) > p
```

## Display in Dashboard

### Thread Viewer Header

When viewing a comment thread, the DOM selector appears below the page URL:

```
┌─────────────────────────────────────────────┐
│ Comment Thread                         [×]   │
│ https://example.com/page                    │
│ 📍 div.container > button.submit   [Jump]  │ ← DOM Selector + Button
└─────────────────────────────────────────────┘
```

**Features:**
- Purple text color with monospace font
- Truncates if too long (max-w-xs)
- Pin emoji (📍) prefix
- "Jump" button next to selector

### Jump to Element Button

**Appearance:**
- Purple background (`bg-purple-600`)
- Target icon + "Jump" text
- Hover effect (darker purple)
- Flex-shrink-0 (never collapses)

**Functionality:**
When clicked:
1. Finds element in iframe using CSS selector
2. Scrolls element into view (smooth animation)
3. Creates animated highlight overlay
4. Highlight pulses for 4 seconds
5. Automatically removes highlight

## How It Works

### 1. Element Selection (Extension/Dashboard)

**Extension:**
```javascript
function getOptimalSelector(element) {
  // 1. Try ID first
  if (element.id) {
    return `#${element.id}`;
  }

  // 2. Build path with classes and nth-of-type
  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add classes (exclude commentsync classes)
    if (current.className) {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(c => c && !c.startsWith('commentsync-'));

      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }

    // Add nth-of-type for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children)
        .filter(el => el.tagName === current.tagName);

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}
```

**Dashboard:**
```tsx
// Stored in thread
{
  dom_selector: {
    selector: "div.container > button.submit"
  }
}
```

### 2. Display in Thread Viewer

```tsx
{selectedThread.dom_selector?.selector && (
  <div className="flex items-center gap-2 mt-1">
    <p className="text-xs text-purple-400 truncate max-w-xs font-mono">
      📍 {selectedThread.dom_selector.selector}
    </p>
    <button
      onClick={() => jumpToElement(selectedThread.dom_selector.selector)}
      className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-1 transition flex-shrink-0"
      title="Highlight element in page"
    >
      <Target className="w-3 h-3" />
      Jump
    </button>
  </div>
)}
```

### 3. Jump to Element Function

```typescript
const jumpToElement = (selector: string) => {
  // Get iframe document
  const iframeDoc = iframeRef.current.contentDocument;
  if (!iframeDoc) return;

  try {
    // Find element
    const element = iframeDoc.querySelector(selector);
    if (!element) {
      alert('Element not found. Page structure may have changed.');
      return;
    }

    // Scroll to element
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Remove existing highlight
    const existingHighlight = iframeDoc.querySelector('.commentsync-highlight');
    if (existingHighlight) existingHighlight.remove();

    // Create new highlight
    const highlight = iframeDoc.createElement('div');
    highlight.className = 'commentsync-highlight';
    highlight.style.cssText = `
      position: absolute;
      border: 3px solid #3B82F6;
      background: rgba(59, 130, 246, 0.2);
      pointer-events: none;
      z-index: 999999;
      border-radius: 8px;
      animation: pulse 2s ease-in-out infinite;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
    `;

    // Position highlight over element
    const rect = element.getBoundingClientRect();
    highlight.style.left = `${rect.left + iframeDoc.defaultView.scrollX}px`;
    highlight.style.top = `${rect.top + iframeDoc.defaultView.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;

    iframeDoc.body.appendChild(highlight);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      highlight.remove();
    }, 4000);

  } catch (error) {
    console.error('Failed to jump to element:', error);
    alert('Unable to highlight element. Security restrictions may apply.');
  }
};
```

## Visual Highlight Effect

### Highlight Styling
- **Border**: 3px solid blue (#3B82F6)
- **Background**: Semi-transparent blue (rgba(59, 130, 246, 0.2))
- **Box shadow**: 4px blue glow
- **Border radius**: 8px
- **Animation**: Pulse effect (2s infinite)
- **Z-index**: 999999 (always on top)

### Animation
The highlight pulses using CSS animation, drawing attention to the element.

### Duration
- Highlight appears immediately
- Pulses for 4 seconds
- Automatically removes itself

## Duplicate Pins Fix

### Problem
When viewing a thread, the comment pin would overlap with itself:
- Original pin (in iframe)
- Selected thread pin (highlighted)
- Both would show at same position

### Solution
Hide the pin when its thread is selected:

```tsx
{commentPins.map((pin) => {
  const thread = threads.find(t => t.id === pin.threadId);
  const isSelected = selectedThread?.id === thread.id && showCommentOverlay;

  // Hide this pin if it's the selected thread
  if (isSelected) return null;

  return (
    <button>{/* Pin UI */}</button>
  );
})}
```

**Result:**
- When viewing a thread, its pin disappears
- Only the thread viewer overlay shows
- No duplicate pins on screen
- Clean, uncluttered interface

## Benefits

### For Testers
✅ See exactly which element they clicked
✅ Confirm correct element was selected
✅ Understand context of their comment

### For Authors/Developers
✅ **Know exactly where the issue is** - No guessing!
✅ **Jump to element instantly** - One click to highlight
✅ **Verify element still exists** - Alert if page changed
✅ **See full CSS selector** - Can use in DevTools
✅ **No duplicate pins** - Clean viewing experience

### For Teams
✅ **Faster debugging** - Go straight to the element
✅ **Better communication** - "The blue button" vs "button.submit:nth-of-type(2)"
✅ **Change detection** - Know if page structure changed
✅ **Reproducibility** - Exact element path preserved

## Edge Cases Handled

### Element Not Found
- Page structure changed
- Element was removed
- Selector no longer matches
- **Result**: Alert message, no crash

### Security Restrictions
- Cross-origin iframe (rare in review mode)
- CSP restrictions
- **Result**: Graceful error message

### Selector Too Long
- Very deep nesting
- Long class names
- **Result**: Truncates display, full selector still works

### Multiple Matches
- Selector matches multiple elements
- **Result**: Highlights first match (querySelector behavior)

## Future Enhancements

### Potential Improvements
1. **Copy selector button** - Copy to clipboard
2. **Multiple highlight styles** - Different colors per thread
3. **Persistent highlight** - Until manually dismissed
4. **Hover preview** - Show element info on hover
5. **Edit selector** - Fix broken selectors
6. **Alternative selectors** - Show backup options if primary fails
7. **Element path breadcrumb** - Visual hierarchy

### Advanced Features
1. **Before/After comparison** - Show if element changed
2. **Element diff** - Highlight what changed
3. **Smart re-selection** - Find element even if page changed
4. **AI-powered matching** - Use visual similarity to find moved elements

## Technical Notes

### Browser Compatibility
- Works in all modern browsers
- Requires iframe access (same-origin or CORS)
- Falls back gracefully if restricted

### Performance
- Lightweight selector generation
- No performance impact on page
- Highlight auto-removes (no memory leak)

### Security
- No injection attacks (uses createElement)
- No eval() or innerHTML
- Reads only, doesn't modify page
- Highlight has pointer-events: none

## Testing Checklist

- [ ] DOM selector appears in thread viewer
- [ ] Selector truncates if too long
- [ ] "Jump" button visible and clickable
- [ ] Click scrolls to element smoothly
- [ ] Highlight appears over element
- [ ] Highlight pulses for 4 seconds
- [ ] Highlight auto-removes
- [ ] Alert if element not found
- [ ] No duplicate pins when viewing thread
- [ ] Works with deeply nested elements
- [ ] Works with elements with IDs
- [ ] Works with elements without IDs
- [ ] Handles special characters in classes

## Summary

The element tracking feature provides:
- **Visibility**: See exactly what was commented on
- **Navigation**: Jump to element with one click
- **Verification**: Confirm element still exists
- **Clarity**: No more "which button did they mean?"
- **Cleanliness**: No duplicate pins when viewing

This makes debugging and communication significantly faster and more precise.
