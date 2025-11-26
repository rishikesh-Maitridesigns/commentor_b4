# Quick Start - Changing Supabase Instance

## TL;DR

**To switch to a different Supabase project:**

```bash
# 1. Edit supabase.config.js with new URL and key
nano supabase.config.js

# 2. Sync and validate
npm run sync-config && npm run validate-config

# 3. Rebuild
npm run build

# 4. Reload extension in chrome://extensions

# 5. Clear old auth tokens
# Open extension popup → DevTools → Run: chrome.storage.local.clear()

# 6. Sign in again
```

## The Single Config File

**Location:** `supabase.config.js`

```javascript
export const SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',    // ← Change this
  anonKey: 'eyJ...'                           // ← And this
};
```

That's it! All other files import from this one file.

## What Gets Updated Automatically

✅ Extension popup (login)
✅ Extension background (saving comments)
✅ Extension content (loading comments)
✅ Dashboard (viewing/managing comments)
✅ All API calls
✅ All authentication

## Validation

Always validate after changing config:

```bash
npm run validate-config
```

Should show all ✅ green checkmarks.

## Files You Changed

- ✅ `supabase.config.js` - ONLY file you need to edit!

## Files That Auto-Update

- ✅ `extension/supabase.config.js` - Synced by `npm run sync-config`
- ✅ `extension/popup.js` - Imports from config
- ✅ `extension/background.js` - Imports from config
- ✅ `extension/content.js` - Imports from config
- ✅ `src/lib/supabase.ts` - Imports from config

## Common Issues

### Extension shows "Invalid API key"

```bash
# In extension popup DevTools:
chrome.storage.local.clear()
# Then sign in again
```

### Changes not taking effect

```bash
# Sync, validate, rebuild
npm run sync-config && npm run validate-config && npm run build

# Then reload extension
```

## Example: Switching from Dev to Production

**Step 1: Edit config**
```javascript
// supabase.config.js
export const SUPABASE_CONFIG = {
  url: 'https://prod-project.supabase.co',  // Changed!
  anonKey: 'eyJ...production-key...'        // Changed!
};
```

**Step 2: Sync and build**
```bash
npm run sync-config && npm run validate-config && npm run build
```

**Step 3: Reload extension**
- chrome://extensions → Click reload

**Step 4: Clear and re-login**
- Clear storage: `chrome.storage.local.clear()`
- Sign in with production credentials

**Done!** 🎉

All components now use production Supabase instance.

## Where NOT to Change Credentials

❌ Don't edit `extension/popup.js`
❌ Don't edit `extension/background.js`
❌ Don't edit `extension/content.js`
❌ Don't edit `.env` (used as fallback only)

**Only edit:** `supabase.config.js` ✅

## Need Help?

See full documentation: `CENTRALIZED_CONFIG.md`
