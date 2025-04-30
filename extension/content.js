// content.js - Enhanced Phishing Detection Link Scanner
let isScanning = false;
let extensionContextValid = true;
let activeScanAbortController = null;

// Debug state
const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log('[PhishDetect]', ...args);
}

// Check if extension context is still valid
function isExtensionContextValid() {
    try {
        const valid = typeof chrome !== 'undefined' && 
                     typeof chrome.runtime !== 'undefined' && 
                     typeof chrome.runtime.sendMessage !== 'undefined';
        if (!valid) debugLog("Extension context invalid");
        return valid;
    } catch (e) {
        debugLog("Context check error:", e);
        return false;
    }
}

function isEmailClient() {
    const isEmail = /mail\.google\.com|outlook\.office\.com|mail\.yahoo\.com/.test(window.location.hostname);
    debugLog("Is email client:", isEmail);
    return isEmail;
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        const valid = url.protocol === "http:" || url.protocol === "https:";
        if (!valid) debugLog("Invalid URL protocol:", string);
        return valid;
    } catch (_) {
        debugLog("Malformed URL:", string);
        return false;
    }
}

function extractAllLinks() {
    debugLog("Starting link extraction");
    
    if (activeScanAbortController) {
        debugLog("Aborting previous scan");
        activeScanAbortController.abort();
    }
    
    const controller = new AbortController();
    activeScanAbortController = controller;
    const { signal } = controller;

    try {
        const links = new Set();
        
        // First pass - quick extraction of visible links
        debugLog("Extracting visible links");
        extractVisibleLinks(links, signal);
        debugLog(`Found ${links.size} links after first pass`);
        
        // Second pass - deeper inspection if needed
        if (links.size < 5) {
            debugLog("Extracting deeper links");
            extractDeeperLinks(links, signal);
            debugLog(`Found ${links.size} links after deep extraction`);
        }
        
        // Always check text content
        debugLog("Extracting from text content");
        extractUrlsFromText(document.body.innerText, links);
        debugLog(`Total unique links found: ${links.size}`);

        return Array.from(links);
    } catch (e) {
        if (e.name !== 'AbortError') {
            debugLog("Link extraction error:", e);
        }
        return [];
    } finally {
        if (activeScanAbortController === controller) {
            activeScanAbortController = null;
        }
    }
}

function extractVisibleLinks(links, signal) {
    if (signal.aborted) return;
    
    try {
        const anchors = document.querySelectorAll('a[href]');
        debugLog(`Found ${anchors.length} anchor elements`);
        
        anchors.forEach(anchor => {
            if (signal.aborted) return;
            try {
                const href = anchor.href.trim();
                if (href && isValidUrl(href)) {
                    links.add(href);
                    debugLog("Added link:", href);
                }
            } catch (e) {
                debugLog("Error processing anchor:", e, anchor);
            }
        });
    } catch (e) {
        debugLog("Visible link extraction error:", e);
    }
}

function extractDeeperLinks(links, signal) {
    if (signal.aborted) return;
    
    try {
        // Check iframes
        const iframes = document.querySelectorAll('iframe, frame');
        debugLog(`Found ${iframes.length} iframes`);
        
        iframes.forEach(iframe => {
            if (signal.aborted) return;
            try {
                if (iframe.contentDocument) {
                    const iframeAnchors = iframe.contentDocument.querySelectorAll('a[href]');
                    iframeAnchors.forEach(anchor => {
                        const href = anchor.href.trim();
                        if (href && isValidUrl(href)) {
                            links.add(href);
                            debugLog("Added iframe link:", href);
                        }
                    });
                }
            } catch (e) {
                debugLog("Iframe processing error:", e);
            }
        });

        // Check shadow DOM
        extractShadowDomLinks(document.body, links, 3, signal);
    } catch (e) {
        debugLog("Deep link extraction error:", e);
    }
}

function extractShadowDomLinks(root, links, maxDepth, signal, currentDepth = 0) {
    if (signal.aborted || currentDepth > maxDepth) return;
    
    try {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            }
        );

        while (walker.nextNode() && !signal.aborted) {
            const node = walker.currentNode;
            try {
                const shadowAnchors = node.shadowRoot.querySelectorAll('a[href]');
                shadowAnchors.forEach(anchor => {
                    const href = anchor.href.trim();
                    if (href && isValidUrl(href)) {
                        links.add(href);
                        debugLog("Added shadow DOM link:", href);
                    }
                });
                
                // Recursively check nested shadow DOMs
                extractShadowDomLinks(node.shadowRoot, links, maxDepth, signal, currentDepth + 1);
            } catch (e) {
                debugLog("Shadow DOM processing error:", e);
            }
        }
    } catch (e) {
        debugLog("Shadow DOM walker error:", e);
    }
}

function extractUrlsFromText(text, links) {
    try {
        const urlRegex = /(?:https?:\/\/|www\.)[^\s\"\'\<\>\)\]\}\,]+/gi;
        const matches = text.match(urlRegex) || [];
        debugLog(`Found ${matches.length} text matches`);

        matches.forEach(url => {
            try {
                let cleanUrl = url.replace(/[.,;!?)]+$/, '');
                if (!cleanUrl.startsWith('http')) {
                    cleanUrl = 'https://' + cleanUrl;
                }
                if (isValidUrl(cleanUrl)) {
                    links.add(cleanUrl);
                    debugLog("Added text URL:", cleanUrl);
                }
            } catch (e) {
                debugLog("Text URL processing error:", e, url);
            }
        });
    } catch (e) {
        debugLog("Text extraction error:", e);
    }
}

function extractLinksFromEmail(links) {
    try {
        let emailContent = null;
        
        if (window.location.hostname === 'mail.google.com') {
            emailContent = document.querySelector('.ii.gt') || 
                          document.querySelector('.a3s.aiL') ||
                          document.querySelector('.message-content');
        } 
        else if (window.location.hostname.includes('outlook.office.com')) {
            emailContent = document.querySelector('#x_readableArea') ||
                          document.querySelector('.email-body');
        }
        else if (window.location.hostname.includes('mail.yahoo.com')) {
            emailContent = document.querySelector('.email-body') ||
                          document.querySelector('.msg-body');
        }
        
        if (emailContent) {
            debugLog("Extracting email links");
            const anchors = emailContent.querySelectorAll('a[href]');
            anchors.forEach(anchor => {
                const href = anchor.href.trim();
                if (href && isValidUrl(href)) {
                    links.add(href);
                    debugLog("Added email link:", href);
                }
            });

            extractUrlsFromText(emailContent.innerText, links);
        }
    } catch (e) {
        debugLog("Email extraction error:", e);
    }
}

async function scanPage() {
    if (isScanning || !isExtensionContextValid()) {
        debugLog('Scanning skipped - context invalid or already scanning');
        return;
    }
    
    isScanning = true;
    debugLog('Starting page scan');
    
    try {
        const links = isEmailClient() ? extractLinksFromEmail(new Set()) : extractAllLinks();
        debugLog("Extracted links:", links);
        
        if (!isExtensionContextValid()) {
            throw new Error('Extension context became invalid during scan');
        }
        
        if (links.length > 0) {
            debugLog("Sending links for analysis");
            await chrome.runtime.sendMessage({ 
                action: "analyzeLinks", 
                links: links,
                pageType: isEmailClient() ? "email" : "webpage",
                tabUrl: window.location.href
            });
        } else {
            debugLog("No links found");
            await chrome.runtime.sendMessage({ 
                action: "updateResults", 
                results: [],
                message: "No links found on this page",
                tabUrl: window.location.href
            });
        }
    } catch (e) {
        debugLog("Scan error:", e);
        if (isExtensionContextValid()) {
            await chrome.runtime.sendMessage({ 
                action: "scanError", 
                error: e.message,
                tabUrl: window.location.href
            });
        }
    } finally {
        isScanning = false;
        debugLog('Scan completed');
    }
}

const observer = new MutationObserver(debounce((mutations) => {
    if (!isScanning && isExtensionContextValid()) {
        const shouldScan = mutations.some(mutation => 
            mutation.type === 'childList' || 
            mutation.type === 'attributes'
        );
        
        if (shouldScan) {
            debugLog('DOM mutation detected, rescanning');
            scanPage();
        }
    }
}, 1000));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionContextValid()) {
        sendResponse({ success: false, error: "Extension context invalidated" });
        return false;
    }

    if (message.action === "startScan") {
        debugLog("Received scan command");
        scanPage().then(() => sendResponse({ success: true }))
                 .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (message.action === "ping") {
        debugLog("Received ping");
        sendResponse({ success: true, tabUrl: window.location.href });
        return true;
    }
    
    return true;
});

function initializeContentScript() {
    debugLog("Initializing content script");
    
    if (!isExtensionContextValid()) {
        debugLog("Extension context invalid on initialization");
        return;
    }

    try {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['href']
        });
        
        debugLog("Mutation observer registered");
        
        // Delay initial scan to allow page to load
        setTimeout(() => {
            debugLog("Running initial scan");
            scanPage();
        }, 1500);
    } catch (e) {
        debugLog("Initialization error:", e);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when injected
initializeContentScript();

// Listen for initialization from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "initialize") {
        initializeContentScript();
        sendResponse({ success: true });
        return true;
    }
    return false;
});

debugLog("Content script loaded for:", window.location.href);