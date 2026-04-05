const STORAGE_KEY = "freepikDownloaderAppUrl";
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

async function openDownloader() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const appUrl = stored[STORAGE_KEY] || DEFAULT_APP_URL;
  window.open(buildTargetUrl(appUrl), "_blank", "noopener");
}

function ensureFloatingButton() {
  if (document.querySelector("#fpdl-floating-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "fpdl-floating-button";
  button.type = "button";
  button.textContent = "Download bằng Freepik Downloader";
  button.addEventListener("click", openDownloader);
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
