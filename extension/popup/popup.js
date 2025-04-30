let analysisResults = [];
let isLoading = false;
let isBackendConnected = false;
let activeTabId = null;

document.addEventListener('DOMContentLoaded', async function() {
  // Initialize UI
  setLoading(true);
  document.getElementById('noLinksFound').classList.add('hidden');
  
  // Set up scan button
  document.getElementById('rescanButton').addEventListener('click', triggerScan);
  
  // Get active tab
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab) {
    activeTabId = tab.id;
    
    // Check backend connection
    isBackendConnected = await checkBackendConnection();
    if (!isBackendConnected) {
      showConnectionError();
      return;
    }
    
    // Initial scan
    triggerScan();
  } else {
    showNoActiveTabError();
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateResults") {
    updateUI(message.results);
  }
});

async function triggerScan() {
  if (isLoading || !activeTabId) return;
  
  setLoading(true);
  console.log("Starting scan for tab:", activeTabId);
  
  try {
    // First try to initialize the content script
    console.log("Initializing content script...");
    await chrome.scripting.executeScript({
      target: {tabId: activeTabId},
      files: ['content.js']
    });
    
    // Then send the scan command
    console.log("Sending scan command...");
    const response = await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
    
    if (!response?.success) {
      throw new Error(response?.error || "Scan failed without error message");
    }
  } catch (error) {
    console.error("Scan error:", error);
    showScanError(error.message);
    
    // Try to re-inject and scan again if failed
    try {
      console.log("Retrying scan...");
      await chrome.scripting.executeScript({
        target: {tabId: activeTabId},
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(activeTabId, {action: "startScan"});
    } catch (retryError) {
      console.error("Retry failed:", retryError);
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
  
  loadingIndicator.style.display = loading ? 'block' : 'none';
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

  progressBar.style.width = `${threatLevel}%`;

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
    li.textContent = 'No links found';
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