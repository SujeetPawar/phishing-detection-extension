chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'collectLinks') {
      console.log('Links collected:', message.links);
      console.log(message.links)
      chrome.runtime.sendMessage({
        action: 'processLinks',
        links: message.links
      });
    }
  });
  