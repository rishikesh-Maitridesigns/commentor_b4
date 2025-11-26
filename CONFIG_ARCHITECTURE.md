# Configuration Architecture

## Single Source of Truth

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃       supabase.config.js (ROOT)                ┃
┃                                                 ┃
┃  export const SUPABASE_CONFIG = {              ┃
┃    url: 'https://xxx.supabase.co',            ┃
┃    anonKey: 'eyJ...'                          ┃
┃  };                                            ┃
┃                                                 ┃
┃  ← ONLY FILE YOU NEED TO EDIT! ←              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                    │
                    │ npm run sync-config
                    │
                    ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃    extension/supabase.config.js (COPY)        ┃
┃                                                 ┃
┃  Identical copy for extension use              ┃
┃  Auto-synced from root                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
         │                │              │
         │                │              │
         ↓                ↓              ↓
    ┌─────────┐     ┌──────────┐   ┌─────────┐
    │ popup   │     │background│   │ content │
    │  .js    │     │   .js    │   │   .js   │
    └─────────┘     └──────────┘   └─────────┘
         │                │              │
         └────────────────┼──────────────┘
                          │
                          ↓
              ┌────────────────────┐
              │  Extension Runtime │
              └────────────────────┘
                          │
                          ↓
              Uses credentials for:
              - Authentication
              - Saving comments
              - Loading threads
              - API calls
```

## Dashboard Flow

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃       supabase.config.js (ROOT)                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                    │
                    │ import from '../../supabase.config.js'
                    │
                    ↓
        ┌───────────────────────┐
        │ src/lib/supabase.ts   │
        │                       │
        │ createClient(         │
        │   SUPABASE_CONFIG.url,│
        │   SUPABASE_CONFIG.key │
        │ )                     │
        └───────────────────────┘
                    │
                    ↓
          ┌─────────────────┐
          │  Supabase Client│
          └─────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ↓           ↓           ↓
   ┌────────┐  ┌────────┐  ┌────────┐
   │  Auth  │  │ Threads│  │ Comments│
   │Context │  │  API   │  │   API  │
   └────────┘  └────────┘  └────────┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │   Dashboard UI        │
        │  - Login/Signup       │
        │  - Apps List          │
        │  - Comments Review    │
        └───────────────────────┘
```

## Before vs After

### Before (Multiple Sources) ❌

```
Credentials scattered everywhere:

extension/popup.js
   const URL = 'https://old-instance.supabase.co'     ❌
   const KEY = 'eyJ...old-key...'                     ❌

extension/background.js
   const KEY = 'eyJ...different-key...'               ❌ MISMATCH!

extension/content.js (7 places!)
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌
   const KEY = 'eyJ...old-key...'                     ❌

.env
   VITE_SUPABASE_URL=https://new-instance.supabase.co ❌ MISMATCH!
   VITE_SUPABASE_ANON_KEY=eyJ...new-key...            ❌ MISMATCH!

Result: Auth errors, comments don't save, confusion! 😱
```

### After (Single Source) ✅

```
ONE config file:

supabase.config.js
   url: 'https://correct-instance.supabase.co'        ✅
   anonKey: 'eyJ...correct-key...'                    ✅

All other files import from this:

extension/popup.js
   import { SUPABASE_CONFIG } from './supabase.config.js'     ✅

extension/background.js
   import { SUPABASE_CONFIG } from './supabase.config.js'     ✅

extension/content.js
   import { SUPABASE_CONFIG } from './supabase.config.js'     ✅

src/lib/supabase.ts
   import { SUPABASE_CONFIG } from '../../supabase.config.js' ✅

Result: Everything works, one place to update! 🎉
```

## Change Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Edit supabase.config.js                              │
│    - Change url                                          │
│    - Change anonKey                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. npm run sync-config                                   │
│    - Copies to extension/supabase.config.js             │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. npm run validate-config                               │
│    - Checks all files match                              │
│    - Checks no hardcoded credentials                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. npm run build                                         │
│    - Rebuilds dashboard with new config                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Reload extension in chrome://extensions              │
│    - Extension loads new config                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Clear auth tokens: chrome.storage.local.clear()     │
│    - Removes old credentials                             │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Sign in again                                         │
│    - Get fresh tokens for new instance                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
                    ✅ ALL DONE!
```

## Validation Flow

```
validate-config.js script checks:

┌────────────────────────────────────┐
│ 1. Read supabase.config.js         │
│    - Extract url and key           │
└────────────────────────────────────┘
              │
              ↓
┌────────────────────────────────────┐
│ 2. Check .env matches               │
│    ✅ VITE_SUPABASE_URL = config.url│
│    ✅ VITE_SUPABASE_ANON_KEY = ...  │
└────────────────────────────────────┘
              │
              ↓
┌────────────────────────────────────┐
│ 3. Check extension/supabase.config │
│    ✅ url matches                   │
│    ✅ anonKey matches               │
└────────────────────────────────────┘
              │
              ↓
┌────────────────────────────────────┐
│ 4. Scan extension/*.js files       │
│    ❌ No hardcoded URLs            │
│    ❌ No hardcoded keys            │
└────────────────────────────────────┘
              │
              ↓
        ┌──────────┐
        │ All OK?  │
        └──────────┘
         │      │
      Yes│      │No
         │      │
         ↓      ↓
      ✅ Pass  ❌ Fail (exit 1)
```

## Import Chain

### Extension

```
supabase.config.js
    ↓ (imported by)
popup.js
    → Uses SUPABASE_CONFIG.url
    → Uses SUPABASE_CONFIG.anonKey
    → Authenticates user
    → Stores token in chrome.storage

background.js
    → Uses SUPABASE_CONFIG.url
    → Uses SUPABASE_CONFIG.anonKey
    → Retrieves stored token
    → Saves comments to Supabase
    → Creates threads

content.js
    → Uses SUPABASE_CONFIG.anonKey
    → Retrieves stored token
    → Loads existing threads
    → Updates comment status
    → Resolves/reopens threads
```

### Dashboard

```
supabase.config.js
    ↓ (imported by)
src/lib/supabase.ts
    → Creates Supabase client
    → Uses SUPABASE_CONFIG.url
    → Uses SUPABASE_CONFIG.anonKey
    ↓ (used by)
src/contexts/AuthContext.tsx
    → Manages authentication
    → Sign in/sign up
    → User sessions
    ↓ (used by)
All Pages
    → Login.tsx
    → Signup.tsx
    → Apps.tsx
    → AppDetails.tsx
    → PublicReview.tsx
    → etc.
```

## Security Model

```
supabase.config.js (Development)
    → Contains actual credentials
    → Checked into git (team needs access)
    → Used for local development

supabase.config.js (Production)
    → In .gitignore
    → Uses environment variables
    → Deployed separately
    → Not in source code

Example production config:
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY
};
```

## Benefits Summary

### Single Edit Point
```
Before: Edit 9+ files ❌
After:  Edit 1 file ✅
```

### Automatic Consistency
```
Before: Manual sync, easy to miss ❌
After:  Automatic validation ✅
```

### Type Safety
```
Before: String literals everywhere ❌
After:  Exported const, importable ✅
```

### Easy Switching
```
Before: 30+ minutes, error-prone ❌
After:  2 minutes, validated ✅
```

### No Mismatches
```
Before: Different keys in different files ❌
After:  One source, impossible to mismatch ✅
```

## File Manifest

**Config Files:**
- ✅ `supabase.config.js` (root)
- ✅ `extension/supabase.config.js` (copy)

**Extension Files (import config):**
- ✅ `extension/popup.js`
- ✅ `extension/background.js`
- ✅ `extension/content.js`

**Dashboard Files (import config):**
- ✅ `src/lib/supabase.ts`

**Utility Scripts:**
- ✅ `validate-config.js`
- ✅ `package.json` (scripts)

**Documentation:**
- ✅ `CENTRALIZED_CONFIG.md`
- ✅ `QUICK_START.md`
- ✅ `CONFIG_ARCHITECTURE.md` (this file)

## Quick Commands Reference

```bash
# Edit config
nano supabase.config.js

# Sync to extension
npm run sync-config

# Validate everything
npm run validate-config

# Build dashboard
npm run build

# All in one
npm run sync-config && npm run validate-config && npm run build
```

---

**Remember:** Edit `supabase.config.js` ONLY. Everything else is automatic! 🚀
