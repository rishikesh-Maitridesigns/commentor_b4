const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

let currentUser = null;
let apps = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('goto-page-btn').addEventListener('click', handleGotoPage);
  document.getElementById('start-btn').addEventListener('click', handleStartRecording);
  document.getElementById('stop-btn').addEventListener('click', handleStopRecording);
  document.getElementById('open-dashboard').addEventListener('click', openDashboard);

  document.getElementById('email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  chrome.tabs.onActivated.addListener(() => {
    checkIfOnCorrectPage();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      checkIfOnCorrectPage();
    }
  });
});

async function checkAuthStatus() {
  const result = await chrome.storage.local.get(['authToken', 'userId', 'userEmail']);

  if (result.authToken && result.userId) {
    currentUser = { id: result.userId, email: result.userEmail };
    await chrome.storage.local.set({ supabaseUrl: SUPABASE_URL });
    showAppSection();
    await loadApps();
    await checkActiveSession();
  } else {
    showLoginSection();
  }
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  hideError();
  setLoading(true);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Login failed');
    }

    await chrome.storage.local.set({
      authToken: data.access_token,
      userId: data.user.id,
      userEmail: data.user.email,
      supabaseUrl: SUPABASE_URL
    });

    currentUser = { id: data.user.id, email: data.user.email };
    showAppSection();
    await loadApps();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  await chrome.storage.local.clear();
  currentUser = null;
  apps = [];
  showLoginSection();
}

async function loadApps() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'userId']);

    const workspaceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/workspace_members?user_id=eq.${result.userId}&select=workspace_id`, {
      headers: {
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!workspaceResponse.ok) throw new Error('Failed to load workspaces');
    const workspaces = await workspaceResponse.json();
    const workspaceIds = workspaces.map(w => w.workspace_id);

    if (workspaceIds.length === 0) {
      apps = [];
      const select = document.getElementById('app-select');
      select.innerHTML = '<option value="">No apps available</option>';
      return;
    }

    const appsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/apps?workspace_id=in.(${workspaceIds.join(',')})&select=*&is_active=eq.true`, {
      headers: {
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!appsResponse.ok) throw new Error('Failed to load apps');

    apps = await appsResponse.json();

    const select = document.getElementById('app-select');
    select.innerHTML = '<option value="">-- Select an app --</option>';

    apps.forEach(app => {
      const option = document.createElement('option');
      option.value = app.id;
      const domain = extractDomain(app.base_url);
      option.textContent = `${app.name} (${domain || app.base_url})`;
      option.dataset.baseUrl = app.base_url;
      select.appendChild(option);
    });

    select.addEventListener('change', handleAppSelect);
    checkIfOnCorrectPage();
  } catch (error) {
    showError('Failed to load apps: ' + error.message);
  }
}

async function handleAppSelect(event) {
  const appId = event.target.value;
  const gotoBtn = document.getElementById('goto-page-btn');
  const recordingControls = document.getElementById('recording-controls');

  if (appId) {
    await chrome.storage.local.set({ selectedAppId: appId });
    checkIfOnCorrectPage();
  } else {
    gotoBtn.classList.add('hidden');
    recordingControls.classList.add('hidden');
  }
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

async function checkIfOnCorrectPage() {
  const appId = document.getElementById('app-select').value;
  if (!appId) return;

  const app = apps.find(a => a.id === appId);
  if (!app) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const gotoBtn = document.getElementById('goto-page-btn');
  const recordingControls = document.getElementById('recording-controls');
  const domainWarning = document.getElementById('domain-warning');

  if (!tab || !tab.url) {
    gotoBtn.classList.remove('hidden');
    recordingControls.classList.add('hidden');
    domainWarning.classList.add('hidden');
    return;
  }

  const currentDomain = extractDomain(tab.url);
  const appDomain = extractDomain(app.base_url);

  if (currentDomain && appDomain && currentDomain === appDomain) {
    gotoBtn.classList.add('hidden');
    recordingControls.classList.remove('hidden');
    domainWarning.classList.add('hidden');
  } else {
    gotoBtn.classList.remove('hidden');
    recordingControls.classList.add('hidden');
    if (currentDomain && appDomain) {
      domainWarning.textContent = `⚠️ Wrong domain! This app is for ${appDomain}, but you're on ${currentDomain}`;
      domainWarning.classList.remove('hidden');
    } else {
      domainWarning.classList.add('hidden');
    }
  }
}

async function handleGotoPage() {
  const appId = document.getElementById('app-select').value;
  if (!appId) return;

  const app = apps.find(a => a.id === appId);
  if (!app || !app.base_url) {
    showError('App URL not configured');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.update(tab.id, { url: app.base_url });

  setTimeout(() => {
    checkIfOnCorrectPage();
  }, 1000);
}

async function handleStartRecording() {
  const appId = document.getElementById('app-select').value;

  if (!appId) {
    showError('Please select an app');
    return;
  }

  const app = apps.find(a => a.id === appId);
  if (!app) {
    showError('App not found');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const currentDomain = extractDomain(tab.url);
  const appDomain = extractDomain(app.base_url);

  if (!currentDomain || !appDomain || currentDomain !== appDomain) {
    showError(`Cannot start recording on ${currentDomain || 'this page'}. This app is configured for ${appDomain || app.base_url}. Please use "Go to Page" button.`);
    return;
  }

  const result = await chrome.storage.local.get('userId');

  chrome.runtime.sendMessage({
    type: 'START_SESSION',
    appId: appId,
    userId: result.userId,
    tabId: tab.id,
    appDomain: appDomain
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error starting session:', chrome.runtime.lastError);
      return;
    }
    updateStatus(true, appId);
  });
}

async function handleStopRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage({ type: 'STOP_SESSION', tabId: tab.id }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error stopping session:', chrome.runtime.lastError);
      return;
    }
    updateStatus(false);
  });
}

async function checkActiveSession() {
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting session:', chrome.runtime.lastError);
      return;
    }
    if (response && response.session) {
      updateStatus(true, response.session.appId);
    }
  });
}

function updateStatus(isActive, appId = null) {
  const status = document.getElementById('status');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const appSelect = document.getElementById('app-select');

  if (isActive) {
    const app = apps.find(a => a.id === appId);
    status.className = 'status active';
    status.innerHTML = `<strong>Recording Active</strong>${app ? `Tracking feedback for: ${app.name}` : 'Click elements to add comments'}`;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    appSelect.disabled = true;
  } else {
    status.className = 'status';
    status.innerHTML = '<strong>Not Recording</strong>Select an app to start tracking feedback';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    appSelect.disabled = false;
  }
}

function showLoginSection() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
}

function showAppSection() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-message').classList.add('hidden');
}

function setLoading(loading) {
  const btn = document.getElementById('login-btn');
  btn.disabled = loading;
  btn.textContent = loading ? 'Signing in...' : 'Sign In';
}

function openDashboard(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:5173' });
}
