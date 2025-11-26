# Centralized Supabase Configuration

## Overview

All Supabase credentials are now managed from a **single source of truth**: `supabase.config.js`

This ensures that when you switch Supabase instances, you only need to update **ONE file** and all components (dashboard + extension) will automatically use the new credentials.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│            supabase.config.js (ROOT)                 │
│  url: https://kfhemlqgwfkbqpoqsjgn.supabase.co     │
│  anonKey: eyJ...                                     │
└──────────────────────────────────────────────────────┘
                    │
                    │ (copied to)
                    │
                    ↓
        ┌───────────────────────────┐
        │  extension/supabase.config.js  │
        └───────────────────────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
       ↓            ↓            ↓
  popup.js   background.js  content.js
       │            │            │
       │            │            │
       ↓            ↓            ↓
   Extension components use SUPABASE_CONFIG


┌──────────────────────────────────────┐
│  src/lib/supabase.ts (Dashboard)     │
│  imports from ../../supabase.config  │
└──────────────────────────────────────┘
                    │
                    ↓
        Dashboard uses SUPABASE_CONFIG
```

## File Structure

### Primary Config
- **`supabase.config.js`** - Single source of truth
  - Contains URL and anon key
  - Located at project root
  - Imported by dashboard

### Extension Copy
- **`extension/supabase.config.js`** - Copy for extension
  - Identical to root config
  - Synced using `npm run sync-config`
  - Imported by all extension files

### Legacy Files (Deprecated)
- **`.env`** - Now used as fallback only
  - Dashboard will use config.js first
  - .env values ignored if config exists

## Configuration File

### `supabase.config.js`

```javascript
export const SUPABASE_CONFIG = {
  url: 'https://kfhemlqgwfkbqpoqsjgn.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

export const getSupabaseUrl = () => SUPABASE_CONFIG.url;
export const getSupabaseAnonKey = () => SUPABASE_CONFIG.anonKey;
export const getApiUrl = () => `${SUPABASE_CONFIG.url}/rest/v1`;
export const getAuthUrl = () => `${SUPABASE_CONFIG.url}/auth/v1`;

export default SUPABASE_CONFIG;
```

## How Components Use It

### Extension Files

**popup.js:**
```javascript
import { SUPABASE_CONFIG } from './supabase.config.js';

const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
```

**background.js:**
```javascript
import { SUPABASE_CONFIG } from './supabase.config.js';

const apiUrl = `${SUPABASE_CONFIG.url}/rest/v1`;
const anonKey = SUPABASE_CONFIG.anonKey;
```

**content.js:**
```javascript
import { SUPABASE_CONFIG } from './supabase.config.js';

const anonKey = SUPABASE_CONFIG.anonKey;
```

### Dashboard

**src/lib/supabase.ts:**
```typescript
import { SUPABASE_CONFIG } from '../../supabase.config.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_CONFIG.url;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_CONFIG.anonKey;
```

## How to Change Supabase Instance

### Step-by-Step Process

1. **Edit the root config:**
   ```bash
   # Open supabase.config.js
   nano supabase.config.js
   ```

2. **Update URL and key:**
   ```javascript
   export const SUPABASE_CONFIG = {
     url: 'https://YOUR_NEW_PROJECT.supabase.co',
     anonKey: 'YOUR_NEW_ANON_KEY'
   };
   ```

3. **Sync to extension:**
   ```bash
   npm run sync-config
   ```

4. **Validate consistency:**
   ```bash
   npm run validate-config
   ```

5. **Rebuild dashboard:**
   ```bash
   npm run build
   ```

6. **Reload extension:**
   - Open `chrome://extensions`
   - Click reload button on CommentSync extension

7. **Clear old auth tokens:**
   - Open extension popup
   - Open DevTools console
   - Run: `chrome.storage.local.clear()`
   - Sign in again with new credentials

### Quick Change Script

```bash
# One command to change everything
npm run sync-config && npm run validate-config && npm run build
```

## Validation

### Automatic Validation

Run validation anytime to ensure consistency:

```bash
npm run validate-config
```

**What it checks:**
- ✅ Root config exists
- ✅ Extension config matches root
- ✅ .env matches (if present)
- ✅ No hardcoded credentials in extension files
- ✅ All imports point to config file

**Example output:**
```
🔍 Validating Supabase configuration consistency...

✅ Central Config URL: https://kfhemlqgwfkbqpoqsjgn.supabase.co
✅ Central Config Key: eyJhbGciOiJIUzI1NiIs...

✅ .env URL matches central config
✅ .env Key matches central config
✅ extension/supabase.config.js URL matches
✅ extension/supabase.config.js Key matches

✅ No hardcoded credentials found in extension files

✨ All Supabase configurations are consistent!
```

### Manual Validation

Check for hardcoded credentials:

```bash
# Search for hardcoded URLs
grep -r "https://.*\.supabase\.co" extension/*.js

# Search for hardcoded keys (should only be in config files)
grep -r "eyJhbGci" extension/*.js
```

## NPM Scripts

### `npm run validate-config`
- Validates all configs match
- Checks for hardcoded credentials
- Exits with error if inconsistent

### `npm run sync-config`
- Copies root config to extension folder
- Ensures extension uses latest config
- Run after editing root config

### Combined workflow:
```bash
# Edit config, sync, validate, build
npm run sync-config && npm run validate-config && npm run build
```

## Benefits

### Before (Multiple Sources)

❌ Credentials in 8+ locations:
- popup.js (hardcoded)
- background.js (hardcoded)
- content.js (hardcoded × 7)
- .env (for dashboard)

❌ Changing instances required:
- Edit 9+ files manually
- Easy to miss one
- Mismatched credentials = auth errors
- No validation

### After (Single Source)

✅ Credentials in 1 location:
- supabase.config.js (root)

✅ Changing instances requires:
- Edit 1 file (supabase.config.js)
- Run `npm run sync-config`
- Run `npm run validate-config`
- Reload extension

✅ Automatic validation ensures:
- All components use same instance
- No hardcoded credentials
- Consistency guaranteed

## Troubleshooting

### Extension shows "Invalid API key" error

**Solution:**
1. Validate config: `npm run validate-config`
2. Clear extension storage: `chrome.storage.local.clear()`
3. Sign in again
4. Try adding comment

### Dashboard can't connect to Supabase

**Solution:**
1. Check `supabase.config.js` has correct URL/key
2. Rebuild: `npm run build`
3. Hard refresh browser (Ctrl+Shift+R)
4. Check browser console for errors

### Config changes not taking effect

**Solution:**
1. Sync to extension: `npm run sync-config`
2. Rebuild dashboard: `npm run build`
3. Reload extension in `chrome://extensions`
4. Clear auth tokens: `chrome.storage.local.clear()`

### Different instances between dashboard and extension

**Solution:**
1. Run: `npm run validate-config`
2. Fix any reported mismatches
3. Run: `npm run sync-config`
4. Rebuild and reload

## Migration Notes

### From Old System to Centralized Config

The migration is **already complete**. All files now use centralized config.

**What was changed:**
1. Created `supabase.config.js` as single source
2. Updated all extension files to import from config
3. Updated dashboard to import from config
4. Added validation script
5. Removed hardcoded credentials

**What you need to do:**
- Nothing! Just use the new workflow going forward
- When changing instances, edit `supabase.config.js` only

## Security Notes

### Best Practices

✅ **DO:**
- Keep `supabase.config.js` in `.gitignore` for production
- Use environment variables in production
- Rotate keys regularly
- Use RLS policies on all tables

❌ **DON'T:**
- Commit production keys to git
- Share anon keys publicly
- Use service_role key in extension
- Disable RLS on tables

### For Development

The current setup with `supabase.config.js` is perfect for development where the team needs to share the same Supabase instance.

### For Production

Consider using environment variables:

```javascript
// supabase.config.js (production)
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || 'fallback-dev-url',
  anonKey: process.env.SUPABASE_ANON_KEY || 'fallback-dev-key'
};
```

## Summary

**Single source of truth:** `supabase.config.js`

**To change instances:**
1. Edit `supabase.config.js`
2. `npm run sync-config`
3. `npm run validate-config`
4. `npm run build`
5. Reload extension

**All components (dashboard + extension) will automatically use new credentials.**

No more hunting through files!
No more mismatched credentials!
No more auth errors!

✨ One config to rule them all! ✨
