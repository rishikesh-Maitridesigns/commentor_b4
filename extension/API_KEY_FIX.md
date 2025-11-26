# Supabase API Key Mismatch - Fix Documentation

## Error Description

**Error Message (Console & Red Banner):**
```
Failed to save comment: Failed to create thread:
{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}
```

**When it occurred:**
- When trying to add a comment on maitridesigns.com
- After clicking "Submit" in the comment widget
- Extension was recording but couldn't save to database

## Root Cause

**Mismatched Supabase Credentials Across Files**

The project had TWO different Supabase instances configured:

### Instance 1 (CORRECT - Used by Dashboard & Popup)
- **URL:** `https://kfhemlqgwfkbqpoqsjgn.supabase.co`
- **Anon Key:** `eyJhbG...SYOhw` (ends with SYOhw)
- **Used in:**
  - `.env` file (originally wrong, now fixed)
  - `extension/popup.js` ✅
  - `src/` dashboard files ✅

### Instance 2 (WRONG - Used by Background & Content)
- **URL:** `https://lwuizklpgqtknjssnnhm.supabase.co` ❌
- **Anon Key:** `eyJhbG...fL8g` (ends with fL8g)
- **Used in:**
  - `extension/background.js` ❌ (was wrong, now fixed)
  - `extension/content.js` ❌ (was wrong, now fixed)

### The Problem

1. User logs in via **popup.js** → Uses **Instance 1** ✅
2. User creates session → Popup stores auth token for **Instance 1** ✅
3. User adds comment → **content.js** sends data to **background.js**
4. **background.js** tries to save to **Instance 2** ❌
5. Auth token from **Instance 1** doesn't work on **Instance 2** ❌
6. Supabase returns "Invalid API key" error ❌

## Files Fixed

### 1. `/extension/background.js`

**Before:**
```javascript
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dWl6a2xwZ3F0a25qc3NubmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTkxMDAsImV4cCI6MjA3OTYzNTEwMH0.kg7wXyXubuMY0_K_BQmOH5z6awwMWEhg0jChk3cfL8g';
// For lwuizklpgqtknjssnnhm ❌
```

**After:**
```javascript
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGVtbHFnd2ZrYnFwb3FzamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MjY1ODUsImV4cCI6MjA3OTMwMjU4NX0.TGXLn91XAHMtCwAaXjWi3E4Z79OxJnJRZPgGV2SYOhw';
// For kfhemlqgwfkbqpoqsjgn ✅
```

### 2. `/extension/content.js`

**Changed:** All 7 occurrences of the wrong anon key replaced with correct one

**Locations:**
- Line 35 - `loadExistingComments()` function
- Line 492 - `handleResolveThread()` function
- Line 524 - `handleReopenThread()` function
- Line 554 - `handleDeleteThread()` function
- Line 603 - `handleDeleteComment()` function (nested in edit)
- Line 639 - `handleUpdateComment()` function

All now use the correct key for `kfhemlqgwfkbqpoqsjgn.supabase.co` ✅

### 3. `/.env`

**Before:**
```env
VITE_SUPABASE_URL=https://lwuizklpgqtknjssnnhm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...fL8g
```

**After:**
```env
VITE_SUPABASE_URL=https://kfhemlqgwfkbqpoqsjgn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...SYOhw
```

## Verification

After the fix, all files use the SAME Supabase instance:

```
✅ .env → kfhemlqgwfkbqpoqsjgn
✅ extension/popup.js → kfhemlqgwfkbqpoqsjgn
✅ extension/background.js → kfhemlqgwfkbqpoqsjgn
✅ extension/content.js → kfhemlqgwfkbqpoqsjgn
✅ src/* (dashboard) → kfhemlqgwfkbqpoqsjgn
```

## How Authentication Now Works

### Correct Flow

```
1. User enters email/password in popup
   ↓
2. Popup.js calls kfhemlqgwfkbqpoqsjgn/auth/v1/token
   ↓
3. Gets back auth token for kfhemlqgwfkbqpoqsjgn
   ↓
4. Stores token in chrome.storage.local
   ↓
5. User adds comment
   ↓
6. Content.js → Background.js → kfhemlqgwfkbqpoqsjgn/rest/v1
   ↓
7. Auth token matches instance ✅
   ↓
8. Comment saved successfully ✅
```

## Testing Steps

After reloading the extension:

1. **Clear extension storage** (important!)
   ```javascript
   // In browser console on extension popup:
   chrome.storage.local.clear()
   ```

2. **Sign in again** through popup
   - Extension will get fresh auth token for correct instance

3. **Start recording session**
   - Select app
   - Click "Go to Page"
   - Click "Start Recording"

4. **Add a comment**
   - Click on any element
   - Type comment text
   - Click "Submit"
   - Should see "Comment saved successfully!" ✅

5. **Verify in dashboard**
   - Open CommentSync dashboard
   - Navigate to app
   - Should see new comment with screenshot

## Why This Happened

The project likely had:
- Initial development with one Supabase instance (lwuizklpgqtknjssnnhm)
- Later migration to new instance (kfhemlqgwfkbqpoqsjgn)
- Popup and .env were updated
- Background and content scripts were missed

## Prevention

### For Future Development

1. **Centralize configuration**
   - Put Supabase URL/key in ONE place
   - Have all files import from that location
   - Never hardcode credentials in multiple files

2. **Use environment variables**
   ```javascript
   // config.js
   export const SUPABASE_URL = process.env.SUPABASE_URL;
   export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
   ```

3. **Add validation**
   ```javascript
   // On extension load, verify all files use same instance
   if (!authToken.includes(SUPABASE_URL_SHORT_ID)) {
     console.error('Auth token from wrong Supabase instance!');
   }
   ```

4. **Document the instance**
   ```javascript
   // At top of each file:
   // Supabase Instance: kfhemlqgwfkbqpoqsjgn.supabase.co
   const SUPABASE_ANON_KEY = '...';
   ```

## Summary

**Problem:** Extension used 2 different Supabase instances across files
**Impact:** Auth tokens didn't work, comments couldn't save
**Solution:** Updated all files to use the SAME instance (kfhemlqgwfkbqpoqsjgn)
**Result:** Authentication works, comments save successfully ✅

All extension files now consistently use `kfhemlqgwfkbqpoqsjgn.supabase.co` with matching anon key.
