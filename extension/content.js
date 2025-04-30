// content.js - Enhanced Link Scanner
let isScanning = false;
let activeScanAbortController = null;
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
    if (isScanning || !isExtensionContextValid()) return;
    
    isScanning = true;
    debugLog("Starting page scan");
    
    try {
        const links = extractAllLinks();
        debugLog("Extracted links:", links);
        
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
    }
}

// Initialize content script
function initialize() {
    if (!isExtensionContextValid()) return;
    
    debugLog("Content script initialized for:", window.location.href);
    
    // Scan when DOM changes
    const observer = new MutationObserver(() => {
        if (!isScanning) scanPage();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href']
    });
    
    // Initial scan
    setTimeout(scanPage, 1000);
}

// Handle messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startScan") {
        scanPage().then(() => sendResponse({ success: true }));
        return true;
    }
});

// Initialize
initialize();