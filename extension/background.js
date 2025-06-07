const API_URL = "http://localhost:8000";
const BATCH_SIZE = 5;
let currentResults = [];
let processingQueue = [];
let isProcessing = false;
let activeTabId = null;
let sessionId = null;
let shouldStop = false;

// Connection check - ONLY called when explicitly requested by popup
async function checkBackendConnection() {
    console.log('Explicit connection check requested by popup');
    try {
        // Use a HEAD request to minimize backend impact
        const response = await fetch(`${API_URL}`, {
            method: 'HEAD'
        });
        const isConnected = response.ok;
        console.log(`Backend connection check result: ${isConnected}`);
        return isConnected;
    } catch (error) {
        console.error('Backend connection check failed:', error);
        return false;
    }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    switch (message.action) {
        case "contentScriptLoaded":
            // Just acknowledge receipt, don't trigger any backend calls
            console.log(`Content script loaded in: ${message.url}`);
            sendResponse({ success: true });
            return true;
            
        case "analyzeLinks":
            // Add sender tab info to message
            message.tabId = sender.tab?.id;
            handleAnalyzeLinks(message, sendResponse);
            return true;
            
        case "getResults":
            sendResponse({ results: currentResults });
            return true;
            
        case "checkConnection":
            checkBackendConnection().then(connected => {
                sendResponse({ connected });
            });
            return true;
            
        case "stopProcessing":
            stopProcessing();
            sendResponse({ success: true });
            return true;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
            return true;
    }
});

// Listen for tab updates to stop processing if tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && (changeInfo.status === 'loading' || changeInfo.url)) {
        console.log('Active tab is navigating or URL changed, stopping processing');
        stopProcessing();
    }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId) {
        console.log('Active tab was closed, stopping processing');
        stopProcessing();
    }
});

async function handleAnalyzeLinks(message, sendResponse) {
    const { links, tabUrl } = message;
    console.log(`NEW SCAN REQUEST: Analyzing ${links.length} links from ${tabUrl}`);
    
    // Create new session ID for this scan
    sessionId = Date.now().toString();
    console.log(`Starting new session: ${sessionId}`);
    
    // Store the active tab ID for this scan session
    if (message.tabId) {
        activeTabId = message.tabId;
    }
    
    // Stop any existing processing immediately
    stopProcessing();
    
    if (!links?.length) {
        currentResults = [];
        notifyPopup([]);
        sendResponse({ success: true });
        return;
    }

    try {
        // Set up new processing queue for this session
        processingQueue = [...new Set(links)];
        currentResults = [];
        shouldStop = false;
        
        console.log(`Queue set up with ${processingQueue.length} unique links`);
        
        // Start processing
        processNextBatch(sessionId);
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Analysis error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function processNextBatch(currentSessionId) {
    // Check if this session is still valid
    if (currentSessionId !== sessionId) {
        console.log(`Session ${currentSessionId} is stale, stopping`);
        return;
    }
    
    // Check if we should continue processing
    if (processingQueue.length === 0 || shouldStop || isProcessing) {
        isProcessing = false;
        console.log('Processing completed or stopped:', { queueLength: processingQueue.length, shouldStop, isProcessing });
        return;
    }

    isProcessing = true;
    const batch = processingQueue.splice(0, BATCH_SIZE);
    console.log(`Session ${currentSessionId}: Processing batch of ${batch.length} URLs. Queue remaining: ${processingQueue.length}`);

    try {
        const [sslResults, predictionResults] = await Promise.all([
            checkSSLForBatch(batch),
            predictBatch(batch)
        ]);

        // Check again if session is still valid after async operations
        if (currentSessionId !== sessionId || shouldStop) {
            console.log(`Session ${currentSessionId} became stale during processing`);
            isProcessing = false;
            return;
        }

        const batchResults = batch.map((url, i) => ({
            url,
            prediction: predictionResults[i]?.prediction || 'Unknown',
            validSSL: sslResults[i]?.validSSL || false
        }));

        currentResults = [...currentResults, ...batchResults];
        
        // Only notify if session is still valid
        if (currentSessionId === sessionId && !shouldStop) {
            notifyPopup(currentResults);
        }
        
        // Continue processing if there are more items and session is still valid
        if (processingQueue.length > 0 && !shouldStop && currentSessionId === sessionId) {
            isProcessing = false;
            setTimeout(() => processNextBatch(currentSessionId), 300);
        } else {
            isProcessing = false;
            console.log(`Session ${currentSessionId}: Batch processing completed`);
        }
    } catch (error) {
        console.error("Batch processing error:", error);
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

async function predictBatch(urls) {
    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls })
        });
        return response.ok ? (await response.json()).results : urls.map(() => ({ prediction: "Unknown" }));
    } catch {
        return urls.map(() => ({ prediction: "Unknown" }));
    }
}

function notifyPopup(results) {
    // Only notify if we have a valid extension context and should continue
    if (shouldStop) {
        console.log('Not notifying popup - processing stopped');
        return;
    }
    
    try {
        chrome.runtime.sendMessage({
            action: "updateResults",
            results: results || []
        }).catch(error => {
            // Popup might be closed, stop processing
            if (error.message?.includes('Receiving end does not exist')) {
                console.log('Popup closed, stopping processing');
                stopProcessing();
            } else {
                console.error('Message sending error:', error);
            }
        });
    } catch (error) {
        console.error('Runtime messaging error:', error);
        stopProcessing();
    }
}

function stopProcessing() {
    console.log('STOPPING ALL PROCESSING');
    shouldStop = true;
    isProcessing = false;
    processingQueue = [];
    // Don't clear currentResults here - let them persist
    sessionId = null;
    activeTabId = null;
}

// Initialize
console.log('Background script initialized');
// Don't automatically check backend connection on startup
// checkBackendConnection();

// Reset state on startup
stopProcessing();
