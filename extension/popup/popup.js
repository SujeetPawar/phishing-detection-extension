// Global variables
let analysisResults = [];
let isLoading = true;

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  chrome.runtime.sendMessage({action: "getResults"}, response => {
    if (response && response.results) {
      updateUI(response.results);
    } else {
      triggerScan();
    }
  });

  document.getElementById('rescanButton').addEventListener('click', triggerScan);
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
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = '0%';
    progressBar.style.backgroundColor = '#6c757d';
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

  const suspiciousResults = results.filter(item => 
    item.prediction === "Phishing" || !item.validSSL
  );

  const totalLinks = results.length;
  const phishingLinks = results.filter(item => item.prediction === "Phishing").length;
  const sslIssues = results.filter(item => !item.validSSL).length;

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

  if (suspiciousResults.length === 0) {
    const li = document.createElement('li');
    li.className = 'safe-link';
    li.textContent = 'No suspicious links found';
    linksList.appendChild(li);
    return;
  }

  suspiciousResults.forEach(item => {
    const li = document.createElement('li');
    li.className = item.prediction === "Phishing" ? 'phishing-link' : 'ssl-issue-link';
    li.innerHTML = `
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a>
      <span class="badge">${item.prediction}</span>
      ${!item.validSSL ? '<span class="badge ssl-issue">SSL Issue</span>' : ''}
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
    progressBar.style.backgroundColor = '#dc3545';
  } else if (threatLevel >= 40) {
    threatValue.textContent = 'Medium Risk';
    progressBar.style.backgroundColor = '#ffc107';
  } else {
    threatValue.textContent = 'Low Risk';
    progressBar.style.backgroundColor = '#28a745';
  }
}
