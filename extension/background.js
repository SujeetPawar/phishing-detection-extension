// Configuration
const API_URL = "http://localhost:5000";
const BATCH_SIZE = 10; // Process URLs in batches to avoid overloading

// Store for recent results
let currentResults = [];
let processingQueue = [];
let isProcessing = false;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeLinks") {
    const links = message.links;
    
    if (!links || links.length === 0) {
      // No links to analyze
      currentResults = [];
      notifyPopup([]);
      return true;
    }
    
    // Filter out duplicates
    const uniqueLinks = [...new Set(links)];
    
    // Batch the links and analyze them
    processingQueue = [...uniqueLinks];
    currentResults = [];
    
    if (!isProcessing) {
      processNextBatch();
    }
    
    return true;
  }
  
  if (message.action === "getResults") {
    sendResponse({results: currentResults});
    return true;
  }
});

// Process links in batches
async function processNextBatch() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }
  
  isProcessing = true;
  
  // Take next batch of URLs
  const batch = processingQueue.splice(0, BATCH_SIZE);
  
  try {
    // Send batch to server for analysis
    const response = await fetch(`${API_URL}/analyze-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ urls: batch })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results) {
      // Add results to the current set
      currentResults = [...currentResults, ...data.results];
      
      // Notify popup about new results
      notifyPopup(currentResults);
    }
  } catch (error) {
    console.error("Error analyzing URLs:", error);
    
    // Fall back to client-side analysis for this batch
    const fallbackResults = await analyzeBatchLocally(batch);
    currentResults = [...currentResults, ...fallbackResults];
    notifyPopup(currentResults);
  }
  
  // Process next batch if queue is not empty
  if (processingQueue.length > 0) {
    setTimeout(processNextBatch, 100); // Small delay to avoid overwhelming the server
  } else {
    isProcessing = false;
  }
}

// Notify popup about updated results
function notifyPopup(results) {
  chrome.runtime.sendMessage({
    action: "updateResults",
    results: results
  });
}

// Fallback local analysis if server is unreachable
async function analyzeBatchLocally(urls) {
  const results = [];
  
  for (const url of urls) {
    try {
      // Basic URL analysis
      const isHttps = url.startsWith("https://");
      const hasSuspiciousWords = /login|verify|secure|account|password|bank|update|confirm/i.test(url);
      const hasLongSubdomain = url.split("//")[1]?.split("/")[0]?.split(".").length > 3;
      const hasSpecialChars = /[@%_]/i.test(url);
      
      // Calculate simple risk score
      let riskScore = 0;
      if (!isHttps) riskScore += 30;
      if (hasSuspiciousWords) riskScore += 20;
      if (hasLongSubdomain) riskScore += 15;
      if (hasSpecialChars) riskScore += 15;
      
      results.push({
        url: url,
        prediction: riskScore >= 30 ? "Phishing" : "Legitimate",
        validSSL: isHttps
      });
    } catch (e) {
      results.push({
        url: url,
        prediction: "Unknown",
        validSSL: false
      });
    }
  }
  
  return results;
}