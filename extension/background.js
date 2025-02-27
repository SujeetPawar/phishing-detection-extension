chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeLinks") {
    const uniqueLinks = [...new Set(message.links.filter(link => link.startsWith("http")))];

    if (uniqueLinks.length === 0) {
      chrome.runtime.sendMessage({ action: "updatePopup", results: [] });
      return;
    }

    Promise.all(uniqueLinks.map(analyzeURL))
      .then(results => {
        chrome.runtime.sendMessage({ action: "updatePopup", results });
      })
      .catch(error => {
        console.error("Error in analyzeLinks:", error);
        chrome.runtime.sendMessage({ action: "error", message: error.message });
      });

    return true; // Keeps response open for async operations
  }
});

async function analyzeURL(url) {
  try {
    const response = await fetch("http://localhost:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    // if (!response.ok) throw new Error(`API error: ${response.status}`);

    const result = await response.json();
    const validSSL = url.startsWith("https");

    return { url, prediction: result.prediction, validSSL };
  } catch (error) {
    console.error("Error analyzing URL:", error);
    return { url, prediction: "error", message: error.message, validSSL: false };
  }
}
