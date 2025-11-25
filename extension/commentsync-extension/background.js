let activeSession = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('CommentSync extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SESSION') {
    activeSession = {
      appId: message.appId,
      userId: message.userId,
      startTime: Date.now(),
      tabId: sender.tab?.id
    };
    chrome.storage.local.set({ activeSession });
    sendResponse({ success: true });
  }

  if (message.type === 'STOP_SESSION') {
    activeSession = null;
    chrome.storage.local.remove('activeSession');
    sendResponse({ success: true });
  }

  if (message.type === 'GET_SESSION') {
    sendResponse({ session: activeSession });
  }

  if (message.type === 'SAVE_COMMENT') {
    handleSaveComment(message.data, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

  const supabaseUrl = await chrome.storage.local.get('supabaseUrl');
  const apiUrl = `${supabaseUrl.supabaseUrl}/rest/v1`;
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dWl6a2xwZ3F0a25qc3NubmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTkxMDAsImV4cCI6MjA3OTYzNTEwMH0.kg7wXyXubuMY0_K_BQmOH5z6awwMWEhg0jChk3cfL8g';

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
