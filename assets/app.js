const COOKIE_NAME = "freepik_api_key";
const HISTORY_KEY = "freepik_download_history";
const HISTORY_DB_NAME = "freepik_downloads";
const HISTORY_DB_VERSION = 1;
const HISTORY_FILE_STORE = "history_files";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_HISTORY_ITEMS = 50;
const HISTORY_RETENTION_DAYS = 90;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const apiKeyInput = document.querySelector("#apiKeyInput");
const keyBadge = document.querySelector("#keyBadge");
const saveKeyButton = document.querySelector("#saveKeyButton");
const clearKeyButton = document.querySelector("#clearKeyButton");
const openSettingsButton = document.querySelector("#openSettingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const resourceListInput = document.querySelector("#resourceListInput");
const analyzeButton = document.querySelector("#analyzeButton");
const downloadAllButton = document.querySelector("#downloadAllButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const messageBar = document.querySelector("#messageBar");
const queueCount = document.querySelector("#queueCount");
const queueList = document.querySelector("#queueList");
const historySearchInput = document.querySelector("#historySearchInput");
const historyFromDateInput = document.querySelector("#historyFromDate");
const historyToDateInput = document.querySelector("#historyToDate");
const clearHistoryFiltersButton = document.querySelector("#clearHistoryFiltersButton");
const toggleHistoryFiltersButton = document.querySelector("#toggleHistoryFiltersButton");
const historyToolbar = document.querySelector("#historyToolbar");
const historySummary = document.querySelector("#historySummary");
const historyList = document.querySelector("#historyList");

let queueItems = [];
let historyItems = [];
let hasAutoRun = false;
let historyDbPromise = null;

function getCookie(name) {
  const target = `${name}=`;
  const cookies = document.cookie.split(";").map((item) => item.trim());
  const found = cookies.find((item) => item.startsWith(target));
  return found ? decodeURIComponent(found.slice(target.length)) : "";
}

function setCookie(name, value) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureFlag}`;
}

function deleteCookie(name) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
}

function setMessage(text, tone = "neutral") {
  messageBar.textContent = text;
  messageBar.className = `message ${tone}`;
}

function extractResourceId(input) {
  const value = input.trim();
  if (!value) {
    return "";
  }

  if (/^\d+$/.test(value)) {
    return value;
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
    const genericMatch = value.match(/(\d{6,})/);
    if (genericMatch) {
      return genericMatch[1];
    }
  }

  const fallbackMatch = value.match(/(\d{6,})/);
  return fallbackMatch ? fallbackMatch[1] : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateKeyBadge() {
  const apiKey = getCookie(COOKIE_NAME);
  if (apiKey) {
    const masked = `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
    keyBadge.textContent = `API key đã lưu: ${masked}`;
    keyBadge.className = "pill success";
  } else {
    keyBadge.textContent = "API key chưa cấu hình";
    keyBadge.className = "pill muted";
  }
}

function openSettings() {
  apiKeyInput.value = getCookie(COOKIE_NAME);
  settingsDialog.showModal();
}

function closeSettings() {
  settingsDialog.close();
}

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function openHistoryDb() {
  if (historyDbPromise) {
    return historyDbPromise;
  }

  historyDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_FILE_STORE)) {
        db.createObjectStore(HISTORY_FILE_STORE);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Không mở được IndexedDB.")));
  });

  return historyDbPromise;
}

async function runHistoryStoreRequest(mode, operation) {
  const db = await openHistoryDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_FILE_STORE, mode);
    const store = transaction.objectStore(HISTORY_FILE_STORE);
    let request;

    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request lỗi.")));
    transaction.addEventListener("abort", () => {
      reject(transaction.error || new Error("IndexedDB transaction bị hủy."));
    });
  });
}

function normalizeHistoryEntry(entry) {
  if (!entry || !entry.id) {
    return null;
  }

  const downloadedAt = entry.downloadedAt || new Date().toISOString();
  const size = Number(entry.size);
  const storageKey = String(entry.storageKey || "");

  return {
    id: String(entry.id),
    title: entry.title || "",
    filename: entry.filename || `resource-${entry.id}`,
    downloadedAt,
    storageKey,
    hasLocalFile: Boolean(storageKey && entry.hasLocalFile),
    size: Number.isFinite(size) && size > 0 ? size : 0,
  };
}

function pruneHistoryItems(items) {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;

  return items
    .map(normalizeHistoryEntry)
    .filter(Boolean)
    .filter((entry) => {
      const timestamp = new Date(entry.downloadedAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    })
    .sort((left, right) => new Date(right.downloadedAt).getTime() - new Date(left.downloadedAt).getTime())
    .slice(0, MAX_HISTORY_ITEMS);
}

async function saveHistoryFile(storageKey, blob) {
  await runHistoryStoreRequest("readwrite", (store) => store.put(blob, storageKey));
}

async function getHistoryFile(storageKey) {
  return runHistoryStoreRequest("readonly", (store) => store.get(storageKey));
}

async function deleteHistoryFile(storageKey) {
  if (!storageKey) {
    return;
  }

  await runHistoryStoreRequest("readwrite", (store) => store.delete(storageKey));
}

async function clearHistoryFiles() {
  await runHistoryStoreRequest("readwrite", (store) => store.clear());
}

async function syncHistory(items, previousItems = readHistory()) {
  const nextItems = pruneHistoryItems(items);
  const nextStorageKeys = new Set(nextItems.map((entry) => entry.storageKey).filter(Boolean));
  const removedKeys = previousItems
    .map((entry) => String(entry?.storageKey || ""))
    .filter((storageKey) => storageKey && !nextStorageKeys.has(storageKey));

  await Promise.all(removedKeys.map((storageKey) => deleteHistoryFile(storageKey)));
  writeHistory(nextItems);
  historyItems = nextItems;
  renderHistory();
}

async function addHistoryEntry(item, blob) {
  const previousItems = readHistory();
  const storageKey = `resource:${item.id}:${Date.now()}`;

  await saveHistoryFile(storageKey, blob);
  await syncHistory(
    [
      {
        id: item.id,
        title: item.title,
        filename: item.filename,
        downloadedAt: new Date().toISOString(),
        storageKey,
        hasLocalFile: true,
        size: blob.size,
      },
      ...previousItems.filter((entry) => entry.id !== item.id),
    ],
    previousItems,
  );
}

function getHistoryFilters() {
  return {
    query: historySearchInput.value.trim().toLowerCase(),
    fromDate: historyFromDateInput.value,
    toDate: historyToDateInput.value,
  };
}

function getFilteredHistoryItems() {
  const filters = getHistoryFilters();
  const fromTimestamp = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
  const toTimestamp = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : null;

  const queryId = filters.query ? extractResourceId(filters.query) : "";

  return historyItems.filter((item) => {
    // Nếu search query là link, check xem ID có khớp không
    if (queryId && item.id === queryId) {
      return true;
    }

    const haystack = [item.title, item.filename, item.id].join(" ").toLowerCase();
    if (filters.query && !haystack.includes(filters.query)) {
      return false;
    }

    const downloadedAt = new Date(item.downloadedAt).getTime();
    if (fromTimestamp && downloadedAt < fromTimestamp) {
      return false;
    }

    if (toTimestamp && downloadedAt > toTimestamp) {
      return false;
    }

    return true;
  });
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFileSize(value) {
  if (!value) {
    return "Chưa có dung lượng";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const rounded = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function parseEncodedHeader(value) {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseFilenameFromContentDisposition(headerValue) {
  if (!headerValue) {
    return "";
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    return parseEncodedHeader(utf8Match[1]);
  }

  const plainMatch = headerValue.match(/filename="([^"]+)"/i) || headerValue.match(/filename=([^;]+)/i);
  return plainMatch ? plainMatch[1].trim() : "";
}

function renderHistory() {
  const filteredItems = getFilteredHistoryItems();

  if (historySummary) {
    historySummary.textContent = `${filteredItems.length}/${historyItems.length} bản ghi`;
  }

  if (!historyItems.length) {
    historyList.className = "stack-list empty-state";
    historyList.innerHTML = "<p>Chưa có file nào được tải gần đây.</p>";
    return;
  }

  if (!filteredItems.length) {
    historyList.className = "stack-list empty-state";
    historyList.innerHTML = "<p>Không có kết quả khớp với bộ lọc hiện tại.</p>";
    return;
  }

  historyList.className = "stack-list";
  historyList.innerHTML = filteredItems
    .map(
      (item) => `
        <article class="history-card">
          <div class="history-main">
            <p class="history-title">${escapeHtml(item.title || item.filename || `Resource ${item.id}`)}</p>
            <p class="history-meta">ID ${escapeHtml(item.id)} • ${escapeHtml(item.filename || "downloaded file")}</p>
            <p class="history-meta">${escapeHtml(formatFileSize(item.size))} • ${
              item.hasLocalFile ? "Đã cache local" : "Bản cũ chưa có file local"
            }</p>
          </div>
          <div class="history-side">
            <time class="history-time">${formatDate(item.downloadedAt)}</time>
            <div class="history-actions">
              <button
                class="btn btn-secondary"
                type="button"
                data-action="redownload"
                data-storage-key="${escapeHtml(item.storageKey)}"
                ${item.hasLocalFile ? "" : "disabled"}
              >
                Tải lại
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function parseInputList() {
  const rawLines = resourceListInput.value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const map = new Map();
  const invalid = [];

  for (const source of rawLines) {
    const id = extractResourceId(source);
    if (!id) {
      invalid.push(source);
      continue;
    }

    if (!map.has(id)) {
      map.set(id, {
        id,
        source,
        status: "queued",
        title: "",
        type: "",
        license: "",
        premium: false,
        error: "",
      });
    }
  }

  return {
    items: Array.from(map.values()),
    invalid,
  };
}

function renderQueue() {
  queueCount.textContent = `${queueItems.length} item`;
  downloadAllButton.disabled = !queueItems.some((item) => item.status === "ready");

  if (!queueItems.length) {
    queueList.className = "stack-list empty-state";
    queueList.innerHTML = "<p>Chưa có resource nào được phân tích.</p>";
    return;
  }

  queueList.className = "stack-list";
  queueList.innerHTML = queueItems
    .map((item) => {
      const statusText =
        item.status === "ready"
          ? "Sẵn sàng tải"
          : item.status === "loading"
            ? "Đang validate"
            : item.status === "error"
              ? "Lỗi validate"
              : item.status === "downloading"
                ? "Đang tải"
                : item.status === "downloaded"
                  ? "Đã tải"
                  : "Chờ xử lý";

      const title = item.title || `Resource ${item.id}`;
      const metaBits = [
        `ID ${item.id}`,
        item.type || "Unknown type",
        item.license || "Unknown license",
        item.premium ? "Premium" : "Standard",
      ];

      return `
        <article class="resource-card ${item.status}">
          <div class="resource-copy">
            <div class="resource-row">
              <span class="pill ${item.status === "error" ? "danger" : item.status === "ready" || item.status === "downloaded" ? "success" : "muted"}">${statusText}</span>
              <span class="resource-meta">${metaBits.map(escapeHtml).join(" • ")}</span>
            </div>
            <h4>${escapeHtml(title)}</h4>
            ${item.error ? `<p class="resource-error">${escapeHtml(item.error)}</p>` : ""}
            <div class="resource-actions">
              <button
                class="btn btn-primary"
                type="button"
                data-action="download"
                data-id="${escapeHtml(item.id)}"
                ${item.status !== "ready" ? "disabled" : ""}
              >
                Download item này
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateQueueItem(id, patch) {
  queueItems = queueItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
  renderQueue();
}

async function validateItem(item) {
  updateQueueItem(item.id, { status: "loading", error: "" });

  try {
    const response = await fetch(`/api/resource/${item.id}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Validate thất bại.");
    }

    updateQueueItem(item.id, {
      status: "ready",
      title: payload.resource.title,
      type: payload.resource.type,
      license: payload.resource.license,
      premium: payload.resource.premium,
      error: "",
    });
  } catch (error) {
    updateQueueItem(item.id, {
      status: "error",
      error: error.message || "Không validate được resource.",
    });
  }
}

async function analyzeList() {
  return analyzeListWithOptions();
}

async function analyzeListWithOptions(options = {}) {
  if (!getCookie(COOKIE_NAME)) {
    setMessage("Bạn cần cấu hình Freepik API key trong Settings trước.", "error");
    openSettings();
    return { readyCount: 0, totalCount: 0, invalidCount: 0 };
  }

  const { items, invalid } = parseInputList();
  queueItems = items;
  renderQueue();

  if (!items.length) {
    setMessage("Danh sách không có resource ID hợp lệ.", "error");
    return { readyCount: 0, totalCount: 0, invalidCount: invalid.length };
  }

  setMessage(`Đang validate ${items.length} resource...`, "neutral");

  for (const item of items) {
    // tuần tự để tránh bắn quá nhiều request cùng lúc vào Freepik
    // và giữ trạng thái UI dễ theo dõi.
    // eslint-disable-next-line no-await-in-loop
    await validateItem(item);
  }

  const readyCount = queueItems.filter((item) => item.status === "ready").length;
  if (invalid.length) {
    setMessage(
      `Validate xong ${readyCount}/${items.length} item. Bỏ qua ${invalid.length} dòng không nhận diện được ID.`,
      readyCount ? "success" : "error",
    );
    if (options.autoDownload && readyCount) {
      await downloadAllReady();
    }

    return { readyCount, totalCount: items.length, invalidCount: invalid.length };
  }

  setMessage(
    readyCount
      ? `Validate xong ${readyCount}/${items.length} item.`
      : "Không có item nào validate thành công.",
    readyCount ? "success" : "error",
  );

  if (options.autoDownload && readyCount) {
    await downloadAllReady();
  }

  return { readyCount, totalCount: items.length, invalidCount: invalid.length };
}

async function downloadItem(id) {
  const item = queueItems.find((entry) => entry.id === id);
  if (!item || item.status !== "ready") {
    return;
  }

  updateQueueItem(id, { status: "downloading" });

  try {
    const response = await fetch(`/api/download/${id}?mode=file`);
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        throw new Error(payload.error || "Không lấy được file tải.");
      }

      throw new Error((await response.text()) || "Không lấy được file tải.");
    }

    const filename =
      parseEncodedHeader(response.headers.get("x-download-filename")) ||
      parseEncodedHeader(response.headers.get("x-freepik-filename")) ||
      parseFilenameFromContentDisposition(response.headers.get("content-disposition")) ||
      item.filename ||
      item.title ||
      `resource-${id}`;
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("File tải về rỗng.");
    }

    downloadBlob(blob, filename);

    updateQueueItem(id, {
      status: "downloaded",
      filename,
    });
    await addHistoryEntry(
      {
        id,
        title: item.title || `Resource ${id}`,
        filename,
      },
      blob,
    );
    setMessage(`Đã tải ${item.title || `resource ${id}`} và lưu vào lịch sử local.`, "success");
  } catch (error) {
    updateQueueItem(id, {
      status: "ready",
      error: error.message || "Tải thất bại.",
    });
    setMessage(error.message || "Tải thất bại.", "error");
  }
}

async function redownloadHistoryItem(storageKey) {
  const item = historyItems.find((entry) => entry.storageKey === storageKey);
  if (!item || !item.storageKey) {
    setMessage("Không tìm thấy file local trong lịch sử.", "error");
    return;
  }

  try {
    const blob = await getHistoryFile(item.storageKey);
    if (!(blob instanceof Blob) || !blob.size) {
      const previousItems = readHistory();
      const nextItems = previousItems.map((entry) =>
        entry.storageKey === storageKey ? { ...entry, hasLocalFile: false, size: 0 } : entry,
      );
      await syncHistory(nextItems, previousItems);
      throw new Error("File local không còn trong bộ nhớ trình duyệt.");
    }

    downloadBlob(blob, item.filename || `resource-${item.id}`);
    setMessage(`Đã tải lại ${item.title || item.filename || `resource ${item.id}`} từ lịch sử local.`, "success");
  } catch (error) {
    setMessage(error.message || "Không tải lại được file từ lịch sử.", "error");
  }
}

async function downloadAllReady() {
  const readyItems = queueItems.filter((item) => item.status === "ready");
  if (!readyItems.length) {
    setMessage("Không có item hợp lệ để tải.", "error");
    return;
  }

  setMessage(`Đang tải ${readyItems.length} item hợp lệ...`, "neutral");

  for (const item of readyItems) {
    // eslint-disable-next-line no-await-in-loop
    await downloadItem(item.id);
  }
}

async function hydrateFromQueryParams() {
  if (hasAutoRun) {
    return;
  }

  const url = new URL(window.location.href);
  const importValue = url.searchParams.get("import");
  if (!importValue) {
    return;
  }

  hasAutoRun = true;
  resourceListInput.value = importValue
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

  const shouldDownload = url.searchParams.get("download") === "1";
  await analyzeListWithOptions({ autoDownload: shouldDownload });

  url.searchParams.delete("import");
  url.searchParams.delete("download");
  window.history.replaceState({}, "", url.toString());
}

async function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  historyItems = [];
  await clearHistoryFiles();
  renderHistory();
}

async function refreshHistory() {
  await syncHistory(readHistory());
}

openSettingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);

saveKeyButton.addEventListener("click", () => {
  const value = apiKeyInput.value.trim();
  if (!value) {
    setMessage("Nhập Freepik API key trước khi lưu.", "error");
    return;
  }

  setCookie(COOKIE_NAME, value);
  updateKeyBadge();
  closeSettings();
  setMessage("Đã cập nhật cấu hình API key.", "success");
});

clearKeyButton.addEventListener("click", () => {
  deleteCookie(COOKIE_NAME);
  apiKeyInput.value = "";
  updateKeyBadge();
  closeSettings();
  setMessage("Đã xóa API key khỏi cookie local.", "neutral");
});

analyzeButton.addEventListener("click", analyzeList);
downloadAllButton.addEventListener("click", downloadAllReady);

queueList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action='download']");
  if (!target) {
    return;
  }

  downloadItem(target.dataset.id);
});

historyList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action='redownload']");
  if (!target) {
    return;
  }

  redownloadHistoryItem(target.dataset.storageKey);
});

clearHistoryButton.addEventListener("click", async () => {
  await clearHistory();
  setMessage("Đã xóa lịch sử tải gần đây.", "neutral");
});

toggleHistoryFiltersButton.addEventListener("click", () => {
  historyToolbar.hidden = !historyToolbar.hidden;
});

historySearchInput.addEventListener("input", renderHistory);
historyFromDateInput.addEventListener("change", renderHistory);
historyToDateInput.addEventListener("change", renderHistory);
clearHistoryFiltersButton.addEventListener("click", () => {
  historySearchInput.value = "";
  historyFromDateInput.value = "";
  historyToDateInput.value = "";
  renderHistory();
});

settingsDialog.addEventListener("click", (event) => {
  const box = settingsDialog.querySelector(".settings-panel");
  const rect = box.getBoundingClientRect();
  const isInside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!isInside) {
    closeSettings();
  }
});

async function initializeApp() {
  updateKeyBadge();
  renderQueue();
  await refreshHistory();
  await hydrateFromQueryParams();

  if (!getCookie(COOKIE_NAME)) {
    setTimeout(openSettings, 250);
  }
}

initializeApp();
