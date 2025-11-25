# Chrome Extension Installation Guide

Follow these simple steps to install the CommentSync Chrome Extension:

## Step 1: Download the Extension

The extension files are located in the `/extension` folder of this project.

## Step 2: Load in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`

2. Enable **Developer mode** (toggle in the top-right corner)

3. Click **"Load unpacked"**

4. Navigate to and select the `extension` folder

5. The CommentSync extension icon should now appear in your Chrome toolbar

## Step 3: Sign In

1. Click the CommentSync extension icon in your toolbar

2. Sign in with your CommentSync account credentials (same login as the web dashboard)

3. The extension will automatically load all apps you own or were invited to collaborate on

## Step 4: Start Reviewing

1. Select an app from the dropdown menu

2. Click **"Start Recording"**

3. Navigate to the actual website you want to review (e.g., maitridesigns.com)

4. Click on any element on the page to add comments

5. All comments are automatically synced to the dashboard

## Troubleshooting

### Extension won't load
- Make sure all files are present in the extension folder
- Check Chrome DevTools console at `chrome://extensions/` for errors

### Can't sign in
- Verify your credentials are correct
- Make sure you have an active internet connection
- Check that you're using the same credentials as the web dashboard

### Comments not saving
- Ensure you're signed in to the extension
- Check that you've selected an app before clicking "Start Recording"
- Verify your internet connection

### App not showing in list
- Make sure you own the app OR have been invited as a collaborator
- Try signing out and back in to refresh the app list

## Benefits

The Chrome extension works on **any website** including:
- Sites with OAuth login (Google, GitHub, etc.)
- Sites with Content Security Policy (CSP) headers
- Sites with X-Frame-Options headers
- Any site that blocks iframe embedding

Unlike the web-based review interface, the extension has no restrictions and works universally.

## Need Help?

Contact your CommentSync administrator or check the main documentation at `/extension/README.md`
