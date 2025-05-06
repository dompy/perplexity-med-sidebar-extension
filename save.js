// save.js

document.getElementById("save").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  if (!apiKey) return;

  chrome.storage.local.set({ apiKey }, () => {
    const status = document.getElementById("status");
    status.textContent = "✅ API Key gespeichert!";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});

// Beim Laden API-Key anzeigen, falls vorhanden
chrome.storage.local.get("apiKey", (data) => {
  if (data.apiKey) {
    document.getElementById("apiKey").value = data.apiKey;
  }
});
