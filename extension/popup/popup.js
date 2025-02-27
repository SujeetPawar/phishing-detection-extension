async function displayResults(data) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (!data || data.length === 0) {
    resultsDiv.innerHTML = "<p>No links found on this page.</p>";
    return;
  }

  let totalThreat = 0;
  let totalLinks = data.length;

  // Create link analysis list
  const linksList = document.createElement("ul");
  linksList.id = "linksList";

  data.forEach(item => {
    const li = document.createElement("li");
    li.className = item.prediction === "Phishing" ? "dangerous-link" : "safe-link";
    li.innerHTML = `
      <strong>${item.url}</strong> - ${item.prediction === "Phishing" ? "🚨 Suspicious" : "✅ Safe"}
      <br>
      SSL: ${item.validSSL ? "✅ Valid" : "⚠️ Expired or Invalid"}
    `;

    if (item.prediction === "Phishing") totalThreat++;
    linksList.appendChild(li);
  });

  resultsDiv.appendChild(linksList);

  // Calculate threat percentage
  const threatLevel = (totalThreat / totalLinks) * 100;
  updateThreatUI(threatLevel);
}

// Update threat UI
function updateThreatUI(threatLevel) {
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${threatLevel}%`;
  progressBar.style.backgroundColor = getThreatColor(threatLevel);

  const threatLabel = document.querySelector("#threatLevel p");
  threatLabel.innerHTML = `<strong>Threat Level: ${Math.round(threatLevel)}%</strong>`;
}

// Function to determine threat color
function getThreatColor(level) {
  if (level < 30) return "#4CAF50";  // Green (Safe)
  if (level < 70) return "#FFC107";  // Yellow (Warning)
  return "#F44336";                   // Red (High Risk)
}

// Listen for data from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updatePopup") {
    displayResults(message.results);
  }
});
