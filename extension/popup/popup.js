// popup.js - Enhanced version with persistent UI and stop button
let analysisResults = [];
let isLoading = false;
let isBackendConnected = false;
let activeTabId = null;
let currentTabUrl = null;
let isScanActive = false;  // Track whether a scan is currently active

// Add message listener at the top level - only update UI, don't trigger scans
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message.action);
  if (message.action === "updateResults") {
    console.log(`Updating UI with ${message.results?.length || 0} results`);
    updateUI(message.results);
    sendResponse({ success: true });
  }
  return true;
});

document.addEventListener('DOMContentLoaded', async function() {
  setLoading(false); // Don't start loading immediately
  document.getElementById('noLinksFound').classList.add('hidden');
  document.getElementById('rescanButton').addEventListener('click', triggerScan);
  document.getElementById('stopButton').addEventListener('click', stopScan);
  
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
      // Don't automatically trigger scan - wait for user to click button
      showReadyToScan();
    } else {
      showNoActiveTabError();
    }
  } catch (error) {
    console.error("Initialization error:", error);
    showScanError(error.message);
  }
});

// Stop scanning when popup window is closed/hidden
window.addEventListener('beforeunload', () => {
  if (activeTabId) {
    try {
      // Use synchronous message for beforeunload to ensure it gets sent
      chrome.tabs.sendMessage(activeTabId, {action: "stopScan"});
      chrome.runtime.sendMessage({action: "stopProcessing"});
    } catch (e) {
      console.error("Error during cleanup:", e);
    }
  }
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeTabId) {
    // Popup is hidden/closed
    chrome.tabs.sendMessage(activeTabId, {action: "stopScan"}).catch(() => {});
    chrome.runtime.sendMessage({action: "stopProcessing"}).catch(() => {});
  }
});

async function initializeContentScript() {
    // This function now does nothing until explicitly requested during scan
    console.log(`Content script will only be injected when scan is requested`);
    return true;
}

async function triggerScan() {
  if (isLoading || !activeTabId) return;
  
  setLoading(true);
  console.log(`Starting scan for tab ${activeTabId}`);
  
  try {
    console.log('=== STARTING NEW SCAN ===');
    
    // Stop any existing processing in background
    await chrome.runtime.sendMessage({action: "stopProcessing"}).catch(() => {});
    
    // Inject content script explicitly only when scanning
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: {tabId: activeTabId, allFrames: false},
      files: ['content.js']
    });
    
    // Small delay to let content script initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify content script is ready
    try {
      const pingResponse = await chrome.tabs.sendMessage(activeTabId, {action: "ping"});
      console.log("Ping response:", pingResponse);
      
      if (!pingResponse?.success) {
        throw new Error("Content script not responding");
      }
    } catch (error) {
      console.error("Ping failed, retrying once more after delay", error);
      await new Promise(resolve => setTimeout(resolve, 200));
      const pingResponse = await chrome.tabs.sendMessage(activeTabId, {action: "ping"});
      if (!pingResponse?.success) {
        throw new Error("Content script injection failed");
      }
    }

    // Start the scan
    const scanResponse = await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
    console.log("Scan response:", scanResponse);

    if (!scanResponse?.success) {
      throw new Error(scanResponse?.error || "Scan failed");
    }
    
    // Update last scanned time
    updateLastScannedTime();
    console.log('=== SCAN INITIATED ===');
  } catch (error) {
    console.error("Scan error:", error);
    
    // Attempt recovery by re-injecting content script
    try {
      console.log("Attempting recovery by re-injecting content script...");
      await initializeContentScript();
      
      // Wait a bit for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const retryResponse = await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
      console.log("Retry response:", retryResponse);
      
      if (retryResponse?.success) {
        updateLastScannedTime();
      } else {
        throw new Error(retryResponse?.error || "Retry failed");
      }
    } catch (retryError) {
      console.error("Recovery failed:", retryError);
      showScanError(error.message);
    }
  }
}

function updateLastScannedTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  document.getElementById('lastScannedTime').textContent = `Last scanned: ${timeString}`;
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

async function stopScan() {
  console.log('Stopping scan...');
  try {
    // Stop the content script scan
    await chrome.tabs.sendMessage(activeTabId, {action: "stopScan"});
    
    // Stop the background processing
    await chrome.runtime.sendMessage({action: "stopProcessing"});
    
    // Update UI to show scan was stopped
    setLoading(false);
    
    // Show message that scan was stopped
    const linksList = document.getElementById('linksList');
    if (!analysisResults || analysisResults.length === 0) {
      linksList.innerHTML = `
        <li class="ready-message">
          <div class="ready-content">
            <strong>Scan stopped</strong>
            <p>The scan was stopped. Click "Scan Page" to start a new scan.</p>
          </div>
        </li>
      `;
    }
  } catch (error) {
    console.error("Error stopping scan:", error);
  }
}

function setLoading(loading) {
  isLoading = loading;
  isScanActive = loading; // Track scan state
  
  const loadingIndicator = document.getElementById('loadingIndicator');
  const rescanButton = document.getElementById('rescanButton');
  const stopButton = document.getElementById('stopButton');
  const buttonText = rescanButton.querySelector('.button-text');
  
  loadingIndicator.style.display = loading ? 'flex' : 'none';
  rescanButton.disabled = loading;
  
  // Show/hide the stop button based on loading state
  if (loading) {
    stopButton.classList.remove('hidden');
    rescanButton.classList.add('hidden');
    buttonText.textContent = 'Scanning...';
    document.getElementById('linksList').innerHTML = '';
    document.getElementById('noLinksFound').classList.add('hidden');
    document.getElementById('recommendations').classList.add('hidden');
    document.getElementById('totalLinks').textContent = '0';
    document.getElementById('phishingLinks').textContent = '0';
    document.getElementById('sslIssues').textContent = '0';
    document.getElementById('threatValue').textContent = 'Analyzing...';
    document.getElementById('progressBar').style.width = '0%';
  } else {
    stopButton.classList.add('hidden');
    rescanButton.classList.remove('hidden');
    buttonText.textContent = 'Scan Page';
  }
}

function showReadyToScan() {
  setLoading(false);
  const linksList = document.getElementById('linksList');
  linksList.innerHTML = `
    <li class="ready-message">
      <div class="ready-content">
        <strong>Ready to scan</strong>
        <p>Click "Scan Page" to analyze links on this page for phishing threats.</p>
      </div>
    </li>
  `;
  document.getElementById('threatValue').textContent = 'Not Scanned';
}

function updateUI(results) {
  setLoading(false);
  analysisResults = results || [];
  console.log(`Updating UI with ${analysisResults.length} results`);

  if (analysisResults.length === 0) {
    document.getElementById('noLinksFound').classList.remove('hidden');
    document.getElementById('threatValue').textContent = 'No Links Found';
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
  
  // Hide loading indicator and show results
  document.getElementById('noLinksFound').classList.add('hidden');
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