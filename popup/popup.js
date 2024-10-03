function displayLinks(links) {
  const linksList = document.getElementById('linksList');
  // console.log('Links list element:', linksList);
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
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length === 0) {
    // console.error('No active tab found.');
    return;
  }

  const activeTab = tabs[0];

  chrome.tabs.sendMessage(activeTab.id, { action: 'getLinks' }, (response) => {
    if (response && response.links) {
      // console.log('Received links:', response.links);  
      displayLinks(response.links);
    } else {
      document.getElementById('linksList').textContent = 'No links found.';
    }
  });
});
