// popup.js - Fixed version
let analysisResults = [];
let isLoading = false;
let isBackendConnected = false;
let activeTabId = null;
let currentTabUrl = null;

// Add message listener at the top level
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateResults") {
    updateUI(message.results);
    sendResponse({ success: true });
  }
  return true;
});

document.addEventListener('DOMContentLoaded', async function() {
  setLoading(true);
  document.getElementById('noLinksFound').classList.add('hidden');
  document.getElementById('rescanButton').addEventListener('click', triggerScan);
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab) {
      activeTabId = tab.id;
      currentTabUrl = tab.url;
      console.log(`Active tab: ${tab.url} (ID: ${tab.id})`);

      isBackendConnected = await checkBackendConnection();
      if (!isBackendConnected) {
        showConnectionError();
        return;
      }
      
      await initializeContentScript();
      triggerScan();
    } else {
      showNoActiveTabError();
    }
  } catch (error) {
    console.error("Initialization error:", error);
    showScanError(error.message);
  }
});

async function initializeContentScript() {
  console.log(`Initializing content script for tab ${activeTabId}`);
  try {
    await chrome.scripting.executeScript({
      target: {tabId: activeTabId, allFrames: true},
      files: ['content.js']
    });
    console.log("Content script injected successfully");
  } catch (error) {
    console.error("Content script injection failed:", error);
    throw error;
  }
}

async function triggerScan() {
  if (isLoading || !activeTabId) return;
  
  setLoading(true);
  console.log(`Starting scan for tab ${activeTabId}`);
  
  try {
    // Verify content script is ready
    const pingResponse = await chrome.tabs.sendMessage(activeTabId, {action: "ping"});
    console.log("Ping response:", pingResponse);

    if (!pingResponse?.success) {
      throw new Error("Content script not responding");
    }

    // Start the scan
    const scanResponse = await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
    console.log("Scan response:", scanResponse);

    if (!scanResponse?.success) {
      throw new Error(scanResponse?.error || "Scan failed");
    }
  } catch (error) {
    console.error("Scan error:", error);
    
    // Attempt recovery by re-injecting content script
    try {
      console.log("Attempting recovery...");
      await initializeContentScript();
      const retryResponse = await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
      console.log("Retry response:", retryResponse);
    } catch (retryError) {
      console.error("Recovery failed:", retryError);
      showScanError(error.message);
    }
  }
}

function showScanError(message) {
  setLoading(false);
  const linksList = document.getElementById('linksList');
  linksList.innerHTML = `
    <li class="error-message">
      Failed to scan the page: ${message || 'Unknown error'}
    </li>
  `;
}

async function checkBackendConnection() {
  try {
    const response = await chrome.runtime.sendMessage({action: "checkConnection"});
    return response?.connected || false;
  } catch (error) {
    console.error("Connection check error:", error);
    return false;
  }
}

function showConnectionError() {
  setLoading(false);
  const linksList = document.getElementById('linksList');
  linksList.innerHTML = `
    <li class="error-message">
      <strong>Backend Connection Failed</strong>
      <p>Please ensure:</p>
      <ol>
        <li>The backend server is running at http://localhost:5000</li>
        <li>You have network connectivity</li>
        <li>There are no browser restrictions</li>
      </ol>
    </li>
  `;
}

function showNoActiveTabError() {
  setLoading(false);
  const linksList = document.getElementById('linksList');
  linksList.innerHTML = `
    <li class="error-message">
      No active tab found. Please refresh the page and try again.
    </li>
  `;
}

function setLoading(loading) {
  isLoading = loading;
  const loadingIndicator = document.getElementById('loadingIndicator');
  const rescanButton = document.getElementById('rescanButton');
  
  loadingIndicator.style.display = loading ? 'flex' : 'none';
  rescanButton.disabled = loading;

  if (loading) {
    document.getElementById('linksList').innerHTML = '';
    document.getElementById('noLinksFound').classList.add('hidden');
    document.getElementById('recommendations').classList.add('hidden');
    document.getElementById('totalLinks').textContent = '0';
    document.getElementById('phishingLinks').textContent = '0';
    document.getElementById('sslIssues').textContent = '0';
    document.getElementById('threatValue').textContent = 'Analyzing...';
    document.getElementById('progressBar').style.width = '0%';
  }
}

function updateUI(results) {
  setLoading(false);
  analysisResults = results || [];

  if (analysisResults.length === 0) {
    document.getElementById('noLinksFound').classList.remove('hidden');
    return;
  }

  const totalLinks = analysisResults.length;
  const phishingLinks = analysisResults.filter(r => r.prediction === "Phishing").length;
  const sslIssues = analysisResults.filter(r => !r.validSSL).length;

  document.getElementById('totalLinks').textContent = totalLinks;
  document.getElementById('phishingLinks').textContent = phishingLinks;
  document.getElementById('sslIssues').textContent = sslIssues;

  const threatLevel = calculateThreatLevel(phishingLinks, sslIssues, totalLinks);
  updateThreatUI(threatLevel);

  updateLinksList();
  updateRecommendations(phishingLinks, sslIssues);
}

function calculateThreatLevel(phishingLinks, sslIssues, totalLinks) {
  if (totalLinks === 0) return 0;
  return ((phishingLinks / totalLinks) * 70) + ((sslIssues / totalLinks) * 30);
}

function updateThreatUI(threatLevel) {
  const threatValue = document.getElementById('threatValue');
  const progressBar = document.getElementById('progressBar');

  progressBar.style.width = `${Math.min(threatLevel, 100)}%`;

  if (threatLevel >= 70) {
    threatValue.textContent = 'High Risk';
    progressBar.style.backgroundColor = '#dc3545';
  } else if (threatLevel >= 40) {
    threatValue.textContent = 'Moderate Risk';
    progressBar.style.backgroundColor = '#ffc107';
  } else {
    threatValue.textContent = 'Low Risk';
    progressBar.style.backgroundColor = '#28a745';
  }
}

function updateLinksList() {
  const linksList = document.getElementById('linksList');
  linksList.innerHTML = '';

  if (analysisResults.length === 0) {
    const li = document.createElement('li');
    li.className = 'safe-link';
    li.textContent = '';
    linksList.appendChild(li);
    return;
  }

  analysisResults.forEach(item => {
    const li = document.createElement('li');
    li.className = getLinkClassName(item);
    li.innerHTML = createLinkHTML(item);
    linksList.appendChild(li);
  });
}

function getLinkClassName(item) {
  if (item.prediction === "Phishing") return 'phishing-link';
  if (!item.validSSL) return 'ssl-issue-link';
  return 'safe-link';
}

function createLinkHTML(item) {
  return `
    <div class="link-url">
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a>
    </div>
    <div class="link-status">
      ${item.prediction === "Phishing" ? '<span class="badge">Phishing</span>' : ''}
      ${!item.validSSL ? '<span class="badge ssl-issue">SSL Issue</span>' : ''}
    </div>
  `;
}

function updateRecommendations(phishingLinks, sslIssues) {
  const recommendations = document.getElementById('recommendations');
  if (phishingLinks > 0 || sslIssues > 0) {
    recommendations.classList.remove('hidden');
  } else {
    recommendations.classList.add('hidden');
  }
}