const API_KEY_KEY = "freepikApiKey";
const DEFAULT_APP_URL = "https://freepik-downloader.pages.dev";

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

function isValidResourcePage() {
  return Boolean(extractResourceId(window.location.href));
}

function buildTargetUrl(appUrl) {
  const target = new URL(`${appUrl.replace(/\/$/, "")}/`);
  target.searchParams.set("import", window.location.href);
  target.searchParams.set("download", "1");
  target.searchParams.set("from", "extension");
  return target.toString();
}

async function handleDownloadClick() {
  const stored = await chrome.storage.sync.get([API_KEY_KEY]);
  const apiKey = stored[API_KEY_KEY];
  const resourceId = extractResourceId(window.location.href);

  if (!resourceId) {
    alert("Resource ID not found on this page.");
    return;
  }

  if (apiKey) {
    const button = document.querySelector("#fpdl-floating-button");
    const label = button?.querySelector(".fpdl-label");
    const originalText = label ? label.textContent : "";

    if (label) label.textContent = "Processing...";
    
    // Gửi yêu cầu cho Background Script xử lý để tránh lỗi CORS và Network Error
    chrome.runtime.sendMessage({
      action: "download",
      resourceId: resourceId,
      apiKey: apiKey
    }, (response) => {
      if (label) label.textContent = originalText;
      
      if (response && response.error) {
        alert("Error: " + response.error);
      }
    });
  } else {
    window.open(buildTargetUrl(DEFAULT_APP_URL), "_blank", "noopener");
  }
}

function ensureFloatingButton() {
  if (document.querySelector("#fpdl-floating-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "fpdl-floating-button";
  button.type = "button";
  button.innerHTML = `
    <span class="fpdl-icon"></span>
    <span class="fpdl-label">Download this image</span>
  `;
  button.addEventListener("click", handleDownloadClick);
  document.documentElement.appendChild(button);
}

function syncFloatingButton() {
  const existing = document.querySelector("#fpdl-floating-button");
  if (!isValidResourcePage()) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  ensureFloatingButton();
}

syncFloatingButton();

let previousUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== previousUrl) {
    previousUrl = window.location.href;
    syncFloatingButton();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
