let isCommentSyncActive = false;
let selectedElement = null;
let commentWidget = null;
let highlightOverlay = null;
let existingThreads = [];
let allAppThreads = [];
let commentPins = [];
let activeSession = null;
let commentsPanelOpen = false;
let commentsPanel = null;
let fabButton = null;
let showResolvedComments = true;

function getCurrentDomain() {
  try {
    return new URL(window.location.href).hostname;
  } catch (e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SESSION_ACTIVE') {
    console.log('✅ CommentSync: Session activated', message.session);

    const currentDomain = getCurrentDomain();
    const sessionDomain = message.session.appDomain;

    if (currentDomain && sessionDomain && currentDomain !== sessionDomain) {
      console.error('❌ CommentSync: Domain mismatch!', {
        current: currentDomain,
        expected: sessionDomain
      });
      alert(`⚠️ Cannot record on ${currentDomain}.\n\nThis app is configured for ${sessionDomain}.\n\nPlease navigate to ${sessionDomain} or select a different app.`);
      sendResponse({ success: false, error: 'Domain mismatch' });
      return true;
    }

    activeSession = message.session;
    isCommentSyncActive = true;
    loadExistingComments();
    showFAB();
    document.body.style.cursor = 'crosshair';
    console.log('✅ CommentSync: Ready to capture feedback - click any element');
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SESSION_STOPPED') {
    console.log('🛑 CommentSync: Session stopped');
    isCommentSyncActive = false;
    activeSession = null;
    clearAllPins();
    hideFAB();
    hideCommentsPanel();
    document.body.style.cursor = '';
    sendResponse({ success: true });
    return true;
  }
});

async function loadExistingComments() {
  if (!activeSession) return;

  try {
    const result = await chrome.storage.local.get(['authToken', 'supabaseUrl']);
    const apiUrl = `${result.supabaseUrl}/rest/v1`;
    const anonKey = SUPABASE_CONFIG.anonKey;

    const currentPageUrl = window.location.href;

    const [pageThreadsResponse, allThreadsResponse] = await Promise.all([
      fetch(
        `${apiUrl}/threads?app_id=eq.${activeSession.appId}&page_url=eq.${encodeURIComponent(currentPageUrl)}&select=*,comments(*)&order=created_at.desc`,
        {
          headers: {
            'Authorization': `Bearer ${result.authToken}`,
            'apikey': anonKey
          }
        }
      ),
      fetch(
        `${apiUrl}/threads?app_id=eq.${activeSession.appId}&select=*,comments(*)&order=created_at.desc`,
        {
          headers: {
            'Authorization': `Bearer ${result.authToken}`,
            'apikey': anonKey
          }
        }
      )
    ]);

    if (pageThreadsResponse.ok) {
      existingThreads = await pageThreadsResponse.json();
      displayCommentPins();
    }

    if (allThreadsResponse.ok) {
      allAppThreads = await allThreadsResponse.json();
    }

    refreshCommentsPanel();
  } catch (error) {
    console.error('Failed to load existing comments:', error);
  }
}

function displayCommentPins() {
  clearAllPins();

  existingThreads.forEach(thread => {
    if (!thread.position_data) return;

    const pos = typeof thread.position_data === 'string'
      ? JSON.parse(thread.position_data)
      : thread.position_data;

    const scrollX = pos.scrollX || 0;
    const scrollY = pos.scrollY || 0;

    const pinX = (pos.x || 0) - scrollX;
    const pinY = (pos.y || 0) - scrollY;

    const pin = document.createElement('div');
    pin.className = 'commentsync-pin';
    pin.dataset.threadId = thread.id;
    pin.style.cssText = `
      position: absolute;
      left: ${pinX}px;
      top: ${pinY}px;
      width: 32px;
      height: 32px;
      background: ${thread.status === 'resolved' ? '#10B981' : '#3B82F6'};
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      z-index: 999997;
      border: 2px solid white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: transform 0.2s;
    `;
    pin.textContent = thread.comments?.length || '1';

    pin.addEventListener('mouseenter', () => {
      pin.style.transform = 'scale(1.2)';
    });

    pin.addEventListener('mouseleave', () => {
      pin.style.transform = 'scale(1)';
    });

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      showThreadViewer(thread);
    });

    document.body.appendChild(pin);
    commentPins.push(pin);
  });
}

function clearAllPins() {
  commentPins.forEach(pin => pin.remove());
  commentPins = [];
}

function getOptimalSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('commentsync-'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(el =>
        el.tagName === current.tagName
      );
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

function createHighlightOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'commentsync-highlight-overlay';
  overlay.style.cssText = `
    position: absolute;
    border: 2px solid #3B82F6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    z-index: 999998;
    border-radius: 4px;
    transition: all 0.2s;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function highlightElement(element) {
  if (!highlightOverlay) {
    highlightOverlay = createHighlightOverlay();
  }

  const rect = element.getBoundingClientRect();
  highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
  highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
  highlightOverlay.style.display = 'block';
}

function hideHighlight() {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
}

document.addEventListener('mouseover', (e) => {
  if (!isCommentSyncActive || commentWidget) return;

  const target = e.target;
  if (target.closest('#commentsync-widget') ||
      target.closest('.commentsync-pin') ||
      target.closest('.commentsync-thread-viewer')) {
    return;
  }

  highlightElement(target);
  selectedElement = target;
});

document.addEventListener('click', (e) => {
  console.log('👆 CommentSync: Click detected', {
    isActive: isCommentSyncActive,
    hasWidget: !!commentWidget,
    target: e.target.tagName,
    targetClasses: e.target.className
  });

  if (!isCommentSyncActive) {
    console.log('⚠️ CommentSync: Session not active - start recording first');
    return;
  }

  if (commentWidget) {
    console.log('📋 CommentSync: Widget already open');
    return;
  }

  const target = e.target;
  if (target.closest('#commentsync-widget') ||
      target.closest('.commentsync-pin') ||
      target.closest('.commentsync-thread-viewer') ||
      target.closest('#commentsync-fab') ||
      target.closest('#commentsync-panel')) {
    console.log('🚫 CommentSync: Clicked on CommentSync UI element, ignoring');
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const selector = getOptimalSelector(target);
  console.log('✅ CommentSync: Element selected', {
    tag: target.tagName,
    id: target.id,
    classes: target.className,
    selector: selector
  });

  showCommentWidget(target, e.pageX, e.pageY);
}, true);

function showCommentWidget(element, x, y) {
  if (commentWidget) {
    closeWidget();
  }

  const widget = document.createElement('div');
  widget.id = 'commentsync-widget';

  const widgetWidth = 320;
  const widgetHeight = 220;
  const padding = 16;

  let finalX = x + padding;
  let finalY = y + padding;

  if (finalX + widgetWidth > window.innerWidth) {
    finalX = window.innerWidth - widgetWidth - padding;
  }
  if (finalX < padding) {
    finalX = padding;
  }

  if (finalY + widgetHeight > window.innerHeight + window.scrollY) {
    finalY = y - widgetHeight - padding;
    if (finalY < window.scrollY + padding) {
      finalY = window.scrollY + padding;
    }
  }

  widget.style.cssText = `
    position: absolute;
    top: ${finalY}px;
    left: ${finalX}px;
    width: ${widgetWidth}px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 16px;
  `;

  widget.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Add Comment</h3>
      <button id="commentsync-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 0; width: 24px; height: 24px;">×</button>
    </div>
    <textarea id="commentsync-textarea"
      placeholder="Describe the issue or feedback..."
      style="width: 100%; height: 100px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: none; font-family: inherit; margin-bottom: 12px; box-sizing: border-box;"
    ></textarea>
    <div style="display: flex; gap: 8px;">
      <button id="commentsync-submit"
        style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
        Submit
      </button>
      <button id="commentsync-cancel"
        style="flex: 1; background: #f1f5f9; color: #64748b; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(widget);

  const textarea = widget.querySelector('#commentsync-textarea');
  textarea.focus();

  widget.querySelector('#commentsync-close').onclick = closeWidget;
  widget.querySelector('#commentsync-cancel').onclick = closeWidget;
  widget.querySelector('#commentsync-submit').onclick = () => submitComment(element, textarea.value);

  commentWidget = widget;
}

function closeWidget() {
  if (commentWidget) {
    commentWidget.remove();
    commentWidget = null;
  }
  hideHighlight();
  selectedElement = null;
}

function captureHTMLSnapshot() {
  const clonedDoc = document.cloneNode(true);

  const scripts = clonedDoc.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  const iframes = clonedDoc.querySelectorAll('iframe');
  iframes.forEach(iframe => iframe.remove());

  const commentsyncElements = clonedDoc.querySelectorAll('[id^="commentsync"], [class*="commentsync"]');
  commentsyncElements.forEach(el => el.remove());

  const head = clonedDoc.querySelector('head');
  const baseTag = clonedDoc.createElement('base');
  baseTag.href = window.location.origin;
  head.insertBefore(baseTag, head.firstChild);

  const htmlSnapshot = {
    html: clonedDoc.documentElement.outerHTML,
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    styles: Array.from(document.styleSheets).slice(0, 10).map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      } catch (e) {
        return '';
      }
    }).join('\n')
  };

  return htmlSnapshot;
}

async function submitComment(element, text) {
  if (!text.trim()) {
    alert('Please enter a comment');
    return;
  }

  const rect = element.getBoundingClientRect();

  try {
    const commentData = {
      domSelector: getOptimalSelector(element),
      text: text.trim(),
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      screenshot: null,
      htmlSnapshot: null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };

    chrome.runtime.sendMessage(
      { type: 'SAVE_COMMENT', data: commentData },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Extension context error:', chrome.runtime.lastError);
          showNotification('Extension was reloaded. Please refresh the page and try again.', 'error');
          return;
        }

        if (response.success) {
          showNotification('Comment saved successfully!', 'success');
          closeWidget();
          loadExistingComments();
          refreshCommentsPanel();
        } else {
          showNotification('Failed to save comment: ' + response.error, 'error');
        }
      }
    );
  } catch (error) {
    console.error('❌ Error submitting comment:', error);
    showNotification('Failed to save comment. Please refresh the page and try again.', 'error');
  }
}

function showThreadViewer(thread) {
  const viewer = document.createElement('div');
  viewer.className = 'commentsync-thread-viewer';
  viewer.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    width: 400px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const screenshot = thread.comments[0]?.metadata?.screenshot || '';

  viewer.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1e293b;">Thread</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background: ${thread.status === 'resolved' ? '#D1FAE5' : '#DBEAFE'}; color: ${thread.status === 'resolved' ? '#065F46' : '#1E40AF'};">
            ${thread.status}
          </span>
          <span style="font-size: 11px; color: #64748b;">${thread.comments.length} comment${thread.comments.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button class="thread-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding: 0;">×</button>
    </div>

    ${screenshot ? `<img src="${screenshot}" style="width: 100%; height: auto; border-bottom: 1px solid #e2e8f0;">` : ''}

    <div style="flex: 1; overflow-y: auto; padding: 16px; max-height: 400px;" class="comments-container">
      ${thread.comments.map(comment => renderComment(comment, thread)).join('')}
    </div>

    <div style="padding: 16px; border-top: 1px solid #e2e8f0;">
      <textarea class="reply-input" placeholder="Add a reply..." style="width: 100%; height: 60px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: none; font-family: inherit; box-sizing: border-box; margin-bottom: 8px;"></textarea>
      <div style="display: flex; gap: 8px;">
        <button class="send-reply" style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Reply</button>
        ${thread.status === 'open'
          ? '<button class="resolve-thread" style="flex: 1; background: #10B981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Resolve</button>'
          : '<button class="reopen-thread" style="flex: 1; background: #F59E0B; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Reopen</button>'
        }
      </div>
    </div>
  `;

  document.body.appendChild(viewer);

  viewer.querySelector('.thread-close').addEventListener('click', () => viewer.remove());
  viewer.querySelector('.send-reply').addEventListener('click', () => handleReply(thread, viewer));

  const resolveBtn = viewer.querySelector('.resolve-thread');
  const reopenBtn = viewer.querySelector('.reopen-thread');

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => handleResolveThread(thread, viewer));
  }
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => handleReopenThread(thread, viewer));
  }

  viewer.querySelectorAll('.edit-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const commentId = e.target.dataset.commentId;
      handleEditComment(commentId, viewer);
    });
  });

  viewer.querySelectorAll('.delete-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const commentId = e.target.dataset.commentId;
      handleDeleteComment(commentId, thread, viewer);
    });
  });
}

function renderComment(comment, thread) {
  const isAuthor = comment.author_id === activeSession?.userId;

  return `
    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;" data-comment-id="${comment.id}">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">User</div>
          <div style="font-size: 11px; color: #64748b;">${new Date(comment.created_at).toLocaleString()}</div>
        </div>
        ${isAuthor ? `
          <div style="display: flex; gap: 4px;">
            <button class="edit-comment" data-comment-id="${comment.id}" style="background: none; border: none; cursor: pointer; color: #64748b; font-size: 18px; padding: 4px;">✏️</button>
            <button class="delete-comment" data-comment-id="${comment.id}" style="background: none; border: none; cursor: pointer; color: #EF4444; font-size: 18px; padding: 4px;">🗑️</button>
          </div>
        ` : ''}
      </div>
      <div class="comment-content" style="font-size: 13px; color: #475569; white-space: pre-wrap;">${comment.content}</div>
      ${comment.metadata?.screenshot ? `
        <div style="margin-top: 12px;">
          <img src="${comment.metadata.screenshot}" alt="Screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer;" onclick="window.open('${comment.metadata.screenshot}', '_blank')">
        </div>
      ` : ''}
      ${comment.metadata?.htmlSnapshot ? `
        <div style="margin-top: 8px;">
          <button onclick="(function() {
            const win = window.open('', '_blank');
            win.document.write('${comment.metadata.htmlSnapshot.html.replace(/'/g, "\\'")}');
            win.document.close();
          })()" style="font-size: 11px; color: #3B82F6; background: none; border: none; cursor: pointer; text-decoration: underline;">
            View Interactive HTML Snapshot
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

async function handleReply(thread, viewer) {
  const input = viewer.querySelector('.reply-input');
  const text = input.value.trim();

  if (!text) {
    alert('Please enter a reply');
    return;
  }

  try {
    const result = await chrome.storage.local.get(['authToken', 'userId', 'supabaseUrl']);
    const apiUrl = `${result.supabaseUrl}/rest/v1`;
    const anonKey = SUPABASE_CONFIG.anonKey;

    const response = await fetch(`${apiUrl}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        thread_id: thread.id,
        author_id: result.userId,
        content: text
      })
    });

    if (response.ok) {
      showNotification('Reply added!', 'success');
      viewer.remove();
      await loadExistingComments();
    } else {
      throw new Error('Failed to add reply');
    }
  } catch (error) {
    showNotification('Failed to add reply', 'error');
  }
}

async function handleResolveThread(thread, viewer) {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userId', 'supabaseUrl']);
    const apiUrl = `${result.supabaseUrl}/rest/v1`;
    const anonKey = SUPABASE_CONFIG.anonKey;

    const response = await fetch(`${apiUrl}/threads?id=eq.${thread.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: result.userId
      })
    });

    if (response.ok) {
      showNotification('Thread resolved!', 'success');
      viewer.remove();
      await loadExistingComments();
    }
  } catch (error) {
    showNotification('Failed to resolve thread', 'error');
  }
}

async function handleReopenThread(thread, viewer) {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userId', 'supabaseUrl']);
    const apiUrl = `${result.supabaseUrl}/rest/v1`;
    const anonKey = SUPABASE_CONFIG.anonKey;

    const response = await fetch(`${apiUrl}/threads?id=eq.${thread.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        status: 'open',
        resolved_at: null,
        resolved_by: null
      })
    });

    if (response.ok) {
      showNotification('Thread reopened!', 'success');
      viewer.remove();
      await loadExistingComments();
    }
  } catch (error) {
    showNotification('Failed to reopen thread', 'error');
  }
}

async function handleEditComment(commentId, viewer) {
  const commentDiv = viewer.querySelector(`[data-comment-id="${commentId}"]`);
  const contentDiv = commentDiv.querySelector('.comment-content');
  const currentText = contentDiv.textContent;

  contentDiv.innerHTML = `
    <textarea style="width: 100%; height: 80px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: none; font-family: inherit; box-sizing: border-box; margin-bottom: 8px;">${currentText}</textarea>
    <div style="display: flex; gap: 8px;">
      <button class="save-edit" style="flex: 1; background: #3B82F6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">Save</button>
      <button class="cancel-edit" style="flex: 1; background: #f1f5f9; color: #64748b; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">Cancel</button>
    </div>
  `;

  const textarea = contentDiv.querySelector('textarea');
  textarea.focus();

  contentDiv.querySelector('.save-edit').addEventListener('click', async () => {
    const newText = textarea.value.trim();
    if (!newText) return;

    try {
      const result = await chrome.storage.local.get(['authToken', 'supabaseUrl']);
      const apiUrl = `${result.supabaseUrl}/rest/v1`;
      const anonKey = SUPABASE_CONFIG.anonKey;

      const response = await fetch(`${apiUrl}/comments?id=eq.${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.authToken}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          content: newText,
          edited_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        contentDiv.textContent = newText;
        showNotification('Comment updated!', 'success');
      }
    } catch (error) {
      showNotification('Failed to update comment', 'error');
      contentDiv.textContent = currentText;
    }
  });

  contentDiv.querySelector('.cancel-edit').addEventListener('click', () => {
    contentDiv.textContent = currentText;
  });
}

async function handleDeleteComment(commentId, thread, viewer) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  try {
    const result = await chrome.storage.local.get(['authToken', 'supabaseUrl']);
    const apiUrl = `${result.supabaseUrl}/rest/v1`;
    const anonKey = SUPABASE_CONFIG.anonKey;

    const response = await fetch(`${apiUrl}/comments?id=eq.${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': anonKey
      }
    });

    if (response.ok) {
      showNotification('Comment deleted!', 'success');
      viewer.remove();
      await loadExistingComments();

      if (thread.comments.length === 1) {
        await fetch(`${apiUrl}/threads?id=eq.${thread.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${result.authToken}`,
            'apikey': anonKey
          }
        });
      }
    }
  } catch (error) {
    showNotification('Failed to delete comment', 'error');
  }
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10B981' : '#EF4444'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showFAB() {
  if (fabButton) return;

  fabButton = document.createElement('button');
  fabButton.id = 'commentsync-fab';
  fabButton.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    background: #3B82F6;
    color: white;
    border: none;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    cursor: pointer;
    z-index: 999996;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: bold;
  `;

  const updateBadge = () => {
    const count = allAppThreads.length;
    fabButton.innerHTML = count > 0 ? `<div style="position: relative;">\u{1F4AC}<div style="position: absolute; top: -8px; right: -8px; background: #EF4444; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; min-width: 18px; text-align: center;">${count}</div></div>` : '\u{1F4AC}';
  };

  updateBadge();

  fabButton.addEventListener('mouseenter', () => {
    fabButton.style.transform = 'scale(1.1)';
    fabButton.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
  });

  fabButton.addEventListener('mouseleave', () => {
    fabButton.style.transform = 'scale(1)';
    fabButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
  });

  fabButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCommentsPanel();
  });

  document.body.appendChild(fabButton);
}

function hideFAB() {
  if (fabButton) {
    fabButton.remove();
    fabButton = null;
  }
}

function toggleCommentsPanel() {
  if (commentsPanelOpen) {
    hideCommentsPanel();
  } else {
    showCommentsPanel();
  }
}

function showCommentsPanel() {
  if (commentsPanel) return;

  commentsPanelOpen = true;

  commentsPanel = document.createElement('div');
  commentsPanel.id = 'commentsync-panel';
  commentsPanel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    z-index: 999998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);

  renderCommentsPanelContent();
  document.body.appendChild(commentsPanel);
}

function renderCommentsPanelContent() {
  if (!commentsPanel) return;

  const filteredThreads = showResolvedComments
    ? allAppThreads
    : allAppThreads.filter(t => t.status !== 'resolved');

  const openCount = allAppThreads.filter(t => t.status !== 'resolved').length;
  const resolvedCount = allAppThreads.filter(t => t.status === 'resolved').length;
  const currentPageCount = existingThreads.length;
  const totalCount = allAppThreads.length;

  commentsPanel.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; background: #3B82F6; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">All Comments</h2>
        <button id="commentsync-panel-close" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div style="font-size: 13px; opacity: 0.9;">${totalCount} total · ${openCount} open · ${resolvedCount} resolved</div>
      <div style="font-size: 12px; opacity: 0.75; margin-top: 4px;">${currentPageCount} on this page</div>
    </div>

    <div style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
      <div style="display: flex; gap: 8px;">
        <button id="commentsync-filter-all" style="flex: 1; padding: 8px 12px; border: ${showResolvedComments ? '2px solid #3B82F6' : '1px solid #e5e7eb'}; background: ${showResolvedComments ? '#EFF6FF' : 'white'}; color: ${showResolvedComments ? '#3B82F6' : '#64748b'}; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
          All (${totalCount})
        </button>
        <button id="commentsync-filter-open" style="flex: 1; padding: 8px 12px; border: ${!showResolvedComments ? '2px solid #3B82F6' : '1px solid #e5e7eb'}; background: ${!showResolvedComments ? '#EFF6FF' : 'white'}; color: ${!showResolvedComments ? '#3B82F6' : '#64748b'}; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
          Open (${openCount})
        </button>
      </div>
    </div>

    <div style="flex: 1; overflow-y: auto; padding: 16px;" id="commentsync-threads-container">
      ${filteredThreads.length === 0 ?
        `<div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
          <div style="font-size: 48px; margin-bottom: 16px;">\u{1F4AC}</div>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">No comments yet</div>
          <div style="font-size: 14px;">Click on any element to add feedback</div>
        </div>`
        :
        filteredThreads.map(thread => createThreadCard(thread)).join('')
      }
    </div>

    <div style="padding: 16px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
      <button id="commentsync-stop-recording" style="width: 100%; background: #EF4444; color: white; border: none; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
        Stop Recording
      </button>
    </div>
  `;

  commentsPanel.querySelector('#commentsync-panel-close').addEventListener('click', hideCommentsPanel);
  commentsPanel.querySelector('#commentsync-stop-recording').addEventListener('click', handleStopFromPanel);

  commentsPanel.querySelector('#commentsync-filter-all').addEventListener('click', () => {
    showResolvedComments = true;
    renderCommentsPanelContent();
  });

  commentsPanel.querySelector('#commentsync-filter-open').addEventListener('click', () => {
    showResolvedComments = false;
    renderCommentsPanelContent();
  });

  filteredThreads.forEach((thread) => {
    const card = commentsPanel.querySelector(`[data-thread-id="${thread.id}"]`);
    if (card) {
      card.addEventListener('click', () => scrollToThread(thread));
    }
  });
}

function createThreadCard(thread) {
  const status = thread.status || 'open';
  const commentCount = thread.comments?.length || 0;
  const firstComment = thread.comments?.[0]?.text || 'No comment text';
  const createdAt = new Date(thread.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isCurrentPage = thread.page_url === window.location.href;
  let pageDisplay = '';

  if (!isCurrentPage && thread.page_url) {
    try {
      const url = new URL(thread.page_url);
      const pathname = url.pathname === '/' ? 'Home' : url.pathname.split('/').filter(Boolean).pop() || 'Page';
      pageDisplay = `<div style="color: #64748b; font-size: 11px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
        <span>\u{1F517}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pathname}</span>
      </div>`;
    } catch (e) {
      pageDisplay = '';
    }
  }

  return `
    <div data-thread-id="${thread.id}" data-page-url="${thread.page_url || ''}" style="
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s;
      ${!isCurrentPage ? 'opacity: 0.85;' : ''}
    " onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.borderColor='#3B82F6';" onmouseleave="this.style.boxShadow='none'; this.style.borderColor='#e5e7eb';">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <span style="
          background: ${status === 'resolved' ? '#10B981' : '#3B82F6'};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
        ">${status}</span>
        <span style="color: #64748b; font-size: 12px;">${createdAt}</span>
      </div>
      ${pageDisplay}
      <div style="color: #1e293b; font-size: 13px; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
        ${firstComment}
      </div>
      <div style="color: #64748b; font-size: 12px;">
        \u{1F4AC} ${commentCount} comment${commentCount !== 1 ? 's' : ''}
      </div>
    </div>
  `;
}

function scrollToThread(thread) {
  const isCurrentPage = thread.page_url === window.location.href;

  if (!isCurrentPage) {
    if (confirm(`This comment is on a different page. Navigate to that page?\n\n${thread.page_url}`)) {
      window.location.href = thread.page_url;
    }
    return;
  }

  hideCommentsPanel();

  const pin = document.querySelector(`.commentsync-pin[data-thread-id="${thread.id}"]`);
  if (pin) {
    pin.scrollIntoView({ behavior: 'smooth', block: 'center' });

    pin.style.animation = 'pulse 0.5s ease-in-out 3';
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      pin.click();
    }, 1000);
  } else {
    showNotification('Comment pin not found on this page', 'error');
  }
}

function hideCommentsPanel() {
  if (commentsPanel) {
    commentsPanel.style.animation = 'slideOut 0.3s ease-in';
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideOut {
        from { transform: translateX(0); }
        to { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      commentsPanel.remove();
      commentsPanel = null;
      commentsPanelOpen = false;
    }, 300);
  }
}

function refreshCommentsPanel() {
  if (commentsPanelOpen && commentsPanel) {
    renderCommentsPanelContent();
  }

  if (fabButton) {
    const count = allAppThreads.length;
    fabButton.innerHTML = count > 0 ? `<div style="position: relative;">\u{1F4AC}<div style="position: absolute; top: -8px; right: -8px; background: #EF4444; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; min-width: 18px; text-align: center;">${count}</div></div>` : '\u{1F4AC}';
  }
}

function handleStopFromPanel() {
  if (confirm('Are you sure you want to stop recording feedback?')) {
    chrome.runtime.sendMessage({ type: 'STOP_SESSION', tabId: null }, () => {
      isCommentSyncActive = false;
      activeSession = null;
      clearAllPins();
      hideFAB();
      hideCommentsPanel();
      document.body.style.cursor = '';
      showNotification('Recording stopped', 'success');
    });
  }
}
