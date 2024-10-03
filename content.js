function getLinks() {
  const links = Array.from(document.querySelectorAll('a')).map(link => link.href);
  // console.log('Collected links:', links); 
  return links;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLinks') {
    const links = getLinks();
    sendResponse({ links: links });
  }
});
