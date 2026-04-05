const STORAGE_KEY = "freepikDownloaderAppUrl";

const appUrlInput = document.querySelector("#appUrlInput");
const tabState = document.querySelector("#tabState");
const saveButton = document.querySelector("#saveButton");
const confirmButton = document.querySelector("#confirmButton");
const messageBar = document.querySelector("#messageBar");

let currentTab = null;
let currentResourceUrl = "";

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

function normalizeAppUrl(value) {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
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
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) {
    appUrlInput.value = stored[STORAGE_KEY];
  }
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  currentResourceUrl = tab?.url || "";

  if (!currentTab || !currentResourceUrl) {
    tabState.innerHTML = "<p class='tab-url'>Không đọc được tab hiện tại.</p>";
    confirmButton.disabled = true;
    return;
  }

  tabState.innerHTML = `
    <p class="tab-title">${escapeHtml(currentTab.title || "Untitled tab")}</p>
    <p class="tab-url">${escapeHtml(currentResourceUrl)}</p>
  `;

  if (!isFreepikUrl(currentResourceUrl)) {
    setMessage("Tab hiện tại không phải trang Freepik.", "error");
    confirmButton.disabled = true;
    return;
  }

  const resourceId = extractResourceId(currentResourceUrl);
  if (!resourceId) {
    setMessage("Trang này chưa có resource ID hợp lệ để tải.", "error");
    confirmButton.disabled = true;
    return;
  }

  setMessage(`Đã nhận diện resource ID ${resourceId}.`, "success");
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
  const normalized = normalizeAppUrl(appUrlInput.value);
  if (!normalized) {
    setMessage("App URL chưa hợp lệ.", "error");
    return;
  }

  await chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
  appUrlInput.value = normalized;
  setMessage("Đã lưu app URL.", "success");
});

confirmButton.addEventListener("click", async () => {
  const normalized = normalizeAppUrl(appUrlInput.value);
  if (!normalized) {
    setMessage("Bạn cần lưu app URL trước.", "error");
    return;
  }

  if (!isFreepikUrl(currentResourceUrl)) {
    setMessage("Tab hiện tại không phải trang Freepik.", "error");
    return;
  }

  const target = new URL(`${normalized}/`);
  target.searchParams.set("import", currentResourceUrl);
  target.searchParams.set("download", "1");
  target.searchParams.set("from", "extension");

  await chrome.tabs.create({ url: target.toString() });
  window.close();
});

await loadSettings();
await loadActiveTab();
