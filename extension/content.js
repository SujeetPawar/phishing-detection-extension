// Global variables
let lastScannedContent = "";
let scanInterval = null;

// Start scanning immediately
scanPage();

// Listen for commands from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScan") {
    scanPage();
  }
  return true;
});

// Improved URL extraction with better email handling
function extractAllLinks() {
  const links = new Set();
  const pageText = document.body.innerText;
  
  // Improved URL regex that handles most common URL formats
  const urlRegex = /(https?:\/\/|www\.)[^\s"'<>)\]}]+(?<!\.|,|;|\?|!)/g;
  const textUrls = pageText.match(urlRegex);
  if (textUrls) {
    textUrls.forEach(url => {
      // Ensure URL starts with http/https
      let cleanUrl = url.replace(/[.,;!?)]+$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      if (isValidUrl(cleanUrl)) {
        links.add(cleanUrl);
      }
    });
  }

  // Anchor tag extraction
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

  // Special handling for email clients
  detectEmailClientAndExtractLinks(links);

  return Array.from(links);
}

// Special handling for different email clients
function detectEmailClientAndExtractLinks(links) {
  // Check for Gmail
  if (document.querySelector('div[role="tabpanel"]')) {
    extractLinksFromGmail(links);
  }
  // Check for Outlook Web
  else if (document.querySelector('[aria-label="Message body"]')) {
    extractLinksFromOutlook(links);
  }
  // Check for Yahoo Mail
  else if (document.querySelector('#message-body')) {
    extractLinksFromYahoo(links);
  }
  // Generic email content fallback
  else {
    extractLinksFromGenericEmail(links);
  }
}

function extractLinksFromGmail(links) {
  try {
    // Gmail stores email content in specific divs
    const emailBodies = document.querySelectorAll('div[dir="ltr"]');
    emailBodies.forEach(body => {
      const text = body.innerText;
      extractUrlsFromText(text, links);
      
      // Also check links in anchor tags within the email
      body.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.href.trim();
        if (isValidUrl(href)) {
          links.add(href);
        }
      });
    });
  } catch (e) {
    console.log("Error extracting from Gmail:", e);
  }
}

function extractLinksFromOutlook(links) {
  try {
    const emailBody = document.querySelector('[aria-label="Message body"]');
    if (emailBody) {
      extractUrlsFromText(emailBody.innerText, links);
      emailBody.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.href.trim();
        if (isValidUrl(href)) {
          links.add(href);
        }
      });
    }
  } catch (e) {
    console.log("Error extracting from Outlook:", e);
  }
}

function extractLinksFromYahoo(links) {
  try {
    const emailBody = document.getElementById('message-body');
    if (emailBody) {
      extractUrlsFromText(emailBody.innerText, links);
      emailBody.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.href.trim();
        if (isValidUrl(href)) {
          links.add(href);
        }
      });
    }
  } catch (e) {
    console.log("Error extracting from Yahoo:", e);
  }
}

function extractLinksFromGenericEmail(links) {
  try {
    // Look for common email body selectors
    const potentialEmailBodies = document.querySelectorAll(
      'div.email-body, div.message-body, div.email-content, div.msg-body'
    );
    
    if (potentialEmailBodies.length > 0) {
      potentialEmailBodies.forEach(body => {
        extractUrlsFromText(body.innerText, links);
        body.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.href.trim();
          if (isValidUrl(href)) {
            links.add(href);
          }
        });
      });
    } else {
      // Fallback to checking the entire page
      extractUrlsFromText(document.body.innerText, links);
    }
  } catch (e) {
    console.log("Error in generic email extraction:", e);
  }
}

function extractUrlsFromText(text, links) {
  const urlRegex = /(https?:\/\/|www\.)[^\s"'<>)\]}]+(?<!\.|,|;|\?|!)/g;
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

// Simple string hashing function for detecting content changes
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Check if URL is valid
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// Main scanning function
function scanPage() {
  const links = extractAllLinks();
  
  if (links.length > 0) {
    // Send links to background script for analysis
    chrome.runtime.sendMessage({
      action: "analyzeLinks",
      links: links
    });
  } else {
    // No links found, send empty results
    chrome.runtime.sendMessage({
      action: "updateResults",
      results: []
    });
  }
}

// Set up a mutation observer to detect DOM changes
const observer = new MutationObserver(debounce(() => {
  scanPage();
}, 2000));

// Start observing the document with configured parameters
observer.observe(document.body, { 
  childList: true,
  subtree: true,
  characterData: true
});

// Debounce function to limit how often we scan
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