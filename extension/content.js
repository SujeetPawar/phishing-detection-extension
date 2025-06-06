// content.js - Enhanced Link Scanner
let isScanning = false;
let activeScanAbortController = null;
let mutationObserver = null;
let scanRequested = false;
let isInitialized = false;
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) console.log('[PhishDetect]', ...args);
}

function isExtensionContextValid() {
    try {
        return typeof chrome !== 'undefined' && chrome.runtime?.sendMessage;
    } catch (e) {
        debugLog("Context check error:", e);
        return false;
    }
}

function isEmailClient() {
    return /mail\.google\.com|outlook\.office\.com|mail\.yahoo\.com/.test(window.location.hostname);
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function extractAllLinks() {
    debugLog("Starting link extraction");
    
    if (activeScanAbortController) {
        activeScanAbortController.abort();
    }
    
    const controller = new AbortController();
    activeScanAbortController = controller;
    const { signal } = controller;

    try {
        const links = new Set();
        
        // Extract from visible content
        extractFromDocument(document, links, signal);
        
        // Extract from iframes
        extractFromIframes(document, links, signal);
        
        // Extract from shadow DOM
        extractFromShadowDOM(document.body, links, 3, signal);
        
        // Extract from text content
        extractFromText(document.body.innerText, links);
        
        debugLog(`Found ${links.size} total links`);
        return Array.from(links);
    } catch (e) {
        debugLog("Extraction error:", e);
        return [];
    }
}

function extractFromDocument(doc, links, signal) {
    if (signal.aborted) return;
    
    try {
        const anchors = doc.querySelectorAll('a[href]');
        anchors.forEach(anchor => {
            if (signal.aborted) return;
            try {
                const href = anchor.href.trim();
                if (href && isValidUrl(href)) {
                    links.add(href);
                }
            } catch (e) {
                debugLog("Anchor error:", e);
            }
        });
    } catch (e) {
        debugLog("Document extraction error:", e);
    }
}

function extractFromIframes(doc, links, signal) {
    if (signal.aborted) return;
    
    try {
        const iframes = doc.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (signal.aborted) return;
            try {
                if (iframe.contentDocument) {
                    extractFromDocument(iframe.contentDocument, links, signal);
                }
            } catch (e) {
                debugLog("Iframe error:", e);
            }
        });
    } catch (e) {
        debugLog("Iframe extraction error:", e);
    }
}

function extractFromShadowDOM(root, links, maxDepth, signal, depth = 0) {
    if (signal.aborted || depth > maxDepth) return;
    
    try {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            { acceptNode: node => 
                node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP 
            }
        );

        while (walker.nextNode() && !signal.aborted) {
            const node = walker.currentNode;
            try {
                extractFromDocument(node.shadowRoot, links, signal);
                extractFromShadowDOM(node.shadowRoot, links, maxDepth, signal, depth + 1);
            } catch (e) {
                debugLog("Shadow DOM error:", e);
            }
        }
    } catch (e) {
        debugLog("Shadow DOM walker error:", e);
    }
}

function extractFromText(text, links) {
    try {
        const urlRegex = /https?:\/\/[^\s"'\<\>\)\]]+/gi;
        const matches = text.match(urlRegex) || [];
        
        matches.forEach(url => {
            try {
                const cleanUrl = url.replace(/[.,;!?)]+$/, '');
                if (isValidUrl(cleanUrl)) {
                    links.add(cleanUrl);
                }
            } catch (e) {
                debugLog("Text URL error:", e);
            }
        });
    } catch (e) {
        debugLog("Text extraction error:", e);
    }
}

async function scanPage() {
    if (isScanning || !isExtensionContextValid() || !scanRequested) {
        debugLog("Scan conditions not met:", { isScanning, extensionValid: isExtensionContextValid(), scanRequested });
        return;
    }
    
    isScanning = true;
    debugLog("Starting SINGLE page scan for:", window.location.href);
    
    try {
        const links = extractAllLinks();
        debugLog(`Extracted ${links.length} links`);
        
        if (links.length > 0) {
            await chrome.runtime.sendMessage({ 
                action: "analyzeLinks", 
                links: links,
                tabUrl: window.location.href
            });
        } else {
            await chrome.runtime.sendMessage({ 
                action: "updateResults", 
                results: [],
                tabUrl: window.location.href
            });
        }
    } catch (e) {
        debugLog("Scan error:", e);
    } finally {
        isScanning = false;
        // Reset scan request after completing scan
        scanRequested = false;
        debugLog("Scan completed, resetting scanRequested flag");
    }
}

function stopScanning() {
    debugLog("Stopping scan");
    scanRequested = false;
    isScanning = false;
    
    if (activeScanAbortController) {
        activeScanAbortController.abort();
        activeScanAbortController = null;
    }
    
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
}

// Initialize content script
function initialize() {
    if (!isExtensionContextValid() || isInitialized) return;
    
    isInitialized = true;
    debugLog("Content script initialized for:", window.location.href);
    // Don't start automatic scanning - wait for explicit request
    // Don't set up any observers or automatic triggers
    
    // Send a notification that the content script has been loaded, for debugging only
    // This will NOT trigger any scanning
    try {
        chrome.runtime.sendMessage({
            action: "contentScriptLoaded",
            url: window.location.href
        }).catch(e => debugLog("Failed to send load notification:", e));
    } catch (e) {
        debugLog("Failed to send load notification:", e);
    }
}

// Handle messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog("Received message:", message);
    
    switch (message.action) {
        case "ping":
            sendResponse({ success: true, url: window.location.href });
            return true;
            
        case "startScan":
            debugLog("Received startScan command");
            scanRequested = true;
            
            // Perform a single scan only - no mutation observer
            scanPage().then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                debugLog("Scan error:", error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case "stopScan":
            stopScanning();
            sendResponse({ success: true });
            return true;
            
        default:
            sendResponse({ success: false, error: "Unknown action" });
            return true;
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    debugLog("Page unloading, cleaning up");
    stopScanning();
    isInitialized = false;
});

// Initialize - but only when explicitly called
console.log('[PhishDetect] Content script loaded, waiting for explicit commands');
initialize();
