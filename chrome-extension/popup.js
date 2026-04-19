const API_KEY_KEY = "freepikApiKey";

const apiKeyInput = document.querySelector("#apiKeyInput");
const tabState = document.querySelector("#tabState");
const saveButton = document.querySelector("#saveButton");
const confirmButton = document.querySelector("#confirmButton");
const togglePassword = document.querySelector("#togglePassword");
const messageBar = document.querySelector("#messageBar");

let currentTab = null;
let currentResourceUrl = "";

if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    const isPassword = apiKeyInput.getAttribute("type") === "password";
    apiKeyInput.setAttribute("type", isPassword ? "text" : "password");
    
    // Thay đổi icon dựa trên trạng thái
    const icon = togglePassword.querySelector("svg");
    if (isPassword) {
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  });
}

function extractResourceId(input) {
  const value = (input || "").trim();
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    const apiMatch = url.pathname.match(/\/resources\/(\d+)/);
    if (apiMatch) {
      return apiMatch[1];
    }

    const slugMatch = url.pathname.match(/_(\d+)(?:\.htm|$)/);
    if (slugMatch) {
      return slugMatch[1];
    }
  } catch {
    return "";
  }

  return "";
}

function setMessage(text, tone = "") {
  messageBar.textContent = text;
  messageBar.className = tone ? `message ${tone}` : "message";
}

function isFreepikUrl(value) {
  try {
    const url = new URL(value);
    return /(^|\.)freepik\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get([API_KEY_KEY]);
  if (stored[API_KEY_KEY]) {
    apiKeyInput.value = stored[API_KEY_KEY];
  }
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  currentResourceUrl = tab?.url || "";

  if (!currentTab || !currentResourceUrl) {
    tabState.innerHTML = "<p class='tab-url'>Unable to read current tab.</p>";
    confirmButton.disabled = true;
    return;
  }

  tabState.innerHTML = `
    <p class="tab-title">${escapeHtml(currentTab.title || "Untitled tab")}</p>
    <p class="tab-url">${escapeHtml(currentResourceUrl)}</p>
  `;

  if (!isFreepikUrl(currentResourceUrl)) {
    setMessage("Current tab is not a Freepik page.", "error");
    confirmButton.disabled = true;
    return;
  }

  const resourceId = extractResourceId(currentResourceUrl);
  if (!resourceId) {
    setMessage("No valid resource ID detected on this page.", "error");
    confirmButton.disabled = true;
    return;
  }

  setMessage(`Detected resource ID: ${resourceId}.`, "success");
  confirmButton.disabled = false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

saveButton.addEventListener("click", async () => {
  const settings = {};
  if (apiKeyInput.value.trim()) {
    settings[API_KEY_KEY] = apiKeyInput.value.trim();
  }

  await chrome.storage.sync.set(settings);
  setMessage("Settings saved successfully.", "success");
});

async function downloadDirectly(resourceId, apiKey) {
  setMessage("Fetching download link from Freepik...", "neutral");
  
  try {
    const response = await fetch(`https://api.freepik.com/v1/resources/${resourceId}/download`, {
      headers: {
        "x-freepik-api-key": apiKey,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `API Error: ${response.status}`);
    }

    const downloadUrl = data.data?.url || data.url || data.download_url;
    const filename = data.data?.filename || `freepik-${resourceId}.zip`;

    if (!downloadUrl) {
      throw new Error("Download link not found in API response.");
    }

    setMessage("Starting download...", "success");
    
    chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        setMessage("Download error: " + chrome.runtime.lastError.message, "error");
      } else {
        setMessage("Downloading: " + filename, "success");
        setTimeout(() => window.close(), 2000);
      }
    });

  } catch (error) {
    setMessage(error.message, "error");
    console.error("Download error:", error);
  }
}

confirmButton.addEventListener("click", async () => {
  const stored = await chrome.storage.sync.get(API_KEY_KEY);
  const apiKey = stored[API_KEY_KEY];

  if (!apiKey) {
    setMessage("Please enter and save your Freepik API Key first.", "error");
    apiKeyInput.focus();
    return;
  }

  const resourceId = extractResourceId(currentResourceUrl);
  if (!resourceId) {
    setMessage("Resource ID not found.", "error");
    return;
  }

  await downloadDirectly(resourceId, apiKey);
});

await loadSettings();
await loadActiveTab();
