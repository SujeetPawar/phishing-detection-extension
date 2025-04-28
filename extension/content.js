let lastScannedContent = "";
let isScanning = false;

function isEmailClient() {
  return /mail\.google\.com|outlook\.office\.com|mail\.yahoo\.com/.test(window.location.href);
}

function extractAllLinks() {
  const links = new Set();
  
  // Regular links
  document.querySelectorAll('a[href]').forEach(anchor => {
    try {
      const href = anchor.href.trim();
      if (isValidUrl(href)) {
        links.add(href);
      }
    } catch (e) {
      console.log("Error processing anchor tag:", e);
    }
  });

  // Links in iframes
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      if (iframe.contentDocument) {
        iframe.contentDocument.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.href.trim();
          if (isValidUrl(href)) {
            links.add(href);
          }
        });
      }
    } catch (e) {
      console.log("Error processing iframe:", e);
    }
  });

  // Links in shadow DOM
  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.shadowRoot) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    node.shadowRoot?.querySelectorAll('a[href]').forEach(anchor => {
      const href = anchor.href.trim();
      if (isValidUrl(href)) {
        links.add(href);
      }
    });
  }

  // Extract from text
  extractUrlsFromText(document.body.innerText, links);
  
  return Array.from(links);
}

function extractUrlsFromText(text, links) {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s\"\'\<\>\)\]\}\,]+/gi;
  const urls = text.match(urlRegex);

  if (urls) {
    urls.forEach(url => {
      let cleanUrl = url.replace(/[.,;!?)]+$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      if (isValidUrl(cleanUrl)) {
        links.add(cleanUrl);
      }
    });
  }
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// Replace the scanPage function
function scanPage() {
  if (isScanning) return;
  isScanning = true;

  // Clear previous results
  lastScannedContent = "";
  
  // Extract links with timeout for complex pages
  setTimeout(() => {
    try {
      const links = extractAllLinks();
      if (links.length > 0) {
        chrome.runtime.sendMessage({ action: "analyzeLinks", links });
      } else {
        chrome.runtime.sendMessage({ action: "updateResults", results: [] });
      }
    } catch (e) {
      console.error("Scan error:", e);
    }
    isScanning = false;
  }, isEmailClient() ? 3000 : 500); // Shorter delay for regular pages
}

// Remove the automatic scan call and mutation observer
// Keep only the message listener:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScan") {
    scanPage();
  }
  return true;
});
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

const observer = new MutationObserver(debounce(() => {
  scanPage();
}, 2000));

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

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

// Initial scan
scanPage();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScan") {
    scanPage();
  }
  return true;
});