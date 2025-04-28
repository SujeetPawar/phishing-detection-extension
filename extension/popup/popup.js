// Global variables
let analysisResults = [];
let isLoading = true;

// Initialize popup
// Replace the DOMContentLoaded listener in popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Show initial state
  setLoading(false);
  document.getElementById('noLinksFound').classList.remove('hidden');
  
  // Set up scan button
  document.getElementById('rescanButton').addEventListener('click', function() {
    setLoading(true);
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "startScan"});
      }
    });
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateResults") {
    updateUI(message.results);
  }
});

// Trigger new scan
function triggerScan() {
  setLoading(true);
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "startScan"});
    }
  });
}

// Set loading state
function setLoading(loading) {
  isLoading = loading;
  document.getElementById('loadingIndicator').style.display = loading ? 'block' : 'none';

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

// Update UI
function updateUI(results) {
  setLoading(false);
  analysisResults = results;

  if (!results || results.length === 0) {
    document.getElementById('noLinksFound').classList.remove('hidden');
    return;
  }

  const totalLinks = results.length;
  const phishingLinks = results.filter(r => r.prediction === "Phishing").length;
  const sslIssues = results.filter(r => !r.validSSL).length;

  document.getElementById('totalLinks').textContent = totalLinks;
  document.getElementById('phishingLinks').textContent = phishingLinks;
  document.getElementById('sslIssues').textContent = sslIssues;

  let threatLevel = 0;
  if (totalLinks > 0) {
    threatLevel = ((phishingLinks / totalLinks) * 70) + ((sslIssues / totalLinks) * 30);
  }

  updateThreatUI(threatLevel);

  if (phishingLinks > 0 || sslIssues > 0) {
    document.getElementById('recommendations').classList.remove('hidden');
  }

  const linksList = document.getElementById('linksList');
  linksList.innerHTML = '';

  if (totalLinks === 0) {
    const li = document.createElement('li');
    li.className = 'safe-link';
    li.textContent = 'No suspicious links found';
    linksList.appendChild(li);
    return;
  }

  results.forEach(item => {
    const li = document.createElement('li');

    if (item.prediction === "Phishing") {
      li.className = 'phishing-link';
    } else if (!item.validSSL) {
      li.className = 'ssl-issue-link';
    } else {
      li.className = 'safe-link';
    }

    li.innerHTML = `
      <div class="link-url">
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a>
      </div>
      <div class="link-status">
        ${item.prediction === "Phishing" ? '<span class="badge">Phishing</span>' : ''}
        ${!item.validSSL ? '<span class="badge ssl-issue">SSL Issue</span>' : ''}
      </div>
    `;
    linksList.appendChild(li);
  });
}

// Update Threat Level UI
function updateThreatUI(threatLevel) {
  const threatValue = document.getElementById('threatValue');
  const progressBar = document.getElementById('progressBar');

  progressBar.style.width = `${threatLevel}%`;

  if (threatLevel >= 70) {
    threatValue.textContent = 'High Risk';
    progressBar.style.backgroundColor = '#dc3545'; // red
  } else if (threatLevel >= 40) {
    threatValue.textContent = 'Moderate Risk';
    progressBar.style.backgroundColor = '#ffc107'; // yellow
  } else {
    threatValue.textContent = 'Low Risk';
    progressBar.style.backgroundColor = '#28a745'; // green
  }
}