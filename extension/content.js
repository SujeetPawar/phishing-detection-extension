async function checkSSL(url) {
  try {
    const response = await fetch(url, { mode: "no-cors" });
    return url.startsWith("https");
  } catch (error) {
    return false;
  }
}

async function analyzeURL(url) {
  const urlFeatures = extractURLFeatures(url);
  const validSSL = await checkSSL(url); // SSL Check

  const response = await fetch("http://localhost:5000/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(urlFeatures),
  });

  const result = await response.json();
  return { ...result, validSSL }; // Send SSL data too
}

// Extract URL features
function extractURLFeatures(url) {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;

  return {
    url,
    url_length: url.length,
    has_https: urlObj.protocol === "https:" ? 1 : 0,
    num_dots: domain.split(".").length - 1,
    path_length: urlObj.pathname.length,
    query_length: urlObj.search.length,
    has_login: url.toLowerCase().includes("login") ? 1 : 0,
    has_verify: url.toLowerCase().includes("verify") ? 1 : 0,
    has_secure: url.toLowerCase().includes("secure") ? 1 : 0,
    num_special_chars: (url.match(/[@-_?&=]/g) || []).length,
  };
}

// Send links for analysis
chrome.runtime.sendMessage({
  action: "analyzeLinks",
  links: [...document.querySelectorAll("a")].map(a => a.href),
});
