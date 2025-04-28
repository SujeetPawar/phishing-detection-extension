const API_URL = "http://localhost:5000";
const BATCH_SIZE = 10;

let currentResults = [];
let processingQueue = [];
let isProcessing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeLinks") {
    const links = message.links;

    if (!links || links.length === 0) {
      currentResults = [];
      notifyPopup([]);
      return true;
    }

    const uniqueLinks = [...new Set(links)];
    processingQueue = [...uniqueLinks];
    currentResults = [];

    if (!isProcessing) {
      processNextBatch();
    }

    return true;
  }

  if (message.action === "getResults") {
    sendResponse({ results: currentResults });
    return true;
  }
});

// Update the processNextBatch function
async function processNextBatch() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    notifyPopup(currentResults); // Final update
    return;
  }

  isProcessing = true;
  const batch = processingQueue.splice(0, Math.min(5, processingQueue.length)); // Smaller batches

  try {
    // Process SSL checks in parallel
    const sslPromises = batch.map(url => checkSSLForUrl(url));
    const sslResults = await Promise.all(sslPromises);

    // Process predictions in parallel
    const predictPromises = batch.map((url, i) => 
      predictUrl(url, sslResults[i])
    );
    const batchResults = await Promise.all(predictPromises);

    currentResults = [...currentResults, ...batchResults];
    notifyPopup(currentResults);
    
    // Process next batch with slight delay
    setTimeout(processNextBatch, 300);
  } catch (error) {
    console.error("Batch processing error:", error);
    isProcessing = false;
  }
}

async function checkSSLForUrl(url) {
  try {
    const response = await fetch(`${API_URL}/analyze-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url] })
    });
    return response.ok ? (await response.json()).results[0] : { validSSL: false };
  } catch {
    return { validSSL: false };
  }
}

async function predictUrl(url, sslResult) {
  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    
    const prediction = response.ok 
      ? (await response.json()).prediction 
      : "Unknown";
      
    return {
      url,
      prediction,
      validSSL: sslResult ? sslResult.validSSL : false
    };
  } catch {
    return {
      url,
      prediction: "Unknown",
      validSSL: false
    };
  }
}