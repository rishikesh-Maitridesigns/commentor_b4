# Chrome Extension Changelog

## Version 2.0 - Feature Parity Release

### 🔒 Security Improvements

**Workspace-Based Access Control**
- Extension now only shows apps from workspaces where user is a member
- Prevents users from seeing/accessing apps they don't have permission for
- Matches web app security model exactly

**Author-Only Edit/Delete**
- Users can only edit/delete their own comments
- Permission check on author_id before showing action buttons
- Prevents unauthorized modifications

### 🚀 New Features

**1. Auto-Navigation**
- Selecting an app automatically navigates to its `base_url`
- No more manual URL entry required
- Ensures users are testing the correct site

**2. View Existing Comments**
- Displays all existing comment threads as pins on the page
- Blue pins for open threads, green for resolved
- Number badge shows comment count
- Pins positioned at exact location (with scroll position correction)

**3. Thread Viewer**
- Click any pin to open full thread details
- Shows screenshot, all comments, and thread status
- Inline reply input
- Edit/delete buttons for own comments
- Resolve/reopen buttons

**4. Reply to Comments**
- Add replies to existing threads
- Inline text input in thread viewer
- Updates sync to database immediately
- Notifications confirm success

**5. Edit Comments**
- Pencil icon (✏️) on own comments
- Inline editing with save/cancel
- Updates `edited_at` timestamp
- Only authors can edit

**6. Delete Comments**
- Trash icon (🗑️) on own comments
- Confirmation dialog before deletion
- If last comment, deletes entire thread
- Only authors can delete

**7. Resolve/Reopen Threads**
- Green "Resolve" button for open threads
- Orange "Reopen" button for resolved threads
- Updates status, timestamps, and resolved_by
- Pin color changes immediately

### 🐛 Bug Fixes

**Scroll Position Tracking**
- Now captures both absolute position AND scroll offset
- Stores `scrollX` and `scrollY` in `position_data`
- Pins display at correct position regardless of scroll
- Matches screenshot viewport exactly

**DOM Selector Storage**
- Properly stores CSS selector in `threads.dom_selector`
- Captures optimal selector with IDs, classes, nth-of-type
- Enables future "jump to element" features

### 📝 Technical Changes

**Content Script (`content.js`)**
- Complete rewrite with 526 lines of new functionality
- Added `loadExistingComments()` - fetches threads for current page
- Added `displayCommentPins()` - renders pins at correct positions
- Added `showThreadViewer()` - full thread management UI
- Added `handleReply()` - create new comments on threads
- Added `handleEditComment()` - inline comment editing
- Added `handleDeleteComment()` - comment deletion with confirmation
- Added `handleResolveThread()` - mark threads as resolved
- Added `handleReopenThread()` - reopen resolved threads
- Added `renderComment()` - comment HTML with permissions

**Popup Script (`popup.js`)**
- Added workspace membership query
- Added app filtering by workspace permissions
- Added auto-navigation on app selection
- Improved error handling

**Background Script (`background.js`)**
- Already properly implemented from previous updates
- Stores scroll position and DOM selector correctly
- Creates threads and comments with full data

### 🎨 UI Improvements

**Comment Pins**
- Circular badges with comment count
- Color-coded by status (blue/green)
- Hover scale animation
- Positioned with pixel-perfect accuracy
- White border and shadow for visibility

**Thread Viewer**
- Fixed position, slides in from right
- Max 80vh height with scrollable comments
- Screenshot preview at top
- Status badge (open/resolved)
- Reply input and action buttons at bottom
- Clean, modern design matching web app

**Notifications**
- Toast notifications for all actions
- Green for success, red for errors
- Auto-dismiss after 3 seconds
- Fixed position, top-right corner

### 📚 Documentation

**New Documents**
- `FEATURE_PARITY.md` - Complete feature comparison with web app
- `CHANGELOG.md` - This document
- `SCROLL_FIX.md` - Technical details on scroll position fix
- `DATA_FLOW.md` - Complete data flow from extension to database

**Updated Documents**
- `INSTALL.md` - Simplified installation instructions
- `README.md` - Overview and feature list

### 🔄 Breaking Changes

**None!** - Fully backward compatible
- Existing comments load automatically
- Old data structure still works
- No migration required

### ⚡ Performance

**Optimizations**
- Pins load once per session start
- Efficient DOM selector generation
- Minimal re-renders
- Async/await for all API calls
- Error boundaries prevent crashes

### 🧪 Testing Checklist

When testing the new version:

- [ ] Login with valid credentials
- [ ] Only see apps from your workspaces
- [ ] App auto-navigates when selected
- [ ] Click "Start Recording" to activate
- [ ] See existing comment pins on page
- [ ] Blue pins for open, green for resolved
- [ ] Pin count matches actual comments
- [ ] Click pin opens thread viewer
- [ ] Can reply to threads
- [ ] Can edit own comments only
- [ ] Can delete own comments only
- [ ] Can resolve open threads
- [ ] Can reopen resolved threads
- [ ] Create new comment still works
- [ ] Scroll position is accurate
- [ ] DOM selector captured

### 📦 Installation

1. Navigate to `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select the `/extension` folder
5. Sign in with your credentials
6. Start reviewing!

### 🚧 Future Enhancements

Potential features for next version:
- User profile pictures in comments
- @mentions with autocomplete
- Attachment uploads
- Comment reactions/emojis
- Keyboard shortcuts (C to comment, ESC to close)
- Offline mode with sync
- Export comments as PDF
- Dark mode
- Multi-language support

### 🤝 Contributing

The extension codebase is now fully documented and maintainable:
- Clear separation of concerns
- Reusable functions
- Consistent naming conventions
- Error handling throughout
- Comments explaining complex logic

### 📞 Support

For issues or questions:
1. Check `/extension/README.md`
2. Check `/extension/FEATURE_PARITY.md`
3. Check `/extension/DATA_FLOW.md`
4. Contact your CommentSync administrator

---

**Release Date**: 2025-11-25
**Version**: 2.0.0
**Compatibility**: Chrome 88+, Edge 88+
**License**: Proprietary
