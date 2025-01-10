function getLinks() {
  // Select all anchor elements and map their href attributes
  const links = Array.from(document.querySelectorAll('a')).map(link => link.href);
  console.log('Collected links:', links); // Debugging output
  return links;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLinks') {
    const links = getLinks();
    sendResponse({ links: links });
  }
});
