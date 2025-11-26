importScripts('supabase.config.js');

let activeSession = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('CommentSync extension installed');
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 CommentSync: Extension startup');
  const stored = await chrome.storage.local.get('activeSession');
  if (stored.activeSession) {
    activeSession = stored.activeSession;
    console.log('✅ Restored active session from storage', activeSession);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeSession && activeSession.tabId === tabId) {
    console.log('🔄 CommentSync: Tab reloaded, re-activating session');
    chrome.tabs.sendMessage(tabId, {
      type: 'SESSION_ACTIVE',
      session: activeSession
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ Could not re-activate session:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ Session re-activated after page load');
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SESSION') {
    console.log('🎬 CommentSync Background: Starting session', message);
    activeSession = {
      appId: message.appId,
      userId: message.userId,
      startTime: Date.now(),
      tabId: message.tabId,
      appDomain: message.appDomain
    };
    chrome.storage.local.set({ activeSession });

    chrome.tabs.sendMessage(message.tabId, {
      type: 'SESSION_ACTIVE',
      session: activeSession
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ Content script not ready yet:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ Session activated in tab', message.tabId);
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'STOP_SESSION') {
    if (message.tabId) {
      chrome.tabs.sendMessage(message.tabId, {
        type: 'SESSION_STOPPED'
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Content script not available');
        }
      });
    }

    activeSession = null;
    chrome.storage.local.remove('activeSession');
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_SESSION') {
    sendResponse({ session: activeSession });
    return true;
  }

  if (message.type === 'SAVE_COMMENT') {
    console.log('💾 CommentSync Background: Saving comment', message.data);
    handleSaveComment(message.data, sender.tab)
      .then(() => {
        console.log('✅ Comment saved successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('❌ Failed to save comment:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ screenshot: dataUrl });
    });
    return true;
  }
});

async function handleSaveComment(commentData, tab) {
  const session = await chrome.storage.local.get('activeSession');
  const authData = await chrome.storage.local.get(['authToken', 'userId']);

  if (!session.activeSession || !authData.authToken) {
    throw new Error('No active session or auth token');
  }

  const apiUrl = `${SUPABASE_CONFIG.url}/rest/v1`;
  const anonKey = SUPABASE_CONFIG.anonKey;

  const threadPayload = {
    app_id: session.activeSession.appId,
    page_url: tab.url,
    dom_selector: commentData.domSelector ? { selector: commentData.domSelector } : null,
    position_data: {
      x: commentData.x,
      y: commentData.y,
      scrollX: commentData.scrollX || 0,
      scrollY: commentData.scrollY || 0,
      viewportWidth: commentData.viewportWidth,
      viewportHeight: commentData.viewportHeight
    },
    status: 'open'
  };

  const threadResponse = await fetch(`${apiUrl}/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.authToken}`,
      'apikey': anonKey,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(threadPayload)
  });

  if (!threadResponse.ok) {
    const errorText = await threadResponse.text();
    throw new Error(`Failed to create thread: ${errorText}`);
  }

  const threads = await threadResponse.json();
  const thread = threads[0];

  const commentPayload = {
    thread_id: thread.id,
    author_id: authData.userId,
    content: commentData.text,
    metadata: {
      page_title: tab.title,
      screenshot: commentData.screenshot,
      htmlSnapshot: commentData.htmlSnapshot,
      user_agent: navigator.userAgent
    }
  };

  const commentResponse = await fetch(`${apiUrl}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.authToken}`,
      'apikey': anonKey,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(commentPayload)
  });

  if (!commentResponse.ok) {
    const errorText = await commentResponse.text();
    throw new Error(`Failed to create comment: ${errorText}`);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeSession && tabId === activeSession.tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'SESSION_ACTIVE', session: activeSession });
  }
});
