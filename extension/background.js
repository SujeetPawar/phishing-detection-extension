const API_URL = "http://localhost:5000";
const BATCH_SIZE = 5;
let currentResults = [];
let processingQueue = [];
let isProcessing = false;

// Connection check
async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: ['https://example.com'] })
        });
        return response.ok;
    } catch {
        return false;
    }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "analyzeLinks":
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
    }
});

async function handleAnalyzeLinks(message, sendResponse) {
    const { links, tabUrl } = message;
    console.log(`Analyzing ${links.length} links from ${tabUrl}`);
    
    if (!links?.length) {
        currentResults = [];
        notifyPopup([]);
        sendResponse({ success: true });
        return;
    }

    try {
        processingQueue = [...new Set(links)];
        currentResults = [];
        
        if (!isProcessing) {
            await processNextBatch();
        }
        
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
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

        const batchResults = batch.map((url, i) => ({
            url,
            prediction: predictionResults[i].prediction,
            validSSL: sslResults[i].validSSL
        }));

        currentResults = [...currentResults, ...batchResults];
        notifyPopup(currentResults);
        
        setTimeout(processNextBatch, 300);
    } catch (error) {
        console.error("Batch error:", error);
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
    chrome.runtime.sendMessage({
        action: "updateResults",
        results: results || []
    }).catch(console.error);
}

// Initialize
checkBackendConnection();