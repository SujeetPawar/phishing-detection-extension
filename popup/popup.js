function displayLinks(links) {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;

  links.forEach(link => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = link;
    a.textContent = link;
    a.target = "_blank";
    li.appendChild(a);
    linksList.appendChild(li);
  });

  // Add a status message for sending links
  const statusMessage = document.createElement('p');
  statusMessage.id = 'statusMessage';
  statusMessage.textContent = 'Preparing to send links to the ML model...';
  statusMessage.style.color = '#666';
  linksList.parentElement.appendChild(statusMessage);

  // Simulate sending links to the ML model after a delay
  setTimeout(() => {
    statusMessage.textContent = 'Links have been sent to the ML model for analysis!';
    statusMessage.style.color = 'green';
  }, 3000); // Delay of 3 seconds
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length === 0) {
    console.error('No active tab found.');
    return;
  }

  const activeTabId = tabs[0].id;

  // Inject content script dynamically
  chrome.scripting.executeScript(
    {
      target: { tabId: activeTabId },
      files: ['content.js'],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error('Error injecting content script:', chrome.runtime.lastError.message);
        return;
      }

      // Send message to the injected content script
      chrome.tabs.sendMessage(activeTabId, { action: 'getLinks' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error communicating with content script:', chrome.runtime.lastError.message);
          return;
        }

        if (response && response.links) {
          console.log('Received links from content script:', response.links);
          displayLinks(response.links);
        } else {
          document.getElementById('linksList').textContent = 'No links found.';
        }
      });
    }
  );
});
