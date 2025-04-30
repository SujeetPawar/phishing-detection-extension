const API_URL = "http://localhost:5000";
const BATCH_SIZE = 5; // Reduced batch size for better performance

let currentResults = [];
let processingQueue = [];
let isProcessing = false;

// Connection state management
let isBackendConnected = false;

// Check backend connection on startup
checkBackendConnection();

async function checkBackendConnection() {
  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://example.com'] }) 
    });
    isBackendConnected = response.ok;
  } catch (error) {
    isBackendConnected = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "analyzeLinks":
      handleAnalyzeLinks(message.links, sendResponse);
      return true;
      
    case "getResults":
      sendResponse({ results: currentResults });
      return true;
      
    case "checkConnection":
      sendResponse({ connected: isBackendConnected });
      return true;
      
    default:
      return false;
  }
});

// In background.js, update the handleAnalyzeLinks function:
async function handleAnalyzeLinks(message, sendResponse) {
  console.log("Received analyzeLinks message for tab:", message.tabId);
  if (!isBackendConnected) {
    sendResponse({ success: false, error: "Backend not connected" });
    return;
  }

  const { links, pageType } = message;
  
  if (!links || links.length === 0) {
    currentResults = [];
    notifyPopup([]);
    sendResponse({ 
      success: true, 
      message: `No links found in ${pageType}` 
    });
    return;
  }

  try {
    const uniqueLinks = [...new Set(links)];
    processingQueue = [...uniqueLinks];
    currentResults = [];
    
    if (!isProcessing) {
      await processNextBatch();
    }
    sendResponse({ 
      success: true, 
      message: `Analysis started for ${links.length} links from ${pageType}`
    });
  } catch (error) {
    console.error("Analysis error:", error);
    sendResponse({ 
      success: false, 
      error: error.message,
      pageType
    });
  }
}
async function processNextBatch() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    notifyPopup(currentResults);
    return;
  }

  isProcessing = true;
  const batch = processingQueue.splice(0, BATCH_SIZE);

  try {
    const [sslResults, predictionResults] = await Promise.all([
      checkSSLForBatch(batch),
      predictBatch(batch)
    ]);

    const batchResults = batch.map((url, index) => ({
      url,
      prediction: predictionResults[index].prediction,
      validSSL: sslResults[index].validSSL
    }));

    currentResults = [...currentResults, ...batchResults];
    notifyPopup(currentResults);
    
    // Process next batch with slight delay
    setTimeout(processNextBatch, 300);
  } catch (error) {
    console.error("Batch processing error:", error);
  } finally {
    isProcessing = false;
  }
}

async function checkSSLForBatch(urls) {
  try {
    const response = await fetch(`${API_URL}/analyze-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls })
    });
    return response.ok ? (await response.json()).results : urls.map(() => ({ validSSL: false }));
  } catch {
    return urls.map(() => ({ validSSL: false }));
  }
}

// In background.js, modify predictBatch() to log requests:
async function predictBatch(urls) {
  console.log("Predicting batch of URLs:", urls);
  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urls }) // Changed from {urls} to {urls: urls}
    });
    
    if (!response.ok) {
      console.error("Prediction failed with status:", response.status);
      return urls.map(() => ({ prediction: "Unknown" }));
    }
    
    const result = await response.json();
    console.log("Prediction results:", result);
    return result.results;
  } catch (error) {
    console.error("Prediction error:", error);
    return urls.map(() => ({ prediction: "Unknown" }));
  }
}

function notifyPopup(results) {
  chrome.runtime.sendMessage({
    action: "updateResults",
    results: results || [],
    scanComplete: !isProcessing
  }).catch(error => console.error("Error notifying popup:", error));
}

// Add this to your background.js
function handleExtensionUpdate() {
  // Notify all tabs about context invalidation
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, 'extension_context_invalidated')
          .catch(e => console.log('Could not notify tab', tab.id, e));
      } catch (e) {
        console.log('Error sending invalidation message', e);
      }
    });
  });
}

// Listen for extension updates
chrome.runtime.onInstalled.addListener(handleExtensionUpdate);
chrome.runtime.onUpdateAvailable.addListener(handleExtensionUpdate);
chrome.runtime.onSuspend.addListener(handleExtensionUpdate);